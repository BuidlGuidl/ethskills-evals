Reading additional input from stdin...
OpenAI Codex v0.146.1
--------
workdir: /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-24T205809Z-codex-with-skill-3/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a03590-fcdb-7c72-a804-d8217a3088b7
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
2026-08-24T20:58:09.698647Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a03590-fcdb-7c72-a804-d8217a3088b7.tmp-1787605089509656166: line 2547: syntax error near unexpected token `('

codex
I’m using the `ship` skill because this is an Ethereum dApp architecture, delivery, and audit-scoping task. I’ll read its guidance, inspect the workspace, then write the requested `plan.md`.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/ship/SKILL.md && printf '\\n---FILES---\\n' && rg --files -g '"'!TASK.md'"' | sed -n '1,120p'" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-24T205809Z-codex-with-skill-3/workspace
 succeeded in 8ms:

---FILES---

codex
The core design is one non-custodial marketplace contract on Ethereum mainnet: fixed-price listings and WETH-denominated offers settle atomically, with no NFT escrow. I’m making order validity, royalty routing, callers, and failure behavior explicit so the audit boundary is quoteable rather than aspirational.
apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-24T205809Z-codex-with-skill-3/workspace/plan.md
diff --git a/artifacts/ship-quiz-001/2026-08-24T205809Z-codex-with-skill-3/workspace/plan.md b/artifacts/ship-quiz-001/2026-08-24T205809Z-codex-with-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..4efbfdf8348ad850871ea6ad3924a10864ab68c4
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-08-24T205809Z-codex-with-skill-3/workspace/plan.md
@@ -0,0 +1,137 @@
+# Four-week marketplace MVP plan
+
+## MVP decision
+
+Ship one non-upgradeable marketplace contract on Ethereum mainnet for the existing 5,000-token ERC-721 collection. Ethereum mainnet is the only sensible MVP target because the collection and its ownership already live there; moving trading to another chain would require bridging or wrapped assets and would fragment liquidity.
+
+The marketplace never escrows NFTs. A sale is one atomic transaction: the contract verifies an order, transfers the NFT from its current owner to the buyer, and distributes payment. The seller must still own the token and approve the marketplace (per-token or `setApprovalForAll`) at settlement time.
+
+Use signed offchain orders rather than storing every listing and offer onchain. This makes listing free, while acceptance/purchase pays gas. An order contains:
+
+- order kind (`LISTING` or `OFFER`), collection address, token ID, maker, payment token, price, expiry, and maker nonce;
+- the marketplace address and Ethereum chain ID through EIP-712 domain separation;
+- for a listing, payment token is native ETH and maker is the current owner;
+- for an offer, payment token is WETH and maker is the buyer.
+
+Offers use WETH because an owner cannot later pull native ETH from an absent buyer. WETH is not marketplace escrow: the buyer keeps it and grants an allowance until acceptance. An offer can consequently become unfillable if the buyer moves the WETH or removes allowance; the UI must label this clearly.
+
+On every successful resale, exactly 2.5% of gross price goes to the artist royalty recipient and 97.5% goes to the seller. The royalty recipient is an immutable constructor argument and the rate is the constant 250 basis points. There is no platform fee. The implementation uses pull payments: settlement credits internal balances, and each recipient withdraws separately. This prevents a reverting artist or seller receiver from blocking a sale. Integer division rounds the royalty down in favor of the seller.
+
+The MVP deliberately supports only the named ERC-721 contract, native ETH listings, and canonical mainnet WETH offers. It excludes auctions, bids on the whole collection, ERC-20 currencies other than WETH, bundles, partial fills, private sales, fees, upgradeability, proxies, admin pausing, royalty changes, custody, bridging, and new NFT minting.
+
+## Onchain and offchain boundary
+
+Onchain, the single custom `CollectionMarketplace` contract performs signature and order validation, cancellation, atomic ERC-721/payment settlement, royalty accounting, withdrawals, replay prevention, and emits events.
+
+Offchain, the site and indexer store signed orders, index marketplace and ERC-721 events, test current ownership/approval/balance/allowance, and provide browse, search, sorting, metadata, images, user-readable status, and transaction history. The database is a convenience and may hide an order, but cannot invent a valid signature or alter settlement. Anyone with a valid signed order can submit it directly to the contract.
+
+## Contract surface and state transitions
+
+Proposed external surface (exact names may change before audit freeze, but the frozen commit and ABI will not):
+
+- `buy(Order listing, bytes signature) payable`: buyer fills one signed listing; requires exact `msg.value`.
+- `acceptOffer(Order offer, bytes signature)`: current owner fills one signed offer using WETH `transferFrom`.
+- `cancelOrder(bytes32 orderHash)`: maker invalidates one order.
+- `incrementNonce()`: maker invalidates all orders signed with the prior nonce.
+- `withdraw()`: caller withdraws their credited native ETH and WETH proceeds/royalties.
+- read helpers: `hashOrder`, `isOrderFillable`, `pendingNative`, and `pendingWeth`.
+
+Both fill paths mark the order consumed before external calls, are non-reentrant, require a nonzero price and unexpired order, recover the maker from the EIP-712 signature, restrict collection/payment token to constructor-configured addresses, verify ownership and approval, and use `safeTransferFrom`/`SafeERC20`. A listing is valid only while its maker is the current owner. An offer is accepted only by the current owner, and cannot be self-filled. Successful fills and all cancellation/nonce/withdrawal changes emit indexed events.
+
+| Transition | Caller | Why they pay gas | Safe outcome if nobody calls |
+| --- | --- | --- | --- |
+| Sign listing or offer | seller or buyer (offchain) | no gas | No order exists or trade occurs. |
+| `buy` | buyer | Receives the NFT at the signed price. | Listing remains fillable until expiry, cancellation, ownership/approval change, or nonce change. |
+| `acceptOffer` | current NFT owner | Receives 97.5% of price as withdrawable WETH. | Offer remains fillable until expiry/cancellation/nonce change, subject to WETH balance and allowance. |
+| `cancelOrder` | order maker | Prevents a specific unwanted fill. | Order remains valid until another invalidating event. |
+| `incrementNonce` | order maker | Cancels all their orders at once. | Existing orders remain independently valid. |
+| `withdraw` | credited seller or artist | Receives accumulated proceeds. | Funds remain credited in the contract; nobody else can withdraw them. |
+
+The frontend must avoid signature ambiguity: show collection, token, gross price, currency, royalty, seller net, expiry, and cancellation implications before signing. It must never describe a signature as a gas transaction.
+
+## Four-week build plan
+
+### Week 1 — freeze behavior and prove the vertical slice
+
+- Confirm the collection address, canonical WETH address, artist payout address (preferably a Safe multisig), supported wallet baseline, and existing ERC-721 behavior, including whether transfers have custom restrictions.
+- Write the order schema, EIP-712 typed data, settlement invariants, threat model, and the final ABI.
+- Implement the contract skeleton using pinned OpenZeppelin dependencies and unit tests for one listing purchase, one accepted offer, cancellation, nonce invalidation, expiry, and royalty rounding.
+- Build a mainnet-fork integration test against the actual NFT contract and WETH. Freeze architecture at the end of the week.
+
+Exit: both trade paths work on a fork; product signs off the displayed signing/settlement terms; auditor confirms the scope is quoteable.
+
+### Week 2 — complete contracts and indexing
+
+- Finish validation, replay protection, pull-payment accounting, withdrawals, events, custom errors, and property/fuzz tests.
+- Add an indexer/database for signed orders and chain events. Recompute fillability from current owner, approval, nonce, cancellation/fill state, expiry, and (for offers) WETH balance/allowance.
+- Expose API endpoints to publish/query signed orders; validate schema, signature, chain, collection, and reasonable expiry server-side. Add rate limits and abuse controls.
+- Run static analysis and gas snapshots; hand the feature-complete commit and audit package to the auditor. No new contract features after handoff.
+
+Exit: frozen audit commit, ABI, invariants, test suite, deployment configuration, dependency lockfile, and known-issues list delivered.
+
+### Week 3 — frontend and audit in parallel
+
+- Build collection browse/token pages, wallet connect, list, buy, offer, accept, cancel-one, cancel-all, approval, WETH wrap/approve, and withdrawal flows.
+- Show stale/unfillable order states and distinguish offchain signing from transactions. Simulate transactions and present gross price, 2.5% royalty, seller net, gas, and currency before confirmation.
+- Run end-to-end tests on a mainnet fork and a public Ethereum testnet using representative token ownership.
+- Triage auditor findings daily. Only remediation changes touch the frozen contracts; every change is supplied as a focused diff with regression tests.
+
+Exit: complete user journey on staging; all critical/high findings fixed or launch blocked.
+
+### Week 4 — remediation, independent verification, and launch
+
+- Auditor retests fixes and issues the final report. Resolve medium findings or document explicit risk acceptance before launch.
+- Run full unit, fuzz/invariant, fork, static-analysis, and frontend end-to-end suites; independently review deployed bytecode parameters and role/ownership assumptions.
+- Deploy the exact audited commit, verify source on Etherscan, verify immutable collection/WETH/artist addresses, and execute a low-value end-to-end listing purchase, offer acceptance, and withdrawal.
+- Enable monitoring for fills, cancellations, failed transactions, abnormal credited balances, indexer lag, and frontend/API errors. Publish addresses, audit report, limitations, and support/runbook material.
+
+Exit: verified mainnet contract, reproducible deployment record, successful smoke transactions, monitoring live, and incident owner named. If the audit is not closed, launch slips rather than compressing review.
+
+## Audit scope for quotation
+
+### In-scope code and artifacts
+
+The quote covers one frozen repository commit supplied at the end of week 2:
+
+1. `CollectionMarketplace.sol` and any project-owned Solidity libraries it imports (expected: one primary contract, approximately 250–400 non-comment Solidity lines).
+2. The EIP-712 `Order` type, hashing/signature helpers, cancellation bitmap/mapping or consumed-order mapping, per-user nonce logic, pull-payment ledger, and withdrawal logic.
+3. Integration points with the existing collection's `ownerOf`, approvals, and `safeTransferFrom`; canonical mainnet WETH `balanceOf`, `allowance`, and `transferFrom`; OpenZeppelin `EIP712`, `ECDSA`, `ReentrancyGuard`, and `SafeERC20` at locked versions.
+4. Deployment script and constructor/configuration validation for chain ID, collection, WETH, and artist recipient.
+5. Solidity unit, fuzz/invariant, and mainnet-fork tests, plus the order-signing test vectors used by the frontend.
+
+Provide the auditor the exact commit hash, compiler and optimizer settings, dependency lockfile and source revisions, ABI, architecture/order-format document, invariants below, coverage report, static-analysis output, fork block number/RPC requirements, deployment parameters, and known issues. The auditor should quote initial review, one remediation review of a bounded diff, and final report separately; additional feature changes trigger a scope/fee adjustment.
+
+### Security properties and attack cases to review
+
+- Only the maker can authorize or cancel an order; signatures cannot replay after fill, cancellation, nonce increment, on another chain, or against another marketplace.
+- A fill cannot substitute collection, token ID, maker, currency, price, expiry, or order kind; malformed signatures and smart-contract-wallet signatures have an explicit policy. MVP policy: EOAs only unless ERC-1271 support is deliberately added before scope freeze.
+- A sale succeeds only for the current owner with sufficient approval. Ownership changes invalidate old listings, including a token leaving and later returning to the same address only if nonce/order cancellation rules require that guarantee; document that a still-valid signed listing can revive when the same owner reacquires unless explicitly prevented.
+- Each order fills at most once under reentrancy, callback-capable NFT receivers, hostile payment receivers, front-running, and concurrent fills.
+- Native ETH handling rejects incorrect value and accidental/unaccounted ETH; WETH settlement cannot underpay or use a non-canonical token.
+- For every successful fill, credited seller amount plus credited royalty equals gross price exactly; royalty is `floor(price * 250 / 10_000)` and the seller receives the remainder. No privileged party can redirect or change it.
+- Pull-payment balances cannot be stolen, double-withdrawn, locked by another recipient, or rendered insolvent; state updates precede transfers and failed withdrawals preserve credit.
+- Cancellation and nonce boundaries, expiry timestamp behavior, zero price, self-trades, nonexistent tokens, approval revocation, insufficient WETH/allowance, fee-on-transfer assumptions, forced ETH, and denial-of-service/griefing are tested.
+- Events accurately support reconstruction of fills, cancellations, nonce changes, credits, and withdrawals without being relied upon for contract correctness.
+- Constructor immutables and absence of upgrade/admin paths match the documented trust model.
+
+Required invariants for the auditor and test suite:
+
+1. `filled[orderHash]` or `cancelled[orderHash]` makes that order permanently unfillable.
+2. Native ETH held by the contract is at least the sum of all pending native credits; WETH balance is at least the sum of all pending WETH credits.
+3. A successful settlement moves exactly one specified NFT to the buyer and creates credits totaling exactly its signed gross price.
+4. No address except the credited address can reduce that address's pending balance.
+5. No external call can observe an order as unconsumed after settlement has begun.
+
+### Explicitly out of scope
+
+- The already deployed NFT contract's full implementation, except its marketplace-facing behavior exercised on a fork.
+- Canonical WETH and OpenZeppelin internals as standalone audits; their correct configuration and use remain in scope.
+- Frontend, API, database, indexer availability/censorship, wallet software, DNS/hosting, and cloud security. The auditor receives signing test vectors to check contract/frontend encoding compatibility, but this is not a full web audit.
+- Artist key or multisig operational security, user phishing/social engineering, marketplace economics, tax/legal analysis, NFT metadata/media, and third-party RPC/indexing services.
+- Any feature excluded from the MVP decision, any later deployment, and changes after the frozen commit except the agreed remediation diff.
+
+## Deployment and operational handoff
+
+Use a deterministic deployment script pinned to Ethereum mainnet (`chainId 1`) with required environment variables for RPC URL, deployer key/hardware-wallet route, Etherscan API key, collection address, WETH address, and artist recipient. Before broadcast, the script must reject zero addresses and mismatched chain ID. The repository README will contain exact build/test, deploy, source-verification, bytecode-comparison, and smoke-test commands; actual commands depend on the selected Foundry/Hardhat scaffold and are frozen with the audit commit.
+
+The contract has no owner or admin. The artist recipient is immutable and should be a tested Safe multisig address; changing it requires a newly audited deployment. Monitor contract credits against balances, fill/cancel/withdraw events, and indexer freshness. The incident response is to remove the frontend/API publishing path and warn users; because signed orders remain permissionlessly fillable, affected makers must also cancel the specific order or increment their nonce onchain.

diff --git a/artifacts/ship-quiz-001/2026-08-24T205809Z-codex-with-skill-3/workspace/plan.md b/artifacts/ship-quiz-001/2026-08-24T205809Z-codex-with-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..4efbfdf8348ad850871ea6ad3924a10864ab68c4
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-08-24T205809Z-codex-with-skill-3/workspace/plan.md
@@ -0,0 +1,137 @@
+# Four-week marketplace MVP plan
+
+## MVP decision
+
+Ship one non-upgradeable marketplace contract on Ethereum mainnet for the existing 5,000-token ERC-721 collection. Ethereum mainnet is the only sensible MVP target because the collection and its ownership already live there; moving trading to another chain would require bridging or wrapped assets and would fragment liquidity.
+
+The marketplace never escrows NFTs. A sale is one atomic transaction: the contract verifies an order, transfers the NFT from its current owner to the buyer, and distributes payment. The seller must still own the token and approve the marketplace (per-token or `setApprovalForAll`) at settlement time.
+
+Use signed offchain orders rather than storing every listing and offer onchain. This makes listing free, while acceptance/purchase pays gas. An order contains:
+
+- order kind (`LISTING` or `OFFER`), collection address, token ID, maker, payment token, price, expiry, and maker nonce;
+- the marketplace address and Ethereum chain ID through EIP-712 domain separation;
+- for a listing, payment token is native ETH and maker is the current owner;
+- for an offer, payment token is WETH and maker is the buyer.
+
+Offers use WETH because an owner cannot later pull native ETH from an absent buyer. WETH is not marketplace escrow: the buyer keeps it and grants an allowance until acceptance. An offer can consequently become unfillable if the buyer moves the WETH or removes allowance; the UI must label this clearly.
+
+On every successful resale, exactly 2.5% of gross price goes to the artist royalty recipient and 97.5% goes to the seller. The royalty recipient is an immutable constructor argument and the rate is the constant 250 basis points. There is no platform fee. The implementation uses pull payments: settlement credits internal balances, and each recipient withdraws separately. This prevents a reverting artist or seller receiver from blocking a sale. Integer division rounds the royalty down in favor of the seller.
+
+The MVP deliberately supports only the named ERC-721 contract, native ETH listings, and canonical mainnet WETH offers. It excludes auctions, bids on the whole collection, ERC-20 currencies other than WETH, bundles, partial fills, private sales, fees, upgradeability, proxies, admin pausing, royalty changes, custody, bridging, and new NFT minting.
+
+## Onchain and offchain boundary
+
+Onchain, the single custom `CollectionMarketplace` contract performs signature and order validation, cancellation, atomic ERC-721/payment settlement, royalty accounting, withdrawals, replay prevention, and emits events.
+
+Offchain, the site and indexer store signed orders, index marketplace and ERC-721 events, test current ownership/approval/balance/allowance, and provide browse, search, sorting, metadata, images, user-readable status, and transaction history. The database is a convenience and may hide an order, but cannot invent a valid signature or alter settlement. Anyone with a valid signed order can submit it directly to the contract.
+
+## Contract surface and state transitions
+
+Proposed external surface (exact names may change before audit freeze, but the frozen commit and ABI will not):
+
+- `buy(Order listing, bytes signature) payable`: buyer fills one signed listing; requires exact `msg.value`.
+- `acceptOffer(Order offer, bytes signature)`: current owner fills one signed offer using WETH `transferFrom`.
+- `cancelOrder(bytes32 orderHash)`: maker invalidates one order.
+- `incrementNonce()`: maker invalidates all orders signed with the prior nonce.
+- `withdraw()`: caller withdraws their credited native ETH and WETH proceeds/royalties.
+- read helpers: `hashOrder`, `isOrderFillable`, `pendingNative`, and `pendingWeth`.
+
+Both fill paths mark the order consumed before external calls, are non-reentrant, require a nonzero price and unexpired order, recover the maker from the EIP-712 signature, restrict collection/payment token to constructor-configured addresses, verify ownership and approval, and use `safeTransferFrom`/`SafeERC20`. A listing is valid only while its maker is the current owner. An offer is accepted only by the current owner, and cannot be self-filled. Successful fills and all cancellation/nonce/withdrawal changes emit indexed events.
+
+| Transition | Caller | Why they pay gas | Safe outcome if nobody calls |
+| --- | --- | --- | --- |
+| Sign listing or offer | seller or buyer (offchain) | no gas | No order exists or trade occurs. |
+| `buy` | buyer | Receives the NFT at the signed price. | Listing remains fillable until expiry, cancellation, ownership/approval change, or nonce change. |
+| `acceptOffer` | current NFT owner | Receives 97.5% of price as withdrawable WETH. | Offer remains fillable until expiry/cancellation/nonce change, subject to WETH balance and allowance. |
+| `cancelOrder` | order maker | Prevents a specific unwanted fill. | Order remains valid until another invalidating event. |
+| `incrementNonce` | order maker | Cancels all their orders at once. | Existing orders remain independently valid. |
+| `withdraw` | credited seller or artist | Receives accumulated proceeds. | Funds remain credited in the contract; nobody else can withdraw them. |
+
+The frontend must avoid signature ambiguity: show collection, token, gross price, currency, royalty, seller net, expiry, and cancellation implications before signing. It must never describe a signature as a gas transaction.
+
+## Four-week build plan
+
+### Week 1 — freeze behavior and prove the vertical slice
+
+- Confirm the collection address, canonical WETH address, artist payout address (preferably a Safe multisig), supported wallet baseline, and existing ERC-721 behavior, including whether transfers have custom restrictions.
+- Write the order schema, EIP-712 typed data, settlement invariants, threat model, and the final ABI.
+- Implement the contract skeleton using pinned OpenZeppelin dependencies and unit tests for one listing purchase, one accepted offer, cancellation, nonce invalidation, expiry, and royalty rounding.
+- Build a mainnet-fork integration test against the actual NFT contract and WETH. Freeze architecture at the end of the week.
+
+Exit: both trade paths work on a fork; product signs off the displayed signing/settlement terms; auditor confirms the scope is quoteable.
+
+### Week 2 — complete contracts and indexing
+
+- Finish validation, replay protection, pull-payment accounting, withdrawals, events, custom errors, and property/fuzz tests.
+- Add an indexer/database for signed orders and chain events. Recompute fillability from current owner, approval, nonce, cancellation/fill state, expiry, and (for offers) WETH balance/allowance.
+- Expose API endpoints to publish/query signed orders; validate schema, signature, chain, collection, and reasonable expiry server-side. Add rate limits and abuse controls.
+- Run static analysis and gas snapshots; hand the feature-complete commit and audit package to the auditor. No new contract features after handoff.
+
+Exit: frozen audit commit, ABI, invariants, test suite, deployment configuration, dependency lockfile, and known-issues list delivered.
+
+### Week 3 — frontend and audit in parallel
+
+- Build collection browse/token pages, wallet connect, list, buy, offer, accept, cancel-one, cancel-all, approval, WETH wrap/approve, and withdrawal flows.
+- Show stale/unfillable order states and distinguish offchain signing from transactions. Simulate transactions and present gross price, 2.5% royalty, seller net, gas, and currency before confirmation.
+- Run end-to-end tests on a mainnet fork and a public Ethereum testnet using representative token ownership.
+- Triage auditor findings daily. Only remediation changes touch the frozen contracts; every change is supplied as a focused diff with regression tests.
+
+Exit: complete user journey on staging; all critical/high findings fixed or launch blocked.
+
+### Week 4 — remediation, independent verification, and launch
+
+- Auditor retests fixes and issues the final report. Resolve medium findings or document explicit risk acceptance before launch.
+- Run full unit, fuzz/invariant, fork, static-analysis, and frontend end-to-end suites; independently review deployed bytecode parameters and role/ownership assumptions.
+- Deploy the exact audited commit, verify source on Etherscan, verify immutable collection/WETH/artist addresses, and execute a low-value end-to-end listing purchase, offer acceptance, and withdrawal.
+- Enable monitoring for fills, cancellations, failed transactions, abnormal credited balances, indexer lag, and frontend/API errors. Publish addresses, audit report, limitations, and support/runbook material.
+
+Exit: verified mainnet contract, reproducible deployment record, successful smoke transactions, monitoring live, and incident owner named. If the audit is not closed, launch slips rather than compressing review.
+
+## Audit scope for quotation
+
+### In-scope code and artifacts
+
+The quote covers one frozen repository commit supplied at the end of week 2:
+
+1. `CollectionMarketplace.sol` and any project-owned Solidity libraries it imports (expected: one primary contract, approximately 250–400 non-comment Solidity lines).
+2. The EIP-712 `Order` type, hashing/signature helpers, cancellation bitmap/mapping or consumed-order mapping, per-user nonce logic, pull-payment ledger, and withdrawal logic.
+3. Integration points with the existing collection's `ownerOf`, approvals, and `safeTransferFrom`; canonical mainnet WETH `balanceOf`, `allowance`, and `transferFrom`; OpenZeppelin `EIP712`, `ECDSA`, `ReentrancyGuard`, and `SafeERC20` at locked versions.
+4. Deployment script and constructor/configuration validation for chain ID, collection, WETH, and artist recipient.
+5. Solidity unit, fuzz/invariant, and mainnet-fork tests, plus the order-signing test vectors used by the frontend.
+
+Provide the auditor the exact commit hash, compiler and optimizer settings, dependency lockfile and source revisions, ABI, architecture/order-format document, invariants below, coverage report, static-analysis output, fork block number/RPC requirements, deployment parameters, and known issues. The auditor should quote initial review, one remediation review of a bounded diff, and final report separately; additional feature changes trigger a scope/fee adjustment.
+
+### Security properties and attack cases to review
+
+- Only the maker can authorize or cancel an order; signatures cannot replay after fill, cancellation, nonce increment, on another chain, or against another marketplace.
+- A fill cannot substitute collection, token ID, maker, currency, price, expiry, or order kind; malformed signatures and smart-contract-wallet signatures have an explicit policy. MVP policy: EOAs only unless ERC-1271 support is deliberately added before scope freeze.
+- A sale succeeds only for the current owner with sufficient approval. Ownership changes invalidate old listings, including a token leaving and later returning to the same address only if nonce/order cancellation rules require that guarantee; document that a still-valid signed listing can revive when the same owner reacquires unless explicitly prevented.
+- Each order fills at most once under reentrancy, callback-capable NFT receivers, hostile payment receivers, front-running, and concurrent fills.
+- Native ETH handling rejects incorrect value and accidental/unaccounted ETH; WETH settlement cannot underpay or use a non-canonical token.
+- For every successful fill, credited seller amount plus credited royalty equals gross price exactly; royalty is `floor(price * 250 / 10_000)` and the seller receives the remainder. No privileged party can redirect or change it.
+- Pull-payment balances cannot be stolen, double-withdrawn, locked by another recipient, or rendered insolvent; state updates precede transfers and failed withdrawals preserve credit.
+- Cancellation and nonce boundaries, expiry timestamp behavior, zero price, self-trades, nonexistent tokens, approval revocation, insufficient WETH/allowance, fee-on-transfer assumptions, forced ETH, and denial-of-service/griefing are tested.
+- Events accurately support reconstruction of fills, cancellations, nonce changes, credits, and withdrawals without being relied upon for contract correctness.
+- Constructor immutables and absence of upgrade/admin paths match the documented trust model.
+
+Required invariants for the auditor and test suite:
+
+1. `filled[orderHash]` or `cancelled[orderHash]` makes that order permanently unfillable.
+2. Native ETH held by the contract is at least the sum of all pending native credits; WETH balance is at least the sum of all pending WETH credits.
+3. A successful settlement moves exactly one specified NFT to the buyer and creates credits totaling exactly its signed gross price.
+4. No address except the credited address can reduce that address's pending balance.
+5. No external call can observe an order as unconsumed after settlement has begun.
+
+### Explicitly out of scope
+
+- The already deployed NFT contract's full implementation, except its marketplace-facing behavior exercised on a fork.
+- Canonical WETH and OpenZeppelin internals as standalone audits; their correct configuration and use remain in scope.
+- Frontend, API, database, indexer availability/censorship, wallet software, DNS/hosting, and cloud security. The auditor receives signing test vectors to check contract/frontend encoding compatibility, but this is not a full web audit.
+- Artist key or multisig operational security, user phishing/social engineering, marketplace economics, tax/legal analysis, NFT metadata/media, and third-party RPC/indexing services.
+- Any feature excluded from the MVP decision, any later deployment, and changes after the frozen commit except the agreed remediation diff.
+
+## Deployment and operational handoff
+
+Use a deterministic deployment script pinned to Ethereum mainnet (`chainId 1`) with required environment variables for RPC URL, deployer key/hardware-wallet route, Etherscan API key, collection address, WETH address, and artist recipient. Before broadcast, the script must reject zero addresses and mismatched chain ID. The repository README will contain exact build/test, deploy, source-verification, bytecode-comparison, and smoke-test commands; actual commands depend on the selected Foundry/Hardhat scaffold and are frozen with the audit commit.
+
+The contract has no owner or admin. The artist recipient is immutable and should be a tested Safe multisig address; changing it requires a newly audited deployment. Monitor contract credits against balances, fill/cancel/withdraw events, and indexer freshness. The incident response is to remove the frontend/API publishing path and warn users; because signed orders remain permissionlessly fillable, affected makers must also cancel the specific order or increment their nonce onchain.

2026-08-24T20:59:24.542135Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `base_instructions` at line 97 column 5
exec
/bin/bash -lc "test -f plan.md && wc -l plan.md && sed -n '1,40p' plan.md" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-24T205809Z-codex-with-skill-3/workspace
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
137 plan.md
# Four-week marketplace MVP plan

## MVP decision

Ship one non-upgradeable marketplace contract on Ethereum mainnet for the existing 5,000-token ERC-721 collection. Ethereum mainnet is the only sensible MVP target because the collection and its ownership already live there; moving trading to another chain would require bridging or wrapped assets and would fragment liquidity.

The marketplace never escrows NFTs. A sale is one atomic transaction: the contract verifies an order, transfers the NFT from its current owner to the buyer, and distributes payment. The seller must still own the token and approve the marketplace (per-token or `setApprovalForAll`) at settlement time.

Use signed offchain orders rather than storing every listing and offer onchain. This makes listing free, while acceptance/purchase pays gas. An order contains:

- order kind (`LISTING` or `OFFER`), collection address, token ID, maker, payment token, price, expiry, and maker nonce;
- the marketplace address and Ethereum chain ID through EIP-712 domain separation;
- for a listing, payment token is native ETH and maker is the current owner;
- for an offer, payment token is WETH and maker is the buyer.

Offers use WETH because an owner cannot later pull native ETH from an absent buyer. WETH is not marketplace escrow: the buyer keeps it and grants an allowance until acceptance. An offer can consequently become unfillable if the buyer moves the WETH or removes allowance; the UI must label this clearly.

On every successful resale, exactly 2.5% of gross price goes to the artist royalty recipient and 97.5% goes to the seller. The royalty recipient is an immutable constructor argument and the rate is the constant 250 basis points. There is no platform fee. The implementation uses pull payments: settlement credits internal balances, and each recipient withdraws separately. This prevents a reverting artist or seller receiver from blocking a sale. Integer division rounds the royalty down in favor of the seller.

The MVP deliberately supports only the named ERC-721 contract, native ETH listings, and canonical mainnet WETH offers. It excludes auctions, bids on the whole collection, ERC-20 currencies other than WETH, bundles, partial fills, private sales, fees, upgradeability, proxies, admin pausing, royalty changes, custody, bridging, and new NFT minting.

## Onchain and offchain boundary

Onchain, the single custom `CollectionMarketplace` contract performs signature and order validation, cancellation, atomic ERC-721/payment settlement, royalty accounting, withdrawals, replay prevention, and emits events.

Offchain, the site and indexer store signed orders, index marketplace and ERC-721 events, test current ownership/approval/balance/allowance, and provide browse, search, sorting, metadata, images, user-readable status, and transaction history. The database is a convenience and may hide an order, but cannot invent a valid signature or alter settlement. Anyone with a valid signed order can submit it directly to the contract.

## Contract surface and state transitions

Proposed external surface (exact names may change before audit freeze, but the frozen commit and ABI will not):

- `buy(Order listing, bytes signature) payable`: buyer fills one signed listing; requires exact `msg.value`.
- `acceptOffer(Order offer, bytes signature)`: current owner fills one signed offer using WETH `transferFrom`.
- `cancelOrder(bytes32 orderHash)`: maker invalidates one order.
- `incrementNonce()`: maker invalidates all orders signed with the prior nonce.
- `withdraw()`: caller withdraws their credited native ETH and WETH proceeds/royalties.
- read helpers: `hashOrder`, `isOrderFillable`, `pendingNative`, and `pendingWeth`.

Both fill paths mark the order consumed before external calls, are non-reentrant, require a nonzero price and unexpired order, recover the maker from the EIP-712 signature, restrict collection/payment token to constructor-configured addresses, verify ownership and approval, and use `safeTransferFrom`/`SafeERC20`. A listing is valid only while its maker is the current owner. An offer is accepted only by the current owner, and cannot be self-filled. Successful fills and all cancellation/nonce/withdrawal changes emit indexed events.


diff --git a/artifacts/ship-quiz-001/2026-08-24T205809Z-codex-with-skill-3/workspace/plan.md b/artifacts/ship-quiz-001/2026-08-24T205809Z-codex-with-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..4efbfdf8348ad850871ea6ad3924a10864ab68c4
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-08-24T205809Z-codex-with-skill-3/workspace/plan.md
@@ -0,0 +1,137 @@
+# Four-week marketplace MVP plan
+
+## MVP decision
+
+Ship one non-upgradeable marketplace contract on Ethereum mainnet for the existing 5,000-token ERC-721 collection. Ethereum mainnet is the only sensible MVP target because the collection and its ownership already live there; moving trading to another chain would require bridging or wrapped assets and would fragment liquidity.
+
+The marketplace never escrows NFTs. A sale is one atomic transaction: the contract verifies an order, transfers the NFT from its current owner to the buyer, and distributes payment. The seller must still own the token and approve the marketplace (per-token or `setApprovalForAll`) at settlement time.
+
+Use signed offchain orders rather than storing every listing and offer onchain. This makes listing free, while acceptance/purchase pays gas. An order contains:
+
+- order kind (`LISTING` or `OFFER`), collection address, token ID, maker, payment token, price, expiry, and maker nonce;
+- the marketplace address and Ethereum chain ID through EIP-712 domain separation;
+- for a listing, payment token is native ETH and maker is the current owner;
+- for an offer, payment token is WETH and maker is the buyer.
+
+Offers use WETH because an owner cannot later pull native ETH from an absent buyer. WETH is not marketplace escrow: the buyer keeps it and grants an allowance until acceptance. An offer can consequently become unfillable if the buyer moves the WETH or removes allowance; the UI must label this clearly.
+
+On every successful resale, exactly 2.5% of gross price goes to the artist royalty recipient and 97.5% goes to the seller. The royalty recipient is an immutable constructor argument and the rate is the constant 250 basis points. There is no platform fee. The implementation uses pull payments: settlement credits internal balances, and each recipient withdraws separately. This prevents a reverting artist or seller receiver from blocking a sale. Integer division rounds the royalty down in favor of the seller.
+
+The MVP deliberately supports only the named ERC-721 contract, native ETH listings, and canonical mainnet WETH offers. It excludes auctions, bids on the whole collection, ERC-20 currencies other than WETH, bundles, partial fills, private sales, fees, upgradeability, proxies, admin pausing, royalty changes, custody, bridging, and new NFT minting.
+
+## Onchain and offchain boundary
+
+Onchain, the single custom `CollectionMarketplace` contract performs signature and order validation, cancellation, atomic ERC-721/payment settlement, royalty accounting, withdrawals, replay prevention, and emits events.
+
+Offchain, the site and indexer store signed orders, index marketplace and ERC-721 events, test current ownership/approval/balance/allowance, and provide browse, search, sorting, metadata, images, user-readable status, and transaction history. The database is a convenience and may hide an order, but cannot invent a valid signature or alter settlement. Anyone with a valid signed order can submit it directly to the contract.
+
+## Contract surface and state transitions
+
+Proposed external surface (exact names may change before audit freeze, but the frozen commit and ABI will not):
+
+- `buy(Order listing, bytes signature) payable`: buyer fills one signed listing; requires exact `msg.value`.
+- `acceptOffer(Order offer, bytes signature)`: current owner fills one signed offer using WETH `transferFrom`.
+- `cancelOrder(bytes32 orderHash)`: maker invalidates one order.
+- `incrementNonce()`: maker invalidates all orders signed with the prior nonce.
+- `withdraw()`: caller withdraws their credited native ETH and WETH proceeds/royalties.
+- read helpers: `hashOrder`, `isOrderFillable`, `pendingNative`, and `pendingWeth`.
+
+Both fill paths mark the order consumed before external calls, are non-reentrant, require a nonzero price and unexpired order, recover the maker from the EIP-712 signature, restrict collection/payment token to constructor-configured addresses, verify ownership and approval, and use `safeTransferFrom`/`SafeERC20`. A listing is valid only while its maker is the current owner. An offer is accepted only by the current owner, and cannot be self-filled. Successful fills and all cancellation/nonce/withdrawal changes emit indexed events.
+
+| Transition | Caller | Why they pay gas | Safe outcome if nobody calls |
+| --- | --- | --- | --- |
+| Sign listing or offer | seller or buyer (offchain) | no gas | No order exists or trade occurs. |
+| `buy` | buyer | Receives the NFT at the signed price. | Listing remains fillable until expiry, cancellation, ownership/approval change, or nonce change. |
+| `acceptOffer` | current NFT owner | Receives 97.5% of price as withdrawable WETH. | Offer remains fillable until expiry/cancellation/nonce change, subject to WETH balance and allowance. |
+| `cancelOrder` | order maker | Prevents a specific unwanted fill. | Order remains valid until another invalidating event. |
+| `incrementNonce` | order maker | Cancels all their orders at once. | Existing orders remain independently valid. |
+| `withdraw` | credited seller or artist | Receives accumulated proceeds. | Funds remain credited in the contract; nobody else can withdraw them. |
+
+The frontend must avoid signature ambiguity: show collection, token, gross price, currency, royalty, seller net, expiry, and cancellation implications before signing. It must never describe a signature as a gas transaction.
+
+## Four-week build plan
+
+### Week 1 — freeze behavior and prove the vertical slice
+
+- Confirm the collection address, canonical WETH address, artist payout address (preferably a Safe multisig), supported wallet baseline, and existing ERC-721 behavior, including whether transfers have custom restrictions.
+- Write the order schema, EIP-712 typed data, settlement invariants, threat model, and the final ABI.
+- Implement the contract skeleton using pinned OpenZeppelin dependencies and unit tests for one listing purchase, one accepted offer, cancellation, nonce invalidation, expiry, and royalty rounding.
+- Build a mainnet-fork integration test against the actual NFT contract and WETH. Freeze architecture at the end of the week.
+
+Exit: both trade paths work on a fork; product signs off the displayed signing/settlement terms; auditor confirms the scope is quoteable.
+
+### Week 2 — complete contracts and indexing
+
+- Finish validation, replay protection, pull-payment accounting, withdrawals, events, custom errors, and property/fuzz tests.
+- Add an indexer/database for signed orders and chain events. Recompute fillability from current owner, approval, nonce, cancellation/fill state, expiry, and (for offers) WETH balance/allowance.
+- Expose API endpoints to publish/query signed orders; validate schema, signature, chain, collection, and reasonable expiry server-side. Add rate limits and abuse controls.
+- Run static analysis and gas snapshots; hand the feature-complete commit and audit package to the auditor. No new contract features after handoff.
+
+Exit: frozen audit commit, ABI, invariants, test suite, deployment configuration, dependency lockfile, and known-issues list delivered.
+
+### Week 3 — frontend and audit in parallel
+
+- Build collection browse/token pages, wallet connect, list, buy, offer, accept, cancel-one, cancel-all, approval, WETH wrap/approve, and withdrawal flows.
+- Show stale/unfillable order states and distinguish offchain signing from transactions. Simulate transactions and present gross price, 2.5% royalty, seller net, gas, and currency before confirmation.
+- Run end-to-end tests on a mainnet fork and a public Ethereum testnet using representative token ownership.
+- Triage auditor findings daily. Only remediation changes touch the frozen contracts; every change is supplied as a focused diff with regression tests.
+
+Exit: complete user journey on staging; all critical/high findings fixed or launch blocked.
+
+### Week 4 — remediation, independent verification, and launch
+
+- Auditor retests fixes and issues the final report. Resolve medium findings or document explicit risk acceptance before launch.
+- Run full unit, fuzz/invariant, fork, static-analysis, and frontend end-to-end suites; independently review deployed bytecode parameters and role/ownership assumptions.
+- Deploy the exact audited commit, verify source on Etherscan, verify immutable collection/WETH/artist addresses, and execute a low-value end-to-end listing purchase, offer acceptance, and withdrawal.
+- Enable monitoring for fills, cancellations, failed transactions, abnormal credited balances, indexer lag, and frontend/API errors. Publish addresses, audit report, limitations, and support/runbook material.
+
+Exit: verified mainnet contract, reproducible deployment record, successful smoke transactions, monitoring live, and incident owner named. If the audit is not closed, launch slips rather than compressing review.
+
+## Audit scope for quotation
+
+### In-scope code and artifacts
+
+The quote covers one frozen repository commit supplied at the end of week 2:
+
+1. `CollectionMarketplace.sol` and any project-owned Solidity libraries it imports (expected: one primary contract, approximately 250–400 non-comment Solidity lines).
+2. The EIP-712 `Order` type, hashing/signature helpers, cancellation bitmap/mapping or consumed-order mapping, per-user nonce logic, pull-payment ledger, and withdrawal logic.
+3. Integration points with the existing collection's `ownerOf`, approvals, and `safeTransferFrom`; canonical mainnet WETH `balanceOf`, `allowance`, and `transferFrom`; OpenZeppelin `EIP712`, `ECDSA`, `ReentrancyGuard`, and `SafeERC20` at locked versions.
+4. Deployment script and constructor/configuration validation for chain ID, collection, WETH, and artist recipient.
+5. Solidity unit, fuzz/invariant, and mainnet-fork tests, plus the order-signing test vectors used by the frontend.
+
+Provide the auditor the exact commit hash, compiler and optimizer settings, dependency lockfile and source revisions, ABI, architecture/order-format document, invariants below, coverage report, static-analysis output, fork block number/RPC requirements, deployment parameters, and known issues. The auditor should quote initial review, one remediation review of a bounded diff, and final report separately; additional feature changes trigger a scope/fee adjustment.
+
+### Security properties and attack cases to review
+
+- Only the maker can authorize or cancel an order; signatures cannot replay after fill, cancellation, nonce increment, on another chain, or against another marketplace.
+- A fill cannot substitute collection, token ID, maker, currency, price, expiry, or order kind; malformed signatures and smart-contract-wallet signatures have an explicit policy. MVP policy: EOAs only unless ERC-1271 support is deliberately added before scope freeze.
+- A sale succeeds only for the current owner with sufficient approval. Ownership changes invalidate old listings, including a token leaving and later returning to the same address only if nonce/order cancellation rules require that guarantee; document that a still-valid signed listing can revive when the same owner reacquires unless explicitly prevented.
+- Each order fills at most once under reentrancy, callback-capable NFT receivers, hostile payment receivers, front-running, and concurrent fills.
+- Native ETH handling rejects incorrect value and accidental/unaccounted ETH; WETH settlement cannot underpay or use a non-canonical token.
+- For every successful fill, credited seller amount plus credited royalty equals gross price exactly; royalty is `floor(price * 250 / 10_000)` and the seller receives the remainder. No privileged party can redirect or change it.
+- Pull-payment balances cannot be stolen, double-withdrawn, locked by another recipient, or rendered insolvent; state updates precede transfers and failed withdrawals preserve credit.
+- Cancellation and nonce boundaries, expiry timestamp behavior, zero price, self-trades, nonexistent tokens, approval revocation, insufficient WETH/allowance, fee-on-transfer assumptions, forced ETH, and denial-of-service/griefing are tested.
+- Events accurately support reconstruction of fills, cancellations, nonce changes, credits, and withdrawals without being relied upon for contract correctness.
+- Constructor immutables and absence of upgrade/admin paths match the documented trust model.
+
+Required invariants for the auditor and test suite:
+
+1. `filled[orderHash]` or `cancelled[orderHash]` makes that order permanently unfillable.
+2. Native ETH held by the contract is at least the sum of all pending native credits; WETH balance is at least the sum of all pending WETH credits.
+3. A successful settlement moves exactly one specified NFT to the buyer and creates credits totaling exactly its signed gross price.
+4. No address except the credited address can reduce that address's pending balance.
+5. No external call can observe an order as unconsumed after settlement has begun.
+
+### Explicitly out of scope
+
+- The already deployed NFT contract's full implementation, except its marketplace-facing behavior exercised on a fork.
+- Canonical WETH and OpenZeppelin internals as standalone audits; their correct configuration and use remain in scope.
+- Frontend, API, database, indexer availability/censorship, wallet software, DNS/hosting, and cloud security. The auditor receives signing test vectors to check contract/frontend encoding compatibility, but this is not a full web audit.
+- Artist key or multisig operational security, user phishing/social engineering, marketplace economics, tax/legal analysis, NFT metadata/media, and third-party RPC/indexing services.
+- Any feature excluded from the MVP decision, any later deployment, and changes after the frozen commit except the agreed remediation diff.
+
+## Deployment and operational handoff
+
+Use a deterministic deployment script pinned to Ethereum mainnet (`chainId 1`) with required environment variables for RPC URL, deployer key/hardware-wallet route, Etherscan API key, collection address, WETH address, and artist recipient. Before broadcast, the script must reject zero addresses and mismatched chain ID. The repository README will contain exact build/test, deploy, source-verification, bytecode-comparison, and smoke-test commands; actual commands depend on the selected Foundry/Hardhat scaffold and are frozen with the audit commit.
+
+The contract has no owner or admin. The artist recipient is immutable and should be a tested Safe multisig address; changing it requires a newly audited deployment. Monitor contract credits against balances, fill/cancel/withdraw events, and indexer freshness. The incident response is to remove the frontend/API publishing path and warn users; because signed orders remain permissionlessly fillable, affected makers must also cancel the specific order or increment their nonce onchain.

2026-08-24T20:59:28.221313Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `base_instructions` at line 97 column 5
codex
Created [plan.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-24T205809Z-codex-with-skill-3/workspace/plan.md).

It covers the four-week MVP schedule, non-custodial signed-order architecture, ETH listings, WETH offers, 2.5% royalties, state-transition responsibilities, deployment handoff, and a precise audit scope with invariants, attack cases, deliverables, and exclusions.
diff --git a/artifacts/ship-quiz-001/2026-08-24T205809Z-codex-with-skill-3/workspace/plan.md b/artifacts/ship-quiz-001/2026-08-24T205809Z-codex-with-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..4efbfdf8348ad850871ea6ad3924a10864ab68c4
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-08-24T205809Z-codex-with-skill-3/workspace/plan.md
@@ -0,0 +1,137 @@
+# Four-week marketplace MVP plan
+
+## MVP decision
+
+Ship one non-upgradeable marketplace contract on Ethereum mainnet for the existing 5,000-token ERC-721 collection. Ethereum mainnet is the only sensible MVP target because the collection and its ownership already live there; moving trading to another chain would require bridging or wrapped assets and would fragment liquidity.
+
+The marketplace never escrows NFTs. A sale is one atomic transaction: the contract verifies an order, transfers the NFT from its current owner to the buyer, and distributes payment. The seller must still own the token and approve the marketplace (per-token or `setApprovalForAll`) at settlement time.
+
+Use signed offchain orders rather than storing every listing and offer onchain. This makes listing free, while acceptance/purchase pays gas. An order contains:
+
+- order kind (`LISTING` or `OFFER`), collection address, token ID, maker, payment token, price, expiry, and maker nonce;
+- the marketplace address and Ethereum chain ID through EIP-712 domain separation;
+- for a listing, payment token is native ETH and maker is the current owner;
+- for an offer, payment token is WETH and maker is the buyer.
+
+Offers use WETH because an owner cannot later pull native ETH from an absent buyer. WETH is not marketplace escrow: the buyer keeps it and grants an allowance until acceptance. An offer can consequently become unfillable if the buyer moves the WETH or removes allowance; the UI must label this clearly.
+
+On every successful resale, exactly 2.5% of gross price goes to the artist royalty recipient and 97.5% goes to the seller. The royalty recipient is an immutable constructor argument and the rate is the constant 250 basis points. There is no platform fee. The implementation uses pull payments: settlement credits internal balances, and each recipient withdraws separately. This prevents a reverting artist or seller receiver from blocking a sale. Integer division rounds the royalty down in favor of the seller.
+
+The MVP deliberately supports only the named ERC-721 contract, native ETH listings, and canonical mainnet WETH offers. It excludes auctions, bids on the whole collection, ERC-20 currencies other than WETH, bundles, partial fills, private sales, fees, upgradeability, proxies, admin pausing, royalty changes, custody, bridging, and new NFT minting.
+
+## Onchain and offchain boundary
+
+Onchain, the single custom `CollectionMarketplace` contract performs signature and order validation, cancellation, atomic ERC-721/payment settlement, royalty accounting, withdrawals, replay prevention, and emits events.
+
+Offchain, the site and indexer store signed orders, index marketplace and ERC-721 events, test current ownership/approval/balance/allowance, and provide browse, search, sorting, metadata, images, user-readable status, and transaction history. The database is a convenience and may hide an order, but cannot invent a valid signature or alter settlement. Anyone with a valid signed order can submit it directly to the contract.
+
+## Contract surface and state transitions
+
+Proposed external surface (exact names may change before audit freeze, but the frozen commit and ABI will not):
+
+- `buy(Order listing, bytes signature) payable`: buyer fills one signed listing; requires exact `msg.value`.
+- `acceptOffer(Order offer, bytes signature)`: current owner fills one signed offer using WETH `transferFrom`.
+- `cancelOrder(bytes32 orderHash)`: maker invalidates one order.
+- `incrementNonce()`: maker invalidates all orders signed with the prior nonce.
+- `withdraw()`: caller withdraws their credited native ETH and WETH proceeds/royalties.
+- read helpers: `hashOrder`, `isOrderFillable`, `pendingNative`, and `pendingWeth`.
+
+Both fill paths mark the order consumed before external calls, are non-reentrant, require a nonzero price and unexpired order, recover the maker from the EIP-712 signature, restrict collection/payment token to constructor-configured addresses, verify ownership and approval, and use `safeTransferFrom`/`SafeERC20`. A listing is valid only while its maker is the current owner. An offer is accepted only by the current owner, and cannot be self-filled. Successful fills and all cancellation/nonce/withdrawal changes emit indexed events.
+
+| Transition | Caller | Why they pay gas | Safe outcome if nobody calls |
+| --- | --- | --- | --- |
+| Sign listing or offer | seller or buyer (offchain) | no gas | No order exists or trade occurs. |
+| `buy` | buyer | Receives the NFT at the signed price. | Listing remains fillable until expiry, cancellation, ownership/approval change, or nonce change. |
+| `acceptOffer` | current NFT owner | Receives 97.5% of price as withdrawable WETH. | Offer remains fillable until expiry/cancellation/nonce change, subject to WETH balance and allowance. |
+| `cancelOrder` | order maker | Prevents a specific unwanted fill. | Order remains valid until another invalidating event. |
+| `incrementNonce` | order maker | Cancels all their orders at once. | Existing orders remain independently valid. |
+| `withdraw` | credited seller or artist | Receives accumulated proceeds. | Funds remain credited in the contract; nobody else can withdraw them. |
+
+The frontend must avoid signature ambiguity: show collection, token, gross price, currency, royalty, seller net, expiry, and cancellation implications before signing. It must never describe a signature as a gas transaction.
+
+## Four-week build plan
+
+### Week 1 — freeze behavior and prove the vertical slice
+
+- Confirm the collection address, canonical WETH address, artist payout address (preferably a Safe multisig), supported wallet baseline, and existing ERC-721 behavior, including whether transfers have custom restrictions.
+- Write the order schema, EIP-712 typed data, settlement invariants, threat model, and the final ABI.
+- Implement the contract skeleton using pinned OpenZeppelin dependencies and unit tests for one listing purchase, one accepted offer, cancellation, nonce invalidation, expiry, and royalty rounding.
+- Build a mainnet-fork integration test against the actual NFT contract and WETH. Freeze architecture at the end of the week.
+
+Exit: both trade paths work on a fork; product signs off the displayed signing/settlement terms; auditor confirms the scope is quoteable.
+
+### Week 2 — complete contracts and indexing
+
+- Finish validation, replay protection, pull-payment accounting, withdrawals, events, custom errors, and property/fuzz tests.
+- Add an indexer/database for signed orders and chain events. Recompute fillability from current owner, approval, nonce, cancellation/fill state, expiry, and (for offers) WETH balance/allowance.
+- Expose API endpoints to publish/query signed orders; validate schema, signature, chain, collection, and reasonable expiry server-side. Add rate limits and abuse controls.
+- Run static analysis and gas snapshots; hand the feature-complete commit and audit package to the auditor. No new contract features after handoff.
+
+Exit: frozen audit commit, ABI, invariants, test suite, deployment configuration, dependency lockfile, and known-issues list delivered.
+
+### Week 3 — frontend and audit in parallel
+
+- Build collection browse/token pages, wallet connect, list, buy, offer, accept, cancel-one, cancel-all, approval, WETH wrap/approve, and withdrawal flows.
+- Show stale/unfillable order states and distinguish offchain signing from transactions. Simulate transactions and present gross price, 2.5% royalty, seller net, gas, and currency before confirmation.
+- Run end-to-end tests on a mainnet fork and a public Ethereum testnet using representative token ownership.
+- Triage auditor findings daily. Only remediation changes touch the frozen contracts; every change is supplied as a focused diff with regression tests.
+
+Exit: complete user journey on staging; all critical/high findings fixed or launch blocked.
+
+### Week 4 — remediation, independent verification, and launch
+
+- Auditor retests fixes and issues the final report. Resolve medium findings or document explicit risk acceptance before launch.
+- Run full unit, fuzz/invariant, fork, static-analysis, and frontend end-to-end suites; independently review deployed bytecode parameters and role/ownership assumptions.
+- Deploy the exact audited commit, verify source on Etherscan, verify immutable collection/WETH/artist addresses, and execute a low-value end-to-end listing purchase, offer acceptance, and withdrawal.
+- Enable monitoring for fills, cancellations, failed transactions, abnormal credited balances, indexer lag, and frontend/API errors. Publish addresses, audit report, limitations, and support/runbook material.
+
+Exit: verified mainnet contract, reproducible deployment record, successful smoke transactions, monitoring live, and incident owner named. If the audit is not closed, launch slips rather than compressing review.
+
+## Audit scope for quotation
+
+### In-scope code and artifacts
+
+The quote covers one frozen repository commit supplied at the end of week 2:
+
+1. `CollectionMarketplace.sol` and any project-owned Solidity libraries it imports (expected: one primary contract, approximately 250–400 non-comment Solidity lines).
+2. The EIP-712 `Order` type, hashing/signature helpers, cancellation bitmap/mapping or consumed-order mapping, per-user nonce logic, pull-payment ledger, and withdrawal logic.
+3. Integration points with the existing collection's `ownerOf`, approvals, and `safeTransferFrom`; canonical mainnet WETH `balanceOf`, `allowance`, and `transferFrom`; OpenZeppelin `EIP712`, `ECDSA`, `ReentrancyGuard`, and `SafeERC20` at locked versions.
+4. Deployment script and constructor/configuration validation for chain ID, collection, WETH, and artist recipient.
+5. Solidity unit, fuzz/invariant, and mainnet-fork tests, plus the order-signing test vectors used by the frontend.
+
+Provide the auditor the exact commit hash, compiler and optimizer settings, dependency lockfile and source revisions, ABI, architecture/order-format document, invariants below, coverage report, static-analysis output, fork block number/RPC requirements, deployment parameters, and known issues. The auditor should quote initial review, one remediation review of a bounded diff, and final report separately; additional feature changes trigger a scope/fee adjustment.
+
+### Security properties and attack cases to review
+
+- Only the maker can authorize or cancel an order; signatures cannot replay after fill, cancellation, nonce increment, on another chain, or against another marketplace.
+- A fill cannot substitute collection, token ID, maker, currency, price, expiry, or order kind; malformed signatures and smart-contract-wallet signatures have an explicit policy. MVP policy: EOAs only unless ERC-1271 support is deliberately added before scope freeze.
+- A sale succeeds only for the current owner with sufficient approval. Ownership changes invalidate old listings, including a token leaving and later returning to the same address only if nonce/order cancellation rules require that guarantee; document that a still-valid signed listing can revive when the same owner reacquires unless explicitly prevented.
+- Each order fills at most once under reentrancy, callback-capable NFT receivers, hostile payment receivers, front-running, and concurrent fills.
+- Native ETH handling rejects incorrect value and accidental/unaccounted ETH; WETH settlement cannot underpay or use a non-canonical token.
+- For every successful fill, credited seller amount plus credited royalty equals gross price exactly; royalty is `floor(price * 250 / 10_000)` and the seller receives the remainder. No privileged party can redirect or change it.
+- Pull-payment balances cannot be stolen, double-withdrawn, locked by another recipient, or rendered insolvent; state updates precede transfers and failed withdrawals preserve credit.
+- Cancellation and nonce boundaries, expiry timestamp behavior, zero price, self-trades, nonexistent tokens, approval revocation, insufficient WETH/allowance, fee-on-transfer assumptions, forced ETH, and denial-of-service/griefing are tested.
+- Events accurately support reconstruction of fills, cancellations, nonce changes, credits, and withdrawals without being relied upon for contract correctness.
+- Constructor immutables and absence of upgrade/admin paths match the documented trust model.
+
+Required invariants for the auditor and test suite:
+
+1. `filled[orderHash]` or `cancelled[orderHash]` makes that order permanently unfillable.
+2. Native ETH held by the contract is at least the sum of all pending native credits; WETH balance is at least the sum of all pending WETH credits.
+3. A successful settlement moves exactly one specified NFT to the buyer and creates credits totaling exactly its signed gross price.
+4. No address except the credited address can reduce that address's pending balance.
+5. No external call can observe an order as unconsumed after settlement has begun.
+
+### Explicitly out of scope
+
+- The already deployed NFT contract's full implementation, except its marketplace-facing behavior exercised on a fork.
+- Canonical WETH and OpenZeppelin internals as standalone audits; their correct configuration and use remain in scope.
+- Frontend, API, database, indexer availability/censorship, wallet software, DNS/hosting, and cloud security. The auditor receives signing test vectors to check contract/frontend encoding compatibility, but this is not a full web audit.
+- Artist key or multisig operational security, user phishing/social engineering, marketplace economics, tax/legal analysis, NFT metadata/media, and third-party RPC/indexing services.
+- Any feature excluded from the MVP decision, any later deployment, and changes after the frozen commit except the agreed remediation diff.
+
+## Deployment and operational handoff
+
+Use a deterministic deployment script pinned to Ethereum mainnet (`chainId 1`) with required environment variables for RPC URL, deployer key/hardware-wallet route, Etherscan API key, collection address, WETH address, and artist recipient. Before broadcast, the script must reject zero addresses and mismatched chain ID. The repository README will contain exact build/test, deploy, source-verification, bytecode-comparison, and smoke-test commands; actual commands depend on the selected Foundry/Hardhat scaffold and are frozen with the audit commit.
+
+The contract has no owner or admin. The artist recipient is immutable and should be a tested Safe multisig address; changing it requires a newly audited deployment. Monitor contract credits against balances, fill/cancel/withdraw events, and indexer freshness. The incident response is to remove the frontend/API publishing path and warn users; because signed orders remain permissionlessly fillable, affected makers must also cancel the specific order or increment their nonce onchain.

tokens used
18,991
Created [plan.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-24T205809Z-codex-with-skill-3/workspace/plan.md).

It covers the four-week MVP schedule, non-custodial signed-order architecture, ETH listings, WETH offers, 2.5% royalties, state-transition responsibilities, deployment handoff, and a precise audit scope with invariants, attack cases, deliverables, and exclusions.
