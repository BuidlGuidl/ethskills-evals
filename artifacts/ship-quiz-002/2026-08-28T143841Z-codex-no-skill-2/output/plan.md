# Translator marketplace architecture

## Design principle

Use contracts as a settlement and attestation layer, not as the product database or ranking engine. Contracts record the small set of durable facts that a translator may need to prove independently. An indexed, offchain read model supplies the fast and private data needed by search. Ranking is a versioned service over that read model, so its formula can change without changing contract storage or migrating state.

## Onchain contracts

Deploy the contracts behind conservative versioning boundaries and identify records with stable IDs (`profileId`, `jobId`, and `credentialId`). Avoid biographies, samples, search scores, response-time aggregates, and private feedback onchain.

### Profile registry

The profile registry binds a stable `profileId` to a controlling wallet. It supports explicit controller rotation/recovery and emits events for every change. A profile may contain only an optional content hash or URI to a public profile manifest; the manifest itself lives offchain and can change without a transaction if the product does not require historical anchoring.

The binding lets a translator prove control by signing a challenge with the current profile controller. Historical controller events allow an independent verifier to establish who controlled a profile when a job or credential was recorded.

### USDC job escrow

Each job escrow stores only settlement-critical data:

- `jobId`, client address, translator `profileId`, USDC token address, and funded amount;
- lifecycle state such as funded, accepted/released, refunded, cancelled, or disputed;
- payment and dispute resolution outcomes;
- deadlines or arbitrator authority when those rules must be enforced by the contract.

Funding transfers USDC into escrow. Acceptance releases it to the translator's payout address. State transitions emit canonical events containing the IDs and outcome. A completed-job proof is therefore the transaction receipt and event/state showing that a particular `profileId` completed a funded job and was paid. Translation text, job brief, client identity, messages, and deliverables remain offchain; public job descriptions should not be placed in event logs.

If contracts evolve, a small protocol registry lists approved escrow implementations and deployment blocks. This lets indexers and independent verifiers follow multiple versions without copying all old jobs into a new contract.

### Credential attestations

Use a minimal attestation registry (or a standard attestation protocol) with a stable schema. An attestation records:

- attestation ID, issuer, subject `profileId`, credential type/schema ID, issue and optional expiry time;
- a hash of the credential document or claims, never sensitive document contents;
- status or a revocation reference.

Issuers sign or submit attestations, and revocations are append-only events/state. The app maintains an offchain issuer allowlist and credential-category mapping because judgments such as issuer trust and ranking weight are product policy. The onchain record proves who attested what hash for which profile and whether it has been revoked; it does not permanently freeze the marketplace's interpretation of that credential.

### Optional commitments

Private feedback is stored encrypted offchain with strict client/marketplace access controls. If auditability of later alteration is valuable, store or periodically anchor a salted commitment/Merkle root for feedback records. Never publish plaintext, unsalted low-entropy ratings, or per-client searchable metadata. A commitment proves that a disclosed record existed unchanged at an anchor time, but it does not make the record public or trustworthy by itself.

## Offchain data and indexing

An event indexer reads profile, escrow, attestation, and revocation events from finalized blocks. It is reorg-aware, idempotent, and stores block number/hash, transaction hash, log index, contract version, and confirmation status. A reconciliation worker periodically compares indexed state with contract reads.

The application database joins those canonical facts with mutable product data:

- biographies, language pairs, availability, rates, work-sample metadata, and object-storage URLs;
- job briefs, deliverables, messages, and timestamps used to calculate response time;
- encrypted private feedback and access/audit logs;
- dispute categories and moderation decisions that are not contract-enforced;
- normalized credential categories, issuer trust policy, expiry, and verification status.

Public samples may live in object storage/CDN. Sensitive objects use authorization, encryption, short-lived URLs, retention rules, and deletion workflows. Public-chain data is deliberately insufficient to reconstruct private feedback or confidential translations.

## What the search screen reads

The search UI reads a search API backed by a denormalized search index, not contracts or RPC nodes on every page load. Each result contains the public profile fields, sample thumbnails, language/availability filters, display-safe aggregates, the computed rank score or explanation labels, and freshness metadata such as the indexed block and ranking version.

The search index contains derived features rather than raw confidential records: confirmed completed-job count, dispute rate with a minimum-sample policy, response-time buckets, recognized/nonexpired credential features, and privacy-safe feedback aggregates. Suppress or coarsen aggregates where small sample sizes could reveal a client's private feedback. Detailed private feedback is returned only by a separate authorized endpoint and is never copied into the public search document.

The profile page can additionally expose “verify” links containing chain ID, approved contract address/version, `profileId`, job or attestation ID, transaction hash, and log index. These links are conveniences, not trusted proof sources.

## Ranking production

A feature pipeline consumes the indexed chain facts and authorized application data, computes normalized features, and writes a point-in-time feature snapshot. A ranking service applies a configuration such as weights, thresholds, caps, eligibility rules, and tie-breaking. Configuration is stored in a versioned repository/config service and deployed behind feature flags or experiments.

Every result records at least `rankingVersion`, `featureSnapshotId`, calculation time, and indexed-through block. This supports debugging and reproducibility even when the current formula changes weekly. A typical flow is:

1. Exclude ineligible, suspended, unavailable, or language-mismatched profiles.
2. Normalize features and apply safeguards for new translators and small samples.
3. Combine completed jobs, dispute history, response-time bucket, recognized credentials, and privacy-safe feedback aggregates using the active versioned formula.
4. Apply abuse/fraud controls and deterministic tie-breaking.
5. Publish documents to the search index, then atomically switch the active index/version.

Backtests, fairness checks, spam resistance, and experiment metrics run before promotion. None of these weights or policies are contract constants. The chain supplies facts; the ranking layer decides how current product policy values them.

## Independent verification and degraded operation

Verification must not depend on trusting the marketplace search API. The application publishes contract addresses, ABIs, chain IDs, deployment blocks, attestation schemas, and the protocol-registry address in a small open-source verifier/specification. A translator can export a proof bundle containing:

- their `profileId` and a fresh wallet signature proving current control;
- job IDs plus transaction receipts/log inclusion data showing assignment and successful release;
- credential attestation IDs, issuer signatures/transactions, document hashes, and revocation status;
- optional disclosed credential documents whose hashes match the attestations.

An independent verifier can query any compatible RPC provider—or run its own node—check that contracts are approved by the protocol registry, validate event inclusion and finality, follow controller history, and check current revocations. Thus a search API outage may prevent convenient discovery and current ranking, but it does not prevent proof of completed jobs or credential attestations.

For better availability, provide a static/exportable profile manifest listing proof references, mirrored on user-controlled storage or content-addressed storage. Treat it only as an index: every claim is checked against chain state, and revocation/dispute status must be read at verification time. Cached signed snapshots can make the UI usable during an outage, but must show their timestamp/indexed block and must not be presented as current revocation status.

## Why this boundary supports iteration

Contract migrations are reserved for changes to custody, settlement, identity binding, or attestation semantics—the facts that require shared enforcement and durable verification. Everything expected to change frequently lives in schemas and services designed for ordinary migrations: profile presentation, sample layout, feedback aggregation, issuer recognition, search filters, feature definitions, and ranking weights.

New ranking inputs can be derived from existing events or added to the application database without touching escrow balances or historical proofs. New contract implementations can be registered and indexed alongside old ones, preserving old evidence. This yields useful, independently checkable claims without forcing the public chain to become a slow, expensive, privacy-hostile copy of the marketplace product.
