# Translator Marketplace Architecture

## Goal

Clients fund translation jobs in USDC, translators deliver work, and clients release payment after acceptance. The marketplace should be able to iterate quickly on profiles, search, and ranking, while translators retain durable proof of completed jobs and credential attestations even if the marketplace search API is unavailable.

The architecture keeps money movement and verification anchors onchain, and keeps product data, private feedback, search indexing, and ranking formulas offchain.

## Onchain Contracts

### 1. `TranslationEscrow`

One custom contract is enough for the MVP.

Stored state:

- `jobId`
- `client`
- `translator`
- `usdcAmount`
- `status`: `Funded`, `Accepted`, `Cancelled`, `Disputed`, `Resolved`
- `createdAt`
- `acceptedAt`
- `metadataHash`: hash of the job terms, language pair, due date, and any public job metadata the parties want to preserve
- `deliveryHash`: hash of the accepted delivery package or acceptance receipt, set when the job is accepted
- `disputeResolver`: address allowed to resolve disputes for that job

The contract does not store biographies, work samples, full translation files, private feedback, or rank scores.

Core functions:

- `createJob(translator, amount, metadataHash, disputeResolver)`: client transfers USDC into escrow and creates a funded job.
- `acceptJob(jobId, deliveryHash)`: client accepts the work, records the accepted delivery hash, and releases USDC to the translator.
- `cancelUnstartedJob(jobId)`: client and translator can cancel according to the agreed cancellation rules.
- `openDispute(jobId)`: client or translator marks the job as disputed.
- `resolveDispute(jobId, clientAmount, translatorAmount, resolutionHash)`: dispute resolver splits escrow and records a hash of the resolution record.

Events:

- `JobCreated(jobId, client, translator, amount, metadataHash)`
- `JobAccepted(jobId, client, translator, amount, deliveryHash)`
- `JobDisputed(jobId, client, translator)`
- `JobResolved(jobId, client, translator, clientAmount, translatorAmount, resolutionHash)`
- `JobCancelled(jobId, client, translator)`

These events are the durable public facts used to prove completed jobs and dispute history. The contract may store only the minimum state needed to prevent double payment and settle funds; indexers can reconstruct reputation facts from events.

### 2. Credential Attestations

Use an existing attestation protocol rather than a custom credential registry. For example, issue credentials through EAS or another audited attestation system on the selected chain.

Credential attestation fields:

- subject: translator wallet or decentralized identifier controlled by the translator
- issuer: credential provider, school, certification body, or marketplace verifier
- credential type: language pair, certification, exam result, notarized identity, specialization
- credential hash or URI: hash/URI for the underlying evidence, if public or selectively disclosable
- expiration date, when applicable
- revocation status, provided by the attestation protocol

The marketplace should not make the search ranking depend on a marketplace-owned credential table as the only source of truth. It can cache attestations for speed, but the translator should be able to point to the original attestation transaction or UID independently.

## Offchain Data

Stored in the product database/object storage:

- Translator biography
- Portfolio/work samples
- Profile photo and media
- Language descriptions and rates
- Availability
- Response-time measurements
- Private client feedback
- Feedback moderation state
- Search documents
- Ranking feature snapshots
- Weekly ranking formula/config versions
- Private job files and translation deliverables

For data that needs later verification, store a hash onchain or inside an attestation. For data that is private or likely to change often, keep it offchain and expose only a commitment when useful.

Examples:

- A public credential certificate can be referenced by attestation URI.
- A private client review stays in the marketplace database, but can be included in an aggregated feedback snapshot signed by the marketplace.
- A delivered translation file stays private, while `deliveryHash` proves which accepted artifact the parties agreed was final.

## Search Screen Reads

The search screen reads from a search index, not directly from contracts.

The index contains:

- Public profile fields: name, biography, languages, specialties, location/time zone, availability, rate bands
- Work samples and portfolio metadata
- Credential summaries derived from attestation events and issuer allowlists
- Completed job counts derived from `JobAccepted` events
- Dispute counts and outcomes derived from `JobDisputed` and `JobResolved` events
- Response-time metrics derived from marketplace messaging/job workflow timestamps
- Feedback aggregates derived from private feedback, such as average rating, repeat-client rate, and recent satisfaction buckets
- Rank score and rank explanation for the current formula version

The UI can show both product data and verification affordances:

- "Completed jobs: 42" with a link to the onchain event-derived job list
- "Credential verified by X" with a link to the attestation
- "Feedback score" without exposing private client comments
- "Ranking formula version: 2026-09-21" for internal/debug transparency, if desired

