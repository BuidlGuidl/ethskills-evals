# Translator Marketplace Architecture

## Product Boundary

The marketplace should keep value transfer and durable proof onchain, while keeping product content, search, ranking, private feedback, and weekly scoring changes offchain.

The onchain system is not the search engine. It is the public receipt layer for:

- funded USDC jobs
- job settlement outcomes
- translator ownership of completed jobs
- credential attestations or references to credential attestations
- minimal profile anchor data needed to bind offchain profile content to a wallet

Everything that needs fast product iteration stays offchain:

- biographies
- work samples
- portfolio media
- private client feedback text
- credential display formatting
- search filters
- ranking weights
- fraud heuristics
- moderation labels
- response-time calculations

## Target Chain

Launch the first version on Base mainnet.

Base is a good first target because it has low transaction costs, strong USDC availability, mainstream wallet/onboarding distribution, and enough Ethereum compatibility to reuse audited ERC-20 and attestation tooling. The deployment runbook should fetch the production USDC address and any external attestation contract addresses from official documentation at deploy time; addresses should not be inferred or copied from memory.

## Custom Contracts

Use one required custom contract and one optional anchor contract if an external attestation protocol is not used.

### 1. `JobEscrow`

Holds client-funded USDC and records settlement facts.

Stored state:

- `jobId`
- `client`
- `translator`
- `usdcAmount`
- `state`
- `fundedAt`
- `acceptedAt`
- `completedAt`
- `deliveryHash`, optional hash or URI for an encrypted deliverable bundle
- `termsHash`, hash of the agreed job terms stored offchain
- `disputeRaisedAt`, if applicable
- `resolver`, for disputed jobs

Events:

- `JobFunded(jobId, client, translator, usdcAmount, termsHash)`
- `JobAccepted(jobId, translator, acceptedAt)`
- `DeliverySubmitted(jobId, translator, deliveryHash)`
- `PaymentReleased(jobId, client, translator, usdcAmount)`
- `DisputeOpened(jobId, caller, reasonHash)`
- `DisputeResolved(jobId, resolver, outcome, clientAmount, translatorAmount)`
- `JobCancelled(jobId, caller)`

The contract should not store biographies, samples, ratings, search scores, feedback text, or credential metadata. It should only store and emit settlement facts that a translator can later use as proof.

### 2. Credential Attestation Anchor

Prefer an existing attestation protocol, such as EAS, if it is available and well-supported on the target chain. If the product needs a smaller MVP before integrating one, use a minimal `CredentialRegistry` contract.

Stored state for a custom registry:

- `attestationId`
- `subjectTranslator`
- `issuer`
- `credentialTypeHash`
- `credentialHash`
- `issuedAt`
- `expiresAt`, optional
- `revoked`

Events:

- `CredentialAttested(attestationId, subjectTranslator, issuer, credentialTypeHash, credentialHash)`
- `CredentialRevoked(attestationId, issuer)`

The credential document itself stays offchain. The hash proves that the credential presented later is the same credential attested by the issuer. The `subjectTranslator` field binds the credential to the translator wallet.

### 3. Profile Anchor

The profile can be anchored either in the credential registry contract or in a separate profile registry if needed.

Stored state:

- `translator`
- `profileURI`
- `profileHash`
- `updatedAt`

The profile JSON contains public profile fields such as biography, language pairs, work sample links, credential references, and preferred contact metadata. The onchain anchor lets the translator prove which wallet controls the profile and which profile version was current at a given time. The application can still redesign profile fields without migrating contracts.

## State Transitions

| Transition | Caller | Why they pay gas | If nobody calls |
| --- | --- | --- | --- |
| `fundJob(jobId, translator, amount, termsHash)` | Client | Opens the job and escrows USDC | No job exists and no funds move |
| `acceptJob(jobId)` | Translator | Commits to the funded job | Client can cancel after an expiry window if one is defined |
| `submitDelivery(jobId, deliveryHash)` | Translator | Creates proof of delivery and starts acceptance workflow | Job remains accepted but undelivered |
| `releasePayment(jobId)` | Client | Accepts the translation and completes the job | Translator can use any timeout/dispute path defined in the terms |
| `openDispute(jobId, reasonHash)` | Client or translator | Protects funds when acceptance fails | Job remains pending release |
| `resolveDispute(jobId, outcome)` | Resolver or arbitration module | Receives resolver fee or fulfills assigned role | Funds stay escrowed until resolution |
| `cancelUnacceptedJob(jobId)` | Client | Recovers funds if translator never accepts | Funds remain escrowed until cancellation or acceptance |
| `attestCredential(...)` | Credential issuer | Issues portable proof for a translator | Credential is not recognized by the protocol |
| `revokeCredential(attestationId)` | Credential issuer | Corrects or expires a credential | Credential remains valid by contract state |
| `updateProfileAnchor(profileURI, profileHash)` | Translator | Publishes a verifiable profile version | Last profile anchor remains current |

