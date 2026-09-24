# Translator Marketplace Architecture

## Goals

The marketplace should let clients fund translation jobs in USDC, accept completed work, and release payment. Translators should be discoverable through a ranking system that can change often as the product team learns. At the same time, translators need durable proof that completed jobs and credential attestations belong to them even if the search API or marketplace application is unavailable.

The core design is to keep settlement and portable evidence on-chain, keep rich profile/search data off-chain, and connect them with signed claims and immutable content hashes.

## On-Chain Contracts

The contracts should store only data that needs settlement guarantees, public auditability, or long-lived verification.

### Translator Identity Registry

Stores:

- `translatorId` mapped to the translator's wallet address or account abstraction address.
- Optional delegated signing keys for profile updates, credential submissions, and job work proofs.
- Events for identity creation, wallet rotation, and delegated key changes.

Does not store biographies, work samples, full credential files, or private feedback. Those remain off-chain.

### Job Escrow

Stores:

- Job id.
- Client address.
- Translator address or `translatorId`.
- USDC amount funded.
- Current state: funded, submitted, accepted, disputed, released, refunded, or canceled.
- Hash or URI of the job terms accepted by both parties.
- Hash or URI of the final delivered work package, if the translator wants public proof of the submitted artifact.
- Timestamps for funding, submission, acceptance, dispute, and release.

Emits events for job funding, assignment, submission, acceptance, dispute opening, resolution, and payment release. These events are the canonical source for completed-job proofs.

The contract should not store ranking fields such as response time score, quality score, or search position. Those are product logic and should remain mutable off-chain.

### Credential Attestation Registry

Stores:

- Attestation id.
- Subject translator address or `translatorId`.
- Issuer address.
- Credential schema id, such as language pair, certification type, issuer type, expiration, and confidence level.
- Hash or URI of the credential payload.
- Status: active, revoked, expired.
- Issuance and revocation timestamps.

Credentials can be issued by approved organizations, marketplace-operated verifiers, or user-authorized third-party attestations. The registry should support multiple schemas so new credential types can be added without migrating the contract.

### Optional Feedback Commitment Registry

Private client feedback should not be published on-chain. If feedback needs later auditability, store only commitments:

- Job id.
- Feedback commitment hash.
- Client signature reference or hash.
- Timestamp.

The actual feedback text and rating dimensions stay encrypted off-chain. A client, translator, or marketplace can selectively reveal the feedback and prove it matches the commitment without exposing all private feedback globally.

## Off-Chain Storage and Indexing

The application stores mutable product data off-chain:

- Translator biographies.
- Portfolio/work samples.
- Profile photos and display metadata.
- Full credential documents where legally allowed.
- Private client feedback.
- Response-time measurements.
- Search-ready aggregates.
- Ranking feature snapshots and ranking outputs.

Large public artifacts should be stored in content-addressed storage such as IPFS, Arweave, or object storage with signed metadata and hashes anchored in contract events. Sensitive data should be encrypted in normal application storage and only shared with authorized parties.

An indexer consumes contract events and builds read models:

- Completed jobs per translator.
- Dispute counts and dispute outcomes.
- USDC volume.
- Accepted work history.
- Active credential attestations.
- Credential issuer reputation.
- Revocation state.

The indexer also joins off-chain data:

- Response time from marketplace messaging and job workflow timestamps.
- Private feedback summaries from the feedback service.
- Profile completeness.
- Work sample metadata.
- Availability and language-pair coverage.

## Search Screen Reads

The search screen should read from a search API backed by an index such as OpenSearch, Elasticsearch, Meilisearch, Typesense, or Postgres full-text search, depending on scale.

For each result, the screen reads:

- Translator display profile: name, biography excerpt, languages, location or timezone, availability, and selected work samples.
- Marketplace aggregates: completed jobs, dispute rate, recent response time, accepted work count, repeat-client signal, and visible feedback summary.
- Credential summary: verified language credentials, issuer names, expiration status, and attestation ids.
- Ranking explanation fields: top factors that affected this result for the current query, such as "strong legal translation credential" or "fast recent response time."
- Verification links: job proof page, credential attestation proof page, and wallet/identity proof.

The search screen should not call contracts directly for every result. Contract reads are too slow and awkward for ranking and filtering. Instead, the screen uses the indexed read model and links to verification views that can independently read on-chain data when needed.

## Ranking Production

Ranking is produced off-chain in a versioned ranking service.

Inputs:

