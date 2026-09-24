# Architecture Plan: Translator Marketplace

## Product Goal

The marketplace lets clients fund translation jobs in USDC, assign them to independent translators, and release payment when the translation is accepted. Translators need rich profiles and search ranking, but they also need portable evidence of completed jobs and credential attestations even if the marketplace search API is down.

The core design is:

- Put escrowed value, job completion facts, disputes, and credential attestations onchain or in durable attestation systems.
- Keep biographies, work samples, private feedback, search filters, and ranking formulas offchain.
- Build the search product from indexed evidence, not from contract-held ranking logic.
- Version ranking formulas in the backend so they can change weekly without contract migrations.

## Chain And Assets

Deploy on Base for the MVP. It has cheap transactions, strong USDC support, account abstraction friendliness, and consumer onboarding advantages. The same contract shape could later be deployed on another EVM chain if the market requires it.

Payments use native USDC on the selected chain. The escrow contract must use `SafeERC20` and must not assume 18 decimals; USDC uses 6 decimals.

## Onchain Components

### `JobEscrow`

This is the only custom contract that must custody value.

It stores the minimum state needed for payment and verifiable job history:

- `jobId`
- `client`
- `translator`
- `usdcAmount`
- `status`: funded, submitted, accepted, disputed, resolved, cancelled
- `createdAt`
- `acceptedAt`, when applicable
- content or agreement commitment hashes, such as `jobSpecHash` and `deliverableHash`
- optional `metadataURI` pointing to IPFS or Arweave metadata for non-private job descriptors

It exposes functions such as:

- `createJob(translator, amount, jobSpecHash, metadataURI)`: called by the client after approving USDC.
- `submitJob(jobId, deliverableHash)`: called by the translator.
- `acceptJob(jobId)`: called by the client; releases USDC to the translator and records completion.
- `openDispute(jobId, reasonHash)`: called by either party while funds are escrowed.
- `resolveDispute(jobId, payoutToTranslator, payoutToClient, resolutionHash)`: called by an authorized arbitrator or dispute module.
- `cancelUnacceptedJob(jobId)`: limited cancellation path before work starts.

It emits events for every state transition:

- `JobCreated`
- `JobSubmitted`
- `JobAccepted`
- `JobDisputed`
- `JobResolved`
- `JobCancelled`

The events are as important as storage because the search index, profile pages, and external verification tools consume them. A translator can prove completed jobs by showing the `JobAccepted` events where their wallet is the `translator`, backed by the transaction logs onchain.

### Credential Attestations

Use an attestation protocol such as Ethereum Attestation Service instead of building a bespoke credential contract. Credential issuers attest to a translator address using schemas such as:

- language pair
- certification type
- issuer identity
- issued date
- expiration date, if any
- credential metadata hash
- revocation status

The marketplace backend decides which issuers and schema versions count for ranking. The attestations themselves are portable and verifiable without the marketplace API.

If the product needs a lightweight custom contract later, add a `TrustedIssuerRegistry` that stores issuer addresses and emits issuer add/remove events. Do not put ranking weights or credential scoring rules in it.

## Offchain Data

The product database stores data that is useful for the marketplace but inappropriate for contracts:

- translator biographies
- profile photos
- work samples
- language descriptions and portfolio organization
- availability and rates
- client-facing preferences
- private client feedback
- support notes and moderation state
- search analytics
- ranking configuration versions

Large public assets, such as work samples the translator wants to make durable, can live on IPFS or Arweave with hashes referenced from the profile database. Private feedback should remain in the application database, encrypted at rest, with access controlled by backend policy.

## Indexing Layer

An indexer reads:

- `JobEscrow` events
- USDC transfer confirmations related to escrow actions
- EAS credential attestations and revocations
- optional issuer registry events

It materializes query-friendly tables:

- translator completed job count
- translator dispute count and dispute rate
- job volume in USDC
- average acceptance time
- credential list by translator
- credential revocation state
- per-client private feedback aggregates

The indexer output is evidence-derived. If the indexer is rebuilt from scratch, it can recover from chain logs and attestation data.

## Search Screen Reads

The search screen reads from the marketplace search API, not directly from contracts.

For each query, the search API returns:

- matching translator profiles from the product database
- public profile fields and work sample links
- derived job and credential features from the indexer
- private feedback aggregates that the current client is authorized to see
- current rank score
- rank explanation fields, such as completed jobs, credential matches, dispute rate, response-time band, and feedback band
- evidence references, including job IDs, transaction hashes, and credential attestation UIDs

The UI should show ranking signals without pretending they are all onchain. For example:

- completed jobs: verifiable onchain
- credentials: verifiable through attestations
- disputes: verifiable if they passed through escrow
- response time: marketplace-measured
- private feedback: marketplace-held and access-controlled

If the search API is unavailable, the normal search experience is unavailable, but the translator can still prove core facts using their wallet address, job IDs, transaction hashes, and credential attestation UIDs.

## Ranking Production

Ranking is an offchain service that combines indexed evidence and product data.

Inputs include:

- completed jobs from `JobAccepted` events
- disputes from `JobDisputed` and `JobResolved` events
- response time from marketplace messaging and job workflow timestamps
- credential attestations from EAS
- private client feedback from the application database
- filters such as language pair, domain, availability, price, and client requirements

The ranking service uses a versioned configuration, for example:

```json
{
  "version": "2026-09-21.1",
  "weights": {
    "completedJobs": 0.25,
    "disputeRate": -0.20,
    "responseTime": 0.15,
    "credentialMatch": 0.25,
    "privateFeedback": 0.15
  }
}
```

Each search response includes the ranking config version used. Weekly tuning is a backend config or model deployment, not a contract change.

For auditability, archive each ranking config and optional aggregate score snapshot to durable storage such as S3 with object lock, IPFS, or Arweave. The app can also sign ranking snapshots with a marketplace key. This makes ranking decisions inspectable without turning the ranking formula into immutable contract logic.

## Verification Model

The design provides useful verification through portable evidence:

- A completed job is proven by a `JobAccepted` event emitted by `JobEscrow` for a given `jobId`, `translator`, `client`, and `usdcAmount`.
- Payment is proven by the escrow transaction and USDC transfer logs.
- A dispute is proven by `JobDisputed` and `JobResolved` events.
- A credential is proven by an attestation UID, schema, issuer signature, subject translator address, and revocation state.
- A profile claim can reference these facts by job ID, transaction hash, and attestation UID.

This does not make every search signal trustless. Response time, private feedback, moderation, and ranking weights remain marketplace-controlled. The key property is that the durable professional record, completed paid work and credential attestations, does not depend on the search API being online.

## Why This Avoids Contract Migrations

Contracts store facts, not product opinions.

The escrow contract does not know how to rank translators. It only knows who funded a job, who performed it, whether payment was released, and whether a dispute occurred. Credential attestations store issuer claims, not marketplace scoring rules.

That separation lets the team iterate on:

- ranking weights
- credential issuer trust policy
- feedback aggregation
- search filters
- profile design
- fraud and moderation heuristics
- client-specific personalization

without redeploying escrow or migrating translator history. New ranking features can be added by extending the offchain index and search service. New credential types can be supported by accepting new attestation schemas. The onchain layer stays small, durable, and focused on value transfer and verifiable commitments.

