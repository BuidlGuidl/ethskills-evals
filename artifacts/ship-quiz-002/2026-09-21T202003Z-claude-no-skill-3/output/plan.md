# Translator Marketplace — Architecture

## The governing decision

Two requirements pull in opposite directions:

- **Ranking changes weekly.** Completed jobs, disputes, response time, credentials and
  feedback get reweighted constantly, and new signals get added.
- **A translator must be able to prove their completed jobs and credentials without us.**
  Our search API going down must not erase their work history.

The resolution is a single rule applied everywhere below:

> **On-chain: settlement facts and third-party claims. Off-chain: everything we expect to
> change our minds about.**

A completed job is a fact — money moved, a client accepted a delivery, a dispute resolved
a certain way. That fact is true regardless of how we score it, and it is the thing a
translator needs to prove. A ranking score is an *opinion we hold this week*. Putting the
opinion on-chain buys no credibility (we compute the inputs anyway) and costs us a contract
migration every time the product team learns something.

So the chain stores the facts. The search product is an ordinary indexed-read application
built on top of them. Verification is a separate, small, independent path that never routes
through the search stack.

---

## 1. What is stored in contracts

Target chain: **Base** (native USDC, low fees, credible neutrality for a proof that must
outlive us). Two contracts plus one shared public registry.

### 1.1 `JobEscrow` — the settlement state machine

Holds USDC and records the lifecycle of one job. Immutable, no proxy (see §6.2).

```solidity
enum Status { Funded, Delivered, Accepted, Disputed, Resolved, Refunded, Expired }

struct Job {
    address client;
    address translator;
    uint128 amount;        // USDC, 6dp
    uint64  fundedAt;
    uint64  acceptDeadline;
    Status  status;
    bytes32 specHash;      // commitment to the off-chain job spec
    bytes32 deliveryHash;  // commitment to the delivered translation
}
```

Functions: `fund`, `submitDelivery`, `accept`, `raiseDispute`, `resolveDispute`,
`refundAfterDeadline`. Events mirror each transition and carry `jobId`, both addresses,
`amount`, and the relevant hash.

**What is deliberately *not* in the struct:** language pair, word count, subject domain,
turnaround tier, rush flag, quality rubric. Every one of those is product taxonomy we will
revise — we will add "legal/pharma" domains, split "zh" into script variants, change how
rush is priced. Instead they live in an off-chain **job spec JSON**, and the contract stores
only `specHash = keccak256(canonical_json(spec))`.

This is the pivot that makes the whole design work. The commitment is schema-agnostic: we
can change the spec schema weekly and the contract never notices, because the contract only
ever compares a 32-byte hash. At verification time the translator reveals the spec JSON and
the verifier recomputes the hash. The proof is as rich as the spec, and the spec is as
flexible as a JSON file.

```
spec = {
  "v": 3,
  "jobId": "0x…",
  "src": "de-DE", "tgt": "en-US",
  "words": 4200, "domain": "patent-legal",
  "salt": "<32 random bytes>"
}
```

The salt matters: spec fields are low-entropy and the hash is public, so without it anyone
could brute-force the contents of a job that was meant to stay private between the parties.

`deliveryHash` is the hash of the delivered file. It gives the translator an authorship
proof (they can show the file that hashes to a delivery a client paid for) and gives
dispute resolution something to point at. The file itself is never on-chain — it's the
client's confidential document.

### 1.2 Credentials — use EAS, don't build a registry

Language credentials come from third parties (ATA, CIOL, NAATI, universities). The useful
property is *"an issuer we recognize said this"* — which is exactly an attestation.

Use the **Ethereum Attestation Service** already deployed on Base rather than writing our
own registry. Schema:

```
CredentialAttestation {
  bytes32 credentialHash;  // hash of the credential document + salt
  string  kind;            // "ata-certification" | "degree" | "gov-sworn" | …
  string  langPair;        // e.g. "de-DE>en-US"
  uint64  issuedAt;
  uint64  expiresAt;
}
```

- `recipient` = translator's address. `attester` = issuer (or our verification desk acting
  as attester-of-record, clearly labelled as such — an attestation by us is worth exactly
  what our reputation is worth, and pretending otherwise would be dishonest).
