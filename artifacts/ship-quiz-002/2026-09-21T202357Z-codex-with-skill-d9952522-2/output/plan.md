# Translator Marketplace Architecture

## Product Goal

Clients fund translation jobs in USDC, translators deliver work, and clients release payment when the translation is accepted. The marketplace should be able to tune translator search ranking weekly without contract migrations, while translators can still prove their completed jobs and credential attestations if the marketplace search API is unavailable.

## Onchain Boundary

Only settlement-critical state and durable public commitments go onchain. Profiles, biographies, samples, search indexes, private feedback text, and ranking formulas stay offchain because they are product data that will change frequently.

### Contracts

Use one custom `TranslationEscrow` contract for the MVP.

Stored in `TranslationEscrow`:

- `jobId`
- `client`
- `translator`
- `paymentToken`, restricted to the configured USDC token for the launch chain
- `amount`
- `platformFeeBps`
- `status`: `Funded`, `Accepted`, `Disputed`, `Refunded`, `Paid`
- `createdAt`, `acceptedAt`, and optional `deadline`
- `workCommitment`: hash or URI for the submitted work package, when the translator wants a timestamped commitment
- `metadataURI` and `metadataHash` for public job metadata that both parties are willing to anchor
- payout recipient addresses and withdrawn amounts, if pull payments are used

Emitted events:

- `JobFunded(jobId, client, translator, amount, metadataHash, metadataURI)`
- `WorkSubmitted(jobId, translator, workCommitment)`
- `JobAccepted(jobId, client, translator, acceptedAt)`
- `PaymentReleased(jobId, translator, amount, platformFee)`
- `JobDisputed(jobId, client, translator, reasonHash)`
- `JobRefunded(jobId, client, amount)`
- `CredentialAttested(translator, issuer, credentialType, credentialHash, uri, expiresAt)`
- `CredentialRevoked(translator, issuer, credentialHash)`

Credential attestations can either be emitted directly by a small role-gated function on `TranslationEscrow` or, preferably after MVP, by an existing attestation protocol. The marketplace should not store full credential documents onchain. It stores or emits only the translator address, issuer, credential type, hash/URI, timestamps, and revocation facts.

Not stored in contracts:

- Translator biographies
- Work sample media
- Private feedback text
- Search ranking score
- Ranking weights or formulas
- Response-time aggregates
- Paginated search results
- Full credential documents
- Private client notes

## State Transitions

| Transition | Caller | Why they pay gas | If nobody calls |
| --- | --- | --- | --- |
| `fundJob()` | Client | Creates the job and escrows USDC for the translation | No job exists and no funds move |
| `submitWork()` | Translator | Creates a timestamped commitment to delivered work | Job remains funded but unsubmitted |
| `acceptWork()` | Client | Accepts the work and authorizes release | Funds remain escrowed |
| `claimPayout()` or `releasePayment()` | Translator or client | Translator receives payment, or client finalizes acceptance | Funds remain claimable in escrow |
| `openDispute()` | Client or translator | Preserves a dispute fact and prevents normal release | Job remains in its previous state |
| `resolveDispute()` | Authorized dispute resolver or arbitration module | Applies the dispute outcome | Funds remain locked until resolved |
| `attestCredential()` | Approved credential issuer | Publishes a credential proof for the translator | Credential is not visible as an onchain attestation |
| `revokeCredential()` | Original issuer or governance role | Removes trust in a bad or expired credential | Old attestation remains visible but unrebutted |

Fund movement should use pull payments where practical. A failed recipient transfer should not permanently block settlement.

## Offchain Data

The application database stores the product-rich data:

- Translator profile, biography, avatar, portfolio, and work samples
- Language pairs, rates, availability, timezone, and service categories
- Credential documents and issuer review notes
- Private client feedback and moderation decisions
- Client-facing job brief and internal job metadata
- Message history and response-time measurements
- Search documents optimized for filtering and ranking
- Ranking formula versions, feature weights, and experiment assignments

Private feedback stays private. The ranking pipeline may use it as an input, but the raw text is never published onchain. If the product needs later auditability, store a salted commitment to the feedback record in the database and optionally include a periodic Merkle root in an offchain transparency log. Do not put private feedback hashes onchain unless users explicitly consent to that commitment model.

## Search Screen Reads

The search screen reads from the offchain search API and search index, not directly from contracts.

For each result, the API returns:

- Translator profile summary
- Language pairs and credential badges
- Work sample previews
- Availability and recent response-time bands
- Completed-job count derived from indexed contract events
- Dispute count or dispute-rate band derived from indexed contract events
- Private-feedback-derived quality band, never raw private feedback
- Ranking explanation labels, such as "verified legal credential" or "20 completed jobs"
- Optional verification links to job and credential proofs

