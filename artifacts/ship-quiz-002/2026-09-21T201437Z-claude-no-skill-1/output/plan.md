# Architecture — Translator Marketplace

## The one decision that shapes everything

Two requirements pull in opposite directions:

1. **The ranking formula changes weekly.** Whatever computes it must be deployable
   in minutes, A/B-testable, and revertible.
2. **A translator must be able to prove their completed jobs and credentials
   without our API.** Whatever records those facts must outlive our servers.

These are only in conflict if you put them in the same place. So we don't:

- **Contracts hold facts that must survive us and that have money attached** —
  escrow state, job completion, dispute outcomes, credential attestations.
  Append-only, no scores, no weights, no profile content.
- **Our backend holds everything that is product surface** — bios, samples,
  private feedback, response-time stats, the ranking formula, the search index.
  Free to change daily.

The seam between them is a **verifiable receipt**: every claim a translator makes
about their track record resolves to an onchain event or attestation that anyone
can check with a public RPC endpoint and ~40 lines of script. Nothing about the
*ranking* is verifiable, and that is deliberate — a weekly-tuned formula is a
product opinion, not a fact, and putting opinions onchain is how you end up
needing a migration every Tuesday.

---

## 1. What lives in contracts

Three contracts. Small, boring, upgrade-averse.

### 1.1 `JobEscrow`

Holds USDC for a single marketplace; jobs are rows keyed by `jobId`.

Per-job state (the only mutable onchain state we have):

| Field | Type | Why onchain |
| --- | --- | --- |
| `client` | `address` | Who can release / who gets a refund |
| `translator` | `address` | Who gets paid; the identity a proof binds to |
| `token` | `address` | USDC address (parameterized, not hardcoded — chain/bridge churn) |
| `amount` | `uint256` | Custody |
| `state` | `enum {Funded, Delivered, Accepted, Disputed, Resolved, Cancelled}` | Controls fund movement |
| `fundedAt`, `deliveredAt`, `resolvedAt` | `uint64` | Timestamps are free here and make receipts self-dating |
| `termsHash` | `bytes32` | Commitment to the offchain job spec (language pair, wordcount, deadline, rate) |

Functions: `fundJob`, `submitDelivery(bytes32 deliveryHash)`, `accept`,
`raiseDispute`, `resolveDispute(Resolution, uint256 translatorShare)`,
`cancelBeforeDelivery`, `claimAfterTimeout`.

Events (this is the actual product of the contract):

```
JobFunded(jobId, client, translator, token, amount, termsHash)
DeliverySubmitted(jobId, deliveryHash)
JobAccepted(jobId, amountToTranslator, amountFee)
DisputeRaised(jobId, raisedBy)
DisputeResolved(jobId, Resolution, translatorShare)
JobCancelled(jobId, refundTo)
```

Note what is **not** in here: language pair, wordcount, deadline, quality rating,
category, "rush job" flag, client tier. All of that lives in the offchain job
spec that `termsHash` commits to. That is the single most important line in this
document — the day product wants a "certified legal translation" job type or a
milestone-based rate card, it is a JSON schema change, not a contract migration.

Timeouts matter for the "our API is down" requirement. If our backend disappears
mid-job, `claimAfterTimeout` lets a translator collect on an accepted-but-unreleased
job and lets a client recover funds on an undelivered one, with no help from us.
Escrow that depends on a company-run releaser is not escrow.

### 1.2 `AttestationRegistry`

