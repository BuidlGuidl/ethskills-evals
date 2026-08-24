Reading additional input from stdin...
OpenAI Codex v0.146.1
--------
workdir: /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-24T205633Z-codex-with-skill-2/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a0358f-868f-7c10-baf8-a6b7abef327b
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
2026-08-24T20:56:33.882029Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a0358f-868f-7c10-baf8-a6b7abef327b.tmp-1787604993691178783: line 2547: syntax error near unexpected token `('

codex
I’m using the `ship` skill because this request is specifically about defining an Ethereum dApp’s onchain boundary, transaction flows, delivery plan, and audit handoff.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/ship/SKILL.md" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-24T205633Z-codex-with-skill-2/workspace
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
---
name: ship
description: Plan and ship a minimal Ethereum dApp from architecture through deployment. Use before or during a build to decide the onchain boundary, contract surface, state-transition callers, target chain, and production handoff.
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
custom contracts; more than three is a signal to reduce scope. Do not add a
factory, escrow, router, or fee-splitter unless its separate trust boundary is
required by the product.

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
details—for example `security`, `testing`, `frontend-ux`, `frontend-playbook`,
or `qa`. Stop when the requested vertical slice and its runbook are complete.

codex
The key design choice is a single non-custodial settlement contract using signed orders. Offers should be denominated in WETH, not bare ETH, because an owner cannot later pull ETH from a buyer’s wallet; WETH allowance makes delayed acceptance possible without escrow.
apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-24T205633Z-codex-with-skill-2/workspace/plan.md
diff --git a/artifacts/ship-quiz-001/2026-08-24T205633Z-codex-with-skill-2/workspace/plan.md b/artifacts/ship-quiz-001/2026-08-24T205633Z-codex-with-skill-2/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..30af00365b8221394370e460e32742fb08ec2ea9
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-08-24T205633Z-codex-with-skill-2/workspace/plan.md
@@ -0,0 +1,146 @@
+# Four-week MVP plan: non-custodial collection marketplace
+
+## MVP definition and decisions
+
+Build a marketplace for the existing 5,000-token ERC-721 collection on Ethereum mainnet. Use one non-upgradeable `CollectionMarketplace` contract, restricted to that collection, with a fixed 2.5% royalty recipient (the artist). A sale atomically transfers the NFT and consideration; neither NFTs nor buyer funds are deposited into the marketplace while an order waits.
+
+Listings and offers are EIP-712 signed orders stored/indexed offchain. The signature is authorization, not custody. The contract validates the signature and current onchain state at fill time. This keeps browse/search data and stale-order cleanup offchain while ownership and settlement remain trustless.
+
+- A listing is signed by the current NFT owner for an exact token, price, currency, expiry, and nonce. The NFT stays in the owner's wallet, but the owner must approve the marketplace as operator. A buyer fills it with ETH or WETH.
+- An offer is signed by a buyer in WETH for an exact token, price, expiry, and nonce. WETH is required because native ETH cannot be approved for later pull. The WETH stays in the buyer's wallet, and the buyer grants an allowance to the marketplace. The current owner accepts and transfers the NFT atomically.
+- Settlement sends 2.5% of gross consideration to the fixed artist address and 97.5% to the seller. Use integer floor division for the royalty (`price * 250 / 10_000`), with the remainder going to the seller. No platform fee in the MVP.
+- Royalties are guaranteed only for sales executed through this marketplace. The contract cannot force unrelated transfers or third-party marketplaces to pay royalties. If the existing collection exposes ERC-2981, the UI may display it, but settlement uses the marketplace's fixed, audited rule; deployment must confirm its recipient agrees with the intended artist.
+- Mainnet is the only production target: the collection and its holders/liquidity already live there, and moving to an L2 would require bridging or wrapping the existing NFTs. Develop and test locally and on a mainnet fork; use Sepolia only for UI rehearsal.
+
+### Onchain boundary
+
+Onchain: EIP-712 verification, collection/currency allowlisting, ownership and approval checks, nonce/cancellation state, replay prevention, atomic ERC-721/WETH/ETH settlement, royalty calculation, and sale/cancellation events.
+
+Offchain: signed-order storage, browsing, search/filtering, collection metadata/media, Discord/user profiles, activity views, order validity polling, and transaction-status indexing. The database is a convenience: a valid signed order can be submitted directly to the contract even if the API is unavailable. No rankings, metadata, or order book are stored in contract storage.
+
+### Contract surface (audit baseline)
+
+The implementation should remain one immutable, non-proxy contract, approximately 350–500 nonblank Solidity source lines excluding tests and vendored OpenZeppelin code, compiled with a pinned Solidity 0.8.x version.
+
+```solidity
+struct Order {
+    address maker;
+    uint256 tokenId;
+    address currency; // address(0) for listing paid in ETH; WETH otherwise
+    uint256 price;
+    uint256 nonce;
+    uint256 deadline;
+}
+
+function buyWithETH(Order calldata listing, bytes calldata signature) external payable;
+function buyWithWETH(Order calldata listing, bytes calldata signature) external;
+function acceptWETHOffer(Order calldata offer, bytes calldata signature) external;
+function cancelNonce(uint256 nonce) external;
+function incrementMinNonce() external;
+function isNonceUsedOrCancelled(address maker, uint256 nonce) external view returns (bool);
+function hashOrder(Order calldata order) external view returns (bytes32);
+```
+
+Orders also include an order-kind discriminator in their EIP-712 type hash (listing versus offer), the marketplace address and chain ID through the domain separator, and the fixed collection through contract configuration. Exact nonce semantics must be documented before implementation: individual nonces are one-shot, and `incrementMinNonce` invalidates all lower maker nonces. A successful fill marks the nonce used before external calls.
+
+Use OpenZeppelin `ECDSA`, `EIP712`, `ReentrancyGuard`, `SafeERC20`, and ERC-721 interfaces. Support EOAs in the MVP; ERC-1271 smart-contract signatures are explicitly out of scope. Reject zero price, expired orders, wrong order kind/currency, invalid signatures, reused/cancelled nonces, wrong owner, missing NFT approval, insufficient WETH balance/allowance, and incorrect `msg.value`. Do not accept fee-on-transfer/rebasing tokens; WETH is the only ERC-20. Do not implement custody, auctions, bids on the whole collection, partial fills, bundles, private sales, upgradeability, admin price changes, or arbitrary collections/currencies.
+
+For ETH sales, transfer the NFT and pay the artist and seller in the same transaction using guarded calls; any failed payout reverts the entire sale, so the NFT and funds cannot separate. WETH sales use `safeTransferFrom` directly from buyer to artist and seller. The contract should have no normal retained balance. Add a narrowly scoped recovery function only if the team accepts the extra admin trust and audit surface; otherwise reject accidental ETH via `receive`/`fallback` and leave recovery out.
+
+## State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| Sign/publish listing | Owner (offchain signature/API) | No gas; wants a sale | No listing appears; NFT remains owned |
+| Buy listing | Buyer | Receives the selected NFT | Order remains fillable until expiry/cancellation or becomes stale |
+| Sign/publish WETH offer | Buyer (offchain signature/API) | No gas; wants the NFT | No offer appears; WETH remains in buyer wallet |
+| Accept WETH offer | Current NFT owner | Receives 97.5% of offer | Offer waits until expiry/cancellation or becomes invalid |
+| Cancel one nonce | Order maker | Prevents an unwanted fill | Signature remains fillable if all other conditions hold |
+| Increment minimum nonce | Order maker | Cancels many old orders at once | Existing lower-nonce signatures remain fillable |
+
+Changing ownership, revoking NFT approval, spending/revoking WETH, or reaching expiry makes an order unfillable without a cancellation transaction. The indexer should hide these stale orders quickly, but the contract must independently reject them.
+
+## Four-week delivery plan
+
+### Week 1 — specification and transaction skeleton
+
+- Confirm the deployed collection address, WETH address, artist payout address, multisig/deployer, existing ERC-2981 behavior, and the collection's actual ERC-721 transfer/approval behavior on a mainnet fork.
+- Freeze the EIP-712 schema, nonce rules, rounding, event schema, revert behavior, and all in/out-of-scope items above. Produce sequence diagrams for ETH listing fill, WETH listing fill, offer acceptance, and cancellation.
+- Implement the contract skeleton and unit tests for hashing, signatures, expiry, order-kind separation, nonce invalidation, ownership, approvals, and fee math.
+- Define the API/order record and indexer event model. Scaffold browse, token detail, connect-wallet, and list/offer dialogs.
+
+Exit criterion: reviewed specification and contract API; fork test proves a real collection token can be transferred via the intended approval path.
+
+### Week 2 — complete settlement and backend
+
+- Implement ETH/WETH listing fills, WETH offer acceptance, checks-effects-interactions ordering, reentrancy protection, cancellation, and events.
+- Add unit, fuzz, invariant, and mainnet-fork integration tests, including adversarial receivers and stale orders.
+- Build order ingestion: recompute typed-data hash, recover maker, validate schema/chain/contract, rate-limit, store, and continuously reconcile owner/approval/balance/allowance/nonce/expiry.
+- Build listing creation, purchase, offer creation, acceptance, and cancellation UI with explicit approval/allowance steps and price/royalty breakdown.
+
+Exit criterion: full vertical slice works locally against a mainnet fork; API cannot invent or alter a valid order.
+
+### Week 3 — hardening and release candidate
+
+- Complete UI states for wallet/network mismatch, rejected signatures, pending/replaced/reverted transactions, stale listings, insufficient allowance/balance, and payout failures.
+- Run static analysis, gas snapshots, coverage review, fuzzing, and invariants: a nonce settles at most once; successful settlement transfers exactly one NFT; royalty plus seller proceeds equals price; the marketplace retains no funds after successful settlement.
+- Deploy a release candidate to Sepolia with mock collection/WETH for end-to-end rehearsal. Freeze contract code and compiler/dependency versions at week's end.
+- Prepare auditor repository: commit hash, build instructions, architecture, threat model, test commands/results, deployment parameters, known issues, and the exact scope below.
+
+Exit criterion: code freeze, reproducible green suite, no unresolved high-severity internal findings, and auditor handoff accepted as complete.
+
+### Week 4 — audit response and mainnet readiness
+
+- Auditor reviews the frozen commit. Team answers questions without silently changing scope; every fix gets a separate commit, regression test, and auditor review.
+- Run final fork tests using exact production constructor values. Deploy from the designated account, verify source, and check bytecode/constructor arguments independently.
+- Execute a low-value end-to-end mainnet listing and sale with a team-owned collection token if available; otherwise do not use a holder's asset as a test. Verify NFT transfer, both payouts, event ingestion, and zero retained marketplace balance.
+- Publish the contract address, supported collection/currency, royalty rule, limitations, and incident contacts; enable the site only after the audit's release-blocking findings are resolved.
+
+Exit criterion: auditor sign-off/review of fixes, verified deployment, independent configuration check, successful smoke transaction, monitoring and rollback plan for the offchain app. The immutable contract cannot be paused or upgraded; if a critical issue is found, the site/API stop publishing orders and approvals are revoked while a new audited contract is prepared.
+
+Audit duration is an external dependency: four weeks is achievable only if an auditor reserves week 4 in advance and turns fixes promptly. Otherwise week 4 produces an audit-ready release candidate, not an unaudited mainnet launch.
+
+## Precise audit scope for quotation
+
+### In-scope code and dependencies
+
+Quote a review of one non-upgradeable Solidity contract implementing the surface above, targeting one existing ERC-721 collection and canonical mainnet WETH. Final scope is identified by repository URL, frozen commit SHA, exact file paths, compiler version/settings, and nonblank SLOC count at code freeze. Include directly inherited/custom library code; standard pinned OpenZeppelin dependencies are dependency-assumption review rather than line-by-line re-audit.
+
+Also in scope:
+
+- EIP-712 domain/type construction, ECDSA malleability handling, listing/offer separation, replay resistance across nonce, contract, and chain, and signature-to-order field binding.
+- Authorization and state validation at execution: current ownership, operator approval, buyer balance/allowance, deadlines, supported collection/currency, individual and bulk cancellation, and one-fill-only behavior.
+- Atomic ERC-721 plus ETH/WETH settlement; 250 bps arithmetic and rounding; exact conservation of consideration; reentrancy and checks-effects-interactions; behavior of reverting/malicious seller, artist, buyer, ERC-721 receiver, collection, and token calls.
+- ERC-721 and WETH integration assumptions against their deployed mainnet bytecode on a fork, including approval and `safeTransferFrom` behavior.
+- Accidental funds/NFT behavior and confirmation that there is no privileged path to seize orders, NFTs, or proceeds.
+- Events matching state transitions and sufficient data for independent order-status/activity reconstruction.
+- Unit/fuzz/invariant/fork tests for security-critical behavior, deployment script/constructor arguments, source verification procedure, and production-address/configuration validation.
+
+The auditor should deliver a severity-ranked report, proof-of-concept or reproducible steps for findings, review of remediation commits, and a final report identifying the deployed-review commit. Ask the quote to state review days, turnaround, number of included remediation rounds, and whether deployment/configuration verification is included.
+
+### Required security properties
+
+1. Only a maker-authorized, unexpired, uncancelled order with every field intact can execute.
+2. An order nonce cannot execute more than once, including through reentrancy or alternate entry points.
+3. A listing cannot move a token unless its signer is the current owner at execution and has approved the marketplace; an offer cannot spend beyond the signer's valid WETH authorization.
+4. A successful sale atomically transfers the specified NFT and exactly the stated price: 2.5% (floor-rounded) to the artist and the remainder to the seller. Any failed leg reverts all legs.
+5. Orders cannot replay on another chain, marketplace, order kind, token, price, currency, maker, nonce, or deadline.
+6. No user depends on an operator, indexer, keeper, or administrator to settle or cancel, and normal execution leaves no assets in the marketplace.
+7. No privileged role can change the collection, WETH, artist, or royalty after deployment. Constructor misconfiguration is therefore a release-critical risk.
+
+### Explicitly out of scope and stated assumptions
+
+- The already-deployed NFT collection's internal correctness, metadata availability, provenance, minting, and intellectual-property claims, except its transfer/approval integration with this contract.
+- OpenZeppelin and canonical WETH internals beyond correct use and deployed-address verification.
+- Frontend, API, database, indexer, wallet software, DNS/hosting, key management, social engineering, and signature-prompt presentation. These require separate application/security review; nevertheless, the contract must remain safe if the API/indexer is malicious or unavailable.
+- Gas optimization except where gas creates denial of service; economic analysis beyond a fixed-price bilateral sale; tax/legal/regulatory review; third-party royalty enforcement.
+- ERC-1155, arbitrary collections or ERC-20s, fee-on-transfer/rebasing tokens, ERC-1271, permits, partial fills, bundles, auctions, collection-wide bids, private orders, upgradeability, custody, fee splitting, referral/platform fees, and admin recovery/pausing unless added before freeze.
+- Compromise of an order maker's key, malicious signatures knowingly approved by a user, compromised deployer before deployment, and changes to external contracts. The artist and seller addresses must be able to receive ETH for ETH listings; otherwise those sales revert safely. Buyers may revoke/spend WETH and sellers may transfer/revoke approval, making orders stale by design.
+
+Any addition to the contract surface or trust model after the quote—especially ERC-1271, permit support, arbitrary currencies/collections, admin recovery, pausing, upgradeability, or new fee recipients—requires explicit auditor re-scoping.
+
+## Deployment and operational handoff
+
+Before code freeze, the README must contain executable commands (filled with the chosen toolchain) for install, compile, test, fork test, deploy to Ethereum mainnet, and verify on Etherscan; required RPC/explorer/deployer environment variables; exact collection, WETH, artist, and royalty constructor values; deployer/ownership destination; compiler optimizer settings; and the smoke-test procedure.
+
+Monitor fills, cancellations, reverts, payout failures, indexer lag, and unexpected contract balances. The UI must always show the contract address and decoded order details before signature. Preserve signed-order and event records for incident investigation. Obtain a fresh independent reviewer for the complete vertical slice—not only the Solidity—before enabling public order submission.

diff --git a/artifacts/ship-quiz-001/2026-08-24T205633Z-codex-with-skill-2/workspace/plan.md b/artifacts/ship-quiz-001/2026-08-24T205633Z-codex-with-skill-2/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..30af00365b8221394370e460e32742fb08ec2ea9
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-08-24T205633Z-codex-with-skill-2/workspace/plan.md
@@ -0,0 +1,146 @@
+# Four-week MVP plan: non-custodial collection marketplace
+
+## MVP definition and decisions
+
+Build a marketplace for the existing 5,000-token ERC-721 collection on Ethereum mainnet. Use one non-upgradeable `CollectionMarketplace` contract, restricted to that collection, with a fixed 2.5% royalty recipient (the artist). A sale atomically transfers the NFT and consideration; neither NFTs nor buyer funds are deposited into the marketplace while an order waits.
+
+Listings and offers are EIP-712 signed orders stored/indexed offchain. The signature is authorization, not custody. The contract validates the signature and current onchain state at fill time. This keeps browse/search data and stale-order cleanup offchain while ownership and settlement remain trustless.
+
+- A listing is signed by the current NFT owner for an exact token, price, currency, expiry, and nonce. The NFT stays in the owner's wallet, but the owner must approve the marketplace as operator. A buyer fills it with ETH or WETH.
+- An offer is signed by a buyer in WETH for an exact token, price, expiry, and nonce. WETH is required because native ETH cannot be approved for later pull. The WETH stays in the buyer's wallet, and the buyer grants an allowance to the marketplace. The current owner accepts and transfers the NFT atomically.
+- Settlement sends 2.5% of gross consideration to the fixed artist address and 97.5% to the seller. Use integer floor division for the royalty (`price * 250 / 10_000`), with the remainder going to the seller. No platform fee in the MVP.
+- Royalties are guaranteed only for sales executed through this marketplace. The contract cannot force unrelated transfers or third-party marketplaces to pay royalties. If the existing collection exposes ERC-2981, the UI may display it, but settlement uses the marketplace's fixed, audited rule; deployment must confirm its recipient agrees with the intended artist.
+- Mainnet is the only production target: the collection and its holders/liquidity already live there, and moving to an L2 would require bridging or wrapping the existing NFTs. Develop and test locally and on a mainnet fork; use Sepolia only for UI rehearsal.
+
+### Onchain boundary
+
+Onchain: EIP-712 verification, collection/currency allowlisting, ownership and approval checks, nonce/cancellation state, replay prevention, atomic ERC-721/WETH/ETH settlement, royalty calculation, and sale/cancellation events.
+
+Offchain: signed-order storage, browsing, search/filtering, collection metadata/media, Discord/user profiles, activity views, order validity polling, and transaction-status indexing. The database is a convenience: a valid signed order can be submitted directly to the contract even if the API is unavailable. No rankings, metadata, or order book are stored in contract storage.
+
+### Contract surface (audit baseline)
+
+The implementation should remain one immutable, non-proxy contract, approximately 350–500 nonblank Solidity source lines excluding tests and vendored OpenZeppelin code, compiled with a pinned Solidity 0.8.x version.
+
+```solidity
+struct Order {
+    address maker;
+    uint256 tokenId;
+    address currency; // address(0) for listing paid in ETH; WETH otherwise
+    uint256 price;
+    uint256 nonce;
+    uint256 deadline;
+}
+
+function buyWithETH(Order calldata listing, bytes calldata signature) external payable;
+function buyWithWETH(Order calldata listing, bytes calldata signature) external;
+function acceptWETHOffer(Order calldata offer, bytes calldata signature) external;
+function cancelNonce(uint256 nonce) external;
+function incrementMinNonce() external;
+function isNonceUsedOrCancelled(address maker, uint256 nonce) external view returns (bool);
+function hashOrder(Order calldata order) external view returns (bytes32);
+```
+
+Orders also include an order-kind discriminator in their EIP-712 type hash (listing versus offer), the marketplace address and chain ID through the domain separator, and the fixed collection through contract configuration. Exact nonce semantics must be documented before implementation: individual nonces are one-shot, and `incrementMinNonce` invalidates all lower maker nonces. A successful fill marks the nonce used before external calls.
+
+Use OpenZeppelin `ECDSA`, `EIP712`, `ReentrancyGuard`, `SafeERC20`, and ERC-721 interfaces. Support EOAs in the MVP; ERC-1271 smart-contract signatures are explicitly out of scope. Reject zero price, expired orders, wrong order kind/currency, invalid signatures, reused/cancelled nonces, wrong owner, missing NFT approval, insufficient WETH balance/allowance, and incorrect `msg.value`. Do not accept fee-on-transfer/rebasing tokens; WETH is the only ERC-20. Do not implement custody, auctions, bids on the whole collection, partial fills, bundles, private sales, upgradeability, admin price changes, or arbitrary collections/currencies.
+
+For ETH sales, transfer the NFT and pay the artist and seller in the same transaction using guarded calls; any failed payout reverts the entire sale, so the NFT and funds cannot separate. WETH sales use `safeTransferFrom` directly from buyer to artist and seller. The contract should have no normal retained balance. Add a narrowly scoped recovery function only if the team accepts the extra admin trust and audit surface; otherwise reject accidental ETH via `receive`/`fallback` and leave recovery out.
+
+## State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| Sign/publish listing | Owner (offchain signature/API) | No gas; wants a sale | No listing appears; NFT remains owned |
+| Buy listing | Buyer | Receives the selected NFT | Order remains fillable until expiry/cancellation or becomes stale |
+| Sign/publish WETH offer | Buyer (offchain signature/API) | No gas; wants the NFT | No offer appears; WETH remains in buyer wallet |
+| Accept WETH offer | Current NFT owner | Receives 97.5% of offer | Offer waits until expiry/cancellation or becomes invalid |
+| Cancel one nonce | Order maker | Prevents an unwanted fill | Signature remains fillable if all other conditions hold |
+| Increment minimum nonce | Order maker | Cancels many old orders at once | Existing lower-nonce signatures remain fillable |
+
+Changing ownership, revoking NFT approval, spending/revoking WETH, or reaching expiry makes an order unfillable without a cancellation transaction. The indexer should hide these stale orders quickly, but the contract must independently reject them.
+
+## Four-week delivery plan
+
+### Week 1 — specification and transaction skeleton
+
+- Confirm the deployed collection address, WETH address, artist payout address, multisig/deployer, existing ERC-2981 behavior, and the collection's actual ERC-721 transfer/approval behavior on a mainnet fork.
+- Freeze the EIP-712 schema, nonce rules, rounding, event schema, revert behavior, and all in/out-of-scope items above. Produce sequence diagrams for ETH listing fill, WETH listing fill, offer acceptance, and cancellation.
+- Implement the contract skeleton and unit tests for hashing, signatures, expiry, order-kind separation, nonce invalidation, ownership, approvals, and fee math.
+- Define the API/order record and indexer event model. Scaffold browse, token detail, connect-wallet, and list/offer dialogs.
+
+Exit criterion: reviewed specification and contract API; fork test proves a real collection token can be transferred via the intended approval path.
+
+### Week 2 — complete settlement and backend
+
+- Implement ETH/WETH listing fills, WETH offer acceptance, checks-effects-interactions ordering, reentrancy protection, cancellation, and events.
+- Add unit, fuzz, invariant, and mainnet-fork integration tests, including adversarial receivers and stale orders.
+- Build order ingestion: recompute typed-data hash, recover maker, validate schema/chain/contract, rate-limit, store, and continuously reconcile owner/approval/balance/allowance/nonce/expiry.
+- Build listing creation, purchase, offer creation, acceptance, and cancellation UI with explicit approval/allowance steps and price/royalty breakdown.
+
+Exit criterion: full vertical slice works locally against a mainnet fork; API cannot invent or alter a valid order.
+
+### Week 3 — hardening and release candidate
+
+- Complete UI states for wallet/network mismatch, rejected signatures, pending/replaced/reverted transactions, stale listings, insufficient allowance/balance, and payout failures.
+- Run static analysis, gas snapshots, coverage review, fuzzing, and invariants: a nonce settles at most once; successful settlement transfers exactly one NFT; royalty plus seller proceeds equals price; the marketplace retains no funds after successful settlement.
+- Deploy a release candidate to Sepolia with mock collection/WETH for end-to-end rehearsal. Freeze contract code and compiler/dependency versions at week's end.
+- Prepare auditor repository: commit hash, build instructions, architecture, threat model, test commands/results, deployment parameters, known issues, and the exact scope below.
+
+Exit criterion: code freeze, reproducible green suite, no unresolved high-severity internal findings, and auditor handoff accepted as complete.
+
+### Week 4 — audit response and mainnet readiness
+
+- Auditor reviews the frozen commit. Team answers questions without silently changing scope; every fix gets a separate commit, regression test, and auditor review.
+- Run final fork tests using exact production constructor values. Deploy from the designated account, verify source, and check bytecode/constructor arguments independently.
+- Execute a low-value end-to-end mainnet listing and sale with a team-owned collection token if available; otherwise do not use a holder's asset as a test. Verify NFT transfer, both payouts, event ingestion, and zero retained marketplace balance.
+- Publish the contract address, supported collection/currency, royalty rule, limitations, and incident contacts; enable the site only after the audit's release-blocking findings are resolved.
+
+Exit criterion: auditor sign-off/review of fixes, verified deployment, independent configuration check, successful smoke transaction, monitoring and rollback plan for the offchain app. The immutable contract cannot be paused or upgraded; if a critical issue is found, the site/API stop publishing orders and approvals are revoked while a new audited contract is prepared.
+
+Audit duration is an external dependency: four weeks is achievable only if an auditor reserves week 4 in advance and turns fixes promptly. Otherwise week 4 produces an audit-ready release candidate, not an unaudited mainnet launch.
+
+## Precise audit scope for quotation
+
+### In-scope code and dependencies
+
+Quote a review of one non-upgradeable Solidity contract implementing the surface above, targeting one existing ERC-721 collection and canonical mainnet WETH. Final scope is identified by repository URL, frozen commit SHA, exact file paths, compiler version/settings, and nonblank SLOC count at code freeze. Include directly inherited/custom library code; standard pinned OpenZeppelin dependencies are dependency-assumption review rather than line-by-line re-audit.
+
+Also in scope:
+
+- EIP-712 domain/type construction, ECDSA malleability handling, listing/offer separation, replay resistance across nonce, contract, and chain, and signature-to-order field binding.
+- Authorization and state validation at execution: current ownership, operator approval, buyer balance/allowance, deadlines, supported collection/currency, individual and bulk cancellation, and one-fill-only behavior.
+- Atomic ERC-721 plus ETH/WETH settlement; 250 bps arithmetic and rounding; exact conservation of consideration; reentrancy and checks-effects-interactions; behavior of reverting/malicious seller, artist, buyer, ERC-721 receiver, collection, and token calls.
+- ERC-721 and WETH integration assumptions against their deployed mainnet bytecode on a fork, including approval and `safeTransferFrom` behavior.
+- Accidental funds/NFT behavior and confirmation that there is no privileged path to seize orders, NFTs, or proceeds.
+- Events matching state transitions and sufficient data for independent order-status/activity reconstruction.
+- Unit/fuzz/invariant/fork tests for security-critical behavior, deployment script/constructor arguments, source verification procedure, and production-address/configuration validation.
+
+The auditor should deliver a severity-ranked report, proof-of-concept or reproducible steps for findings, review of remediation commits, and a final report identifying the deployed-review commit. Ask the quote to state review days, turnaround, number of included remediation rounds, and whether deployment/configuration verification is included.
+
+### Required security properties
+
+1. Only a maker-authorized, unexpired, uncancelled order with every field intact can execute.
+2. An order nonce cannot execute more than once, including through reentrancy or alternate entry points.
+3. A listing cannot move a token unless its signer is the current owner at execution and has approved the marketplace; an offer cannot spend beyond the signer's valid WETH authorization.
+4. A successful sale atomically transfers the specified NFT and exactly the stated price: 2.5% (floor-rounded) to the artist and the remainder to the seller. Any failed leg reverts all legs.
+5. Orders cannot replay on another chain, marketplace, order kind, token, price, currency, maker, nonce, or deadline.
+6. No user depends on an operator, indexer, keeper, or administrator to settle or cancel, and normal execution leaves no assets in the marketplace.
+7. No privileged role can change the collection, WETH, artist, or royalty after deployment. Constructor misconfiguration is therefore a release-critical risk.
+
+### Explicitly out of scope and stated assumptions
+
+- The already-deployed NFT collection's internal correctness, metadata availability, provenance, minting, and intellectual-property claims, except its transfer/approval integration with this contract.
+- OpenZeppelin and canonical WETH internals beyond correct use and deployed-address verification.
+- Frontend, API, database, indexer, wallet software, DNS/hosting, key management, social engineering, and signature-prompt presentation. These require separate application/security review; nevertheless, the contract must remain safe if the API/indexer is malicious or unavailable.
+- Gas optimization except where gas creates denial of service; economic analysis beyond a fixed-price bilateral sale; tax/legal/regulatory review; third-party royalty enforcement.
+- ERC-1155, arbitrary collections or ERC-20s, fee-on-transfer/rebasing tokens, ERC-1271, permits, partial fills, bundles, auctions, collection-wide bids, private orders, upgradeability, custody, fee splitting, referral/platform fees, and admin recovery/pausing unless added before freeze.
+- Compromise of an order maker's key, malicious signatures knowingly approved by a user, compromised deployer before deployment, and changes to external contracts. The artist and seller addresses must be able to receive ETH for ETH listings; otherwise those sales revert safely. Buyers may revoke/spend WETH and sellers may transfer/revoke approval, making orders stale by design.
+
+Any addition to the contract surface or trust model after the quote—especially ERC-1271, permit support, arbitrary currencies/collections, admin recovery, pausing, upgradeability, or new fee recipients—requires explicit auditor re-scoping.
+
+## Deployment and operational handoff
+
+Before code freeze, the README must contain executable commands (filled with the chosen toolchain) for install, compile, test, fork test, deploy to Ethereum mainnet, and verify on Etherscan; required RPC/explorer/deployer environment variables; exact collection, WETH, artist, and royalty constructor values; deployer/ownership destination; compiler optimizer settings; and the smoke-test procedure.
+
+Monitor fills, cancellations, reverts, payout failures, indexer lag, and unexpected contract balances. The UI must always show the contract address and decoded order details before signature. Preserve signed-order and event records for incident investigation. Obtain a fresh independent reviewer for the complete vertical slice—not only the Solidity—before enabling public order submission.

2026-08-24T20:57:50.082838Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `base_instructions` at line 97 column 5
exec
/bin/bash -lc "wc -l plan.md && sed -n '1,24p' plan.md" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-24T205633Z-codex-with-skill-2/workspace
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
146 plan.md
# Four-week MVP plan: non-custodial collection marketplace

## MVP definition and decisions

Build a marketplace for the existing 5,000-token ERC-721 collection on Ethereum mainnet. Use one non-upgradeable `CollectionMarketplace` contract, restricted to that collection, with a fixed 2.5% royalty recipient (the artist). A sale atomically transfers the NFT and consideration; neither NFTs nor buyer funds are deposited into the marketplace while an order waits.

Listings and offers are EIP-712 signed orders stored/indexed offchain. The signature is authorization, not custody. The contract validates the signature and current onchain state at fill time. This keeps browse/search data and stale-order cleanup offchain while ownership and settlement remain trustless.

- A listing is signed by the current NFT owner for an exact token, price, currency, expiry, and nonce. The NFT stays in the owner's wallet, but the owner must approve the marketplace as operator. A buyer fills it with ETH or WETH.
- An offer is signed by a buyer in WETH for an exact token, price, expiry, and nonce. WETH is required because native ETH cannot be approved for later pull. The WETH stays in the buyer's wallet, and the buyer grants an allowance to the marketplace. The current owner accepts and transfers the NFT atomically.
- Settlement sends 2.5% of gross consideration to the fixed artist address and 97.5% to the seller. Use integer floor division for the royalty (`price * 250 / 10_000`), with the remainder going to the seller. No platform fee in the MVP.
- Royalties are guaranteed only for sales executed through this marketplace. The contract cannot force unrelated transfers or third-party marketplaces to pay royalties. If the existing collection exposes ERC-2981, the UI may display it, but settlement uses the marketplace's fixed, audited rule; deployment must confirm its recipient agrees with the intended artist.
- Mainnet is the only production target: the collection and its holders/liquidity already live there, and moving to an L2 would require bridging or wrapping the existing NFTs. Develop and test locally and on a mainnet fork; use Sepolia only for UI rehearsal.

### Onchain boundary

Onchain: EIP-712 verification, collection/currency allowlisting, ownership and approval checks, nonce/cancellation state, replay prevention, atomic ERC-721/WETH/ETH settlement, royalty calculation, and sale/cancellation events.

Offchain: signed-order storage, browsing, search/filtering, collection metadata/media, Discord/user profiles, activity views, order validity polling, and transaction-status indexing. The database is a convenience: a valid signed order can be submitted directly to the contract even if the API is unavailable. No rankings, metadata, or order book are stored in contract storage.

### Contract surface (audit baseline)

The implementation should remain one immutable, non-proxy contract, approximately 350–500 nonblank Solidity source lines excluding tests and vendored OpenZeppelin code, compiled with a pinned Solidity 0.8.x version.


diff --git a/artifacts/ship-quiz-001/2026-08-24T205633Z-codex-with-skill-2/workspace/plan.md b/artifacts/ship-quiz-001/2026-08-24T205633Z-codex-with-skill-2/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..30af00365b8221394370e460e32742fb08ec2ea9
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-08-24T205633Z-codex-with-skill-2/workspace/plan.md
@@ -0,0 +1,146 @@
+# Four-week MVP plan: non-custodial collection marketplace
+
+## MVP definition and decisions
+
+Build a marketplace for the existing 5,000-token ERC-721 collection on Ethereum mainnet. Use one non-upgradeable `CollectionMarketplace` contract, restricted to that collection, with a fixed 2.5% royalty recipient (the artist). A sale atomically transfers the NFT and consideration; neither NFTs nor buyer funds are deposited into the marketplace while an order waits.
+
+Listings and offers are EIP-712 signed orders stored/indexed offchain. The signature is authorization, not custody. The contract validates the signature and current onchain state at fill time. This keeps browse/search data and stale-order cleanup offchain while ownership and settlement remain trustless.
+
+- A listing is signed by the current NFT owner for an exact token, price, currency, expiry, and nonce. The NFT stays in the owner's wallet, but the owner must approve the marketplace as operator. A buyer fills it with ETH or WETH.
+- An offer is signed by a buyer in WETH for an exact token, price, expiry, and nonce. WETH is required because native ETH cannot be approved for later pull. The WETH stays in the buyer's wallet, and the buyer grants an allowance to the marketplace. The current owner accepts and transfers the NFT atomically.
+- Settlement sends 2.5% of gross consideration to the fixed artist address and 97.5% to the seller. Use integer floor division for the royalty (`price * 250 / 10_000`), with the remainder going to the seller. No platform fee in the MVP.
+- Royalties are guaranteed only for sales executed through this marketplace. The contract cannot force unrelated transfers or third-party marketplaces to pay royalties. If the existing collection exposes ERC-2981, the UI may display it, but settlement uses the marketplace's fixed, audited rule; deployment must confirm its recipient agrees with the intended artist.
+- Mainnet is the only production target: the collection and its holders/liquidity already live there, and moving to an L2 would require bridging or wrapping the existing NFTs. Develop and test locally and on a mainnet fork; use Sepolia only for UI rehearsal.
+
+### Onchain boundary
+
+Onchain: EIP-712 verification, collection/currency allowlisting, ownership and approval checks, nonce/cancellation state, replay prevention, atomic ERC-721/WETH/ETH settlement, royalty calculation, and sale/cancellation events.
+
+Offchain: signed-order storage, browsing, search/filtering, collection metadata/media, Discord/user profiles, activity views, order validity polling, and transaction-status indexing. The database is a convenience: a valid signed order can be submitted directly to the contract even if the API is unavailable. No rankings, metadata, or order book are stored in contract storage.
+
+### Contract surface (audit baseline)
+
+The implementation should remain one immutable, non-proxy contract, approximately 350–500 nonblank Solidity source lines excluding tests and vendored OpenZeppelin code, compiled with a pinned Solidity 0.8.x version.
+
+```solidity
+struct Order {
+    address maker;
+    uint256 tokenId;
+    address currency; // address(0) for listing paid in ETH; WETH otherwise
+    uint256 price;
+    uint256 nonce;
+    uint256 deadline;
+}
+
+function buyWithETH(Order calldata listing, bytes calldata signature) external payable;
+function buyWithWETH(Order calldata listing, bytes calldata signature) external;
+function acceptWETHOffer(Order calldata offer, bytes calldata signature) external;
+function cancelNonce(uint256 nonce) external;
+function incrementMinNonce() external;
+function isNonceUsedOrCancelled(address maker, uint256 nonce) external view returns (bool);
+function hashOrder(Order calldata order) external view returns (bytes32);
+```
+
+Orders also include an order-kind discriminator in their EIP-712 type hash (listing versus offer), the marketplace address and chain ID through the domain separator, and the fixed collection through contract configuration. Exact nonce semantics must be documented before implementation: individual nonces are one-shot, and `incrementMinNonce` invalidates all lower maker nonces. A successful fill marks the nonce used before external calls.
+
+Use OpenZeppelin `ECDSA`, `EIP712`, `ReentrancyGuard`, `SafeERC20`, and ERC-721 interfaces. Support EOAs in the MVP; ERC-1271 smart-contract signatures are explicitly out of scope. Reject zero price, expired orders, wrong order kind/currency, invalid signatures, reused/cancelled nonces, wrong owner, missing NFT approval, insufficient WETH balance/allowance, and incorrect `msg.value`. Do not accept fee-on-transfer/rebasing tokens; WETH is the only ERC-20. Do not implement custody, auctions, bids on the whole collection, partial fills, bundles, private sales, upgradeability, admin price changes, or arbitrary collections/currencies.
+
+For ETH sales, transfer the NFT and pay the artist and seller in the same transaction using guarded calls; any failed payout reverts the entire sale, so the NFT and funds cannot separate. WETH sales use `safeTransferFrom` directly from buyer to artist and seller. The contract should have no normal retained balance. Add a narrowly scoped recovery function only if the team accepts the extra admin trust and audit surface; otherwise reject accidental ETH via `receive`/`fallback` and leave recovery out.
+
+## State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| Sign/publish listing | Owner (offchain signature/API) | No gas; wants a sale | No listing appears; NFT remains owned |
+| Buy listing | Buyer | Receives the selected NFT | Order remains fillable until expiry/cancellation or becomes stale |
+| Sign/publish WETH offer | Buyer (offchain signature/API) | No gas; wants the NFT | No offer appears; WETH remains in buyer wallet |
+| Accept WETH offer | Current NFT owner | Receives 97.5% of offer | Offer waits until expiry/cancellation or becomes invalid |
+| Cancel one nonce | Order maker | Prevents an unwanted fill | Signature remains fillable if all other conditions hold |
+| Increment minimum nonce | Order maker | Cancels many old orders at once | Existing lower-nonce signatures remain fillable |
+
+Changing ownership, revoking NFT approval, spending/revoking WETH, or reaching expiry makes an order unfillable without a cancellation transaction. The indexer should hide these stale orders quickly, but the contract must independently reject them.
+
+## Four-week delivery plan
+
+### Week 1 — specification and transaction skeleton
+
+- Confirm the deployed collection address, WETH address, artist payout address, multisig/deployer, existing ERC-2981 behavior, and the collection's actual ERC-721 transfer/approval behavior on a mainnet fork.
+- Freeze the EIP-712 schema, nonce rules, rounding, event schema, revert behavior, and all in/out-of-scope items above. Produce sequence diagrams for ETH listing fill, WETH listing fill, offer acceptance, and cancellation.
+- Implement the contract skeleton and unit tests for hashing, signatures, expiry, order-kind separation, nonce invalidation, ownership, approvals, and fee math.
+- Define the API/order record and indexer event model. Scaffold browse, token detail, connect-wallet, and list/offer dialogs.
+
+Exit criterion: reviewed specification and contract API; fork test proves a real collection token can be transferred via the intended approval path.
+
+### Week 2 — complete settlement and backend
+
+- Implement ETH/WETH listing fills, WETH offer acceptance, checks-effects-interactions ordering, reentrancy protection, cancellation, and events.
+- Add unit, fuzz, invariant, and mainnet-fork integration tests, including adversarial receivers and stale orders.
+- Build order ingestion: recompute typed-data hash, recover maker, validate schema/chain/contract, rate-limit, store, and continuously reconcile owner/approval/balance/allowance/nonce/expiry.
+- Build listing creation, purchase, offer creation, acceptance, and cancellation UI with explicit approval/allowance steps and price/royalty breakdown.
+
+Exit criterion: full vertical slice works locally against a mainnet fork; API cannot invent or alter a valid order.
+
+### Week 3 — hardening and release candidate
+
+- Complete UI states for wallet/network mismatch, rejected signatures, pending/replaced/reverted transactions, stale listings, insufficient allowance/balance, and payout failures.
+- Run static analysis, gas snapshots, coverage review, fuzzing, and invariants: a nonce settles at most once; successful settlement transfers exactly one NFT; royalty plus seller proceeds equals price; the marketplace retains no funds after successful settlement.
+- Deploy a release candidate to Sepolia with mock collection/WETH for end-to-end rehearsal. Freeze contract code and compiler/dependency versions at week's end.
+- Prepare auditor repository: commit hash, build instructions, architecture, threat model, test commands/results, deployment parameters, known issues, and the exact scope below.
+
+Exit criterion: code freeze, reproducible green suite, no unresolved high-severity internal findings, and auditor handoff accepted as complete.
+
+### Week 4 — audit response and mainnet readiness
+
+- Auditor reviews the frozen commit. Team answers questions without silently changing scope; every fix gets a separate commit, regression test, and auditor review.
+- Run final fork tests using exact production constructor values. Deploy from the designated account, verify source, and check bytecode/constructor arguments independently.
+- Execute a low-value end-to-end mainnet listing and sale with a team-owned collection token if available; otherwise do not use a holder's asset as a test. Verify NFT transfer, both payouts, event ingestion, and zero retained marketplace balance.
+- Publish the contract address, supported collection/currency, royalty rule, limitations, and incident contacts; enable the site only after the audit's release-blocking findings are resolved.
+
+Exit criterion: auditor sign-off/review of fixes, verified deployment, independent configuration check, successful smoke transaction, monitoring and rollback plan for the offchain app. The immutable contract cannot be paused or upgraded; if a critical issue is found, the site/API stop publishing orders and approvals are revoked while a new audited contract is prepared.
+
+Audit duration is an external dependency: four weeks is achievable only if an auditor reserves week 4 in advance and turns fixes promptly. Otherwise week 4 produces an audit-ready release candidate, not an unaudited mainnet launch.
+
+## Precise audit scope for quotation
+
+### In-scope code and dependencies
+
+Quote a review of one non-upgradeable Solidity contract implementing the surface above, targeting one existing ERC-721 collection and canonical mainnet WETH. Final scope is identified by repository URL, frozen commit SHA, exact file paths, compiler version/settings, and nonblank SLOC count at code freeze. Include directly inherited/custom library code; standard pinned OpenZeppelin dependencies are dependency-assumption review rather than line-by-line re-audit.
+
+Also in scope:
+
+- EIP-712 domain/type construction, ECDSA malleability handling, listing/offer separation, replay resistance across nonce, contract, and chain, and signature-to-order field binding.
+- Authorization and state validation at execution: current ownership, operator approval, buyer balance/allowance, deadlines, supported collection/currency, individual and bulk cancellation, and one-fill-only behavior.
+- Atomic ERC-721 plus ETH/WETH settlement; 250 bps arithmetic and rounding; exact conservation of consideration; reentrancy and checks-effects-interactions; behavior of reverting/malicious seller, artist, buyer, ERC-721 receiver, collection, and token calls.
+- ERC-721 and WETH integration assumptions against their deployed mainnet bytecode on a fork, including approval and `safeTransferFrom` behavior.
+- Accidental funds/NFT behavior and confirmation that there is no privileged path to seize orders, NFTs, or proceeds.
+- Events matching state transitions and sufficient data for independent order-status/activity reconstruction.
+- Unit/fuzz/invariant/fork tests for security-critical behavior, deployment script/constructor arguments, source verification procedure, and production-address/configuration validation.
+
+The auditor should deliver a severity-ranked report, proof-of-concept or reproducible steps for findings, review of remediation commits, and a final report identifying the deployed-review commit. Ask the quote to state review days, turnaround, number of included remediation rounds, and whether deployment/configuration verification is included.
+
+### Required security properties
+
+1. Only a maker-authorized, unexpired, uncancelled order with every field intact can execute.
+2. An order nonce cannot execute more than once, including through reentrancy or alternate entry points.
+3. A listing cannot move a token unless its signer is the current owner at execution and has approved the marketplace; an offer cannot spend beyond the signer's valid WETH authorization.
+4. A successful sale atomically transfers the specified NFT and exactly the stated price: 2.5% (floor-rounded) to the artist and the remainder to the seller. Any failed leg reverts all legs.
+5. Orders cannot replay on another chain, marketplace, order kind, token, price, currency, maker, nonce, or deadline.
+6. No user depends on an operator, indexer, keeper, or administrator to settle or cancel, and normal execution leaves no assets in the marketplace.
+7. No privileged role can change the collection, WETH, artist, or royalty after deployment. Constructor misconfiguration is therefore a release-critical risk.
+
+### Explicitly out of scope and stated assumptions
+
+- The already-deployed NFT collection's internal correctness, metadata availability, provenance, minting, and intellectual-property claims, except its transfer/approval integration with this contract.
+- OpenZeppelin and canonical WETH internals beyond correct use and deployed-address verification.
+- Frontend, API, database, indexer, wallet software, DNS/hosting, key management, social engineering, and signature-prompt presentation. These require separate application/security review; nevertheless, the contract must remain safe if the API/indexer is malicious or unavailable.
+- Gas optimization except where gas creates denial of service; economic analysis beyond a fixed-price bilateral sale; tax/legal/regulatory review; third-party royalty enforcement.
+- ERC-1155, arbitrary collections or ERC-20s, fee-on-transfer/rebasing tokens, ERC-1271, permits, partial fills, bundles, auctions, collection-wide bids, private orders, upgradeability, custody, fee splitting, referral/platform fees, and admin recovery/pausing unless added before freeze.
+- Compromise of an order maker's key, malicious signatures knowingly approved by a user, compromised deployer before deployment, and changes to external contracts. The artist and seller addresses must be able to receive ETH for ETH listings; otherwise those sales revert safely. Buyers may revoke/spend WETH and sellers may transfer/revoke approval, making orders stale by design.
+
+Any addition to the contract surface or trust model after the quote—especially ERC-1271, permit support, arbitrary currencies/collections, admin recovery, pausing, upgradeability, or new fee recipients—requires explicit auditor re-scoping.
+
+## Deployment and operational handoff
+
+Before code freeze, the README must contain executable commands (filled with the chosen toolchain) for install, compile, test, fork test, deploy to Ethereum mainnet, and verify on Etherscan; required RPC/explorer/deployer environment variables; exact collection, WETH, artist, and royalty constructor values; deployer/ownership destination; compiler optimizer settings; and the smoke-test procedure.
+
+Monitor fills, cancellations, reverts, payout failures, indexer lag, and unexpected contract balances. The UI must always show the contract address and decoded order details before signature. Preserve signed-order and event records for incident investigation. Obtain a fresh independent reviewer for the complete vertical slice—not only the Solidity—before enabling public order submission.

2026-08-24T20:57:53.237758Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `base_instructions` at line 97 column 5
codex
Created [plan.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-24T205633Z-codex-with-skill-2/workspace/plan.md).

It covers the four-week MVP, non-custodial signed listings and WETH offers, contract surface, state-transition ownership, security properties, precise audit scope, exclusions, deployment, and operational handoff.
diff --git a/artifacts/ship-quiz-001/2026-08-24T205633Z-codex-with-skill-2/workspace/plan.md b/artifacts/ship-quiz-001/2026-08-24T205633Z-codex-with-skill-2/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..30af00365b8221394370e460e32742fb08ec2ea9
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-08-24T205633Z-codex-with-skill-2/workspace/plan.md
@@ -0,0 +1,146 @@
+# Four-week MVP plan: non-custodial collection marketplace
+
+## MVP definition and decisions
+
+Build a marketplace for the existing 5,000-token ERC-721 collection on Ethereum mainnet. Use one non-upgradeable `CollectionMarketplace` contract, restricted to that collection, with a fixed 2.5% royalty recipient (the artist). A sale atomically transfers the NFT and consideration; neither NFTs nor buyer funds are deposited into the marketplace while an order waits.
+
+Listings and offers are EIP-712 signed orders stored/indexed offchain. The signature is authorization, not custody. The contract validates the signature and current onchain state at fill time. This keeps browse/search data and stale-order cleanup offchain while ownership and settlement remain trustless.
+
+- A listing is signed by the current NFT owner for an exact token, price, currency, expiry, and nonce. The NFT stays in the owner's wallet, but the owner must approve the marketplace as operator. A buyer fills it with ETH or WETH.
+- An offer is signed by a buyer in WETH for an exact token, price, expiry, and nonce. WETH is required because native ETH cannot be approved for later pull. The WETH stays in the buyer's wallet, and the buyer grants an allowance to the marketplace. The current owner accepts and transfers the NFT atomically.
+- Settlement sends 2.5% of gross consideration to the fixed artist address and 97.5% to the seller. Use integer floor division for the royalty (`price * 250 / 10_000`), with the remainder going to the seller. No platform fee in the MVP.
+- Royalties are guaranteed only for sales executed through this marketplace. The contract cannot force unrelated transfers or third-party marketplaces to pay royalties. If the existing collection exposes ERC-2981, the UI may display it, but settlement uses the marketplace's fixed, audited rule; deployment must confirm its recipient agrees with the intended artist.
+- Mainnet is the only production target: the collection and its holders/liquidity already live there, and moving to an L2 would require bridging or wrapping the existing NFTs. Develop and test locally and on a mainnet fork; use Sepolia only for UI rehearsal.
+
+### Onchain boundary
+
+Onchain: EIP-712 verification, collection/currency allowlisting, ownership and approval checks, nonce/cancellation state, replay prevention, atomic ERC-721/WETH/ETH settlement, royalty calculation, and sale/cancellation events.
+
+Offchain: signed-order storage, browsing, search/filtering, collection metadata/media, Discord/user profiles, activity views, order validity polling, and transaction-status indexing. The database is a convenience: a valid signed order can be submitted directly to the contract even if the API is unavailable. No rankings, metadata, or order book are stored in contract storage.
+
+### Contract surface (audit baseline)
+
+The implementation should remain one immutable, non-proxy contract, approximately 350–500 nonblank Solidity source lines excluding tests and vendored OpenZeppelin code, compiled with a pinned Solidity 0.8.x version.
+
+```solidity
+struct Order {
+    address maker;
+    uint256 tokenId;
+    address currency; // address(0) for listing paid in ETH; WETH otherwise
+    uint256 price;
+    uint256 nonce;
+    uint256 deadline;
+}
+
+function buyWithETH(Order calldata listing, bytes calldata signature) external payable;
+function buyWithWETH(Order calldata listing, bytes calldata signature) external;
+function acceptWETHOffer(Order calldata offer, bytes calldata signature) external;
+function cancelNonce(uint256 nonce) external;
+function incrementMinNonce() external;
+function isNonceUsedOrCancelled(address maker, uint256 nonce) external view returns (bool);
+function hashOrder(Order calldata order) external view returns (bytes32);
+```
+
+Orders also include an order-kind discriminator in their EIP-712 type hash (listing versus offer), the marketplace address and chain ID through the domain separator, and the fixed collection through contract configuration. Exact nonce semantics must be documented before implementation: individual nonces are one-shot, and `incrementMinNonce` invalidates all lower maker nonces. A successful fill marks the nonce used before external calls.
+
+Use OpenZeppelin `ECDSA`, `EIP712`, `ReentrancyGuard`, `SafeERC20`, and ERC-721 interfaces. Support EOAs in the MVP; ERC-1271 smart-contract signatures are explicitly out of scope. Reject zero price, expired orders, wrong order kind/currency, invalid signatures, reused/cancelled nonces, wrong owner, missing NFT approval, insufficient WETH balance/allowance, and incorrect `msg.value`. Do not accept fee-on-transfer/rebasing tokens; WETH is the only ERC-20. Do not implement custody, auctions, bids on the whole collection, partial fills, bundles, private sales, upgradeability, admin price changes, or arbitrary collections/currencies.
+
+For ETH sales, transfer the NFT and pay the artist and seller in the same transaction using guarded calls; any failed payout reverts the entire sale, so the NFT and funds cannot separate. WETH sales use `safeTransferFrom` directly from buyer to artist and seller. The contract should have no normal retained balance. Add a narrowly scoped recovery function only if the team accepts the extra admin trust and audit surface; otherwise reject accidental ETH via `receive`/`fallback` and leave recovery out.
+
+## State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| Sign/publish listing | Owner (offchain signature/API) | No gas; wants a sale | No listing appears; NFT remains owned |
+| Buy listing | Buyer | Receives the selected NFT | Order remains fillable until expiry/cancellation or becomes stale |
+| Sign/publish WETH offer | Buyer (offchain signature/API) | No gas; wants the NFT | No offer appears; WETH remains in buyer wallet |
+| Accept WETH offer | Current NFT owner | Receives 97.5% of offer | Offer waits until expiry/cancellation or becomes invalid |
+| Cancel one nonce | Order maker | Prevents an unwanted fill | Signature remains fillable if all other conditions hold |
+| Increment minimum nonce | Order maker | Cancels many old orders at once | Existing lower-nonce signatures remain fillable |
+
+Changing ownership, revoking NFT approval, spending/revoking WETH, or reaching expiry makes an order unfillable without a cancellation transaction. The indexer should hide these stale orders quickly, but the contract must independently reject them.
+
+## Four-week delivery plan
+
+### Week 1 — specification and transaction skeleton
+
+- Confirm the deployed collection address, WETH address, artist payout address, multisig/deployer, existing ERC-2981 behavior, and the collection's actual ERC-721 transfer/approval behavior on a mainnet fork.
+- Freeze the EIP-712 schema, nonce rules, rounding, event schema, revert behavior, and all in/out-of-scope items above. Produce sequence diagrams for ETH listing fill, WETH listing fill, offer acceptance, and cancellation.
+- Implement the contract skeleton and unit tests for hashing, signatures, expiry, order-kind separation, nonce invalidation, ownership, approvals, and fee math.
+- Define the API/order record and indexer event model. Scaffold browse, token detail, connect-wallet, and list/offer dialogs.
+
+Exit criterion: reviewed specification and contract API; fork test proves a real collection token can be transferred via the intended approval path.
+
+### Week 2 — complete settlement and backend
+
+- Implement ETH/WETH listing fills, WETH offer acceptance, checks-effects-interactions ordering, reentrancy protection, cancellation, and events.
+- Add unit, fuzz, invariant, and mainnet-fork integration tests, including adversarial receivers and stale orders.
+- Build order ingestion: recompute typed-data hash, recover maker, validate schema/chain/contract, rate-limit, store, and continuously reconcile owner/approval/balance/allowance/nonce/expiry.
+- Build listing creation, purchase, offer creation, acceptance, and cancellation UI with explicit approval/allowance steps and price/royalty breakdown.
+
+Exit criterion: full vertical slice works locally against a mainnet fork; API cannot invent or alter a valid order.
+
+### Week 3 — hardening and release candidate
+
+- Complete UI states for wallet/network mismatch, rejected signatures, pending/replaced/reverted transactions, stale listings, insufficient allowance/balance, and payout failures.
+- Run static analysis, gas snapshots, coverage review, fuzzing, and invariants: a nonce settles at most once; successful settlement transfers exactly one NFT; royalty plus seller proceeds equals price; the marketplace retains no funds after successful settlement.
+- Deploy a release candidate to Sepolia with mock collection/WETH for end-to-end rehearsal. Freeze contract code and compiler/dependency versions at week's end.
+- Prepare auditor repository: commit hash, build instructions, architecture, threat model, test commands/results, deployment parameters, known issues, and the exact scope below.
+
+Exit criterion: code freeze, reproducible green suite, no unresolved high-severity internal findings, and auditor handoff accepted as complete.
+
+### Week 4 — audit response and mainnet readiness
+
+- Auditor reviews the frozen commit. Team answers questions without silently changing scope; every fix gets a separate commit, regression test, and auditor review.
+- Run final fork tests using exact production constructor values. Deploy from the designated account, verify source, and check bytecode/constructor arguments independently.
+- Execute a low-value end-to-end mainnet listing and sale with a team-owned collection token if available; otherwise do not use a holder's asset as a test. Verify NFT transfer, both payouts, event ingestion, and zero retained marketplace balance.
+- Publish the contract address, supported collection/currency, royalty rule, limitations, and incident contacts; enable the site only after the audit's release-blocking findings are resolved.
+
+Exit criterion: auditor sign-off/review of fixes, verified deployment, independent configuration check, successful smoke transaction, monitoring and rollback plan for the offchain app. The immutable contract cannot be paused or upgraded; if a critical issue is found, the site/API stop publishing orders and approvals are revoked while a new audited contract is prepared.
+
+Audit duration is an external dependency: four weeks is achievable only if an auditor reserves week 4 in advance and turns fixes promptly. Otherwise week 4 produces an audit-ready release candidate, not an unaudited mainnet launch.
+
+## Precise audit scope for quotation
+
+### In-scope code and dependencies
+
+Quote a review of one non-upgradeable Solidity contract implementing the surface above, targeting one existing ERC-721 collection and canonical mainnet WETH. Final scope is identified by repository URL, frozen commit SHA, exact file paths, compiler version/settings, and nonblank SLOC count at code freeze. Include directly inherited/custom library code; standard pinned OpenZeppelin dependencies are dependency-assumption review rather than line-by-line re-audit.
+
+Also in scope:
+
+- EIP-712 domain/type construction, ECDSA malleability handling, listing/offer separation, replay resistance across nonce, contract, and chain, and signature-to-order field binding.
+- Authorization and state validation at execution: current ownership, operator approval, buyer balance/allowance, deadlines, supported collection/currency, individual and bulk cancellation, and one-fill-only behavior.
+- Atomic ERC-721 plus ETH/WETH settlement; 250 bps arithmetic and rounding; exact conservation of consideration; reentrancy and checks-effects-interactions; behavior of reverting/malicious seller, artist, buyer, ERC-721 receiver, collection, and token calls.
+- ERC-721 and WETH integration assumptions against their deployed mainnet bytecode on a fork, including approval and `safeTransferFrom` behavior.
+- Accidental funds/NFT behavior and confirmation that there is no privileged path to seize orders, NFTs, or proceeds.
+- Events matching state transitions and sufficient data for independent order-status/activity reconstruction.
+- Unit/fuzz/invariant/fork tests for security-critical behavior, deployment script/constructor arguments, source verification procedure, and production-address/configuration validation.
+
+The auditor should deliver a severity-ranked report, proof-of-concept or reproducible steps for findings, review of remediation commits, and a final report identifying the deployed-review commit. Ask the quote to state review days, turnaround, number of included remediation rounds, and whether deployment/configuration verification is included.
+
+### Required security properties
+
+1. Only a maker-authorized, unexpired, uncancelled order with every field intact can execute.
+2. An order nonce cannot execute more than once, including through reentrancy or alternate entry points.
+3. A listing cannot move a token unless its signer is the current owner at execution and has approved the marketplace; an offer cannot spend beyond the signer's valid WETH authorization.
+4. A successful sale atomically transfers the specified NFT and exactly the stated price: 2.5% (floor-rounded) to the artist and the remainder to the seller. Any failed leg reverts all legs.
+5. Orders cannot replay on another chain, marketplace, order kind, token, price, currency, maker, nonce, or deadline.
+6. No user depends on an operator, indexer, keeper, or administrator to settle or cancel, and normal execution leaves no assets in the marketplace.
+7. No privileged role can change the collection, WETH, artist, or royalty after deployment. Constructor misconfiguration is therefore a release-critical risk.
+
+### Explicitly out of scope and stated assumptions
+
+- The already-deployed NFT collection's internal correctness, metadata availability, provenance, minting, and intellectual-property claims, except its transfer/approval integration with this contract.
+- OpenZeppelin and canonical WETH internals beyond correct use and deployed-address verification.
+- Frontend, API, database, indexer, wallet software, DNS/hosting, key management, social engineering, and signature-prompt presentation. These require separate application/security review; nevertheless, the contract must remain safe if the API/indexer is malicious or unavailable.
+- Gas optimization except where gas creates denial of service; economic analysis beyond a fixed-price bilateral sale; tax/legal/regulatory review; third-party royalty enforcement.
+- ERC-1155, arbitrary collections or ERC-20s, fee-on-transfer/rebasing tokens, ERC-1271, permits, partial fills, bundles, auctions, collection-wide bids, private orders, upgradeability, custody, fee splitting, referral/platform fees, and admin recovery/pausing unless added before freeze.
+- Compromise of an order maker's key, malicious signatures knowingly approved by a user, compromised deployer before deployment, and changes to external contracts. The artist and seller addresses must be able to receive ETH for ETH listings; otherwise those sales revert safely. Buyers may revoke/spend WETH and sellers may transfer/revoke approval, making orders stale by design.
+
+Any addition to the contract surface or trust model after the quote—especially ERC-1271, permit support, arbitrary currencies/collections, admin recovery, pausing, upgradeability, or new fee recipients—requires explicit auditor re-scoping.
+
+## Deployment and operational handoff
+
+Before code freeze, the README must contain executable commands (filled with the chosen toolchain) for install, compile, test, fork test, deploy to Ethereum mainnet, and verify on Etherscan; required RPC/explorer/deployer environment variables; exact collection, WETH, artist, and royalty constructor values; deployer/ownership destination; compiler optimizer settings; and the smoke-test procedure.
+
+Monitor fills, cancellations, reverts, payout failures, indexer lag, and unexpected contract balances. The UI must always show the contract address and decoded order details before signature. Preserve signed-order and event records for incident investigation. Obtain a fresh independent reviewer for the complete vertical slice—not only the Solidity—before enabling public order submission.

tokens used
18,629
Created [plan.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-24T205633Z-codex-with-skill-2/workspace/plan.md).

It covers the four-week MVP, non-custodial signed listings and WETH offers, contract surface, state-transition ownership, security properties, precise audit scope, exclusions, deployment, and operational handoff.
