# Translator Marketplace Architecture

## Goals and design boundary

The system separates **portable evidence** from **product presentation**:

- Contracts hold the minimum durable facts needed to custody USDC and let a translator prove that jobs and credential attestations belong to them.
- An off-chain index, application database, and search service hold biographies, samples, private feedback, derived metrics, and the ranking implementation.
- The search formula is explicitly not contract logic. It can be changed weekly by deploying a new ranking configuration or service version, without migrating contracts or rewriting historical evidence.

The chain is the source of truth for payment and public verification. The application is the source of truth for discovery, privacy controls, moderation, and ranking.

## Identity model

Each translator has a stable `translatorId` represented by a registry entry controlled by an Ethereum account (preferably a smart account with recovery and key rotation). The registry maps that ID to its current controller and emits events when control changes.

Jobs and credentials refer to `translatorId`, not only to the current wallet address. This prevents a lost or rotated key from breaking the translator's history. Anyone can resolve the current controller and inspect the complete event history. Account-link and recovery operations should require signatures from the current controller or the marketplace's documented recovery process; they must never silently transfer job history between identities.

The profile may publish a domain-separated signature such as `Marketplace profile for translatorId X, profile version Y`. This ties the off-chain profile served by the application to the on-chain identity.

## What is stored in contracts

### Translator registry

Store only:

- `translatorId` and current controller address;
- optional content hash/URI for the translator's current public profile manifest;
- controller-change and profile-manifest events.

The profile manifest is a versioned JSON document stored outside the contract (for example in object storage and optionally IPFS). Its hash makes a retrieved biography or work-sample list tamper-evident, while the content can remain cheap to update. Personally identifying information should not be put on a permanent public chain.

### USDC job escrow

Use a small, audited escrow contract that records:

- immutable job ID, client address, translator ID, USDC token address, amount, and agreed terms hash;
- state transitions such as funded, accepted/released, refunded, cancelled, or disputed;
- payment recipients and settlement amounts;
- events for every transition.

The terms hash commits to a canonical off-chain agreement containing items such as source/target languages, scope, deadline, acceptance rules, and encrypted deliverable references. Source documents and translations do not belong on-chain.

Use checks-effects-interactions, safe ERC-20 transfers, reentrancy protection, explicit authorization, pause/emergency controls, and support only an allowlisted canonical USDC contract for each network. Settlement must remain possible if the search or application API is down. Dispute resolution can be an authorized resolver or a separate swappable arbitration adapter; its outcome and settlement are recorded by the escrow.

A completed-job event binds the job ID, translator ID, client, terms hash, final status, and paid amount. This event is the durable proof that the completed job belongs to that translator. A client should not be able to fabricate a completion without having funded and progressed the corresponding escrow.

### Credential attestations

Use a generic attestation registry (or a widely supported attestation protocol) rather than a contract field for each credential type. An attestation contains:

- schema ID and schema version;
- subject translator ID;
- issuer address;
- issuance and optional expiry time;
- claim-data hash or minimal non-sensitive claim data;
- revocation status/reference.

Examples include language, proficiency level, test type, score band, and issuing organization. Detailed certificates may be stored off-chain and selectively disclosed; their canonical hash is included in the attestation. The marketplace maintains an off-chain issuer trust list and schema parser. Adding a credential type or changing how much ranking weight it receives therefore does not change a contract.

The useful proof is not merely that an attestation exists: a verifier also checks its issuer, schema, expiry, and revocation state. Issuer reputation and marketplace acceptance remain policy decisions outside the contract.

### What is deliberately not stored on-chain

- biography text, photos, and mutable profile presentation;
- work-sample files or client source material;
- private feedback text or raw ratings;
- response-time aggregates, dispute ratios, search features, or rank scores;
- issuer allowlists used by the current product experience;
- the ranking formula or its weights.

Putting these into contracts would expose private data, make deletion impossible, increase cost, and couple weekly product changes to migrations.

## Off-chain data and ingestion

An event indexer reads registry, escrow, arbitration, and credential-attestation events from the chain. It waits for an appropriate confirmation depth, handles reorganizations idempotently, and stores block number/hash plus transaction/log coordinates so every derived record can be traced back to chain data. A periodic reconciliation job compares indexed state with contract reads and replays from a checkpoint when necessary.

The application database combines indexed facts with:

