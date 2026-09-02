OpenAI Codex v0.150.1
--------
workdir: /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-002/2026-08-28T144025Z-codex-with-skill-2/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a048d0-9ba1-7170-a8d3-8545a9e033f6
--------
user
We're building a freelance marketplace for independent translators. Clients
fund jobs in USDC and release payment when a translation is accepted.
Translators have biographies, work samples, language credentials, and private
client feedback. Search results rank them using completed jobs, disputes,
response time, credentials, and feedback. We expect to tune that formula
weekly, but a translator must be able to prove which completed jobs and
credential attestations belong to them even if our search API is unavailable.

Write the architecture to plan.md in this directory. Explain what is stored
in contracts, what the search screen reads, how the ranking is produced, and
how the design provides useful verification without making product iteration
require contract migrations.

2026-08-28T14:40:26.253699Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a048d0-9ba1-7170-a8d3-8545a9e033f6.tmp-1787928026020379627: line 2547: syntax error near unexpected token `('

codex
I’m using the `ship` skill because this request needs the dApp’s onchain boundary, minimal contract surface, callers, incentives, and release assumptions settled before implementation. I’ll apply it to the architecture document.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/ship/SKILL.md" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-002/2026-08-28T144025Z-codex-with-skill-2/workspace
 succeeded in 7ms:
---
name: ship
description: "Scope a dApp or MVP and make it ready to build and release: decide the onchain boundary, minimal contract surface, state-transition callers and incentives, one launch chain, and the deployment runbook. Use before implementation or when a build lacks these decisions. Route detailed implementation, deployment, and audit work to their focused skills."
---

# Ship a dApp

Before coding, write down the smallest vertical slice that can ship. Decide what
is onchain, how many custom contracts it needs, who advances every state
transition, and one deployment target. Do not expand into a full application or
fetch every related skill before this plan is concrete.

## Architecture

Put only trustless ownership, value transfer, composability, censorship
resistance, or permanent commitments onchain. Keep profiles, descriptions,
media, search, filtering, and frequently changing rules in an offchain store;
put a content hash or URI onchain only when verification needs it.

Treat reputation and rankings as derived data. Emit the facts needed to compute
them, then calculate and sort offchain. Do not maintain a computed score,
leaderboard, or paginated ranking in contract storage merely to serve a browse
screen. Recording counters that settlement already needs is fine.

Prefer existing audited protocols and primitives. Most MVPs need zero to two
custom contracts, and three is the upper bound before reducing scope. Do not add a
factory, escrow, router, or fee-splitter unless its separate trust boundary is
required by the product.

When integrating a deployed protocol, use a verified address from the relevant
chain's official documentation or the `addresses` skill. Never invent or infer
an address: a wrong address can send approvals or funds to an attacker.

## State transitions

Contracts do not run on schedules. For each state-changing function, record:

| Transition | Caller | Why they pay gas | If nobody calls |
| --- | --- | --- | --- |
| `claimPayout()` | recipient | receives the payout | funds remain claimable |
| permissionless settlement | keeper or participant | explicit fee or direct benefit | settlement waits |

Naming a permissionless caller is not an incentive. Identify the caller's
benefit and the source of any keeper fee. Prefer self-serve or permissionless
paths over an owner-only cron job; automation may be a convenience, but it must
not be the only liveness path.

Include the completed transition table in the project README, especially for
every function that moves funds.

## Chain and deployment decision

Choose one target chain for the first release and state why its capabilities fit
the product. Measure current fees when cost affects the decision; do not rely on
remembered gas prices. An L2 should be selected for a concrete product fit such
as its distribution, liquidity, account abstraction, or ecosystem—not merely
because “Ethereum is expensive.”

Before calling the MVP shippable, the README must name the target and contain
the exact deploy and verification commands, required environment variables,
contract ownership destination, and a small post-deploy transaction to verify
the path end to end. Do not leave the network or deployment procedure as TBD.

## Minimal ship checklist

- Onchain/offchain boundary is explicit, including where rankings are computed.
- Custom contract list is concrete and no larger than the MVP requires.
- Every state transition has a caller, incentive, and safe no-caller outcome.
- One target chain is selected for a product-specific reason.
- Tests cover custom logic and external integrations use a fork.
- README contains the transition table and executable deployment runbook.
- Contracts are verified and production ownership goes to the intended multisig.
- A fresh reviewer checks the finished vertical slice before launch.

Fetch another focused skill only when the plan reaches that phase and needs its
details—for example `addresses`, `l2s`, `gas`, `security`, `testing`,
`frontend-ux`, `frontend-playbook`, or `qa`. Skills are available at
`https://ethskills.com/<skill>/SKILL.md`. `ship` owns the product and release
decisions; use `frontend-playbook` for detailed hosting/deployment mechanics and
`qa` for the independent pre-launch review. Stop when the requested vertical
slice and its runbook are complete.

codex
The key boundary is clear: escrow and durable attribution proofs belong onchain; mutable profiles, private feedback, indexing, and the weekly ranking formula stay offchain. I’m checking the workspace conventions, then I’ll write the concrete data flow and transition ownership into `plan.md`.
exec
/bin/bash -lc "pwd && rg --files -g 'AGENTS.md' -g '"'!node_modules'"' -g '"'!vendor'"' | head -20 && git status --short" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-002/2026-08-28T144025Z-codex-with-skill-2/workspace
 succeeded in 6ms:
apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-002/2026-08-28T144025Z-codex-with-skill-2/workspace/plan.md
diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..f0309cc82bb6393b4a025034eba6a829c11169f0
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,147 @@
+# Translator Marketplace Architecture
+
+## Product and trust model
+
+The first release uses **Base mainnet** and native USDC. Base is a good product fit because clients can acquire and move USDC through the Coinbase ecosystem, while low transaction costs make per-job escrow practical. Before deployment, the team must obtain the current canonical USDC and attestation-contract addresses from their official Base documentation; addresses must never be copied from this plan or guessed.
+
+The system has one custom contract, `TranslationEscrow`, plus an existing attestation protocol for credentials. The contract is the source of truth for funded jobs, assigned translators, acceptance, payment, refunds, and dispute outcomes. It does not try to be the marketplace database.
+
+The core trust assumptions are explicit:
+
+- USDC and Base are external dependencies.
+- A client chooses a translator before funding a job and is trusted to keep the source material and acceptance discussion offchain.
+- Credential issuers are trusted only for attestations they sign; the UI shows the issuer and its trust status rather than treating every attestation as valid.
+- An arbitration multisig can resolve disputed escrow in the MVP. It cannot rewrite job history or credentials.
+- The company controls search availability and ranking policy, but not the underlying proofs of completed work or credential ownership.
+
+## Onchain boundary
+
+### `TranslationEscrow`
+
+Each job stores only the minimum data needed for escrow and durable attribution:
+
+- `jobId`
+- client address
+- translator address
+- USDC amount
+- protocol fee fixed when the job is created
+- state: `Funded`, `Accepted`, `Disputed`, `Resolved`, or `Refunded`
+- funding and response/acceptance deadlines, if those policies are enabled
+- a `termsHash`, committing to a canonical offchain job agreement without publishing the source text, translation, names, or messages
+
+The contract transfers USDC into escrow when the job is created. On acceptance it records the final state and makes the translator's proceeds withdrawable. A completed-job proof is therefore the combination of contract address, chain ID, job ID, the stored client and translator addresses, and the immutable acceptance or translator-winning resolution event. Anyone can verify it against an RPC or their own Base node without the marketplace API.
+
+Events should expose indexable facts, not computed reputation:
+
+- `JobFunded(jobId, client, translator, amount, termsHash)`
+- `JobAccepted(jobId, client, translator, amount)`
+- `DisputeOpened(jobId, opener)`
+- `DisputeResolved(jobId, translatorAmount, clientAmount)`
+- `JobRefunded(jobId, client, amount)`
+- `PayoutWithdrawn(jobId, translator, amount)`
+
+The contract may keep per-job state needed to prevent double settlement, but it does **not** store biographies, samples, language lists, feedback, response-time averages, completed-job counters, ranking scores, or a leaderboard. Those are either private, bulky, or expected to change.
+
+Use a pull-payment balance for payouts and protocol fees, with checks-effects-interactions and safe USDC transfer handling. Give the arbitration and fee-administration roles to separate production multisigs. Fee changes affect only newly created jobs. An emergency pause may stop creation and disputed resolution, but must not prevent users from withdrawing already-finalized balances.
+
+### Credential attestations
+
+Language credentials use an established attestation protocol rather than a second custom registry. Each attestation binds:
+
+- the translator wallet as subject
+- an issuer wallet
+- credential type and language code
+- issuance and optional expiry time
+- a hash of the credential evidence or issuer record
+- a revocable flag and current revocation status
+
+Sensitive certificate contents stay offchain with the translator or issuer. The public hash proves that a presented document is the one attested, not that its private contents are visible. The marketplace maintains an offchain allowlist and confidence tier for recognized issuers; this policy can change without modifying attestations. A translator proves ownership by signing a fresh challenge with the subject wallet and presenting the attestation UID, issuer, schema, and evidence whose hash matches.
+
+Wallet rotation is not silently inferred. The original wallet signs a migration statement linking the new wallet, and the indexer presents both identities as a chain of claims. If the old key is lost, issuers must re-attest to the new wallet; an admin database edit cannot transfer public proof.
+
+## Offchain application data
+
+Postgres is the product source for mutable and private data:
+
+- profiles, biographies, availability, rates, and language preferences
+- work-sample metadata and object-storage locations
+- job briefs, messages, translation files, and the canonical terms document
+- credential display metadata and the issuer trust policy
+- private client feedback and moderation state
+- derived response times, completion/dispute aggregates, and ranking features
+- ranking-model versions, weights, experiment assignments, and explanations
+
+Private feedback is encrypted at rest and access-controlled. It is never emitted in a public event or placed in public object storage. Search can use a privacy-preserving aggregate (for example, a Bayesian-adjusted rating and count once a minimum cohort is reached) rather than returning review text or identifying a reviewer. The raw feedback remains available only to authorized marketplace services and staff under an audit trail.
+
+Profiles and samples are product claims, not durable blockchain guarantees. If users need to verify a particular sample later, its hash can be included in a signed profile manifest; this does not require adding profile fields to the contract.
+
+## Indexing and search read path
+
+An event indexer reads finalized Base logs from a configured deployment block, joins them with contract state, and stores a projection in Postgres. It also reads credential attestations and revocations from the attestation protocol. The indexer records block number, block hash, transaction hash, and log index and rewinds/replays on a chain reorganization. A periodic reconciliation job compares projected active jobs and balances with contract reads.
+
+The search screen reads a search API backed by a search index, not contracts directly. Its documents contain public profile fields, sample thumbnails, availability, supported languages, a cached credential summary, completed/disputed-job aggregates, response-time features, privacy-thresholded feedback aggregates, and a ranking explanation. The source references for completed jobs and credentials are retained so a user can open a verification panel.
+
+The verification panel is deliberately a separate path from search ranking. It can accept a translator address and proof bundle, then query Base through one or more public RPC providers to show:
+
+- accepted or translator-winning jobs assigned to that address
+- amounts and settlement transaction links
+- credential attestation UIDs, issuers, expiry, and revocation status
+- whether supplied credential evidence matches its onchain hash
+- whether the translator signed the current ownership challenge
+
+The marketplace should offer an exportable JSON proof bundle containing chain ID, contract address, job IDs, transaction/log coordinates, attestation UIDs, evidence hashes, and the translator's signature. A small open-source verifier can validate this bundle using an arbitrary Base RPC. Thus a search outage harms discovery but does not prevent verification of attribution.
+
+## Ranking production
+
+Ranking is a versioned, offchain pipeline:
+
+1. The indexer converts finalized contract events and credential attestations into normalized facts.
+2. Application services add authorized offchain facts: median response time, availability, profile-language match, and privacy-safe feedback aggregates.
+3. A scheduled feature job computes time-windowed features. Disputes are represented by outcomes, not merely by the fact that a client opened one, to limit abuse.
+4. The search service filters for the query's languages and constraints, applies the active versioned scoring formula, and sorts candidates. A typical score may combine Bayesian completion rate, completed-job evidence, resolved dispute rate, response-time percentile, recognized unexpired credentials, and feedback confidence.
+5. Each result records `rankingVersion`, feature values, and a concise reason such as “12 verified completions; recognized Spanish credential.” Raw private feedback and anti-abuse signals are never exposed.
+
+Weights, thresholds, time windows, feature transforms, issuer tiers, and experiments live in version-controlled configuration. Weekly tuning creates a new immutable ranking version, is evaluated against offline relevance/fairness metrics, and can be rolled back. Historical result logs retain the version used. No formula change requires a transaction, proxy upgrade, contract migration, or rewriting historical events.
+
+Do not rank directly from lifetime counts alone: use minimum sample sizes/Bayesian shrinkage, cap the contribution of volume, distinguish dispute outcomes, and monitor ranking quality by language pair. This makes a new translator viable and reduces incentives for wash jobs while preserving explainability.
+
+## State transitions and liveness
+
+| Transition | Authorized caller | Why they pay gas | Safe outcome if nobody calls |
+| --- | --- | --- | --- |
+| `fundJob(translator, amount, termsHash, deadlines)` | Client | Opens the commissioned job | No job exists and no funds move |
+| `acceptJob(jobId)` | Client | Receives the accepted work and releases escrow | Funds remain escrowed until another agreed resolution path applies |
+| `openDispute(jobId)` | Client or translator | Protects their claim before settlement | Existing state and escrow remain unchanged |
+| `resolveDispute(jobId, split)` | Arbitration multisig | Fulfills the paid/operational arbitration duty | Funds remain safely escrowed; neither party loses its claim |
+| `refundUnaccepted(jobId)` | Client, after an objective translator-response deadline | Recovers funds when the translator never engaged | Funds remain escrowed and refundable later |
+| `withdraw()` | Translator, client, or fee recipient with a finalized balance | Receives their USDC | Balance remains claimable indefinitely |
+| issue/revoke credential | Credential issuer | Issues or corrects a credential under its own policy | Existing credential state remains visible, including expiry |
+
+If product policy later adds automatic acceptance after a review window, the transition must be permissionless after an objective timestamp and benefit the translator directly; automation may call it, but must not be the only liveness path. It should not be included in the MVP unless the job terms and dispute window are unambiguous.
+
+## Failure handling and security properties
+
+- The UI waits for a documented confirmation depth before treating logs as final and labels newer results as pending.
+- Duplicate events are deduplicated by `(chainId, transactionHash, logIndex)`.
+- Search/API failure never changes escrow state. Users retain direct contract withdrawal and verification paths.
+- Object storage uses opaque identifiers, encryption, short-lived URLs, and content hashes; no translation text is put onchain.
+- Signatures use EIP-712 domain separation including chain ID, verifying contract/application origin, nonce, and expiry to prevent replay.
+- The contract rejects unsupported tokens, fee-on-transfer behavior, zero addresses, invalid state transitions, and splits exceeding escrow.
+- Tests cover every state transition, authorization, deadlines, dispute splits, pull withdrawals, pause behavior, and invariant conservation of USDC. Fork tests exercise the exact canonical Base USDC and attestation deployments.
+
+## Build and release plan
+
+The smallest vertical slice is: create one USDC-funded job for a preselected translator, accept it, withdraw payment, index the events, show the verified completion on a profile, ingest one issuer credential, and rank that translator from the indexed facts.
+
+Before mainnet release, the repository README must contain executable commands for compile, unit tests, Base fork tests, deployment, source verification, indexer start block configuration, and the end-to-end smoke transaction. It must list the required environment variables (deployer RPC URL and key, Base explorer API key, canonical USDC address, attestation contract/schema identifiers, arbitration multisig, fee multisig, and indexer RPC URL) without committing secrets.
+
+Deployment order:
+
+1. Verify official Base dependency addresses and create the credential schema.
+2. Run unit, invariant, and Base fork tests against those addresses.
+3. Deploy `TranslationEscrow` with USDC, arbitration multisig, fee multisig, and initial fee parameters; verify source code.
+4. Configure the indexer with chain ID, verified contract address, schema ID, and deployment block; replay and reconcile.
+5. Execute a small mainnet job end to end: fund, accept, withdraw, index, and independently verify its proof bundle.
+6. Confirm pause/role ownership is held by the intended multisigs, publish the contract/schema identifiers, and have a fresh reviewer check the complete vertical slice.
+
+This boundary makes payment and identity-linked evidence durable and independently verifiable, while leaving presentation, privacy rules, issuer policy, aggregation, and ranking free to evolve at normal product speed.

diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..f0309cc82bb6393b4a025034eba6a829c11169f0
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,147 @@
+# Translator Marketplace Architecture
+
+## Product and trust model
+
+The first release uses **Base mainnet** and native USDC. Base is a good product fit because clients can acquire and move USDC through the Coinbase ecosystem, while low transaction costs make per-job escrow practical. Before deployment, the team must obtain the current canonical USDC and attestation-contract addresses from their official Base documentation; addresses must never be copied from this plan or guessed.
+
+The system has one custom contract, `TranslationEscrow`, plus an existing attestation protocol for credentials. The contract is the source of truth for funded jobs, assigned translators, acceptance, payment, refunds, and dispute outcomes. It does not try to be the marketplace database.
+
+The core trust assumptions are explicit:
+
+- USDC and Base are external dependencies.
+- A client chooses a translator before funding a job and is trusted to keep the source material and acceptance discussion offchain.
+- Credential issuers are trusted only for attestations they sign; the UI shows the issuer and its trust status rather than treating every attestation as valid.
+- An arbitration multisig can resolve disputed escrow in the MVP. It cannot rewrite job history or credentials.
+- The company controls search availability and ranking policy, but not the underlying proofs of completed work or credential ownership.
+
+## Onchain boundary
+
+### `TranslationEscrow`
+
+Each job stores only the minimum data needed for escrow and durable attribution:
+
+- `jobId`
+- client address
+- translator address
+- USDC amount
+- protocol fee fixed when the job is created
+- state: `Funded`, `Accepted`, `Disputed`, `Resolved`, or `Refunded`
+- funding and response/acceptance deadlines, if those policies are enabled
+- a `termsHash`, committing to a canonical offchain job agreement without publishing the source text, translation, names, or messages
+
+The contract transfers USDC into escrow when the job is created. On acceptance it records the final state and makes the translator's proceeds withdrawable. A completed-job proof is therefore the combination of contract address, chain ID, job ID, the stored client and translator addresses, and the immutable acceptance or translator-winning resolution event. Anyone can verify it against an RPC or their own Base node without the marketplace API.
+
+Events should expose indexable facts, not computed reputation:
+
+- `JobFunded(jobId, client, translator, amount, termsHash)`
+- `JobAccepted(jobId, client, translator, amount)`
+- `DisputeOpened(jobId, opener)`
+- `DisputeResolved(jobId, translatorAmount, clientAmount)`
+- `JobRefunded(jobId, client, amount)`
+- `PayoutWithdrawn(jobId, translator, amount)`
+
+The contract may keep per-job state needed to prevent double settlement, but it does **not** store biographies, samples, language lists, feedback, response-time averages, completed-job counters, ranking scores, or a leaderboard. Those are either private, bulky, or expected to change.
+
+Use a pull-payment balance for payouts and protocol fees, with checks-effects-interactions and safe USDC transfer handling. Give the arbitration and fee-administration roles to separate production multisigs. Fee changes affect only newly created jobs. An emergency pause may stop creation and disputed resolution, but must not prevent users from withdrawing already-finalized balances.
+
+### Credential attestations
+
+Language credentials use an established attestation protocol rather than a second custom registry. Each attestation binds:
+
+- the translator wallet as subject
+- an issuer wallet
+- credential type and language code
+- issuance and optional expiry time
+- a hash of the credential evidence or issuer record
+- a revocable flag and current revocation status
+
+Sensitive certificate contents stay offchain with the translator or issuer. The public hash proves that a presented document is the one attested, not that its private contents are visible. The marketplace maintains an offchain allowlist and confidence tier for recognized issuers; this policy can change without modifying attestations. A translator proves ownership by signing a fresh challenge with the subject wallet and presenting the attestation UID, issuer, schema, and evidence whose hash matches.
+
+Wallet rotation is not silently inferred. The original wallet signs a migration statement linking the new wallet, and the indexer presents both identities as a chain of claims. If the old key is lost, issuers must re-attest to the new wallet; an admin database edit cannot transfer public proof.
+
+## Offchain application data
+
+Postgres is the product source for mutable and private data:
+
+- profiles, biographies, availability, rates, and language preferences
+- work-sample metadata and object-storage locations
+- job briefs, messages, translation files, and the canonical terms document
+- credential display metadata and the issuer trust policy
+- private client feedback and moderation state
+- derived response times, completion/dispute aggregates, and ranking features
+- ranking-model versions, weights, experiment assignments, and explanations
+
+Private feedback is encrypted at rest and access-controlled. It is never emitted in a public event or placed in public object storage. Search can use a privacy-preserving aggregate (for example, a Bayesian-adjusted rating and count once a minimum cohort is reached) rather than returning review text or identifying a reviewer. The raw feedback remains available only to authorized marketplace services and staff under an audit trail.
+
+Profiles and samples are product claims, not durable blockchain guarantees. If users need to verify a particular sample later, its hash can be included in a signed profile manifest; this does not require adding profile fields to the contract.
+
+## Indexing and search read path
+
+An event indexer reads finalized Base logs from a configured deployment block, joins them with contract state, and stores a projection in Postgres. It also reads credential attestations and revocations from the attestation protocol. The indexer records block number, block hash, transaction hash, and log index and rewinds/replays on a chain reorganization. A periodic reconciliation job compares projected active jobs and balances with contract reads.
+
+The search screen reads a search API backed by a search index, not contracts directly. Its documents contain public profile fields, sample thumbnails, availability, supported languages, a cached credential summary, completed/disputed-job aggregates, response-time features, privacy-thresholded feedback aggregates, and a ranking explanation. The source references for completed jobs and credentials are retained so a user can open a verification panel.
+
+The verification panel is deliberately a separate path from search ranking. It can accept a translator address and proof bundle, then query Base through one or more public RPC providers to show:
+
+- accepted or translator-winning jobs assigned to that address
+- amounts and settlement transaction links
+- credential attestation UIDs, issuers, expiry, and revocation status
+- whether supplied credential evidence matches its onchain hash
+- whether the translator signed the current ownership challenge
+
+The marketplace should offer an exportable JSON proof bundle containing chain ID, contract address, job IDs, transaction/log coordinates, attestation UIDs, evidence hashes, and the translator's signature. A small open-source verifier can validate this bundle using an arbitrary Base RPC. Thus a search outage harms discovery but does not prevent verification of attribution.
+
+## Ranking production
+
+Ranking is a versioned, offchain pipeline:
+
+1. The indexer converts finalized contract events and credential attestations into normalized facts.
+2. Application services add authorized offchain facts: median response time, availability, profile-language match, and privacy-safe feedback aggregates.
+3. A scheduled feature job computes time-windowed features. Disputes are represented by outcomes, not merely by the fact that a client opened one, to limit abuse.
+4. The search service filters for the query's languages and constraints, applies the active versioned scoring formula, and sorts candidates. A typical score may combine Bayesian completion rate, completed-job evidence, resolved dispute rate, response-time percentile, recognized unexpired credentials, and feedback confidence.
+5. Each result records `rankingVersion`, feature values, and a concise reason such as “12 verified completions; recognized Spanish credential.” Raw private feedback and anti-abuse signals are never exposed.
+
+Weights, thresholds, time windows, feature transforms, issuer tiers, and experiments live in version-controlled configuration. Weekly tuning creates a new immutable ranking version, is evaluated against offline relevance/fairness metrics, and can be rolled back. Historical result logs retain the version used. No formula change requires a transaction, proxy upgrade, contract migration, or rewriting historical events.
+
+Do not rank directly from lifetime counts alone: use minimum sample sizes/Bayesian shrinkage, cap the contribution of volume, distinguish dispute outcomes, and monitor ranking quality by language pair. This makes a new translator viable and reduces incentives for wash jobs while preserving explainability.
+
+## State transitions and liveness
+
+| Transition | Authorized caller | Why they pay gas | Safe outcome if nobody calls |
+| --- | --- | --- | --- |
+| `fundJob(translator, amount, termsHash, deadlines)` | Client | Opens the commissioned job | No job exists and no funds move |
+| `acceptJob(jobId)` | Client | Receives the accepted work and releases escrow | Funds remain escrowed until another agreed resolution path applies |
+| `openDispute(jobId)` | Client or translator | Protects their claim before settlement | Existing state and escrow remain unchanged |
+| `resolveDispute(jobId, split)` | Arbitration multisig | Fulfills the paid/operational arbitration duty | Funds remain safely escrowed; neither party loses its claim |
+| `refundUnaccepted(jobId)` | Client, after an objective translator-response deadline | Recovers funds when the translator never engaged | Funds remain escrowed and refundable later |
+| `withdraw()` | Translator, client, or fee recipient with a finalized balance | Receives their USDC | Balance remains claimable indefinitely |
+| issue/revoke credential | Credential issuer | Issues or corrects a credential under its own policy | Existing credential state remains visible, including expiry |
+
+If product policy later adds automatic acceptance after a review window, the transition must be permissionless after an objective timestamp and benefit the translator directly; automation may call it, but must not be the only liveness path. It should not be included in the MVP unless the job terms and dispute window are unambiguous.
+
+## Failure handling and security properties
+
+- The UI waits for a documented confirmation depth before treating logs as final and labels newer results as pending.
+- Duplicate events are deduplicated by `(chainId, transactionHash, logIndex)`.
+- Search/API failure never changes escrow state. Users retain direct contract withdrawal and verification paths.
+- Object storage uses opaque identifiers, encryption, short-lived URLs, and content hashes; no translation text is put onchain.
+- Signatures use EIP-712 domain separation including chain ID, verifying contract/application origin, nonce, and expiry to prevent replay.
+- The contract rejects unsupported tokens, fee-on-transfer behavior, zero addresses, invalid state transitions, and splits exceeding escrow.
+- Tests cover every state transition, authorization, deadlines, dispute splits, pull withdrawals, pause behavior, and invariant conservation of USDC. Fork tests exercise the exact canonical Base USDC and attestation deployments.
+
+## Build and release plan
+
+The smallest vertical slice is: create one USDC-funded job for a preselected translator, accept it, withdraw payment, index the events, show the verified completion on a profile, ingest one issuer credential, and rank that translator from the indexed facts.
+
+Before mainnet release, the repository README must contain executable commands for compile, unit tests, Base fork tests, deployment, source verification, indexer start block configuration, and the end-to-end smoke transaction. It must list the required environment variables (deployer RPC URL and key, Base explorer API key, canonical USDC address, attestation contract/schema identifiers, arbitration multisig, fee multisig, and indexer RPC URL) without committing secrets.
+
+Deployment order:
+
+1. Verify official Base dependency addresses and create the credential schema.
+2. Run unit, invariant, and Base fork tests against those addresses.
+3. Deploy `TranslationEscrow` with USDC, arbitration multisig, fee multisig, and initial fee parameters; verify source code.
+4. Configure the indexer with chain ID, verified contract address, schema ID, and deployment block; replay and reconcile.
+5. Execute a small mainnet job end to end: fund, accept, withdraw, index, and independently verify its proof bundle.
+6. Confirm pause/role ownership is held by the intended multisigs, publish the contract/schema identifiers, and have a fresh reviewer check the complete vertical slice.
+
+This boundary makes payment and identity-linked evidence durable and independently verifiable, while leaving presentation, privacy rules, issuer policy, aggregation, and ranking free to evolve at normal product speed.

