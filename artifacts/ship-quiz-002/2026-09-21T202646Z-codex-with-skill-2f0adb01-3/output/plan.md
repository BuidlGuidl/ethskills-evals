# Architecture Plan

## Product Boundary

The marketplace should use contracts for escrow, settlement, and durable proof. Profiles, search, ranking, private feedback, work samples, and weekly ranking changes should stay off-chain. This keeps money movement and verifiable claims trust-minimized while preserving the ability to iterate on the product without contract migrations.

Recommended MVP contract count: one marketplace escrow contract plus either an external attestation protocol such as EAS or one small credential registry contract if EAS is not available on the chosen chain.

Base is a good launch chain for this product because it has USDC liquidity, low transaction costs, and consumer-friendly wallet onboarding. The same architecture also works on another EVM chain if distribution or compliance needs change.

## What Is Stored In Contracts

### TranslationJobEscrow

The escrow contract holds USDC for each funded job and records the minimum facts needed to prove job ownership and completion.

Stored per job:

- `jobId`: deterministic `bytes32` identifier created from platform job id, client, translator, and nonce.
- `client`: wallet that funded the job.
- `translator`: wallet assigned to the job.
- `usdcAmount`: funded payment amount.
- `status`: funded, submitted, accepted, disputed, resolved, canceled.
- `termsHash`: hash of the off-chain job terms, source material manifest, deadlines, and acceptance criteria.
- `submissionHash`: hash or content-addressed pointer for the encrypted translation deliverable.
- `createdAt`, `submittedAt`, `acceptedAt`: timestamps needed for proof and metrics.
- `disputeOutcome`: compact result only, not the dispute evidence.

The contract should not store translation text, client documents, biographies, feedback text, profile data, ranking scores, or search metadata.

Core calls:

- `fundJob(jobId, translator, amount, termsHash)`: called by the client after approving USDC. Transfers USDC into escrow and emits `JobFunded`.
- `submitWork(jobId, submissionHash)`: called by the assigned translator. Emits `WorkSubmitted`.
- `acceptWork(jobId)`: called by the client. Marks the job accepted, releases USDC to the translator, and emits `JobAccepted` and `PaymentReleased`.
- `openDispute(jobId, evidenceHash)`: called by client or translator before acceptance. Emits `JobDisputed`; evidence remains off-chain.
- `resolveDispute(jobId, translatorAmount, clientRefund, outcomeHash)`: called by the configured arbitrator or multisig. Releases funds according to the ruling and emits `DisputeResolved`.
- `cancelExpiredJob(jobId)`: callable under narrow timeout rules if work was never submitted.

Events are part of the verification surface. A translator can prove completed work by showing that a given `jobId` was assigned to their wallet and reached accepted or resolved-paid status on the escrow contract.

### Credential Attestations

Language credentials should be attestations about a translator wallet, not rows only in the marketplace database. Prefer an existing attestation protocol when possible.

Stored or referenced per credential attestation:

- `subject`: translator wallet.
- `issuer`: school, certification body, platform verifier, or approved credential issuer.
- `schemaId`: credential schema, such as language pair, proficiency level, sworn translator license, or domain specialization.
- `credentialHash`: hash of the credential document or verification payload.
- `metadataURI`: optional pointer to public metadata or encrypted document storage.
- `issuedAt`, `expiresAt`, `revoked`: validity fields.

Credential documents can remain private or selectively disclosed. The on-chain object only needs to prove that a recognized issuer made a claim about the translator wallet and whether that claim is still valid.

### Optional Commitments

If the product wants an audit trail for ranking snapshots, publish a daily or weekly Merkle root of signed scorecards to a cheap commitment contract or as an event on the escrow contract. This is optional because ranking itself is not the durable fact the translator needs to prove. The important durable facts are completed jobs and credential attestations.

## What The Search Screen Reads

The search screen reads from the application API, not directly from contracts on every page load.

Primary data sources:

- Application database: biographies, display names, language pairs, availability, rates, work samples, portfolio ordering, profile settings, private client feedback, and moderation state.
- Search index: denormalized translator documents optimized for filtering and ranking.
- Chain indexer: indexed escrow events and credential attestations, including completed job counts, disputed job counts, accepted job timestamps, paid volume, and credential validity.
- Object storage or IPFS/Arweave: public work samples and hashed credential metadata. Private files are encrypted and access-controlled.

