# Translator Marketplace Architecture

## Goals

The marketplace should let clients hire independent translators, escrow job funds in USDC, release payment after acceptance, and discover translators through a ranked search experience. The ranking formula will change often, so ranking logic must remain off-chain. At the same time, translators need durable proof that completed jobs and credential attestations belong to them even if the marketplace search API is down.

The design uses contracts for settlement, identity binding, attestations, and verifiable event history. Product data, search indexing, private feedback, and ranking live off-chain.

## On-Chain Contracts

### Translator Profile Registry

Stores the minimum durable identity binding for each translator:

- Translator wallet address.
- Optional profile handle or numeric profile id.
- Current profile metadata URI, such as IPFS, Arweave, or another content-addressed JSON document.
- Events when the translator updates their metadata URI.

The metadata document can contain public biography text, public work samples, public language pairs, and links to richer hosted media. The contract should not store long biography text, raw work samples, private feedback, or search-ranking fields.

The registry gives translators a stable on-chain anchor: "this wallet controls this translator profile, and this profile currently points to this signed/content-addressed metadata."

### Job Escrow

Stores payment and job state:

- Job id.
- Client address.
- Translator address.
- USDC token address.
- Funded amount.
- Job terms URI or terms hash.
- Status: funded, submitted, accepted, disputed, resolved, cancelled.
- Payment release and refund outcomes.

The escrow contract holds USDC while a job is active. The client funds the job, the translator performs the work, and payment is released to the translator when the client accepts or when a dispute resolution path awards payment.

The contract emits events for major state transitions:

- `JobCreated`
- `JobFunded`
- `TranslatorAssigned`
- `WorkSubmitted`
- `JobAccepted`
- `PaymentReleased`
- `DisputeOpened`
- `DisputeResolved`

Completed jobs are proven by the escrow state and event history. A translator can show that their wallet was assigned to a job and that the job reached accepted or resolved-paid status.

### Credential Attestations

Credentials should be represented as attestations, not as hard-coded marketplace fields. This can be implemented with a dedicated credential registry or a general attestation protocol.

Each attestation records:

- Issuer address.
- Subject translator address or profile id.
- Credential type, such as language pair, certification, native fluency, sworn translator status, or domain specialization.
- Credential metadata URI or hash.
- Issued timestamp.
- Expiration timestamp, if applicable.
- Revocation status.

Credential details can live in content-addressed metadata, while the contract stores enough information to verify issuer, subject, type, validity period, and revocation. The marketplace can add new credential categories later without migrating escrow or profile contracts.

### Optional Feedback Commitments

Private client feedback should not be published directly on-chain. If verifiability of aggregate feedback matters, store only periodic commitments:

- Ranking epoch id.
- Merkle root or hash commitment over feedback records included in that epoch.
- Signing key or service address that produced the commitment.

Raw feedback remains off-chain and access-controlled. A client or translator can later prove that a particular private feedback item was included in an aggregate score by presenting the record and Merkle proof to an authorized verifier, without revealing all feedback publicly.

This is optional because the strongest verification requirement is completed jobs and credential attestations, both of which are already directly verifiable on-chain.

## Off-Chain Data

The application database stores product data that needs privacy, iteration, moderation, or fast querying:

- Full translator biographies.
- Work samples and sample metadata.
- Searchable language pairs, domains, rates, availability, and location/time-zone preferences.
- Private client feedback text and ratings.
- Response-time measurements.
- Dispute summaries and internal moderation notes.
- Denormalized job statistics.
- Cached credential validity.
- Ranking feature snapshots and scores.

For public profile fields, the database can cache the metadata pointed to by the profile registry. The canonical proof remains the translator wallet and profile metadata URI on-chain, while the database provides fast reads and product-friendly search filters.

## Search Screen Reads

The search screen should not query contracts directly for every result. It reads from a search index built from both on-chain and off-chain sources.

For each translator result, the search index contains:

- Profile id and wallet address.
- Display name, biography preview, public language pairs, domains, availability, and work sample previews.
- Completed job count from indexed escrow events.
- Dispute count and dispute rate from escrow/dispute events plus moderation data.
- Median or percentile response time from application telemetry.
- Credential summary from indexed attestations.
- Feedback-derived score from private feedback aggregates.
- Current ranking score and optional component breakdown.
- Verification links or proof references for completed jobs and credentials.

