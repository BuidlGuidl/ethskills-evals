# Translator Marketplace — Architecture Plan

## The shape of the problem

Two requirements pull in opposite directions:

1. **The ranking formula changes weekly.** Completed jobs, disputes, response
   time, credentials, and private feedback get reweighted as we learn what
   predicts a good hire.
2. **A translator must be able to prove their completed jobs and credential
   attestations even if our search API is down.**

The mistake would be reading "must be provable" as "must be onchain" and putting
the profile, the feedback, and the score into contract storage. Then every
formula tweak is a contract migration, and private client feedback becomes
public forever.

The resolution: **onchain holds the facts that settlement already needs to
produce; offchain holds everything derived from them.** A translator's proof is
the escrow's own payment history plus their credential attestations — records
the contract must write anyway to move money correctly. The score is never
written anywhere onchain.

---

## Onchain/offchain boundary

| Data | Where | Why |
| --- | --- | --- |
| USDC escrow balance per job, client, translator, state | **Onchain** | Value transfer; the entire point of trustless funding. |
| Job brief / source document | **Offchain** (S3 + `keccak256` hash onchain) | Often confidential client material. Hash gives integrity without publication. |
| Delivered translation | **Offchain** (hash onchain at delivery) | Same. The hash is what "accepted" refers to. |
| `JobCompleted` / `JobDisputed` event per job | **Onchain** | This *is* the completed-job proof. Free byproduct of settlement. |
| Language credential attestations | **Onchain via EAS** | Third-party issuer claims that must outlive us and be portable. |
| Biography, work samples, profile photo, languages offered, rates | **Offchain DB** | Edited constantly, needs full-text search, no trust benefit onchain. |
| Private client feedback (text + stars) | **Offchain DB, never onchain** | Contractually private. Onchain is public and permanent — writing it there would be a privacy incident, not a feature. |
| Response-time metrics | **Offchain** | Derived from our messaging system; no onchain counterpart exists. |
| Ranking score, sort order, leaderboard | **Offchain, recomputed** | Weekly-changing policy. Storing it onchain buys nothing and costs a migration per tweak. |

Rule of thumb applied throughout: onchain if removing it breaks trustless
ownership, value transfer, or a permanent commitment someone else must be able
to check. Otherwise offchain with an optional hash.

---

## Contracts

**One custom contract. One integrated protocol. No factory, no router, no
fee-splitter.**

### 1. `TranslationEscrow` (custom)

A single shared escrow contract holding all jobs — not one contract per job.
A factory would add a deployment per job and a separate trust boundary we don't
need, since jobs never hold each other's funds in a way mapping keys can't
already separate.

```solidity
enum State { Funded, Delivered, Accepted, Disputed, Refunded }

struct Job {
    address client;
    address translator;
    uint128 amount;        // USDC, 6 decimals
    uint64  deliveredAt;
    State   state;
    bytes32 briefHash;
    bytes32 deliveryHash;
}

mapping(bytes32 jobId => Job) public jobs;

// Counters settlement already needs; cheap and non-derived.
mapping(address translator => uint32) public completedJobs;
mapping(address translator => uint32) public disputedJobs;
```

Storage is deliberately: **money, parties, state machine, two content hashes,
two counters.** No bio, no rating, no score, no tags, no arrays to paginate.

Events — these are the durable public record:

```solidity
event JobFunded   (bytes32 indexed jobId, address indexed client,
                   address indexed translator, uint128 amount, bytes32 briefHash);
event JobDelivered(bytes32 indexed jobId, bytes32 deliveryHash);
event JobCompleted(bytes32 indexed jobId, address indexed translator,
                   uint128 amount, uint64 completedAt);
event JobDisputed (bytes32 indexed jobId, address indexed raisedBy);
event JobResolved (bytes32 indexed jobId, uint128 toTranslator, uint128 toClient);
```

`JobCompleted` indexed by translator is the "prove my completed jobs without
your API" primitive. Anyone with an RPC endpoint can filter it.

`completedJobs` / `disputedJobs` are stored — not because ranking needs them,
but because dispute-window logic and the client-facing UI read them in one call.
That's a counter settlement wants anyway, which is the line between acceptable
and "maintaining a leaderboard in storage."

### 2. Credentials — **EAS (Ethereum Attestation Service)**, not a custom contract

