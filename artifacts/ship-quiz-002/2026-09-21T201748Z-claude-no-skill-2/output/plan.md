# Translator Marketplace — Architecture

## 1. The organizing principle

The system has two kinds of data, and they have opposite change rates and
opposite trust requirements:

- **Settled facts.** Money moved. A job was accepted. A dispute resolved in
  someone's favor. An issuer attested to a credential. These are adjudicated,
  they must survive us, and a translator must be able to prove them without
  our cooperation. They change only when a real-world event happens.
- **Opinions and presentation.** Ranking weights, bios, work samples, search
  facets, private client feedback, response-time stats. These change weekly (or
  hourly), they are ours to tune, and nobody outside needs to verify them
  byte-for-byte.

**Settled facts go on chain. Opinions stay off chain.** Every migration-forcing
mistake in this product category comes from putting an opinion in a contract —
most commonly, a `reputationScore` field or a weight table. Once a score is a
storage slot, changing the formula is a contract upgrade plus a backfill, and
you cannot ship on Tuesday.

The rest of this document is that principle applied.

## 2. What lives in contracts

Three contracts. They are deliberately boring and we expect not to touch them
for a year or more.

### 2.1 `JobEscrow`

Holds USDC and records job lifecycle. Per job it stores only what is needed to
adjudicate custody of the funds:

```solidity
struct Job {
    address client;
    address translator;
    uint128 amount;          // USDC, 6dp
    uint64  fundedAt;
    uint64  deadline;
    bytes32 briefHash;       // keccak of the off-chain job brief + terms
    Status  status;          // Funded | Delivered | Accepted | Disputed | Resolved | Refunded
}
```

Functions: `fund`, `markDelivered`, `accept`, `openDispute`, `resolveDispute`,
`refundAfterTimeout`. Events mirror each transition and carry the full tuple
needed to reconstruct it:

```solidity
event JobFunded(uint256 indexed jobId, address indexed client, address indexed translator, uint128 amount, bytes32 briefHash);
event JobAccepted(uint256 indexed jobId, address indexed translator, uint128 amount, uint64 acceptedAt);
event DisputeOpened(uint256 indexed jobId, address indexed openedBy, uint64 openedAt);
event DisputeResolved(uint256 indexed jobId, Outcome outcome, uint128 toTranslator, uint128 toClient);
```

`briefHash` is the only link to off-chain content: the language pair, word
count, subject matter, and terms live in a JSON document we store and serve;
the hash commits to it so a translator can prove *what* the job was, not just
that a job existed. The document itself is not on chain — it is client
material and sometimes confidential.

What is **not** in `JobEscrow`: any rating, score, star count, completion
percentage, or aggregate counter beyond what the escrow logic itself needs.
`completedJobs` is not a storage variable; it is `count(JobAccepted where
translator = X)`, derivable by anyone from logs.

### 2.2 `CredentialRegistry`

An attestation registry, not a credential store. An issuer (a translators'
association, a certifying body, a university, or in the bootstrap phase our own
issuer key) signs a statement about a subject:

```solidity
event CredentialAttested(
    bytes32 indexed uid,
    address indexed issuer,
    address indexed subject,
    bytes32 schemaId,      // e.g. "ATA certification", "CEFR C2 DE>EN"
    bytes32 dataHash,      // keccak of the off-chain credential document
    uint64  issuedAt,
    uint64  expiresAt
);
event CredentialRevoked(bytes32 indexed uid, address indexed issuer, uint64 revokedAt);
```

Storage keeps only `uid -> (issuer, subject, revokedAt, expiresAt)` so
revocation and expiry are checkable on chain. The credential document (scan,
certificate number, issuing body metadata) lives off chain, hashed into
`dataHash`.

We can run this ourselves or deploy on top of EAS (Ethereum Attestation
Service), which gives us the same shape plus an existing ecosystem of
verifiers. Either way the important property is that **the issuer's signature
is the trust anchor, and we are not it.** If our company disappears, an ATA
attestation is still an ATA attestation.

New credential types are new `schemaId` values plus an off-chain schema
descriptor. Adding "Sworn translator, Spain" next month is a database row, not
a deployment.

### 2.3 `TranslatorIdentity`

The thinnest of the three. Binds an address to a profile pointer and lets the
translator rotate an operational key without losing history:

```solidity
event ProfilePublished(address indexed translator, bytes32 profileHash, string uri);
event DelegateSet(address indexed translator, address indexed delegate, bool enabled);
```