The UI presents normal marketplace information first, then marks verifiable facts separately. For example:

- "42 completed jobs" links to an explorer view or internal proof page backed by escrow events.
- "ATA English-Spanish credential" links to the credential attestation and issuer metadata.
- "Private client feedback" is shown as an aggregate score or badge, not as raw private feedback.

If the search API is down, the rich discovery experience may be unavailable, but a translator can still prove completed jobs and credentials from the contracts and their content-addressed metadata.

## Indexing Pipeline

An indexing service subscribes to contract events and periodically reconciles against chain state:

1. Read profile registry events and current metadata URIs.
2. Read escrow job events and derive completed jobs, cancellations, disputes, and payouts per translator.
3. Read credential attestation events and revocation state.
4. Pull content-addressed public metadata and cache it.
5. Join on-chain facts with off-chain product data such as feedback, response time, availability, and moderation state.
6. Write normalized records to the application database.
7. Write denormalized search documents to the search engine.

The indexer should be replayable from chain genesis or from a trusted checkpoint. This makes the search index recoverable and prevents the database from becoming the only source of completed-job truth.

## Ranking Production

Ranking is produced off-chain by a versioned scoring service. Contracts do not know or enforce rank.

Inputs can include:

- Completed accepted jobs.
- Recent completed jobs.
- Dispute rate and unresolved dispute count.
- Median response time.
- Credential count, issuer trust tier, credential freshness, and credential match to the searched language pair.
- Private feedback aggregates.
- Search query relevance, such as language pair, domain, price, availability, and client preferences.

The ranking service runs on every index update and can also run batch jobs for weekly tuning. Each scoring run records:

- Formula version.
- Feature values used for each translator.
- Final score.
- Timestamp or ranking epoch.
- Experiment id, if applicable.

The search API reads ranked documents from the search engine. For transparency, the UI can show a lightweight explanation such as "strong match: certified Spanish legal translator, fast response time, 42 completed jobs." The explanation should be generated from the same feature snapshot used for ranking, not recomputed ad hoc in the frontend.

Because the formula lives in the ranking service, the team can adjust weights, add experiments, or introduce new features weekly without contract migrations. The only stable contract obligation is to emit durable facts that ranking can consume.

## Verification Model

The design separates verifiable claims from product ranking.

### Completed Jobs

A translator proves completed jobs by presenting:

- Their translator wallet address or profile id.
- Escrow contract address.
- Job ids.
- On-chain events or state showing the translator was assigned to each job.
- On-chain events or state showing each job was accepted or resolved with payment to the translator.

This proof does not depend on the marketplace search API. It can be checked through a block explorer, a local indexer, direct RPC reads, or an exported proof bundle.

### Credential Attestations

A translator proves credentials by presenting:

- The attestation id.
- Issuer address.
- Subject wallet/profile id.
- Credential metadata hash or URI.
- Validity and expiration fields.
- Non-revocation proof or current revocation state.

Clients can verify that the credential was issued by a recognized issuer and still applies to the translator's current profile.

### Profile Metadata

The profile registry proves which wallet controls a profile and which metadata URI the translator published. If a translator wants a portable profile page, they can export:

- Profile registry proof.
- Current profile metadata document.
- Completed job proof list.
- Credential attestation list.

This export remains useful even if the search API is unavailable.

## Privacy Boundaries

Do not put private feedback, private messages, unpublished work files, or client-sensitive job content on-chain. Store hashes or content-addressed references only when useful for later verification.

Private feedback should contribute to ranking through aggregate features. Access to raw feedback remains controlled by the application. If stronger auditability is required, use epoch commitments or signed aggregate reports rather than publishing individual feedback.

## Why This Avoids Contract Migrations

The contracts store stable marketplace facts:

- Who owns a translator profile.
- Which jobs were funded, assigned, accepted, disputed, and paid.
- Which credentials were attested, by whom, for whom, and whether they were revoked.

The contracts do not store:

- Ranking weights.
- Search filters.
- UI display rules.
- Feedback scoring formulas.
- Response-time calculations.
- Credential trust-tier formulas.

Those product decisions live in versioned off-chain services and search documents. New ranking inputs can be added by extending the indexer and scoring service. Existing on-chain events remain durable evidence for the claims that matter most: completed work and credentials.

This gives translators portable verification while keeping the marketplace free to iterate on discovery, ranking, and product presentation at normal software speed.
