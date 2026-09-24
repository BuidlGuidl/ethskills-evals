# Translator Marketplace — Architecture Plan

## 1. The one decision that shapes everything

The ranking formula changes weekly. The proof of work history must last forever.

So they cannot live in the same place. The contract stores **facts that happened**
(this client paid this translator this much for this job; this dispute resolved this
way; this credential was attested by this issuer). The ranking service stores
**opinions about those facts** (how much a completed job is worth relative to a fast
response time). Opinions get a new weight vector every Tuesday. Facts get an
immutable event log.

Concretely: **no score, no weight, no ranking input ever goes onchain.** If we put
`reputationScore` in a struct, tuning the formula becomes a migration, and we will
either stop tuning or start lying about what the number means. The escrow contract
does not know the word "reputation."

What the translator can prove without us: the set of jobs they completed, the USDC
they were paid, the disputes they won or lost, and the credential attestations issued
to their address. That is the durable claim. It is enough to reconstruct a resume,
and it is exactly the part that must survive our search API being down or our company
being gone.

## 2. Onchain / offchain split

| Data | Where | Why |
|---|---|---|
| USDC job funding, release, refund | **Contract** | Trustless value transfer — the whole point |
| Job record (client, translator, amount, language pair hash, status) | **Contract** (events + minimal state) | This is the provable work history |
| Dispute filing + outcome | **Contract** | Affects payment; must be non-repudiable |
| Language credentials (e.g. ATA cert, DipTrans) | **EAS attestation** | Permanent third-party claim, revocable by issuer |
| Biography, headline, profile photo | **Offchain DB** | Product content, edited constantly, no trust value |
| Work samples | **Offchain DB + IPFS hash for the ones the translator wants pinned** | Big blobs never go onchain |
| Private client feedback (text + stars) | **Offchain DB only** | It's private; publishing it or its hash leaks or is useless |
| Response time, acceptance rate, message logs | **Offchain DB** | Derived from our messaging system, unverifiable by nature |
| Ranking weights + computed scores | **Offchain config + search index** | Changes weekly |
| Translated document contents | **Offchain (encrypted S3), SHA-256 hash onchain at delivery** | Proves *what* was delivered without publishing client work |

## 3. Contracts — one custom contract

`TranslationEscrow.sol` (Solidity, OpenZeppelin `AccessControl` + `SafeERC20` +
`ReentrancyGuard`). Plus we *use* an already-deployed contract we don't write:
**EAS** (Ethereum Attestation Service) for credentials. That's it. One deployment.

### State

```solidity
struct Job {
    address client;
    address translator;
    uint128 amount;          // USDC, 6 decimals — never assume 18
    uint64  fundedAt;
    uint64  deliveredAt;     // 0 until delivery
    Status  status;          // Funded | Delivered | Released | Disputed | Refunded
    bytes32 deliveryHash;    // SHA-256 of the delivered file
    bytes32 specHash;        // hash of offchain job spec (language pair, wordcount, deadline)
}
mapping(uint256 => Job) public jobs;
```

Note what is *absent*: no bio, no sample URIs, no star rating, no counters like
`completedJobs`, no `avgResponseTime`. Counters are an index's job — deriving them
from events costs us nothing and costs the contract a storage write per job.

### Events (the actual public API for verification)

```solidity
event JobFunded(uint256 indexed jobId, address indexed client, address indexed translator, uint256 amount, bytes32 specHash);
event JobDelivered(uint256 indexed jobId, bytes32 deliveryHash);
event JobReleased(uint256 indexed jobId, uint256 toTranslator, uint256 fee);
event JobRefunded(uint256 indexed jobId, uint256 toClient);
event DisputeOpened(uint256 indexed jobId, address indexed by);
event DisputeResolved(uint256 indexed jobId, uint256 toTranslator, uint256 toClient);
```

`translator` is indexed on `JobFunded` so a translator (or anyone auditing them) can
pull their complete history with one `eth_getLogs` filter against any public RPC.
That is the offline-verification story in one line of code.

### State transition audit

| Function | Who calls it | Why they would | If nobody calls it |
|---|---|---|---|
| `fundJob(translator, amount, specHash)` | Client | Can't start work without it | No job exists — fine |
| `deliver(jobId, deliveryHash)` | Translator | Starts the acceptance clock | Client refunds after `deliveryDeadline` |
| `release(jobId)` | Client | Accepts the translation | **Translator calls `claimAfterReviewWindow` once 7 days pass post-delivery** — no keeper, no admin needed |
| `claimAfterReviewWindow(jobId)` | Translator | Gets paid | Funds sit; translator is the one who loses, so they will call it |
| `refundExpired(jobId)` | Client | Translator never delivered | Client's own money, they're motivated |
| `openDispute(jobId)` | Either party | Blocks auto-release | No dispute; auto-release proceeds |
| `resolveDispute(jobId, splitBps)` | `ARBITER_ROLE` (multisig → later a real arbitration module) | Contractual duty | **This is the one admin crutch.** Mitigation: a `disputeTimeout` (30 days) that refunds the client if the arbiter never acts, so funds can never be frozen permanently by our inaction |

No function requires us to be alive for a translator to get paid. The review-window
claim is the safety valve.

### Credentials via EAS

We don't write a registry. A credential body (or our verification desk, acting as a
named issuer) signs an EAS attestation with schema
`(string credential, string langPair, uint64 expiresAt, bytes32 evidenceHash)`
against the translator's address. Verification = read the attestation from EAS,
check `attester` is on a public allowlist we publish, check not revoked.

Why EAS instead of our own contract: revocation, expiry, schema registry, and
offchain-signed attestations are already built and already indexed by third parties.
Writing `CredentialRegistry.sol` would be reinventing an audited primitive.