Language credentials are third-party claims (ATA certification, a university
degree, a notary accreditation). That is exactly what EAS exists for, and it is
already deployed and audited. Writing our own `CredentialRegistry` would be a
strictly worse EAS with no ecosystem.

One schema, registered once:

```
bytes32 credentialType, string languagePair, uint64 issuedAt,
uint64 expiresAt, bytes32 evidenceHash
```

- Attester: the issuing body (or our verification desk, acting as a named
  attester with a public key — honest about what it means).
- Recipient: the translator's address.
- Revocable: yes. Certifications lapse.
- `evidenceHash` points at the scanned document held offchain; the attestation
  is the claim, not the PDF.

A translator proves credentials by handing over their address. Anyone queries
EAS directly. If our company disappears, the attestations remain, readable, with
the issuer's signature intact.

### Explicitly not built

- No reputation contract, no score storage, no onchain sorting.
- No feedback contract — private feedback stays private.
- No token, no staking, no governance.
- No per-job factory.

---

## State transitions

Every fund-moving path has a caller who benefits, and a safe outcome if nobody
calls.

| Transition | Caller | Why they pay gas | If nobody calls |
| --- | --- | --- | --- |
| `fundJob(jobId, translator, amount, briefHash)` | Client | Work doesn't start until funded; this is the client's own purchase. | No job exists. No funds at risk. |
| `submitDelivery(jobId, deliveryHash)` | Translator | Starts the acceptance clock; required to ever get paid. | Job stays `Funded`; client can `cancelUnstarted` after the deadline and recover 100%. |
| `acceptAndRelease(jobId)` | Client | Releases the translation for use; the normal happy path. | Covered by `claimAfterTimeout` — the client cannot strand funds by going silent. |
| `claimAfterTimeout(jobId)` | Translator | **Receives the payment.** Callable once `deliveredAt + 7 days` passes with no acceptance or dispute. | Funds stay claimable forever. No expiry, no sweep. |
| `raiseDispute(jobId)` | Client **or** translator, within the 7-day window | Freezes the timeout claim and escalates instead of losing the argument by default. | Timeout path proceeds and the translator is paid. |
| `resolveDispute(jobId, toTranslator, toClient)` | Arbiter role (multisig at launch) | Contractual duty; funded from the platform fee. | **This is the weak spot.** Mitigated by `disputeDeadline`: if the arbiter does not rule within 21 days, `splitStale(jobId)` becomes permissionless and pays a 50/50 split. Either party calls it because either gets half instead of zero. |
| `cancelUnstarted(jobId)` | Client, after delivery deadline with no submission | **Recovers their own USDC.** | Funds stay recoverable indefinitely. |

Notes:

- No function requires a cron job or an owner-only keeper. Every path is
  reachable by a party with skin in the game.
- Arbitration is the one trusted role, scoped to *disputed jobs only* — it
  cannot touch a funded or accepted job. We choose a human arbiter over onchain
  arbitration because judging translation quality is irreducibly subjective, and
  say so plainly in the UI.
- `splitStale` exists so the arbiter's silence is never a permanent freeze.
- This table goes in the README verbatim.

---

## What the search screen reads

**The search screen makes zero RPC calls.** It hits one endpoint:

```
GET /api/translators?lang=ja-en&specialty=legal&page=1
```

Served entirely from Postgres. Response per translator: name, bio excerpt,
languages, sample snippet, rate, credential badges, completed-job count, score
rank position. Sub-100ms, paginated, full-text searchable, faceted — all the
things contract storage is bad at.

### How the offchain store stays true

An **indexer** (Ponder, or a small viem-based worker) subscribes to
`TranslationEscrow` events and EAS attestation events for our schema, and writes
into Postgres:

```
jobs_completed(translator, job_id, amount, completed_at, tx_hash, block)
disputes(translator, job_id, raised_by, resolution, block)
credentials(translator, uid, type, language_pair, issuer, expires_at, revoked)
```

Every row carries `tx_hash` and `block_number`. That matters for verification
(below). The indexer is a cache of a public log, so if it's wiped we replay from
the deployment block and get the identical table back. No migration, no backup
restore, no coordination.

Alongside it, tables the chain knows nothing about:

