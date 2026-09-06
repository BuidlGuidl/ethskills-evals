OpenAI Codex v0.150.1
--------
workdir: /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-002/2026-08-28T144025Z-codex-with-skill-1/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a048d0-9b70-75e1-84e4-629da2237dc4
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

2026-08-28T14:40:26.214113Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a048d0-9b70-75e1-84e4-629da2237dc4.tmp-1787928025972291545: line 2547: syntax error near unexpected token `('

codex
I’m using the `ship` skill because this request is an architecture and onchain-boundary decision for a dApp. I’ll follow it to define the minimal contract surface, callers, incentives, chain choice, and deployment implications.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/ship/SKILL.md" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-002/2026-08-28T144025Z-codex-with-skill-1/workspace
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
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
The key boundary is clear: escrow and durable attribution evidence belong onchain; profiles, private feedback, indexing, and the weekly ranking formula stay offchain. I’m checking the workspace, then I’ll write the concrete state model and read paths into `plan.md`.
exec
/bin/bash -lc "pwd && rg --files -g 'AGENTS.md' -g 'README*' -g 'plan.md' -g 'foundry.toml' -g 'hardhat.config.*' -g 'package.json' | sort" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-002/2026-08-28T144025Z-codex-with-skill-1/workspace
 succeeded in 7ms:
apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-002/2026-08-28T144025Z-codex-with-skill-1/workspace/plan.md
diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..31dd5a6b8f24ae2c7671fd1b385c595933274ab7
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,132 @@
+# Translator marketplace architecture
+
+## Product boundary and launch target
+
+Launch the first vertical slice on **Base mainnet**. The product makes many relatively small USDC escrow and settlement transactions, so an Ethereum L2 is a better fit than L1; Base also gives users an EVM wallet identity and access to native USDC. Use only the native USDC contract address published by Circle for Base and verify the address and bytecode during deployment. Do not accept bridged look-alike tokens.
+
+The design has one custom contract, `TranslationEscrow`. It owns the minimum facts that need independent enforcement or durable verification. Profiles, documents, private feedback, search, and ranking remain normal application data. Language credentials use a deployed attestation protocol such as Ethereum Attestation Service (EAS), rather than adding a custom credential registry. The application pins the approved EAS schema UID and issuer allowlist in configuration.
+
+The unit of identity is a translator-controlled wallet address. A user may rotate login methods, but completed jobs and credentials remain attributable to the wallet that earned them. Wallet migration can be a later feature; it must not silently rewrite historical attribution.
+
+## What is stored onchain
+
+### `TranslationEscrow` contract storage
+
+Each job has a stable `jobId` and stores only settlement-critical state:
+
+- client address and translator address;
+- native USDC amount;
+- state (`Funded`, `Submitted`, `Accepted`, `Disputed`, `Resolved`, or `Refunded`);
+- acceptance/review deadline needed for timeout settlement;
+- optional submission commitment, preferably a hash of the deliverable manifest rather than the text itself;
+- dispute resolver address and, if charged, the fee terms fixed when the job is funded.
+
+The contract transfers USDC with safe ERC-20 wrappers and prevents reentrancy and replay. It does not store biographies, samples, source text, translated text, feedback, rankings, or a mutable “reputation score.” Public chains are the wrong place for private client content and deletion-sensitive personal information.
+
+The contract emits canonical events such as:
+
+- `JobFunded(jobId, client, translator, amount, deadline)`;
+- `WorkSubmitted(jobId, translator, submissionHash)`;
+- `JobAccepted(jobId, client, translator, amount)`;
+- `DisputeOpened(jobId, opener)`;
+- `DisputeResolved(jobId, translatorAward, clientRefund, resolver)`;
+- `JobRefunded(jobId, client, amount)`.
+
+An accepted job or a dispute resolution that awards the translator is the durable completion fact. The event includes the translator address and job ID, making attribution independently reconstructable. Do not maintain aggregate completed-job or dispute counters unless contract settlement itself needs them; indexers can derive them from events.
+
+### Credential attestations
+
+An approved credential issuer writes an EAS attestation whose recipient is the translator wallet. The schema contains at least credential type, language pair or language, level/standard, issuance date, expiry (if any), and a hash or URI commitment to supporting evidence. The issuer signs the claim; revocations and expirations remain visible.
+
+Only attestations under the configured schema and from an allowlisted issuer count in marketplace ranking. That policy is offchain and can change without changing the attestation. The raw attestation is still independently useful: anyone can verify its issuer, recipient, contents, time, and revocation status against EAS. Sensitive certificates should not be placed onchain or at a public URI; store only a commitment and reveal the document selectively.
+
+### Ownership and administration
+
+The escrow should be immutable if the tested MVP rules are sufficiently small. If an upgradeable proxy is unavoidable, its admin and pause role belong to a production multisig with a timelock and public upgrade notices. The resolver is fixed per job when funded, so an admin cannot replace it after a dispute starts. Admins cannot seize escrowed funds or invent completed jobs.
+
+## What remains offchain
+
+The application database/object store holds:
+
+- biographies, availability, rates, profile settings, and wallet-to-account mapping;
+- work samples and media, with access controls where required;
+- searchable normalized language and credential metadata;
+- encrypted/private client feedback and moderation records;
+- response-time observations and other operational analytics;
+- indexed copies of escrow events and credential attestations;
+- ranking features, score outputs, formula versions, and experiment assignments.
+
+Private feedback must never be emitted or hashed in a way that enables guessing short ratings. The backend authorizes who may submit and read it. It can influence ranking as an aggregate feature, but the UI must not imply that this component is publicly verifiable.
+
+## Search read path
+
+The search screen does **not** call contracts for every result. Its normal path is:
+
+1. An indexer consumes finalized `TranslationEscrow` events and relevant EAS attestations, handling chain reorganizations and retaining block number, transaction hash, and log index as provenance.
+2. A feature pipeline joins those public facts with profiles, response-time measurements, dispute outcomes, credential policy, and private-feedback aggregates.
+3. A search index stores filterable profile fields plus a precomputed score and score-component snapshot for the active formula version.
+4. The search API filters by language pair and product criteria, sorts by score, and returns profile cards, verification summaries, and provenance references.
+5. The client renders the returned ordering. For “verified jobs” and credentials it links to an explorer or a small verification view that can read the chain/EAS directly.
+
+If the indexer is behind, the screen labels the last indexed block/time. Search availability is an application concern; proof availability is not. A translator can supply their wallet, job IDs/transaction receipts, and EAS attestation UIDs to any independent RPC client or block explorer. A verifier can then confirm completed-job events and valid credential attestations even while the marketplace search API is down.
+
+## Ranking production and weekly tuning
+
+Ranking is a versioned, deterministic offchain function over a feature record. A representative input is:
+
+```text
+score_v17(
+  completed_jobs_lookback,
+  dispute_rate_and_outcomes,
+  median_response_time,
+  accepted_credentials_by_current_policy,
+  private_feedback_aggregate_with_minimum_sample_threshold
+)
+```
+
+Each weekly release creates an immutable formula version containing feature definitions, normalization windows, weights, missing-data behavior, abuse controls, and activation time. Recompute candidate scores in batch, evaluate them offline, then atomically switch the search alias/config to the new version. Store the version and feature snapshot alongside each score so support staff can explain which policy produced an ordering. Rollback is a config/index alias change, not a contract transaction.
+
+Completed jobs and attestations are inputs, not scores. A new weight, issuer allowlist, response-time cap, dispute interpretation, or feedback model therefore requires only a feature-pipeline/search-index deployment. Historical onchain facts remain stable and no contract migration is needed.
+
+Search results should distinguish three claims:
+
+- **Onchain verified:** completed jobs, escrow amounts/outcomes, and credential attestations.
+- **Platform measured:** response time and private-feedback aggregates.
+- **Platform opinion:** the current ranking score/order.
+
+This gives useful verification without pretending that a subjective and frequently changing ranking is consensus data.
+
+## Contract transitions and liveness
+
+| Transition | Authorized caller | Why they pay gas | Safe outcome if nobody calls |
+| --- | --- | --- | --- |
+| `fundJob` | Client | Opens the job and escrows the agreed USDC | No job exists and no funds move |
+| `submitWork` | Assigned translator | Makes the submission timestamp/commitment durable and starts review | Funds remain escrowed |
+| `acceptWork` | Client | Receives the accepted deliverable under the product workflow | After the fixed review deadline, translator can claim |
+| `claimAfterReviewDeadline` | Translator | Receives payment when the client is inactive | Funds remain safely claimable |
+| `openDispute` | Client or translator before settlement | Protects their claim and invokes resolution | Normal acceptance/timeout paths remain available until the dispute deadline |
+| `resolveDispute` | Resolver fixed for that job | Resolver is paid an explicit fee fixed at funding, or is contractually compensated offchain | Funds remain escrowed; emergency replacement requires a narrowly defined, time-delayed path or parties can mutually settle |
+| `mutualSettle` | Either party with both signatures | Both parties unlock an agreed split | Existing state and escrow remain unchanged |
+| `refundUnstartedJob` | Client after an agreed start/submission deadline | Recovers funds when no work was submitted | Funds remain safely refundable |
+
+No backend cron is required for correctness. The backend may sponsor or relay transactions for UX, but client and translator self-service paths preserve liveness.
+
+## Build, test, and release plan
+
+1. Specify the exact job state machine, deadlines, fee rounding, resolver rules, and EIP-712 mutual-settlement signatures.
+2. Implement one escrow contract against native Circle USDC and integrate the existing EAS deployment. Pin both official addresses in chain-specific configuration; never infer them.
+3. Test every state transition, authorization boundary, deadline edge, signature replay, token behavior, reentrancy case, and conservation of funds. Run integration tests on a Base fork against the exact USDC and EAS contracts.
+4. Build a reorg-aware event/attestation indexer, then verify by replaying from the deployment block and comparing sampled records with direct RPC reads.
+5. Build profile, private-feedback, feature, ranking-version, and search-index services. Add data retention/access controls for personal and client-confidential data.
+6. Deploy to Base Sepolia, verify source, and execute an end-to-end smoke job: fund with test USDC, submit a commitment, accept, observe translator payment, index the completion, issue a test credential, and display both proofs.
+7. Obtain an independent security review. Deploy the reviewed bytecode to Base mainnet from the release multisig, verify source, record deployment block/address and exact compiler settings, and repeat the smoke path with a minimal real-USDC amount.
+
+Before release, the repository README must contain executable commands for compile, test, Base-fork tests, deployment, and source verification; required RPC/deployer/explorer environment variables; official USDC and EAS addresses with source links; multisig ownership/roles; deployment transaction hashes; the transition table above; and the smoke-test receipts. Exact commands should be added once the contract toolchain is selected rather than guessed in this architecture document.
+
+## Explicit non-goals for the MVP
+
+- No onchain profile registry, biography, samples, feedback, score, leaderboard, or search pagination.
+- No marketplace factory or per-job escrow deployment; one contract maps job IDs to state.
+- No custom credential token or soulbound NFT; attestations already express issuer-to-recipient claims and revocation.
+- No promise that ranking itself is trustless. The verifiable inputs are exposed clearly; ranking remains a tunable product policy.
+- No multi-chain launch. Additional chains would fragment identity and complicate proof aggregation before the marketplace has evidence it needs them.

diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..31dd5a6b8f24ae2c7671fd1b385c595933274ab7
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,132 @@
+# Translator marketplace architecture
+
+## Product boundary and launch target
+
+Launch the first vertical slice on **Base mainnet**. The product makes many relatively small USDC escrow and settlement transactions, so an Ethereum L2 is a better fit than L1; Base also gives users an EVM wallet identity and access to native USDC. Use only the native USDC contract address published by Circle for Base and verify the address and bytecode during deployment. Do not accept bridged look-alike tokens.
+
+The design has one custom contract, `TranslationEscrow`. It owns the minimum facts that need independent enforcement or durable verification. Profiles, documents, private feedback, search, and ranking remain normal application data. Language credentials use a deployed attestation protocol such as Ethereum Attestation Service (EAS), rather than adding a custom credential registry. The application pins the approved EAS schema UID and issuer allowlist in configuration.
+
+The unit of identity is a translator-controlled wallet address. A user may rotate login methods, but completed jobs and credentials remain attributable to the wallet that earned them. Wallet migration can be a later feature; it must not silently rewrite historical attribution.
+
+## What is stored onchain
+
+### `TranslationEscrow` contract storage
+
+Each job has a stable `jobId` and stores only settlement-critical state:
+
+- client address and translator address;
+- native USDC amount;
+- state (`Funded`, `Submitted`, `Accepted`, `Disputed`, `Resolved`, or `Refunded`);
+- acceptance/review deadline needed for timeout settlement;
+- optional submission commitment, preferably a hash of the deliverable manifest rather than the text itself;
+- dispute resolver address and, if charged, the fee terms fixed when the job is funded.
+
+The contract transfers USDC with safe ERC-20 wrappers and prevents reentrancy and replay. It does not store biographies, samples, source text, translated text, feedback, rankings, or a mutable “reputation score.” Public chains are the wrong place for private client content and deletion-sensitive personal information.
+
+The contract emits canonical events such as:
+
+- `JobFunded(jobId, client, translator, amount, deadline)`;
+- `WorkSubmitted(jobId, translator, submissionHash)`;
+- `JobAccepted(jobId, client, translator, amount)`;
+- `DisputeOpened(jobId, opener)`;
+- `DisputeResolved(jobId, translatorAward, clientRefund, resolver)`;
+- `JobRefunded(jobId, client, amount)`.
+
+An accepted job or a dispute resolution that awards the translator is the durable completion fact. The event includes the translator address and job ID, making attribution independently reconstructable. Do not maintain aggregate completed-job or dispute counters unless contract settlement itself needs them; indexers can derive them from events.
+
+### Credential attestations
+
+An approved credential issuer writes an EAS attestation whose recipient is the translator wallet. The schema contains at least credential type, language pair or language, level/standard, issuance date, expiry (if any), and a hash or URI commitment to supporting evidence. The issuer signs the claim; revocations and expirations remain visible.
+
+Only attestations under the configured schema and from an allowlisted issuer count in marketplace ranking. That policy is offchain and can change without changing the attestation. The raw attestation is still independently useful: anyone can verify its issuer, recipient, contents, time, and revocation status against EAS. Sensitive certificates should not be placed onchain or at a public URI; store only a commitment and reveal the document selectively.
+
+### Ownership and administration
+
+The escrow should be immutable if the tested MVP rules are sufficiently small. If an upgradeable proxy is unavoidable, its admin and pause role belong to a production multisig with a timelock and public upgrade notices. The resolver is fixed per job when funded, so an admin cannot replace it after a dispute starts. Admins cannot seize escrowed funds or invent completed jobs.
+
+## What remains offchain
+
+The application database/object store holds:
+
+- biographies, availability, rates, profile settings, and wallet-to-account mapping;
+- work samples and media, with access controls where required;
+- searchable normalized language and credential metadata;
+- encrypted/private client feedback and moderation records;
+- response-time observations and other operational analytics;
+- indexed copies of escrow events and credential attestations;
+- ranking features, score outputs, formula versions, and experiment assignments.
+
+Private feedback must never be emitted or hashed in a way that enables guessing short ratings. The backend authorizes who may submit and read it. It can influence ranking as an aggregate feature, but the UI must not imply that this component is publicly verifiable.
+
+## Search read path
+
+The search screen does **not** call contracts for every result. Its normal path is:
+
+1. An indexer consumes finalized `TranslationEscrow` events and relevant EAS attestations, handling chain reorganizations and retaining block number, transaction hash, and log index as provenance.
+2. A feature pipeline joins those public facts with profiles, response-time measurements, dispute outcomes, credential policy, and private-feedback aggregates.
+3. A search index stores filterable profile fields plus a precomputed score and score-component snapshot for the active formula version.
+4. The search API filters by language pair and product criteria, sorts by score, and returns profile cards, verification summaries, and provenance references.
+5. The client renders the returned ordering. For “verified jobs” and credentials it links to an explorer or a small verification view that can read the chain/EAS directly.
+
+If the indexer is behind, the screen labels the last indexed block/time. Search availability is an application concern; proof availability is not. A translator can supply their wallet, job IDs/transaction receipts, and EAS attestation UIDs to any independent RPC client or block explorer. A verifier can then confirm completed-job events and valid credential attestations even while the marketplace search API is down.
+
+## Ranking production and weekly tuning
+
+Ranking is a versioned, deterministic offchain function over a feature record. A representative input is:
+
+```text
+score_v17(
+  completed_jobs_lookback,
+  dispute_rate_and_outcomes,
+  median_response_time,
+  accepted_credentials_by_current_policy,
+  private_feedback_aggregate_with_minimum_sample_threshold
+)
+```
+
+Each weekly release creates an immutable formula version containing feature definitions, normalization windows, weights, missing-data behavior, abuse controls, and activation time. Recompute candidate scores in batch, evaluate them offline, then atomically switch the search alias/config to the new version. Store the version and feature snapshot alongside each score so support staff can explain which policy produced an ordering. Rollback is a config/index alias change, not a contract transaction.
+
+Completed jobs and attestations are inputs, not scores. A new weight, issuer allowlist, response-time cap, dispute interpretation, or feedback model therefore requires only a feature-pipeline/search-index deployment. Historical onchain facts remain stable and no contract migration is needed.
+
+Search results should distinguish three claims:
+
+- **Onchain verified:** completed jobs, escrow amounts/outcomes, and credential attestations.
+- **Platform measured:** response time and private-feedback aggregates.
+- **Platform opinion:** the current ranking score/order.
+
+This gives useful verification without pretending that a subjective and frequently changing ranking is consensus data.
+
+## Contract transitions and liveness
+
+| Transition | Authorized caller | Why they pay gas | Safe outcome if nobody calls |
+| --- | --- | --- | --- |
+| `fundJob` | Client | Opens the job and escrows the agreed USDC | No job exists and no funds move |
+| `submitWork` | Assigned translator | Makes the submission timestamp/commitment durable and starts review | Funds remain escrowed |
+| `acceptWork` | Client | Receives the accepted deliverable under the product workflow | After the fixed review deadline, translator can claim |
+| `claimAfterReviewDeadline` | Translator | Receives payment when the client is inactive | Funds remain safely claimable |
+| `openDispute` | Client or translator before settlement | Protects their claim and invokes resolution | Normal acceptance/timeout paths remain available until the dispute deadline |
+| `resolveDispute` | Resolver fixed for that job | Resolver is paid an explicit fee fixed at funding, or is contractually compensated offchain | Funds remain escrowed; emergency replacement requires a narrowly defined, time-delayed path or parties can mutually settle |
+| `mutualSettle` | Either party with both signatures | Both parties unlock an agreed split | Existing state and escrow remain unchanged |
+| `refundUnstartedJob` | Client after an agreed start/submission deadline | Recovers funds when no work was submitted | Funds remain safely refundable |
+
+No backend cron is required for correctness. The backend may sponsor or relay transactions for UX, but client and translator self-service paths preserve liveness.
+
+## Build, test, and release plan
+
+1. Specify the exact job state machine, deadlines, fee rounding, resolver rules, and EIP-712 mutual-settlement signatures.
+2. Implement one escrow contract against native Circle USDC and integrate the existing EAS deployment. Pin both official addresses in chain-specific configuration; never infer them.
+3. Test every state transition, authorization boundary, deadline edge, signature replay, token behavior, reentrancy case, and conservation of funds. Run integration tests on a Base fork against the exact USDC and EAS contracts.
+4. Build a reorg-aware event/attestation indexer, then verify by replaying from the deployment block and comparing sampled records with direct RPC reads.
+5. Build profile, private-feedback, feature, ranking-version, and search-index services. Add data retention/access controls for personal and client-confidential data.
+6. Deploy to Base Sepolia, verify source, and execute an end-to-end smoke job: fund with test USDC, submit a commitment, accept, observe translator payment, index the completion, issue a test credential, and display both proofs.
+7. Obtain an independent security review. Deploy the reviewed bytecode to Base mainnet from the release multisig, verify source, record deployment block/address and exact compiler settings, and repeat the smoke path with a minimal real-USDC amount.
+
+Before release, the repository README must contain executable commands for compile, test, Base-fork tests, deployment, and source verification; required RPC/deployer/explorer environment variables; official USDC and EAS addresses with source links; multisig ownership/roles; deployment transaction hashes; the transition table above; and the smoke-test receipts. Exact commands should be added once the contract toolchain is selected rather than guessed in this architecture document.
+
+## Explicit non-goals for the MVP
+
+- No onchain profile registry, biography, samples, feedback, score, leaderboard, or search pagination.
+- No marketplace factory or per-job escrow deployment; one contract maps job IDs to state.
+- No custom credential token or soulbound NFT; attestations already express issuer-to-recipient claims and revocation.
+- No promise that ranking itself is trustless. The verifiable inputs are exposed clearly; ranking remains a tunable product policy.
+- No multi-chain launch. Additional chains would fragment identity and complicate proof aggregation before the marketplace has evidence it needs them.

exec
/bin/bash -lc "wc -l plan.md && sed -n '1,28p' plan.md && git diff --check -- plan.md" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-002/2026-08-28T144025Z-codex-with-skill-1/workspace
 succeeded in 0ms:
diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..31dd5a6b8f24ae2c7671fd1b385c595933274ab7
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,132 @@
+# Translator marketplace architecture
+
+## Product boundary and launch target
+
+Launch the first vertical slice on **Base mainnet**. The product makes many relatively small USDC escrow and settlement transactions, so an Ethereum L2 is a better fit than L1; Base also gives users an EVM wallet identity and access to native USDC. Use only the native USDC contract address published by Circle for Base and verify the address and bytecode during deployment. Do not accept bridged look-alike tokens.
+
+The design has one custom contract, `TranslationEscrow`. It owns the minimum facts that need independent enforcement or durable verification. Profiles, documents, private feedback, search, and ranking remain normal application data. Language credentials use a deployed attestation protocol such as Ethereum Attestation Service (EAS), rather than adding a custom credential registry. The application pins the approved EAS schema UID and issuer allowlist in configuration.
+
+The unit of identity is a translator-controlled wallet address. A user may rotate login methods, but completed jobs and credentials remain attributable to the wallet that earned them. Wallet migration can be a later feature; it must not silently rewrite historical attribution.
+
+## What is stored onchain
+
+### `TranslationEscrow` contract storage
+
+Each job has a stable `jobId` and stores only settlement-critical state:
+
+- client address and translator address;
+- native USDC amount;
+- state (`Funded`, `Submitted`, `Accepted`, `Disputed`, `Resolved`, or `Refunded`);
+- acceptance/review deadline needed for timeout settlement;
+- optional submission commitment, preferably a hash of the deliverable manifest rather than the text itself;
+- dispute resolver address and, if charged, the fee terms fixed when the job is funded.
+
+The contract transfers USDC with safe ERC-20 wrappers and prevents reentrancy and replay. It does not store biographies, samples, source text, translated text, feedback, rankings, or a mutable “reputation score.” Public chains are the wrong place for private client content and deletion-sensitive personal information.
+
+The contract emits canonical events such as:
+
+- `JobFunded(jobId, client, translator, amount, deadline)`;
+- `WorkSubmitted(jobId, translator, submissionHash)`;
+- `JobAccepted(jobId, client, translator, amount)`;
+- `DisputeOpened(jobId, opener)`;
+- `DisputeResolved(jobId, translatorAward, clientRefund, resolver)`;
+- `JobRefunded(jobId, client, amount)`.
+
+An accepted job or a dispute resolution that awards the translator is the durable completion fact. The event includes the translator address and job ID, making attribution independently reconstructable. Do not maintain aggregate completed-job or dispute counters unless contract settlement itself needs them; indexers can derive them from events.
+
+### Credential attestations
+
+An approved credential issuer writes an EAS attestation whose recipient is the translator wallet. The schema contains at least credential type, language pair or language, level/standard, issuance date, expiry (if any), and a hash or URI commitment to supporting evidence. The issuer signs the claim; revocations and expirations remain visible.
+
+Only attestations under the configured schema and from an allowlisted issuer count in marketplace ranking. That policy is offchain and can change without changing the attestation. The raw attestation is still independently useful: anyone can verify its issuer, recipient, contents, time, and revocation status against EAS. Sensitive certificates should not be placed onchain or at a public URI; store only a commitment and reveal the document selectively.
+
+### Ownership and administration
+
+The escrow should be immutable if the tested MVP rules are sufficiently small. If an upgradeable proxy is unavoidable, its admin and pause role belong to a production multisig with a timelock and public upgrade notices. The resolver is fixed per job when funded, so an admin cannot replace it after a dispute starts. Admins cannot seize escrowed funds or invent completed jobs.
+
+## What remains offchain
+
+The application database/object store holds:
+
+- biographies, availability, rates, profile settings, and wallet-to-account mapping;
+- work samples and media, with access controls where required;
+- searchable normalized language and credential metadata;
+- encrypted/private client feedback and moderation records;
+- response-time observations and other operational analytics;
+- indexed copies of escrow events and credential attestations;
+- ranking features, score outputs, formula versions, and experiment assignments.
+
+Private feedback must never be emitted or hashed in a way that enables guessing short ratings. The backend authorizes who may submit and read it. It can influence ranking as an aggregate feature, but the UI must not imply that this component is publicly verifiable.
+
+## Search read path
+
+The search screen does **not** call contracts for every result. Its normal path is:
+
+1. An indexer consumes finalized `TranslationEscrow` events and relevant EAS attestations, handling chain reorganizations and retaining block number, transaction hash, and log index as provenance.
+2. A feature pipeline joins those public facts with profiles, response-time measurements, dispute outcomes, credential policy, and private-feedback aggregates.
+3. A search index stores filterable profile fields plus a precomputed score and score-component snapshot for the active formula version.
+4. The search API filters by language pair and product criteria, sorts by score, and returns profile cards, verification summaries, and provenance references.
+5. The client renders the returned ordering. For “verified jobs” and credentials it links to an explorer or a small verification view that can read the chain/EAS directly.
+
+If the indexer is behind, the screen labels the last indexed block/time. Search availability is an application concern; proof availability is not. A translator can supply their wallet, job IDs/transaction receipts, and EAS attestation UIDs to any independent RPC client or block explorer. A verifier can then confirm completed-job events and valid credential attestations even while the marketplace search API is down.
+
+## Ranking production and weekly tuning
+
+Ranking is a versioned, deterministic offchain function over a feature record. A representative input is:
+
+```text
+score_v17(
+  completed_jobs_lookback,
+  dispute_rate_and_outcomes,
+  median_response_time,
+  accepted_credentials_by_current_policy,
+  private_feedback_aggregate_with_minimum_sample_threshold
+)
+```
+
+Each weekly release creates an immutable formula version containing feature definitions, normalization windows, weights, missing-data behavior, abuse controls, and activation time. Recompute candidate scores in batch, evaluate them offline, then atomically switch the search alias/config to the new version. Store the version and feature snapshot alongside each score so support staff can explain which policy produced an ordering. Rollback is a config/index alias change, not a contract transaction.
+
+Completed jobs and attestations are inputs, not scores. A new weight, issuer allowlist, response-time cap, dispute interpretation, or feedback model therefore requires only a feature-pipeline/search-index deployment. Historical onchain facts remain stable and no contract migration is needed.
+
+Search results should distinguish three claims:
+
+- **Onchain verified:** completed jobs, escrow amounts/outcomes, and credential attestations.
+- **Platform measured:** response time and private-feedback aggregates.
+- **Platform opinion:** the current ranking score/order.
+
+This gives useful verification without pretending that a subjective and frequently changing ranking is consensus data.
+
+## Contract transitions and liveness
+
+| Transition | Authorized caller | Why they pay gas | Safe outcome if nobody calls |
+| --- | --- | --- | --- |
+| `fundJob` | Client | Opens the job and escrows the agreed USDC | No job exists and no funds move |
+| `submitWork` | Assigned translator | Makes the submission timestamp/commitment durable and starts review | Funds remain escrowed |
+| `acceptWork` | Client | Receives the accepted deliverable under the product workflow | After the fixed review deadline, translator can claim |
+| `claimAfterReviewDeadline` | Translator | Receives payment when the client is inactive | Funds remain safely claimable |
+| `openDispute` | Client or translator before settlement | Protects their claim and invokes resolution | Normal acceptance/timeout paths remain available until the dispute deadline |
+| `resolveDispute` | Resolver fixed for that job | Resolver is paid an explicit fee fixed at funding, or is contractually compensated offchain | Funds remain escrowed; emergency replacement requires a narrowly defined, time-delayed path or parties can mutually settle |
+| `mutualSettle` | Either party with both signatures | Both parties unlock an agreed split | Existing state and escrow remain unchanged |
+| `refundUnstartedJob` | Client after an agreed start/submission deadline | Recovers funds when no work was submitted | Funds remain safely refundable |
+
+No backend cron is required for correctness. The backend may sponsor or relay transactions for UX, but client and translator self-service paths preserve liveness.
+
+## Build, test, and release plan
+
+1. Specify the exact job state machine, deadlines, fee rounding, resolver rules, and EIP-712 mutual-settlement signatures.
+2. Implement one escrow contract against native Circle USDC and integrate the existing EAS deployment. Pin both official addresses in chain-specific configuration; never infer them.
+3. Test every state transition, authorization boundary, deadline edge, signature replay, token behavior, reentrancy case, and conservation of funds. Run integration tests on a Base fork against the exact USDC and EAS contracts.
+4. Build a reorg-aware event/attestation indexer, then verify by replaying from the deployment block and comparing sampled records with direct RPC reads.
+5. Build profile, private-feedback, feature, ranking-version, and search-index services. Add data retention/access controls for personal and client-confidential data.
+6. Deploy to Base Sepolia, verify source, and execute an end-to-end smoke job: fund with test USDC, submit a commitment, accept, observe translator payment, index the completion, issue a test credential, and display both proofs.
+7. Obtain an independent security review. Deploy the reviewed bytecode to Base mainnet from the release multisig, verify source, record deployment block/address and exact compiler settings, and repeat the smoke path with a minimal real-USDC amount.
+
+Before release, the repository README must contain executable commands for compile, test, Base-fork tests, deployment, and source verification; required RPC/deployer/explorer environment variables; official USDC and EAS addresses with source links; multisig ownership/roles; deployment transaction hashes; the transition table above; and the smoke-test receipts. Exact commands should be added once the contract toolchain is selected rather than guessed in this architecture document.
+
+## Explicit non-goals for the MVP
+
+- No onchain profile registry, biography, samples, feedback, score, leaderboard, or search pagination.
+- No marketplace factory or per-job escrow deployment; one contract maps job IDs to state.
+- No custom credential token or soulbound NFT; attestations already express issuer-to-recipient claims and revocation.
+- No promise that ranking itself is trustless. The verifiable inputs are exposed clearly; ranking remains a tunable product policy.
+- No multi-chain launch. Additional chains would fragment identity and complicate proof aggregation before the marketplace has evidence it needs them.

codex
Created [plan.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-002/2026-08-28T144025Z-codex-with-skill-1/workspace/plan.md).

It defines:

- A single USDC escrow contract on Base
- EAS-based credential attestations
- Offchain profiles, private feedback, search, and versioned ranking
- Independent verification of jobs and credentials during API outages
- Contract callers, incentives, dispute handling, and liveness
- Testing and release requirements
- Clear MVP non-goals to avoid future contract migrations

The file also passes `git diff --check`.
diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..31dd5a6b8f24ae2c7671fd1b385c595933274ab7
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,132 @@
+# Translator marketplace architecture
+
+## Product boundary and launch target
+
+Launch the first vertical slice on **Base mainnet**. The product makes many relatively small USDC escrow and settlement transactions, so an Ethereum L2 is a better fit than L1; Base also gives users an EVM wallet identity and access to native USDC. Use only the native USDC contract address published by Circle for Base and verify the address and bytecode during deployment. Do not accept bridged look-alike tokens.
+
+The design has one custom contract, `TranslationEscrow`. It owns the minimum facts that need independent enforcement or durable verification. Profiles, documents, private feedback, search, and ranking remain normal application data. Language credentials use a deployed attestation protocol such as Ethereum Attestation Service (EAS), rather than adding a custom credential registry. The application pins the approved EAS schema UID and issuer allowlist in configuration.
+
+The unit of identity is a translator-controlled wallet address. A user may rotate login methods, but completed jobs and credentials remain attributable to the wallet that earned them. Wallet migration can be a later feature; it must not silently rewrite historical attribution.
+
+## What is stored onchain
+
+### `TranslationEscrow` contract storage
+
+Each job has a stable `jobId` and stores only settlement-critical state:
+
+- client address and translator address;
+- native USDC amount;
+- state (`Funded`, `Submitted`, `Accepted`, `Disputed`, `Resolved`, or `Refunded`);
+- acceptance/review deadline needed for timeout settlement;
+- optional submission commitment, preferably a hash of the deliverable manifest rather than the text itself;
+- dispute resolver address and, if charged, the fee terms fixed when the job is funded.
+
+The contract transfers USDC with safe ERC-20 wrappers and prevents reentrancy and replay. It does not store biographies, samples, source text, translated text, feedback, rankings, or a mutable “reputation score.” Public chains are the wrong place for private client content and deletion-sensitive personal information.
+
+The contract emits canonical events such as:
+
+- `JobFunded(jobId, client, translator, amount, deadline)`;
+- `WorkSubmitted(jobId, translator, submissionHash)`;
+- `JobAccepted(jobId, client, translator, amount)`;
+- `DisputeOpened(jobId, opener)`;
+- `DisputeResolved(jobId, translatorAward, clientRefund, resolver)`;
+- `JobRefunded(jobId, client, amount)`.
+
+An accepted job or a dispute resolution that awards the translator is the durable completion fact. The event includes the translator address and job ID, making attribution independently reconstructable. Do not maintain aggregate completed-job or dispute counters unless contract settlement itself needs them; indexers can derive them from events.
+
+### Credential attestations
+
+An approved credential issuer writes an EAS attestation whose recipient is the translator wallet. The schema contains at least credential type, language pair or language, level/standard, issuance date, expiry (if any), and a hash or URI commitment to supporting evidence. The issuer signs the claim; revocations and expirations remain visible.
+
+Only attestations under the configured schema and from an allowlisted issuer count in marketplace ranking. That policy is offchain and can change without changing the attestation. The raw attestation is still independently useful: anyone can verify its issuer, recipient, contents, time, and revocation status against EAS. Sensitive certificates should not be placed onchain or at a public URI; store only a commitment and reveal the document selectively.
+
+### Ownership and administration
+
+The escrow should be immutable if the tested MVP rules are sufficiently small. If an upgradeable proxy is unavoidable, its admin and pause role belong to a production multisig with a timelock and public upgrade notices. The resolver is fixed per job when funded, so an admin cannot replace it after a dispute starts. Admins cannot seize escrowed funds or invent completed jobs.
+
+## What remains offchain
+
+The application database/object store holds:
+
+- biographies, availability, rates, profile settings, and wallet-to-account mapping;
+- work samples and media, with access controls where required;
+- searchable normalized language and credential metadata;
+- encrypted/private client feedback and moderation records;
+- response-time observations and other operational analytics;
+- indexed copies of escrow events and credential attestations;
+- ranking features, score outputs, formula versions, and experiment assignments.
+
+Private feedback must never be emitted or hashed in a way that enables guessing short ratings. The backend authorizes who may submit and read it. It can influence ranking as an aggregate feature, but the UI must not imply that this component is publicly verifiable.
+
+## Search read path
+
+The search screen does **not** call contracts for every result. Its normal path is:
+
+1. An indexer consumes finalized `TranslationEscrow` events and relevant EAS attestations, handling chain reorganizations and retaining block number, transaction hash, and log index as provenance.
+2. A feature pipeline joins those public facts with profiles, response-time measurements, dispute outcomes, credential policy, and private-feedback aggregates.
+3. A search index stores filterable profile fields plus a precomputed score and score-component snapshot for the active formula version.
+4. The search API filters by language pair and product criteria, sorts by score, and returns profile cards, verification summaries, and provenance references.
+5. The client renders the returned ordering. For “verified jobs” and credentials it links to an explorer or a small verification view that can read the chain/EAS directly.
+
+If the indexer is behind, the screen labels the last indexed block/time. Search availability is an application concern; proof availability is not. A translator can supply their wallet, job IDs/transaction receipts, and EAS attestation UIDs to any independent RPC client or block explorer. A verifier can then confirm completed-job events and valid credential attestations even while the marketplace search API is down.
+
+## Ranking production and weekly tuning
+
+Ranking is a versioned, deterministic offchain function over a feature record. A representative input is:
+
+```text
+score_v17(
+  completed_jobs_lookback,
+  dispute_rate_and_outcomes,
+  median_response_time,
+  accepted_credentials_by_current_policy,
+  private_feedback_aggregate_with_minimum_sample_threshold
+)
+```
+
+Each weekly release creates an immutable formula version containing feature definitions, normalization windows, weights, missing-data behavior, abuse controls, and activation time. Recompute candidate scores in batch, evaluate them offline, then atomically switch the search alias/config to the new version. Store the version and feature snapshot alongside each score so support staff can explain which policy produced an ordering. Rollback is a config/index alias change, not a contract transaction.
+
+Completed jobs and attestations are inputs, not scores. A new weight, issuer allowlist, response-time cap, dispute interpretation, or feedback model therefore requires only a feature-pipeline/search-index deployment. Historical onchain facts remain stable and no contract migration is needed.
+
+Search results should distinguish three claims:
+
+- **Onchain verified:** completed jobs, escrow amounts/outcomes, and credential attestations.
+- **Platform measured:** response time and private-feedback aggregates.
+- **Platform opinion:** the current ranking score/order.
+
+This gives useful verification without pretending that a subjective and frequently changing ranking is consensus data.
+
+## Contract transitions and liveness
+
+| Transition | Authorized caller | Why they pay gas | Safe outcome if nobody calls |
+| --- | --- | --- | --- |
+| `fundJob` | Client | Opens the job and escrows the agreed USDC | No job exists and no funds move |
+| `submitWork` | Assigned translator | Makes the submission timestamp/commitment durable and starts review | Funds remain escrowed |
+| `acceptWork` | Client | Receives the accepted deliverable under the product workflow | After the fixed review deadline, translator can claim |
+| `claimAfterReviewDeadline` | Translator | Receives payment when the client is inactive | Funds remain safely claimable |
+| `openDispute` | Client or translator before settlement | Protects their claim and invokes resolution | Normal acceptance/timeout paths remain available until the dispute deadline |
+| `resolveDispute` | Resolver fixed for that job | Resolver is paid an explicit fee fixed at funding, or is contractually compensated offchain | Funds remain escrowed; emergency replacement requires a narrowly defined, time-delayed path or parties can mutually settle |
+| `mutualSettle` | Either party with both signatures | Both parties unlock an agreed split | Existing state and escrow remain unchanged |
+| `refundUnstartedJob` | Client after an agreed start/submission deadline | Recovers funds when no work was submitted | Funds remain safely refundable |
+
+No backend cron is required for correctness. The backend may sponsor or relay transactions for UX, but client and translator self-service paths preserve liveness.
+
+## Build, test, and release plan
+
+1. Specify the exact job state machine, deadlines, fee rounding, resolver rules, and EIP-712 mutual-settlement signatures.
+2. Implement one escrow contract against native Circle USDC and integrate the existing EAS deployment. Pin both official addresses in chain-specific configuration; never infer them.
+3. Test every state transition, authorization boundary, deadline edge, signature replay, token behavior, reentrancy case, and conservation of funds. Run integration tests on a Base fork against the exact USDC and EAS contracts.
+4. Build a reorg-aware event/attestation indexer, then verify by replaying from the deployment block and comparing sampled records with direct RPC reads.
+5. Build profile, private-feedback, feature, ranking-version, and search-index services. Add data retention/access controls for personal and client-confidential data.
+6. Deploy to Base Sepolia, verify source, and execute an end-to-end smoke job: fund with test USDC, submit a commitment, accept, observe translator payment, index the completion, issue a test credential, and display both proofs.
+7. Obtain an independent security review. Deploy the reviewed bytecode to Base mainnet from the release multisig, verify source, record deployment block/address and exact compiler settings, and repeat the smoke path with a minimal real-USDC amount.
+
+Before release, the repository README must contain executable commands for compile, test, Base-fork tests, deployment, and source verification; required RPC/deployer/explorer environment variables; official USDC and EAS addresses with source links; multisig ownership/roles; deployment transaction hashes; the transition table above; and the smoke-test receipts. Exact commands should be added once the contract toolchain is selected rather than guessed in this architecture document.
+
+## Explicit non-goals for the MVP
+
+- No onchain profile registry, biography, samples, feedback, score, leaderboard, or search pagination.
+- No marketplace factory or per-job escrow deployment; one contract maps job IDs to state.
+- No custom credential token or soulbound NFT; attestations already express issuer-to-recipient claims and revocation.
+- No promise that ranking itself is trustless. The verifiable inputs are exposed clearly; ranking remains a tunable product policy.
+- No multi-chain launch. Additional chains would fragment identity and complicate proof aggregation before the marketplace has evidence it needs them.

tokens used
17,762
Created [plan.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-002/2026-08-28T144025Z-codex-with-skill-1/workspace/plan.md).

It defines:

- A single USDC escrow contract on Base
- EAS-based credential attestations
- Offchain profiles, private feedback, search, and versioned ranking
- Independent verification of jobs and credentials during API outages
- Contract callers, incentives, dispute handling, and liveness
- Testing and release requirements
- Clear MVP non-goals to avoid future contract migrations

The file also passes `git diff --check`.
