# Translator Marketplace Architecture

## Goal

Build a freelance marketplace where clients fund translation jobs in USDC, translators are paid when accepted work is released, and search can rank translators using marketplace and quality signals without making weekly ranking changes require smart contract migrations.

The design keeps contracts narrow: they hold money and durable proofs. Profiles, search, matching, ranking, samples, private feedback, and formula tuning live off-chain.

## High-Level Shape

- **Contracts:** USDC escrow for funded jobs, job completion history, dispute outcome events, and credential attestations or references to an attestation protocol.
- **Indexer:** Reads contract events and materializes translator job history, payment state, dispute state, and credential attestations.
- **Application database:** Stores mutable product data such as biographies, samples, availability, language pairs, rates, private feedback, response-time metrics, and ranking feature snapshots.
- **Search service:** Reads the database plus indexed chain data, computes feature vectors, applies the current ranking formula, and returns ranked translator results.
- **Verification path:** Translators can prove completed jobs and credential attestations directly from chain logs and attestation records even if the marketplace API or search service is unavailable.

## What Is Stored In Contracts

Use 1-2 contracts for the MVP.

### `JobEscrow`

This contract handles USDC custody and emits durable job events. It should not store translation text, profile data, feedback, search rankings, or the ranking formula.

Stored state:

- `jobId`: A stable id, preferably `bytes32`, derived from an off-chain job record id or created by the contract.
- `client`: Wallet that funds the job.
- `translator`: Wallet assigned to the job.
- `amount`: USDC amount escrowed.
- `status`: Funded, accepted/released, refunded, disputed, resolved.
- `metadataHash` or `metadataURI`: Optional commitment to the off-chain job terms, such as language pair, delivery deadline, acceptance criteria, and versioned statement of work. Do not put confidential text on-chain.
- `createdAt`, `acceptedAt`, `resolvedAt`: Block timestamps where useful for proofs and indexing.

Core functions:

- `createJob(translator, amount, metadataHash)`: Client approves USDC, then funds escrow.
- `releasePayment(jobId)`: Client accepts the translation and releases USDC to the translator.
- `openDispute(jobId, reasonHash)`: Client or translator marks a dispute. The reason text stays off-chain; the hash preserves a tamper-evident reference.
- `resolveDispute(jobId, payoutToTranslator, payoutToClient, resolutionHash)`: Authorized arbitrator or multisig resolves disputed funds.
- `cancelBeforeStart(jobId)` or `refund(jobId)`: Handles mutually agreed cancellation rules.

Events:

- `JobCreated(jobId, client, translator, amount, metadataHash)`
- `PaymentReleased(jobId, client, translator, amount)`
- `DisputeOpened(jobId, opener, reasonHash)`
- `DisputeResolved(jobId, translatorPayout, clientRefund, resolutionHash)`
- `JobCancelled(jobId, refundAmount)`

These events are the permanent source for completed jobs, payment outcomes, and dispute history.

### Credential Attestations

Use an existing attestation standard if possible, such as EAS, or deploy a small `CredentialRegistry` only if the target chain does not have a suitable attestation protocol.

Stored state or attestations:

- `subject`: Translator wallet that owns the credential.
- `issuer`: Credential issuer wallet, such as a university, certification body, agency, or marketplace admin account.
- `schemaId`: Type of credential, for example `ATA_CERTIFICATION`, `LEGAL_TRANSLATION_LICENSE`, or `NATIVE_SPEAKER_REVIEW`.
- `credentialHash`: Hash of the credential document or issuer-signed payload.
- `metadataURI`: Optional URI to IPFS/Arweave or issuer-hosted verification metadata.
- `issuedAt` and optional `expiresAt`.
- `revoked`: Revocation status if the attestation standard supports it.

Do not hardcode credential scoring in the contract. The contract only proves that a named issuer attested a credential for a translator under a schema. The product can later decide how much each issuer, language pair, or credential type affects ranking.

## What Stays Off-Chain

The following data belongs in application storage, not contracts:

- Translator biography, profile photo, rates, timezone, availability, and preferred subject matter.
- Work samples and portfolio files. Store files in object storage or IPFS/Arweave depending on permanence needs; keep references in the database.
- Translation source and delivered work, especially because client documents may be confidential.
- Private client feedback and free-text reviews.
- Response time measurements and messaging metadata.
- Search filters, ranking formula, feature weights, experiments, and manual quality controls.
- Aggregated reputation summaries used by the product UI.

For sensitive records, store only private data off-chain. When a tamper-evident audit trail is useful, store a hash commitment on-chain or in an append-only audit log, but not the plaintext.

## What The Search Screen Reads

The search screen should read from a purpose-built search API, not directly from contracts.

For each query, the search API reads:

- **Profile index:** Name, biography excerpt, language pairs, specialties, location/timezone, rate range, availability, and sample references.
- **Marketplace index:** Completed jobs, active jobs, total paid volume, cancellation history, dispute count, dispute rate, and acceptance history derived from `JobEscrow` events.
- **Credential index:** Active credential attestations by translator, issuer, schema, language pair, expiration, and revocation state.
- **Feedback index:** Private feedback aggregates, such as average client satisfaction, repeat-client rate, and policy-safe tags. Free-text private feedback should not be exposed unless permissions allow it.
- **Operational metrics:** Response time, quote acceptance rate, delivery timeliness, recent activity, and availability.
- **Ranking snapshots:** Precomputed feature values and the active ranking formula version.

The UI receives:

- Ordered translator results.
- Display fields for each translator.
- Public ranking explanation snippets, such as "32 completed jobs", "ATA credential", "usually responds within 2 hours", and "low dispute rate".
- Proof links for completed jobs and credentials, pointing to transaction hashes, event proofs, or attestation pages.

The UI should not compute ranking itself. It can show verification affordances by linking to indexed chain data or a block explorer.

## How Ranking Is Produced

Ranking is an off-chain pipeline so the team can tune it weekly.

1. **Ingest events:** An indexer watches `JobEscrow` and the attestation source. It stores normalized facts keyed by translator wallet.
2. **Build features:** A scheduled job computes feature vectors, such as completed job count, paid volume, dispute rate, on-time delivery rate, median response time, credential strength, repeat-client rate, and feedback aggregates.
3. **Version the formula:** Each ranking configuration has a `rankingVersion`, feature list, weights, filters, tie-breakers, and rollout rules.
4. **Score candidates:** For each search query, the search service applies query-specific filters, computes a score from the active formula, and returns ranked results.
5. **Log explainability:** Store the ranking version, query class, feature vector, and score components used for each result impression. This supports debugging and disputes without exposing private feedback text.
6. **Publish optional commitments:** Periodically publish a hash of the ranking config and feature snapshot to an append-only log or on-chain event if stronger auditability is needed. This is not required for payment safety or translator proof of work.

Example feature treatment:

- Completed jobs: Derived from `PaymentReleased` events where the translator was paid.
- Disputes: Derived from `DisputeOpened` and `DisputeResolved` events.
- Response time: Derived from off-chain messaging timestamps.
- Credentials: Derived from active attestations, scored by issuer trust, schema, language pair, expiration, and revocation status.
- Feedback: Derived from private feedback aggregates. Keep raw feedback private and permissioned.

Because scoring is off-chain, changing weights from "credentials matter 20%" to "credentials matter 35%" is a configuration change, not a contract upgrade.

## Verification When The Search API Is Unavailable

The design gives translators useful independent proofs:

- **Completed job proof:** A translator can show their wallet address and the `PaymentReleased(jobId, client, translator, amount)` event from `JobEscrow`. The event proves that a funded job assigned to that wallet was accepted and paid.
- **Dispute context:** If needed, `DisputeOpened` and `DisputeResolved` events show whether a job was disputed and how funds were resolved.
- **Credential proof:** A translator can show attestations where `subject` equals their wallet and the issuer is a recognized credential issuer. Revocation and expiration can be checked without the marketplace API.
- **Terms integrity:** If the translator needs to prove which job terms were agreed, they can reveal the off-chain job terms document matching the `metadataHash`.
- **Profile ownership:** The translator signs a message from the same wallet used in job and credential records, proving control over the identity that received payments and attestations.

This does not make every product claim independently verifiable. Private feedback, response time, and ranking position depend on off-chain systems. That is acceptable because those signals are product features, not custody or permanent credential claims.

## Avoiding Contract Migrations During Product Iteration

Keep contracts generic and stable:

- Store facts, not product judgments. A contract records "payment released" or "credential attested", not "translator score is 91".
- Use schema ids and metadata hashes for extensibility. New credential types can be added as new schemas without changing escrow logic.
- Emit rich events. Indexers can build new views later from the same historical event stream.
- Keep ranking, weighting, search filters, and badge logic off-chain and versioned in configuration.
- Use upgradeability only if absolutely necessary for escrow bugs; avoid routing normal product iteration through proxy upgrades.
- Add new off-chain features by extending the database and ranking pipeline, not the contract.

## Suggested MVP Chain And Wallet Flow

Base is a good default for this marketplace because it has low fees, USDC support, and consumer-friendly onboarding through smart wallets. Ethereum mainnet is also viable if the product values maximum neutrality more than low-friction consumer interactions.

Client payment flow:

1. Client connects wallet.
2. Client switches to the supported network.
3. Client approves the exact USDC amount for `JobEscrow`.
4. Client creates and funds the job.
5. Client releases payment after accepting the translation.

Translator verification flow:

1. Translator connects or signs with their wallet.
2. App displays indexed completed jobs and credentials.
3. Translator can export proof links containing contract address, chain id, transaction hash, job id, and attestation id.

## Summary

The contracts provide escrow, settlement, and durable attestations. The search product reads indexed contract facts plus off-chain profile, feedback, and operational data. Ranking is produced by a versioned off-chain pipeline so it can change weekly. Translators still retain useful independent proof of completed paid jobs and credentials because those facts are anchored to their wallet through contract events and attestations.