- Revocable, so a lapsed or fraudulent certification can be withdrawn.
- **Which issuers are trustworthy is not on-chain.** That's a product judgement we'll revise
  — a curated issuer allowlist lives in our config and is republished as a signed, versioned
  JSON file (§4.3). The chain records *who said what*; we decide *whose word counts*, and a
  third party is free to disagree.

### 1.3 `IdentityLink` — binding a wallet to a profile

A tiny contract mapping `address => bytes32 profileId`, self-asserted by the translator,
plus a `previousAddress` pointer so a key rotation preserves history. Needed so that a
proof presented by address `0xabc…` can be tied to "Ana Reyes, profile 4471" rather than to
an anonymous address. Losing a key is a real failure mode for freelancers; without rotation
support, key loss destroys a career's worth of proof.

### 1.4 Explicitly not on-chain

| Data | Why not |
| --- | --- |
| **Private client feedback** | It's private. Even a *hash* is wrong here: feedback text is low-entropy and brute-forceable, an immutable commitment defeats GDPR/CCPA erasure, and publishing "there exists feedback for job X" is itself a disclosure. It stays in Postgres, encrypted at rest, with a deletion path. |
| **Biographies, work samples** | Edited constantly; nothing is proven by anchoring them. Object storage + CDN. |
| **Response time** | Derived from our own message logs. We are the only possible attester and we're the interested party — an on-chain number here is *false assurance*, not verification. |
| **Ranking scores and weights** | The entire point of §3 is that these change weekly. |
| **Review star ratings, profile completeness, badges** | Product surface, not settlement. |

The honest framing for translators: *completed jobs, payments, disputes and credentials are
independently provable; your response-time stat and your rank are our numbers, and we say so.*

---

## 2. What the search screen reads

**The search screen reads one system: our search service. It never talks to an RPC node.**

```
Client (Next.js)
   │  GET /api/search?q=…&src=de&tgt=en&domain=legal&page=1
   ▼
Search API ──► OpenSearch (denormalized translator documents)
   │                 ▲
   │                 │ writes
   │           Indexing pipeline
   │                 ▲
   ├──► Postgres ────┤ (profiles, feedback, messages, jobs mirror)
   │                 │
   └──► Chain Indexer ┘ (Base logs → Postgres → OpenSearch)
```

One denormalized OpenSearch document per translator holds everything the results page
renders: name, headline, bio snippet, language pairs, sample thumbnails, price band,
credential badges, `completed_jobs`, `dispute_rate`, `median_response_minutes`,
`feedback_score`, and the precomputed ranking features. A results page is a single query,
p99 under 150 ms, no fan-out, no wallet connection, no RPC.

This matters beyond latency. If the search screen resolved on-chain data at render time,
every RPC hiccup would be a product outage and every ranking iteration would be bounded by
chain read performance. The chain is a *source of facts for an indexer*, not a database the
UI queries.

### 2.1 The indexer

A standard log-following service (Ponder or a custom viem-based worker):

- Follows `JobEscrow` and EAS logs from the deployment block.
- Waits for ~2 minutes of confirmations before marking rows canonical; handles reorgs by
  rolling back to the fork block and replaying.
- Writes to Postgres `onchain_jobs` / `onchain_attestations`, which the indexing pipeline
  projects into OpenSearch.
- **Is fully derived state.** It can be dropped and rebuilt from the chain at any time. If
  the indexer is wrong, the chain is right. That property is what makes the whole read path
  safe to iterate on aggressively.

Profile edits, feedback submissions and message events push into the same pipeline via
change-data-capture, so an OpenSearch document is typically under 30 seconds stale.

---

## 3. How the ranking is produced

Ranking is a **versioned config applied to a feature store**. No code deploy, no migration,
no contract interaction.

### 3.1 Features

Computed hourly by a batch job into `translator_features`:

| Feature | Source |
| --- | --- |
| `completed_jobs_90d`, `completed_jobs_lifetime` | indexer (`Accepted` events) |
| `gross_volume_usdc` | indexer |
| `dispute_rate`, `disputes_lost` | indexer (`Resolved` events + outcome) |
| `median_response_minutes` | message logs (Postgres) |
| `credential_score` | EAS attestations × issuer weights from the curated list |
| `feedback_score`, `feedback_volume` | private client feedback (Postgres) |
| `recency_decay`, `availability`, `completion_rate` | mixed |

