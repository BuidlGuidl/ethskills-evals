# Translator Marketplace Architecture

## Goals

The marketplace should let clients fund translation jobs in USDC, release payment when work is accepted, and search for translators using a ranking formula that can change weekly. At the same time, a translator must be able to prove their completed jobs and credential attestations even if the marketplace search API is down.

The design separates durable verification from product iteration:

- Contracts record payment, job completion, disputes, identity bindings, and credential attestations or references.
- Off-chain services store rich profile data, private feedback, search indexes, and ranking logic.
- Ranking formulas are versioned application configuration, not contract logic.
- Translators can verify core claims from contract state, emitted events, issuer signatures, and portable receipts.

## Contract Layer

### Translator Registry

Stores stable translator identity records:

- `translatorId`
- Owner wallet address
- Optional delegated signing addresses
- Optional DID or profile URI
- Profile metadata hash for the current public profile document
- Events for profile updates and wallet rotations

The registry should not store full biographies, work samples, or private data. Those live off-chain. The contract only stores enough information to bind a public profile document to a wallet-controlled translator identity.

### Job Escrow

Stores the money and the canonical lifecycle of a job:

- Job ID
- Client address
- Translator ID or translator wallet
- USDC amount
- Job terms hash
- Status: funded, submitted, accepted, disputed, resolved, canceled
- Acceptance timestamp
- Payment release transaction
- Dispute outcome, when applicable

The client deposits USDC into escrow when creating or awarding a job. When the client accepts the translation, the escrow releases payment to the translator. Job terms and deliverables should not be stored directly on-chain; the contract stores hashes or content-addressed references so the parties can later prove which terms were agreed without exposing private work.

The escrow emits events for:

- Job funded
- Translator assigned
- Work submitted
- Job accepted
- Payment released
- Dispute opened
- Dispute resolved

These events are the main public audit trail for completed jobs and disputes.

### Credential Attestation Registry

Stores or references attestations about translator credentials:

- Attestation ID
- Translator ID or wallet subject
- Credential type, for example `ATA-certified`, `EN->ES legal`, `medical translation`
- Issuer address or issuer DID
- Issued timestamp
- Expiration timestamp, if any
- Revocation status
- Hash of the credential document
- Optional schema ID

This can be implemented directly or by using an attestation protocol such as EAS-style schemas. The important property is that credential attestations are independently verifiable from chain data and issuer signatures.

Only credential proofs or hashes belong on-chain. The full certificate, transcript, or private supporting documents should remain off-chain with the translator or issuer.

### Reputation Checkpoints

The core product ranking should not be on-chain, but the platform may periodically publish optional checkpoint roots for reputation inputs:

- Completed job feature root
- Credential feature root
- Feedback aggregate root
- Ranking config version hash
- Timestamped snapshot ID

These checkpoints are useful for auditability, appeals, and debugging, but search must not require contract migrations when the formula changes. A checkpoint commits to a snapshot, not to permanent ranking logic.

## Off-Chain Data

### Application Database

Stores mutable marketplace data:

- Translator biographies
- Work samples
- Portfolio links
- Language pairs
- Availability
- Rates
- Client messages
- Raw private feedback
- Internal moderation notes
- Search tuning metadata

Private client feedback stays off-chain. The search system can use aggregate features from feedback, but raw comments and client identities should not be exposed publicly or written to contracts.

### Object Storage

Stores larger documents:

- Work samples
- Translation deliverables
- Credential PDFs or images
- Profile media
- Job briefs

Objects should be addressed by stable hashes where verification matters. Sensitive objects should be encrypted and access-controlled. Public work samples can use ordinary CDN storage, IPFS, or another content-addressed system depending on product needs.

### Indexer

An indexer reads contract events and builds queryable tables for:

- Completed jobs per translator
- Total paid volume
- Dispute count and dispute rate
- Acceptance timestamps
- Payment release history
- Credential attestations and revocations
- Wallet-to-translator mappings

The indexer is an optimization. It should be rebuildable from chain data.