`uri` points at a profile document (bio, work samples, language pairs, rates)
that the translator can host anywhere — our CDN by default, IPFS or their own
domain if they prefer. We store the hash so the translator can prove "this is
the bio I published on this date," which matters in a dispute about
misrepresentation. We do not store bio text on chain; it is long, it changes
often, and it is the translator's to move.

### 2.4 What is deliberately excluded

| Data | Why it stays off chain |
| --- | --- |
| Private client feedback | It is private. Also, hashing it does not help: a 1–5 rating plus a known job id is trivially brute-forced from a commitment, so an on-chain "commitment" would leak it while looking responsible. |
| Response time | Derived from our messaging system. Unverifiable on chain anyway, and a metric we will redefine (business hours? first substantive reply?) repeatedly. |
| Ranking weights / scores | The entire point. See §4. |
| Bios, samples, tags, categories | Long, mutable, presentational. |
| Aggregate counters | Derivable from events; storing them costs gas and creates a second source of truth that can drift. |

## 3. What the search screen reads

The search screen reads **only our API**. It never talks to an RPC node, and
it never waits on one. A search results page is a latency-sensitive,
faceted, paginated, typo-tolerant query over hundreds of fields — that is a
search engine's job.

```
Chain ──(logs)──> Indexer ──> Postgres (facts) ──> Feature store ──> Ranking ──> OpenSearch
Off-chain sources ────────────┘                                                      │
  (messaging, feedback, KYC, profile CMS)                                            │
                                                                            Search API ──> UI
```

**Indexer.** Subscribes to the three contracts, follows finalized blocks,
handles reorgs by keying every row on `(blockNumber, logIndex)` and deleting
above a rollback point. It writes normalized rows: `jobs`, `job_events`,
`credentials`, `credential_revocations`, `profiles`. It performs no
interpretation — a `JobAccepted` log becomes a `jobs` row with
`status='accepted'`, nothing more. This is the component that must be exactly
right; everything downstream can be rebuilt by replaying it.

**Feature store.** A nightly-plus-incremental job computes the inputs the
ranking formula wants, each as a named, versioned feature:
`completed_jobs_90d`, `completed_volume_usdc`, `dispute_rate`,
`disputes_lost_180d`, `median_first_response_minutes`,
`active_credential_count`, `credential_issuer_tier`,
`feedback_mean_bayesian`, `repeat_client_rate`. Features are stored raw
(counts, minutes, dollars) — never pre-weighted. Adding a feature is a new
column and a backfill query.

**Search documents.** One document per translator: profile fields for matching
and faceting (language pairs, specialisms, rates, availability), the feature
values for filtering and scoring, and a denormalized list of credential
`uid`s and recent job ids so the profile page can render without a second
round trip. Documents are rewritten on indexer change, on profile edit, and on
each feature recompute.

**Search screen render.** A query hits the Search API, which does retrieval +
filtering in OpenSearch, applies the ranking formula (§4), and returns a page.
Each result card shows the translator's name, language pairs, a
"127 completed jobs · 0 disputes" line, and credential badges. Crucially, each
badge and each count carries a link to the **verification view** (§5) — the UI
is honest that these numbers came from our index, and offers the receipt.

Public-facing aggregates (completed jobs, dispute count, credential badges) are
chain-derived and shown as such. Private feedback never appears in the UI as a
number a client can see for another client's translator; it only moves ranking.

## 4. How ranking is produced

Ranking is a **configuration artifact, not code and not a contract**.

```yaml
# ranking/weights/2026-09-21.yaml
version: 2026-09-21.1
retrieval:
  must: [language_pair, availability]
scoring:
  - feature: completed_jobs_90d       transform: log1p      weight: 0.30
  - feature: dispute_rate             transform: linear     weight: -0.45
  - feature: median_first_response_minutes
                                      transform: inverse_capped(240)
                                                            weight: 0.15
  - feature: active_credential_count  transform: sqrt       weight: 0.20
  - feature: feedback_mean_bayesian   transform: linear     weight: 0.25
    prior: {mean: 4.2, strength: 8}
  - feature: repeat_client_rate       transform: linear     weight: 0.10
tie_break: [completed_volume_usdc, random_seeded_daily]
```

The ranking service loads this file, computes
`score = Σ wᵢ · transformᵢ(featureᵢ)` over the retrieved candidate set, and
sorts. Shipping a new formula is: open a PR against the YAML, run it through
the offline evaluation harness (held-out click and hire data, plus a
distributional check for large rank swings), merge, and let the config roll
out. **Zero contract interaction. Zero migration. Roughly ten minutes.**