Each is normalized (winsorize at p99, then min-max within the language-pair cohort) so a
weight change means the same thing across markets, and so a single whale client can't
dominate a cohort.

### 3.2 Scoring

```jsonc
// ranking/config/v37.json — shipped as data, not code
{
  "version": 37,
  "effective_from": "2026-09-22T00:00:00Z",
  "weights": {
    "completed_jobs_90d": 0.28, "feedback_score": 0.24,
    "credential_score": 0.18, "response_speed": 0.14,
    "recency_decay": 0.10, "availability": 0.06
  },
  "penalties": { "dispute_rate": -0.45, "disputes_lost": -0.30 },
  "floors": { "min_completed_jobs_for_top_tier": 3 },
  "cohort": "lang_pair"
}
```

Score = weighted sum of normalized features + penalties, blended with the text-relevance
score from OpenSearch (BM25 on bio/samples/specialties) at query time. Cold-start
translators get a credential-and-samples-weighted prior so an empty history isn't a
permanent floor.

### 3.3 The weekly loop

1. Author `v38.json`.
2. **Offline replay** against last week's logged queries and clicks → nDCG, position churn,
   cohort-level fairness deltas.
3. **Shadow score** in production for a day: compute both, serve `v37`, log the diff.
4. Ramp `v38` 5% → 50% → 100% behind a flag, watching booking rate and dispute rate.
5. Config version is stamped on every search response for attribution and rollback.

Rollback is editing a flag value. Total contract surface touched across this entire loop:
**zero**. Total schema migrations: zero, unless a genuinely new *feature* is added, which
is a Postgres column and an OpenSearch mapping update.

This is the payoff of §1's boundary. If `completed_jobs` had been stored as a contract-side
counter with a weight, adding "disputes lost specifically on terminology accuracy" would be
a contract upgrade with a migration, a re-audit, and a several-week cycle. Here it's a
column and a JSON edit.

---

## 4. Verification when the search API is down

The verification path shares **no runtime dependency** with the product. If our entire AWS
account vanished, the following still works.

### 4.1 The portfolio proof bundle

A translator exports a signed JSON bundle (from the app while it's up, or reconstructed
from chain data plus their own files):

```jsonc
{
  "profile": { "name": "Ana Reyes", "address": "0xA11c…", "chainId": 8453 },
  "jobs": [{
    "jobId": "0x7f…", "txHash": "0x3c…", "block": 24910233,
    "status": "Accepted", "amountUsdc": "1840.00",
    "spec": { "v": 3, "src": "de-DE", "tgt": "en-US", "words": 4200,
              "domain": "patent-legal", "salt": "0x9b…" },
    "deliveryHash": "0x22…"
  }],
  "attestations": [{
    "uid": "0xe4…", "schema": "0x1d…", "attester": "0xATA…",
    "kind": "ata-certification", "langPair": "de-DE>en-US",
    "credentialDoc": "cert-ata-2023.pdf", "salt": "0x5e…"
  }],
  "signature": "<translator's EIP-191 signature over the bundle>"
}
```

### 4.2 What a verifier checks, using only a public RPC endpoint

1. `JobEscrow.jobs(jobId)` on Base returns `translator == 0xA11c…` and `status == Accepted`
   → **this person was paid for this job.** Not our claim; the chain's.
2. `keccak256(canonical(spec)) == job.specHash` → **the job was this language pair, this
   size, this domain.** The spec can't be retro-edited.
3. `keccak256(file) == job.deliveryHash` → **this is the file they delivered.**
4. EAS `getAttestation(uid)` returns a live, unrevoked attestation with
   `recipient == 0xA11c…` and `attester == 0xATA…` → **a named issuer certified them.**
5. `IdentityLink` ties the address to the claimed profile, following `previousAddress` for
   rotations.

No API key, no account, no permission from us. Public RPC, a block explorer, or a local
node — any of them suffices.

### 4.3 Making that practically usable

Facts nobody can check aren't verification. Three artifacts, all independent of our API:

- **`@marketplace/verify`** — a ~200-line npm CLI and library. `npx @marketplace/verify
  bundle.json --rpc <any-base-rpc>`. No network calls to us. MIT-licensed so it outlives us.