## Search Screen Reads

The translator search screen reads from a search API backed by the application database, feature store, and search index.

For each result, the screen can display:

- Name or display handle
- Biography summary
- Language pairs
- Credentials
- Work sample previews
- Completed job count
- Dispute indicator or dispute rate band
- Response time band
- Feedback aggregate, such as rating or satisfaction band
- Verification badge for on-chain completed jobs and attestations
- Ranking explanation, such as "strong EN->ES legal credentials" or "high completion history"

The screen should not call contracts directly for every search result. That would be slow, expensive, and difficult to tune. Instead, the search API returns indexed and precomputed data, including verification metadata produced by the indexer.

When a user opens a translator profile, the UI can offer a "verify" view that links to:

- The translator registry record
- Completed job escrow events
- Credential attestations
- Snapshot receipts or Merkle proofs, if used
- Issuer information for credential verification

## Ranking Production

Ranking is produced off-chain by a ranking service.

Inputs include:

- Completed jobs from indexed escrow events
- Dispute count, dispute rate, and dispute outcomes
- Median or recent response time from application events
- Credential count, type, issuer quality, expiration, and revocation status
- Private feedback aggregates
- Language-pair match
- Domain specialization match
- Availability and recent activity
- Marketplace safety signals

The formula should be versioned:

- `rankingConfigVersion`
- Feature list
- Weights
- Eligibility filters
- Tie-breakers
- Experiment flags
- Rollout percentage

Weekly tuning should be a config or model deployment, not a contract deployment. Each search response should include the ranking version used, and internal logs should record the feature vector and score components for debugging and appeals.

Example pipeline:

1. Contract indexer rebuilds durable facts from chain events.
2. Application services compute product facts such as response time and feedback aggregates.
3. Feature store materializes normalized features per translator and language pair.
4. Ranking service applies the active versioned formula.
5. Search index stores ranked candidates and enough fields to render result cards quickly.
6. Search API returns results with score explanations and verification badges.

Private feedback should be converted into privacy-preserving features before ranking, such as recent satisfaction score, repeat-client rate, or complaint rate. Raw feedback text should not be sent to the search screen.

## Verification Model

A translator can prove completed jobs without the search API because completed work is represented by escrow contract state and events.

Useful proof bundle:

- Translator registry record proving wallet ownership of `translatorId`
- Signed message from the current translator wallet
- Job escrow addresses and job IDs
- On-chain events showing assignment, acceptance, and payment release
- Transaction hashes for USDC release
- Job terms hash, if the translator needs to prove the completed work matched a specific agreement

A translator can prove credential attestations without the search API because credentials are anchored in the attestation registry.

Useful proof bundle:

- Attestation ID
- Subject translator ID or wallet
- Issuer address or DID
- Credential schema
- Credential document hash
- Issuer signature or on-chain attestation event
- Revocation and expiration status

The product can make this easy by letting translators download a portable verification packet containing job IDs, transaction hashes, attestation IDs, document hashes, and optional Merkle proofs. A third party can verify the packet with a chain RPC provider, block explorer, or local indexer.

## Why This Avoids Contract Migrations

Contracts store stable facts:

- Who controls a translator identity
- Which jobs were funded
- Which jobs were accepted
- Which payments were released
- Which disputes happened
- Which credentials were attested or revoked

Contracts do not store unstable product judgments:

- Search score
- Ranking weights
- Feedback weighting
- Credential importance
- Response-time thresholds
- Experiment assignments
- UI labels

Because ranking is generated off-chain from versioned configurations, the marketplace can tune search weekly without changing contracts. The contracts remain a durable source of proof, while the application layer remains free to iterate on ranking, presentation, moderation, and user experience.

## Recommended Boundary

Use contracts for money movement and independently verifiable claims. Use off-chain systems for rich marketplace behavior.

This gives translators portable proof of completed jobs and credentials, gives clients fast and useful search, protects private feedback, and keeps product iteration out of the migration path.