Search result payload:

- Translator profile summary.
- Public work sample links.
- Verified credential summary and attestation ids.
- Completed job count and dispute rate derived from indexed escrow events.
- Response-time and availability metrics derived from off-chain application events.
- Private feedback aggregate, such as a normalized score or confidence bucket, without exposing the underlying comments.
- Current rank score, score breakdown, ranking formula version, feature snapshot timestamp, and platform signature over the scorecard.

The UI should show verification affordances next to claims that come from contracts: completed jobs link to the job proof, credentials link to the attestation proof, and paid/completed counts link to the indexed event list.

## How Ranking Is Produced

Ranking is an off-chain pipeline because the formula will change weekly and uses private or operational data that does not belong in a contract.

Pipeline:

1. The chain indexer consumes escrow and attestation events and writes canonical job and credential facts into the database.
2. The application event pipeline writes response-time metrics, message responsiveness, profile freshness, client feedback, moderation flags, and availability data.
3. A feature job normalizes those inputs into versioned features, for example completed jobs, accepted-job recency, dispute rate, credential strength, median response time, and private feedback aggregate.
4. A ranking service applies the active formula or model configuration. The formula has a `rankingVersion`, weights, feature transforms, and rollout metadata stored in configuration or a model registry.
5. The resulting scorecard is written to the search index and signed by the platform key. The signature covers translator id, wallet, feature snapshot hash, score, score breakdown, ranking version, and timestamp.
6. The search API returns ordered results from the search index.

Weekly tuning changes only the ranking configuration and the feature pipeline. It should not require a contract migration because contracts do not know about search weights, feature transforms, or profile presentation.

Private feedback is handled as an aggregate feature. Clients can leave confidential comments in the application, and the ranking service can use a bounded, normalized signal from that feedback. The raw text stays off-chain and access-controlled.

## Verification Model

A translator needs useful proof even if the search API is unavailable. They should be able to prove durable facts independently from the product backend.

Completed job proof:

- Translator controls the wallet by signing a message.
- The escrow contract shows `jobId`, translator wallet, funded amount, status, and accepted or resolved-paid completion.
- Events from the contract show the lifecycle from funding to release.
- The `termsHash` and `submissionHash` can be matched against off-chain documents if the translator and client choose to reveal them.

Credential proof:

- Translator controls the subject wallet.
- The attestation contract or EAS record shows issuer, subject, schema, credential hash, issue time, expiry, and revocation status.
- A verifier can check that the issuer is trusted for that credential type without needing the marketplace search API.

Profile binding:

- Each marketplace profile has a primary wallet.
- Wallet changes are recorded with signed messages from the old and new wallet, and optionally an on-chain account-link attestation.
- A translator can export a verification bundle containing profile id, wallet signature, completed job ids, credential attestation ids, and hashes of any selectively disclosed files.

What remains unavailable during a search outage:

- The current ranked search page.
- Private feedback text.
- The latest off-chain response-time metrics unless the platform publishes signed exports.

What remains verifiable during a search outage:

- The translator wallet.
- Completed paid jobs tied to that wallet.
- Credential attestations tied to that wallet.
- Any disclosed job terms, submissions, or credential documents whose hashes match on-chain records.

## Why This Avoids Contract Migrations

The contracts commit only to stable primitives: escrowed USDC, job lifecycle events, compact job hashes, credential attestations, and revocation status. Those facts are expected to remain meaningful for years.

The product can iterate on everything that changes often:

- Ranking weights and model versions.
- Search filters and sort modes.
- Profile fields and portfolio presentation.
- Feedback aggregation rules.
- Credential issuer trust lists.
- Fraud and moderation heuristics.

New ranking inputs can be added by extending the off-chain feature pipeline and search index. New credential types can be added by creating new attestation schemas or issuer policies. Neither requires migrating escrowed jobs or redeploying the marketplace contract.

This gives translators durable, portable proof of work and credentials while keeping the marketplace flexible enough to improve search quality every week.
