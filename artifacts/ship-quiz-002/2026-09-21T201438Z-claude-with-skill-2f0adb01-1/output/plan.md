# Translator Marketplace — Architecture Plan

## 1. The one decision that shapes everything

The product has two kinds of data, and they have opposite requirements:

| | Needs to be | Examples |
|---|---|---|
| **Facts** | Permanent, portable, provable without us | "Job #812 was funded with 450 USDC and released to 0xAB… on 2026-03-04", "Issuer X attested this translator holds ATA certification" |
| **Judgments** | Cheap to change, private, tunable weekly | Ranking weights, response-time stats, private client feedback, bios, samples, search relevance |

Facts go in contracts. Judgments stay offchain. The ranking formula is a judgment *computed over* facts — so it lives offchain and reads onchain history as one of its inputs.

This split is the whole answer to "useful verification without contract migrations": the contracts never learn what a "score" is, so changing the score never touches them.

---

## 2. Chain

**Base.**

- The app is consumer-facing with non-crypto users on both sides. Base's smart-wallet / account-abstraction support lets clients fund a job with a passkey wallet and no seed phrase.
- Native USDC is on Base (Circle-issued, not bridged), so escrow holds the real thing.
- Job lifecycle is chatty (fund → deliver → accept/dispute → release) and per-job fees need to be negligible relative to a $50–500 job. Mainnet would work for the money but the per-job tx count makes L2 the better fit.
- EAS (Ethereum Attestation Service) is a predeploy on Base, which gives us credential attestations with zero contracts of our own.

Single chain at launch. No multi-chain until PMF.

**Addresses to verify at deploy time** (do not hardcode from memory — confirm against Circle's and EAS's official docs before the deploy script ships):
- USDC (Base): `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- EAS (Base predeploy): `0x4200000000000000000000000000000000000021`
- EAS SchemaRegistry (Base predeploy): `0x4200000000000000000000000000000000000020`

---

## 3. Contracts: one of ours, one we borrow

### `TranslationEscrow.sol` — the only contract we write

Holds USDC, moves it on a defined set of transitions, and emits an event for every transition. That is its entire job.

**Storage per job** (deliberately tiny):

```solidity
struct Job {
    address client;
    address translator;
    uint96  amount;        // USDC, 6 decimals
    uint40  fundedAt;
    uint40  deadline;
    Status  status;        // Funded, Delivered, Released, Refunded, Disputed, Resolved
    bytes32 specHash;      // keccak256 of the offchain job spec JSON
    bytes32 deliveryHash;  // keccak256 / IPFS CID digest of the delivered translation
}
mapping(uint256 => Job) public jobs;
```

**What is NOT in this struct, and why:**

- **No language pair, no category, no skill taxonomy.** Those are product vocabulary that changes monthly. They live in the offchain job spec; the contract commits to `specHash` so the spec can be proven un-tampered without the contract ever parsing it. Adding "legal Japanese→Portuguese with notarization" later is a JSON change, not a migration.
- **No rating, no score, no weights.** See §5.
- **No bios, samples, or profile data.** Not value transfer, not a commitment anyone needs to verify trustlessly.
- **No private client feedback — not even a hash.** A hash of a 1–5 star rating has ~2 bits of entropy and is trivially brute-forced; committing it onchain would leak the "private" feedback we promised the client. Feedback stays in Postgres with row-level access control. (If we ever *do* want verifiable feedback, the right move is a salted commitment revealed only in dispute — but that is a later feature, not MVP.)

**Functions and the state-transition audit:**

| Function | Who calls | Why they would | If nobody calls |
|---|---|---|---|
| `fundJob(translator, amount, deadline, specHash)` | Client | It is how work starts; translator won't begin unescrowed | No job exists. Fine. |
| `submitDelivery(jobId, deliveryHash)` | Translator | Starts the acceptance clock; required to get paid | Job sits until deadline, then `refundExpired` returns client funds. Safe. |
| `acceptAndRelease(jobId)` | Client | They wanted the translation; reputation pressure + it is the only way to close cleanly | **This is the dangerous one** — an absent or lazy client would strand the translator's money. Mitigated by `claimAfterReviewWindow`. |
| `claimAfterReviewWindow(jobId)` | Translator | Gets paid without client action | Nothing — translator is the incentivized caller and will always call it. |
| `openDispute(jobId)` | Client or translator | Blocks auto-release / contests a refusal | No dispute; auto-release runs. |
| `resolveDispute(jobId, clientBps)` | Arbiter role | Paid/obligated role | Funds locked. Needs an SLA + a fallback timeout that splits 50/50 if the arbiter goes dark. |
| `refundExpired(jobId)` | Client | Recovers funds on undelivered work | Client's own money sits idle; they are the incentivized caller. |

`claimAfterReviewWindow` is the piece that makes the system not depend on client goodwill: after delivery + N days with no acceptance and no dispute, the translator pulls the funds themselves. Without it the contract has an "admin crutch" shape where support staff manually release payments.

**Arbiter, honestly stated:** for MVP the arbiter is a platform-controlled multisig. That is a trust assumption and we should say so in the UI — escrow is trustless against *counterparty* default, not against *us*, until disputes move to a neutral arbitration service. The contract stores the arbiter behind an `AccessControl` role so swapping in Kleros or a panel later is a role grant, not a redeploy.

Standard hygiene: OpenZeppelin `AccessControl` + `ReentrancyGuard`, `SafeERC20` for every USDC move, checks-effects-interactions, USDC's 6 decimals respected everywhere, pull-payment on release.

### Credentials: EAS, no contract of ours

Language credentials are attestations — "issuer I asserts claim C about subject S" — which is exactly EAS's shape. Writing our own `CredentialRegistry` would be reinventing an audited primitive.

Two schemas registered once:

1. **Credential** — `(bytes32 credentialType, string issuerName, uint64 issuedAt, uint64 expiresAt, bytes32 evidenceHash)`, attested by the issuing body (or by us as a "platform-verified" attester when the issuer isn't onchain), subject = translator's address, revocable.
2. **Job completion receipt** (optional, additive) — a light attestation mirroring a released job, useful for translators who want a single portable credential blob.

`credentialType` is a `bytes32` tag, not an enum. New credential types are new tag values; new *shapes* are a new schema registration. Neither is a migration.

**Contract count: 1 written, 0 forked, 1 borrowed.** Within the MVP budget.

---

## 4. What the search screen actually reads

The search screen reads **our API, backed by Postgres + a search index. It makes zero RPC calls.**

Ranked search over five signals with weekly-changing weights is a database query. Trying to serve it from chain state would mean either onchain sorting (absurd gas) or a client-side scan of all translators (unusable latency). Search is the canonical "offchain" item on the litmus test.

Pipeline:

```
Base (escrow events + EAS attestations)
        │
        ▼
  Indexer (Ponder or a Graph subgraph)
        │  writes normalized rows: jobs, releases, disputes, attestations
        ▼
  Postgres ──┬── app-owned tables: bios, samples, private feedback,
             │   response-time telemetry from our messaging system
             ▼
  Ranking job (cron, hourly) ── reads weights.json ──► scores table
             │
             ▼
  Search index (Postgres FTS at first; Typesense/Elastic when it hurts)
             │
             ▼
  /api/search ──► search screen