Supporting pieces that make weekly tuning safe:

- **Versioned and logged.** Every search response records the weights version
  and the per-feature contributions for the returned set. When a translator
  asks "why did I drop," we can answer precisely, and when a formula change
  tanks conversion we know which one.
- **A/B by config.** Two weight files, a bucketing key on the client. No code
  path difference.
- **Replayable.** Because features are stored raw and weights are a file,
  yesterday's ranking is reproducible exactly. This matters for appeals.
- **Anti-gaming, also off chain.** Wash-trading detection (client and
  translator funded from the same source, unusually fast accepts, circular
  payment graphs) runs as a feature-store job that produces a
  `suspicion_score` damping feature. Putting this logic on chain would both
  publish the detection rules and freeze them.
- **Feedback is private and stays private.** It enters ranking as a Bayesian
  smoothed mean with a minimum-response threshold, so an individual client's
  rating is never inferable from a rank change.

## 5. Verification without migrations

The requirement is that a translator can prove *which completed jobs and
credential attestations are theirs* even if our search API is down. Note
what it does **not** require: proving their rank, their score, or their
feedback average. Those are our opinions; there is nothing to prove.

**The claim we make verifiable:** "Address `0xT` was the translator on jobs
`#412, #418, …`, each accepted and paid in USDC; and holds unrevoked,
unexpired credentials `uid₁, uid₂` issued by `0xISSUER`."

**How it is verified with us entirely offline:**

1. Every fact in that claim is an event log or a storage read on a public
   contract. `eth_getLogs` filtered by `JobAccepted(translator = 0xT)` yields
   the job list. `CredentialRegistry.isValid(uid)` yields credential status.
   Any RPC provider, any block explorer, `cast logs` from a terminal.
2. We ship a small open-source **`verify-translator` CLI and static web page**
   that takes an address and an RPC URL and prints the claim. It has no
   dependency on our infrastructure. A client who wants to check a translator
   they found elsewhere can run it.
3. We publish the ABIs, deployed addresses, and deployment block in the repo
   and on a static page, so the verifier keeps working if we do not.
4. The translator's own **portable profile** (`ProfilePublished.uri` +
   `profileHash`) lets them take their bio and samples elsewhere; the hash on
   chain proves it is the document they published.

**Why this does not constrain product iteration:** the verifiable claim is
made of facts that are already settled by the escrow's own logic. We did not
add a single storage slot for reputation's sake. The contracts do not know the
word "ranking." Consequently:

- Tuning weights weekly: config change. No contract touched.
- Adding a feature (e.g. "on-time delivery rate"): indexer already has the
  timestamps; new feature column, new weight line.
- Adding a credential type: new `schemaId`, an off-chain schema descriptor, a
  badge in the UI.
- Changing how we display or compute dispute rate: off chain, and the
  underlying `DisputeResolved` events are unchanged, so historical
  verification is unaffected.
- Redesigning the search page entirely: no chain involvement whatsoever.

The only changes that require a contract migration are changes to how money is
custodied or how disputes are adjudicated — which is the correct set of things
to make expensive and deliberate.

## 6. Failure behavior

| Failure | Effect |
| --- | --- |
| Search API down | Search unavailable. Verification still works (§5) — this is the scenario the requirement names. Translators can share a verification link; clients can check credentials and job history directly. |
| Indexer lagging | Search shows stale counts. Escrow unaffected — funding, delivery, accept, and dispute all go straight to chain from the client. We surface an "as of block N" timestamp rather than pretending freshness. |
| Chain congestion / RPC outage | Escrow actions queue and retry with bumped fees; the UI shows pending state keyed on tx hash. Search and browse are fully functional off the index. |
| Feature store job fails | Ranking falls back to the last good feature snapshot, with the snapshot age monitored and alerted. |

## 7. Build order

1. `JobEscrow` + USDC integration, with disputes behind a simple multisig
   arbiter to start. Audited before mainnet funds.
2. Indexer + Postgres. Get the reorg handling right here, once.
3. Profile CMS, `TranslatorIdentity`, basic search over profile fields only.
4. `CredentialRegistry`, issuer onboarding, badges.
5. Feature store + the YAML ranking service. Ship with flat weights; start
   collecting the data that makes tuning meaningful.
6. `verify-translator` CLI and static verifier page. Publish addresses + ABIs.
7. Private feedback collection, Bayesian smoothing into ranking.
8. Anti-gaming features once there is enough volume to detect anything.