If the search API is unavailable, browsing and ranking are impaired, but a translator can still prove job completions and credential attestations from the chain and attestation protocol.

## Ranking Production

Ranking is derived offchain in a versioned ranking service.

Input features:

- Completed jobs: count, recency, repeat clients, job size bands
- Disputes: opened disputes, resolved outcomes, recency, severity
- Response time: median first response, acceptance speed, recent activity
- Credentials: issuer trust tier, credential type, language pair relevance, expiration/revocation state
- Feedback: private rating aggregates, repeat-client signals, moderation-adjusted review quality
- Search relevance: requested language pair, domain specialty, availability, price/rate fit

Process:

1. Indexer consumes `TranslationEscrow` events and credential attestation events.
2. Application services add offchain marketplace features such as response time and private feedback aggregates.
3. Ranking service computes scores using the active formula/config version.
4. Search index stores sortable score fields plus feature snapshots for explainability and debugging.
5. Weekly tuning changes update the ranking service/config and trigger reindexing. No contract migration is required.

The rank score itself is never written to the contract. Rankings are product opinions over verifiable and private inputs, not canonical blockchain state.

## Verification Model

The design provides useful verification through durable facts and portable commitments:

- Completed jobs are proven by `JobAccepted` events naming the translator, client, amount, and accepted delivery hash.
- Disputes are proven by `JobDisputed` and `JobResolved` events.
- Credential ownership is proven by third-party attestations naming the translator wallet or DID as the subject.
- Accepted deliverables can be matched to `deliveryHash` without publishing the content.
- Job terms can be matched to `metadataHash` when both parties choose to reveal the underlying terms.

A translator can export a proof bundle containing:

- Their wallet address or DID
- Signed wallet ownership message
- Job IDs and transaction/event references for accepted jobs
- Credential attestation UIDs
- Optional source documents whose hashes match onchain commitments
- Optional marketplace-signed feedback aggregate snapshot

This proof bundle remains useful even if the marketplace search API is down because the critical references resolve through the chain, the attestation protocol, and signed/hash-verifiable documents.

## Why This Does Not Block Product Iteration

The contract records facts, not product judgments.

Stable onchain facts:

- Who funded a job
- Which translator was assigned
- How much USDC was escrowed
- Whether the job was accepted, cancelled, disputed, or resolved
- Hashes of accepted terms, accepted delivery, or dispute resolution records
- Credential attestations from external issuers

Changeable offchain product logic:

- Profile design
- Search filters
- Ranking weights
- Credential issuer weighting
- Feedback weighting
- Response-time definitions
- Abuse and moderation heuristics
- Search result explanations

Because the ranking service consumes event-derived facts and offchain product data, weekly formula changes require only service/config updates and reindexing. Contracts need migrations only if the money movement or durable proof model changes.

## State Transitions

| Transition | Caller | Why they pay gas | If nobody calls |
| --- | --- | --- | --- |
| `createJob` | Client | Starts the job and funds escrow with USDC | No job is created and no funds move |
| `acceptJob` | Client | Accepts work and releases payment | Funds remain in escrow until acceptance, cancellation, or dispute resolution |
| `cancelUnstartedJob` | Client and/or translator, depending on cancellation rules | Recovers funds or exits a stale job | Funds remain escrowed until another valid transition |
| `openDispute` | Client or translator | Preserves their claim when acceptance fails | Job remains funded and unresolved |
| `resolveDispute` | Dispute resolver | Completes the dispute process and releases escrow | Funds remain escrowed; parties can escalate operationally |

## First Deployment Target

Base is a good first target for the MVP because it has low transaction costs, strong USDC usage, and consumer-friendly wallet/onramp distribution. Before deployment, verify the current official USDC token address from Circle/Base documentation and use only that verified address in the deployment configuration.

The MVP should deploy:

- `TranslationEscrow`
- No custom ranking contract
- No custom credential registry unless the selected attestation protocol cannot support the needed schema

## Minimal Launch Checklist

- Contract tests cover funding, acceptance, cancellation, dispute opening, dispute resolution, and USDC transfer failure cases.
- Fork test verifies integration with the selected USDC token and attestation protocol.
- Indexer test reconstructs completed job and dispute history from events.
- Ranking tests snapshot the current formula and verify formula-versioned reindexing.
- Export test builds a translator proof bundle from chain events, attestations, and signed/hash-matched documents.
- Deployment runbook names the chain, verified USDC address, owner/multisig, deploy command, verification command, and one post-deploy funded-job smoke test.