```

A profile row the search screen renders contains: display name, bio, sample excerpts, language pairs, credential badges, `completedJobs`, `disputeRate`, `medianResponseHours`, `score`, and — importantly — a **`verify` link** carrying the translator's address and the job IDs / attestation UIDs backing those numbers.

So the search screen reads offchain data, but every *claim* it displays points at an onchain receipt.

---

## 5. How the ranking is produced

Entirely offchain, in a scheduled job, from a config file:

```jsonc
// ranking/weights.v14.json
{
  "version": 14,
  "effectiveFrom": "2026-09-21T00:00:00Z",
  "weights": {
    "completedJobsLog":    0.30,   // log1p(completed), onchain-derived
    "disputeRatePenalty": -0.25,   // disputes/completed, onchain-derived
    "responseTime":        0.15,   // offchain telemetry
    "credentials":         0.20,   // EAS attestations, unexpired, by type tier
    "privateFeedback":     0.10    // offchain, Bayesian-shrunk mean
  },
  "recencyHalfLifeDays": 180,
  "minJobsForFullWeight": 5
}
```

Tuning weekly = edit the JSON, bump `version`, merge, cron recomputes. No transaction, no redeploy, no migration. We keep every version in git and stamp each `scores` row with the `version` that produced it, so ranking changes are auditable and reversible — and we can A/B two versions by writing both score columns.

Signal provenance, stated plainly because it affects what we can promise users:

| Signal | Source | Independently verifiable? |
|---|---|---|
| Completed jobs | `PaymentReleased` events | **Yes** — anyone with an RPC |
| Disputes / outcomes | `DisputeOpened` / `DisputeResolved` events | **Yes** |
| Credentials | EAS attestations | **Yes** — including revocation and expiry |
| Response time | Our messaging system | **No.** Platform-attested only. |
| Private feedback | Our database | **No**, and intentionally so — it is private. |

We should not pretend otherwise in the UI. "Verified onchain" belongs on the first three badges and nowhere else. Claiming verifiability we don't have is worse than having less of it.

---

## 6. The verification story: what a translator can prove without us

The requirement is that a translator can prove their completed jobs and credentials **even if our search API is down**. This works because the proof path never touches our infrastructure.

**Identity.** The translator's wallet address is their portable identity. Ownership is proven by signing a challenge (SIWE / EIP-4361) — no registry lookup, nothing of ours in the loop.

**Completed jobs.** Every release emits:

```solidity
event PaymentReleased(
    uint256 indexed jobId,
    address indexed client,
    address indexed translator,
    uint256 amount,
    bytes32 specHash,
    bytes32 deliveryHash
);
```

`translator` is indexed, so a third party queries any Base RPC or block explorer by topic and gets the complete, unforgeable list of that address's paid jobs. Our servers are irrelevant to this query. `jobs(jobId)` is a public getter confirming final state, so the proof survives even log-pruning RPCs. `specHash` and `deliveryHash` let the translator additionally prove *what* the job was and *what they delivered*, by producing the original files — the chain holds the commitment, the translator holds the content.

**Credentials.** EAS attestations are queryable by recipient through EAS's own contract, subgraph, and public explorer. A revoked or expired credential is visibly revoked or expired to anyone. We are not the attester of record for issuer-signed credentials, so our disappearance doesn't invalidate them.

**Portability artifact.** We ship a "Export my proof pack" button producing a signed JSON: address, job IDs, tx hashes, block numbers, attestation UIDs, spec/delivery hashes, plus a short verification script. A competing marketplace — or a client doing diligence — can validate the whole thing against a public RPC. This is a feature, not a leak: portable reputation is why a translator picks a crypto-rails marketplace over the incumbents.

**What is explicitly NOT provable, by design:** the rank number itself, the private feedback, and response times. Ranking is our editorial product; it is not a fact about the translator, and dressing it up as onchain truth would freeze it exactly where we need it fluid.

---

## 7. Why product iteration never hits a contract migration

Every category of change we expect to make weekly lands offchain:

| Change | Where it lands |
|---|---|
| Retune ranking weights | `weights.json`, one commit |
| Add a ranking signal | Indexer + scores table |
| Add a language pair / job category | Job spec JSON, committed via `specHash` |
| Redesign profiles, add samples | App DB + frontend |
| Change dispute *policy* (windows shown in UI, evidence rules) | Offchain, until it changes fund movement |
| New credential type | New `bytes32` tag on the existing EAS schema |
| New credential *shape* | New EAS schema registration |

Changes that genuinely require a contract change are the ones that *should* be rare and deliberate: altering how money moves, altering the review-window length (make it a settable parameter behind the admin role, with bounds), or adding a new fund-movement path like milestone payments. That is the correct set of things to slow down for.

Escape hatch: `TranslationEscrow` is **not upgradeable**. A proxy on a contract holding user funds adds a rug vector for a benefit we've just designed away. Instead, deploy `V2` when fund-movement semantics must change, route new jobs to it, and let open V1 jobs settle naturally. The indexer reads both addresses, so translator history is continuous across versions — history lives in events, and events don't care which contract emitted them as long as we index both.

---

## 8. Build order

1. `TranslationEscrow.sol` on OpenZeppelin base contracts; Foundry unit + fuzz tests (amount edge cases, double-release, dispute-after-release, USDC 6-decimal rounding); fork test against real Base USDC.
2. Register EAS schemas on Base Sepolia, then Base.
3. Indexer (Ponder) → Postgres; backfill from deploy block.
4. Ranking cron + `weights.v1.json`.
5. Search API + search screen reading only Postgres.
6. Proof-pack export + public verify page (which itself uses only a public RPC, so it works when our API doesn't).
7. Security audit in a fresh context before mainnet; ownership and arbiter role to a Gnosis Safe.

## 9. Open questions to settle before coding

- Review-window length, and the arbiter-timeout fallback split. These are contract constants (or bounded admin params) — decide now, not after deploy.
- Platform fee: taken onchain at release, or offchain at invoicing? Onchain is cleaner and auditable; it makes the fee rate a bounded admin param.
- Does the client's counterparty risk justify requiring an onchain identity for clients too, or do we sponsor gas and use smart wallets so they never see the chain? (Recommend the latter.)