```
profiles(translator, bio, samples, languages, rate)     -- edited by translator
feedback(job_id, client, stars, text, private=true)      -- never leaves our DB
response_times(translator, p50_minutes, sample_size)     -- from messaging
```

---

## How the ranking is produced

A scheduled job (hourly) computes, for each translator:

```
score = w1 * log1p(completed_jobs_90d)
      + w2 * credential_weight(active_attestations)
      + w3 * feedback_mean_bayesian(stars, prior)
      + w4 * response_time_decay(p50_minutes)
      - w5 * dispute_rate(disputes / completed)
```

Weights and the functional form live in **`ranking/weights.v14.yaml`**, a
versioned config file. Retuning is a pull request and a deploy — not a contract
upgrade, not a storage migration, not a governance vote. That is the entire
reason ranking is offchain.

Three properties worth keeping:

- **Versioned and replayable.** Each score row records the weights version that
  produced it, so a translator asking "why did I drop" gets a real answer and we
  can A/B two formulas on the same inputs.
- **Inputs are auditable even though the formula is ours.** The completed-job
  and dispute inputs are onchain; credentials are onchain. If we claimed someone
  had 40 completed jobs and the log shows 3, that's checkable by anyone. The
  weights are a product decision; the facts they consume are not ours to invent.
- **Feedback stays aggregate-only in public.** The private text never appears in
  a response body, only its contribution to the number.

If our search API is offline, ranking is unavailable — and that's correct.
Ranking is a product opinion, not a fact about the world. What survives the
outage is the layer below it.

---

## Verification without migrations

This is the requirement that decides the whole design, so stating exactly what
holds:

**What a translator can prove with no cooperation from us:**

| Claim | How they prove it |
| --- | --- |
| "I completed these 47 jobs, for this much, on these dates" | `eth_getLogs` for `JobCompleted` with `translator` = their address, from the deployment block. Any public Base RPC, any block explorer, Dune, a 20-line script. |
| "These clients funded and accepted those jobs" | `JobFunded` / `JobCompleted` share a `jobId`; the client address is indexed. |
| "I hold an ATA ja→en certification issued 2024-03" | EAS attestation on their address, signed by the issuer, queryable at the EAS explorer. |
| "I delivered *this exact file*" | `deliveryHash` in the `JobDelivered` event matches `keccak256` of the file they hold. |
| "My dispute count is 1, not 6" | `JobDisputed` logs are complete and public; absence is as provable as presence. |

None of this needs our servers, our DB, our domain name, or our continued
existence. A translator who leaves for a competitor carries a portable,
counterparty-signed work history.

**What they cannot prove, honestly stated:** their score, their rank, their
private feedback, and their response times. Those are our measurements, our
formula, our messaging system. We don't pretend otherwise by hashing a score
onchain — an onchain hash of a number we computed proves only that we computed
it, which is worth approximately nothing.

**Why iteration is free.** Draw the line down the middle of the system:

```
  Facts (onchain, permanent, cheap to emit)
  ├─ job funded / delivered / completed / disputed  → TranslationEscrow events
  └─ credential attested / revoked                  → EAS
                    │
                    ▼  indexer, replayable from block 0
  Interpretation (offchain, versioned, disposable)
  ├─ weights.yaml        → change weekly
  ├─ score table         → recompute hourly
  ├─ search index        → reshape freely
  └─ profiles, feedback  → edit anytime
```

Everything above the line is append-only and never needs to change, because it
encodes only what happened. Everything below is expected to change and costs a
deploy. A ranking change touches one YAML file. Adding a new signal — say,
glossary adherence — adds a column to Postgres and a term to the formula; the
contract never learns the word "glossary."

The contract surface stays small precisely so it can stay still.

---

## Chain: Base

One target chain for the first release.

**Why Base specifically, beyond cost:**

- **Native, fully-backed USDC issued by Circle**, plus Circle's CCTP for
  cross-chain funding. Our unit of account *is* USDC — launching where it's
  canonical rather than bridged removes a class of liquidity and trust problems
  from day one.
- **Coinbase onramp integration.** Clients are translation buyers, not crypto
  users. They need to go from a credit card to funded escrow without learning
  what a bridge is. This is the single strongest product argument.
- **EAS is a Base predeploy** — the credential layer is already live and used by
  Coinbase's own verifications, meaning a translator may already hold
  attestations we can read.