- Query intent: language pair, domain, deadline, budget, certification requirements, timezone, and client preferences.
- On-chain-derived features: completed accepted jobs, disputed jobs, released USDC volume, credential attestations, issuer reputation, and credential freshness.
- Off-chain features: response time, private feedback aggregates, profile quality, availability, work sample relevance, repeat-client behavior, and policy flags.
- Safety and trust controls: active disputes, revoked credentials, sanctions or compliance checks, and manual review flags.

Process:

1. The indexer creates normalized feature records per translator.
2. The ranking service applies a formula or model identified by `rankingVersion`.
3. Search results store the `rankingVersion`, feature snapshot id, query id, and score components used for explanation/debugging.
4. Product teams tune weights weekly in configuration, not contracts.
5. Old ranking versions remain reproducible for audits and experiments.

Example score shape:

```text
score =
  query_relevance
  + completed_jobs_weight * completed_jobs_score
  - dispute_weight * dispute_rate_score
  + response_weight * response_time_score
  + credential_weight * credential_score
  + feedback_weight * private_feedback_score
```

The exact weights should live in configuration or a model registry. Changing ranking weights, adding a feature, running an A/B test, or swapping a model should require a search deployment/config update, not a contract migration.

## Verification Model

The design gives translators useful, portable proof without putting all product logic on-chain.

### Completed Job Proof

A translator can prove a completed job belongs to them by presenting:

- Their wallet signature or delegated account signature.
- The job id.
- Job escrow contract address and chain id.
- On-chain event or state showing the translator address, accepted status, and USDC release.
- Optional hash/URI of submitted work or agreed job terms.

Anyone can verify this by reading the escrow contract or an archive node. The marketplace search API is not required.

### Credential Proof

A translator can prove a credential belongs to them by presenting:

- Their wallet signature or delegated account signature.
- Attestation id.
- Issuer address.
- Credential schema id.
- Credential payload or selective-disclosure proof.
- On-chain attestation status showing active/not revoked.

Anyone can verify that the issuer attested to the translator and that the attestation has not been revoked. If the credential contains private details, the translator can reveal only the necessary fields and prove they match the anchored hash.

### Feedback Proof

Private client feedback is useful for ranking but should not become public by default. Verification is therefore weaker and more privacy-preserving:

- The marketplace can prove a feedback aggregate was computed from committed feedback records.
- A client can reveal a specific signed feedback record if they choose.
- A translator can request an export of signed feedback claims for portability, subject to client privacy rules.

This prevents the ranking system from depending on unverifiable private claims while still respecting confidentiality.

## Why This Avoids Contract Migrations

Contracts define stable facts:

- Who the translator identity belongs to.
- Which jobs were funded, accepted, disputed, and paid.
- Which credential attestations were issued or revoked.
- Which optional private-feedback commitments existed at a point in time.

The product can iterate on everything else off-chain:

- Ranking weights.
- New ranking features.
- Search filters.
- Profile layouts.
- Feedback summarization.
- Credential scoring logic.
- Experiment assignment.
- Result explanations.

Adding a new ranking feature usually requires adding an indexer field, search schema field, or model input. It does not require modifying escrow or attestation contracts unless the new feature needs a new durable proof primitive. Even then, prefer schema-extensible attestations and event-driven registries over hardcoded ranking fields.

## Recommended Data Boundaries

| Data | Location | Reason |
| --- | --- | --- |
| USDC escrow amount and release state | Contract | Settlement must be trust-minimized |
| Job acceptance and payment release | Contract events/state | Durable completed-job proof |
| Translator identity address | Contract | Portable ownership proof |
| Credential attestation hash/status | Contract | Durable credential proof and revocation |
| Biography | Off-chain database | Mutable product content |
| Work samples | Content storage plus off-chain metadata | Large files and flexible display |
| Private feedback text | Encrypted off-chain storage | Privacy |
| Feedback aggregate | Off-chain ranking/index service | Product iteration |
| Response time | Off-chain analytics/indexer | Derived operational metric |
| Ranking formula | Versioned config/model registry | Weekly tuning |
| Search results | Search index/API | Fast query and filtering |

## Operational Notes

- Run at least one marketplace indexer, but design verification pages to fall back to direct contract reads.
- Publish contract addresses, ABI files, chain ids, and proof instructions so translators are not dependent on the marketplace UI.
- Keep ranking versions and feature snapshots for a reasonable audit window.
- Use signed metadata for profile and credential payloads so off-chain data can be tied back to wallet ownership.
- Support wallet rotation through the identity registry so translators do not lose their history.
- Treat private feedback as confidential input, not public reputation data, unless the client explicitly signs and authorizes disclosure.