exec
/bin/bash -lc "wc -l plan.md && sed -n '1,30p' plan.md && git diff --check -- plan.md && git status --short -- plan.md" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-002/2026-08-28T144025Z-codex-with-skill-2/workspace
 succeeded in 1ms:
diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..f0309cc82bb6393b4a025034eba6a829c11169f0
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,147 @@
+# Translator Marketplace Architecture
+
+## Product and trust model
+
+The first release uses **Base mainnet** and native USDC. Base is a good product fit because clients can acquire and move USDC through the Coinbase ecosystem, while low transaction costs make per-job escrow practical. Before deployment, the team must obtain the current canonical USDC and attestation-contract addresses from their official Base documentation; addresses must never be copied from this plan or guessed.
+
+The system has one custom contract, `TranslationEscrow`, plus an existing attestation protocol for credentials. The contract is the source of truth for funded jobs, assigned translators, acceptance, payment, refunds, and dispute outcomes. It does not try to be the marketplace database.
+
+The core trust assumptions are explicit:
+
+- USDC and Base are external dependencies.
+- A client chooses a translator before funding a job and is trusted to keep the source material and acceptance discussion offchain.
+- Credential issuers are trusted only for attestations they sign; the UI shows the issuer and its trust status rather than treating every attestation as valid.
+- An arbitration multisig can resolve disputed escrow in the MVP. It cannot rewrite job history or credentials.
+- The company controls search availability and ranking policy, but not the underlying proofs of completed work or credential ownership.
+
+## Onchain boundary
+
+### `TranslationEscrow`
+
+Each job stores only the minimum data needed for escrow and durable attribution:
+
+- `jobId`
+- client address
+- translator address
+- USDC amount
+- protocol fee fixed when the job is created
+- state: `Funded`, `Accepted`, `Disputed`, `Resolved`, or `Refunded`
+- funding and response/acceptance deadlines, if those policies are enabled
+- a `termsHash`, committing to a canonical offchain job agreement without publishing the source text, translation, names, or messages
+
+The contract transfers USDC into escrow when the job is created. On acceptance it records the final state and makes the translator's proceeds withdrawable. A completed-job proof is therefore the combination of contract address, chain ID, job ID, the stored client and translator addresses, and the immutable acceptance or translator-winning resolution event. Anyone can verify it against an RPC or their own Base node without the marketplace API.
+
+Events should expose indexable facts, not computed reputation:
+
+- `JobFunded(jobId, client, translator, amount, termsHash)`
+- `JobAccepted(jobId, client, translator, amount)`
+- `DisputeOpened(jobId, opener)`
+- `DisputeResolved(jobId, translatorAmount, clientAmount)`
+- `JobRefunded(jobId, client, amount)`
+- `PayoutWithdrawn(jobId, translator, amount)`
+
+The contract may keep per-job state needed to prevent double settlement, but it does **not** store biographies, samples, language lists, feedback, response-time averages, completed-job counters, ranking scores, or a leaderboard. Those are either private, bulky, or expected to change.
+
+Use a pull-payment balance for payouts and protocol fees, with checks-effects-interactions and safe USDC transfer handling. Give the arbitration and fee-administration roles to separate production multisigs. Fee changes affect only newly created jobs. An emergency pause may stop creation and disputed resolution, but must not prevent users from withdrawing already-finalized balances.
+
+### Credential attestations
+
+Language credentials use an established attestation protocol rather than a second custom registry. Each attestation binds:
+
+- the translator wallet as subject
+- an issuer wallet
+- credential type and language code
+- issuance and optional expiry time
+- a hash of the credential evidence or issuer record
+- a revocable flag and current revocation status
+
+Sensitive certificate contents stay offchain with the translator or issuer. The public hash proves that a presented document is the one attested, not that its private contents are visible. The marketplace maintains an offchain allowlist and confidence tier for recognized issuers; this policy can change without modifying attestations. A translator proves ownership by signing a fresh challenge with the subject wallet and presenting the attestation UID, issuer, schema, and evidence whose hash matches.
+
+Wallet rotation is not silently inferred. The original wallet signs a migration statement linking the new wallet, and the indexer presents both identities as a chain of claims. If the old key is lost, issuers must re-attest to the new wallet; an admin database edit cannot transfer public proof.
+
+## Offchain application data
+
+Postgres is the product source for mutable and private data:
+
+- profiles, biographies, availability, rates, and language preferences
+- work-sample metadata and object-storage locations
+- job briefs, messages, translation files, and the canonical terms document
+- credential display metadata and the issuer trust policy
+- private client feedback and moderation state
+- derived response times, completion/dispute aggregates, and ranking features
+- ranking-model versions, weights, experiment assignments, and explanations
+
+Private feedback is encrypted at rest and access-controlled. It is never emitted in a public event or placed in public object storage. Search can use a privacy-preserving aggregate (for example, a Bayesian-adjusted rating and count once a minimum cohort is reached) rather than returning review text or identifying a reviewer. The raw feedback remains available only to authorized marketplace services and staff under an audit trail.
+
+Profiles and samples are product claims, not durable blockchain guarantees. If users need to verify a particular sample later, its hash can be included in a signed profile manifest; this does not require adding profile fields to the contract.
+
+## Indexing and search read path
+
+An event indexer reads finalized Base logs from a configured deployment block, joins them with contract state, and stores a projection in Postgres. It also reads credential attestations and revocations from the attestation protocol. The indexer records block number, block hash, transaction hash, and log index and rewinds/replays on a chain reorganization. A periodic reconciliation job compares projected active jobs and balances with contract reads.
+
+The search screen reads a search API backed by a search index, not contracts directly. Its documents contain public profile fields, sample thumbnails, availability, supported languages, a cached credential summary, completed/disputed-job aggregates, response-time features, privacy-thresholded feedback aggregates, and a ranking explanation. The source references for completed jobs and credentials are retained so a user can open a verification panel.
+
+The verification panel is deliberately a separate path from search ranking. It can accept a translator address and proof bundle, then query Base through one or more public RPC providers to show:
+
+- accepted or translator-winning jobs assigned to that address
+- amounts and settlement transaction links
+- credential attestation UIDs, issuers, expiry, and revocation status
+- whether supplied credential evidence matches its onchain hash
+- whether the translator signed the current ownership challenge
+
+The marketplace should offer an exportable JSON proof bundle containing chain ID, contract address, job IDs, transaction/log coordinates, attestation UIDs, evidence hashes, and the translator's signature. A small open-source verifier can validate this bundle using an arbitrary Base RPC. Thus a search outage harms discovery but does not prevent verification of attribution.
+
+## Ranking production
+
+Ranking is a versioned, offchain pipeline:
+
+1. The indexer converts finalized contract events and credential attestations into normalized facts.
+2. Application services add authorized offchain facts: median response time, availability, profile-language match, and privacy-safe feedback aggregates.
+3. A scheduled feature job computes time-windowed features. Disputes are represented by outcomes, not merely by the fact that a client opened one, to limit abuse.
+4. The search service filters for the query's languages and constraints, applies the active versioned scoring formula, and sorts candidates. A typical score may combine Bayesian completion rate, completed-job evidence, resolved dispute rate, response-time percentile, recognized unexpired credentials, and feedback confidence.
+5. Each result records `rankingVersion`, feature values, and a concise reason such as “12 verified completions; recognized Spanish credential.” Raw private feedback and anti-abuse signals are never exposed.
+
+Weights, thresholds, time windows, feature transforms, issuer tiers, and experiments live in version-controlled configuration. Weekly tuning creates a new immutable ranking version, is evaluated against offline relevance/fairness metrics, and can be rolled back. Historical result logs retain the version used. No formula change requires a transaction, proxy upgrade, contract migration, or rewriting historical events.
+
+Do not rank directly from lifetime counts alone: use minimum sample sizes/Bayesian shrinkage, cap the contribution of volume, distinguish dispute outcomes, and monitor ranking quality by language pair. This makes a new translator viable and reduces incentives for wash jobs while preserving explainability.
+
+## State transitions and liveness
+
+| Transition | Authorized caller | Why they pay gas | Safe outcome if nobody calls |
+| --- | --- | --- | --- |
+| `fundJob(translator, amount, termsHash, deadlines)` | Client | Opens the commissioned job | No job exists and no funds move |
+| `acceptJob(jobId)` | Client | Receives the accepted work and releases escrow | Funds remain escrowed until another agreed resolution path applies |
+| `openDispute(jobId)` | Client or translator | Protects their claim before settlement | Existing state and escrow remain unchanged |
+| `resolveDispute(jobId, split)` | Arbitration multisig | Fulfills the paid/operational arbitration duty | Funds remain safely escrowed; neither party loses its claim |
+| `refundUnaccepted(jobId)` | Client, after an objective translator-response deadline | Recovers funds when the translator never engaged | Funds remain escrowed and refundable later |
+| `withdraw()` | Translator, client, or fee recipient with a finalized balance | Receives their USDC | Balance remains claimable indefinitely |
+| issue/revoke credential | Credential issuer | Issues or corrects a credential under its own policy | Existing credential state remains visible, including expiry |
+
+If product policy later adds automatic acceptance after a review window, the transition must be permissionless after an objective timestamp and benefit the translator directly; automation may call it, but must not be the only liveness path. It should not be included in the MVP unless the job terms and dispute window are unambiguous.
+
+## Failure handling and security properties
+
+- The UI waits for a documented confirmation depth before treating logs as final and labels newer results as pending.
+- Duplicate events are deduplicated by `(chainId, transactionHash, logIndex)`.
+- Search/API failure never changes escrow state. Users retain direct contract withdrawal and verification paths.
+- Object storage uses opaque identifiers, encryption, short-lived URLs, and content hashes; no translation text is put onchain.
+- Signatures use EIP-712 domain separation including chain ID, verifying contract/application origin, nonce, and expiry to prevent replay.
+- The contract rejects unsupported tokens, fee-on-transfer behavior, zero addresses, invalid state transitions, and splits exceeding escrow.
+- Tests cover every state transition, authorization, deadlines, dispute splits, pull withdrawals, pause behavior, and invariant conservation of USDC. Fork tests exercise the exact canonical Base USDC and attestation deployments.
+
+## Build and release plan
+
+The smallest vertical slice is: create one USDC-funded job for a preselected translator, accept it, withdraw payment, index the events, show the verified completion on a profile, ingest one issuer credential, and rank that translator from the indexed facts.
+
+Before mainnet release, the repository README must contain executable commands for compile, unit tests, Base fork tests, deployment, source verification, indexer start block configuration, and the end-to-end smoke transaction. It must list the required environment variables (deployer RPC URL and key, Base explorer API key, canonical USDC address, attestation contract/schema identifiers, arbitration multisig, fee multisig, and indexer RPC URL) without committing secrets.
+
+Deployment order:
+
+1. Verify official Base dependency addresses and create the credential schema.
+2. Run unit, invariant, and Base fork tests against those addresses.
+3. Deploy `TranslationEscrow` with USDC, arbitration multisig, fee multisig, and initial fee parameters; verify source code.
+4. Configure the indexer with chain ID, verified contract address, schema ID, and deployment block; replay and reconcile.
+5. Execute a small mainnet job end to end: fund, accept, withdraw, index, and independently verify its proof bundle.
+6. Confirm pause/role ownership is held by the intended multisigs, publish the contract/schema identifiers, and have a fresh reviewer check the complete vertical slice.
+
+This boundary makes payment and identity-linked evidence durable and independently verifiable, while leaving presentation, privacy rules, issuer policy, aggregation, and ranking free to evolve at normal product speed.