- profile biographies and language/service selections;
- work-sample metadata, access policy, moderation state, and content location;
- private client feedback, encrypted at rest and access-controlled;
- message-derived response timestamps and other operational metrics;
- dispute classifications and moderation outcomes;
- normalized credential data, issuer trust policy, expiry, and revocation;
- feature snapshots used by each ranking run.

Private feedback must not be embedded in a public profile manifest. If later auditability is valuable, store a salted commitment to a canonical feedback record or include it in a periodically published Merkle root. That can prove the record was not changed after the fact without revealing its text or score. Because a commitment does not prove truth, access authorization and marketplace moderation are still required.

## What the search screen reads

The browser reads a search API backed by a denormalized search index, not the blockchain directly for every result. Each result can contain:

- translator ID, display profile, languages, availability, biography excerpt, and approved sample previews;
- completed-job count and paid-volume bands derived from finalized escrow events;
- dispute count/rate and clearly defined outcome categories;
- median response-time band over a disclosed time window;
- currently accepted, unexpired, non-revoked credentials;
- privacy-safe feedback aggregates and excerpts for which the viewer has permission;
- rank/debug metadata such as ranking version and feature snapshot time;
- transaction or attestation references for facts that can be publicly verified.

The UI should label stale indexed data and retain a direct **Verify evidence** path. A search outage may prevent discovery, but it must not prevent a translator or verifier from obtaining proofs from contracts, an RPC provider, and content-addressed manifests.

## Ranking pipeline

Ranking is a versioned off-chain pipeline:

1. The indexer produces normalized, finalized facts from contract events and joins them with authorized application data.
2. A feature job computes documented features, for example completed jobs, completion recency, dispute rate with a minimum-sample confidence adjustment, response-time percentile, accepted credential signals, and privacy-safe feedback aggregates.
3. Eligibility and abuse filters run before scoring: active profile, relevant language pair, unexpired credentials where required, sanctions/fraud controls, and sample moderation.
4. A ranking service applies a versioned configuration or model to eligible candidates. Query relevance and availability can be combined with quality signals.
5. The service writes the ranking version, feature-schema version, configuration/model artifact hash, and evaluation timestamp into logs and optionally the response.

Weights, transforms, time windows, credential trust policies, and even the ranking model can change weekly. Configurations are reviewed, tested against offline relevance and marketplace-health metrics, rolled out behind a flag, monitored for regressions and disparate impact, and can be rolled back immediately. Historical configurations and feature snapshots are retained so a result can be reproduced internally.

Care is needed with sparse histories: raw ratios can punish new translators or over-reward one successful job. Use smoothing/confidence bounds, cap extreme feature influence, provide an exploration path for qualified newcomers, and do not expose exact weights that make manipulation trivial. Translators should receive understandable factor-level explanations and a correction/appeal mechanism even if the precise anti-gaming formula remains private.

## Verification flows

### Proving a completed job

A translator supplies their translator ID and job ID (or transaction/event proof). A verifier:

1. reads the registry to resolve identity control;
2. reads the escrow record or verifies its finalized completion event;
3. confirms that the event names that translator ID and that USDC settlement occurred;
4. optionally retrieves the agreement whose canonical hash matches the on-chain terms hash, if the parties authorize access.

This proves identity binding, lifecycle, and payment without trusting the search API. It does not disclose the confidential source or translation and does not by itself prove subjective translation quality.

### Proving a credential

The translator supplies the attestation ID and, when needed, the selectively disclosed certificate. A verifier checks the subject translator ID, issuer signature/address, schema, expiry, revocation state, and certificate hash. The verifier can apply its own issuer policy rather than relying on the marketplace's current ranking policy.

Provide a small open-source verification page/CLI that accepts IDs and RPC endpoints and emits a human-readable report. It should read contracts directly and support standard log/receipt proofs where practical. Multiple RPC endpoints and content-addressed profile/credential documents reduce dependence on marketplace infrastructure.

## Upgrade and migration strategy

Keep evidence primitives narrow and append-only. Contracts expose stable identifiers, hashes, state, attestations, and events; they do not know about UI fields or ranking weights. New profile fields, search features, scoring models, credential schemas, and trusted issuers are introduced through versioned off-chain schemas and configuration.

If contract behavior genuinely must change, deploy a new version through a documented registry/factory and have the indexer read all supported versions. Preserve old contracts and events as historical proof. Avoid upgrading storage layouts merely to support product experiments; upgradeability, if used for emergency fixes, should be governed by a multisig with a timelock and transparent events.

This design makes verification durable and independently useful while keeping the fast-changing marketplace experience cheap, private, and reversible.