- **A static verifier page** pinned to IPFS (and mirrored on GitHub Pages) — pure client-side
  JS, user supplies the RPC URL. Loads if our origin is dead.
- **Signed, versioned issuer list** published to IPFS weekly — lets a verifier apply our
  issuer-trust judgement without trusting our servers, and lets them substitute their own.

### 4.4 What is honestly *not* verifiable

A translator cannot prove their response time, their private feedback score, or their search
rank, because those are our measurements of our own data. We should state this plainly on
the profile with a visual distinction — chain-verified facts get a badge that links to the
verifier; platform-measured stats are labelled "measured by us." Claiming verification we
can't deliver is worse than admitting the boundary.

---

## 5. Data placement summary

| Data | Where | Why |
| --- | --- | --- |
| Escrowed USDC, job status, amounts | `JobEscrow` | Settlement. Must be trustless. |
| Job spec, delivery file | Hash on-chain, content off-chain | Proof without disclosure; schema free to evolve |
| Dispute outcomes | `JobEscrow` | Adversarial; both parties need a neutral record |
| Language credentials | EAS on Base | Third-party claims, independently checkable, revocable |
| Issuer trust weights | Signed JSON, versioned | A judgement we revise |
| Bio, samples, headline | Postgres + S3/CDN | Edited constantly, nothing to prove |
| Private client feedback | Postgres, encrypted, deletable | Private; must be erasable |
| Response time, completion rate | Postgres, derived | Our measurement, not provable anyway |
| Search documents | OpenSearch | Rebuildable projection |
| Ranking weights | Versioned config + flags | Changes weekly |

---

## 6. Iteration without migrations

### 6.1 Why the contract stays still

The contract encodes only things whose meaning doesn't change: *money moved from A to B;
B delivered something hashing to H; the client accepted / a dispute resolved this way.*
Those sentences will be as true in two years as today. Every field we'd be tempted to add —
domain taxonomy, quality tiers, rush flags, rating scales — is covered by `specHash`.

Concrete tests of the boundary:

- *Add a "certified legal translation" job type* → new field in spec JSON v4. Contract: untouched.
- *Reweight disputes vs. feedback* → `v38.json`. Contract: untouched.
- *Add a new credential issuer* → issuer list update. Contract: untouched.
- *Add "terminology consistency" as a ranking signal* → Postgres column + feature job + weight.
  Contract: untouched.
- *Change how completed jobs decay with age* → config. Contract: untouched.

### 6.2 When the contract does change

`JobEscrow` holds user funds, so it's **immutable — no upgrade proxy.** An upgradeable
escrow means an admin key can drain or freeze escrowed funds, which contradicts the reason
for using escrow at all. A genuine protocol change (say, milestone payments) means deploying
`JobEscrowV2` and routing new jobs to it. Old jobs settle in V1 forever; the indexer follows
both addresses and the verifier resolves `jobId` across a small registry of known
deployments. Old proofs keep verifying permanently — which is the property translators
actually care about.

### 6.3 Failure modes

| Failure | Effect | Mitigation |
| --- | --- | --- |
| Search API down | No discovery | Verification path unaffected (§4); CDN-cached top results |
| Indexer lags/crashes | Stale counts | Derived state; replay from chain. Facts unaffected. |
| RPC provider down | Funding/release blocked | Multiple providers + fallback; reads work from any public node |
| Chain reorg | Transient index state | Confirmation depth + rollback-replay |
| Translator loses key | Can't sign new bundles | `IdentityLink.previousAddress` rotation; we re-attest continuity |
| We shut down | Product gone | Bundles, CLI, static verifier, issuer list all survive independently |

---

## 7. Build order

1. `JobEscrow` + USDC flow on Base Sepolia; spec-hash commitment format frozen.
2. Indexer → Postgres → OpenSearch; search screen on indexed reads from day one.
3. Profiles, samples, messaging, private feedback (off-chain, plain product work).
4. EAS credential schema + verification desk + issuer list.
5. Ranking feature store + `v1.json` + shadow-scoring harness — the weekly loop is
   infrastructure, not an afterthought.
6. Proof bundle export, `@marketplace/verify`, IPFS verifier page.
7. Audit `JobEscrow`; mainnet.

Steps 3 and 5 never touch step 1. That separation is the architecture.