## 4. What the search screen actually reads

**The search screen reads our API. It never touches the chain.** Ranked search over
five signals with sub-200ms latency is not something an RPC node can do, and pretending
otherwise produces a slow, broken screen.

```
Search UI ──► /api/search ──► Postgres + OpenSearch (ranked index)
                                   ▲
                                   │ writers
              ┌────────────────────┼─────────────────────┐
     Indexer (Ponder)        Product DB              Ranking job
     chain events →          bios, samples,          reads both, writes
     jobs_completed,         feedback, response       score column
     disputes, creds         times
```

- **Indexer**: Ponder (or a subgraph) tailing `TranslationEscrow` events and EAS
  attestations on our schema. Writes `translator_onchain_stats`: completed job count,
  gross USDC earned, disputes opened/lost, first-job timestamp, active credentials.
  This table is a *cache of the chain*, fully rebuildable from block 0 by anyone.
- **Product DB**: bios, samples, availability, message-derived response times, and
  private client feedback (never returned by the search API, only consumed by the
  ranking job).
- **Ranking job**: recomputes `score` per translator on a schedule and on event
  arrival. Search sorts by that column.

Reorg safety: the indexer treats the last N blocks as unconfirmed; a job only counts
toward ranking after ~50 Base blocks. Prevents a reorg from silently inflating stats.

## 5. How ranking is produced

A plain weighted function in the ranking service, with weights in a versioned config
file (not a DB row someone edits by hand — we want the git history):

```yaml
ranking_version: 2026-09-21
weights:
  completed_jobs_log:    0.30   # log1p(completed) — one job #500 ≠ one job #1
  gross_volume_log:      0.15
  dispute_rate:         -0.35   # lost disputes weighted heavier than opened
  response_time_p50:     0.10
  credential_score:      0.20   # per-language-pair, expired attestations excluded
  feedback_mean:         0.25   # Bayesian-shrunk toward the global mean
  recency_decay:         half-life 180 days on all activity terms
```

Weekly tuning = edit the YAML, ship, backfill. **Zero contract interaction.** We log
`ranking_version` on every search response so A/B results are attributable, and we
keep the last N versions runnable so we can diff rankings before rollout.

Cold start: new translators with credentials but no jobs get a floor from
`credential_score` plus a small exploration boost so they surface enough to get a
first job. Otherwise the marketplace ossifies around whoever joined first.

Per-language-pair scoring, not global: someone excellent at JA→EN is not thereby good
at DE→FR.

## 6. What verification actually buys — and what it doesn't

Being precise here matters more than sounding good.

**Independently verifiable, no API needed** — a translator runs a script against a
public Base RPC (or hands the script to a prospective client) and proves:
- every job they completed, with client address, USDC amount, and timestamp
- the SHA-256 of each file they delivered (they hold the file; the hash matches)
- their dispute record, including disputes they won
- every unexpired credential attestation and who issued it

We will ship this as `verify.html` — a single static page, pinned to IPFS, that takes
an address and renders a portable work history straight from `eth_getLogs`. No
backend, no npm install. That is the "our API is down" answer, and it's ~150 lines.

**Not verifiable, and we say so in the UI:**
- Private client feedback and star ratings. It's private by design; a hash commitment
  wouldn't help since nobody can check a hash of text they're not allowed to read.
- Response times — they come from our messaging system.
- The score itself. A rank is our editorial opinion, not a fact about the world.

So the profile page shows two visually distinct zones: **Verified onchain** (jobs,
volume, disputes, credentials, each with a "check this yourself" link) and
**Platform signals** (rating, response time, rank). Conflating them would be the real
failure — it would let an unverifiable number borrow the credibility of a verifiable one.

## 7. Chain

**Base.** Reasons, in order: native USDC (no bridged-asset ambiguity in an escrow that
holds client money), Coinbase Smart Wallet so translators who have never held crypto
can onboard with a passkey, EAS deployed, and cheap enough that a 5-transaction job
lifecycle costs pennies — which matters when the median job is $40 and we may
sponsor gas via a paymaster.

Mainnet would work and is cheaper than its reputation, but this is a consumer app with
non-crypto users and many small transactions; Base's onboarding story is the deciding
factor, not the gas price. One chain at launch — multi-chain fragments the escrow
liquidity and the work history for no user benefit.

## 8. Migration path we're deliberately keeping open

Because the contract holds no product logic, almost everything we'll want to change in
year one changes nothing onchain: new ranking signals, new profile fields, new search
UX, new feedback schema, new credential types (new EAS schema, same contract).

Things that *would* need a new contract: changing the fee split mechanics, changing
the review window, adding milestone-based partial releases. We'll version by
deploying `TranslationEscrowV2` and having the indexer read both — old jobs stay
settled and provable under V1, new jobs use V2. No storage migration, no proxy, no
upgrade key pointed at user funds. For an escrow holding client money, an immutable
contract plus a versioned indexer is a better trade than an upgradeable proxy.

## 9. Build order

1. `TranslationEscrow.sol` — Foundry unit + fuzz tests (USDC 6-decimal math, split
   arithmetic, every status transition, unauthorized callers), fork test against Base
   USDC. Then a security pass from a fresh reviewer.
2. EAS schema registration + issuer allowlist.
3. Ponder indexer → Postgres, with a from-genesis rebuild test.
4. Ranking job + config, seeded with plausible weights we fully expect to be wrong.
5. Search + profile UI, with the verified/unverified split enforced in the components.
6. `verify.html` on IPFS — ship it in week one, not "later," or it never ships.
7. Deploy, verify on Basescan, arbiter role → Gnosis Safe.