Deliberately schema-agnostic, EAS-shaped. We either use [EAS](https://attest.sh)
directly or ship a ~120-line equivalent; the interface is the same:

```
attest(bytes32 schemaId, address subject, bytes32 dataHash, string uri,
       uint64 expiresAt) -> bytes32 uid
revoke(bytes32 uid, bytes32 reasonHash)
```

Emits `Attested(uid, schemaId, issuer, subject, dataHash, uri, expiresAt)` and
`Revoked(uid, issuer, reasonHash)`.

Used for **language credentials**: a certifying body (ATA, NAATI, a university,
or in the bootstrap phase our own reviewer key) attests that address X holds
credential Y. The credential's actual contents — issuing body, language pair,
level, certificate number, scan URI — live in an offchain JSON document; onchain
we store its hash plus a resolvable URI.

Why this shape:

- **New credential types need no deploy.** A new `schemaId` is a registry entry
  plus a JSON schema in our repo. Adding "medical terminology certification"
  next quarter costs nothing onchain.
- **Expiry and revocation are first-class.** Credentials lapse. A registry
  without revocation produces proofs that are worse than no proof, because they
  are confidently wrong.
- **The issuer is the signer, not us.** A third-party-issued attestation is worth
  something to a client. One we mint about ourselves is worth exactly as much as
  our reputation, which is fine, but we shouldn't pretend otherwise. The proof
  viewer shows issuer identity prominently rather than a generic green check.

### 1.3 `ProfileAnchor` (optional, thin)

`setProfileRoot(bytes32 root, string uri)` → `ProfileUpdated(translator, root, uri, version)`.

A translator can optionally anchor a content hash of their own profile bundle
(bio + sample manifest). This makes a *portable, tamper-evident* profile possible
without us storing bios onchain. It is opt-in and the marketplace works fully
without it — I'd ship it in phase 2, not phase 1, because the demand for it is
unproven and unlike escrow it isn't load-bearing.

### What is emphatically not in contracts

| Not onchain | Why |
| --- | --- |
| Bios, work samples | Long text and files; mutable; frequently edited; zero verification value from being onchain |
| Private client feedback | It's private. Onchain is public forever. Also: a hash commitment doesn't help — a 1–5 star rating has five preimages, so a "commitment" to it is plaintext with extra steps |
| Response time | Derived from our messaging system, which is the only thing that observes it. An onchain number would just be us asserting a statistic in a more expensive font |
| Reputation score, ranking weights | Changes weekly. This is the whole point |
| Job counts, dispute counts | Derived from events. Storing a denormalized counter onchain buys nothing and creates a second source of truth that can disagree with the log |
| Language pair, job category, rate type | Covered by `termsHash`; see above |

On feedback specifically: we don't put it onchain, and we don't put a commitment
to it onchain either. If a client's private "the tone was off" note becomes
provable, clients stop writing honest notes, and the ranking signal we actually
wanted dies. Privacy here is a data-quality requirement, not just a compliance one.

---

## 2. What the search screen reads

**The search screen never touches the chain.** Not once, not as a fallback.

```
Browser
  └─ GET /api/search?q=...&langPair=es-en&minJobs=5&sort=relevance
       └─ Search service
            ├─ OpenSearch (text: bio, specialties, sample titles)
            └─ Postgres (facets, profile hydration, precomputed scores)
```

A single response contains: profile fields, facets, `score`, `scoreVersion`, and
a small `credibility` block (`completedJobs`, `disputeRate`,
`verifiedCredentials[]`, `lastComputedAt`).

Why no chain reads on the critical path:

- Search is a p99-latency surface. RPC calls are a hundred-plus milliseconds on
  a good day and have an availability budget we don't control.
- Ranking needs to sort across the full candidate set. You cannot sort 40,000
  translators by a formula whose inputs arrive one `eth_call` at a time.
- Full-text search, faceting, typo tolerance, and pagination are not things a
  contract does.

Chain data reaches the search index through an **indexer**, asynchronously:

```
Chain ──logs──▶ Indexer (Ponder / custom viem watcher)
                  │  reorg-aware, replayable from block 0
                  ▼
              Postgres: jobs, attestations, raw_events
                  │
                  ├──▶ feature store ──▶ scorer ──▶ scores table ──▶ OpenSearch
                  └──▶ /api/proof endpoints
```

The indexer's rule: it is a **cache, never a source of truth**. It can be dropped
and rebuilt from block 0 at any time and must converge to the same state. That
property is what we test in CI (replay a fixture block range, assert the derived
tables match a golden snapshot), and it's what makes the chain a genuine backstop
rather than a decoration.

The one place the UI *does* read the chain: the **proof view** (§4), which is a
separate page with a separate failure domain and a "verify yourself" affordance.

---

## 3. How ranking is produced

Entirely offchain, as a versioned batch job with an online read path.

### 3.1 Features

Recomputed nightly (or on relevant events) into a `translator_features` table:

| Feature | Source | Notes |
| --- | --- | --- |
| `completed_jobs`, `completed_volume_usdc` | `JobAccepted` events | Chain-derived, hence provable |
| `dispute_count`, `dispute_loss_rate` | `DisputeResolved` events | Chain-derived |
| `median_response_seconds` | Messaging DB | Offchain-only |
| `credential_score` | `Attested`/`Revoked`, filtered to non-expired, weighted by issuer trust tier | Chain-derived; issuer tier is our offchain judgment |
| `feedback_mean`, `feedback_n` | Private feedback, Bayesian-shrunk toward the global mean | Offchain-only; never exposed per-review |
| `recency_decay` | Timestamps | Half-life ~180d |
| `sybil_risk` | Client/translator funding-graph overlap, fresh-wallet ratio, self-funding loops | See below |

Two things worth calling out:

**Feedback must be shrunk, not averaged.** One 5.0 from one client should not
outrank forty 4.6s. `(v·n + m·k)/(n + k)` with `k ≈ 10`, tuned.

**Onchain history is cheap to fake.** A translator can create a wallet, fund
their own job, accept it, and mint a "completed job" — the chain will faithfully
record a real USDC transfer between two addresses that happen to be the same
person. This is exactly why job counts are *not* a reputation score. The chain
proves *a job existed and settled*; whether it was arm's-length is a judgment
our offchain scorer makes, using signals (payment provenance, client history,
graph overlap) that we need to keep adjusting precisely because adversaries
adapt. Anything adversarial and iterative belongs offchain.

### 3.2 The formula

A **config artifact**, not code:

```yaml
# ranking/weights/2026-09-21.yaml
version: 2026-09-21.1
features:
  completed_jobs:    { weight: 0.22, transform: log1p, cap: 200 }
  dispute_loss_rate: { weight: -0.30, transform: identity }
  median_response:   { weight: -0.12, transform: inv_log }
  credential_score:  { weight: 0.18, transform: identity }
  feedback_shrunk:   { weight: 0.28, transform: identity }
penalties:
  sybil_risk: { threshold: 0.7, multiplier: 0.3 }
```

Weekly tuning = merge a YAML file. It is reviewed, versioned in git, deployable
behind a flag, A/B-splittable by bucketing on translator-and-viewer hash, and
revertible by pointing at yesterday's file. Scores are written with their
`scoreVersion` so we can attribute a metrics shift to a specific formula change.

Search-time ordering is `relevance(query) × score(translator)`, blended — not
score alone — so that a query for "Basque legal" doesn't return the highest-scored
Spanish generalist.

### 3.3 Transparency without commitment

Translators will ask why they rank where they do. We show each translator their
own feature values and which ones are hurting them ("your median response time
is 14h; top-quartile is under 3h"), without publishing the weights — publishing
exact weights in an adversarial marketplace is publishing the gaming manual. The
features they see are the same rows that fed the scorer, so the explanation is
honest even though the formula is not public.

---

## 4. Verification, and why it doesn't cost us migrations

### What a translator can prove with our API completely offline

Every translator has a **proof bundle** — a JSON file they can download at any
time, host anywhere, or paste into a third-party verifier:

```json
{
  "subject": "0xTranslator…",
  "chainId": 8453,
  "completedJobs": [
    { "jobId": 4821, "txHash": "0x…", "blockNumber": 24118902,
      "logIndex": 3, "amount": "1450000000", "client": "0x…",
      "termsHash": "0x…", "terms": { "langPair": "es-en", "words": 9200 } }
  ],
  "credentials": [
    { "uid": "0x…", "schemaId": "0x…", "issuer": "0xATA…",
      "expiresAt": 1790000000, "dataHash": "0x…",
      "document": { "body": "ATA", "langPair": "es>en", "certNo": "…" } }
  ],
  "signature": "0x…"
}
```

Verification, with nothing but a public RPC URL:

1. For each job — fetch the receipt at `txHash`, find the `JobAccepted` log at
   `logIndex`, confirm `translator == subject` and the amount matches.
2. `keccak256(canonicalize(terms)) == termsHash` → the job description wasn't
   edited after the fact.
3. For each credential — `getAttestation(uid)`, confirm `subject`, confirm not
   revoked, confirm `expiresAt > now`, confirm `keccak256(document) == dataHash`,
   and show *who the issuer is*.
4. The bundle's `signature` is from the translator's key over the whole
   document — so a bundle can't be lifted and reattributed.

We ship this verifier as (a) a standalone static page with a user-supplied RPC
URL, no backend, and (b) a published npm package. Both work when every server we
own is down. That is the actual test of the requirement, and it's worth running
as a drill: point the verifier at a staging bundle with our API firewalled off.

**What is provable:** these jobs settled, for these amounts, at these times,
against this spec; these credentials were issued to this address by this issuer
and are/aren't still valid.

**What is not provable, and we say so in the UI:** that the work was good, that
the clients were independent, or that the rank is fair. Overclaiming here is
worse than not building it — a "verified" badge that silently covers a
self-funded job teaches clients to trust the wrong thing.

### Why product iteration stays free

The contracts only know: *money moved between these two addresses under this
committed spec*, and *this issuer said this about this address*. Both are
statements that stay true regardless of what the product becomes. Everything that
we expect to churn crosses the boundary as a hash plus an offchain document:

| Change | Cost |
| --- | --- |
| New ranking weights (weekly) | YAML merge |
| New feature in the formula | Backfill a column + YAML |
| New credential type | New `schemaId` + JSON schema |
| New job type / rate model / language pair | Job-spec schema version |
| Profile fields, samples, feedback UX | Normal app work |
| New search facet or sort | Index mapping |
| **Contract change** | Only for changing *how money moves* — new dispute mechanism, milestone payments, a second token |

The last row is the honest scope of what forces a migration, and it's what a
migration *should* be for. To keep even that cheap: `JobEscrow` is deployed
per-version and non-upgradeable, with a registry mapping version → address.
Existing jobs finish under the contract they started on; new jobs use the new
one; the indexer reads all registered versions and the verifier accepts any of
them. No proxy, no storage-layout hazard, no admin key that can rewrite
settlement logic on live escrow. Immutable contracts plus a versioned registry
beats upgradeability for anything holding user funds.

---

## 5. Build order

1. `JobEscrow` + timeouts + the indexer's replay-to-golden-snapshot test.
   Funding and releasing USDC safely is the product; everything else is polish
   on top of it.
2. Profiles, search index, flat "newest first" ordering. Ship search before
   ranking — you need traffic to tune a formula against.
3. `AttestationRegistry` with our own reviewer key as issuer; recruit one
   external issuer.
4. Feature store + scorer + first weights file. Now the weekly loop starts.
5. Proof bundle endpoint + standalone verifier. Drill it with our API blocked.
6. Sybil signals, once there's abuse to look at. Building these before you have
   real adversarial data produces rules that fit your imagination.

## 6. Open questions

- **Chain.** Base, for cheap L2 fees and native USDC. Attestation and escrow
  costs both matter at our volumes.
- **Dispute resolution.** Phase 1 is a marketplace-operated arbiter key, which
  is centralized and should be labeled as such in the UI. Whether that later
  becomes a panel or an external arbitration protocol is the main open contract
  question, and it's the one change likeliest to need a new `JobEscrow` version.
- **Gas and wallets.** Clients funding in USDC shouldn't need to think about ETH.
  Assume account abstraction with a paymaster; that decision affects the client
  onboarding flow more than the architecture.
- **Offchain document storage.** Credential documents and job specs need durable,
  addressable hosting for proofs to resolve. Our S3 works while we exist; IPFS
  or Arweave for the ones that should outlive us. Since the hash is onchain, a
  document served from anywhere is still verifiable — so this can start as S3
  and migrate without breaking existing proofs.