codex
Created [plan.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-002/2026-08-28T144025Z-codex-with-skill-2/workspace/plan.md).

It covers:

- USDC escrow and durable job attribution onchain
- Credential attestations and wallet ownership proofs
- Offchain profiles, samples, private feedback, and mutable policies
- Search indexing and read paths
- Versioned weekly ranking production
- API-independent verification bundles
- State-transition callers and liveness
- Base deployment and release plan

The file passes `git diff --check`.
diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..f0309cc82bb6393b4a025034eba6a829c11169f0
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,147 @@
+# Translator Marketplace Architecture
+
+## Product and trust model
+
+The first release uses **Base mainnet** and native USDC. Base is a good product fit because clients can acquire and move USDC through the Coinbase ecosystem, while low transaction costs make per-job escrow practical. Before deployment, the team must obtain the current canonical USDC and attestation-contract addresses from their official Base documentation; addresses must never be copied from this plan or guessed.
+
+The system has one custom contract, `TranslationEscrow`, plus an existing attestation protocol for credentials. The contract is the source of truth for funded jobs, assigned translators, acceptance, payment, refunds, and dispute outcomes. It does not try to be the marketplace database.
+
+The core trust assumptions are explicit:
+
+- USDC and Base are external dependencies.
+- A client chooses a translator before funding a job and is trusted to keep the source material and acceptance discussion offchain.
+- Credential issuers are trusted only for attestations they sign; the UI shows the issuer and its trust status rather than treating every attestation as valid.
+- An arbitration multisig can resolve disputed escrow in the MVP. It cannot rewrite job history or credentials.
+- The company controls search availability and ranking policy, but not the underlying proofs of completed work or credential ownership.
+
+## Onchain boundary
+
+### `TranslationEscrow`
+
+Each job stores only the minimum data needed for escrow and durable attribution:
+
+- `jobId`
+- client address
+- translator address
+- USDC amount
+- protocol fee fixed when the job is created
+- state: `Funded`, `Accepted`, `Disputed`, `Resolved`, or `Refunded`
+- funding and response/acceptance deadlines, if those policies are enabled
+- a `termsHash`, committing to a canonical offchain job agreement without publishing the source text, translation, names, or messages
+
+The contract transfers USDC into escrow when the job is created. On acceptance it records the final state and makes the translator's proceeds withdrawable. A completed-job proof is therefore the combination of contract address, chain ID, job ID, the stored client and translator addresses, and the immutable acceptance or translator-winning resolution event. Anyone can verify it against an RPC or their own Base node without the marketplace API.
+
+Events should expose indexable facts, not computed reputation:
+
+- `JobFunded(jobId, client, translator, amount, termsHash)`
+- `JobAccepted(jobId, client, translator, amount)`
+- `DisputeOpened(jobId, opener)`
+- `DisputeResolved(jobId, translatorAmount, clientAmount)`
+- `JobRefunded(jobId, client, amount)`
+- `PayoutWithdrawn(jobId, translator, amount)`
+
+The contract may keep per-job state needed to prevent double settlement, but it does **not** store biographies, samples, language lists, feedback, response-time averages, completed-job counters, ranking scores, or a leaderboard. Those are either private, bulky, or expected to change.
+
+Use a pull-payment balance for payouts and protocol fees, with checks-effects-interactions and safe USDC transfer handling. Give the arbitration and fee-administration roles to separate production multisigs. Fee changes affect only newly created jobs. An emergency pause may stop creation and disputed resolution, but must not prevent users from withdrawing already-finalized balances.
+
+### Credential attestations
+
+Language credentials use an established attestation protocol rather than a second custom registry. Each attestation binds:
+
+- the translator wallet as subject
+- an issuer wallet
+- credential type and language code
+- issuance and optional expiry time
+- a hash of the credential evidence or issuer record
+- a revocable flag and current revocation status
+
+Sensitive certificate contents stay offchain with the translator or issuer. The public hash proves that a presented document is the one attested, not that its private contents are visible. The marketplace maintains an offchain allowlist and confidence tier for recognized issuers; this policy can change without modifying attestations. A translator proves ownership by signing a fresh challenge with the subject wallet and presenting the attestation UID, issuer, schema, and evidence whose hash matches.
+
+Wallet rotation is not silently inferred. The original wallet signs a migration statement linking the new wallet, and the indexer presents both identities as a chain of claims. If the old key is lost, issuers must re-attest to the new wallet; an admin database edit cannot transfer public proof.
+
+## Offchain application data
+
+Postgres is the product source for mutable and private data:
+
+- profiles, biographies, availability, rates, and language preferences
+- work-sample metadata and object-storage locations
+- job briefs, messages, translation files, and the canonical terms document
+- credential display metadata and the issuer trust policy
+- private client feedback and moderation state
+- derived response times, completion/dispute aggregates, and ranking features
+- ranking-model versions, weights, experiment assignments, and explanations
+
+Private feedback is encrypted at rest and access-controlled. It is never emitted in a public event or placed in public object storage. Search can use a privacy-preserving aggregate (for example, a Bayesian-adjusted rating and count once a minimum cohort is reached) rather than returning review text or identifying a reviewer. The raw feedback remains available only to authorized marketplace services and staff under an audit trail.
+
+Profiles and samples are product claims, not durable blockchain guarantees. If users need to verify a particular sample later, its hash can be included in a signed profile manifest; this does not require adding profile fields to the contract.
+
+## Indexing and search read path
+
+An event indexer reads finalized Base logs from a configured deployment block, joins them with contract state, and stores a projection in Postgres. It also reads credential attestations and revocations from the attestation protocol. The indexer records block number, block hash, transaction hash, and log index and rewinds/replays on a chain reorganization. A periodic reconciliation job compares projected active jobs and balances with contract reads.
+
+The search screen reads a search API backed by a search index, not contracts directly. Its documents contain public profile fields, sample thumbnails, availability, supported languages, a cached credential summary, completed/disputed-job aggregates, response-time features, privacy-thresholded feedback aggregates, and a ranking explanation. The source references for completed jobs and credentials are retained so a user can open a verification panel.
+
+The verification panel is deliberately a separate path from search ranking. It can accept a translator address and proof bundle, then query Base through one or more public RPC providers to show:
+
+- accepted or translator-winning jobs assigned to that address
+- amounts and settlement transaction links
+- credential attestation UIDs, issuers, expiry, and revocation status
+- whether supplied credential evidence matches its onchain hash
+- whether the translator signed the current ownership challenge
+
+The marketplace should offer an exportable JSON proof bundle containing chain ID, contract address, job IDs, transaction/log coordinates, attestation UIDs, evidence hashes, and the translator's signature. A small open-source verifier can validate this bundle using an arbitrary Base RPC. Thus a search outage harms discovery but does not prevent verification of attribution.
+
+## Ranking production
+
+Ranking is a versioned, offchain pipeline:
+
+1. The indexer converts finalized contract events and credential attestations into normalized facts.
+2. Application services add authorized offchain facts: median response time, availability, profile-language match, and privacy-safe feedback aggregates.
+3. A scheduled feature job computes time-windowed features. Disputes are represented by outcomes, not merely by the fact that a client opened one, to limit abuse.
+4. The search service filters for the query's languages and constraints, applies the active versioned scoring formula, and sorts candidates. A typical score may combine Bayesian completion rate, completed-job evidence, resolved dispute rate, response-time percentile, recognized unexpired credentials, and feedback confidence.
+5. Each result records `rankingVersion`, feature values, and a concise reason such as “12 verified completions; recognized Spanish credential.” Raw private feedback and anti-abuse signals are never exposed.
+
+Weights, thresholds, time windows, feature transforms, issuer tiers, and experiments live in version-controlled configuration. Weekly tuning creates a new immutable ranking version, is evaluated against offline relevance/fairness metrics, and can be rolled back. Historical result logs retain the version used. No formula change requires a transaction, proxy upgrade, contract migration, or rewriting historical events.
+
+Do not rank directly from lifetime counts alone: use minimum sample sizes/Bayesian shrinkage, cap the contribution of volume, distinguish dispute outcomes, and monitor ranking quality by language pair. This makes a new translator viable and reduces incentives for wash jobs while preserving explainability.
+
+## State transitions and liveness
+
+| Transition | Authorized caller | Why they pay gas | Safe outcome if nobody calls |
+| --- | --- | --- | --- |
+| `fundJob(translator, amount, termsHash, deadlines)` | Client | Opens the commissioned job | No job exists and no funds move |
+| `acceptJob(jobId)` | Client | Receives the accepted work and releases escrow | Funds remain escrowed until another agreed resolution path applies |
+| `openDispute(jobId)` | Client or translator | Protects their claim before settlement | Existing state and escrow remain unchanged |
+| `resolveDispute(jobId, split)` | Arbitration multisig | Fulfills the paid/operational arbitration duty | Funds remain safely escrowed; neither party loses its claim |
+| `refundUnaccepted(jobId)` | Client, after an objective translator-response deadline | Recovers funds when the translator never engaged | Funds remain escrowed and refundable later |
+| `withdraw()` | Translator, client, or fee recipient with a finalized balance | Receives their USDC | Balance remains claimable indefinitely |
+| issue/revoke credential | Credential issuer | Issues or corrects a credential under its own policy | Existing credential state remains visible, including expiry |
+
+If product policy later adds automatic acceptance after a review window, the transition must be permissionless after an objective timestamp and benefit the translator directly; automation may call it, but must not be the only liveness path. It should not be included in the MVP unless the job terms and dispute window are unambiguous.
+
+## Failure handling and security properties
+
+- The UI waits for a documented confirmation depth before treating logs as final and labels newer results as pending.
+- Duplicate events are deduplicated by `(chainId, transactionHash, logIndex)`.
+- Search/API failure never changes escrow state. Users retain direct contract withdrawal and verification paths.
+- Object storage uses opaque identifiers, encryption, short-lived URLs, and content hashes; no translation text is put onchain.
+- Signatures use EIP-712 domain separation including chain ID, verifying contract/application origin, nonce, and expiry to prevent replay.
+- The contract rejects unsupported tokens, fee-on-transfer behavior, zero addresses, invalid state transitions, and splits exceeding escrow.
+- Tests cover every state transition, authorization, deadlines, dispute splits, pull withdrawals, pause behavior, and invariant conservation of USDC. Fork tests exercise the exact canonical Base USDC and attestation deployments.
+
+## Build and release plan
+
+The smallest vertical slice is: create one USDC-funded job for a preselected translator, accept it, withdraw payment, index the events, show the verified completion on a profile, ingest one issuer credential, and rank that translator from the indexed facts.
+
+Before mainnet release, the repository README must contain executable commands for compile, unit tests, Base fork tests, deployment, source verification, indexer start block configuration, and the end-to-end smoke transaction. It must list the required environment variables (deployer RPC URL and key, Base explorer API key, canonical USDC address, attestation contract/schema identifiers, arbitration multisig, fee multisig, and indexer RPC URL) without committing secrets.
+
+Deployment order:
+
+1. Verify official Base dependency addresses and create the credential schema.
+2. Run unit, invariant, and Base fork tests against those addresses.
+3. Deploy `TranslationEscrow` with USDC, arbitration multisig, fee multisig, and initial fee parameters; verify source code.
+4. Configure the indexer with chain ID, verified contract address, schema ID, and deployment block; replay and reconcile.
+5. Execute a small mainnet job end to end: fund, accept, withdraw, index, and independently verify its proof bundle.
+6. Confirm pause/role ownership is held by the intended multisigs, publish the contract/schema identifiers, and have a fresh reviewer check the complete vertical slice.
+
+This boundary makes payment and identity-linked evidence durable and independently verifiable, while leaving presentation, privacy rules, issuer policy, aggregation, and ranking free to evolve at normal product speed.

tokens used
18,434
Created [plan.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-002/2026-08-28T144025Z-codex-with-skill-2/workspace/plan.md).

It covers:

- USDC escrow and durable job attribution onchain
- Credential attestations and wallet ownership proofs
- Offchain profiles, samples, private feedback, and mutable policies
- Search indexing and read paths
- Versioned weekly ranking production
- API-independent verification bundles
- State-transition callers and liveness
- Base deployment and release plan

The file passes `git diff --check`.