- **Account abstraction / smart wallet support** lets us sponsor gas for the
  first job so a client's first action isn't buying ETH.
- **Fees**: escrow operations are simple storage writes; at Base's current base
  fee a full fund→deliver→accept cycle is cents. *Measure this with
  `cast gas-price` / `cast estimate` against Base mainnet before finalizing the
  fee model — do not ship a number quoted from memory.*

Testnet: **Base Sepolia**, same addresses for EAS predeploys.

### Addresses to confirm before deploy

Verify each against the chain's official documentation — do not copy from
memory, including from this document.

| Contract | Base mainnet | Source to confirm against |
| --- | --- | --- |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | Circle's official developer docs |
| EAS | `0x4200000000000000000000000000000000000021` | docs.base.org predeploys / EAS docs |
| EAS SchemaRegistry | `0x4200000000000000000000000000000000000020` | same |

A wrong token address here sends client approvals to an attacker. Treat the
verification step as blocking, not clerical.

---

## Deployment runbook

To be placed in `README.md` before the MVP is called shippable.

**Environment:**

```
BASE_RPC_URL=
BASESCAN_API_KEY=
DEPLOYER_PRIVATE_KEY=        # hot key, deploy only, never owner
USDC_ADDRESS=0x...           # confirmed against Circle docs
ARBITER_MULTISIG=0x...       # Safe, 3-of-5
```

**Deploy and verify:**

```bash
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $BASE_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast --verify \
  --etherscan-api-key $BASESCAN_API_KEY

# Register the credential schema once:
cast send $EAS_SCHEMA_REGISTRY \
  "register(string,address,bool)" \
  "bytes32 credentialType,string languagePair,uint64 issuedAt,uint64 expiresAt,bytes32 evidenceHash" \
  0x0000000000000000000000000000000000000000 true \
  --rpc-url $BASE_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY
```

**Ownership:** the deploy script's final action transfers the arbiter role and
admin to `ARBITER_MULTISIG`. The deployer key retains nothing. Assert this in
the script, don't leave it to a follow-up transaction someone forgets.

**Post-deploy smoke test** — one real job, end to end, on mainnet with $1:

```bash
cast send $USDC "approve(address,uint256)" $ESCROW 1000000 ...
cast send $ESCROW "fundJob(bytes32,address,uint128,bytes32)" $JOB_ID $TRANSLATOR 1000000 $BRIEF_HASH ...
cast send $ESCROW "submitDelivery(bytes32,bytes32)" $JOB_ID $DELIVERY_HASH ...   # from translator key
cast send $ESCROW "acceptAndRelease(bytes32)" $JOB_ID ...                        # from client key
# Confirm the indexer picked it up and the profile shows 1 completed job:
cast logs --from-block latest-20 --address $ESCROW "JobCompleted(bytes32,address,uint128,uint64)"
```

If that log appears and the search row updates, the whole vertical slice —
escrow, events, indexer, search — is proven in production.

---

## MVP checklist

- [x] Onchain/offchain boundary explicit; ranking computed offchain from indexed events.
- [x] One custom contract (`TranslationEscrow`) + EAS. Under the three-contract ceiling.
- [x] Every state transition has a caller, an incentive, and a safe no-caller outcome, including a permissionless `splitStale` escape from arbiter silence.
- [x] Base selected for native USDC, fiat onramp, EAS predeploy, and AA — not just fees.
- [ ] Tests: full state-machine coverage; **fork tests against Base mainnet USDC and EAS**, not mocks.
- [ ] README carries the transition table and this runbook.
- [ ] Contracts verified on Basescan; ownership at the Safe.
- [ ] Indexer replay-from-genesis tested by wiping Postgres and rebuilding.
- [ ] Independent reviewer walks the finished slice before launch.

## Build order

1. `TranslationEscrow` + tests (fork USDC). The state machine is the product.
2. Indexer → Postgres, with replay verified from an empty DB.
3. Search API and screen over Postgres. Ranking hardcoded to `completed_jobs` at
   first — the formula is the *last* thing to tune, not the first.
4. EAS schema + credential badges.
5. Feedback capture (private), then response times, then the real weights file.

Steps 3–5 never touch the contract. That's the design working.