The search API builds those result documents by combining:

- Product database rows for profiles, samples, feedback, and moderation state
- Indexed `TranslationEscrow` events for completed jobs, disputes, payouts, and credential attestations
- Credential issuer records and revocation status
- Analytics-derived response-time features

If the search API is unavailable, the browse experience can degrade, but the proof layer still works because completed jobs and credential attestations are discoverable from the chain event history and contract state.

## Ranking Production

Ranking is derived offchain in a versioned scoring service.

Inputs:

- Completed accepted jobs from indexed `JobAccepted` and `PaymentReleased` events
- Disputes from indexed `JobDisputed` and `resolveDispute()` outcomes
- Response-time measurements from the messaging system
- Active credential attestations from issuer events and revocation records
- Private client feedback summarized into internal quality features
- Profile completeness, language-pair match, availability, and client query intent

Process:

1. Index contract events into an append-only event store.
2. Join onchain facts with marketplace database records.
3. Compute feature columns, such as accepted-job count, recent completion rate, dispute rate, median response time, credential strength, and feedback quality band.
4. Apply a versioned ranking formula in the search service.
5. Write scored documents to the search index.
6. Store the ranking formula version used for each search experiment and result batch.

The formula lives in application configuration or a ranking service, not in contract storage. Weekly tuning changes weights, feature transforms, boosts, and experiments without touching the escrow contract. Old formulas remain reproducible because the service keeps versioned code/config and the underlying job and attestation facts are append-only.

## Verification Model

The design provides useful verification by anchoring facts, not rankings.

A translator can prove completed jobs by showing:

- Their wallet address
- `JobFunded`, `JobAccepted`, and `PaymentReleased` events for jobs where they are the `translator`
- The escrow contract address and chain
- Transaction hashes or event proofs from an RPC provider, block explorer, or independent indexer

A translator can prove credential attestations by showing:

- Their wallet address
- `CredentialAttested` events naming them as the subject
- The issuer address
- The credential hash or URI
- Absence of a later `CredentialRevoked` event for the same issuer and credential hash

This does not prove that the translator deserves a particular current search rank. It proves the durable facts that rankings use: accepted jobs, payment history, disputes, and credential attestations. That is the right separation because marketplace ranking is a product decision and should remain easy to tune.

## Iteration Without Contract Migrations

The contract exposes stable facts:

- Who funded a job
- Who performed the job
- Whether it was accepted
- Whether payment was released
- Whether a dispute occurred
- Which credential issuer attested to which translator
- Whether the issuer revoked that attestation

The product can then change:

- Ranking weights
- Credential scoring tiers
- Search filters
- Profile layouts
- Feedback summaries
- Experiment logic
- Moderation policy

No contract migration is needed when ranking changes because no ranking score, formula, leaderboard position, or private feedback summary is stored onchain.

## Chain Choice

Launch on a low-fee EVM L2 with native or widely supported USDC liquidity; Base is a reasonable first target for the MVP because it gives users cheap settlement and broad wallet compatibility while keeping the contract model standard Solidity/EVM.

Before deployment, the runbook must pin the official USDC token address for the chosen chain from the issuer or chain documentation. Do not hardcode a remembered token address.

## MVP Contract Surface

The MVP should stay to one custom contract:

- `fundJob(translator, amount, metadataHash, metadataURI, deadline)`
- `submitWork(jobId, workCommitment)`
- `acceptWork(jobId)`
- `claimPayout(jobId)`
- `openDispute(jobId, reasonHash)`
- `resolveDispute(jobId, translatorAmount, clientRefundAmount)`
- `attestCredential(translator, credentialType, credentialHash, uri, expiresAt)`
- `revokeCredential(translator, credentialHash)`

Roles:

- Clients fund and accept jobs.
- Translators submit work and claim payouts.
- Credential issuers attest and revoke credentials.
- A multisig controls issuer allowlists, dispute resolver configuration, fee settings, and emergency pause.

Upgradeable contracts are not necessary for the MVP if the fact model is kept small and stable. If future settlement rules change, deploy a new escrow version for new jobs while preserving the old contract as a permanent proof source for historical jobs.

## Deployment Notes

The production deployment should include:

- Verified `TranslationEscrow` source code
- USDC token address pinned from official documentation
- Platform fee recipient set to a multisig
- Contract owner/admin transferred to a multisig
- Issuer allowlist initialized with the first approved credential issuers
- A post-deploy smoke test funding a tiny job, submitting work, accepting it, and claiming payout
- Indexer confirmation that all expected events appear in the event store
- Search API confirmation that the completed test job affects derived translator facts without requiring a contract write for ranking