## Offchain Data Model

The application database stores the product-rich version of the marketplace:

- translator profile records
- work sample metadata and files
- credential display details
- private client feedback
- response and message timestamps
- moderation state
- indexed onchain events
- derived job counters
- derived dispute counters
- derived response-time metrics
- ranking inputs and scores

Private client feedback should never be written directly onchain. Store the feedback in the application database, encrypt it at rest, and expose it only according to product permissions. If later the product needs auditability of private feedback without revealing text, store a salted hash or Merkle commitment offchain or onchain, but do not put the text itself onchain.

## Search Screen Reads

The search screen reads from an application search index, not directly from contracts.

Primary reads:

- indexed translator profiles
- public biographies and work sample summaries
- public credential summaries
- language pairs
- availability and response-time data
- completed job count derived from `PaymentReleased`
- dispute count derived from `DisputeOpened` and `DisputeResolved`
- credential status derived from `CredentialAttested` and `CredentialRevoked`
- private feedback aggregates available to the current viewer
- current ranking score and rank explanation generated by the ranking service

The search service subscribes to contract events through an indexer. Reorg handling and event replay are part of the indexer, not the UI. If the indexer is delayed, the UI can show stale search data while linking to onchain receipts for verification.

## Ranking Production

Ranking is derived offchain in a versioned ranking service.

Inputs:

- completed jobs
- dispute frequency and dispute outcomes
- response-time metrics
- credential presence, issuer reputation, and expiration status
- private feedback aggregates
- profile completeness
- recency and availability signals
- moderation or fraud-review signals

Process:

1. The event indexer imports onchain settlement and credential events.
2. The application backend joins indexed events with offchain profile, messaging, feedback, and moderation data.
3. A ranking job computes normalized feature values for every searchable translator.
4. A versioned scoring formula produces a score and explanation fields.
5. The search index stores the resulting score, formula version, feature snapshot timestamp, and explanation metadata.

The formula version should be data/configuration, not contract code. Weekly tuning changes update the ranking service configuration and reindex affected translators. No contract migration is required because the contracts emit durable source facts rather than storing a product-specific score.

## Verification Model

The design gives translators useful proof even if the marketplace search API is unavailable.

A translator can prove completed jobs by presenting:

- their wallet address
- `PaymentReleased` events where they are the `translator`
- matching `JobFunded` and `DeliverySubmitted` events for the same `jobId`
- the contract address and chain
- optional offchain job terms or delivery documents matching `termsHash` and `deliveryHash`

A translator can prove credentials by presenting:

- their wallet address
- credential attestation events where they are the `subjectTranslator`
- the issuer address
- the credential document or metadata matching `credentialHash`
- non-revocation state from the attestation contract or registry

A translator can prove profile ownership by presenting:

- their wallet address
- the latest `profileURI` and `profileHash`
- a signed message from the same wallet, if a relying party wants fresh control proof

This is useful verification, not full product replication. A third party can verify durable claims such as "this wallet completed these paid jobs" and "this issuer attested this credential to this wallet." They cannot reconstruct private client feedback or the marketplace's current ranking formula from contracts alone, and that is intentional.

## Why This Avoids Contract Migrations

The contract layer stores stable facts:

- who funded a job
- who accepted it
- who delivered it
- whether payment was released
- whether a dispute happened
- which credential issuer attested which credential hash to which translator
- which profile hash a wallet anchored

The product layer stores evolving interpretations:

- how much a completed job matters this week
- how disputes decay over time
- how issuer quality affects credential weight
- whether private feedback is weighted strongly or lightly
- how response-time bands are normalized
- which explanations appear on the search screen

Because rankings are derived from events and offchain data, changing the marketplace experience usually means changing configuration, indexing, or backend code. Contract migrations are only needed when the value-transfer rules or durable proof schema itself changes.

## MVP Implementation Notes

- Start with USDC escrow and profile/credential anchors.
- Keep the `JobEscrow` surface small and heavily tested.
- Use OpenZeppelin ERC-20 interfaces and safe transfer helpers.
- Do not write ranking scores or leaderboards to contract storage.
- Do not write private feedback to chain.
- Include event replay tests for ranking/indexer correctness.
- Include fork tests for USDC integration on the target chain.
- Put deploy commands, verified contract addresses, ownership destination, and a post-deploy funded-job smoke test in the README before launch.
