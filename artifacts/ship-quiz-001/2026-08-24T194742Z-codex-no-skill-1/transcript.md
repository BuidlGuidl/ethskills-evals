2026-08-24T19:47:55.386257Z  WARN sqlx::query: slow statement: execution time exceeded alert threshold summary="DELETE FROM logs WHERE …" db.statement="\n\nDELETE FROM logs WHERE ts < ?\n" rows_affected=20730 rows_returned=0 elapsed=1.05365646s elapsed_secs=1.05365646 slow_threshold=1s
Reading additional input from stdin...
2026-08-24T19:47:55.592166Z ERROR codex_models_manager::cache: failed to load models cache: missing field `base_instructions` at line 97 column 5
OpenAI Codex v0.146.1
--------
workdir: /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-24T194742Z-codex-no-skill-1/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a03550-b294-74d2-b4d4-9c1053e08441
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
2026-08-24T19:47:56.405470Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a03550-b294-74d2-b4d4-9c1053e08441.tmp-1787600876200831644: line 2547: syntax error near unexpected token `('

codex
I’ll turn this into an implementation-ready four-week plan and a quoteable smart-contract audit scope, including the non-escrow sale and offer flows, royalty settlement, trust assumptions, and explicit exclusions.
exec
/bin/bash -lc "rg --files -g '"'!node_modules'"' | sed -n '1,120p'" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-24T194742Z-codex-no-skill-1/workspace
 succeeded in 17ms:
TASK.md

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-24T194742Z-codex-no-skill-1/workspace/plan.md
diff --git a/artifacts/ship-quiz-001/2026-08-24T194742Z-codex-no-skill-1/workspace/plan.md b/artifacts/ship-quiz-001/2026-08-24T194742Z-codex-no-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..74535c4a26b490533404c6192447c48eaeaa251f
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-08-24T194742Z-codex-no-skill-1/workspace/plan.md
@@ -0,0 +1,138 @@
+# NFT Marketplace MVP: four-week build plan and audit scope
+
+## MVP definition and key decisions
+
+The MVP is a fixed-price, non-custodial marketplace for the existing 5,000-token Ethereum mainnet ERC-721 collection. A listing is an EIP-712 signature made off chain, not an on-chain deposit. The seller remains the token owner and can transfer it elsewhere at any time. A purchase is one atomic transaction: the marketplace verifies the order, transfers the NFT from seller to buyer, pays 2.5% to the artist, and pays 97.5% to the seller. The buyer pays gas.
+
+Offers use WETH, not raw ETH. An offer that can be accepted later cannot safely pull native ETH from a bidder's wallet; WETH provides `transferFrom`. The bidder signs an EIP-712 offer and grants the marketplace a WETH allowance. The owner later accepts it, atomically transferring the NFT and splitting the WETH proceeds. No NFT or funds are escrowed merely by creating a listing or offer. The UI should make the one-time ERC-721 operator approval and WETH approval explicit.
+
+For a 0.4 ETH resale, the artist receives 0.01 ETH and the seller receives 0.39 ETH. The fee is computed as `salePrice * 250 / 10_000`, rounding down; the seller receives the exact remainder so no dust is retained. There is no additional platform fee in the MVP.
+
+### Contract design
+
+Deploy one small marketplace contract configured for the existing collection, canonical mainnet WETH, an artist payout address, and an immutable fee of 250 basis points. Keeping these immutable avoids an admin being able to redirect royalties or change economics after orders have been signed. If future fee changes are required, deploy a new marketplace and domain rather than making this MVP upgradeable.
+
+Orders contain at least:
+
+- `seller`/`bidder`, collection address, token ID, price, expiry, per-user nonce, and optional designated taker;
+- a side/type discriminator so a listing signature cannot be interpreted as an offer;
+- an EIP-712 domain bound to marketplace address, chain ID, name, and version.
+
+The contract exposes narrowly scoped entry points equivalent to:
+
+- `buy(Listing, signature)` payable, requiring exact `msg.value`;
+- `acceptOffer(Offer, signature)`;
+- `cancelNonce(uint256)` and `incrementMinNonce()` (or equivalent bitmap cancellation) for one-order and bulk cancellation;
+- read helpers for order hashes, cancellation state, and domain data.
+
+At execution it checks signature validity (EOA via ECDSA and smart-contract wallets via ERC-1271), expiry, nonce status, collection/token, current ownership, approval, nonzero price, and designated taker when set. It marks the order consumed before external calls, then performs the ERC-721 transfer and payments under a reentrancy guard. A successful fill or cancellation makes the order permanently unusable. Failed ownership, balance, allowance, approval, or transfer checks revert the entire transaction.
+
+For native-ETH sales, payout calls either both succeed or the sale reverts; the contract must never silently strand sale proceeds. For accepted offers, canonical WETH is pulled directly in the transaction and split between artist and seller. The implementation will use audited OpenZeppelin primitives and `SafeERC20`, reject accidental direct ETH transfers, and include an explicit recovery policy only for assets sent accidentally (with no ability to recover assets owed during an active transaction). Whether contract-wallet payout recipients are supported through calls, rather than `transfer`, is covered by tests.
+
+EIP-2981 is not relied on to enforce payment: it is only a royalty-information standard and the existing collection may not implement it. This marketplace enforces the configured 2.5% in both settlement paths. It cannot force royalties on transfers or sales performed outside this marketplace, which must be stated plainly in the product copy.
+
+### Product surface
+
+The site will show collection browsing, token ownership and metadata, active signed listings, wallet connection, list/cancel/buy, make/cancel/accept offer, transaction state, and an activity view sourced from contract events. A lightweight order service stores and serves signed orders; it never has signing keys or custody. Before showing an order as actionable, the indexer/API checks expiry, nonce, ownership, and approvals. The contract remains authoritative, so stale orders shown by the API fail safely on chain.
+
+The API stores order payload, signature, status, and timestamps; validates the typed data before accepting it; rate-limits submissions; and indexes fills/cancellations from a finality-aware block cursor. Metadata is cached but token ownership is read from chain/indexed events. The frontend previews the exact seller/artist split and warns when an approval, allowance, balance, ownership change, or gas-price condition makes an order unavailable.
+
+## Four-week build plan
+
+### Week 1 — specification, prototype, and foundations
+
+- Confirm collection address, ERC-721 behavior, artist payout address (preferably a Safe), canonical mainnet WETH address, supported wallets, hosting, RPC/indexing provider, and required confirmations.
+- Freeze the order schemas, EIP-712 domain, nonce/cancellation model, rounding rule, event schema, revert behavior, and the ETH-listing/WETH-offer decision in a short protocol specification with sequence diagrams.
+- Implement the contract skeleton and a local proof of both settlement paths against a mock ERC-721, WETH, EOA signatures, and ERC-1271 wallet signatures.
+- Scaffold frontend and order API/database; ingest all 5,000 token IDs and metadata; implement read-only collection and token pages.
+- Establish CI for formatting, compilation, unit tests, static analysis, coverage, and deterministic deployment. Create separate deployer and artist Safe procedures; no production private key enters CI.
+
+**Exit:** reviewed protocol spec, order fixtures shared by contract/backend/frontend, local list/buy and offer/accept demos, and auditor confirms the proposed scope is quoteable.
+
+### Week 2 — complete contract and trading flows
+
+- Complete listing fill, offer acceptance, exact royalty splits, individual and bulk cancellation, replay protection, expiry, designated taker, ERC-1271, and events.
+- Build API signature validation, order persistence/querying, status reconciliation, and chain-event indexer with reorg-safe cursor handling.
+- Build list, cancel, buy, make-offer, cancel-offer, and accept-offer UI, including ERC-721 approval and WETH allowance steps.
+- Add unit and fuzz tests for prices and rounding, nonce boundaries, expired/stale orders, invalid/malleable signatures, wrong chain/contract/side, transfer failures, hostile recipients/tokens, reentrancy, and repeated fills.
+
+**Exit:** feature-complete testnet release; all state transitions are driven by signed orders and verified events, with no custodial service role.
+
+### Week 3 — integration, adversarial testing, and release candidate
+
+- Run end-to-end tests with the actual collection contract behavior on a mainnet fork and a public testnet deployment; exercise EOAs, a Safe/ERC-1271 wallet, and contract buyers implementing ERC-721 receiver logic.
+- Run static analysis, invariant/fuzz suites, gas snapshots, frontend/API tests, and manual abuse testing. Core invariants: one order fills at most once; cancellation is final; only the current owner can sell; buyer receives exactly the NFT paid for; artist plus seller payout equals price; contract balance does not increase after a successful normal fill.
+- Threat-model signature phishing, replay across chains/contracts/order sides, front-running, stale API data, compromised API/RPC, reorgs, denial-of-service payout recipients, approval risks, and accidental asset transfers. Resolve all critical/high internal findings.
+- Finish monitoring, event dashboards, error reporting, incident runbook, deployment/verification scripts, user terms and royalty limitations. Freeze the release-candidate commit and compiler/dependency lockfiles.
+
+**Exit:** tagged release candidate, reproducible build, green CI and fork tests, completed audit package. No feature changes after handoff without notifying the auditor.
+
+### Week 4 — audit, remediation, and launch gate
+
+- Auditor reviews the frozen commit while the team performs frontend accessibility/usability checks and operational rehearsal without changing scoped contracts.
+- Triage findings daily. Fix scoped code only; provide each fix as a small commit with a regression test and written response. Auditor reviews fixes and issues a final report/addendum.
+- Deploy with the Safe-controlled procedure, verify source and constructor arguments, run read-only and low-value smoke tests, seed the indexer, and validate monitoring.
+- Launch only when all critical/high findings are fixed and retested, medium findings are fixed or explicitly accepted with rationale, contract addresses match the audited bytecode/configuration, and rollback/pause communications are ready. Because the proposed immutable contract has no pause switch, an incident response disables order publication in the UI/API, warns users to revoke approvals, and migrates to a new deployment; already signed orders are invalid on the new domain.
+
+**Exit:** verified mainnet deployment tied to the final audit commit and report, runbook owner assigned, and 48-hour heightened monitoring scheduled.
+
+## Precise smart-contract audit scope
+
+### In-scope deliverable
+
+The quote should cover one Solidity marketplace contract plus only the locally maintained libraries/interfaces it uses. The final package supplied at the end of week 3 will identify exact repository URL, commit SHA, Solidity/compiler settings, dependency lockfile, deployed/configured addresses, and source-line count. Estimate for quoting before implementation: **one primary contract, approximately 300–450 nonblank/noncomment Solidity lines, plus tests; no proxy and no upgrade mechanism**. If the implementation exceeds 500 such lines, adds a contract, changes custody, or adds upgradeability/admin controls, it requires scope and quote revision.
+
+Auditor activities requested:
+
+- manual review of every in-scope Solidity line and the protocol/order-schema specification;
+- independent build and test execution, plus review of unit, fuzz, invariant, fork, and deployment tests;
+- automated static analysis as a supplement to manual review;
+- validation of EIP-712 hashes against frontend/backend fixtures and EOA/ERC-1271 verification;
+- mainnet-fork validation against the exact existing collection and canonical WETH;
+- written findings with severity, impact, exploit scenario, affected lines, and remediation; one remediation review of fixes made within five business days; final report suitable for publication.
+
+### Security properties and attack paths to assess
+
+The audit must determine whether:
+
+1. Only a valid, unexpired, uncancelled authorization from the relevant seller or bidder can execute, and signatures cannot replay across chain, deployment, order side, token, nonce, or after fill/cancellation.
+2. A listing can execute only while its signer owns the specified token and has authorized the marketplace; an offer can be accepted only by the current owner, and optional taker restrictions cannot be bypassed.
+3. Every successful sale is atomic: the exact token changes hands once, exactly 250 bps goes to the configured artist, the seller gets the remainder, and the marketplace retains no normal-sale funds. Integer rounding and tiny prices cannot create excess fees or underflow.
+4. ETH value accounting is exact and WETH allowance/balance handling is safe. Unexpected ETH, malicious fallback/receiver hooks, ERC-777-like behavior, non-standard ERC-20 returns, and accidental assets cannot steal user funds or corrupt state. (Production uses only canonical WETH, but unsafe generic assumptions should still be identified.)
+5. Checks-effects-interactions, the reentrancy guard, and consumed-order state prevent reentrant or duplicate fills through seller, artist, buyer, NFT receiver, ERC-1271, ERC-721, or token callbacks.
+6. ECDSA malleability, forged ERC-1271 responses, malformed signatures, zero addresses/prices, expiry and nonce edge cases, bulk-cancel boundaries, griefing, front-running, and denial-of-service conditions are handled as specified.
+7. The contract has no hidden custody or privilege path; configuration is immutable and correct; any recovery function cannot seize NFTs, WETH, or ETH involved in settlement; events accurately support reconciliation.
+8. Gas use remains viable for normal fills and an attacker cannot create unbounded loops or storage growth in an execution path.
+
+The auditor should also review approval consequences: a marketplace operator approval allows transfers only through contract code, so every callable path must be checked for arbitrary-transfer bugs. API compromise must not be sufficient to forge or alter an order, though it may hide, delay, or front-run public orders.
+
+### Assumptions and external dependencies
+
+- The existing collection is the single configured ERC-721 and conforms to the transfer/approval behavior validated on the fork. Its own code and metadata hosting are dependencies, not being re-audited.
+- Canonical mainnet WETH is trusted and not re-audited. OpenZeppelin pinned dependencies are reviewed for correct integration, not audited line by line.
+- The artist payout address is supplied correctly and can receive ETH/WETH; operational compromise of that address is outside contract prevention.
+- Owners may transfer a listed NFT or revoke approval, and bidders may spend WETH or revoke allowance. Such orders becoming unfillable is expected, not a protocol failure.
+- Anyone can submit a valid signed order on chain. The order API is an availability/indexing layer and cannot guarantee cancellation before a transaction already in the mempool executes. Users needing immediate certainty should submit on-chain cancellation and wait for confirmation.
+- Normal Ethereum assumptions apply: no chain-finality guarantee beyond the configured confirmation policy, miners/builders can reorder transactions, and compromised wallets can sign valid malicious orders.
+
+### Explicitly out of scope
+
+- Re-audit of the 2024 ERC-721 collection, WETH, OpenZeppelin, Safe, wallets, RPC providers, Ethereum consensus, bridges, or metadata/media hosting.
+- Frontend, API, database, indexer, cloud/IAM, DNS, CI/CD, analytics, and key-management penetration testing. The auditor should verify typed-data fixtures and integration assumptions, but a full web/security review needs a separate quote.
+- Legal, tax, sanctions, marketplace-operator, consumer-protection, and royalty-enforceability advice.
+- Auctions, bids funded with native ETH escrow, trait offers, collection offers, bundles, partial fills, ERC-1155, lazy minting, private relayers, gasless settlement, fiat, other ERC-20 currencies, platform fees, royalty registries/splits, upgradeability, governance, and cross-chain support.
+- Economic guarantees for sales outside this marketplace or prevention of direct wallet-to-wallet transfers.
+
+### Audit handoff checklist and change control
+
+The handoff contains the frozen commit, source tree, exact line-count report, architecture and trust-boundary document, order type hashes and sample signatures, state-transition/invariant list, test and coverage output, static-analysis output, known issues, fork instructions, deployment scripts, constructor/config values, and expected bytecode. The auditor receives a point of contact and can request a walkthrough.
+
+Any change to in-scope Solidity, compiler settings, dependencies, EIP-712 schema/domain, fee math, configured collection/WETH/artist, or deployment architecture after freeze is sent to the auditor as a diff. Documentation-only and out-of-scope application changes are logged. No modified bytecode ships without written confirmation that the diff was reviewed or a clearly disclosed unaudited-change exception.
+
+## MVP acceptance and launch criteria
+
+- On a mainnet fork, an owner can sign a listing while retaining custody; a buyer atomically purchases it with ETH; and balances show the exact 2.5%/97.5% split.
+- A bidder can sign a WETH offer without depositing funds; the current owner can atomically accept it with the same split.
+- Individual and bulk cancellation, expiry, ownership/approval changes, insufficient WETH/allowance, and replay attempts behave predictably and are represented correctly in the UI.
+- EOA and ERC-1271 orders work, all critical invariants pass fuzz/invariant tests, source and deployment are reproducible, and monitoring catches fills, cancellations, indexer lag, RPC failure, and unexpected contract balances.
+- The final audit report covers the deployed commit/configuration and satisfies the week-4 launch gate above.

diff --git a/artifacts/ship-quiz-001/2026-08-24T194742Z-codex-no-skill-1/workspace/plan.md b/artifacts/ship-quiz-001/2026-08-24T194742Z-codex-no-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..74535c4a26b490533404c6192447c48eaeaa251f
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-08-24T194742Z-codex-no-skill-1/workspace/plan.md
@@ -0,0 +1,138 @@
+# NFT Marketplace MVP: four-week build plan and audit scope
+
+## MVP definition and key decisions
+
+The MVP is a fixed-price, non-custodial marketplace for the existing 5,000-token Ethereum mainnet ERC-721 collection. A listing is an EIP-712 signature made off chain, not an on-chain deposit. The seller remains the token owner and can transfer it elsewhere at any time. A purchase is one atomic transaction: the marketplace verifies the order, transfers the NFT from seller to buyer, pays 2.5% to the artist, and pays 97.5% to the seller. The buyer pays gas.
+
+Offers use WETH, not raw ETH. An offer that can be accepted later cannot safely pull native ETH from a bidder's wallet; WETH provides `transferFrom`. The bidder signs an EIP-712 offer and grants the marketplace a WETH allowance. The owner later accepts it, atomically transferring the NFT and splitting the WETH proceeds. No NFT or funds are escrowed merely by creating a listing or offer. The UI should make the one-time ERC-721 operator approval and WETH approval explicit.
+
+For a 0.4 ETH resale, the artist receives 0.01 ETH and the seller receives 0.39 ETH. The fee is computed as `salePrice * 250 / 10_000`, rounding down; the seller receives the exact remainder so no dust is retained. There is no additional platform fee in the MVP.
+
+### Contract design
+
+Deploy one small marketplace contract configured for the existing collection, canonical mainnet WETH, an artist payout address, and an immutable fee of 250 basis points. Keeping these immutable avoids an admin being able to redirect royalties or change economics after orders have been signed. If future fee changes are required, deploy a new marketplace and domain rather than making this MVP upgradeable.
+
+Orders contain at least:
+
+- `seller`/`bidder`, collection address, token ID, price, expiry, per-user nonce, and optional designated taker;
+- a side/type discriminator so a listing signature cannot be interpreted as an offer;
+- an EIP-712 domain bound to marketplace address, chain ID, name, and version.
+
+The contract exposes narrowly scoped entry points equivalent to:
+
+- `buy(Listing, signature)` payable, requiring exact `msg.value`;
+- `acceptOffer(Offer, signature)`;
+- `cancelNonce(uint256)` and `incrementMinNonce()` (or equivalent bitmap cancellation) for one-order and bulk cancellation;
+- read helpers for order hashes, cancellation state, and domain data.
+
+At execution it checks signature validity (EOA via ECDSA and smart-contract wallets via ERC-1271), expiry, nonce status, collection/token, current ownership, approval, nonzero price, and designated taker when set. It marks the order consumed before external calls, then performs the ERC-721 transfer and payments under a reentrancy guard. A successful fill or cancellation makes the order permanently unusable. Failed ownership, balance, allowance, approval, or transfer checks revert the entire transaction.
+
+For native-ETH sales, payout calls either both succeed or the sale reverts; the contract must never silently strand sale proceeds. For accepted offers, canonical WETH is pulled directly in the transaction and split between artist and seller. The implementation will use audited OpenZeppelin primitives and `SafeERC20`, reject accidental direct ETH transfers, and include an explicit recovery policy only for assets sent accidentally (with no ability to recover assets owed during an active transaction). Whether contract-wallet payout recipients are supported through calls, rather than `transfer`, is covered by tests.
+
+EIP-2981 is not relied on to enforce payment: it is only a royalty-information standard and the existing collection may not implement it. This marketplace enforces the configured 2.5% in both settlement paths. It cannot force royalties on transfers or sales performed outside this marketplace, which must be stated plainly in the product copy.
+
+### Product surface
+
+The site will show collection browsing, token ownership and metadata, active signed listings, wallet connection, list/cancel/buy, make/cancel/accept offer, transaction state, and an activity view sourced from contract events. A lightweight order service stores and serves signed orders; it never has signing keys or custody. Before showing an order as actionable, the indexer/API checks expiry, nonce, ownership, and approvals. The contract remains authoritative, so stale orders shown by the API fail safely on chain.
+
+The API stores order payload, signature, status, and timestamps; validates the typed data before accepting it; rate-limits submissions; and indexes fills/cancellations from a finality-aware block cursor. Metadata is cached but token ownership is read from chain/indexed events. The frontend previews the exact seller/artist split and warns when an approval, allowance, balance, ownership change, or gas-price condition makes an order unavailable.
+
+## Four-week build plan
+
+### Week 1 — specification, prototype, and foundations
+
+- Confirm collection address, ERC-721 behavior, artist payout address (preferably a Safe), canonical mainnet WETH address, supported wallets, hosting, RPC/indexing provider, and required confirmations.
+- Freeze the order schemas, EIP-712 domain, nonce/cancellation model, rounding rule, event schema, revert behavior, and the ETH-listing/WETH-offer decision in a short protocol specification with sequence diagrams.
+- Implement the contract skeleton and a local proof of both settlement paths against a mock ERC-721, WETH, EOA signatures, and ERC-1271 wallet signatures.
+- Scaffold frontend and order API/database; ingest all 5,000 token IDs and metadata; implement read-only collection and token pages.
+- Establish CI for formatting, compilation, unit tests, static analysis, coverage, and deterministic deployment. Create separate deployer and artist Safe procedures; no production private key enters CI.
+
+**Exit:** reviewed protocol spec, order fixtures shared by contract/backend/frontend, local list/buy and offer/accept demos, and auditor confirms the proposed scope is quoteable.
+
+### Week 2 — complete contract and trading flows
+
+- Complete listing fill, offer acceptance, exact royalty splits, individual and bulk cancellation, replay protection, expiry, designated taker, ERC-1271, and events.
+- Build API signature validation, order persistence/querying, status reconciliation, and chain-event indexer with reorg-safe cursor handling.
+- Build list, cancel, buy, make-offer, cancel-offer, and accept-offer UI, including ERC-721 approval and WETH allowance steps.
+- Add unit and fuzz tests for prices and rounding, nonce boundaries, expired/stale orders, invalid/malleable signatures, wrong chain/contract/side, transfer failures, hostile recipients/tokens, reentrancy, and repeated fills.
+
+**Exit:** feature-complete testnet release; all state transitions are driven by signed orders and verified events, with no custodial service role.
+
+### Week 3 — integration, adversarial testing, and release candidate
+
+- Run end-to-end tests with the actual collection contract behavior on a mainnet fork and a public testnet deployment; exercise EOAs, a Safe/ERC-1271 wallet, and contract buyers implementing ERC-721 receiver logic.
+- Run static analysis, invariant/fuzz suites, gas snapshots, frontend/API tests, and manual abuse testing. Core invariants: one order fills at most once; cancellation is final; only the current owner can sell; buyer receives exactly the NFT paid for; artist plus seller payout equals price; contract balance does not increase after a successful normal fill.
+- Threat-model signature phishing, replay across chains/contracts/order sides, front-running, stale API data, compromised API/RPC, reorgs, denial-of-service payout recipients, approval risks, and accidental asset transfers. Resolve all critical/high internal findings.
+- Finish monitoring, event dashboards, error reporting, incident runbook, deployment/verification scripts, user terms and royalty limitations. Freeze the release-candidate commit and compiler/dependency lockfiles.
+
+**Exit:** tagged release candidate, reproducible build, green CI and fork tests, completed audit package. No feature changes after handoff without notifying the auditor.
+
+### Week 4 — audit, remediation, and launch gate
+
+- Auditor reviews the frozen commit while the team performs frontend accessibility/usability checks and operational rehearsal without changing scoped contracts.
+- Triage findings daily. Fix scoped code only; provide each fix as a small commit with a regression test and written response. Auditor reviews fixes and issues a final report/addendum.
+- Deploy with the Safe-controlled procedure, verify source and constructor arguments, run read-only and low-value smoke tests, seed the indexer, and validate monitoring.
+- Launch only when all critical/high findings are fixed and retested, medium findings are fixed or explicitly accepted with rationale, contract addresses match the audited bytecode/configuration, and rollback/pause communications are ready. Because the proposed immutable contract has no pause switch, an incident response disables order publication in the UI/API, warns users to revoke approvals, and migrates to a new deployment; already signed orders are invalid on the new domain.
+
+**Exit:** verified mainnet deployment tied to the final audit commit and report, runbook owner assigned, and 48-hour heightened monitoring scheduled.
+
+## Precise smart-contract audit scope
+
+### In-scope deliverable
+
+The quote should cover one Solidity marketplace contract plus only the locally maintained libraries/interfaces it uses. The final package supplied at the end of week 3 will identify exact repository URL, commit SHA, Solidity/compiler settings, dependency lockfile, deployed/configured addresses, and source-line count. Estimate for quoting before implementation: **one primary contract, approximately 300–450 nonblank/noncomment Solidity lines, plus tests; no proxy and no upgrade mechanism**. If the implementation exceeds 500 such lines, adds a contract, changes custody, or adds upgradeability/admin controls, it requires scope and quote revision.
+
+Auditor activities requested:
+
+- manual review of every in-scope Solidity line and the protocol/order-schema specification;
+- independent build and test execution, plus review of unit, fuzz, invariant, fork, and deployment tests;
+- automated static analysis as a supplement to manual review;
+- validation of EIP-712 hashes against frontend/backend fixtures and EOA/ERC-1271 verification;
+- mainnet-fork validation against the exact existing collection and canonical WETH;
+- written findings with severity, impact, exploit scenario, affected lines, and remediation; one remediation review of fixes made within five business days; final report suitable for publication.
+
+### Security properties and attack paths to assess
+
+The audit must determine whether:
+
+1. Only a valid, unexpired, uncancelled authorization from the relevant seller or bidder can execute, and signatures cannot replay across chain, deployment, order side, token, nonce, or after fill/cancellation.
+2. A listing can execute only while its signer owns the specified token and has authorized the marketplace; an offer can be accepted only by the current owner, and optional taker restrictions cannot be bypassed.
+3. Every successful sale is atomic: the exact token changes hands once, exactly 250 bps goes to the configured artist, the seller gets the remainder, and the marketplace retains no normal-sale funds. Integer rounding and tiny prices cannot create excess fees or underflow.
+4. ETH value accounting is exact and WETH allowance/balance handling is safe. Unexpected ETH, malicious fallback/receiver hooks, ERC-777-like behavior, non-standard ERC-20 returns, and accidental assets cannot steal user funds or corrupt state. (Production uses only canonical WETH, but unsafe generic assumptions should still be identified.)
+5. Checks-effects-interactions, the reentrancy guard, and consumed-order state prevent reentrant or duplicate fills through seller, artist, buyer, NFT receiver, ERC-1271, ERC-721, or token callbacks.
+6. ECDSA malleability, forged ERC-1271 responses, malformed signatures, zero addresses/prices, expiry and nonce edge cases, bulk-cancel boundaries, griefing, front-running, and denial-of-service conditions are handled as specified.
+7. The contract has no hidden custody or privilege path; configuration is immutable and correct; any recovery function cannot seize NFTs, WETH, or ETH involved in settlement; events accurately support reconciliation.
+8. Gas use remains viable for normal fills and an attacker cannot create unbounded loops or storage growth in an execution path.
+
+The auditor should also review approval consequences: a marketplace operator approval allows transfers only through contract code, so every callable path must be checked for arbitrary-transfer bugs. API compromise must not be sufficient to forge or alter an order, though it may hide, delay, or front-run public orders.
+
+### Assumptions and external dependencies
+
+- The existing collection is the single configured ERC-721 and conforms to the transfer/approval behavior validated on the fork. Its own code and metadata hosting are dependencies, not being re-audited.
+- Canonical mainnet WETH is trusted and not re-audited. OpenZeppelin pinned dependencies are reviewed for correct integration, not audited line by line.
+- The artist payout address is supplied correctly and can receive ETH/WETH; operational compromise of that address is outside contract prevention.
+- Owners may transfer a listed NFT or revoke approval, and bidders may spend WETH or revoke allowance. Such orders becoming unfillable is expected, not a protocol failure.
+- Anyone can submit a valid signed order on chain. The order API is an availability/indexing layer and cannot guarantee cancellation before a transaction already in the mempool executes. Users needing immediate certainty should submit on-chain cancellation and wait for confirmation.
+- Normal Ethereum assumptions apply: no chain-finality guarantee beyond the configured confirmation policy, miners/builders can reorder transactions, and compromised wallets can sign valid malicious orders.
+
+### Explicitly out of scope
+
+- Re-audit of the 2024 ERC-721 collection, WETH, OpenZeppelin, Safe, wallets, RPC providers, Ethereum consensus, bridges, or metadata/media hosting.
+- Frontend, API, database, indexer, cloud/IAM, DNS, CI/CD, analytics, and key-management penetration testing. The auditor should verify typed-data fixtures and integration assumptions, but a full web/security review needs a separate quote.
+- Legal, tax, sanctions, marketplace-operator, consumer-protection, and royalty-enforceability advice.
+- Auctions, bids funded with native ETH escrow, trait offers, collection offers, bundles, partial fills, ERC-1155, lazy minting, private relayers, gasless settlement, fiat, other ERC-20 currencies, platform fees, royalty registries/splits, upgradeability, governance, and cross-chain support.
+- Economic guarantees for sales outside this marketplace or prevention of direct wallet-to-wallet transfers.
+
+### Audit handoff checklist and change control
+
+The handoff contains the frozen commit, source tree, exact line-count report, architecture and trust-boundary document, order type hashes and sample signatures, state-transition/invariant list, test and coverage output, static-analysis output, known issues, fork instructions, deployment scripts, constructor/config values, and expected bytecode. The auditor receives a point of contact and can request a walkthrough.
+
+Any change to in-scope Solidity, compiler settings, dependencies, EIP-712 schema/domain, fee math, configured collection/WETH/artist, or deployment architecture after freeze is sent to the auditor as a diff. Documentation-only and out-of-scope application changes are logged. No modified bytecode ships without written confirmation that the diff was reviewed or a clearly disclosed unaudited-change exception.
+
+## MVP acceptance and launch criteria
+
+- On a mainnet fork, an owner can sign a listing while retaining custody; a buyer atomically purchases it with ETH; and balances show the exact 2.5%/97.5% split.
+- A bidder can sign a WETH offer without depositing funds; the current owner can atomically accept it with the same split.
+- Individual and bulk cancellation, expiry, ownership/approval changes, insufficient WETH/allowance, and replay attempts behave predictably and are represented correctly in the UI.
+- EOA and ERC-1271 orders work, all critical invariants pass fuzz/invariant tests, source and deployment are reproducible, and monitoring catches fills, cancellations, indexer lag, RPC failure, and unexpected contract balances.
+- The final audit report covers the deployed commit/configuration and satisfies the week-4 launch gate above.

2026-08-24T19:49:16.068868Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `base_instructions` at line 97 column 5
exec
/bin/bash -lc "wc -l plan.md && sed -n '1,30p' plan.md" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-24T194742Z-codex-no-skill-1/workspace
 succeeded in 6ms:
138 plan.md
# NFT Marketplace MVP: four-week build plan and audit scope

## MVP definition and key decisions

The MVP is a fixed-price, non-custodial marketplace for the existing 5,000-token Ethereum mainnet ERC-721 collection. A listing is an EIP-712 signature made off chain, not an on-chain deposit. The seller remains the token owner and can transfer it elsewhere at any time. A purchase is one atomic transaction: the marketplace verifies the order, transfers the NFT from seller to buyer, pays 2.5% to the artist, and pays 97.5% to the seller. The buyer pays gas.

Offers use WETH, not raw ETH. An offer that can be accepted later cannot safely pull native ETH from a bidder's wallet; WETH provides `transferFrom`. The bidder signs an EIP-712 offer and grants the marketplace a WETH allowance. The owner later accepts it, atomically transferring the NFT and splitting the WETH proceeds. No NFT or funds are escrowed merely by creating a listing or offer. The UI should make the one-time ERC-721 operator approval and WETH approval explicit.

For a 0.4 ETH resale, the artist receives 0.01 ETH and the seller receives 0.39 ETH. The fee is computed as `salePrice * 250 / 10_000`, rounding down; the seller receives the exact remainder so no dust is retained. There is no additional platform fee in the MVP.

### Contract design

Deploy one small marketplace contract configured for the existing collection, canonical mainnet WETH, an artist payout address, and an immutable fee of 250 basis points. Keeping these immutable avoids an admin being able to redirect royalties or change economics after orders have been signed. If future fee changes are required, deploy a new marketplace and domain rather than making this MVP upgradeable.

Orders contain at least:

- `seller`/`bidder`, collection address, token ID, price, expiry, per-user nonce, and optional designated taker;
- a side/type discriminator so a listing signature cannot be interpreted as an offer;
- an EIP-712 domain bound to marketplace address, chain ID, name, and version.

The contract exposes narrowly scoped entry points equivalent to:

- `buy(Listing, signature)` payable, requiring exact `msg.value`;
- `acceptOffer(Offer, signature)`;
- `cancelNonce(uint256)` and `incrementMinNonce()` (or equivalent bitmap cancellation) for one-order and bulk cancellation;
- read helpers for order hashes, cancellation state, and domain data.

At execution it checks signature validity (EOA via ECDSA and smart-contract wallets via ERC-1271), expiry, nonce status, collection/token, current ownership, approval, nonzero price, and designated taker when set. It marks the order consumed before external calls, then performs the ERC-721 transfer and payments under a reentrancy guard. A successful fill or cancellation makes the order permanently unusable. Failed ownership, balance, allowance, approval, or transfer checks revert the entire transaction.

For native-ETH sales, payout calls either both succeed or the sale reverts; the contract must never silently strand sale proceeds. For accepted offers, canonical WETH is pulled directly in the transaction and split between artist and seller. The implementation will use audited OpenZeppelin primitives and `SafeERC20`, reject accidental direct ETH transfers, and include an explicit recovery policy only for assets sent accidentally (with no ability to recover assets owed during an active transaction). Whether contract-wallet payout recipients are supported through calls, rather than `transfer`, is covered by tests.

diff --git a/artifacts/ship-quiz-001/2026-08-24T194742Z-codex-no-skill-1/workspace/plan.md b/artifacts/ship-quiz-001/2026-08-24T194742Z-codex-no-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..74535c4a26b490533404c6192447c48eaeaa251f
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-08-24T194742Z-codex-no-skill-1/workspace/plan.md
@@ -0,0 +1,138 @@
+# NFT Marketplace MVP: four-week build plan and audit scope
+
+## MVP definition and key decisions
+
+The MVP is a fixed-price, non-custodial marketplace for the existing 5,000-token Ethereum mainnet ERC-721 collection. A listing is an EIP-712 signature made off chain, not an on-chain deposit. The seller remains the token owner and can transfer it elsewhere at any time. A purchase is one atomic transaction: the marketplace verifies the order, transfers the NFT from seller to buyer, pays 2.5% to the artist, and pays 97.5% to the seller. The buyer pays gas.
+
+Offers use WETH, not raw ETH. An offer that can be accepted later cannot safely pull native ETH from a bidder's wallet; WETH provides `transferFrom`. The bidder signs an EIP-712 offer and grants the marketplace a WETH allowance. The owner later accepts it, atomically transferring the NFT and splitting the WETH proceeds. No NFT or funds are escrowed merely by creating a listing or offer. The UI should make the one-time ERC-721 operator approval and WETH approval explicit.
+
+For a 0.4 ETH resale, the artist receives 0.01 ETH and the seller receives 0.39 ETH. The fee is computed as `salePrice * 250 / 10_000`, rounding down; the seller receives the exact remainder so no dust is retained. There is no additional platform fee in the MVP.
+
+### Contract design
+
+Deploy one small marketplace contract configured for the existing collection, canonical mainnet WETH, an artist payout address, and an immutable fee of 250 basis points. Keeping these immutable avoids an admin being able to redirect royalties or change economics after orders have been signed. If future fee changes are required, deploy a new marketplace and domain rather than making this MVP upgradeable.
+
+Orders contain at least:
+
+- `seller`/`bidder`, collection address, token ID, price, expiry, per-user nonce, and optional designated taker;
+- a side/type discriminator so a listing signature cannot be interpreted as an offer;
+- an EIP-712 domain bound to marketplace address, chain ID, name, and version.
+
+The contract exposes narrowly scoped entry points equivalent to:
+
+- `buy(Listing, signature)` payable, requiring exact `msg.value`;
+- `acceptOffer(Offer, signature)`;
+- `cancelNonce(uint256)` and `incrementMinNonce()` (or equivalent bitmap cancellation) for one-order and bulk cancellation;
+- read helpers for order hashes, cancellation state, and domain data.
+
+At execution it checks signature validity (EOA via ECDSA and smart-contract wallets via ERC-1271), expiry, nonce status, collection/token, current ownership, approval, nonzero price, and designated taker when set. It marks the order consumed before external calls, then performs the ERC-721 transfer and payments under a reentrancy guard. A successful fill or cancellation makes the order permanently unusable. Failed ownership, balance, allowance, approval, or transfer checks revert the entire transaction.
+
+For native-ETH sales, payout calls either both succeed or the sale reverts; the contract must never silently strand sale proceeds. For accepted offers, canonical WETH is pulled directly in the transaction and split between artist and seller. The implementation will use audited OpenZeppelin primitives and `SafeERC20`, reject accidental direct ETH transfers, and include an explicit recovery policy only for assets sent accidentally (with no ability to recover assets owed during an active transaction). Whether contract-wallet payout recipients are supported through calls, rather than `transfer`, is covered by tests.
+
+EIP-2981 is not relied on to enforce payment: it is only a royalty-information standard and the existing collection may not implement it. This marketplace enforces the configured 2.5% in both settlement paths. It cannot force royalties on transfers or sales performed outside this marketplace, which must be stated plainly in the product copy.
+
+### Product surface
+
+The site will show collection browsing, token ownership and metadata, active signed listings, wallet connection, list/cancel/buy, make/cancel/accept offer, transaction state, and an activity view sourced from contract events. A lightweight order service stores and serves signed orders; it never has signing keys or custody. Before showing an order as actionable, the indexer/API checks expiry, nonce, ownership, and approvals. The contract remains authoritative, so stale orders shown by the API fail safely on chain.
+
+The API stores order payload, signature, status, and timestamps; validates the typed data before accepting it; rate-limits submissions; and indexes fills/cancellations from a finality-aware block cursor. Metadata is cached but token ownership is read from chain/indexed events. The frontend previews the exact seller/artist split and warns when an approval, allowance, balance, ownership change, or gas-price condition makes an order unavailable.
+
+## Four-week build plan
+
+### Week 1 — specification, prototype, and foundations
+
+- Confirm collection address, ERC-721 behavior, artist payout address (preferably a Safe), canonical mainnet WETH address, supported wallets, hosting, RPC/indexing provider, and required confirmations.
+- Freeze the order schemas, EIP-712 domain, nonce/cancellation model, rounding rule, event schema, revert behavior, and the ETH-listing/WETH-offer decision in a short protocol specification with sequence diagrams.
+- Implement the contract skeleton and a local proof of both settlement paths against a mock ERC-721, WETH, EOA signatures, and ERC-1271 wallet signatures.
+- Scaffold frontend and order API/database; ingest all 5,000 token IDs and metadata; implement read-only collection and token pages.
+- Establish CI for formatting, compilation, unit tests, static analysis, coverage, and deterministic deployment. Create separate deployer and artist Safe procedures; no production private key enters CI.
+
+**Exit:** reviewed protocol spec, order fixtures shared by contract/backend/frontend, local list/buy and offer/accept demos, and auditor confirms the proposed scope is quoteable.
+
+### Week 2 — complete contract and trading flows
+
+- Complete listing fill, offer acceptance, exact royalty splits, individual and bulk cancellation, replay protection, expiry, designated taker, ERC-1271, and events.
+- Build API signature validation, order persistence/querying, status reconciliation, and chain-event indexer with reorg-safe cursor handling.
+- Build list, cancel, buy, make-offer, cancel-offer, and accept-offer UI, including ERC-721 approval and WETH allowance steps.
+- Add unit and fuzz tests for prices and rounding, nonce boundaries, expired/stale orders, invalid/malleable signatures, wrong chain/contract/side, transfer failures, hostile recipients/tokens, reentrancy, and repeated fills.
+
+**Exit:** feature-complete testnet release; all state transitions are driven by signed orders and verified events, with no custodial service role.
+
+### Week 3 — integration, adversarial testing, and release candidate
+
+- Run end-to-end tests with the actual collection contract behavior on a mainnet fork and a public testnet deployment; exercise EOAs, a Safe/ERC-1271 wallet, and contract buyers implementing ERC-721 receiver logic.
+- Run static analysis, invariant/fuzz suites, gas snapshots, frontend/API tests, and manual abuse testing. Core invariants: one order fills at most once; cancellation is final; only the current owner can sell; buyer receives exactly the NFT paid for; artist plus seller payout equals price; contract balance does not increase after a successful normal fill.
+- Threat-model signature phishing, replay across chains/contracts/order sides, front-running, stale API data, compromised API/RPC, reorgs, denial-of-service payout recipients, approval risks, and accidental asset transfers. Resolve all critical/high internal findings.
+- Finish monitoring, event dashboards, error reporting, incident runbook, deployment/verification scripts, user terms and royalty limitations. Freeze the release-candidate commit and compiler/dependency lockfiles.
+
+**Exit:** tagged release candidate, reproducible build, green CI and fork tests, completed audit package. No feature changes after handoff without notifying the auditor.
+
+### Week 4 — audit, remediation, and launch gate
+
+- Auditor reviews the frozen commit while the team performs frontend accessibility/usability checks and operational rehearsal without changing scoped contracts.
+- Triage findings daily. Fix scoped code only; provide each fix as a small commit with a regression test and written response. Auditor reviews fixes and issues a final report/addendum.
+- Deploy with the Safe-controlled procedure, verify source and constructor arguments, run read-only and low-value smoke tests, seed the indexer, and validate monitoring.
+- Launch only when all critical/high findings are fixed and retested, medium findings are fixed or explicitly accepted with rationale, contract addresses match the audited bytecode/configuration, and rollback/pause communications are ready. Because the proposed immutable contract has no pause switch, an incident response disables order publication in the UI/API, warns users to revoke approvals, and migrates to a new deployment; already signed orders are invalid on the new domain.
+
+**Exit:** verified mainnet deployment tied to the final audit commit and report, runbook owner assigned, and 48-hour heightened monitoring scheduled.
+
+## Precise smart-contract audit scope
+
+### In-scope deliverable
+
+The quote should cover one Solidity marketplace contract plus only the locally maintained libraries/interfaces it uses. The final package supplied at the end of week 3 will identify exact repository URL, commit SHA, Solidity/compiler settings, dependency lockfile, deployed/configured addresses, and source-line count. Estimate for quoting before implementation: **one primary contract, approximately 300–450 nonblank/noncomment Solidity lines, plus tests; no proxy and no upgrade mechanism**. If the implementation exceeds 500 such lines, adds a contract, changes custody, or adds upgradeability/admin controls, it requires scope and quote revision.
+
+Auditor activities requested:
+
+- manual review of every in-scope Solidity line and the protocol/order-schema specification;
+- independent build and test execution, plus review of unit, fuzz, invariant, fork, and deployment tests;
+- automated static analysis as a supplement to manual review;
+- validation of EIP-712 hashes against frontend/backend fixtures and EOA/ERC-1271 verification;
+- mainnet-fork validation against the exact existing collection and canonical WETH;
+- written findings with severity, impact, exploit scenario, affected lines, and remediation; one remediation review of fixes made within five business days; final report suitable for publication.
+
+### Security properties and attack paths to assess
+
+The audit must determine whether:
+
+1. Only a valid, unexpired, uncancelled authorization from the relevant seller or bidder can execute, and signatures cannot replay across chain, deployment, order side, token, nonce, or after fill/cancellation.
+2. A listing can execute only while its signer owns the specified token and has authorized the marketplace; an offer can be accepted only by the current owner, and optional taker restrictions cannot be bypassed.
+3. Every successful sale is atomic: the exact token changes hands once, exactly 250 bps goes to the configured artist, the seller gets the remainder, and the marketplace retains no normal-sale funds. Integer rounding and tiny prices cannot create excess fees or underflow.
+4. ETH value accounting is exact and WETH allowance/balance handling is safe. Unexpected ETH, malicious fallback/receiver hooks, ERC-777-like behavior, non-standard ERC-20 returns, and accidental assets cannot steal user funds or corrupt state. (Production uses only canonical WETH, but unsafe generic assumptions should still be identified.)
+5. Checks-effects-interactions, the reentrancy guard, and consumed-order state prevent reentrant or duplicate fills through seller, artist, buyer, NFT receiver, ERC-1271, ERC-721, or token callbacks.
+6. ECDSA malleability, forged ERC-1271 responses, malformed signatures, zero addresses/prices, expiry and nonce edge cases, bulk-cancel boundaries, griefing, front-running, and denial-of-service conditions are handled as specified.
+7. The contract has no hidden custody or privilege path; configuration is immutable and correct; any recovery function cannot seize NFTs, WETH, or ETH involved in settlement; events accurately support reconciliation.
+8. Gas use remains viable for normal fills and an attacker cannot create unbounded loops or storage growth in an execution path.
+
+The auditor should also review approval consequences: a marketplace operator approval allows transfers only through contract code, so every callable path must be checked for arbitrary-transfer bugs. API compromise must not be sufficient to forge or alter an order, though it may hide, delay, or front-run public orders.
+
+### Assumptions and external dependencies
+
+- The existing collection is the single configured ERC-721 and conforms to the transfer/approval behavior validated on the fork. Its own code and metadata hosting are dependencies, not being re-audited.
+- Canonical mainnet WETH is trusted and not re-audited. OpenZeppelin pinned dependencies are reviewed for correct integration, not audited line by line.
+- The artist payout address is supplied correctly and can receive ETH/WETH; operational compromise of that address is outside contract prevention.
+- Owners may transfer a listed NFT or revoke approval, and bidders may spend WETH or revoke allowance. Such orders becoming unfillable is expected, not a protocol failure.
+- Anyone can submit a valid signed order on chain. The order API is an availability/indexing layer and cannot guarantee cancellation before a transaction already in the mempool executes. Users needing immediate certainty should submit on-chain cancellation and wait for confirmation.
+- Normal Ethereum assumptions apply: no chain-finality guarantee beyond the configured confirmation policy, miners/builders can reorder transactions, and compromised wallets can sign valid malicious orders.
+
+### Explicitly out of scope
+
+- Re-audit of the 2024 ERC-721 collection, WETH, OpenZeppelin, Safe, wallets, RPC providers, Ethereum consensus, bridges, or metadata/media hosting.
+- Frontend, API, database, indexer, cloud/IAM, DNS, CI/CD, analytics, and key-management penetration testing. The auditor should verify typed-data fixtures and integration assumptions, but a full web/security review needs a separate quote.
+- Legal, tax, sanctions, marketplace-operator, consumer-protection, and royalty-enforceability advice.
+- Auctions, bids funded with native ETH escrow, trait offers, collection offers, bundles, partial fills, ERC-1155, lazy minting, private relayers, gasless settlement, fiat, other ERC-20 currencies, platform fees, royalty registries/splits, upgradeability, governance, and cross-chain support.
+- Economic guarantees for sales outside this marketplace or prevention of direct wallet-to-wallet transfers.
+
+### Audit handoff checklist and change control
+
+The handoff contains the frozen commit, source tree, exact line-count report, architecture and trust-boundary document, order type hashes and sample signatures, state-transition/invariant list, test and coverage output, static-analysis output, known issues, fork instructions, deployment scripts, constructor/config values, and expected bytecode. The auditor receives a point of contact and can request a walkthrough.
+
+Any change to in-scope Solidity, compiler settings, dependencies, EIP-712 schema/domain, fee math, configured collection/WETH/artist, or deployment architecture after freeze is sent to the auditor as a diff. Documentation-only and out-of-scope application changes are logged. No modified bytecode ships without written confirmation that the diff was reviewed or a clearly disclosed unaudited-change exception.
+
+## MVP acceptance and launch criteria
+
+- On a mainnet fork, an owner can sign a listing while retaining custody; a buyer atomically purchases it with ETH; and balances show the exact 2.5%/97.5% split.
+- A bidder can sign a WETH offer without depositing funds; the current owner can atomically accept it with the same split.
+- Individual and bulk cancellation, expiry, ownership/approval changes, insufficient WETH/allowance, and replay attempts behave predictably and are represented correctly in the UI.
+- EOA and ERC-1271 orders work, all critical invariants pass fuzz/invariant tests, source and deployment are reproducible, and monitoring catches fills, cancellations, indexer lag, RPC failure, and unexpected contract balances.
+- The final audit report covers the deployed commit/configuration and satisfies the week-4 launch gate above.

2026-08-24T19:49:20.280393Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `base_instructions` at line 97 column 5
codex
Created [plan.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-24T194742Z-codex-no-skill-1/workspace/plan.md).

It covers the non-custodial architecture, ETH listings, WETH offers, enforced 2.5% royalty, four-week delivery schedule, launch criteria, and a quoteable audit scope with security properties, assumptions, exclusions, and change control.
diff --git a/artifacts/ship-quiz-001/2026-08-24T194742Z-codex-no-skill-1/workspace/plan.md b/artifacts/ship-quiz-001/2026-08-24T194742Z-codex-no-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..74535c4a26b490533404c6192447c48eaeaa251f
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-08-24T194742Z-codex-no-skill-1/workspace/plan.md
@@ -0,0 +1,138 @@
+# NFT Marketplace MVP: four-week build plan and audit scope
+
+## MVP definition and key decisions
+
+The MVP is a fixed-price, non-custodial marketplace for the existing 5,000-token Ethereum mainnet ERC-721 collection. A listing is an EIP-712 signature made off chain, not an on-chain deposit. The seller remains the token owner and can transfer it elsewhere at any time. A purchase is one atomic transaction: the marketplace verifies the order, transfers the NFT from seller to buyer, pays 2.5% to the artist, and pays 97.5% to the seller. The buyer pays gas.
+
+Offers use WETH, not raw ETH. An offer that can be accepted later cannot safely pull native ETH from a bidder's wallet; WETH provides `transferFrom`. The bidder signs an EIP-712 offer and grants the marketplace a WETH allowance. The owner later accepts it, atomically transferring the NFT and splitting the WETH proceeds. No NFT or funds are escrowed merely by creating a listing or offer. The UI should make the one-time ERC-721 operator approval and WETH approval explicit.
+
+For a 0.4 ETH resale, the artist receives 0.01 ETH and the seller receives 0.39 ETH. The fee is computed as `salePrice * 250 / 10_000`, rounding down; the seller receives the exact remainder so no dust is retained. There is no additional platform fee in the MVP.
+
+### Contract design
+
+Deploy one small marketplace contract configured for the existing collection, canonical mainnet WETH, an artist payout address, and an immutable fee of 250 basis points. Keeping these immutable avoids an admin being able to redirect royalties or change economics after orders have been signed. If future fee changes are required, deploy a new marketplace and domain rather than making this MVP upgradeable.
+
+Orders contain at least:
+
+- `seller`/`bidder`, collection address, token ID, price, expiry, per-user nonce, and optional designated taker;
+- a side/type discriminator so a listing signature cannot be interpreted as an offer;
+- an EIP-712 domain bound to marketplace address, chain ID, name, and version.
+
+The contract exposes narrowly scoped entry points equivalent to:
+
+- `buy(Listing, signature)` payable, requiring exact `msg.value`;
+- `acceptOffer(Offer, signature)`;
+- `cancelNonce(uint256)` and `incrementMinNonce()` (or equivalent bitmap cancellation) for one-order and bulk cancellation;
+- read helpers for order hashes, cancellation state, and domain data.
+
+At execution it checks signature validity (EOA via ECDSA and smart-contract wallets via ERC-1271), expiry, nonce status, collection/token, current ownership, approval, nonzero price, and designated taker when set. It marks the order consumed before external calls, then performs the ERC-721 transfer and payments under a reentrancy guard. A successful fill or cancellation makes the order permanently unusable. Failed ownership, balance, allowance, approval, or transfer checks revert the entire transaction.
+
+For native-ETH sales, payout calls either both succeed or the sale reverts; the contract must never silently strand sale proceeds. For accepted offers, canonical WETH is pulled directly in the transaction and split between artist and seller. The implementation will use audited OpenZeppelin primitives and `SafeERC20`, reject accidental direct ETH transfers, and include an explicit recovery policy only for assets sent accidentally (with no ability to recover assets owed during an active transaction). Whether contract-wallet payout recipients are supported through calls, rather than `transfer`, is covered by tests.
+
+EIP-2981 is not relied on to enforce payment: it is only a royalty-information standard and the existing collection may not implement it. This marketplace enforces the configured 2.5% in both settlement paths. It cannot force royalties on transfers or sales performed outside this marketplace, which must be stated plainly in the product copy.
+
+### Product surface
+
+The site will show collection browsing, token ownership and metadata, active signed listings, wallet connection, list/cancel/buy, make/cancel/accept offer, transaction state, and an activity view sourced from contract events. A lightweight order service stores and serves signed orders; it never has signing keys or custody. Before showing an order as actionable, the indexer/API checks expiry, nonce, ownership, and approvals. The contract remains authoritative, so stale orders shown by the API fail safely on chain.
+
+The API stores order payload, signature, status, and timestamps; validates the typed data before accepting it; rate-limits submissions; and indexes fills/cancellations from a finality-aware block cursor. Metadata is cached but token ownership is read from chain/indexed events. The frontend previews the exact seller/artist split and warns when an approval, allowance, balance, ownership change, or gas-price condition makes an order unavailable.
+
+## Four-week build plan
+
+### Week 1 — specification, prototype, and foundations
+
+- Confirm collection address, ERC-721 behavior, artist payout address (preferably a Safe), canonical mainnet WETH address, supported wallets, hosting, RPC/indexing provider, and required confirmations.
+- Freeze the order schemas, EIP-712 domain, nonce/cancellation model, rounding rule, event schema, revert behavior, and the ETH-listing/WETH-offer decision in a short protocol specification with sequence diagrams.
+- Implement the contract skeleton and a local proof of both settlement paths against a mock ERC-721, WETH, EOA signatures, and ERC-1271 wallet signatures.
+- Scaffold frontend and order API/database; ingest all 5,000 token IDs and metadata; implement read-only collection and token pages.
+- Establish CI for formatting, compilation, unit tests, static analysis, coverage, and deterministic deployment. Create separate deployer and artist Safe procedures; no production private key enters CI.
+
+**Exit:** reviewed protocol spec, order fixtures shared by contract/backend/frontend, local list/buy and offer/accept demos, and auditor confirms the proposed scope is quoteable.
+
+### Week 2 — complete contract and trading flows
+
+- Complete listing fill, offer acceptance, exact royalty splits, individual and bulk cancellation, replay protection, expiry, designated taker, ERC-1271, and events.
+- Build API signature validation, order persistence/querying, status reconciliation, and chain-event indexer with reorg-safe cursor handling.
+- Build list, cancel, buy, make-offer, cancel-offer, and accept-offer UI, including ERC-721 approval and WETH allowance steps.
+- Add unit and fuzz tests for prices and rounding, nonce boundaries, expired/stale orders, invalid/malleable signatures, wrong chain/contract/side, transfer failures, hostile recipients/tokens, reentrancy, and repeated fills.
+
+**Exit:** feature-complete testnet release; all state transitions are driven by signed orders and verified events, with no custodial service role.
+
+### Week 3 — integration, adversarial testing, and release candidate
+
+- Run end-to-end tests with the actual collection contract behavior on a mainnet fork and a public testnet deployment; exercise EOAs, a Safe/ERC-1271 wallet, and contract buyers implementing ERC-721 receiver logic.
+- Run static analysis, invariant/fuzz suites, gas snapshots, frontend/API tests, and manual abuse testing. Core invariants: one order fills at most once; cancellation is final; only the current owner can sell; buyer receives exactly the NFT paid for; artist plus seller payout equals price; contract balance does not increase after a successful normal fill.
+- Threat-model signature phishing, replay across chains/contracts/order sides, front-running, stale API data, compromised API/RPC, reorgs, denial-of-service payout recipients, approval risks, and accidental asset transfers. Resolve all critical/high internal findings.
+- Finish monitoring, event dashboards, error reporting, incident runbook, deployment/verification scripts, user terms and royalty limitations. Freeze the release-candidate commit and compiler/dependency lockfiles.
+
+**Exit:** tagged release candidate, reproducible build, green CI and fork tests, completed audit package. No feature changes after handoff without notifying the auditor.
+
+### Week 4 — audit, remediation, and launch gate
+
+- Auditor reviews the frozen commit while the team performs frontend accessibility/usability checks and operational rehearsal without changing scoped contracts.
+- Triage findings daily. Fix scoped code only; provide each fix as a small commit with a regression test and written response. Auditor reviews fixes and issues a final report/addendum.
+- Deploy with the Safe-controlled procedure, verify source and constructor arguments, run read-only and low-value smoke tests, seed the indexer, and validate monitoring.
+- Launch only when all critical/high findings are fixed and retested, medium findings are fixed or explicitly accepted with rationale, contract addresses match the audited bytecode/configuration, and rollback/pause communications are ready. Because the proposed immutable contract has no pause switch, an incident response disables order publication in the UI/API, warns users to revoke approvals, and migrates to a new deployment; already signed orders are invalid on the new domain.
+
+**Exit:** verified mainnet deployment tied to the final audit commit and report, runbook owner assigned, and 48-hour heightened monitoring scheduled.
+
+## Precise smart-contract audit scope
+
+### In-scope deliverable
+
+The quote should cover one Solidity marketplace contract plus only the locally maintained libraries/interfaces it uses. The final package supplied at the end of week 3 will identify exact repository URL, commit SHA, Solidity/compiler settings, dependency lockfile, deployed/configured addresses, and source-line count. Estimate for quoting before implementation: **one primary contract, approximately 300–450 nonblank/noncomment Solidity lines, plus tests; no proxy and no upgrade mechanism**. If the implementation exceeds 500 such lines, adds a contract, changes custody, or adds upgradeability/admin controls, it requires scope and quote revision.
+
+Auditor activities requested:
+
+- manual review of every in-scope Solidity line and the protocol/order-schema specification;
+- independent build and test execution, plus review of unit, fuzz, invariant, fork, and deployment tests;
+- automated static analysis as a supplement to manual review;
+- validation of EIP-712 hashes against frontend/backend fixtures and EOA/ERC-1271 verification;
+- mainnet-fork validation against the exact existing collection and canonical WETH;
+- written findings with severity, impact, exploit scenario, affected lines, and remediation; one remediation review of fixes made within five business days; final report suitable for publication.
+
+### Security properties and attack paths to assess
+
+The audit must determine whether:
+
+1. Only a valid, unexpired, uncancelled authorization from the relevant seller or bidder can execute, and signatures cannot replay across chain, deployment, order side, token, nonce, or after fill/cancellation.
+2. A listing can execute only while its signer owns the specified token and has authorized the marketplace; an offer can be accepted only by the current owner, and optional taker restrictions cannot be bypassed.
+3. Every successful sale is atomic: the exact token changes hands once, exactly 250 bps goes to the configured artist, the seller gets the remainder, and the marketplace retains no normal-sale funds. Integer rounding and tiny prices cannot create excess fees or underflow.
+4. ETH value accounting is exact and WETH allowance/balance handling is safe. Unexpected ETH, malicious fallback/receiver hooks, ERC-777-like behavior, non-standard ERC-20 returns, and accidental assets cannot steal user funds or corrupt state. (Production uses only canonical WETH, but unsafe generic assumptions should still be identified.)
+5. Checks-effects-interactions, the reentrancy guard, and consumed-order state prevent reentrant or duplicate fills through seller, artist, buyer, NFT receiver, ERC-1271, ERC-721, or token callbacks.
+6. ECDSA malleability, forged ERC-1271 responses, malformed signatures, zero addresses/prices, expiry and nonce edge cases, bulk-cancel boundaries, griefing, front-running, and denial-of-service conditions are handled as specified.
+7. The contract has no hidden custody or privilege path; configuration is immutable and correct; any recovery function cannot seize NFTs, WETH, or ETH involved in settlement; events accurately support reconciliation.
+8. Gas use remains viable for normal fills and an attacker cannot create unbounded loops or storage growth in an execution path.
+
+The auditor should also review approval consequences: a marketplace operator approval allows transfers only through contract code, so every callable path must be checked for arbitrary-transfer bugs. API compromise must not be sufficient to forge or alter an order, though it may hide, delay, or front-run public orders.
+
+### Assumptions and external dependencies
+
+- The existing collection is the single configured ERC-721 and conforms to the transfer/approval behavior validated on the fork. Its own code and metadata hosting are dependencies, not being re-audited.
+- Canonical mainnet WETH is trusted and not re-audited. OpenZeppelin pinned dependencies are reviewed for correct integration, not audited line by line.
+- The artist payout address is supplied correctly and can receive ETH/WETH; operational compromise of that address is outside contract prevention.
+- Owners may transfer a listed NFT or revoke approval, and bidders may spend WETH or revoke allowance. Such orders becoming unfillable is expected, not a protocol failure.
+- Anyone can submit a valid signed order on chain. The order API is an availability/indexing layer and cannot guarantee cancellation before a transaction already in the mempool executes. Users needing immediate certainty should submit on-chain cancellation and wait for confirmation.
+- Normal Ethereum assumptions apply: no chain-finality guarantee beyond the configured confirmation policy, miners/builders can reorder transactions, and compromised wallets can sign valid malicious orders.
+
+### Explicitly out of scope
+
+- Re-audit of the 2024 ERC-721 collection, WETH, OpenZeppelin, Safe, wallets, RPC providers, Ethereum consensus, bridges, or metadata/media hosting.
+- Frontend, API, database, indexer, cloud/IAM, DNS, CI/CD, analytics, and key-management penetration testing. The auditor should verify typed-data fixtures and integration assumptions, but a full web/security review needs a separate quote.
+- Legal, tax, sanctions, marketplace-operator, consumer-protection, and royalty-enforceability advice.
+- Auctions, bids funded with native ETH escrow, trait offers, collection offers, bundles, partial fills, ERC-1155, lazy minting, private relayers, gasless settlement, fiat, other ERC-20 currencies, platform fees, royalty registries/splits, upgradeability, governance, and cross-chain support.
+- Economic guarantees for sales outside this marketplace or prevention of direct wallet-to-wallet transfers.
+
+### Audit handoff checklist and change control
+
+The handoff contains the frozen commit, source tree, exact line-count report, architecture and trust-boundary document, order type hashes and sample signatures, state-transition/invariant list, test and coverage output, static-analysis output, known issues, fork instructions, deployment scripts, constructor/config values, and expected bytecode. The auditor receives a point of contact and can request a walkthrough.
+
+Any change to in-scope Solidity, compiler settings, dependencies, EIP-712 schema/domain, fee math, configured collection/WETH/artist, or deployment architecture after freeze is sent to the auditor as a diff. Documentation-only and out-of-scope application changes are logged. No modified bytecode ships without written confirmation that the diff was reviewed or a clearly disclosed unaudited-change exception.
+
+## MVP acceptance and launch criteria
+
+- On a mainnet fork, an owner can sign a listing while retaining custody; a buyer atomically purchases it with ETH; and balances show the exact 2.5%/97.5% split.
+- A bidder can sign a WETH offer without depositing funds; the current owner can atomically accept it with the same split.
+- Individual and bulk cancellation, expiry, ownership/approval changes, insufficient WETH/allowance, and replay attempts behave predictably and are represented correctly in the UI.
+- EOA and ERC-1271 orders work, all critical invariants pass fuzz/invariant tests, source and deployment are reproducible, and monitoring catches fills, cancellations, indexer lag, RPC failure, and unexpected contract balances.
+- The final audit report covers the deployed commit/configuration and satisfies the week-4 launch gate above.

tokens used
25,191
Created [plan.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-24T194742Z-codex-no-skill-1/workspace/plan.md).

It covers the non-custodial architecture, ETH listings, WETH offers, enforced 2.5% royalty, four-week delivery schedule, launch criteria, and a quoteable audit scope with security properties, assumptions, exclusions, and change control.
