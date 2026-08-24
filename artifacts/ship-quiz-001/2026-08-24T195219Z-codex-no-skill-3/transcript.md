Reading additional input from stdin...
2026-08-24T19:52:19.448228Z ERROR codex_models_manager::cache: failed to load models cache: missing field `base_instructions` at line 97 column 5
OpenAI Codex v0.146.1
--------
workdir: /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-24T195219Z-codex-no-skill-3/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a03554-b82f-7ea2-9ae4-4fc2cf49cb98
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
2026-08-24T19:52:19.967601Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a03554-b82f-7ea2-9ae4-4fc2cf49cb98.tmp-1787601139764906752: line 2547: syntax error near unexpected token `('

codex
I’ll inspect the workspace context first, then write the four-week plan and a quote-ready audit scope into `plan.md`.
exec
/bin/bash -lc "ls -la && rg --files -g '"'!*node_modules*'"' | sed -n '1,120p'" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-24T195219Z-codex-no-skill-3/workspace
 succeeded in 2ms:
codex
The key design constraint is offers: a later-accepted offer cannot safely pull native ETH, so the MVP will use WETH offers with allowance/balance checks. Listings remain off-chain signed orders; only settlement touches the marketplace contract, so NFTs never enter escrow.
apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-24T195219Z-codex-no-skill-3/workspace/plan.md
diff --git a/artifacts/ship-quiz-001/2026-08-24T195219Z-codex-no-skill-3/workspace/plan.md b/artifacts/ship-quiz-001/2026-08-24T195219Z-codex-no-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..06f6fcc497a42d439f3e2832740279b22f94428e
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-08-24T195219Z-codex-no-skill-3/workspace/plan.md
@@ -0,0 +1,121 @@
+# Four-week NFT marketplace MVP plan
+
+## Product boundary and recommended design
+
+Build a collection-specific, fixed-price secondary marketplace for the existing 5,000-token Ethereum mainnet ERC-721 collection. Owners keep custody while an order is open. Listings and offers are EIP-712 signed off-chain and stored/indexed by the application; an on-chain settlement contract validates the signature and current state, transfers payment and the NFT atomically, and pays the artist 2.5% of the sale price.
+
+The seller approves the marketplace contract as an operator, but does not transfer the NFT into escrow. A listing can become unfillable if the seller transfers the token or revokes approval; the UI and transaction simulation must show that clearly.
+
+Use native ETH for direct listing purchases. Use WETH for offers: ETH cannot be pulled from a bidder's wallet later, whereas an accepted WETH offer can use `transferFrom` after the bidder has approved the marketplace. The bidder retains custody of the WETH, so an offer can likewise become unfillable if their balance or allowance falls. This is preferable to a deposit/escrow contract for the MVP.
+
+The artist royalty is enforced by this marketplace's settlement paths, not globally across every external marketplace or direct wallet transfer. The 2.5% is calculated as `salePrice * 250 / 10_000`; rounding remainder goes to the seller. No marketplace fee is included in the MVP. The royalty recipient should be an immutable artist multisig (or immutable collection-configured recipient), not an upgradeable admin setting.
+
+### Supported order flows
+
+- **List:** token owner signs a listing containing collection, token ID, seller, price, payment token (native ETH), expiry, and unique nonce. The API stores it and verifies ownership, approval, signature, collection, expiry, and nonce before displaying it.
+- **Buy:** buyer calls `buy(listing, signature)` with exactly the listing price. The contract revalidates the order, marks its order hash filled before external transfers, pays 2.5% to the artist, pays the remainder to the seller, and transfers the NFT to the buyer in one transaction. Payout failure reverts the entire sale.
+- **Cancel listing:** seller cancels on-chain by order hash or invalidates all their older orders with a monotonic counter/nonce. The API also removes the listing immediately, but UI deletion alone is not treated as cancellation. This protects against a copied signature being filled later.
+- **Make offer:** bidder signs an offer containing collection, optional specific token ID (MVP: token-specific only), bidder, WETH amount, expiry, and nonce after approving sufficient WETH. The API validates and displays it.
+- **Accept offer:** current token owner calls `acceptOffer(offer, signature)`. The contract checks that the caller owns the specified NFT, validates the bidder signature and nonce, marks the offer filled, pulls WETH from the bidder, splits it 2.5%/97.5%, and transfers the NFT atomically.
+- **Cancel offer:** bidder cancels the offer hash or increments their offer nonce on-chain. Reducing allowance or moving WETH also makes it unfillable but is not presented as canonical cancellation.
+
+Orders are domain-separated by chain ID and verifying-contract address and cannot be replayed across deployments. Every order has an expiry and nonce; hashes are single-fill. There are no partial fills, auctions, collection-wide offers, bundles, fee-on-transfer tokens, ERC-1155 assets, private sales, or upgradeability in this MVP.
+
+## Four-week implementation plan
+
+### Week 1 — specification, contract skeleton, and test harness
+
+- Confirm the deployed collection address, its exact ERC-721 behavior, artist payout multisig, mainnet WETH address, supported wallet stack, and whether the collection exposes ERC-2981. Record these as deployment inputs; the marketplace's enforced 250 bps split remains authoritative for its own fills.
+- Freeze typed-data schemas and state transitions for listing, offer, fill, exact cancellation, and bulk nonce invalidation. Document trust boundaries and failure states (stale ownership, revoked NFT approval, insufficient WETH/allowance, expiry, cancellation, and already-filled order).
+- Implement a non-upgradeable marketplace contract using audited OpenZeppelin primitives, `SafeERC20`, EIP-712/ECDSA validation (including ERC-1271 contract-wallet signatures if required at kickoff), and reentrancy protection/checks-effects-interactions.
+- Add Foundry unit tests and invariant/fuzz-test scaffolding. Deploy an initial testnet build and publish its verified source.
+- Exit criteria: reviewed written protocol specification, compiling contract, frozen external interface and EIP-712 types, happy-path tests for both settlement flows.
+
+### Week 2 — complete contract and adversarial testing
+
+- Implement exact-order and bulk cancellation, order-hash fill tracking, expiry enforcement, collection/payment-token allowlists, exact native-value handling, WETH settlement, royalty split, events, and safe NFT transfer behavior.
+- Test signature replay, chain/domain replay, nonce boundaries, double fills, ownership changes, approvals revoked mid-listing, bidder balance/allowance changes, malformed signatures, zero price, zero/invalid recipient, expired orders, self-sales, reentrancy through payout recipients and ERC-721 receivers, reverting recipients, rounding, and accidental ETH behavior.
+- Add stateful invariants: a hash fills at most once; canceled/expired orders never fill; successful settlement transfers exactly one NFT and conserves payment; artist receives exactly the defined royalty; no successful call leaves sale proceeds in the marketplace.
+- Produce a deploy script, testnet addresses, ABI, NatSpec, event definitions, and a Slither report with triage. Freeze contracts at the end of the week except for audit fixes.
+- Exit criteria: all unit/fuzz/invariant tests pass; static-analysis findings are resolved or documented; frontend team has a stable ABI.
+
+### Week 3 — indexer/API and user interface
+
+- Build listing/offer creation with wallet typed-data signing, signature recovery, server-side order validation, idempotent storage by order hash, and read models for token pages and owner views.
+- Index marketplace fill/cancel/nonce events and collection transfers. Revalidate live ownership, approval, expiry, WETH allowance/balance, and on-chain fill/cancel state before showing an order as actionable. Treat the chain as authoritative and handle reorganizations and duplicate events.
+- Build browse/detail pages and list, buy, cancel, offer, accept, and cancel-offer flows. Show price, 2.5% royalty, seller proceeds, WETH approval requirements, gas, expiry, and stale-order reasons before signing/sending.
+- Simulate transactions immediately before submission; wait for configured confirmations and reconcile pending/replaced/reverted transactions. Add WalletConnect-compatible wallets, error telemetry, rate limiting, schema validation, and an admin-free moderation flag that hides spam without affecting on-chain validity.
+- Exit criteria: end-to-end testnet walkthrough from two wallets for every supported flow, including stale and canceled orders.
+
+### Week 4 — audit handoff, fixes, release hardening, and mainnet launch
+
+- Deliver the frozen audit package below at the start of the week. No unreviewed contract feature changes after the audit commit.
+- Triage findings by severity, patch with regression tests, and give the auditor a small final diff/review commit. Re-run unit, fuzz, invariant, static-analysis, frontend, and testnet end-to-end suites.
+- Run operational checks: multisig recipient verification, deterministic deployment/config review, source verification, event/indexer recovery, RPC failover, monitoring/alerts, incident runbook, and UI pause/hide procedure. The settlement contract intentionally has no privileged pause or custody path.
+- Launch with a capped pilot cohort for 24–48 hours, monitor reverted fills and indexer lag, then open publicly. Publish contract address, verified source, audit report, supported collection/payment asset, and the warning that off-platform transfers do not enforce this royalty.
+- Exit criteria: auditor-approved remediation, reproducible mainnet deployment, verified bytecode, production monitoring, and signed deployment checklist.
+
+## Quote-ready smart-contract audit scope
+
+The quote should be based on the frozen repository commit supplied at handoff. Final filenames and SLOC are to be inserted after Week 2; the functional surface below is fixed now. Ask the auditor to quote the initial review plus one remediation review of a bounded diff.
+
+### In scope
+
+1. **Marketplace settlement contract (one non-upgradeable Solidity contract, target 250–400 logical SLOC):**
+   - EIP-712 domain and listing/offer struct hashing.
+   - EOA ECDSA validation and, only if retained in the frozen spec, ERC-1271 validation.
+   - `buy`, payable native-ETH listing settlement.
+   - `acceptOffer`, WETH offer settlement.
+   - `cancelOrder`/batch exact cancellation and monotonic bulk nonce invalidation.
+   - Filled/canceled state, nonce and expiry validation.
+   - ERC-721 ownership/approval and transfer interactions.
+   - WETH `transferFrom` and native/WETH royalty and seller payouts.
+   - Immutable collection, WETH, artist recipient, and 250 bps royalty configuration.
+   - Events and receive/fallback behavior.
+2. **Supporting first-party Solidity code (target 50–150 logical SLOC):** order/hash libraries, interfaces, custom errors, and deployment/configuration script to the extent it determines immutable constructor arguments.
+3. **Tests as review evidence, not trusted code:** unit, fuzz, invariant, fork, and regression tests. Auditor should identify missing cases as findings.
+4. **Deployment review:** constructor parameters, compiler and optimizer settings, mainnet addresses, bytecode/source verification procedure, ownership/admin absence, and reproducibility of deployed bytecode from the audited commit.
+
+Estimated total production Solidity scope: one principal contract plus small libraries/interfaces, approximately **300–550 logical SLOC** excluding vendored dependencies, generated code, tests, and scripts. The final request for quote will include exact `cloc` output, Solidity/compiler versions, repository commit SHA, dependency lockfile, test commands, coverage, Slither output, architecture/state-transition document, typed-data examples, and intended deployment parameters.
+
+### Security properties and attack questions the audit must cover
+
+- Authorization: only a valid, unexpired, unfilled, uncanceled signer order can execute; the signer/caller relationships for buying and accepting are correct; transferred tokens cannot be sold by an old owner.
+- Replay protection: order hashes, exact cancellations, bulk nonces, chain ID, verifying contract, expiry, and fill state prevent same-chain, cross-chain, cross-deployment, and double-fill replay.
+- Signature safety: canonical hashing/encoding, ECDSA malleability, malformed signatures, smart-contract-wallet behavior if supported, and no ambiguity between listing and offer types.
+- Accounting: exact price enforcement, no under/overpayment bug, integer rounding, 250 bps artist payout and remainder to seller, token/native conservation, safe ERC-20 semantics, and no stranded proceeds.
+- Atomicity and ordering: payment and NFT transfers either all succeed or all revert; state is consumed before untrusted external calls; reentrancy cannot fill twice, corrupt cancellation/nonces, or redirect proceeds.
+- External integrations: adversarial/reverting seller, artist, ERC-721 receiver, ERC-1271 wallet, and token callbacks; unusual behavior of the specific deployed collection and canonical mainnet WETH.
+- Denial of service and griefing: reverting payout recipients, stale signatures, nonce invalidation, batch bounds, gas growth, unsolicited ETH/NFTs, front-running of buys/acceptances/cancellations, and transaction-ordering consequences.
+- Economic correctness: self-sales, zero-value orders, offer/listing races, owner changes, approval/balance changes, royalty bypass boundaries, and confirmation that no privileged party can seize NFTs, funds, or alter fees/recipient.
+- Standards/interface correctness: ERC-721 safe transfers, EIP-712, EIP-1271 if included, ERC-20/WETH interactions, events sufficient for deterministic indexing, and expected behavior under chain reorganization/replacement.
+
+### Explicitly out of scope
+
+- The already-deployed NFT collection's full source, except its externally observable ERC-721 behavior needed by settlement.
+- Canonical WETH and unmodified OpenZeppelin dependencies; integration assumptions remain in scope.
+- Frontend, API, database, indexer, hosting, wallet providers, RPC providers, and Discord. These receive internal application security review, but are not part of the Solidity audit quote.
+- Key custody and compromise of buyers, sellers, deployer, artist multisig, CI, DNS, or hosting.
+- Third-party marketplace royalty enforcement, direct wallet transfers, tax/legal analysis, wash trading, price fairness, MEV prevention guarantees, and phishing/social engineering.
+- Features excluded from the MVP: auctions, bids escrowed in native ETH, collection-wide offers, bundles, ERC-1155, arbitrary ERC-20s, partial fills, private orders, upgradeable proxies, marketplace fees, and cross-chain support.
+- Post-audit feature changes or a deployment whose bytecode/config differs from the audited and remediation-reviewed commit; these require a separately quoted review.
+
+### Assumptions to state in the engagement
+
+- Solidity version and optimizer settings are pinned; only the named collection and canonical Ethereum mainnet WETH are accepted.
+- The collection behaves as the reviewed ERC-721 integration tests/fork tests establish and does not expose a transfer hook capable of changing marketplace state unexpectedly.
+- The artist recipient is a validated multisig able to receive ETH and WETH. Because a reverting ETH recipient would block native sales, the final implementation must either prove this recipient can receive ETH or use a narrowly specified pull-payment alternative, which would be added to scope.
+- Orders are not guaranteed fillable until mined: ownership, approvals, balances, allowances, cancellations, and competing fills can change. The UI/API do not provide security guarantees to the contract.
+- Auditor deliverables requested: severity-ranked report with proof/attack path and remediation advice; review of test coverage and stated invariants; review of the deployment configuration; and one remediation verification report tied to commit hashes.
+
+## Non-contract application and release review
+
+Although excluded from the Solidity auditor's quote, the team must review typed-data rendering, signature/request origin binding, API authorization, input limits, rate limiting, order poisoning/spam, database uniqueness, indexer reorg recovery, transaction simulation, dependency scanning, secrets, CSP, wallet/network switching, monitoring, and incident response. Contract safety does not make a malicious or compromised signing UI safe.
+
+## Decisions required before Week 1 ends
+
+- Exact collection address and verified interface behavior.
+- Artist payout multisig address and confirmation it can receive native ETH.
+- Whether ERC-1271 contract wallets are required for launch; if not, disclose EOA-only signing and add it after a new review.
+- Minimum/maximum order expiry and whether bulk cancellation is required in the initial UI (recommended: yes).
+- Confirmation that token-specific WETH offers, native-ETH listings, no platform fee, no upgradeability, and no privileged pause match the MVP boundary.

diff --git a/artifacts/ship-quiz-001/2026-08-24T195219Z-codex-no-skill-3/workspace/plan.md b/artifacts/ship-quiz-001/2026-08-24T195219Z-codex-no-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..06f6fcc497a42d439f3e2832740279b22f94428e
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-08-24T195219Z-codex-no-skill-3/workspace/plan.md
@@ -0,0 +1,121 @@
+# Four-week NFT marketplace MVP plan
+
+## Product boundary and recommended design
+
+Build a collection-specific, fixed-price secondary marketplace for the existing 5,000-token Ethereum mainnet ERC-721 collection. Owners keep custody while an order is open. Listings and offers are EIP-712 signed off-chain and stored/indexed by the application; an on-chain settlement contract validates the signature and current state, transfers payment and the NFT atomically, and pays the artist 2.5% of the sale price.
+
+The seller approves the marketplace contract as an operator, but does not transfer the NFT into escrow. A listing can become unfillable if the seller transfers the token or revokes approval; the UI and transaction simulation must show that clearly.
+
+Use native ETH for direct listing purchases. Use WETH for offers: ETH cannot be pulled from a bidder's wallet later, whereas an accepted WETH offer can use `transferFrom` after the bidder has approved the marketplace. The bidder retains custody of the WETH, so an offer can likewise become unfillable if their balance or allowance falls. This is preferable to a deposit/escrow contract for the MVP.
+
+The artist royalty is enforced by this marketplace's settlement paths, not globally across every external marketplace or direct wallet transfer. The 2.5% is calculated as `salePrice * 250 / 10_000`; rounding remainder goes to the seller. No marketplace fee is included in the MVP. The royalty recipient should be an immutable artist multisig (or immutable collection-configured recipient), not an upgradeable admin setting.
+
+### Supported order flows
+
+- **List:** token owner signs a listing containing collection, token ID, seller, price, payment token (native ETH), expiry, and unique nonce. The API stores it and verifies ownership, approval, signature, collection, expiry, and nonce before displaying it.
+- **Buy:** buyer calls `buy(listing, signature)` with exactly the listing price. The contract revalidates the order, marks its order hash filled before external transfers, pays 2.5% to the artist, pays the remainder to the seller, and transfers the NFT to the buyer in one transaction. Payout failure reverts the entire sale.
+- **Cancel listing:** seller cancels on-chain by order hash or invalidates all their older orders with a monotonic counter/nonce. The API also removes the listing immediately, but UI deletion alone is not treated as cancellation. This protects against a copied signature being filled later.
+- **Make offer:** bidder signs an offer containing collection, optional specific token ID (MVP: token-specific only), bidder, WETH amount, expiry, and nonce after approving sufficient WETH. The API validates and displays it.
+- **Accept offer:** current token owner calls `acceptOffer(offer, signature)`. The contract checks that the caller owns the specified NFT, validates the bidder signature and nonce, marks the offer filled, pulls WETH from the bidder, splits it 2.5%/97.5%, and transfers the NFT atomically.
+- **Cancel offer:** bidder cancels the offer hash or increments their offer nonce on-chain. Reducing allowance or moving WETH also makes it unfillable but is not presented as canonical cancellation.
+
+Orders are domain-separated by chain ID and verifying-contract address and cannot be replayed across deployments. Every order has an expiry and nonce; hashes are single-fill. There are no partial fills, auctions, collection-wide offers, bundles, fee-on-transfer tokens, ERC-1155 assets, private sales, or upgradeability in this MVP.
+
+## Four-week implementation plan
+
+### Week 1 — specification, contract skeleton, and test harness
+
+- Confirm the deployed collection address, its exact ERC-721 behavior, artist payout multisig, mainnet WETH address, supported wallet stack, and whether the collection exposes ERC-2981. Record these as deployment inputs; the marketplace's enforced 250 bps split remains authoritative for its own fills.
+- Freeze typed-data schemas and state transitions for listing, offer, fill, exact cancellation, and bulk nonce invalidation. Document trust boundaries and failure states (stale ownership, revoked NFT approval, insufficient WETH/allowance, expiry, cancellation, and already-filled order).
+- Implement a non-upgradeable marketplace contract using audited OpenZeppelin primitives, `SafeERC20`, EIP-712/ECDSA validation (including ERC-1271 contract-wallet signatures if required at kickoff), and reentrancy protection/checks-effects-interactions.
+- Add Foundry unit tests and invariant/fuzz-test scaffolding. Deploy an initial testnet build and publish its verified source.
+- Exit criteria: reviewed written protocol specification, compiling contract, frozen external interface and EIP-712 types, happy-path tests for both settlement flows.
+
+### Week 2 — complete contract and adversarial testing
+
+- Implement exact-order and bulk cancellation, order-hash fill tracking, expiry enforcement, collection/payment-token allowlists, exact native-value handling, WETH settlement, royalty split, events, and safe NFT transfer behavior.
+- Test signature replay, chain/domain replay, nonce boundaries, double fills, ownership changes, approvals revoked mid-listing, bidder balance/allowance changes, malformed signatures, zero price, zero/invalid recipient, expired orders, self-sales, reentrancy through payout recipients and ERC-721 receivers, reverting recipients, rounding, and accidental ETH behavior.
+- Add stateful invariants: a hash fills at most once; canceled/expired orders never fill; successful settlement transfers exactly one NFT and conserves payment; artist receives exactly the defined royalty; no successful call leaves sale proceeds in the marketplace.
+- Produce a deploy script, testnet addresses, ABI, NatSpec, event definitions, and a Slither report with triage. Freeze contracts at the end of the week except for audit fixes.
+- Exit criteria: all unit/fuzz/invariant tests pass; static-analysis findings are resolved or documented; frontend team has a stable ABI.
+
+### Week 3 — indexer/API and user interface
+
+- Build listing/offer creation with wallet typed-data signing, signature recovery, server-side order validation, idempotent storage by order hash, and read models for token pages and owner views.
+- Index marketplace fill/cancel/nonce events and collection transfers. Revalidate live ownership, approval, expiry, WETH allowance/balance, and on-chain fill/cancel state before showing an order as actionable. Treat the chain as authoritative and handle reorganizations and duplicate events.
+- Build browse/detail pages and list, buy, cancel, offer, accept, and cancel-offer flows. Show price, 2.5% royalty, seller proceeds, WETH approval requirements, gas, expiry, and stale-order reasons before signing/sending.
+- Simulate transactions immediately before submission; wait for configured confirmations and reconcile pending/replaced/reverted transactions. Add WalletConnect-compatible wallets, error telemetry, rate limiting, schema validation, and an admin-free moderation flag that hides spam without affecting on-chain validity.
+- Exit criteria: end-to-end testnet walkthrough from two wallets for every supported flow, including stale and canceled orders.
+
+### Week 4 — audit handoff, fixes, release hardening, and mainnet launch
+
+- Deliver the frozen audit package below at the start of the week. No unreviewed contract feature changes after the audit commit.
+- Triage findings by severity, patch with regression tests, and give the auditor a small final diff/review commit. Re-run unit, fuzz, invariant, static-analysis, frontend, and testnet end-to-end suites.
+- Run operational checks: multisig recipient verification, deterministic deployment/config review, source verification, event/indexer recovery, RPC failover, monitoring/alerts, incident runbook, and UI pause/hide procedure. The settlement contract intentionally has no privileged pause or custody path.
+- Launch with a capped pilot cohort for 24–48 hours, monitor reverted fills and indexer lag, then open publicly. Publish contract address, verified source, audit report, supported collection/payment asset, and the warning that off-platform transfers do not enforce this royalty.
+- Exit criteria: auditor-approved remediation, reproducible mainnet deployment, verified bytecode, production monitoring, and signed deployment checklist.
+
+## Quote-ready smart-contract audit scope
+
+The quote should be based on the frozen repository commit supplied at handoff. Final filenames and SLOC are to be inserted after Week 2; the functional surface below is fixed now. Ask the auditor to quote the initial review plus one remediation review of a bounded diff.
+
+### In scope
+
+1. **Marketplace settlement contract (one non-upgradeable Solidity contract, target 250–400 logical SLOC):**
+   - EIP-712 domain and listing/offer struct hashing.
+   - EOA ECDSA validation and, only if retained in the frozen spec, ERC-1271 validation.
+   - `buy`, payable native-ETH listing settlement.
+   - `acceptOffer`, WETH offer settlement.
+   - `cancelOrder`/batch exact cancellation and monotonic bulk nonce invalidation.
+   - Filled/canceled state, nonce and expiry validation.
+   - ERC-721 ownership/approval and transfer interactions.
+   - WETH `transferFrom` and native/WETH royalty and seller payouts.
+   - Immutable collection, WETH, artist recipient, and 250 bps royalty configuration.
+   - Events and receive/fallback behavior.
+2. **Supporting first-party Solidity code (target 50–150 logical SLOC):** order/hash libraries, interfaces, custom errors, and deployment/configuration script to the extent it determines immutable constructor arguments.
+3. **Tests as review evidence, not trusted code:** unit, fuzz, invariant, fork, and regression tests. Auditor should identify missing cases as findings.
+4. **Deployment review:** constructor parameters, compiler and optimizer settings, mainnet addresses, bytecode/source verification procedure, ownership/admin absence, and reproducibility of deployed bytecode from the audited commit.
+
+Estimated total production Solidity scope: one principal contract plus small libraries/interfaces, approximately **300–550 logical SLOC** excluding vendored dependencies, generated code, tests, and scripts. The final request for quote will include exact `cloc` output, Solidity/compiler versions, repository commit SHA, dependency lockfile, test commands, coverage, Slither output, architecture/state-transition document, typed-data examples, and intended deployment parameters.
+
+### Security properties and attack questions the audit must cover
+
+- Authorization: only a valid, unexpired, unfilled, uncanceled signer order can execute; the signer/caller relationships for buying and accepting are correct; transferred tokens cannot be sold by an old owner.
+- Replay protection: order hashes, exact cancellations, bulk nonces, chain ID, verifying contract, expiry, and fill state prevent same-chain, cross-chain, cross-deployment, and double-fill replay.
+- Signature safety: canonical hashing/encoding, ECDSA malleability, malformed signatures, smart-contract-wallet behavior if supported, and no ambiguity between listing and offer types.
+- Accounting: exact price enforcement, no under/overpayment bug, integer rounding, 250 bps artist payout and remainder to seller, token/native conservation, safe ERC-20 semantics, and no stranded proceeds.
+- Atomicity and ordering: payment and NFT transfers either all succeed or all revert; state is consumed before untrusted external calls; reentrancy cannot fill twice, corrupt cancellation/nonces, or redirect proceeds.
+- External integrations: adversarial/reverting seller, artist, ERC-721 receiver, ERC-1271 wallet, and token callbacks; unusual behavior of the specific deployed collection and canonical mainnet WETH.
+- Denial of service and griefing: reverting payout recipients, stale signatures, nonce invalidation, batch bounds, gas growth, unsolicited ETH/NFTs, front-running of buys/acceptances/cancellations, and transaction-ordering consequences.
+- Economic correctness: self-sales, zero-value orders, offer/listing races, owner changes, approval/balance changes, royalty bypass boundaries, and confirmation that no privileged party can seize NFTs, funds, or alter fees/recipient.
+- Standards/interface correctness: ERC-721 safe transfers, EIP-712, EIP-1271 if included, ERC-20/WETH interactions, events sufficient for deterministic indexing, and expected behavior under chain reorganization/replacement.
+
+### Explicitly out of scope
+
+- The already-deployed NFT collection's full source, except its externally observable ERC-721 behavior needed by settlement.
+- Canonical WETH and unmodified OpenZeppelin dependencies; integration assumptions remain in scope.
+- Frontend, API, database, indexer, hosting, wallet providers, RPC providers, and Discord. These receive internal application security review, but are not part of the Solidity audit quote.
+- Key custody and compromise of buyers, sellers, deployer, artist multisig, CI, DNS, or hosting.
+- Third-party marketplace royalty enforcement, direct wallet transfers, tax/legal analysis, wash trading, price fairness, MEV prevention guarantees, and phishing/social engineering.
+- Features excluded from the MVP: auctions, bids escrowed in native ETH, collection-wide offers, bundles, ERC-1155, arbitrary ERC-20s, partial fills, private orders, upgradeable proxies, marketplace fees, and cross-chain support.
+- Post-audit feature changes or a deployment whose bytecode/config differs from the audited and remediation-reviewed commit; these require a separately quoted review.
+
+### Assumptions to state in the engagement
+
+- Solidity version and optimizer settings are pinned; only the named collection and canonical Ethereum mainnet WETH are accepted.
+- The collection behaves as the reviewed ERC-721 integration tests/fork tests establish and does not expose a transfer hook capable of changing marketplace state unexpectedly.
+- The artist recipient is a validated multisig able to receive ETH and WETH. Because a reverting ETH recipient would block native sales, the final implementation must either prove this recipient can receive ETH or use a narrowly specified pull-payment alternative, which would be added to scope.
+- Orders are not guaranteed fillable until mined: ownership, approvals, balances, allowances, cancellations, and competing fills can change. The UI/API do not provide security guarantees to the contract.
+- Auditor deliverables requested: severity-ranked report with proof/attack path and remediation advice; review of test coverage and stated invariants; review of the deployment configuration; and one remediation verification report tied to commit hashes.
+
+## Non-contract application and release review
+
+Although excluded from the Solidity auditor's quote, the team must review typed-data rendering, signature/request origin binding, API authorization, input limits, rate limiting, order poisoning/spam, database uniqueness, indexer reorg recovery, transaction simulation, dependency scanning, secrets, CSP, wallet/network switching, monitoring, and incident response. Contract safety does not make a malicious or compromised signing UI safe.
+
+## Decisions required before Week 1 ends
+
+- Exact collection address and verified interface behavior.
+- Artist payout multisig address and confirmation it can receive native ETH.
+- Whether ERC-1271 contract wallets are required for launch; if not, disclose EOA-only signing and add it after a new review.
+- Minimum/maximum order expiry and whether bulk cancellation is required in the initial UI (recommended: yes).
+- Confirmation that token-specific WETH offers, native-ETH listings, no platform fee, no upgradeability, and no privileged pause match the MVP boundary.

exec
/bin/bash -lc "wc -l -w plan.md && sed -n '1,24p' plan.md && git diff --check" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-24T195219Z-codex-no-skill-3/workspace
 succeeded in 4ms:
diff --git a/artifacts/ship-quiz-001/2026-08-24T195219Z-codex-no-skill-3/workspace/plan.md b/artifacts/ship-quiz-001/2026-08-24T195219Z-codex-no-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..06f6fcc497a42d439f3e2832740279b22f94428e
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-08-24T195219Z-codex-no-skill-3/workspace/plan.md
@@ -0,0 +1,121 @@
+# Four-week NFT marketplace MVP plan
+
+## Product boundary and recommended design
+
+Build a collection-specific, fixed-price secondary marketplace for the existing 5,000-token Ethereum mainnet ERC-721 collection. Owners keep custody while an order is open. Listings and offers are EIP-712 signed off-chain and stored/indexed by the application; an on-chain settlement contract validates the signature and current state, transfers payment and the NFT atomically, and pays the artist 2.5% of the sale price.
+
+The seller approves the marketplace contract as an operator, but does not transfer the NFT into escrow. A listing can become unfillable if the seller transfers the token or revokes approval; the UI and transaction simulation must show that clearly.
+
+Use native ETH for direct listing purchases. Use WETH for offers: ETH cannot be pulled from a bidder's wallet later, whereas an accepted WETH offer can use `transferFrom` after the bidder has approved the marketplace. The bidder retains custody of the WETH, so an offer can likewise become unfillable if their balance or allowance falls. This is preferable to a deposit/escrow contract for the MVP.
+
+The artist royalty is enforced by this marketplace's settlement paths, not globally across every external marketplace or direct wallet transfer. The 2.5% is calculated as `salePrice * 250 / 10_000`; rounding remainder goes to the seller. No marketplace fee is included in the MVP. The royalty recipient should be an immutable artist multisig (or immutable collection-configured recipient), not an upgradeable admin setting.
+
+### Supported order flows
+
+- **List:** token owner signs a listing containing collection, token ID, seller, price, payment token (native ETH), expiry, and unique nonce. The API stores it and verifies ownership, approval, signature, collection, expiry, and nonce before displaying it.
+- **Buy:** buyer calls `buy(listing, signature)` with exactly the listing price. The contract revalidates the order, marks its order hash filled before external transfers, pays 2.5% to the artist, pays the remainder to the seller, and transfers the NFT to the buyer in one transaction. Payout failure reverts the entire sale.
+- **Cancel listing:** seller cancels on-chain by order hash or invalidates all their older orders with a monotonic counter/nonce. The API also removes the listing immediately, but UI deletion alone is not treated as cancellation. This protects against a copied signature being filled later.
+- **Make offer:** bidder signs an offer containing collection, optional specific token ID (MVP: token-specific only), bidder, WETH amount, expiry, and nonce after approving sufficient WETH. The API validates and displays it.
+- **Accept offer:** current token owner calls `acceptOffer(offer, signature)`. The contract checks that the caller owns the specified NFT, validates the bidder signature and nonce, marks the offer filled, pulls WETH from the bidder, splits it 2.5%/97.5%, and transfers the NFT atomically.
+- **Cancel offer:** bidder cancels the offer hash or increments their offer nonce on-chain. Reducing allowance or moving WETH also makes it unfillable but is not presented as canonical cancellation.
+
+Orders are domain-separated by chain ID and verifying-contract address and cannot be replayed across deployments. Every order has an expiry and nonce; hashes are single-fill. There are no partial fills, auctions, collection-wide offers, bundles, fee-on-transfer tokens, ERC-1155 assets, private sales, or upgradeability in this MVP.
+
+## Four-week implementation plan
+
+### Week 1 — specification, contract skeleton, and test harness
+
+- Confirm the deployed collection address, its exact ERC-721 behavior, artist payout multisig, mainnet WETH address, supported wallet stack, and whether the collection exposes ERC-2981. Record these as deployment inputs; the marketplace's enforced 250 bps split remains authoritative for its own fills.
+- Freeze typed-data schemas and state transitions for listing, offer, fill, exact cancellation, and bulk nonce invalidation. Document trust boundaries and failure states (stale ownership, revoked NFT approval, insufficient WETH/allowance, expiry, cancellation, and already-filled order).
+- Implement a non-upgradeable marketplace contract using audited OpenZeppelin primitives, `SafeERC20`, EIP-712/ECDSA validation (including ERC-1271 contract-wallet signatures if required at kickoff), and reentrancy protection/checks-effects-interactions.
+- Add Foundry unit tests and invariant/fuzz-test scaffolding. Deploy an initial testnet build and publish its verified source.
+- Exit criteria: reviewed written protocol specification, compiling contract, frozen external interface and EIP-712 types, happy-path tests for both settlement flows.
+
+### Week 2 — complete contract and adversarial testing
+
+- Implement exact-order and bulk cancellation, order-hash fill tracking, expiry enforcement, collection/payment-token allowlists, exact native-value handling, WETH settlement, royalty split, events, and safe NFT transfer behavior.
+- Test signature replay, chain/domain replay, nonce boundaries, double fills, ownership changes, approvals revoked mid-listing, bidder balance/allowance changes, malformed signatures, zero price, zero/invalid recipient, expired orders, self-sales, reentrancy through payout recipients and ERC-721 receivers, reverting recipients, rounding, and accidental ETH behavior.
+- Add stateful invariants: a hash fills at most once; canceled/expired orders never fill; successful settlement transfers exactly one NFT and conserves payment; artist receives exactly the defined royalty; no successful call leaves sale proceeds in the marketplace.
+- Produce a deploy script, testnet addresses, ABI, NatSpec, event definitions, and a Slither report with triage. Freeze contracts at the end of the week except for audit fixes.
+- Exit criteria: all unit/fuzz/invariant tests pass; static-analysis findings are resolved or documented; frontend team has a stable ABI.
+
+### Week 3 — indexer/API and user interface
+
+- Build listing/offer creation with wallet typed-data signing, signature recovery, server-side order validation, idempotent storage by order hash, and read models for token pages and owner views.
+- Index marketplace fill/cancel/nonce events and collection transfers. Revalidate live ownership, approval, expiry, WETH allowance/balance, and on-chain fill/cancel state before showing an order as actionable. Treat the chain as authoritative and handle reorganizations and duplicate events.
+- Build browse/detail pages and list, buy, cancel, offer, accept, and cancel-offer flows. Show price, 2.5% royalty, seller proceeds, WETH approval requirements, gas, expiry, and stale-order reasons before signing/sending.
+- Simulate transactions immediately before submission; wait for configured confirmations and reconcile pending/replaced/reverted transactions. Add WalletConnect-compatible wallets, error telemetry, rate limiting, schema validation, and an admin-free moderation flag that hides spam without affecting on-chain validity.
+- Exit criteria: end-to-end testnet walkthrough from two wallets for every supported flow, including stale and canceled orders.
+
+### Week 4 — audit handoff, fixes, release hardening, and mainnet launch
+
+- Deliver the frozen audit package below at the start of the week. No unreviewed contract feature changes after the audit commit.
+- Triage findings by severity, patch with regression tests, and give the auditor a small final diff/review commit. Re-run unit, fuzz, invariant, static-analysis, frontend, and testnet end-to-end suites.
+- Run operational checks: multisig recipient verification, deterministic deployment/config review, source verification, event/indexer recovery, RPC failover, monitoring/alerts, incident runbook, and UI pause/hide procedure. The settlement contract intentionally has no privileged pause or custody path.
+- Launch with a capped pilot cohort for 24–48 hours, monitor reverted fills and indexer lag, then open publicly. Publish contract address, verified source, audit report, supported collection/payment asset, and the warning that off-platform transfers do not enforce this royalty.
+- Exit criteria: auditor-approved remediation, reproducible mainnet deployment, verified bytecode, production monitoring, and signed deployment checklist.
+
+## Quote-ready smart-contract audit scope
+
+The quote should be based on the frozen repository commit supplied at handoff. Final filenames and SLOC are to be inserted after Week 2; the functional surface below is fixed now. Ask the auditor to quote the initial review plus one remediation review of a bounded diff.
+
+### In scope
+
+1. **Marketplace settlement contract (one non-upgradeable Solidity contract, target 250–400 logical SLOC):**
+   - EIP-712 domain and listing/offer struct hashing.
+   - EOA ECDSA validation and, only if retained in the frozen spec, ERC-1271 validation.
+   - `buy`, payable native-ETH listing settlement.
+   - `acceptOffer`, WETH offer settlement.
+   - `cancelOrder`/batch exact cancellation and monotonic bulk nonce invalidation.
+   - Filled/canceled state, nonce and expiry validation.
+   - ERC-721 ownership/approval and transfer interactions.
+   - WETH `transferFrom` and native/WETH royalty and seller payouts.
+   - Immutable collection, WETH, artist recipient, and 250 bps royalty configuration.
+   - Events and receive/fallback behavior.
+2. **Supporting first-party Solidity code (target 50–150 logical SLOC):** order/hash libraries, interfaces, custom errors, and deployment/configuration script to the extent it determines immutable constructor arguments.
+3. **Tests as review evidence, not trusted code:** unit, fuzz, invariant, fork, and regression tests. Auditor should identify missing cases as findings.
+4. **Deployment review:** constructor parameters, compiler and optimizer settings, mainnet addresses, bytecode/source verification procedure, ownership/admin absence, and reproducibility of deployed bytecode from the audited commit.
+
+Estimated total production Solidity scope: one principal contract plus small libraries/interfaces, approximately **300–550 logical SLOC** excluding vendored dependencies, generated code, tests, and scripts. The final request for quote will include exact `cloc` output, Solidity/compiler versions, repository commit SHA, dependency lockfile, test commands, coverage, Slither output, architecture/state-transition document, typed-data examples, and intended deployment parameters.
+
+### Security properties and attack questions the audit must cover
+
+- Authorization: only a valid, unexpired, unfilled, uncanceled signer order can execute; the signer/caller relationships for buying and accepting are correct; transferred tokens cannot be sold by an old owner.
+- Replay protection: order hashes, exact cancellations, bulk nonces, chain ID, verifying contract, expiry, and fill state prevent same-chain, cross-chain, cross-deployment, and double-fill replay.
+- Signature safety: canonical hashing/encoding, ECDSA malleability, malformed signatures, smart-contract-wallet behavior if supported, and no ambiguity between listing and offer types.
+- Accounting: exact price enforcement, no under/overpayment bug, integer rounding, 250 bps artist payout and remainder to seller, token/native conservation, safe ERC-20 semantics, and no stranded proceeds.
+- Atomicity and ordering: payment and NFT transfers either all succeed or all revert; state is consumed before untrusted external calls; reentrancy cannot fill twice, corrupt cancellation/nonces, or redirect proceeds.
+- External integrations: adversarial/reverting seller, artist, ERC-721 receiver, ERC-1271 wallet, and token callbacks; unusual behavior of the specific deployed collection and canonical mainnet WETH.
+- Denial of service and griefing: reverting payout recipients, stale signatures, nonce invalidation, batch bounds, gas growth, unsolicited ETH/NFTs, front-running of buys/acceptances/cancellations, and transaction-ordering consequences.
+- Economic correctness: self-sales, zero-value orders, offer/listing races, owner changes, approval/balance changes, royalty bypass boundaries, and confirmation that no privileged party can seize NFTs, funds, or alter fees/recipient.
+- Standards/interface correctness: ERC-721 safe transfers, EIP-712, EIP-1271 if included, ERC-20/WETH interactions, events sufficient for deterministic indexing, and expected behavior under chain reorganization/replacement.
+
+### Explicitly out of scope
+
+- The already-deployed NFT collection's full source, except its externally observable ERC-721 behavior needed by settlement.
+- Canonical WETH and unmodified OpenZeppelin dependencies; integration assumptions remain in scope.
+- Frontend, API, database, indexer, hosting, wallet providers, RPC providers, and Discord. These receive internal application security review, but are not part of the Solidity audit quote.
+- Key custody and compromise of buyers, sellers, deployer, artist multisig, CI, DNS, or hosting.
+- Third-party marketplace royalty enforcement, direct wallet transfers, tax/legal analysis, wash trading, price fairness, MEV prevention guarantees, and phishing/social engineering.
+- Features excluded from the MVP: auctions, bids escrowed in native ETH, collection-wide offers, bundles, ERC-1155, arbitrary ERC-20s, partial fills, private orders, upgradeable proxies, marketplace fees, and cross-chain support.
+- Post-audit feature changes or a deployment whose bytecode/config differs from the audited and remediation-reviewed commit; these require a separately quoted review.
+
+### Assumptions to state in the engagement
+
+- Solidity version and optimizer settings are pinned; only the named collection and canonical Ethereum mainnet WETH are accepted.
+- The collection behaves as the reviewed ERC-721 integration tests/fork tests establish and does not expose a transfer hook capable of changing marketplace state unexpectedly.
+- The artist recipient is a validated multisig able to receive ETH and WETH. Because a reverting ETH recipient would block native sales, the final implementation must either prove this recipient can receive ETH or use a narrowly specified pull-payment alternative, which would be added to scope.
+- Orders are not guaranteed fillable until mined: ownership, approvals, balances, allowances, cancellations, and competing fills can change. The UI/API do not provide security guarantees to the contract.
+- Auditor deliverables requested: severity-ranked report with proof/attack path and remediation advice; review of test coverage and stated invariants; review of the deployment configuration; and one remediation verification report tied to commit hashes.
+
+## Non-contract application and release review
+
+Although excluded from the Solidity auditor's quote, the team must review typed-data rendering, signature/request origin binding, API authorization, input limits, rate limiting, order poisoning/spam, database uniqueness, indexer reorg recovery, transaction simulation, dependency scanning, secrets, CSP, wallet/network switching, monitoring, and incident response. Contract safety does not make a malicious or compromised signing UI safe.
+
+## Decisions required before Week 1 ends
+
+- Exact collection address and verified interface behavior.
+- Artist payout multisig address and confirmation it can receive native ETH.
+- Whether ERC-1271 contract wallets are required for launch; if not, disclose EOA-only signing and add it after a new review.
+- Minimum/maximum order expiry and whether bulk cancellation is required in the initial UI (recommended: yes).
+- Confirmation that token-specific WETH offers, native-ETH listings, no platform fee, no upgradeability, and no privileged pause match the MVP boundary.

codex
Created [plan.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-24T195219Z-codex-no-skill-3/workspace/plan.md).

It includes the four-week MVP schedule, non-custodial signed-order architecture, WETH-based offers, enforced 2.5% royalty, settlement and cancellation flows, security properties, precise audit boundaries, estimated Solidity SLOC, exclusions, assumptions, and auditor deliverables. `git diff --check` passes.
diff --git a/artifacts/ship-quiz-001/2026-08-24T195219Z-codex-no-skill-3/workspace/plan.md b/artifacts/ship-quiz-001/2026-08-24T195219Z-codex-no-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..06f6fcc497a42d439f3e2832740279b22f94428e
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-08-24T195219Z-codex-no-skill-3/workspace/plan.md
@@ -0,0 +1,121 @@
+# Four-week NFT marketplace MVP plan
+
+## Product boundary and recommended design
+
+Build a collection-specific, fixed-price secondary marketplace for the existing 5,000-token Ethereum mainnet ERC-721 collection. Owners keep custody while an order is open. Listings and offers are EIP-712 signed off-chain and stored/indexed by the application; an on-chain settlement contract validates the signature and current state, transfers payment and the NFT atomically, and pays the artist 2.5% of the sale price.
+
+The seller approves the marketplace contract as an operator, but does not transfer the NFT into escrow. A listing can become unfillable if the seller transfers the token or revokes approval; the UI and transaction simulation must show that clearly.
+
+Use native ETH for direct listing purchases. Use WETH for offers: ETH cannot be pulled from a bidder's wallet later, whereas an accepted WETH offer can use `transferFrom` after the bidder has approved the marketplace. The bidder retains custody of the WETH, so an offer can likewise become unfillable if their balance or allowance falls. This is preferable to a deposit/escrow contract for the MVP.
+
+The artist royalty is enforced by this marketplace's settlement paths, not globally across every external marketplace or direct wallet transfer. The 2.5% is calculated as `salePrice * 250 / 10_000`; rounding remainder goes to the seller. No marketplace fee is included in the MVP. The royalty recipient should be an immutable artist multisig (or immutable collection-configured recipient), not an upgradeable admin setting.
+
+### Supported order flows
+
+- **List:** token owner signs a listing containing collection, token ID, seller, price, payment token (native ETH), expiry, and unique nonce. The API stores it and verifies ownership, approval, signature, collection, expiry, and nonce before displaying it.
+- **Buy:** buyer calls `buy(listing, signature)` with exactly the listing price. The contract revalidates the order, marks its order hash filled before external transfers, pays 2.5% to the artist, pays the remainder to the seller, and transfers the NFT to the buyer in one transaction. Payout failure reverts the entire sale.
+- **Cancel listing:** seller cancels on-chain by order hash or invalidates all their older orders with a monotonic counter/nonce. The API also removes the listing immediately, but UI deletion alone is not treated as cancellation. This protects against a copied signature being filled later.
+- **Make offer:** bidder signs an offer containing collection, optional specific token ID (MVP: token-specific only), bidder, WETH amount, expiry, and nonce after approving sufficient WETH. The API validates and displays it.
+- **Accept offer:** current token owner calls `acceptOffer(offer, signature)`. The contract checks that the caller owns the specified NFT, validates the bidder signature and nonce, marks the offer filled, pulls WETH from the bidder, splits it 2.5%/97.5%, and transfers the NFT atomically.
+- **Cancel offer:** bidder cancels the offer hash or increments their offer nonce on-chain. Reducing allowance or moving WETH also makes it unfillable but is not presented as canonical cancellation.
+
+Orders are domain-separated by chain ID and verifying-contract address and cannot be replayed across deployments. Every order has an expiry and nonce; hashes are single-fill. There are no partial fills, auctions, collection-wide offers, bundles, fee-on-transfer tokens, ERC-1155 assets, private sales, or upgradeability in this MVP.
+
+## Four-week implementation plan
+
+### Week 1 — specification, contract skeleton, and test harness
+
+- Confirm the deployed collection address, its exact ERC-721 behavior, artist payout multisig, mainnet WETH address, supported wallet stack, and whether the collection exposes ERC-2981. Record these as deployment inputs; the marketplace's enforced 250 bps split remains authoritative for its own fills.
+- Freeze typed-data schemas and state transitions for listing, offer, fill, exact cancellation, and bulk nonce invalidation. Document trust boundaries and failure states (stale ownership, revoked NFT approval, insufficient WETH/allowance, expiry, cancellation, and already-filled order).
+- Implement a non-upgradeable marketplace contract using audited OpenZeppelin primitives, `SafeERC20`, EIP-712/ECDSA validation (including ERC-1271 contract-wallet signatures if required at kickoff), and reentrancy protection/checks-effects-interactions.
+- Add Foundry unit tests and invariant/fuzz-test scaffolding. Deploy an initial testnet build and publish its verified source.
+- Exit criteria: reviewed written protocol specification, compiling contract, frozen external interface and EIP-712 types, happy-path tests for both settlement flows.
+
+### Week 2 — complete contract and adversarial testing
+
+- Implement exact-order and bulk cancellation, order-hash fill tracking, expiry enforcement, collection/payment-token allowlists, exact native-value handling, WETH settlement, royalty split, events, and safe NFT transfer behavior.
+- Test signature replay, chain/domain replay, nonce boundaries, double fills, ownership changes, approvals revoked mid-listing, bidder balance/allowance changes, malformed signatures, zero price, zero/invalid recipient, expired orders, self-sales, reentrancy through payout recipients and ERC-721 receivers, reverting recipients, rounding, and accidental ETH behavior.
+- Add stateful invariants: a hash fills at most once; canceled/expired orders never fill; successful settlement transfers exactly one NFT and conserves payment; artist receives exactly the defined royalty; no successful call leaves sale proceeds in the marketplace.
+- Produce a deploy script, testnet addresses, ABI, NatSpec, event definitions, and a Slither report with triage. Freeze contracts at the end of the week except for audit fixes.
+- Exit criteria: all unit/fuzz/invariant tests pass; static-analysis findings are resolved or documented; frontend team has a stable ABI.
+
+### Week 3 — indexer/API and user interface
+
+- Build listing/offer creation with wallet typed-data signing, signature recovery, server-side order validation, idempotent storage by order hash, and read models for token pages and owner views.
+- Index marketplace fill/cancel/nonce events and collection transfers. Revalidate live ownership, approval, expiry, WETH allowance/balance, and on-chain fill/cancel state before showing an order as actionable. Treat the chain as authoritative and handle reorganizations and duplicate events.
+- Build browse/detail pages and list, buy, cancel, offer, accept, and cancel-offer flows. Show price, 2.5% royalty, seller proceeds, WETH approval requirements, gas, expiry, and stale-order reasons before signing/sending.
+- Simulate transactions immediately before submission; wait for configured confirmations and reconcile pending/replaced/reverted transactions. Add WalletConnect-compatible wallets, error telemetry, rate limiting, schema validation, and an admin-free moderation flag that hides spam without affecting on-chain validity.
+- Exit criteria: end-to-end testnet walkthrough from two wallets for every supported flow, including stale and canceled orders.
+
+### Week 4 — audit handoff, fixes, release hardening, and mainnet launch
+
+- Deliver the frozen audit package below at the start of the week. No unreviewed contract feature changes after the audit commit.
+- Triage findings by severity, patch with regression tests, and give the auditor a small final diff/review commit. Re-run unit, fuzz, invariant, static-analysis, frontend, and testnet end-to-end suites.
+- Run operational checks: multisig recipient verification, deterministic deployment/config review, source verification, event/indexer recovery, RPC failover, monitoring/alerts, incident runbook, and UI pause/hide procedure. The settlement contract intentionally has no privileged pause or custody path.
+- Launch with a capped pilot cohort for 24–48 hours, monitor reverted fills and indexer lag, then open publicly. Publish contract address, verified source, audit report, supported collection/payment asset, and the warning that off-platform transfers do not enforce this royalty.
+- Exit criteria: auditor-approved remediation, reproducible mainnet deployment, verified bytecode, production monitoring, and signed deployment checklist.
+
+## Quote-ready smart-contract audit scope
+
+The quote should be based on the frozen repository commit supplied at handoff. Final filenames and SLOC are to be inserted after Week 2; the functional surface below is fixed now. Ask the auditor to quote the initial review plus one remediation review of a bounded diff.
+
+### In scope
+
+1. **Marketplace settlement contract (one non-upgradeable Solidity contract, target 250–400 logical SLOC):**
+   - EIP-712 domain and listing/offer struct hashing.
+   - EOA ECDSA validation and, only if retained in the frozen spec, ERC-1271 validation.
+   - `buy`, payable native-ETH listing settlement.
+   - `acceptOffer`, WETH offer settlement.
+   - `cancelOrder`/batch exact cancellation and monotonic bulk nonce invalidation.
+   - Filled/canceled state, nonce and expiry validation.
+   - ERC-721 ownership/approval and transfer interactions.
+   - WETH `transferFrom` and native/WETH royalty and seller payouts.
+   - Immutable collection, WETH, artist recipient, and 250 bps royalty configuration.
+   - Events and receive/fallback behavior.
+2. **Supporting first-party Solidity code (target 50–150 logical SLOC):** order/hash libraries, interfaces, custom errors, and deployment/configuration script to the extent it determines immutable constructor arguments.
+3. **Tests as review evidence, not trusted code:** unit, fuzz, invariant, fork, and regression tests. Auditor should identify missing cases as findings.
+4. **Deployment review:** constructor parameters, compiler and optimizer settings, mainnet addresses, bytecode/source verification procedure, ownership/admin absence, and reproducibility of deployed bytecode from the audited commit.
+
+Estimated total production Solidity scope: one principal contract plus small libraries/interfaces, approximately **300–550 logical SLOC** excluding vendored dependencies, generated code, tests, and scripts. The final request for quote will include exact `cloc` output, Solidity/compiler versions, repository commit SHA, dependency lockfile, test commands, coverage, Slither output, architecture/state-transition document, typed-data examples, and intended deployment parameters.
+
+### Security properties and attack questions the audit must cover
+
+- Authorization: only a valid, unexpired, unfilled, uncanceled signer order can execute; the signer/caller relationships for buying and accepting are correct; transferred tokens cannot be sold by an old owner.
+- Replay protection: order hashes, exact cancellations, bulk nonces, chain ID, verifying contract, expiry, and fill state prevent same-chain, cross-chain, cross-deployment, and double-fill replay.
+- Signature safety: canonical hashing/encoding, ECDSA malleability, malformed signatures, smart-contract-wallet behavior if supported, and no ambiguity between listing and offer types.
+- Accounting: exact price enforcement, no under/overpayment bug, integer rounding, 250 bps artist payout and remainder to seller, token/native conservation, safe ERC-20 semantics, and no stranded proceeds.
+- Atomicity and ordering: payment and NFT transfers either all succeed or all revert; state is consumed before untrusted external calls; reentrancy cannot fill twice, corrupt cancellation/nonces, or redirect proceeds.
+- External integrations: adversarial/reverting seller, artist, ERC-721 receiver, ERC-1271 wallet, and token callbacks; unusual behavior of the specific deployed collection and canonical mainnet WETH.
+- Denial of service and griefing: reverting payout recipients, stale signatures, nonce invalidation, batch bounds, gas growth, unsolicited ETH/NFTs, front-running of buys/acceptances/cancellations, and transaction-ordering consequences.
+- Economic correctness: self-sales, zero-value orders, offer/listing races, owner changes, approval/balance changes, royalty bypass boundaries, and confirmation that no privileged party can seize NFTs, funds, or alter fees/recipient.
+- Standards/interface correctness: ERC-721 safe transfers, EIP-712, EIP-1271 if included, ERC-20/WETH interactions, events sufficient for deterministic indexing, and expected behavior under chain reorganization/replacement.
+
+### Explicitly out of scope
+
+- The already-deployed NFT collection's full source, except its externally observable ERC-721 behavior needed by settlement.
+- Canonical WETH and unmodified OpenZeppelin dependencies; integration assumptions remain in scope.
+- Frontend, API, database, indexer, hosting, wallet providers, RPC providers, and Discord. These receive internal application security review, but are not part of the Solidity audit quote.
+- Key custody and compromise of buyers, sellers, deployer, artist multisig, CI, DNS, or hosting.
+- Third-party marketplace royalty enforcement, direct wallet transfers, tax/legal analysis, wash trading, price fairness, MEV prevention guarantees, and phishing/social engineering.
+- Features excluded from the MVP: auctions, bids escrowed in native ETH, collection-wide offers, bundles, ERC-1155, arbitrary ERC-20s, partial fills, private orders, upgradeable proxies, marketplace fees, and cross-chain support.
+- Post-audit feature changes or a deployment whose bytecode/config differs from the audited and remediation-reviewed commit; these require a separately quoted review.
+
+### Assumptions to state in the engagement
+
+- Solidity version and optimizer settings are pinned; only the named collection and canonical Ethereum mainnet WETH are accepted.
+- The collection behaves as the reviewed ERC-721 integration tests/fork tests establish and does not expose a transfer hook capable of changing marketplace state unexpectedly.
+- The artist recipient is a validated multisig able to receive ETH and WETH. Because a reverting ETH recipient would block native sales, the final implementation must either prove this recipient can receive ETH or use a narrowly specified pull-payment alternative, which would be added to scope.
+- Orders are not guaranteed fillable until mined: ownership, approvals, balances, allowances, cancellations, and competing fills can change. The UI/API do not provide security guarantees to the contract.
+- Auditor deliverables requested: severity-ranked report with proof/attack path and remediation advice; review of test coverage and stated invariants; review of the deployment configuration; and one remediation verification report tied to commit hashes.
+
+## Non-contract application and release review
+
+Although excluded from the Solidity auditor's quote, the team must review typed-data rendering, signature/request origin binding, API authorization, input limits, rate limiting, order poisoning/spam, database uniqueness, indexer reorg recovery, transaction simulation, dependency scanning, secrets, CSP, wallet/network switching, monitoring, and incident response. Contract safety does not make a malicious or compromised signing UI safe.
+
+## Decisions required before Week 1 ends
+
+- Exact collection address and verified interface behavior.
+- Artist payout multisig address and confirmation it can receive native ETH.
+- Whether ERC-1271 contract wallets are required for launch; if not, disclose EOA-only signing and add it after a new review.
+- Minimum/maximum order expiry and whether bulk cancellation is required in the initial UI (recommended: yes).
+- Confirmation that token-specific WETH offers, native-ETH listings, no platform fee, no upgradeability, and no privileged pause match the MVP boundary.

tokens used
17,799
Created [plan.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-24T195219Z-codex-no-skill-3/workspace/plan.md).

It includes the four-week MVP schedule, non-custodial signed-order architecture, WETH-based offers, enforced 2.5% royalty, settlement and cancellation flows, security properties, precise audit boundaries, estimated Solidity SLOC, exclusions, assumptions, and auditor deliverables. `git diff --check` passes.
