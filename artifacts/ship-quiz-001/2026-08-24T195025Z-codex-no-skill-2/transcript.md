Reading additional input from stdin...
2026-08-24T19:50:25.559805Z ERROR codex_models_manager::cache: failed to load models cache: missing field `base_instructions` at line 97 column 5
OpenAI Codex v0.146.1
--------
workdir: /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-24T195025Z-codex-no-skill-2/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a03552-fc52-7661-8fbe-b74436b432ae
--------
user
We minted a 5,000-piece NFT collection on Ethereum mainnet in 2024, and
holders keep trading it by hand in our Discord — someone posts "selling #3312
for 0.4 ETH", they DM, they send. We want listing and buying to happen on our
own site instead: a holder lists a piece at a price, anyone browsing can buy
it, and the artist takes 2.5% of every resale. Sellers can cancel a listing,
and nothing sits in escrow while it's listed — owners keep the piece until it
actually sells.

Buyers should also be able to make an offer that an owner accepts later, and
the artist still receives the same cut. I need a four-week MVP plan and a
precise audit scope so the auditor can quote it before implementation starts.

Write your answer to plan.md in this directory, covering the build plan and
what goes into the audit scope.
2026-08-24T19:50:26.365459Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a03552-fc52-7661-8fbe-b74436b432ae.tmp-1787601026165828545: line 2547: syntax error near unexpected token `('

codex
I’ll inspect the workspace context first, then write a concrete four-week implementation plan and quote-ready audit scope to `plan.md`.
exec
/bin/bash -lc 'ls -la && find . -maxdepth 2 -type f -print' in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-24T195025Z-codex-no-skill-2/workspace
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
total 12
drwxrwxr-x 5 damu damu 4096 Aug 24 16:50 .
drwxrwxr-x 3 damu damu 4096 Aug 24 16:50 ..
dr-xr-xr-x 2 damu damu   40 Aug 24 16:50 .agents
dr-xr-xr-x 2 damu damu   40 Aug 24 16:50 .codex
dr-xr-xr-x 2 damu damu   40 Aug 24 16:50 .git
-rw-rw-r-- 1 damu damu  819 Aug 24 16:50 TASK.md
./TASK.md

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-24T195025Z-codex-no-skill-2/workspace/plan.md
diff --git a/artifacts/ship-quiz-001/2026-08-24T195025Z-codex-no-skill-2/workspace/plan.md b/artifacts/ship-quiz-001/2026-08-24T195025Z-codex-no-skill-2/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..6cec6b54dc0ba3e92d1f583b37cc55a052ab4914
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-08-24T195025Z-codex-no-skill-2/workspace/plan.md
@@ -0,0 +1,129 @@
+# Four-week NFT marketplace MVP plan
+
+## Proposed MVP
+
+Build a narrow, non-custodial fixed-price marketplace for the existing 5,000-token Ethereum mainnet collection. The NFT remains in its owner's wallet while listed. Listings and offers are EIP-712 signed orders stored off-chain; only fulfillment, cancellation, and nonce invalidation touch the exchange contract. A sale atomically transfers the NFT and pays the seller and artist, so no party can receive one side without delivering the other.
+
+The marketplace will support:
+
+- fixed-price listings denominated in native ETH;
+- collection-specific offers denominated in WETH, made against an exact token ID;
+- seller cancellation and bulk invalidation of old orders by incrementing a wallet nonce;
+- expiration timestamps on every listing and offer;
+- a fixed 2.5% royalty paid to the artist's configured payout address on every marketplace fulfillment;
+- a 97.5% seller payout and no marketplace fee in the MVP;
+- browsing active listings, viewing an item, listing, buying, offering, accepting, and cancelling;
+- transaction status, wallet/network errors, and clear approval prompts.
+
+Offers use WETH rather than native ETH because an offer must remain executable later without locking ETH in this contract. At acceptance, the exchange uses the buyer's existing WETH balance and allowance. If either is insufficient, acceptance reverts. NFTs also require the owner's ERC-721 approval when a listing is bought or an offer is accepted. Neither listings nor offers guarantee future executability: the UI and indexer must mark orders inactive if ownership, approval, balance, allowance, nonce, or expiry changes.
+
+This scope assumes the existing collection is a standard ERC-721 contract with reliable `ownerOf` and `safeTransferFrom`, token metadata is usable, and it does not have transfer restrictions. Before development, record the exact collection contract, chain ID (1), artist payout address, WETH mainnet address, and whether the collection exposes ERC-2981. The exchange enforces the agreed 250 basis points itself; it does not rely on marketplaces voluntarily honoring ERC-2981. The artist payout address is immutable in the safest MVP; if business requirements demand rotation, use a two-step, time-delayed update controlled by a specified multisig and include that path in the audit.
+
+## Contract design and invariants
+
+Use one purpose-built exchange contract restricted to the named collection. Define separate EIP-712 listing and offer structs, each committing to the exchange address and chain through the domain separator and to: maker, NFT contract, token ID, payment token, gross price, expiry, maker nonce, and a unique salt/order ID. Offers additionally identify the intended owner as optional: the MVP recommendation is to leave the owner unrestricted so a valid offer follows the token, while only the current owner can accept it.
+
+On a listing purchase, verify the seller signature, current nonce, unused order ID, expiry, exact collection/payment asset, current ownership and approval, and exact ETH payment. Mark the order consumed before external calls, transfer the NFT with `safeTransferFrom`, then pay 2.5% to the artist and the remainder to the seller. On offer acceptance, perform the equivalent checks, mark consumed, pull WETH from the offeror, transfer the NFT, and distribute WETH. Royalty uses `grossPrice * 250 / 10_000`; the rounding remainder stays with the seller. There are no partial fills.
+
+Use `ReentrancyGuard`, checks-effects-interactions, custom errors, explicit zero-address/zero-price validation, and `SafeERC20`. Do not accept arbitrary ERC-20s or arbitrary NFT contracts. ETH payouts must work for contract wallets; a failed payout reverts the whole sale, with no retained balances. The contract has no owner withdrawal or rescue path because it should not custody assets. Emit complete events for fills, explicit cancellations, and nonce increments.
+
+Signatures must support EOAs and ERC-1271 contract wallets. An order is fillable only once. Cancellation may target an order ID, while nonce increment invalidates all older orders by that maker. A direct NFT transfer, approval revocation, insufficient WETH, or expired order causes a clean revert and is reflected by the indexer. Frontend prices are parsed as integer wei; no floating-point arithmetic is used for settlement values.
+
+## Four-week delivery plan
+
+### Week 1 — freeze behavior and build the contract skeleton
+
+- Confirm the collection contract, artist recipient, royalty rounding, WETH address, supported wallets, offer semantics, expiry bounds, and whether the payout recipient can ever change.
+- Verify the deployed ERC-721 behavior on a mainnet fork, including approvals, transfers, ERC-165/721, ERC-2981 if present, metadata, and any pause/operator restrictions.
+- Write the order schemas, state machine, trust model, invariants, revert behavior, event schema, and acceptance tests before implementation.
+- Implement listing purchase, exact-token WETH offer acceptance, per-order cancellation, nonce invalidation, EIP-712/1271 verification, and royalty splitting.
+- Add unit tests for authorization, expiry, replay, wrong chain/contract/asset, ownership changes, approvals, exact payment, rounding, and all failure atomicity.
+- Deliverable: reviewed specification, compiling contract, initial tests, and an auditor scope/version draft.
+
+### Week 2 — finish contracts and off-chain order services
+
+- Complete fuzz and invariant tests, including conservation of value, at-most-once fill, only-current-owner sale, and artist receiving exactly the computed royalty on every successful path.
+- Test malicious ERC-721 receivers, reverting ETH recipients, ERC-1271 wallets, reentrancy attempts, malformed signatures, WETH allowance/balance changes, cancellation/fill races, and front-running scenarios.
+- Deploy to Sepolia and to a pinned mainnet fork; publish verified source and deployment parameters.
+- Build a small API/database that validates signed orders before storing them and serves order/activity queries. Treat it as an availability/indexing layer, never as an authority over settlement.
+- Build an event indexer with deterministic replay, confirmation handling, reorg rollback, and periodic on-chain fillability reconciliation.
+- Deliverable: release-candidate contracts with green tests, deployed test instance, API schema, and indexed events.
+
+### Week 3 — product integration and audit handoff
+
+- Build collection grid, token detail, list/cancel/buy, make/withdraw offer, and accept-offer flows.
+- Add wallet connection, Ethereum-mainnet enforcement, EIP-712 signing, ERC-721 approval, WETH wrap/approval guidance, expiry selection, transaction simulation, pending/confirmed/failed states, and explorer links.
+- Show gross price, 2.5% artist royalty, seller proceeds, gas, expiry, and the counterparty action before every signature or transaction.
+- Add API abuse controls, schema validation, signature verification, duplicate suppression, observability, and stale-order cleanup.
+- Freeze the audited commit. Give auditors source, tests, deployment configuration, architecture and threat-model documents, known limitations, and reproducible commands. No contract feature changes after freeze without audit triage.
+- Deliverable: end-to-end staging MVP and audit-ready commit.
+
+### Week 4 — audit, fixes, and controlled launch
+
+- Auditor reviews the frozen code while the team runs QA on a fork/staging environment and completes operations documentation.
+- Triage every finding; fix in a dedicated branch, add a regression test for each defect, and submit the exact diff for auditor verification. Any material redesign returns to audit scope.
+- Run final mainnet-fork tests using the real collection, WETH, artist address, representative EOAs and contract wallets, plus listing/fill/cancel and offer/accept race tests.
+- Prepare deployment with compiler settings and constructor arguments pinned, multisig/timelock configured if applicable, source verification, monitoring alerts, incident contacts, frontend contract-address pinning, and a documented pause/response decision. If the contract is intentionally immutable and unpausable, state that explicitly in the incident plan.
+- Launch only after critical/high findings are resolved and auditor fixes are verified. Begin with a guarded public beta and monitor fills, reverts, royalty payments, indexing lag, and anomalous order activity.
+- Deliverable: auditor-verified commit, deployment record, runbook, and production MVP.
+
+The four-week target assumes a small experienced team, a promptly available auditor, no collection-contract changes, and no substantial findings requiring redesign. Audit booking should happen in week 1. If review cannot finish in week 4, deployment moves; the audit is not compressed.
+
+## Quote-ready smart-contract audit scope
+
+### In scope
+
+The quote should cover the exact frozen commit and line count supplied at handoff, including:
+
+- the exchange contract and all locally maintained libraries;
+- EIP-712 hashing/domain separation, ECDSA validation, ERC-1271 support, salt/order identity, replay prevention, and signature malleability behavior;
+- listing purchase with native ETH and exact-token offers with mainnet WETH;
+- ERC-721 ownership, approvals, `safeTransferFrom`, receiver callbacks, and compatibility with the specified deployed collection;
+- order expiry, explicit cancellation, nonce invalidation, fill-versus-cancel races, and transaction ordering/front-running consequences;
+- accounting for gross price, the 250 bps royalty, rounding, seller proceeds, exact `msg.value`, and conservation of ETH/WETH;
+- external-call ordering, reentrancy, denial of service from seller/artist/receiver contracts, atomic rollback, and unexpected token behavior;
+- authorization and any administration, payout-address update, pause, or upgrade mechanism that remains in the final design;
+- event correctness and sufficiency for reconstructing order state;
+- constructor/deployment parameters, compiler and optimizer settings, dependency versions, and deployment scripts;
+- unit, integration, fuzz, invariant, and mainnet-fork tests as supporting evidence, including their adequacy rather than merely their pass status.
+
+The auditor should review these required invariants explicitly:
+
+1. A successful fill transfers exactly the intended token from its current owner to the intended buyer, at most once.
+2. A fill cannot succeed without valid maker authorization, an unexpired and uninvalidated order, current ownership, and required approvals/balance.
+3. Every successful fill pays exactly `floor(grossPrice * 250 / 10_000)` to the artist and the entire remainder to the seller; the exchange retains nothing.
+4. No failure or reentrant callback can produce a partial fill, duplicate fill, stolen token, unauthorized cancellation, or lost/stuck funds.
+5. A signature for another order, chain, contract, NFT, token ID, asset, price, maker, nonce, expiry, or salt cannot be reused here.
+6. Cancellation and nonce invalidation have deterministic behavior under adversarial transaction ordering.
+
+### Deployment-specific external contracts
+
+Treat the deployed collection and canonical mainnet WETH as integration dependencies. Review the interfaces and the exchange's assumptions about them, and exercise both on a pinned mainnet fork. Their source code is not itself being audited. Provide auditors the exact addresses and fork block number before work begins.
+
+### Out of scope, quoted separately if desired
+
+- the pre-existing NFT collection implementation, metadata hosting, artwork, and provenance;
+- canonical WETH internals beyond integration assumptions;
+- frontend, API, database, indexer, hosting, wallet extensions, RPC providers, and block explorers;
+- compromise or misuse of user, artist, deployer, or multisig private keys; phishing and Discord impersonation;
+- economic appraisal, wash trading, stolen-NFT adjudication, sanctions/tax/legal review, and marketplace-policy compliance;
+- gas optimization except where it affects correctness or creates denial of service;
+- third-party dependency vulnerabilities outside the way this code uses them;
+- post-audit changes, future auction/bundle/bid-pool features, arbitrary collections or currencies, marketplace fees, custodial bids, and upgrades not present in the frozen commit.
+
+Although off-chain systems are outside the smart-contract quote, commission a separate application security review before broad launch. It should cover order API authorization and validation, injected/spoofed orders, stale-state presentation, indexer reorg handling, XSS/CSRF, wallet-signing UX, domain and contract-address integrity, secrets, rate limits, dependencies, and monitoring. The UI must never represent API presence as proof that an order is fillable; it should simulate or revalidate on-chain state immediately before submission.
+
+### Materials and quotation assumptions
+
+Send the auditor: repository access; frozen commit hash; Solidity source and source line count; exact compiler/optimizer/EVM settings; dependency lockfile; architecture diagram; order type hashes and worked examples; threat model; roles and privileges; deployment scripts and addresses; test commands and coverage; fork configuration; known issues; and the intended deployment date. Ask the quote to state reviewer count, person-days, start date, deliverables, retest allowance, and treatment of changes after freeze.
+
+The audit report should include severity-rated findings, proof or reproduction steps, recommended remediation, reviewed commit and file list, assumptions/limitations, and a final remediation status or retest letter tied to the deployment commit. Acceptance gates are: no open critical or high findings; medium findings fixed or explicitly risk-accepted in writing; all fixes regression-tested and reviewed; deployment bytecode reproducible from the reviewed source.
+
+## MVP acceptance criteria
+
+- An owner can sign a listing without transferring the NFT; another wallet can buy it atomically on a mainnet fork.
+- An owner can cancel one listing or invalidate all earlier orders, after which fulfillment reverts.
+- A buyer can sign a token-specific WETH offer without depositing funds into the exchange; the current owner can accept it atomically when balance and allowance remain sufficient.
+- Both sale paths pay 2.5% of gross consideration to the configured artist and 97.5% (plus any rounding remainder) to the seller, verified across fuzzed prices.
+- Replays, expired orders, wrong-chain signatures, stale ownership, missing approvals, insufficient funds/allowance, malformed signatures, and reentrant callbacks fail without changing ownership or balances.
+- The site accurately presents active/stale state, price breakdown, expiry, approvals, and transaction outcomes, and the indexer recovers from a tested reorg/replay scenario.

diff --git a/artifacts/ship-quiz-001/2026-08-24T195025Z-codex-no-skill-2/workspace/plan.md b/artifacts/ship-quiz-001/2026-08-24T195025Z-codex-no-skill-2/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..6cec6b54dc0ba3e92d1f583b37cc55a052ab4914
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-08-24T195025Z-codex-no-skill-2/workspace/plan.md
@@ -0,0 +1,129 @@
+# Four-week NFT marketplace MVP plan
+
+## Proposed MVP
+
+Build a narrow, non-custodial fixed-price marketplace for the existing 5,000-token Ethereum mainnet collection. The NFT remains in its owner's wallet while listed. Listings and offers are EIP-712 signed orders stored off-chain; only fulfillment, cancellation, and nonce invalidation touch the exchange contract. A sale atomically transfers the NFT and pays the seller and artist, so no party can receive one side without delivering the other.
+
+The marketplace will support:
+
+- fixed-price listings denominated in native ETH;
+- collection-specific offers denominated in WETH, made against an exact token ID;
+- seller cancellation and bulk invalidation of old orders by incrementing a wallet nonce;
+- expiration timestamps on every listing and offer;
+- a fixed 2.5% royalty paid to the artist's configured payout address on every marketplace fulfillment;
+- a 97.5% seller payout and no marketplace fee in the MVP;
+- browsing active listings, viewing an item, listing, buying, offering, accepting, and cancelling;
+- transaction status, wallet/network errors, and clear approval prompts.
+
+Offers use WETH rather than native ETH because an offer must remain executable later without locking ETH in this contract. At acceptance, the exchange uses the buyer's existing WETH balance and allowance. If either is insufficient, acceptance reverts. NFTs also require the owner's ERC-721 approval when a listing is bought or an offer is accepted. Neither listings nor offers guarantee future executability: the UI and indexer must mark orders inactive if ownership, approval, balance, allowance, nonce, or expiry changes.
+
+This scope assumes the existing collection is a standard ERC-721 contract with reliable `ownerOf` and `safeTransferFrom`, token metadata is usable, and it does not have transfer restrictions. Before development, record the exact collection contract, chain ID (1), artist payout address, WETH mainnet address, and whether the collection exposes ERC-2981. The exchange enforces the agreed 250 basis points itself; it does not rely on marketplaces voluntarily honoring ERC-2981. The artist payout address is immutable in the safest MVP; if business requirements demand rotation, use a two-step, time-delayed update controlled by a specified multisig and include that path in the audit.
+
+## Contract design and invariants
+
+Use one purpose-built exchange contract restricted to the named collection. Define separate EIP-712 listing and offer structs, each committing to the exchange address and chain through the domain separator and to: maker, NFT contract, token ID, payment token, gross price, expiry, maker nonce, and a unique salt/order ID. Offers additionally identify the intended owner as optional: the MVP recommendation is to leave the owner unrestricted so a valid offer follows the token, while only the current owner can accept it.
+
+On a listing purchase, verify the seller signature, current nonce, unused order ID, expiry, exact collection/payment asset, current ownership and approval, and exact ETH payment. Mark the order consumed before external calls, transfer the NFT with `safeTransferFrom`, then pay 2.5% to the artist and the remainder to the seller. On offer acceptance, perform the equivalent checks, mark consumed, pull WETH from the offeror, transfer the NFT, and distribute WETH. Royalty uses `grossPrice * 250 / 10_000`; the rounding remainder stays with the seller. There are no partial fills.
+
+Use `ReentrancyGuard`, checks-effects-interactions, custom errors, explicit zero-address/zero-price validation, and `SafeERC20`. Do not accept arbitrary ERC-20s or arbitrary NFT contracts. ETH payouts must work for contract wallets; a failed payout reverts the whole sale, with no retained balances. The contract has no owner withdrawal or rescue path because it should not custody assets. Emit complete events for fills, explicit cancellations, and nonce increments.
+
+Signatures must support EOAs and ERC-1271 contract wallets. An order is fillable only once. Cancellation may target an order ID, while nonce increment invalidates all older orders by that maker. A direct NFT transfer, approval revocation, insufficient WETH, or expired order causes a clean revert and is reflected by the indexer. Frontend prices are parsed as integer wei; no floating-point arithmetic is used for settlement values.
+
+## Four-week delivery plan
+
+### Week 1 — freeze behavior and build the contract skeleton
+
+- Confirm the collection contract, artist recipient, royalty rounding, WETH address, supported wallets, offer semantics, expiry bounds, and whether the payout recipient can ever change.
+- Verify the deployed ERC-721 behavior on a mainnet fork, including approvals, transfers, ERC-165/721, ERC-2981 if present, metadata, and any pause/operator restrictions.
+- Write the order schemas, state machine, trust model, invariants, revert behavior, event schema, and acceptance tests before implementation.
+- Implement listing purchase, exact-token WETH offer acceptance, per-order cancellation, nonce invalidation, EIP-712/1271 verification, and royalty splitting.
+- Add unit tests for authorization, expiry, replay, wrong chain/contract/asset, ownership changes, approvals, exact payment, rounding, and all failure atomicity.
+- Deliverable: reviewed specification, compiling contract, initial tests, and an auditor scope/version draft.
+
+### Week 2 — finish contracts and off-chain order services
+
+- Complete fuzz and invariant tests, including conservation of value, at-most-once fill, only-current-owner sale, and artist receiving exactly the computed royalty on every successful path.
+- Test malicious ERC-721 receivers, reverting ETH recipients, ERC-1271 wallets, reentrancy attempts, malformed signatures, WETH allowance/balance changes, cancellation/fill races, and front-running scenarios.
+- Deploy to Sepolia and to a pinned mainnet fork; publish verified source and deployment parameters.
+- Build a small API/database that validates signed orders before storing them and serves order/activity queries. Treat it as an availability/indexing layer, never as an authority over settlement.
+- Build an event indexer with deterministic replay, confirmation handling, reorg rollback, and periodic on-chain fillability reconciliation.
+- Deliverable: release-candidate contracts with green tests, deployed test instance, API schema, and indexed events.
+
+### Week 3 — product integration and audit handoff
+
+- Build collection grid, token detail, list/cancel/buy, make/withdraw offer, and accept-offer flows.
+- Add wallet connection, Ethereum-mainnet enforcement, EIP-712 signing, ERC-721 approval, WETH wrap/approval guidance, expiry selection, transaction simulation, pending/confirmed/failed states, and explorer links.
+- Show gross price, 2.5% artist royalty, seller proceeds, gas, expiry, and the counterparty action before every signature or transaction.
+- Add API abuse controls, schema validation, signature verification, duplicate suppression, observability, and stale-order cleanup.
+- Freeze the audited commit. Give auditors source, tests, deployment configuration, architecture and threat-model documents, known limitations, and reproducible commands. No contract feature changes after freeze without audit triage.
+- Deliverable: end-to-end staging MVP and audit-ready commit.
+
+### Week 4 — audit, fixes, and controlled launch
+
+- Auditor reviews the frozen code while the team runs QA on a fork/staging environment and completes operations documentation.
+- Triage every finding; fix in a dedicated branch, add a regression test for each defect, and submit the exact diff for auditor verification. Any material redesign returns to audit scope.
+- Run final mainnet-fork tests using the real collection, WETH, artist address, representative EOAs and contract wallets, plus listing/fill/cancel and offer/accept race tests.
+- Prepare deployment with compiler settings and constructor arguments pinned, multisig/timelock configured if applicable, source verification, monitoring alerts, incident contacts, frontend contract-address pinning, and a documented pause/response decision. If the contract is intentionally immutable and unpausable, state that explicitly in the incident plan.
+- Launch only after critical/high findings are resolved and auditor fixes are verified. Begin with a guarded public beta and monitor fills, reverts, royalty payments, indexing lag, and anomalous order activity.
+- Deliverable: auditor-verified commit, deployment record, runbook, and production MVP.
+
+The four-week target assumes a small experienced team, a promptly available auditor, no collection-contract changes, and no substantial findings requiring redesign. Audit booking should happen in week 1. If review cannot finish in week 4, deployment moves; the audit is not compressed.
+
+## Quote-ready smart-contract audit scope
+
+### In scope
+
+The quote should cover the exact frozen commit and line count supplied at handoff, including:
+
+- the exchange contract and all locally maintained libraries;
+- EIP-712 hashing/domain separation, ECDSA validation, ERC-1271 support, salt/order identity, replay prevention, and signature malleability behavior;
+- listing purchase with native ETH and exact-token offers with mainnet WETH;
+- ERC-721 ownership, approvals, `safeTransferFrom`, receiver callbacks, and compatibility with the specified deployed collection;
+- order expiry, explicit cancellation, nonce invalidation, fill-versus-cancel races, and transaction ordering/front-running consequences;
+- accounting for gross price, the 250 bps royalty, rounding, seller proceeds, exact `msg.value`, and conservation of ETH/WETH;
+- external-call ordering, reentrancy, denial of service from seller/artist/receiver contracts, atomic rollback, and unexpected token behavior;
+- authorization and any administration, payout-address update, pause, or upgrade mechanism that remains in the final design;
+- event correctness and sufficiency for reconstructing order state;
+- constructor/deployment parameters, compiler and optimizer settings, dependency versions, and deployment scripts;
+- unit, integration, fuzz, invariant, and mainnet-fork tests as supporting evidence, including their adequacy rather than merely their pass status.
+
+The auditor should review these required invariants explicitly:
+
+1. A successful fill transfers exactly the intended token from its current owner to the intended buyer, at most once.
+2. A fill cannot succeed without valid maker authorization, an unexpired and uninvalidated order, current ownership, and required approvals/balance.
+3. Every successful fill pays exactly `floor(grossPrice * 250 / 10_000)` to the artist and the entire remainder to the seller; the exchange retains nothing.
+4. No failure or reentrant callback can produce a partial fill, duplicate fill, stolen token, unauthorized cancellation, or lost/stuck funds.
+5. A signature for another order, chain, contract, NFT, token ID, asset, price, maker, nonce, expiry, or salt cannot be reused here.
+6. Cancellation and nonce invalidation have deterministic behavior under adversarial transaction ordering.
+
+### Deployment-specific external contracts
+
+Treat the deployed collection and canonical mainnet WETH as integration dependencies. Review the interfaces and the exchange's assumptions about them, and exercise both on a pinned mainnet fork. Their source code is not itself being audited. Provide auditors the exact addresses and fork block number before work begins.
+
+### Out of scope, quoted separately if desired
+
+- the pre-existing NFT collection implementation, metadata hosting, artwork, and provenance;
+- canonical WETH internals beyond integration assumptions;
+- frontend, API, database, indexer, hosting, wallet extensions, RPC providers, and block explorers;
+- compromise or misuse of user, artist, deployer, or multisig private keys; phishing and Discord impersonation;
+- economic appraisal, wash trading, stolen-NFT adjudication, sanctions/tax/legal review, and marketplace-policy compliance;
+- gas optimization except where it affects correctness or creates denial of service;
+- third-party dependency vulnerabilities outside the way this code uses them;
+- post-audit changes, future auction/bundle/bid-pool features, arbitrary collections or currencies, marketplace fees, custodial bids, and upgrades not present in the frozen commit.
+
+Although off-chain systems are outside the smart-contract quote, commission a separate application security review before broad launch. It should cover order API authorization and validation, injected/spoofed orders, stale-state presentation, indexer reorg handling, XSS/CSRF, wallet-signing UX, domain and contract-address integrity, secrets, rate limits, dependencies, and monitoring. The UI must never represent API presence as proof that an order is fillable; it should simulate or revalidate on-chain state immediately before submission.
+
+### Materials and quotation assumptions
+
+Send the auditor: repository access; frozen commit hash; Solidity source and source line count; exact compiler/optimizer/EVM settings; dependency lockfile; architecture diagram; order type hashes and worked examples; threat model; roles and privileges; deployment scripts and addresses; test commands and coverage; fork configuration; known issues; and the intended deployment date. Ask the quote to state reviewer count, person-days, start date, deliverables, retest allowance, and treatment of changes after freeze.
+
+The audit report should include severity-rated findings, proof or reproduction steps, recommended remediation, reviewed commit and file list, assumptions/limitations, and a final remediation status or retest letter tied to the deployment commit. Acceptance gates are: no open critical or high findings; medium findings fixed or explicitly risk-accepted in writing; all fixes regression-tested and reviewed; deployment bytecode reproducible from the reviewed source.
+
+## MVP acceptance criteria
+
+- An owner can sign a listing without transferring the NFT; another wallet can buy it atomically on a mainnet fork.
+- An owner can cancel one listing or invalidate all earlier orders, after which fulfillment reverts.
+- A buyer can sign a token-specific WETH offer without depositing funds into the exchange; the current owner can accept it atomically when balance and allowance remain sufficient.
+- Both sale paths pay 2.5% of gross consideration to the configured artist and 97.5% (plus any rounding remainder) to the seller, verified across fuzzed prices.
+- Replays, expired orders, wrong-chain signatures, stale ownership, missing approvals, insufficient funds/allowance, malformed signatures, and reentrant callbacks fail without changing ownership or balances.
+- The site accurately presents active/stale state, price breakdown, expiry, approvals, and transaction outcomes, and the indexer recovers from a tested reorg/replay scenario.

exec
/bin/bash -lc "wc -l plan.md && sed -n '1,24p' plan.md" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-24T195025Z-codex-no-skill-2/workspace
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
129 plan.md
# Four-week NFT marketplace MVP plan

## Proposed MVP

Build a narrow, non-custodial fixed-price marketplace for the existing 5,000-token Ethereum mainnet collection. The NFT remains in its owner's wallet while listed. Listings and offers are EIP-712 signed orders stored off-chain; only fulfillment, cancellation, and nonce invalidation touch the exchange contract. A sale atomically transfers the NFT and pays the seller and artist, so no party can receive one side without delivering the other.

The marketplace will support:

- fixed-price listings denominated in native ETH;
- collection-specific offers denominated in WETH, made against an exact token ID;
- seller cancellation and bulk invalidation of old orders by incrementing a wallet nonce;
- expiration timestamps on every listing and offer;
- a fixed 2.5% royalty paid to the artist's configured payout address on every marketplace fulfillment;
- a 97.5% seller payout and no marketplace fee in the MVP;
- browsing active listings, viewing an item, listing, buying, offering, accepting, and cancelling;
- transaction status, wallet/network errors, and clear approval prompts.

Offers use WETH rather than native ETH because an offer must remain executable later without locking ETH in this contract. At acceptance, the exchange uses the buyer's existing WETH balance and allowance. If either is insufficient, acceptance reverts. NFTs also require the owner's ERC-721 approval when a listing is bought or an offer is accepted. Neither listings nor offers guarantee future executability: the UI and indexer must mark orders inactive if ownership, approval, balance, allowance, nonce, or expiry changes.

This scope assumes the existing collection is a standard ERC-721 contract with reliable `ownerOf` and `safeTransferFrom`, token metadata is usable, and it does not have transfer restrictions. Before development, record the exact collection contract, chain ID (1), artist payout address, WETH mainnet address, and whether the collection exposes ERC-2981. The exchange enforces the agreed 250 basis points itself; it does not rely on marketplaces voluntarily honoring ERC-2981. The artist payout address is immutable in the safest MVP; if business requirements demand rotation, use a two-step, time-delayed update controlled by a specified multisig and include that path in the audit.

## Contract design and invariants

Use one purpose-built exchange contract restricted to the named collection. Define separate EIP-712 listing and offer structs, each committing to the exchange address and chain through the domain separator and to: maker, NFT contract, token ID, payment token, gross price, expiry, maker nonce, and a unique salt/order ID. Offers additionally identify the intended owner as optional: the MVP recommendation is to leave the owner unrestricted so a valid offer follows the token, while only the current owner can accept it.

diff --git a/artifacts/ship-quiz-001/2026-08-24T195025Z-codex-no-skill-2/workspace/plan.md b/artifacts/ship-quiz-001/2026-08-24T195025Z-codex-no-skill-2/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..6cec6b54dc0ba3e92d1f583b37cc55a052ab4914
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-08-24T195025Z-codex-no-skill-2/workspace/plan.md
@@ -0,0 +1,129 @@
+# Four-week NFT marketplace MVP plan
+
+## Proposed MVP
+
+Build a narrow, non-custodial fixed-price marketplace for the existing 5,000-token Ethereum mainnet collection. The NFT remains in its owner's wallet while listed. Listings and offers are EIP-712 signed orders stored off-chain; only fulfillment, cancellation, and nonce invalidation touch the exchange contract. A sale atomically transfers the NFT and pays the seller and artist, so no party can receive one side without delivering the other.
+
+The marketplace will support:
+
+- fixed-price listings denominated in native ETH;
+- collection-specific offers denominated in WETH, made against an exact token ID;
+- seller cancellation and bulk invalidation of old orders by incrementing a wallet nonce;
+- expiration timestamps on every listing and offer;
+- a fixed 2.5% royalty paid to the artist's configured payout address on every marketplace fulfillment;
+- a 97.5% seller payout and no marketplace fee in the MVP;
+- browsing active listings, viewing an item, listing, buying, offering, accepting, and cancelling;
+- transaction status, wallet/network errors, and clear approval prompts.
+
+Offers use WETH rather than native ETH because an offer must remain executable later without locking ETH in this contract. At acceptance, the exchange uses the buyer's existing WETH balance and allowance. If either is insufficient, acceptance reverts. NFTs also require the owner's ERC-721 approval when a listing is bought or an offer is accepted. Neither listings nor offers guarantee future executability: the UI and indexer must mark orders inactive if ownership, approval, balance, allowance, nonce, or expiry changes.
+
+This scope assumes the existing collection is a standard ERC-721 contract with reliable `ownerOf` and `safeTransferFrom`, token metadata is usable, and it does not have transfer restrictions. Before development, record the exact collection contract, chain ID (1), artist payout address, WETH mainnet address, and whether the collection exposes ERC-2981. The exchange enforces the agreed 250 basis points itself; it does not rely on marketplaces voluntarily honoring ERC-2981. The artist payout address is immutable in the safest MVP; if business requirements demand rotation, use a two-step, time-delayed update controlled by a specified multisig and include that path in the audit.
+
+## Contract design and invariants
+
+Use one purpose-built exchange contract restricted to the named collection. Define separate EIP-712 listing and offer structs, each committing to the exchange address and chain through the domain separator and to: maker, NFT contract, token ID, payment token, gross price, expiry, maker nonce, and a unique salt/order ID. Offers additionally identify the intended owner as optional: the MVP recommendation is to leave the owner unrestricted so a valid offer follows the token, while only the current owner can accept it.
+
+On a listing purchase, verify the seller signature, current nonce, unused order ID, expiry, exact collection/payment asset, current ownership and approval, and exact ETH payment. Mark the order consumed before external calls, transfer the NFT with `safeTransferFrom`, then pay 2.5% to the artist and the remainder to the seller. On offer acceptance, perform the equivalent checks, mark consumed, pull WETH from the offeror, transfer the NFT, and distribute WETH. Royalty uses `grossPrice * 250 / 10_000`; the rounding remainder stays with the seller. There are no partial fills.
+
+Use `ReentrancyGuard`, checks-effects-interactions, custom errors, explicit zero-address/zero-price validation, and `SafeERC20`. Do not accept arbitrary ERC-20s or arbitrary NFT contracts. ETH payouts must work for contract wallets; a failed payout reverts the whole sale, with no retained balances. The contract has no owner withdrawal or rescue path because it should not custody assets. Emit complete events for fills, explicit cancellations, and nonce increments.
+
+Signatures must support EOAs and ERC-1271 contract wallets. An order is fillable only once. Cancellation may target an order ID, while nonce increment invalidates all older orders by that maker. A direct NFT transfer, approval revocation, insufficient WETH, or expired order causes a clean revert and is reflected by the indexer. Frontend prices are parsed as integer wei; no floating-point arithmetic is used for settlement values.
+
+## Four-week delivery plan
+
+### Week 1 — freeze behavior and build the contract skeleton
+
+- Confirm the collection contract, artist recipient, royalty rounding, WETH address, supported wallets, offer semantics, expiry bounds, and whether the payout recipient can ever change.
+- Verify the deployed ERC-721 behavior on a mainnet fork, including approvals, transfers, ERC-165/721, ERC-2981 if present, metadata, and any pause/operator restrictions.
+- Write the order schemas, state machine, trust model, invariants, revert behavior, event schema, and acceptance tests before implementation.
+- Implement listing purchase, exact-token WETH offer acceptance, per-order cancellation, nonce invalidation, EIP-712/1271 verification, and royalty splitting.
+- Add unit tests for authorization, expiry, replay, wrong chain/contract/asset, ownership changes, approvals, exact payment, rounding, and all failure atomicity.
+- Deliverable: reviewed specification, compiling contract, initial tests, and an auditor scope/version draft.
+
+### Week 2 — finish contracts and off-chain order services
+
+- Complete fuzz and invariant tests, including conservation of value, at-most-once fill, only-current-owner sale, and artist receiving exactly the computed royalty on every successful path.
+- Test malicious ERC-721 receivers, reverting ETH recipients, ERC-1271 wallets, reentrancy attempts, malformed signatures, WETH allowance/balance changes, cancellation/fill races, and front-running scenarios.
+- Deploy to Sepolia and to a pinned mainnet fork; publish verified source and deployment parameters.
+- Build a small API/database that validates signed orders before storing them and serves order/activity queries. Treat it as an availability/indexing layer, never as an authority over settlement.
+- Build an event indexer with deterministic replay, confirmation handling, reorg rollback, and periodic on-chain fillability reconciliation.
+- Deliverable: release-candidate contracts with green tests, deployed test instance, API schema, and indexed events.
+
+### Week 3 — product integration and audit handoff
+
+- Build collection grid, token detail, list/cancel/buy, make/withdraw offer, and accept-offer flows.
+- Add wallet connection, Ethereum-mainnet enforcement, EIP-712 signing, ERC-721 approval, WETH wrap/approval guidance, expiry selection, transaction simulation, pending/confirmed/failed states, and explorer links.
+- Show gross price, 2.5% artist royalty, seller proceeds, gas, expiry, and the counterparty action before every signature or transaction.
+- Add API abuse controls, schema validation, signature verification, duplicate suppression, observability, and stale-order cleanup.
+- Freeze the audited commit. Give auditors source, tests, deployment configuration, architecture and threat-model documents, known limitations, and reproducible commands. No contract feature changes after freeze without audit triage.
+- Deliverable: end-to-end staging MVP and audit-ready commit.
+
+### Week 4 — audit, fixes, and controlled launch
+
+- Auditor reviews the frozen code while the team runs QA on a fork/staging environment and completes operations documentation.
+- Triage every finding; fix in a dedicated branch, add a regression test for each defect, and submit the exact diff for auditor verification. Any material redesign returns to audit scope.
+- Run final mainnet-fork tests using the real collection, WETH, artist address, representative EOAs and contract wallets, plus listing/fill/cancel and offer/accept race tests.
+- Prepare deployment with compiler settings and constructor arguments pinned, multisig/timelock configured if applicable, source verification, monitoring alerts, incident contacts, frontend contract-address pinning, and a documented pause/response decision. If the contract is intentionally immutable and unpausable, state that explicitly in the incident plan.
+- Launch only after critical/high findings are resolved and auditor fixes are verified. Begin with a guarded public beta and monitor fills, reverts, royalty payments, indexing lag, and anomalous order activity.
+- Deliverable: auditor-verified commit, deployment record, runbook, and production MVP.
+
+The four-week target assumes a small experienced team, a promptly available auditor, no collection-contract changes, and no substantial findings requiring redesign. Audit booking should happen in week 1. If review cannot finish in week 4, deployment moves; the audit is not compressed.
+
+## Quote-ready smart-contract audit scope
+
+### In scope
+
+The quote should cover the exact frozen commit and line count supplied at handoff, including:
+
+- the exchange contract and all locally maintained libraries;
+- EIP-712 hashing/domain separation, ECDSA validation, ERC-1271 support, salt/order identity, replay prevention, and signature malleability behavior;
+- listing purchase with native ETH and exact-token offers with mainnet WETH;
+- ERC-721 ownership, approvals, `safeTransferFrom`, receiver callbacks, and compatibility with the specified deployed collection;
+- order expiry, explicit cancellation, nonce invalidation, fill-versus-cancel races, and transaction ordering/front-running consequences;
+- accounting for gross price, the 250 bps royalty, rounding, seller proceeds, exact `msg.value`, and conservation of ETH/WETH;
+- external-call ordering, reentrancy, denial of service from seller/artist/receiver contracts, atomic rollback, and unexpected token behavior;
+- authorization and any administration, payout-address update, pause, or upgrade mechanism that remains in the final design;
+- event correctness and sufficiency for reconstructing order state;
+- constructor/deployment parameters, compiler and optimizer settings, dependency versions, and deployment scripts;
+- unit, integration, fuzz, invariant, and mainnet-fork tests as supporting evidence, including their adequacy rather than merely their pass status.
+
+The auditor should review these required invariants explicitly:
+
+1. A successful fill transfers exactly the intended token from its current owner to the intended buyer, at most once.
+2. A fill cannot succeed without valid maker authorization, an unexpired and uninvalidated order, current ownership, and required approvals/balance.
+3. Every successful fill pays exactly `floor(grossPrice * 250 / 10_000)` to the artist and the entire remainder to the seller; the exchange retains nothing.
+4. No failure or reentrant callback can produce a partial fill, duplicate fill, stolen token, unauthorized cancellation, or lost/stuck funds.
+5. A signature for another order, chain, contract, NFT, token ID, asset, price, maker, nonce, expiry, or salt cannot be reused here.
+6. Cancellation and nonce invalidation have deterministic behavior under adversarial transaction ordering.
+
+### Deployment-specific external contracts
+
+Treat the deployed collection and canonical mainnet WETH as integration dependencies. Review the interfaces and the exchange's assumptions about them, and exercise both on a pinned mainnet fork. Their source code is not itself being audited. Provide auditors the exact addresses and fork block number before work begins.
+
+### Out of scope, quoted separately if desired
+
+- the pre-existing NFT collection implementation, metadata hosting, artwork, and provenance;
+- canonical WETH internals beyond integration assumptions;
+- frontend, API, database, indexer, hosting, wallet extensions, RPC providers, and block explorers;
+- compromise or misuse of user, artist, deployer, or multisig private keys; phishing and Discord impersonation;
+- economic appraisal, wash trading, stolen-NFT adjudication, sanctions/tax/legal review, and marketplace-policy compliance;
+- gas optimization except where it affects correctness or creates denial of service;
+- third-party dependency vulnerabilities outside the way this code uses them;
+- post-audit changes, future auction/bundle/bid-pool features, arbitrary collections or currencies, marketplace fees, custodial bids, and upgrades not present in the frozen commit.
+
+Although off-chain systems are outside the smart-contract quote, commission a separate application security review before broad launch. It should cover order API authorization and validation, injected/spoofed orders, stale-state presentation, indexer reorg handling, XSS/CSRF, wallet-signing UX, domain and contract-address integrity, secrets, rate limits, dependencies, and monitoring. The UI must never represent API presence as proof that an order is fillable; it should simulate or revalidate on-chain state immediately before submission.
+
+### Materials and quotation assumptions
+
+Send the auditor: repository access; frozen commit hash; Solidity source and source line count; exact compiler/optimizer/EVM settings; dependency lockfile; architecture diagram; order type hashes and worked examples; threat model; roles and privileges; deployment scripts and addresses; test commands and coverage; fork configuration; known issues; and the intended deployment date. Ask the quote to state reviewer count, person-days, start date, deliverables, retest allowance, and treatment of changes after freeze.
+
+The audit report should include severity-rated findings, proof or reproduction steps, recommended remediation, reviewed commit and file list, assumptions/limitations, and a final remediation status or retest letter tied to the deployment commit. Acceptance gates are: no open critical or high findings; medium findings fixed or explicitly risk-accepted in writing; all fixes regression-tested and reviewed; deployment bytecode reproducible from the reviewed source.
+
+## MVP acceptance criteria
+
+- An owner can sign a listing without transferring the NFT; another wallet can buy it atomically on a mainnet fork.
+- An owner can cancel one listing or invalidate all earlier orders, after which fulfillment reverts.
+- A buyer can sign a token-specific WETH offer without depositing funds into the exchange; the current owner can accept it atomically when balance and allowance remain sufficient.
+- Both sale paths pay 2.5% of gross consideration to the configured artist and 97.5% (plus any rounding remainder) to the seller, verified across fuzzed prices.
+- Replays, expired orders, wrong-chain signatures, stale ownership, missing approvals, insufficient funds/allowance, malformed signatures, and reentrant callbacks fail without changing ownership or balances.
+- The site accurately presents active/stale state, price breakdown, expiry, approvals, and transaction outcomes, and the indexer recovers from a tested reorg/replay scenario.

codex
Created [plan.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-24T195025Z-codex-no-skill-2/workspace/plan.md) with the four-week MVP plan, contract design, audit scope, security invariants, exclusions, quotation materials, and acceptance criteria.
diff --git a/artifacts/ship-quiz-001/2026-08-24T195025Z-codex-no-skill-2/workspace/plan.md b/artifacts/ship-quiz-001/2026-08-24T195025Z-codex-no-skill-2/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..6cec6b54dc0ba3e92d1f583b37cc55a052ab4914
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-08-24T195025Z-codex-no-skill-2/workspace/plan.md
@@ -0,0 +1,129 @@
+# Four-week NFT marketplace MVP plan
+
+## Proposed MVP
+
+Build a narrow, non-custodial fixed-price marketplace for the existing 5,000-token Ethereum mainnet collection. The NFT remains in its owner's wallet while listed. Listings and offers are EIP-712 signed orders stored off-chain; only fulfillment, cancellation, and nonce invalidation touch the exchange contract. A sale atomically transfers the NFT and pays the seller and artist, so no party can receive one side without delivering the other.
+
+The marketplace will support:
+
+- fixed-price listings denominated in native ETH;
+- collection-specific offers denominated in WETH, made against an exact token ID;
+- seller cancellation and bulk invalidation of old orders by incrementing a wallet nonce;
+- expiration timestamps on every listing and offer;
+- a fixed 2.5% royalty paid to the artist's configured payout address on every marketplace fulfillment;
+- a 97.5% seller payout and no marketplace fee in the MVP;
+- browsing active listings, viewing an item, listing, buying, offering, accepting, and cancelling;
+- transaction status, wallet/network errors, and clear approval prompts.
+
+Offers use WETH rather than native ETH because an offer must remain executable later without locking ETH in this contract. At acceptance, the exchange uses the buyer's existing WETH balance and allowance. If either is insufficient, acceptance reverts. NFTs also require the owner's ERC-721 approval when a listing is bought or an offer is accepted. Neither listings nor offers guarantee future executability: the UI and indexer must mark orders inactive if ownership, approval, balance, allowance, nonce, or expiry changes.
+
+This scope assumes the existing collection is a standard ERC-721 contract with reliable `ownerOf` and `safeTransferFrom`, token metadata is usable, and it does not have transfer restrictions. Before development, record the exact collection contract, chain ID (1), artist payout address, WETH mainnet address, and whether the collection exposes ERC-2981. The exchange enforces the agreed 250 basis points itself; it does not rely on marketplaces voluntarily honoring ERC-2981. The artist payout address is immutable in the safest MVP; if business requirements demand rotation, use a two-step, time-delayed update controlled by a specified multisig and include that path in the audit.
+
+## Contract design and invariants
+
+Use one purpose-built exchange contract restricted to the named collection. Define separate EIP-712 listing and offer structs, each committing to the exchange address and chain through the domain separator and to: maker, NFT contract, token ID, payment token, gross price, expiry, maker nonce, and a unique salt/order ID. Offers additionally identify the intended owner as optional: the MVP recommendation is to leave the owner unrestricted so a valid offer follows the token, while only the current owner can accept it.
+
+On a listing purchase, verify the seller signature, current nonce, unused order ID, expiry, exact collection/payment asset, current ownership and approval, and exact ETH payment. Mark the order consumed before external calls, transfer the NFT with `safeTransferFrom`, then pay 2.5% to the artist and the remainder to the seller. On offer acceptance, perform the equivalent checks, mark consumed, pull WETH from the offeror, transfer the NFT, and distribute WETH. Royalty uses `grossPrice * 250 / 10_000`; the rounding remainder stays with the seller. There are no partial fills.
+
+Use `ReentrancyGuard`, checks-effects-interactions, custom errors, explicit zero-address/zero-price validation, and `SafeERC20`. Do not accept arbitrary ERC-20s or arbitrary NFT contracts. ETH payouts must work for contract wallets; a failed payout reverts the whole sale, with no retained balances. The contract has no owner withdrawal or rescue path because it should not custody assets. Emit complete events for fills, explicit cancellations, and nonce increments.
+
+Signatures must support EOAs and ERC-1271 contract wallets. An order is fillable only once. Cancellation may target an order ID, while nonce increment invalidates all older orders by that maker. A direct NFT transfer, approval revocation, insufficient WETH, or expired order causes a clean revert and is reflected by the indexer. Frontend prices are parsed as integer wei; no floating-point arithmetic is used for settlement values.
+
+## Four-week delivery plan
+
+### Week 1 — freeze behavior and build the contract skeleton
+
+- Confirm the collection contract, artist recipient, royalty rounding, WETH address, supported wallets, offer semantics, expiry bounds, and whether the payout recipient can ever change.
+- Verify the deployed ERC-721 behavior on a mainnet fork, including approvals, transfers, ERC-165/721, ERC-2981 if present, metadata, and any pause/operator restrictions.
+- Write the order schemas, state machine, trust model, invariants, revert behavior, event schema, and acceptance tests before implementation.
+- Implement listing purchase, exact-token WETH offer acceptance, per-order cancellation, nonce invalidation, EIP-712/1271 verification, and royalty splitting.
+- Add unit tests for authorization, expiry, replay, wrong chain/contract/asset, ownership changes, approvals, exact payment, rounding, and all failure atomicity.
+- Deliverable: reviewed specification, compiling contract, initial tests, and an auditor scope/version draft.
+
+### Week 2 — finish contracts and off-chain order services
+
+- Complete fuzz and invariant tests, including conservation of value, at-most-once fill, only-current-owner sale, and artist receiving exactly the computed royalty on every successful path.
+- Test malicious ERC-721 receivers, reverting ETH recipients, ERC-1271 wallets, reentrancy attempts, malformed signatures, WETH allowance/balance changes, cancellation/fill races, and front-running scenarios.
+- Deploy to Sepolia and to a pinned mainnet fork; publish verified source and deployment parameters.
+- Build a small API/database that validates signed orders before storing them and serves order/activity queries. Treat it as an availability/indexing layer, never as an authority over settlement.
+- Build an event indexer with deterministic replay, confirmation handling, reorg rollback, and periodic on-chain fillability reconciliation.
+- Deliverable: release-candidate contracts with green tests, deployed test instance, API schema, and indexed events.
+
+### Week 3 — product integration and audit handoff
+
+- Build collection grid, token detail, list/cancel/buy, make/withdraw offer, and accept-offer flows.
+- Add wallet connection, Ethereum-mainnet enforcement, EIP-712 signing, ERC-721 approval, WETH wrap/approval guidance, expiry selection, transaction simulation, pending/confirmed/failed states, and explorer links.
+- Show gross price, 2.5% artist royalty, seller proceeds, gas, expiry, and the counterparty action before every signature or transaction.
+- Add API abuse controls, schema validation, signature verification, duplicate suppression, observability, and stale-order cleanup.
+- Freeze the audited commit. Give auditors source, tests, deployment configuration, architecture and threat-model documents, known limitations, and reproducible commands. No contract feature changes after freeze without audit triage.
+- Deliverable: end-to-end staging MVP and audit-ready commit.
+
+### Week 4 — audit, fixes, and controlled launch
+
+- Auditor reviews the frozen code while the team runs QA on a fork/staging environment and completes operations documentation.
+- Triage every finding; fix in a dedicated branch, add a regression test for each defect, and submit the exact diff for auditor verification. Any material redesign returns to audit scope.
+- Run final mainnet-fork tests using the real collection, WETH, artist address, representative EOAs and contract wallets, plus listing/fill/cancel and offer/accept race tests.
+- Prepare deployment with compiler settings and constructor arguments pinned, multisig/timelock configured if applicable, source verification, monitoring alerts, incident contacts, frontend contract-address pinning, and a documented pause/response decision. If the contract is intentionally immutable and unpausable, state that explicitly in the incident plan.
+- Launch only after critical/high findings are resolved and auditor fixes are verified. Begin with a guarded public beta and monitor fills, reverts, royalty payments, indexing lag, and anomalous order activity.
+- Deliverable: auditor-verified commit, deployment record, runbook, and production MVP.
+
+The four-week target assumes a small experienced team, a promptly available auditor, no collection-contract changes, and no substantial findings requiring redesign. Audit booking should happen in week 1. If review cannot finish in week 4, deployment moves; the audit is not compressed.
+
+## Quote-ready smart-contract audit scope
+
+### In scope
+
+The quote should cover the exact frozen commit and line count supplied at handoff, including:
+
+- the exchange contract and all locally maintained libraries;
+- EIP-712 hashing/domain separation, ECDSA validation, ERC-1271 support, salt/order identity, replay prevention, and signature malleability behavior;
+- listing purchase with native ETH and exact-token offers with mainnet WETH;
+- ERC-721 ownership, approvals, `safeTransferFrom`, receiver callbacks, and compatibility with the specified deployed collection;
+- order expiry, explicit cancellation, nonce invalidation, fill-versus-cancel races, and transaction ordering/front-running consequences;
+- accounting for gross price, the 250 bps royalty, rounding, seller proceeds, exact `msg.value`, and conservation of ETH/WETH;
+- external-call ordering, reentrancy, denial of service from seller/artist/receiver contracts, atomic rollback, and unexpected token behavior;
+- authorization and any administration, payout-address update, pause, or upgrade mechanism that remains in the final design;
+- event correctness and sufficiency for reconstructing order state;
+- constructor/deployment parameters, compiler and optimizer settings, dependency versions, and deployment scripts;
+- unit, integration, fuzz, invariant, and mainnet-fork tests as supporting evidence, including their adequacy rather than merely their pass status.
+
+The auditor should review these required invariants explicitly:
+
+1. A successful fill transfers exactly the intended token from its current owner to the intended buyer, at most once.
+2. A fill cannot succeed without valid maker authorization, an unexpired and uninvalidated order, current ownership, and required approvals/balance.
+3. Every successful fill pays exactly `floor(grossPrice * 250 / 10_000)` to the artist and the entire remainder to the seller; the exchange retains nothing.
+4. No failure or reentrant callback can produce a partial fill, duplicate fill, stolen token, unauthorized cancellation, or lost/stuck funds.
+5. A signature for another order, chain, contract, NFT, token ID, asset, price, maker, nonce, expiry, or salt cannot be reused here.
+6. Cancellation and nonce invalidation have deterministic behavior under adversarial transaction ordering.
+
+### Deployment-specific external contracts
+
+Treat the deployed collection and canonical mainnet WETH as integration dependencies. Review the interfaces and the exchange's assumptions about them, and exercise both on a pinned mainnet fork. Their source code is not itself being audited. Provide auditors the exact addresses and fork block number before work begins.
+
+### Out of scope, quoted separately if desired
+
+- the pre-existing NFT collection implementation, metadata hosting, artwork, and provenance;
+- canonical WETH internals beyond integration assumptions;
+- frontend, API, database, indexer, hosting, wallet extensions, RPC providers, and block explorers;
+- compromise or misuse of user, artist, deployer, or multisig private keys; phishing and Discord impersonation;
+- economic appraisal, wash trading, stolen-NFT adjudication, sanctions/tax/legal review, and marketplace-policy compliance;
+- gas optimization except where it affects correctness or creates denial of service;
+- third-party dependency vulnerabilities outside the way this code uses them;
+- post-audit changes, future auction/bundle/bid-pool features, arbitrary collections or currencies, marketplace fees, custodial bids, and upgrades not present in the frozen commit.
+
+Although off-chain systems are outside the smart-contract quote, commission a separate application security review before broad launch. It should cover order API authorization and validation, injected/spoofed orders, stale-state presentation, indexer reorg handling, XSS/CSRF, wallet-signing UX, domain and contract-address integrity, secrets, rate limits, dependencies, and monitoring. The UI must never represent API presence as proof that an order is fillable; it should simulate or revalidate on-chain state immediately before submission.
+
+### Materials and quotation assumptions
+
+Send the auditor: repository access; frozen commit hash; Solidity source and source line count; exact compiler/optimizer/EVM settings; dependency lockfile; architecture diagram; order type hashes and worked examples; threat model; roles and privileges; deployment scripts and addresses; test commands and coverage; fork configuration; known issues; and the intended deployment date. Ask the quote to state reviewer count, person-days, start date, deliverables, retest allowance, and treatment of changes after freeze.
+
+The audit report should include severity-rated findings, proof or reproduction steps, recommended remediation, reviewed commit and file list, assumptions/limitations, and a final remediation status or retest letter tied to the deployment commit. Acceptance gates are: no open critical or high findings; medium findings fixed or explicitly risk-accepted in writing; all fixes regression-tested and reviewed; deployment bytecode reproducible from the reviewed source.
+
+## MVP acceptance criteria
+
+- An owner can sign a listing without transferring the NFT; another wallet can buy it atomically on a mainnet fork.
+- An owner can cancel one listing or invalidate all earlier orders, after which fulfillment reverts.
+- A buyer can sign a token-specific WETH offer without depositing funds into the exchange; the current owner can accept it atomically when balance and allowance remain sufficient.
+- Both sale paths pay 2.5% of gross consideration to the configured artist and 97.5% (plus any rounding remainder) to the seller, verified across fuzzed prices.
+- Replays, expired orders, wrong-chain signatures, stale ownership, missing approvals, insufficient funds/allowance, malformed signatures, and reentrant callbacks fail without changing ownership or balances.
+- The site accurately presents active/stale state, price breakdown, expiry, approvals, and transaction outcomes, and the indexer recovers from a tested reorg/replay scenario.

tokens used
17,254
Created [plan.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-24T195025Z-codex-no-skill-2/workspace/plan.md) with the four-week MVP plan, contract design, audit scope, security invariants, exclusions, quotation materials, and acceptance criteria.
