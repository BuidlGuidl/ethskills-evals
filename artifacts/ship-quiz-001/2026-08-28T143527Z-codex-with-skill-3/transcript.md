OpenAI Codex v0.150.1
--------
workdir: /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-28T143527Z-codex-with-skill-3/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a048cc-10cb-7722-805c-c1be0815c77d
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

2026-08-28T14:35:28.559162Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a048cc-10cb-7722-805c-c1be0815c77d.tmp-1787927728334626216: line 2547: syntax error near unexpected token `('

codex
I’m using the `ship` skill because this request needs the marketplace’s onchain boundary, caller/incentive model, launch chain, and release runbook settled before implementation. I’ll inspect its instructions, then write the build and audit plan to `plan.md`.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/ship/SKILL.md" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-28T143527Z-codex-with-skill-3/workspace
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
The MVP can stay deliberately small: one non-custodial settlement contract on Ethereum mainnet, with listings represented by signed seller orders and offers by signed buyer orders plus ERC-20 funding/approval. I’m checking the workspace for any existing collection or deployment details so the plan can reference facts rather than placeholders where possible.
exec
/bin/bash -lc "rg --files -g '"'!node_modules'"' -g '"'!cache'"' -g '"'!artifacts'"' | sed -n '1,160p' && git status --short" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-28T143527Z-codex-with-skill-3/workspace
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
TASK.md

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-28T143527Z-codex-with-skill-3/workspace/plan.md
diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..95ee9817b9577f9219c9ac71bafa320bf1758d68
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,202 @@
+# Four-week MVP plan: non-custodial NFT marketplace
+
+## 1. Product decisions and MVP boundary
+
+### Goal and acceptance criteria
+
+Ship a marketplace for the existing 5,000-token ERC-721 collection where:
+
+- An owner can advertise a token for a fixed ETH price without transferring it or approving a marketplace-wide custodian.
+- A buyer can purchase a still-valid listing atomically; the NFT moves directly from seller to buyer, 97.5% of the price goes to the seller, and 2.5% goes to the artist.
+- A buyer can make a WETH-denominated offer without escrow. The current owner can accept it later, atomically transferring the NFT and pulling WETH from the buyer, with the same split.
+- A signer can cancel an individual order or invalidate all their older orders.
+- No administrator can seize NFTs, redirect an existing order, change its price, or settle it without the required signatures and approvals.
+
+The launch chain is **Ethereum mainnet**, because the collection and its ownership/liquidity already live there. Bridging or wrapping the collection would fragment the market and violate the direct-resale goal. Mainnet gas is an accepted product constraint for this MVP; all browsing, indexing, and order creation remain offchain.
+
+### One-contract architecture
+
+Deploy one immutable `CollectionMarketplace` contract configured at construction with:
+
+- the existing ERC-721 collection address;
+- canonical Ethereum-mainnet WETH address, obtained from and checked against official verified deployment documentation during implementation;
+- the artist payout address (production multisig, not an EOA); and
+- a fixed royalty of 250 basis points out of 10,000.
+
+Do not add a factory, NFT escrow, fee splitter, upgrade proxy, governance token, auction, bidding currency list, or arbitrary-collection support. ETH listing purchases and WETH offers are the only payment paths. The contract is non-upgradeable and has no owner-only operational functions. Changing the artist address or fee requires a new deployment and explicit migration, eliminating a privileged fee-redirection surface.
+
+Listings and offers are EIP-712 typed signed orders stored in the application database/IPFS-free order relay, not contract storage. A signed order contains at least: order kind, maker, collection, token ID, payment token (`address(0)` for an ETH listing; WETH for an offer), price, expiration, and maker nonce. The EIP-712 domain binds signatures to chain ID and marketplace contract. An order hash can be filled only once or explicitly cancelled. A per-maker minimum nonce supports “cancel all older orders.” Expired orders need no onchain cleanup.
+
+For a listing purchase, the seller signs and the buyer submits `buy(...)` with exact ETH. For an offer, the buyer signs after holding WETH and approving the marketplace; the token’s current owner submits `acceptOffer(...)`. Offers cannot use native ETH because a contract cannot pull ETH from an absent buyer later without escrow; WETH preserves the non-custodial requirement through balance and allowance.
+
+Use pull-payment credits for ETH proceeds rather than pushing ETH during settlement: settlement credits seller and artist balances, and each recipient withdraws independently. This prevents a reverting recipient from blocking the NFT sale. For WETH offers, use `safeTransferFrom` directly from buyer to seller and artist in the same transaction; the canonical WETH behavior is covered by mainnet-fork tests. Apply `nonReentrant`, checks-effects-interactions, and mark an order filled before external calls.
+
+The seller must grant the marketplace token approval (`approve(tokenId)` or `setApprovalForAll`) before settlement, but the NFT remains in the seller’s wallet. The UI should recommend per-token approval. At execution, verify current ownership, approval, signature, nonce, expiry, collection/payment constraints, unfilled/uncancelled status, nonzero price, exact payment, and that the taker is not zero. Transfer with `safeTransferFrom` and intentionally require the buyer to be able to receive an ERC-721.
+
+### Onchain/offchain boundary
+
+Onchain:
+
+- signature verification, replay protection, cancellation, ownership/approval checks;
+- atomic NFT/payment settlement and the immutable 2.5%/97.5% split;
+- ETH withdrawal accounting; and
+- events sufficient to reconstruct fills and cancellations.
+
+Offchain:
+
+- signed-order relay/database, listing and offer APIs;
+- collection metadata, images, search, filtering, activity feed, floor price, and rankings;
+- chain event indexing and removal/marking of stale orders; and
+- wallet UI, transaction preparation, confirmations, and error explanations.
+
+The index is a convenience, not an authority: every fill is validated onchain. If the API/indexer is unavailable, already obtained signed orders remain executable directly against the contract.
+
+## 2. Contract surface and state transitions
+
+Expected public/external surface (names may change before the audit commit, semantics may not):
+
+```solidity
+constructor(address collection, address weth, address artist)
+buy(Order listing, bytes sellerSignature) external payable nonReentrant
+acceptOffer(Order offer, bytes buyerSignature) external nonReentrant
+cancelOrder(Order order) external
+incrementMinNonce() external
+withdrawETH(address payable recipient) external nonReentrant
+hashOrder(Order order) external view returns (bytes32)
+isOrderValid(Order order, bytes signature) external view returns (bool)
+```
+
+State is limited to immutable configuration, `filledOrCancelled[orderHash]`, `minNonce[maker]`, and `ethCredits[recipient]`. Emit `OrderFilled`, `OrderCancelled`, `MinNonceIncremented`, and `ETHWithdrawn` with indexed maker/token/order identifiers and amounts. Support EOAs through ECDSA and smart-contract wallets through ERC-1271 signature validation.
+
+| Transition | Caller | Why they pay gas | Safe outcome if nobody calls |
+| --- | --- | --- | --- |
+| Sign/publish listing or offer | Maker (offchain) | No gas; advertises sale or desired purchase | No order exists and nothing moves |
+| Approve NFT | Seller/current owner | Enables their desired eventual settlement | Order stays visible but cannot fill |
+| Approve WETH | Offer maker | Enables acceptance of their desired offer | Offer cannot be accepted |
+| `buy` | Buyer | Receives the listed NFT | Listing remains unfilled until expiry/cancellation/ownership change |
+| `acceptOffer` | Current owner | Receives 97.5% of offered WETH | Offer remains unfilled until expiry/cancellation/balance or allowance change |
+| `cancelOrder` | Maker | Removes a live signed order | Order remains fillable while otherwise valid |
+| `incrementMinNonce` | Maker | Invalidates many stale orders cheaply | Older signed orders remain valid individually |
+| `withdrawETH` | Credited seller or artist | Receives accrued ETH; recipient may be another address | Credit remains safely claimable indefinitely |
+
+There is no keeper or admin-dependent transition and no scheduled work.
+
+## 3. Four-week build plan
+
+### Week 1 — specification, UX, and skeleton
+
+- Confirm and checksum the collection, WETH, and artist multisig addresses; inspect the deployed ERC-721 for standard compliance and any transfer restrictions.
+- Freeze the EIP-712 `Order` schema, exact rounding rule (`royalty = price * 250 / 10_000`, seller receives the remainder), nonce rules, event schema, and revert/error catalogue.
+- Write invariants and threat model: replay/cross-chain replay, stale ownership, revoked approvals, signature malleability/ERC-1271, reentrancy, malicious receivers, fee rounding, forced ETH, and WETH allowance/balance changes.
+- Scaffold the non-upgradeable contract and tests. Build wireframes for browse, list, buy, offer, accept, cancel, and withdraw flows.
+- Exit: reviewed specification; addresses recorded with sources; compiling skeleton; no unresolved economic or privilege decisions.
+
+### Week 2 — contract and service vertical slice
+
+- Implement typed-order hashing/signature validation, fills, cancellations, nonce invalidation, ETH credits/withdrawals, WETH settlement, events, custom errors, and immutable configuration.
+- Build the order relay API with schema validation, signature recovery/1271-aware status checks, expiration, deduplication, and rate limiting. Never accept custody or private keys.
+- Build the event indexer with confirmation depth and reorg rollback; derive order status from fills/cancellations/nonces plus current ownership and approvals.
+- Unit-test every branch and invariant; add fuzz/property tests for price splits, nonces, replay prevention, and arbitrary call ordering.
+- Exit: local end-to-end flow for listing purchase and offer acceptance; all contract tests green.
+
+### Week 3 — frontend, fork integration, and hardening
+
+- Implement collection browsing, ownership-aware actions, typed-signature prompts with human-readable terms, per-token approval, WETH balance/approval, cancellation, acceptance, ETH withdrawal, pending/confirmed states, and stale-order warnings.
+- Run Ethereum-mainnet-fork tests against the actual collection and canonical WETH: EOA and ERC-1271 makers, safe-transfer receivers, revoked approvals, changed owners, insufficient WETH, expired/cancelled/replayed orders, and reverting payout recipients.
+- Add static analysis, coverage gates, gas snapshots, API/indexer monitoring, structured logs, CSP and dependency scanning. Ensure frontend verifies chain ID and configured contract addresses.
+- Deploy to an Ethereum test environment or a mainnet fork for stakeholder acceptance; run the full vertical slice with production-shaped configuration.
+- Exit: release candidate and frozen feature set. Tag the exact audit commit; generate source/LOC report, dependency lockfile, test commands, deployment parameters, architecture diagram, invariants, and known-issues list for the auditor.
+
+### Week 4 — audit, fixes, and launch rehearsal
+
+- Auditor reviews the frozen commit described below. Engineering answers questions but makes no untracked changes to audit files.
+- Classify findings; fix critical/high/medium findings and agreed lows. Provide a fix commit/diff and tests for each finding; auditor performs a focused remediation review and issues a final report.
+- Re-run unit, fuzz, static, fork, frontend, and API tests. A reviewer independent of the implementer executes the launch checklist and adversarial end-to-end scenarios.
+- Rehearse deployment, verification, configuration, indexer start block, frontend release, and rollback/pause-of-frontend procedure. Contracts themselves have no pause/admin escape hatch.
+- Exit: final report has no unresolved critical/high findings, all accepted medium findings are fixed, deployment bytecode matches the audited build, and sign-off is recorded. If the audit cannot finish in the week, launch slips; audit scope is not compressed.
+
+## 4. Precise audit scope for quotation
+
+### In-scope artifacts
+
+The quote should assume **one non-upgradeable Solidity contract** (`CollectionMarketplace.sol`) plus only locally written helper/library code, targeting Solidity 0.8.x. Budget on approximately **350–500 non-comment Solidity source lines**; the final frozen-commit LOC report controls. Also in scope:
+
+- EIP-712 order encoding/domain separation and ECDSA/ERC-1271 validation;
+- fixed-price ETH listing settlement and WETH offer settlement;
+- ERC-721 approval/ownership and `safeTransferFrom` integration;
+- royalty calculation and rounding, ETH credit accounting/withdrawal, WETH transfers;
+- fill/cancel replay protection, individual cancellation, per-maker minimum nonce, expiry;
+- event correctness relative to state and transferred value;
+- constructor validation, immutables, access-control absence, and forced/unexpected ETH handling;
+- all custom Solidity libraries and modifications to vendored code;
+- deployment script and constructor arguments, including deterministic reproduction of deployed bytecode;
+- unit, fuzz/invariant, and mainnet-fork tests as evidence (tests are reviewed but test-only bugs are not protocol findings unless they hide a production defect); and
+- integration assumptions for the exact deployed collection, canonical mainnet WETH, and artist multisig.
+
+Provide the auditor: frozen Git commit and tag; compiler/settings and dependency lockfile; flattened sources only as a convenience; source LOC output; architecture/data-flow diagram; order schema and example signatures; invariants/threat model; roles/privileges statement; deployment script/config; test and coverage commands/results; fork block number/RPC requirements; known issues; and the verified collection/WETH ABI and addresses.
+
+### Required security properties
+
+The auditor should explicitly assess and report on these invariants:
+
+1. A successful fill transfers exactly the specified token once, and only with a valid unexpired maker signature bound to this chain, contract, collection, terms, and nonce.
+2. A listing can be filled only while its maker owns and has approved the token. An offer can be accepted only by the token’s current owner.
+3. For any successful sale of price `P`, artist entitlement is `floor(P * 250 / 10_000)` and seller entitlement is exactly `P - royalty`; no other party can capture value and accounting cannot create value.
+4. No order hash can fill twice; cancellation and minimum-nonce invalidation are irreversible for affected orders.
+5. Failed NFT/payment transfers revert the entire fill. Reentrancy cannot double-fill, alter credits, or withdraw twice.
+6. One reverting ETH recipient cannot block settlement or another recipient’s withdrawal; only the credited account can initiate spending its credit, though it may choose a recipient.
+7. The contract never takes custody of an NFT except transiently within no intended path, holds no escrowed WETH, and exposes no privileged seizure, fee-change, or upgrade route.
+8. Malformed signatures, ERC-1271 behavior, zero/extreme values, rounding dust, forced ETH, stale approvals/ownership, chain-ID changes, and malicious ERC-721 receivers fail safely.
+
+Review techniques expected in the quote: manual line-by-line review, threat-model/invariant review, automated static analysis, review of fuzz/invariant coverage, and reproduction of mainnet-fork integration tests. Quote one initial report plus one remediation review of a bounded fix diff delivered within an agreed window.
+
+### Out of scope and assumptions
+
+Out of scope unless separately quoted:
+
+- the already deployed ERC-721 collection bytecode, canonical WETH bytecode, and artist multisig internals (their interfaces and integration behavior remain in scope);
+- third-party libraries used unmodified (verify correct version/configuration/integration, but do not re-audit their internals);
+- frontend, API, database, indexer, hosting, wallet software, DNS, CI/CD, cloud accounts, key management, phishing/social engineering, and denial-of-service against the relay;
+- marketplace economics, tax/legal compliance, wash trading, sanctions, creator-royalty enforcement on other venues, and compromised user keys;
+- auctions, bundles, partial fills, collection bids, ERC-1155, arbitrary NFTs/tokens, permits, meta-transactions, delegated wallets, cross-chain behavior, upgradeability, and post-launch changes; and
+- formal verification and production penetration testing.
+
+Assumptions the auditor must validate at integration boundaries: the collection is the expected ERC-721 and permits ordinary approved transfers; canonical WETH returns/reverts as expected; artist and collection addresses are nonzero and correctly checksummed; price is denominated in wei; the frontend/relay do not change signed data; makers can revoke validity by ownership/balance/allowance changes even if the offchain UI is stale.
+
+Any semantic contract change after the frozen audit commit—order fields/hashing, external surface, payment flow, fee logic, dependencies, compiler settings, or deployment configuration—requires auditor review of the diff and may require a re-audit. A production launch is blocked by unresolved critical/high findings and by unremediated medium findings unless the auditor and project sign a written, narrowly reasoned exception.
+
+## 5. Deployment and release runbook
+
+Before launch, replace placeholders with the verified values and commit them in a network config file:
+
+```text
+ETH_RPC_URL          Ethereum mainnet RPC (secret)
+DEPLOYER_KEY         funded hardware-backed deployment signer (secret; temporary use)
+ETHERSCAN_API_KEY    verification credential (secret)
+COLLECTION_ADDRESS   existing collection
+WETH_ADDRESS         canonical mainnet WETH from official source
+ARTIST_ADDRESS       production artist multisig
+```
+
+The repository README must contain executable commands matching the chosen framework. Expected Foundry-shaped runbook (adjust only if the team selects another framework in Week 1):
+
+```bash
+forge test
+forge test --fork-url "$ETH_RPC_URL"
+forge script script/Deploy.s.sol:Deploy --rpc-url "$ETH_RPC_URL" --broadcast --verify
+cast call "$MARKETPLACE_ADDRESS" "collection()(address)" --rpc-url "$ETH_RPC_URL"
+cast call "$MARKETPLACE_ADDRESS" "weth()(address)" --rpc-url "$ETH_RPC_URL"
+cast call "$MARKETPLACE_ADDRESS" "artist()(address)" --rpc-url "$ETH_RPC_URL"
+```
+
+Deployment controls:
+
+1. Use a clean audited tag; reproduce compiler output and confirm creation/runtime bytecode against the auditor’s artifact.
+2. Two people independently verify chain ID 1, deployer, collection, WETH, artist multisig, fixed 250 bps constant, gas parameters, and source verification arguments.
+3. Deploy and verify source on Etherscan. Because configuration is immutable and there is no owner role, record explicitly that there is no ownership transfer step; the artist payout destination is already the intended multisig.
+4. Configure the indexer from the deployment block and frontend with the verified address. Do not enable public order submission yet.
+5. Execute a low-value end-to-end canary using team-owned collection tokens: sign/list/buy with ETH, verify NFT ownership and exact credits, withdraw both credits, make/approve/accept a WETH offer, cancel another order, and verify replay rejection. This requires identifying team-owned tokens before launch; do not use a holder’s token.
+6. Have the independent reviewer compare receipts, balances, events, and UI/indexer state to expected values, then enable public order submission.
+7. Publish contract address, verified source, audit report, immutable fee/artist configuration, WETH-offer requirement, and user warnings about approvals and signed-order validity.
+
+Rollback is operational only: if a defect appears, disable the site’s order relay and warn users to cancel individual orders or increment their minimum nonce. The immutable contract cannot be paused or upgraded; already signed valid orders may remain executable until cancelled, invalidated, expired, or made invalid by revoking approval/ownership/balance/allowance. A replacement requires a newly audited deployment and frontend migration.

diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..95ee9817b9577f9219c9ac71bafa320bf1758d68
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,202 @@
+# Four-week MVP plan: non-custodial NFT marketplace
+
+## 1. Product decisions and MVP boundary
+
+### Goal and acceptance criteria
+
+Ship a marketplace for the existing 5,000-token ERC-721 collection where:
+
+- An owner can advertise a token for a fixed ETH price without transferring it or approving a marketplace-wide custodian.
+- A buyer can purchase a still-valid listing atomically; the NFT moves directly from seller to buyer, 97.5% of the price goes to the seller, and 2.5% goes to the artist.
+- A buyer can make a WETH-denominated offer without escrow. The current owner can accept it later, atomically transferring the NFT and pulling WETH from the buyer, with the same split.
+- A signer can cancel an individual order or invalidate all their older orders.
+- No administrator can seize NFTs, redirect an existing order, change its price, or settle it without the required signatures and approvals.
+
+The launch chain is **Ethereum mainnet**, because the collection and its ownership/liquidity already live there. Bridging or wrapping the collection would fragment the market and violate the direct-resale goal. Mainnet gas is an accepted product constraint for this MVP; all browsing, indexing, and order creation remain offchain.
+
+### One-contract architecture
+
+Deploy one immutable `CollectionMarketplace` contract configured at construction with:
+
+- the existing ERC-721 collection address;
+- canonical Ethereum-mainnet WETH address, obtained from and checked against official verified deployment documentation during implementation;
+- the artist payout address (production multisig, not an EOA); and
+- a fixed royalty of 250 basis points out of 10,000.
+
+Do not add a factory, NFT escrow, fee splitter, upgrade proxy, governance token, auction, bidding currency list, or arbitrary-collection support. ETH listing purchases and WETH offers are the only payment paths. The contract is non-upgradeable and has no owner-only operational functions. Changing the artist address or fee requires a new deployment and explicit migration, eliminating a privileged fee-redirection surface.
+
+Listings and offers are EIP-712 typed signed orders stored in the application database/IPFS-free order relay, not contract storage. A signed order contains at least: order kind, maker, collection, token ID, payment token (`address(0)` for an ETH listing; WETH for an offer), price, expiration, and maker nonce. The EIP-712 domain binds signatures to chain ID and marketplace contract. An order hash can be filled only once or explicitly cancelled. A per-maker minimum nonce supports “cancel all older orders.” Expired orders need no onchain cleanup.
+
+For a listing purchase, the seller signs and the buyer submits `buy(...)` with exact ETH. For an offer, the buyer signs after holding WETH and approving the marketplace; the token’s current owner submits `acceptOffer(...)`. Offers cannot use native ETH because a contract cannot pull ETH from an absent buyer later without escrow; WETH preserves the non-custodial requirement through balance and allowance.
+
+Use pull-payment credits for ETH proceeds rather than pushing ETH during settlement: settlement credits seller and artist balances, and each recipient withdraws independently. This prevents a reverting recipient from blocking the NFT sale. For WETH offers, use `safeTransferFrom` directly from buyer to seller and artist in the same transaction; the canonical WETH behavior is covered by mainnet-fork tests. Apply `nonReentrant`, checks-effects-interactions, and mark an order filled before external calls.
+
+The seller must grant the marketplace token approval (`approve(tokenId)` or `setApprovalForAll`) before settlement, but the NFT remains in the seller’s wallet. The UI should recommend per-token approval. At execution, verify current ownership, approval, signature, nonce, expiry, collection/payment constraints, unfilled/uncancelled status, nonzero price, exact payment, and that the taker is not zero. Transfer with `safeTransferFrom` and intentionally require the buyer to be able to receive an ERC-721.
+
+### Onchain/offchain boundary
+
+Onchain:
+
+- signature verification, replay protection, cancellation, ownership/approval checks;
+- atomic NFT/payment settlement and the immutable 2.5%/97.5% split;
+- ETH withdrawal accounting; and
+- events sufficient to reconstruct fills and cancellations.
+
+Offchain:
+
+- signed-order relay/database, listing and offer APIs;
+- collection metadata, images, search, filtering, activity feed, floor price, and rankings;
+- chain event indexing and removal/marking of stale orders; and
+- wallet UI, transaction preparation, confirmations, and error explanations.
+
+The index is a convenience, not an authority: every fill is validated onchain. If the API/indexer is unavailable, already obtained signed orders remain executable directly against the contract.
+
+## 2. Contract surface and state transitions
+
+Expected public/external surface (names may change before the audit commit, semantics may not):
+
+```solidity
+constructor(address collection, address weth, address artist)
+buy(Order listing, bytes sellerSignature) external payable nonReentrant
+acceptOffer(Order offer, bytes buyerSignature) external nonReentrant
+cancelOrder(Order order) external
+incrementMinNonce() external
+withdrawETH(address payable recipient) external nonReentrant
+hashOrder(Order order) external view returns (bytes32)
+isOrderValid(Order order, bytes signature) external view returns (bool)
+```
+
+State is limited to immutable configuration, `filledOrCancelled[orderHash]`, `minNonce[maker]`, and `ethCredits[recipient]`. Emit `OrderFilled`, `OrderCancelled`, `MinNonceIncremented`, and `ETHWithdrawn` with indexed maker/token/order identifiers and amounts. Support EOAs through ECDSA and smart-contract wallets through ERC-1271 signature validation.
+
+| Transition | Caller | Why they pay gas | Safe outcome if nobody calls |
+| --- | --- | --- | --- |
+| Sign/publish listing or offer | Maker (offchain) | No gas; advertises sale or desired purchase | No order exists and nothing moves |
+| Approve NFT | Seller/current owner | Enables their desired eventual settlement | Order stays visible but cannot fill |
+| Approve WETH | Offer maker | Enables acceptance of their desired offer | Offer cannot be accepted |
+| `buy` | Buyer | Receives the listed NFT | Listing remains unfilled until expiry/cancellation/ownership change |
+| `acceptOffer` | Current owner | Receives 97.5% of offered WETH | Offer remains unfilled until expiry/cancellation/balance or allowance change |
+| `cancelOrder` | Maker | Removes a live signed order | Order remains fillable while otherwise valid |
+| `incrementMinNonce` | Maker | Invalidates many stale orders cheaply | Older signed orders remain valid individually |
+| `withdrawETH` | Credited seller or artist | Receives accrued ETH; recipient may be another address | Credit remains safely claimable indefinitely |
+
+There is no keeper or admin-dependent transition and no scheduled work.
+
+## 3. Four-week build plan
+
+### Week 1 — specification, UX, and skeleton
+
+- Confirm and checksum the collection, WETH, and artist multisig addresses; inspect the deployed ERC-721 for standard compliance and any transfer restrictions.
+- Freeze the EIP-712 `Order` schema, exact rounding rule (`royalty = price * 250 / 10_000`, seller receives the remainder), nonce rules, event schema, and revert/error catalogue.
+- Write invariants and threat model: replay/cross-chain replay, stale ownership, revoked approvals, signature malleability/ERC-1271, reentrancy, malicious receivers, fee rounding, forced ETH, and WETH allowance/balance changes.
+- Scaffold the non-upgradeable contract and tests. Build wireframes for browse, list, buy, offer, accept, cancel, and withdraw flows.
+- Exit: reviewed specification; addresses recorded with sources; compiling skeleton; no unresolved economic or privilege decisions.
+
+### Week 2 — contract and service vertical slice
+
+- Implement typed-order hashing/signature validation, fills, cancellations, nonce invalidation, ETH credits/withdrawals, WETH settlement, events, custom errors, and immutable configuration.
+- Build the order relay API with schema validation, signature recovery/1271-aware status checks, expiration, deduplication, and rate limiting. Never accept custody or private keys.
+- Build the event indexer with confirmation depth and reorg rollback; derive order status from fills/cancellations/nonces plus current ownership and approvals.
+- Unit-test every branch and invariant; add fuzz/property tests for price splits, nonces, replay prevention, and arbitrary call ordering.
+- Exit: local end-to-end flow for listing purchase and offer acceptance; all contract tests green.
+
+### Week 3 — frontend, fork integration, and hardening
+
+- Implement collection browsing, ownership-aware actions, typed-signature prompts with human-readable terms, per-token approval, WETH balance/approval, cancellation, acceptance, ETH withdrawal, pending/confirmed states, and stale-order warnings.
+- Run Ethereum-mainnet-fork tests against the actual collection and canonical WETH: EOA and ERC-1271 makers, safe-transfer receivers, revoked approvals, changed owners, insufficient WETH, expired/cancelled/replayed orders, and reverting payout recipients.
+- Add static analysis, coverage gates, gas snapshots, API/indexer monitoring, structured logs, CSP and dependency scanning. Ensure frontend verifies chain ID and configured contract addresses.
+- Deploy to an Ethereum test environment or a mainnet fork for stakeholder acceptance; run the full vertical slice with production-shaped configuration.
+- Exit: release candidate and frozen feature set. Tag the exact audit commit; generate source/LOC report, dependency lockfile, test commands, deployment parameters, architecture diagram, invariants, and known-issues list for the auditor.
+
+### Week 4 — audit, fixes, and launch rehearsal
+
+- Auditor reviews the frozen commit described below. Engineering answers questions but makes no untracked changes to audit files.
+- Classify findings; fix critical/high/medium findings and agreed lows. Provide a fix commit/diff and tests for each finding; auditor performs a focused remediation review and issues a final report.
+- Re-run unit, fuzz, static, fork, frontend, and API tests. A reviewer independent of the implementer executes the launch checklist and adversarial end-to-end scenarios.
+- Rehearse deployment, verification, configuration, indexer start block, frontend release, and rollback/pause-of-frontend procedure. Contracts themselves have no pause/admin escape hatch.
+- Exit: final report has no unresolved critical/high findings, all accepted medium findings are fixed, deployment bytecode matches the audited build, and sign-off is recorded. If the audit cannot finish in the week, launch slips; audit scope is not compressed.
+
+## 4. Precise audit scope for quotation
+
+### In-scope artifacts
+
+The quote should assume **one non-upgradeable Solidity contract** (`CollectionMarketplace.sol`) plus only locally written helper/library code, targeting Solidity 0.8.x. Budget on approximately **350–500 non-comment Solidity source lines**; the final frozen-commit LOC report controls. Also in scope:
+
+- EIP-712 order encoding/domain separation and ECDSA/ERC-1271 validation;
+- fixed-price ETH listing settlement and WETH offer settlement;
+- ERC-721 approval/ownership and `safeTransferFrom` integration;
+- royalty calculation and rounding, ETH credit accounting/withdrawal, WETH transfers;
+- fill/cancel replay protection, individual cancellation, per-maker minimum nonce, expiry;
+- event correctness relative to state and transferred value;
+- constructor validation, immutables, access-control absence, and forced/unexpected ETH handling;
+- all custom Solidity libraries and modifications to vendored code;
+- deployment script and constructor arguments, including deterministic reproduction of deployed bytecode;
+- unit, fuzz/invariant, and mainnet-fork tests as evidence (tests are reviewed but test-only bugs are not protocol findings unless they hide a production defect); and
+- integration assumptions for the exact deployed collection, canonical mainnet WETH, and artist multisig.
+
+Provide the auditor: frozen Git commit and tag; compiler/settings and dependency lockfile; flattened sources only as a convenience; source LOC output; architecture/data-flow diagram; order schema and example signatures; invariants/threat model; roles/privileges statement; deployment script/config; test and coverage commands/results; fork block number/RPC requirements; known issues; and the verified collection/WETH ABI and addresses.
+
+### Required security properties
+
+The auditor should explicitly assess and report on these invariants:
+
+1. A successful fill transfers exactly the specified token once, and only with a valid unexpired maker signature bound to this chain, contract, collection, terms, and nonce.
+2. A listing can be filled only while its maker owns and has approved the token. An offer can be accepted only by the token’s current owner.
+3. For any successful sale of price `P`, artist entitlement is `floor(P * 250 / 10_000)` and seller entitlement is exactly `P - royalty`; no other party can capture value and accounting cannot create value.
+4. No order hash can fill twice; cancellation and minimum-nonce invalidation are irreversible for affected orders.
+5. Failed NFT/payment transfers revert the entire fill. Reentrancy cannot double-fill, alter credits, or withdraw twice.
+6. One reverting ETH recipient cannot block settlement or another recipient’s withdrawal; only the credited account can initiate spending its credit, though it may choose a recipient.
+7. The contract never takes custody of an NFT except transiently within no intended path, holds no escrowed WETH, and exposes no privileged seizure, fee-change, or upgrade route.
+8. Malformed signatures, ERC-1271 behavior, zero/extreme values, rounding dust, forced ETH, stale approvals/ownership, chain-ID changes, and malicious ERC-721 receivers fail safely.
+
+Review techniques expected in the quote: manual line-by-line review, threat-model/invariant review, automated static analysis, review of fuzz/invariant coverage, and reproduction of mainnet-fork integration tests. Quote one initial report plus one remediation review of a bounded fix diff delivered within an agreed window.
+
+### Out of scope and assumptions
+
+Out of scope unless separately quoted:
+
+- the already deployed ERC-721 collection bytecode, canonical WETH bytecode, and artist multisig internals (their interfaces and integration behavior remain in scope);
+- third-party libraries used unmodified (verify correct version/configuration/integration, but do not re-audit their internals);
+- frontend, API, database, indexer, hosting, wallet software, DNS, CI/CD, cloud accounts, key management, phishing/social engineering, and denial-of-service against the relay;
+- marketplace economics, tax/legal compliance, wash trading, sanctions, creator-royalty enforcement on other venues, and compromised user keys;
+- auctions, bundles, partial fills, collection bids, ERC-1155, arbitrary NFTs/tokens, permits, meta-transactions, delegated wallets, cross-chain behavior, upgradeability, and post-launch changes; and
+- formal verification and production penetration testing.
+
+Assumptions the auditor must validate at integration boundaries: the collection is the expected ERC-721 and permits ordinary approved transfers; canonical WETH returns/reverts as expected; artist and collection addresses are nonzero and correctly checksummed; price is denominated in wei; the frontend/relay do not change signed data; makers can revoke validity by ownership/balance/allowance changes even if the offchain UI is stale.
+
+Any semantic contract change after the frozen audit commit—order fields/hashing, external surface, payment flow, fee logic, dependencies, compiler settings, or deployment configuration—requires auditor review of the diff and may require a re-audit. A production launch is blocked by unresolved critical/high findings and by unremediated medium findings unless the auditor and project sign a written, narrowly reasoned exception.
+
+## 5. Deployment and release runbook
+
+Before launch, replace placeholders with the verified values and commit them in a network config file:
+
+```text
+ETH_RPC_URL          Ethereum mainnet RPC (secret)
+DEPLOYER_KEY         funded hardware-backed deployment signer (secret; temporary use)
+ETHERSCAN_API_KEY    verification credential (secret)
+COLLECTION_ADDRESS   existing collection
+WETH_ADDRESS         canonical mainnet WETH from official source
+ARTIST_ADDRESS       production artist multisig
+```
+
+The repository README must contain executable commands matching the chosen framework. Expected Foundry-shaped runbook (adjust only if the team selects another framework in Week 1):
+
+```bash
+forge test
+forge test --fork-url "$ETH_RPC_URL"
+forge script script/Deploy.s.sol:Deploy --rpc-url "$ETH_RPC_URL" --broadcast --verify
+cast call "$MARKETPLACE_ADDRESS" "collection()(address)" --rpc-url "$ETH_RPC_URL"
+cast call "$MARKETPLACE_ADDRESS" "weth()(address)" --rpc-url "$ETH_RPC_URL"
+cast call "$MARKETPLACE_ADDRESS" "artist()(address)" --rpc-url "$ETH_RPC_URL"
+```
+
+Deployment controls:
+
+1. Use a clean audited tag; reproduce compiler output and confirm creation/runtime bytecode against the auditor’s artifact.
+2. Two people independently verify chain ID 1, deployer, collection, WETH, artist multisig, fixed 250 bps constant, gas parameters, and source verification arguments.
+3. Deploy and verify source on Etherscan. Because configuration is immutable and there is no owner role, record explicitly that there is no ownership transfer step; the artist payout destination is already the intended multisig.
+4. Configure the indexer from the deployment block and frontend with the verified address. Do not enable public order submission yet.
+5. Execute a low-value end-to-end canary using team-owned collection tokens: sign/list/buy with ETH, verify NFT ownership and exact credits, withdraw both credits, make/approve/accept a WETH offer, cancel another order, and verify replay rejection. This requires identifying team-owned tokens before launch; do not use a holder’s token.
+6. Have the independent reviewer compare receipts, balances, events, and UI/indexer state to expected values, then enable public order submission.
+7. Publish contract address, verified source, audit report, immutable fee/artist configuration, WETH-offer requirement, and user warnings about approvals and signed-order validity.
+
+Rollback is operational only: if a defect appears, disable the site’s order relay and warn users to cancel individual orders or increment their minimum nonce. The immutable contract cannot be paused or upgraded; already signed valid orders may remain executable until cancelled, invalidated, expired, or made invalid by revoking approval/ownership/balance/allowance. A replacement requires a newly audited deployment and frontend migration.

codex
The draft now fixes the central offer constraint explicitly: fixed-price purchases use ETH, while delayed non-escrow offers use WETH allowance, since native ETH cannot be pulled from an offline bidder. I’ve also made the auditor’s quote basis concrete—one immutable contract, bounded surface/LOC, named invariants, integrations, deliverables, exclusions, and remediation terms. I’m doing a final consistency pass on the written file.
exec
/bin/bash -lc "wc -l -w plan.md && rg -n \"TBD|placeholder|pause|escrow|royalty|audit\" plan.md | sed -n '1,100p' && git diff --check && git status --short" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-28T143527Z-codex-with-skill-3/workspace
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
  202  2553 plan.md
11:- A buyer can make a WETH-denominated offer without escrow. The current owner can accept it later, atomically transferring the NFT and pulling WETH from the buyer, with the same split.
24:- a fixed royalty of 250 basis points out of 10,000.
26:Do not add a factory, NFT escrow, fee splitter, upgrade proxy, governance token, auction, bidding currency list, or arbitrary-collection support. ETH listing purchases and WETH offers are the only payment paths. The contract is non-upgradeable and has no owner-only operational functions. Changing the artist address or fee requires a new deployment and explicit migration, eliminating a privileged fee-redirection surface.
30:For a listing purchase, the seller signs and the buyer submits `buy(...)` with exact ETH. For an offer, the buyer signs after holding WETH and approving the marketplace; the token’s current owner submits `acceptOffer(...)`. Offers cannot use native ETH because a contract cannot pull ETH from an absent buyer later without escrow; WETH preserves the non-custodial requirement through balance and allowance.
56:Expected public/external surface (names may change before the audit commit, semantics may not):
89:- Freeze the EIP-712 `Order` schema, exact rounding rule (`royalty = price * 250 / 10_000`, seller receives the remainder), nonce rules, event schema, and revert/error catalogue.
108:- Exit: release candidate and frozen feature set. Tag the exact audit commit; generate source/LOC report, dependency lockfile, test commands, deployment parameters, architecture diagram, invariants, and known-issues list for the auditor.
110:### Week 4 — audit, fixes, and launch rehearsal
112:- Auditor reviews the frozen commit described below. Engineering answers questions but makes no untracked changes to audit files.
113:- Classify findings; fix critical/high/medium findings and agreed lows. Provide a fix commit/diff and tests for each finding; auditor performs a focused remediation review and issues a final report.
115:- Rehearse deployment, verification, configuration, indexer start block, frontend release, and rollback/pause-of-frontend procedure. Contracts themselves have no pause/admin escape hatch.
116:- Exit: final report has no unresolved critical/high findings, all accepted medium findings are fixed, deployment bytecode matches the audited build, and sign-off is recorded. If the audit cannot finish in the week, launch slips; audit scope is not compressed.
118:## 4. Precise audit scope for quotation
127:- royalty calculation and rounding, ETH credit accounting/withdrawal, WETH transfers;
136:Provide the auditor: frozen Git commit and tag; compiler/settings and dependency lockfile; flattened sources only as a convenience; source LOC output; architecture/data-flow diagram; order schema and example signatures; invariants/threat model; roles/privileges statement; deployment script/config; test and coverage commands/results; fork block number/RPC requirements; known issues; and the verified collection/WETH ABI and addresses.
140:The auditor should explicitly assess and report on these invariants:
144:3. For any successful sale of price `P`, artist entitlement is `floor(P * 250 / 10_000)` and seller entitlement is exactly `P - royalty`; no other party can capture value and accounting cannot create value.
148:7. The contract never takes custody of an NFT except transiently within no intended path, holds no escrowed WETH, and exposes no privileged seizure, fee-change, or upgrade route.
158:- third-party libraries used unmodified (verify correct version/configuration/integration, but do not re-audit their internals);
160:- marketplace economics, tax/legal compliance, wash trading, sanctions, creator-royalty enforcement on other venues, and compromised user keys;
164:Assumptions the auditor must validate at integration boundaries: the collection is the expected ERC-721 and permits ordinary approved transfers; canonical WETH returns/reverts as expected; artist and collection addresses are nonzero and correctly checksummed; price is denominated in wei; the frontend/relay do not change signed data; makers can revoke validity by ownership/balance/allowance changes even if the offchain UI is stale.
166:Any semantic contract change after the frozen audit commit—order fields/hashing, external surface, payment flow, fee logic, dependencies, compiler settings, or deployment configuration—requires auditor review of the diff and may require a re-audit. A production launch is blocked by unresolved critical/high findings and by unremediated medium findings unless the auditor and project sign a written, narrowly reasoned exception.
170:Before launch, replace placeholders with the verified values and commit them in a network config file:
194:1. Use a clean audited tag; reproduce compiler output and confirm creation/runtime bytecode against the auditor’s artifact.
200:7. Publish contract address, verified source, audit report, immutable fee/artist configuration, WETH-offer requirement, and user warnings about approvals and signed-order validity.
202:Rollback is operational only: if a defect appears, disable the site’s order relay and warn users to cancel individual orders or increment their minimum nonce. The immutable contract cannot be paused or upgraded; already signed valid orders may remain executable until cancelled, invalidated, expired, or made invalid by revoking approval/ownership/balance/allowance. A replacement requires a newly audited deployment and frontend migration.
?? plan.md

diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..95ee9817b9577f9219c9ac71bafa320bf1758d68
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,202 @@
+# Four-week MVP plan: non-custodial NFT marketplace
+
+## 1. Product decisions and MVP boundary
+
+### Goal and acceptance criteria
+
+Ship a marketplace for the existing 5,000-token ERC-721 collection where:
+
+- An owner can advertise a token for a fixed ETH price without transferring it or approving a marketplace-wide custodian.
+- A buyer can purchase a still-valid listing atomically; the NFT moves directly from seller to buyer, 97.5% of the price goes to the seller, and 2.5% goes to the artist.
+- A buyer can make a WETH-denominated offer without escrow. The current owner can accept it later, atomically transferring the NFT and pulling WETH from the buyer, with the same split.
+- A signer can cancel an individual order or invalidate all their older orders.
+- No administrator can seize NFTs, redirect an existing order, change its price, or settle it without the required signatures and approvals.
+
+The launch chain is **Ethereum mainnet**, because the collection and its ownership/liquidity already live there. Bridging or wrapping the collection would fragment the market and violate the direct-resale goal. Mainnet gas is an accepted product constraint for this MVP; all browsing, indexing, and order creation remain offchain.
+
+### One-contract architecture
+
+Deploy one immutable `CollectionMarketplace` contract configured at construction with:
+
+- the existing ERC-721 collection address;
+- canonical Ethereum-mainnet WETH address, obtained from and checked against official verified deployment documentation during implementation;
+- the artist payout address (production multisig, not an EOA); and
+- a fixed royalty of 250 basis points out of 10,000.
+
+Do not add a factory, NFT escrow, fee splitter, upgrade proxy, governance token, auction, bidding currency list, or arbitrary-collection support. ETH listing purchases and WETH offers are the only payment paths. The contract is non-upgradeable and has no owner-only operational functions. Changing the artist address or fee requires a new deployment and explicit migration, eliminating a privileged fee-redirection surface.
+
+Listings and offers are EIP-712 typed signed orders stored in the application database/IPFS-free order relay, not contract storage. A signed order contains at least: order kind, maker, collection, token ID, payment token (`address(0)` for an ETH listing; WETH for an offer), price, expiration, and maker nonce. The EIP-712 domain binds signatures to chain ID and marketplace contract. An order hash can be filled only once or explicitly cancelled. A per-maker minimum nonce supports “cancel all older orders.” Expired orders need no onchain cleanup.
+
+For a listing purchase, the seller signs and the buyer submits `buy(...)` with exact ETH. For an offer, the buyer signs after holding WETH and approving the marketplace; the token’s current owner submits `acceptOffer(...)`. Offers cannot use native ETH because a contract cannot pull ETH from an absent buyer later without escrow; WETH preserves the non-custodial requirement through balance and allowance.
+
+Use pull-payment credits for ETH proceeds rather than pushing ETH during settlement: settlement credits seller and artist balances, and each recipient withdraws independently. This prevents a reverting recipient from blocking the NFT sale. For WETH offers, use `safeTransferFrom` directly from buyer to seller and artist in the same transaction; the canonical WETH behavior is covered by mainnet-fork tests. Apply `nonReentrant`, checks-effects-interactions, and mark an order filled before external calls.
+
+The seller must grant the marketplace token approval (`approve(tokenId)` or `setApprovalForAll`) before settlement, but the NFT remains in the seller’s wallet. The UI should recommend per-token approval. At execution, verify current ownership, approval, signature, nonce, expiry, collection/payment constraints, unfilled/uncancelled status, nonzero price, exact payment, and that the taker is not zero. Transfer with `safeTransferFrom` and intentionally require the buyer to be able to receive an ERC-721.
+
+### Onchain/offchain boundary
+
+Onchain:
+
+- signature verification, replay protection, cancellation, ownership/approval checks;
+- atomic NFT/payment settlement and the immutable 2.5%/97.5% split;
+- ETH withdrawal accounting; and
+- events sufficient to reconstruct fills and cancellations.
+
+Offchain:
+
+- signed-order relay/database, listing and offer APIs;
+- collection metadata, images, search, filtering, activity feed, floor price, and rankings;
+- chain event indexing and removal/marking of stale orders; and
+- wallet UI, transaction preparation, confirmations, and error explanations.
+
+The index is a convenience, not an authority: every fill is validated onchain. If the API/indexer is unavailable, already obtained signed orders remain executable directly against the contract.
+
+## 2. Contract surface and state transitions
+
+Expected public/external surface (names may change before the audit commit, semantics may not):
+
+```solidity
+constructor(address collection, address weth, address artist)
+buy(Order listing, bytes sellerSignature) external payable nonReentrant
+acceptOffer(Order offer, bytes buyerSignature) external nonReentrant
+cancelOrder(Order order) external
+incrementMinNonce() external
+withdrawETH(address payable recipient) external nonReentrant
+hashOrder(Order order) external view returns (bytes32)
+isOrderValid(Order order, bytes signature) external view returns (bool)
+```
+
+State is limited to immutable configuration, `filledOrCancelled[orderHash]`, `minNonce[maker]`, and `ethCredits[recipient]`. Emit `OrderFilled`, `OrderCancelled`, `MinNonceIncremented`, and `ETHWithdrawn` with indexed maker/token/order identifiers and amounts. Support EOAs through ECDSA and smart-contract wallets through ERC-1271 signature validation.
+
+| Transition | Caller | Why they pay gas | Safe outcome if nobody calls |
+| --- | --- | --- | --- |
+| Sign/publish listing or offer | Maker (offchain) | No gas; advertises sale or desired purchase | No order exists and nothing moves |
+| Approve NFT | Seller/current owner | Enables their desired eventual settlement | Order stays visible but cannot fill |
+| Approve WETH | Offer maker | Enables acceptance of their desired offer | Offer cannot be accepted |
+| `buy` | Buyer | Receives the listed NFT | Listing remains unfilled until expiry/cancellation/ownership change |
+| `acceptOffer` | Current owner | Receives 97.5% of offered WETH | Offer remains unfilled until expiry/cancellation/balance or allowance change |
+| `cancelOrder` | Maker | Removes a live signed order | Order remains fillable while otherwise valid |
+| `incrementMinNonce` | Maker | Invalidates many stale orders cheaply | Older signed orders remain valid individually |
+| `withdrawETH` | Credited seller or artist | Receives accrued ETH; recipient may be another address | Credit remains safely claimable indefinitely |
+
+There is no keeper or admin-dependent transition and no scheduled work.
+
+## 3. Four-week build plan
+
+### Week 1 — specification, UX, and skeleton
+
+- Confirm and checksum the collection, WETH, and artist multisig addresses; inspect the deployed ERC-721 for standard compliance and any transfer restrictions.
+- Freeze the EIP-712 `Order` schema, exact rounding rule (`royalty = price * 250 / 10_000`, seller receives the remainder), nonce rules, event schema, and revert/error catalogue.
+- Write invariants and threat model: replay/cross-chain replay, stale ownership, revoked approvals, signature malleability/ERC-1271, reentrancy, malicious receivers, fee rounding, forced ETH, and WETH allowance/balance changes.
+- Scaffold the non-upgradeable contract and tests. Build wireframes for browse, list, buy, offer, accept, cancel, and withdraw flows.
+- Exit: reviewed specification; addresses recorded with sources; compiling skeleton; no unresolved economic or privilege decisions.
+
+### Week 2 — contract and service vertical slice
+
+- Implement typed-order hashing/signature validation, fills, cancellations, nonce invalidation, ETH credits/withdrawals, WETH settlement, events, custom errors, and immutable configuration.
+- Build the order relay API with schema validation, signature recovery/1271-aware status checks, expiration, deduplication, and rate limiting. Never accept custody or private keys.
+- Build the event indexer with confirmation depth and reorg rollback; derive order status from fills/cancellations/nonces plus current ownership and approvals.
+- Unit-test every branch and invariant; add fuzz/property tests for price splits, nonces, replay prevention, and arbitrary call ordering.
+- Exit: local end-to-end flow for listing purchase and offer acceptance; all contract tests green.
+
+### Week 3 — frontend, fork integration, and hardening
+
+- Implement collection browsing, ownership-aware actions, typed-signature prompts with human-readable terms, per-token approval, WETH balance/approval, cancellation, acceptance, ETH withdrawal, pending/confirmed states, and stale-order warnings.
+- Run Ethereum-mainnet-fork tests against the actual collection and canonical WETH: EOA and ERC-1271 makers, safe-transfer receivers, revoked approvals, changed owners, insufficient WETH, expired/cancelled/replayed orders, and reverting payout recipients.
+- Add static analysis, coverage gates, gas snapshots, API/indexer monitoring, structured logs, CSP and dependency scanning. Ensure frontend verifies chain ID and configured contract addresses.
+- Deploy to an Ethereum test environment or a mainnet fork for stakeholder acceptance; run the full vertical slice with production-shaped configuration.
+- Exit: release candidate and frozen feature set. Tag the exact audit commit; generate source/LOC report, dependency lockfile, test commands, deployment parameters, architecture diagram, invariants, and known-issues list for the auditor.
+
+### Week 4 — audit, fixes, and launch rehearsal
+
+- Auditor reviews the frozen commit described below. Engineering answers questions but makes no untracked changes to audit files.
+- Classify findings; fix critical/high/medium findings and agreed lows. Provide a fix commit/diff and tests for each finding; auditor performs a focused remediation review and issues a final report.
+- Re-run unit, fuzz, static, fork, frontend, and API tests. A reviewer independent of the implementer executes the launch checklist and adversarial end-to-end scenarios.
+- Rehearse deployment, verification, configuration, indexer start block, frontend release, and rollback/pause-of-frontend procedure. Contracts themselves have no pause/admin escape hatch.
+- Exit: final report has no unresolved critical/high findings, all accepted medium findings are fixed, deployment bytecode matches the audited build, and sign-off is recorded. If the audit cannot finish in the week, launch slips; audit scope is not compressed.
+
+## 4. Precise audit scope for quotation
+
+### In-scope artifacts
+
+The quote should assume **one non-upgradeable Solidity contract** (`CollectionMarketplace.sol`) plus only locally written helper/library code, targeting Solidity 0.8.x. Budget on approximately **350–500 non-comment Solidity source lines**; the final frozen-commit LOC report controls. Also in scope:
+
+- EIP-712 order encoding/domain separation and ECDSA/ERC-1271 validation;
+- fixed-price ETH listing settlement and WETH offer settlement;
+- ERC-721 approval/ownership and `safeTransferFrom` integration;
+- royalty calculation and rounding, ETH credit accounting/withdrawal, WETH transfers;
+- fill/cancel replay protection, individual cancellation, per-maker minimum nonce, expiry;
+- event correctness relative to state and transferred value;
+- constructor validation, immutables, access-control absence, and forced/unexpected ETH handling;
+- all custom Solidity libraries and modifications to vendored code;
+- deployment script and constructor arguments, including deterministic reproduction of deployed bytecode;
+- unit, fuzz/invariant, and mainnet-fork tests as evidence (tests are reviewed but test-only bugs are not protocol findings unless they hide a production defect); and
+- integration assumptions for the exact deployed collection, canonical mainnet WETH, and artist multisig.
+
+Provide the auditor: frozen Git commit and tag; compiler/settings and dependency lockfile; flattened sources only as a convenience; source LOC output; architecture/data-flow diagram; order schema and example signatures; invariants/threat model; roles/privileges statement; deployment script/config; test and coverage commands/results; fork block number/RPC requirements; known issues; and the verified collection/WETH ABI and addresses.
+
+### Required security properties
+
+The auditor should explicitly assess and report on these invariants:
+
+1. A successful fill transfers exactly the specified token once, and only with a valid unexpired maker signature bound to this chain, contract, collection, terms, and nonce.
+2. A listing can be filled only while its maker owns and has approved the token. An offer can be accepted only by the token’s current owner.
+3. For any successful sale of price `P`, artist entitlement is `floor(P * 250 / 10_000)` and seller entitlement is exactly `P - royalty`; no other party can capture value and accounting cannot create value.
+4. No order hash can fill twice; cancellation and minimum-nonce invalidation are irreversible for affected orders.
+5. Failed NFT/payment transfers revert the entire fill. Reentrancy cannot double-fill, alter credits, or withdraw twice.
+6. One reverting ETH recipient cannot block settlement or another recipient’s withdrawal; only the credited account can initiate spending its credit, though it may choose a recipient.
+7. The contract never takes custody of an NFT except transiently within no intended path, holds no escrowed WETH, and exposes no privileged seizure, fee-change, or upgrade route.
+8. Malformed signatures, ERC-1271 behavior, zero/extreme values, rounding dust, forced ETH, stale approvals/ownership, chain-ID changes, and malicious ERC-721 receivers fail safely.
+
+Review techniques expected in the quote: manual line-by-line review, threat-model/invariant review, automated static analysis, review of fuzz/invariant coverage, and reproduction of mainnet-fork integration tests. Quote one initial report plus one remediation review of a bounded fix diff delivered within an agreed window.
+
+### Out of scope and assumptions
+
+Out of scope unless separately quoted:
+
+- the already deployed ERC-721 collection bytecode, canonical WETH bytecode, and artist multisig internals (their interfaces and integration behavior remain in scope);
+- third-party libraries used unmodified (verify correct version/configuration/integration, but do not re-audit their internals);
+- frontend, API, database, indexer, hosting, wallet software, DNS, CI/CD, cloud accounts, key management, phishing/social engineering, and denial-of-service against the relay;
+- marketplace economics, tax/legal compliance, wash trading, sanctions, creator-royalty enforcement on other venues, and compromised user keys;
+- auctions, bundles, partial fills, collection bids, ERC-1155, arbitrary NFTs/tokens, permits, meta-transactions, delegated wallets, cross-chain behavior, upgradeability, and post-launch changes; and
+- formal verification and production penetration testing.
+
+Assumptions the auditor must validate at integration boundaries: the collection is the expected ERC-721 and permits ordinary approved transfers; canonical WETH returns/reverts as expected; artist and collection addresses are nonzero and correctly checksummed; price is denominated in wei; the frontend/relay do not change signed data; makers can revoke validity by ownership/balance/allowance changes even if the offchain UI is stale.
+
+Any semantic contract change after the frozen audit commit—order fields/hashing, external surface, payment flow, fee logic, dependencies, compiler settings, or deployment configuration—requires auditor review of the diff and may require a re-audit. A production launch is blocked by unresolved critical/high findings and by unremediated medium findings unless the auditor and project sign a written, narrowly reasoned exception.
+
+## 5. Deployment and release runbook
+
+Before launch, replace placeholders with the verified values and commit them in a network config file:
+
+```text
+ETH_RPC_URL          Ethereum mainnet RPC (secret)
+DEPLOYER_KEY         funded hardware-backed deployment signer (secret; temporary use)
+ETHERSCAN_API_KEY    verification credential (secret)
+COLLECTION_ADDRESS   existing collection
+WETH_ADDRESS         canonical mainnet WETH from official source
+ARTIST_ADDRESS       production artist multisig
+```
+
+The repository README must contain executable commands matching the chosen framework. Expected Foundry-shaped runbook (adjust only if the team selects another framework in Week 1):
+
+```bash
+forge test
+forge test --fork-url "$ETH_RPC_URL"
+forge script script/Deploy.s.sol:Deploy --rpc-url "$ETH_RPC_URL" --broadcast --verify
+cast call "$MARKETPLACE_ADDRESS" "collection()(address)" --rpc-url "$ETH_RPC_URL"
+cast call "$MARKETPLACE_ADDRESS" "weth()(address)" --rpc-url "$ETH_RPC_URL"
+cast call "$MARKETPLACE_ADDRESS" "artist()(address)" --rpc-url "$ETH_RPC_URL"
+```
+
+Deployment controls:
+
+1. Use a clean audited tag; reproduce compiler output and confirm creation/runtime bytecode against the auditor’s artifact.
+2. Two people independently verify chain ID 1, deployer, collection, WETH, artist multisig, fixed 250 bps constant, gas parameters, and source verification arguments.
+3. Deploy and verify source on Etherscan. Because configuration is immutable and there is no owner role, record explicitly that there is no ownership transfer step; the artist payout destination is already the intended multisig.
+4. Configure the indexer from the deployment block and frontend with the verified address. Do not enable public order submission yet.
+5. Execute a low-value end-to-end canary using team-owned collection tokens: sign/list/buy with ETH, verify NFT ownership and exact credits, withdraw both credits, make/approve/accept a WETH offer, cancel another order, and verify replay rejection. This requires identifying team-owned tokens before launch; do not use a holder’s token.
+6. Have the independent reviewer compare receipts, balances, events, and UI/indexer state to expected values, then enable public order submission.
+7. Publish contract address, verified source, audit report, immutable fee/artist configuration, WETH-offer requirement, and user warnings about approvals and signed-order validity.
+
+Rollback is operational only: if a defect appears, disable the site’s order relay and warn users to cancel individual orders or increment their minimum nonce. The immutable contract cannot be paused or upgraded; already signed valid orders may remain executable until cancelled, invalidated, expired, or made invalid by revoking approval/ownership/balance/allowance. A replacement requires a newly audited deployment and frontend migration.

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-28T143527Z-codex-with-skill-3/workspace/plan.md
diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..4db822094dfc5a9d4ed5b09cd684e4fa4b8c7968
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,202 @@
+# Four-week MVP plan: non-custodial NFT marketplace
+
+## 1. Product decisions and MVP boundary
+
+### Goal and acceptance criteria
+
+Ship a marketplace for the existing 5,000-token ERC-721 collection where:
+
+- An owner can advertise a token for a fixed ETH price without transferring it or approving a marketplace-wide custodian.
+- A buyer can purchase a still-valid listing atomically; the NFT moves directly from seller to buyer, 97.5% of the price goes to the seller, and 2.5% goes to the artist.
+- A buyer can make a WETH-denominated offer without escrow. The current owner can accept it later, atomically transferring the NFT and pulling WETH from the buyer, with the same split.
+- A signer can cancel an individual order or invalidate all their older orders.
+- No administrator can seize NFTs, redirect an existing order, change its price, or settle it without the required signatures and approvals.
+
+The launch chain is **Ethereum mainnet**, because the collection and its ownership/liquidity already live there. Bridging or wrapping the collection would fragment the market and violate the direct-resale goal. Mainnet gas is an accepted product constraint for this MVP; all browsing, indexing, and order creation remain offchain.
+
+### One-contract architecture
+
+Deploy one immutable `CollectionMarketplace` contract configured at construction with:
+
+- the existing ERC-721 collection address;
+- canonical Ethereum-mainnet WETH address, obtained from and checked against official verified deployment documentation during implementation;
+- the artist payout address (production multisig, not an EOA); and
+- a fixed royalty of 250 basis points out of 10,000.
+
+Do not add a factory, NFT escrow, fee splitter, upgrade proxy, governance token, auction, bidding currency list, or arbitrary-collection support. ETH listing purchases and WETH offers are the only payment paths. The contract is non-upgradeable and has no owner-only operational functions. Changing the artist address or fee requires a new deployment and explicit migration, eliminating a privileged fee-redirection surface.
+
+Listings and offers are EIP-712 typed signed orders stored in the application database/IPFS-free order relay, not contract storage. A signed order contains at least: order kind, maker, collection, token ID, payment token (`address(0)` for an ETH listing; WETH for an offer), price, expiration, and maker nonce. The EIP-712 domain binds signatures to chain ID and marketplace contract. An order hash can be filled only once or explicitly cancelled. A per-maker minimum nonce supports “cancel all older orders.” Expired orders need no onchain cleanup.
+
+For a listing purchase, the seller signs and the buyer submits `buy(...)` with exact ETH. For an offer, the buyer signs after holding WETH and approving the marketplace; the token’s current owner submits `acceptOffer(...)`. Offers cannot use native ETH because a contract cannot pull ETH from an absent buyer later without escrow; WETH preserves the non-custodial requirement through balance and allowance.
+
+Use pull-payment credits for ETH proceeds rather than pushing ETH during settlement: settlement credits seller and artist balances, and each recipient withdraws independently. This prevents a reverting recipient from blocking the NFT sale. For WETH offers, use `safeTransferFrom` directly from buyer to seller and artist in the same transaction; the canonical WETH behavior is covered by mainnet-fork tests. Apply `nonReentrant`, checks-effects-interactions, and mark an order filled before external calls.
+
+The seller must grant the marketplace token approval (`approve(tokenId)` or `setApprovalForAll`) before settlement, but the NFT remains in the seller’s wallet. The UI should recommend per-token approval. At execution, verify current ownership, approval, signature, nonce, expiry, collection/payment constraints, unfilled/uncancelled status, nonzero price, exact payment, and that the taker is not zero. Transfer with `safeTransferFrom` and intentionally require the buyer to be able to receive an ERC-721.
+
+### Onchain/offchain boundary
+
+Onchain:
+
+- signature verification, replay protection, cancellation, ownership/approval checks;
+- atomic NFT/payment settlement and the immutable 2.5%/97.5% split;
+- ETH withdrawal accounting; and
+- events sufficient to reconstruct fills and cancellations.
+
+Offchain:
+
+- signed-order relay/database, listing and offer APIs;
+- collection metadata, images, search, filtering, activity feed, floor price, and rankings;
+- chain event indexing and removal/marking of stale orders; and
+- wallet UI, transaction preparation, confirmations, and error explanations.
+
+The index is a convenience, not an authority: every fill is validated onchain. If the API/indexer is unavailable, already obtained signed orders remain executable directly against the contract.
+
+## 2. Contract surface and state transitions
+
+Expected public/external surface (names may change before the audit commit, semantics may not):
+
+```solidity
+constructor(address collection, address weth, address artist)
+buy(Order listing, bytes sellerSignature) external payable nonReentrant
+acceptOffer(Order offer, bytes buyerSignature) external nonReentrant
+cancelOrder(Order order) external
+incrementMinNonce() external
+withdrawETH(address payable recipient) external nonReentrant
+hashOrder(Order order) external view returns (bytes32)
+isOrderValid(Order order, bytes signature) external view returns (bool)
+```
+
+State is limited to immutable configuration, `filledOrCancelled[orderHash]`, `minNonce[maker]`, and `ethCredits[recipient]`. Emit `OrderFilled`, `OrderCancelled`, `MinNonceIncremented`, and `ETHWithdrawn` with indexed maker/token/order identifiers and amounts. Support EOAs through ECDSA and smart-contract wallets through ERC-1271 signature validation.
+
+| Transition | Caller | Why they pay gas | Safe outcome if nobody calls |
+| --- | --- | --- | --- |
+| Sign/publish listing or offer | Maker (offchain) | No gas; advertises sale or desired purchase | No order exists and nothing moves |
+| Approve NFT | Seller/current owner | Enables their desired eventual settlement | Order stays visible but cannot fill |
+| Approve WETH | Offer maker | Enables acceptance of their desired offer | Offer cannot be accepted |
+| `buy` | Buyer | Receives the listed NFT | Listing remains unfilled until expiry/cancellation/ownership change |
+| `acceptOffer` | Current owner | Receives 97.5% of offered WETH | Offer remains unfilled until expiry/cancellation/balance or allowance change |
+| `cancelOrder` | Maker | Removes a live signed order | Order remains fillable while otherwise valid |
+| `incrementMinNonce` | Maker | Invalidates many stale orders cheaply | Older signed orders remain valid individually |
+| `withdrawETH` | Credited seller or artist | Receives accrued ETH; recipient may be another address | Credit remains safely claimable indefinitely |
+
+There is no keeper or admin-dependent transition and no scheduled work.
+
+## 3. Four-week build plan
+
+### Week 1 — specification, UX, and skeleton
+
+- Confirm and checksum the collection, WETH, and artist multisig addresses; inspect the deployed ERC-721 for standard compliance and any transfer restrictions.
+- Freeze the EIP-712 `Order` schema, exact rounding rule (`royalty = price * 250 / 10_000`, seller receives the remainder), nonce rules, event schema, and revert/error catalogue.
+- Write invariants and threat model: replay/cross-chain replay, stale ownership, revoked approvals, signature malleability/ERC-1271, reentrancy, malicious receivers, fee rounding, forced ETH, and WETH allowance/balance changes.
+- Scaffold the non-upgradeable contract and tests. Build wireframes for browse, list, buy, offer, accept, cancel, and withdraw flows.
+- Exit: reviewed specification; addresses recorded with sources; compiling skeleton; no unresolved economic or privilege decisions.
+
+### Week 2 — contract and service vertical slice
+
+- Implement typed-order hashing/signature validation, fills, cancellations, nonce invalidation, ETH credits/withdrawals, WETH settlement, events, custom errors, and immutable configuration.
+- Build the order relay API with schema validation, signature recovery/1271-aware status checks, expiration, deduplication, and rate limiting. Never accept custody or private keys.
+- Build the event indexer with confirmation depth and reorg rollback; derive order status from fills/cancellations/nonces plus current ownership and approvals.
+- Unit-test every branch and invariant; add fuzz/property tests for price splits, nonces, replay prevention, and arbitrary call ordering.
+- Exit: local end-to-end flow for listing purchase and offer acceptance; all contract tests green.
+
+### Week 3 — frontend, fork integration, and hardening
+
+- Implement collection browsing, ownership-aware actions, typed-signature prompts with human-readable terms, per-token approval, WETH balance/approval, cancellation, acceptance, ETH withdrawal, pending/confirmed states, and stale-order warnings.
+- Run Ethereum-mainnet-fork tests against the actual collection and canonical WETH: EOA and ERC-1271 makers, safe-transfer receivers, revoked approvals, changed owners, insufficient WETH, expired/cancelled/replayed orders, and reverting payout recipients.
+- Add static analysis, coverage gates, gas snapshots, API/indexer monitoring, structured logs, CSP and dependency scanning. Ensure frontend verifies chain ID and configured contract addresses.
+- Deploy to an Ethereum test environment or a mainnet fork for stakeholder acceptance; run the full vertical slice with production-shaped configuration.
+- Exit: release candidate and frozen feature set. Tag the exact audit commit; generate source/LOC report, dependency lockfile, test commands, deployment parameters, architecture diagram, invariants, and known-issues list for the auditor.
+
+### Week 4 — audit, fixes, and launch rehearsal
+
+- Auditor reviews the frozen commit described below. Engineering answers questions but makes no untracked changes to audit files.
+- Classify findings; fix critical/high/medium findings and agreed lows. Provide a fix commit/diff and tests for each finding; auditor performs a focused remediation review and issues a final report.
+- Re-run unit, fuzz, static, fork, frontend, and API tests. A reviewer independent of the implementer executes the launch checklist and adversarial end-to-end scenarios.
+- Rehearse deployment, verification, configuration, indexer start block, frontend release, and rollback/pause-of-frontend procedure. Contracts themselves have no pause/admin escape hatch.
+- Exit: final report has no unresolved critical/high findings, all accepted medium findings are fixed, deployment bytecode matches the audited build, and sign-off is recorded. If the audit cannot finish in the week, launch slips; audit scope is not compressed.
+
+## 4. Precise audit scope for quotation
+
+### In-scope artifacts
+
+The quote should assume **one non-upgradeable Solidity contract** (`CollectionMarketplace.sol`) plus only locally written helper/library code, targeting Solidity 0.8.x. Budget on approximately **350–500 non-comment Solidity source lines**; the final frozen-commit LOC report controls. Also in scope:
+
+- EIP-712 order encoding/domain separation and ECDSA/ERC-1271 validation;
+- fixed-price ETH listing settlement and WETH offer settlement;
+- ERC-721 approval/ownership and `safeTransferFrom` integration;
+- royalty calculation and rounding, ETH credit accounting/withdrawal, WETH transfers;
+- fill/cancel replay protection, individual cancellation, per-maker minimum nonce, expiry;
+- event correctness relative to state and transferred value;
+- constructor validation, immutables, access-control absence, and forced/unexpected ETH handling;
+- all custom Solidity libraries and modifications to vendored code;
+- deployment script and constructor arguments, including deterministic reproduction of deployed bytecode;
+- unit, fuzz/invariant, and mainnet-fork tests as evidence (tests are reviewed but test-only bugs are not protocol findings unless they hide a production defect); and
+- integration assumptions for the exact deployed collection, canonical mainnet WETH, and artist multisig.
+
+Provide the auditor: frozen Git commit and tag; compiler/settings and dependency lockfile; flattened sources only as a convenience; source LOC output; architecture/data-flow diagram; order schema and example signatures; invariants/threat model; roles/privileges statement; deployment script/config; test and coverage commands/results; fork block number/RPC requirements; known issues; and the verified collection/WETH ABI and addresses.
+
+### Required security properties
+
+The auditor should explicitly assess and report on these invariants:
+
+1. A successful fill transfers exactly the specified token once, and only with a valid unexpired maker signature bound to this chain, contract, collection, terms, and nonce.
+2. A listing can be filled only while its maker owns and has approved the token. An offer can be accepted only by the token’s current owner.
+3. For any successful sale of price `P`, artist entitlement is `floor(P * 250 / 10_000)` and seller entitlement is exactly `P - royalty`; no other party can capture value and accounting cannot create value.
+4. No order hash can fill twice; cancellation and minimum-nonce invalidation are irreversible for affected orders.
+5. Failed NFT/payment transfers revert the entire fill. Reentrancy cannot double-fill, alter credits, or withdraw twice.
+6. One reverting ETH recipient cannot block settlement or another recipient’s withdrawal; only the credited account can initiate spending its credit, though it may choose a recipient.
+7. The contract never takes custody of an NFT, holds no escrowed WETH, and exposes no privileged seizure, fee-change, or upgrade route.
+8. Malformed signatures, ERC-1271 behavior, zero/extreme values, rounding dust, forced ETH, stale approvals/ownership, chain-ID changes, and malicious ERC-721 receivers fail safely.
+
+Review techniques expected in the quote: manual line-by-line review, threat-model/invariant review, automated static analysis, review of fuzz/invariant coverage, and reproduction of mainnet-fork integration tests. Quote one initial report plus one remediation review of a bounded fix diff delivered within an agreed window.
+
+### Out of scope and assumptions
+
+Out of scope unless separately quoted:
+
+- the already deployed ERC-721 collection bytecode, canonical WETH bytecode, and artist multisig internals (their interfaces and integration behavior remain in scope);
+- third-party libraries used unmodified (verify correct version/configuration/integration, but do not re-audit their internals);
+- frontend, API, database, indexer, hosting, wallet software, DNS, CI/CD, cloud accounts, key management, phishing/social engineering, and denial-of-service against the relay;
+- marketplace economics, tax/legal compliance, wash trading, sanctions, creator-royalty enforcement on other venues, and compromised user keys;
+- auctions, bundles, partial fills, collection bids, ERC-1155, arbitrary NFTs/tokens, permits, meta-transactions, delegated wallets, cross-chain behavior, upgradeability, and post-launch changes; and
+- formal verification and production penetration testing.
+
+Assumptions the auditor must validate at integration boundaries: the collection is the expected ERC-721 and permits ordinary approved transfers; canonical WETH returns/reverts as expected; artist and collection addresses are nonzero and correctly checksummed; price is denominated in wei; the frontend/relay do not change signed data; makers can revoke validity by ownership/balance/allowance changes even if the offchain UI is stale.
+
+Any semantic contract change after the frozen audit commit—order fields/hashing, external surface, payment flow, fee logic, dependencies, compiler settings, or deployment configuration—requires auditor review of the diff and may require a re-audit. A production launch is blocked by unresolved critical/high findings and by unremediated medium findings unless the auditor and project sign a written, narrowly reasoned exception.
+
+## 5. Deployment and release runbook
+
+Before launch, replace placeholders with the verified values and commit them in a network config file:
+
+```text
+ETH_RPC_URL          Ethereum mainnet RPC (secret)
+DEPLOYER_KEY         funded hardware-backed deployment signer (secret; temporary use)
+ETHERSCAN_API_KEY    verification credential (secret)
+COLLECTION_ADDRESS   existing collection
+WETH_ADDRESS         canonical mainnet WETH from official source
+ARTIST_ADDRESS       production artist multisig
+```
+
+The repository README must contain executable commands matching the chosen framework. Expected Foundry-shaped runbook (adjust only if the team selects another framework in Week 1):
+
+```bash
+forge test
+forge test --fork-url "$ETH_RPC_URL"
+forge script script/Deploy.s.sol:Deploy --rpc-url "$ETH_RPC_URL" --broadcast --verify
+cast call "$MARKETPLACE_ADDRESS" "collection()(address)" --rpc-url "$ETH_RPC_URL"
+cast call "$MARKETPLACE_ADDRESS" "weth()(address)" --rpc-url "$ETH_RPC_URL"
+cast call "$MARKETPLACE_ADDRESS" "artist()(address)" --rpc-url "$ETH_RPC_URL"
+```
+
+Deployment controls:
+
+1. Use a clean audited tag; reproduce compiler output and confirm creation/runtime bytecode against the auditor’s artifact.
+2. Two people independently verify chain ID 1, deployer, collection, WETH, artist multisig, fixed 250 bps constant, gas parameters, and source verification arguments.
+3. Deploy and verify source on Etherscan. Because configuration is immutable and there is no owner role, record explicitly that there is no ownership transfer step; the artist payout destination is already the intended multisig.
+4. Configure the indexer from the deployment block and frontend with the verified address. Do not enable public order submission yet.
+5. Execute a low-value end-to-end canary using team-owned collection tokens: sign/list/buy with ETH, verify NFT ownership and exact credits, withdraw both credits, make/approve/accept a WETH offer, cancel another order, and verify replay rejection. This requires identifying team-owned tokens before launch; do not use a holder’s token.
+6. Have the independent reviewer compare receipts, balances, events, and UI/indexer state to expected values, then enable public order submission.
+7. Publish contract address, verified source, audit report, immutable fee/artist configuration, WETH-offer requirement, and user warnings about approvals and signed-order validity.
+
+Rollback is operational only: if a defect appears, disable the site’s order relay and warn users to cancel individual orders or increment their minimum nonce. The immutable contract cannot be paused or upgraded; already signed valid orders may remain executable until cancelled, invalidated, expired, or made invalid by revoking approval/ownership/balance/allowance. A replacement requires a newly audited deployment and frontend migration.

diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..4db822094dfc5a9d4ed5b09cd684e4fa4b8c7968
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,202 @@
+# Four-week MVP plan: non-custodial NFT marketplace
+
+## 1. Product decisions and MVP boundary
+
+### Goal and acceptance criteria
+
+Ship a marketplace for the existing 5,000-token ERC-721 collection where:
+
+- An owner can advertise a token for a fixed ETH price without transferring it or approving a marketplace-wide custodian.
+- A buyer can purchase a still-valid listing atomically; the NFT moves directly from seller to buyer, 97.5% of the price goes to the seller, and 2.5% goes to the artist.
+- A buyer can make a WETH-denominated offer without escrow. The current owner can accept it later, atomically transferring the NFT and pulling WETH from the buyer, with the same split.
+- A signer can cancel an individual order or invalidate all their older orders.
+- No administrator can seize NFTs, redirect an existing order, change its price, or settle it without the required signatures and approvals.
+
+The launch chain is **Ethereum mainnet**, because the collection and its ownership/liquidity already live there. Bridging or wrapping the collection would fragment the market and violate the direct-resale goal. Mainnet gas is an accepted product constraint for this MVP; all browsing, indexing, and order creation remain offchain.
+
+### One-contract architecture
+
+Deploy one immutable `CollectionMarketplace` contract configured at construction with:
+
+- the existing ERC-721 collection address;
+- canonical Ethereum-mainnet WETH address, obtained from and checked against official verified deployment documentation during implementation;
+- the artist payout address (production multisig, not an EOA); and
+- a fixed royalty of 250 basis points out of 10,000.
+
+Do not add a factory, NFT escrow, fee splitter, upgrade proxy, governance token, auction, bidding currency list, or arbitrary-collection support. ETH listing purchases and WETH offers are the only payment paths. The contract is non-upgradeable and has no owner-only operational functions. Changing the artist address or fee requires a new deployment and explicit migration, eliminating a privileged fee-redirection surface.
+
+Listings and offers are EIP-712 typed signed orders stored in the application database/IPFS-free order relay, not contract storage. A signed order contains at least: order kind, maker, collection, token ID, payment token (`address(0)` for an ETH listing; WETH for an offer), price, expiration, and maker nonce. The EIP-712 domain binds signatures to chain ID and marketplace contract. An order hash can be filled only once or explicitly cancelled. A per-maker minimum nonce supports “cancel all older orders.” Expired orders need no onchain cleanup.
+
+For a listing purchase, the seller signs and the buyer submits `buy(...)` with exact ETH. For an offer, the buyer signs after holding WETH and approving the marketplace; the token’s current owner submits `acceptOffer(...)`. Offers cannot use native ETH because a contract cannot pull ETH from an absent buyer later without escrow; WETH preserves the non-custodial requirement through balance and allowance.
+
+Use pull-payment credits for ETH proceeds rather than pushing ETH during settlement: settlement credits seller and artist balances, and each recipient withdraws independently. This prevents a reverting recipient from blocking the NFT sale. For WETH offers, use `safeTransferFrom` directly from buyer to seller and artist in the same transaction; the canonical WETH behavior is covered by mainnet-fork tests. Apply `nonReentrant`, checks-effects-interactions, and mark an order filled before external calls.
+
+The seller must grant the marketplace token approval (`approve(tokenId)` or `setApprovalForAll`) before settlement, but the NFT remains in the seller’s wallet. The UI should recommend per-token approval. At execution, verify current ownership, approval, signature, nonce, expiry, collection/payment constraints, unfilled/uncancelled status, nonzero price, exact payment, and that the taker is not zero. Transfer with `safeTransferFrom` and intentionally require the buyer to be able to receive an ERC-721.
+
+### Onchain/offchain boundary
+
+Onchain:
+
+- signature verification, replay protection, cancellation, ownership/approval checks;
+- atomic NFT/payment settlement and the immutable 2.5%/97.5% split;
+- ETH withdrawal accounting; and
+- events sufficient to reconstruct fills and cancellations.
+
+Offchain:
+
+- signed-order relay/database, listing and offer APIs;
+- collection metadata, images, search, filtering, activity feed, floor price, and rankings;
+- chain event indexing and removal/marking of stale orders; and
+- wallet UI, transaction preparation, confirmations, and error explanations.
+
+The index is a convenience, not an authority: every fill is validated onchain. If the API/indexer is unavailable, already obtained signed orders remain executable directly against the contract.
+
+## 2. Contract surface and state transitions
+
+Expected public/external surface (names may change before the audit commit, semantics may not):
+
+```solidity
+constructor(address collection, address weth, address artist)
+buy(Order listing, bytes sellerSignature) external payable nonReentrant
+acceptOffer(Order offer, bytes buyerSignature) external nonReentrant
+cancelOrder(Order order) external
+incrementMinNonce() external
+withdrawETH(address payable recipient) external nonReentrant
+hashOrder(Order order) external view returns (bytes32)
+isOrderValid(Order order, bytes signature) external view returns (bool)
+```
+
+State is limited to immutable configuration, `filledOrCancelled[orderHash]`, `minNonce[maker]`, and `ethCredits[recipient]`. Emit `OrderFilled`, `OrderCancelled`, `MinNonceIncremented`, and `ETHWithdrawn` with indexed maker/token/order identifiers and amounts. Support EOAs through ECDSA and smart-contract wallets through ERC-1271 signature validation.
+
+| Transition | Caller | Why they pay gas | Safe outcome if nobody calls |
+| --- | --- | --- | --- |
+| Sign/publish listing or offer | Maker (offchain) | No gas; advertises sale or desired purchase | No order exists and nothing moves |
+| Approve NFT | Seller/current owner | Enables their desired eventual settlement | Order stays visible but cannot fill |
+| Approve WETH | Offer maker | Enables acceptance of their desired offer | Offer cannot be accepted |
+| `buy` | Buyer | Receives the listed NFT | Listing remains unfilled until expiry/cancellation/ownership change |
+| `acceptOffer` | Current owner | Receives 97.5% of offered WETH | Offer remains unfilled until expiry/cancellation/balance or allowance change |
+| `cancelOrder` | Maker | Removes a live signed order | Order remains fillable while otherwise valid |
+| `incrementMinNonce` | Maker | Invalidates many stale orders cheaply | Older signed orders remain valid individually |
+| `withdrawETH` | Credited seller or artist | Receives accrued ETH; recipient may be another address | Credit remains safely claimable indefinitely |
+
+There is no keeper or admin-dependent transition and no scheduled work.
+
+## 3. Four-week build plan
+
+### Week 1 — specification, UX, and skeleton
+
+- Confirm and checksum the collection, WETH, and artist multisig addresses; inspect the deployed ERC-721 for standard compliance and any transfer restrictions.
+- Freeze the EIP-712 `Order` schema, exact rounding rule (`royalty = price * 250 / 10_000`, seller receives the remainder), nonce rules, event schema, and revert/error catalogue.
+- Write invariants and threat model: replay/cross-chain replay, stale ownership, revoked approvals, signature malleability/ERC-1271, reentrancy, malicious receivers, fee rounding, forced ETH, and WETH allowance/balance changes.
+- Scaffold the non-upgradeable contract and tests. Build wireframes for browse, list, buy, offer, accept, cancel, and withdraw flows.
+- Exit: reviewed specification; addresses recorded with sources; compiling skeleton; no unresolved economic or privilege decisions.
+
+### Week 2 — contract and service vertical slice
+
+- Implement typed-order hashing/signature validation, fills, cancellations, nonce invalidation, ETH credits/withdrawals, WETH settlement, events, custom errors, and immutable configuration.
+- Build the order relay API with schema validation, signature recovery/1271-aware status checks, expiration, deduplication, and rate limiting. Never accept custody or private keys.
+- Build the event indexer with confirmation depth and reorg rollback; derive order status from fills/cancellations/nonces plus current ownership and approvals.
+- Unit-test every branch and invariant; add fuzz/property tests for price splits, nonces, replay prevention, and arbitrary call ordering.
+- Exit: local end-to-end flow for listing purchase and offer acceptance; all contract tests green.
+
+### Week 3 — frontend, fork integration, and hardening
+
+- Implement collection browsing, ownership-aware actions, typed-signature prompts with human-readable terms, per-token approval, WETH balance/approval, cancellation, acceptance, ETH withdrawal, pending/confirmed states, and stale-order warnings.
+- Run Ethereum-mainnet-fork tests against the actual collection and canonical WETH: EOA and ERC-1271 makers, safe-transfer receivers, revoked approvals, changed owners, insufficient WETH, expired/cancelled/replayed orders, and reverting payout recipients.
+- Add static analysis, coverage gates, gas snapshots, API/indexer monitoring, structured logs, CSP and dependency scanning. Ensure frontend verifies chain ID and configured contract addresses.
+- Deploy to an Ethereum test environment or a mainnet fork for stakeholder acceptance; run the full vertical slice with production-shaped configuration.
+- Exit: release candidate and frozen feature set. Tag the exact audit commit; generate source/LOC report, dependency lockfile, test commands, deployment parameters, architecture diagram, invariants, and known-issues list for the auditor.
+
+### Week 4 — audit, fixes, and launch rehearsal
+
+- Auditor reviews the frozen commit described below. Engineering answers questions but makes no untracked changes to audit files.
+- Classify findings; fix critical/high/medium findings and agreed lows. Provide a fix commit/diff and tests for each finding; auditor performs a focused remediation review and issues a final report.
+- Re-run unit, fuzz, static, fork, frontend, and API tests. A reviewer independent of the implementer executes the launch checklist and adversarial end-to-end scenarios.
+- Rehearse deployment, verification, configuration, indexer start block, frontend release, and rollback/pause-of-frontend procedure. Contracts themselves have no pause/admin escape hatch.
+- Exit: final report has no unresolved critical/high findings, all accepted medium findings are fixed, deployment bytecode matches the audited build, and sign-off is recorded. If the audit cannot finish in the week, launch slips; audit scope is not compressed.
+
+## 4. Precise audit scope for quotation
+
+### In-scope artifacts
+
+The quote should assume **one non-upgradeable Solidity contract** (`CollectionMarketplace.sol`) plus only locally written helper/library code, targeting Solidity 0.8.x. Budget on approximately **350–500 non-comment Solidity source lines**; the final frozen-commit LOC report controls. Also in scope:
+
+- EIP-712 order encoding/domain separation and ECDSA/ERC-1271 validation;
+- fixed-price ETH listing settlement and WETH offer settlement;
+- ERC-721 approval/ownership and `safeTransferFrom` integration;
+- royalty calculation and rounding, ETH credit accounting/withdrawal, WETH transfers;
+- fill/cancel replay protection, individual cancellation, per-maker minimum nonce, expiry;
+- event correctness relative to state and transferred value;
+- constructor validation, immutables, access-control absence, and forced/unexpected ETH handling;
+- all custom Solidity libraries and modifications to vendored code;
+- deployment script and constructor arguments, including deterministic reproduction of deployed bytecode;
+- unit, fuzz/invariant, and mainnet-fork tests as evidence (tests are reviewed but test-only bugs are not protocol findings unless they hide a production defect); and
+- integration assumptions for the exact deployed collection, canonical mainnet WETH, and artist multisig.
+
+Provide the auditor: frozen Git commit and tag; compiler/settings and dependency lockfile; flattened sources only as a convenience; source LOC output; architecture/data-flow diagram; order schema and example signatures; invariants/threat model; roles/privileges statement; deployment script/config; test and coverage commands/results; fork block number/RPC requirements; known issues; and the verified collection/WETH ABI and addresses.
+
+### Required security properties
+
+The auditor should explicitly assess and report on these invariants:
+
+1. A successful fill transfers exactly the specified token once, and only with a valid unexpired maker signature bound to this chain, contract, collection, terms, and nonce.
+2. A listing can be filled only while its maker owns and has approved the token. An offer can be accepted only by the token’s current owner.
+3. For any successful sale of price `P`, artist entitlement is `floor(P * 250 / 10_000)` and seller entitlement is exactly `P - royalty`; no other party can capture value and accounting cannot create value.
+4. No order hash can fill twice; cancellation and minimum-nonce invalidation are irreversible for affected orders.
+5. Failed NFT/payment transfers revert the entire fill. Reentrancy cannot double-fill, alter credits, or withdraw twice.
+6. One reverting ETH recipient cannot block settlement or another recipient’s withdrawal; only the credited account can initiate spending its credit, though it may choose a recipient.
+7. The contract never takes custody of an NFT, holds no escrowed WETH, and exposes no privileged seizure, fee-change, or upgrade route.
+8. Malformed signatures, ERC-1271 behavior, zero/extreme values, rounding dust, forced ETH, stale approvals/ownership, chain-ID changes, and malicious ERC-721 receivers fail safely.
+
+Review techniques expected in the quote: manual line-by-line review, threat-model/invariant review, automated static analysis, review of fuzz/invariant coverage, and reproduction of mainnet-fork integration tests. Quote one initial report plus one remediation review of a bounded fix diff delivered within an agreed window.
+
+### Out of scope and assumptions
+
+Out of scope unless separately quoted:
+
+- the already deployed ERC-721 collection bytecode, canonical WETH bytecode, and artist multisig internals (their interfaces and integration behavior remain in scope);
+- third-party libraries used unmodified (verify correct version/configuration/integration, but do not re-audit their internals);
+- frontend, API, database, indexer, hosting, wallet software, DNS, CI/CD, cloud accounts, key management, phishing/social engineering, and denial-of-service against the relay;
+- marketplace economics, tax/legal compliance, wash trading, sanctions, creator-royalty enforcement on other venues, and compromised user keys;
+- auctions, bundles, partial fills, collection bids, ERC-1155, arbitrary NFTs/tokens, permits, meta-transactions, delegated wallets, cross-chain behavior, upgradeability, and post-launch changes; and
+- formal verification and production penetration testing.
+
+Assumptions the auditor must validate at integration boundaries: the collection is the expected ERC-721 and permits ordinary approved transfers; canonical WETH returns/reverts as expected; artist and collection addresses are nonzero and correctly checksummed; price is denominated in wei; the frontend/relay do not change signed data; makers can revoke validity by ownership/balance/allowance changes even if the offchain UI is stale.
+
+Any semantic contract change after the frozen audit commit—order fields/hashing, external surface, payment flow, fee logic, dependencies, compiler settings, or deployment configuration—requires auditor review of the diff and may require a re-audit. A production launch is blocked by unresolved critical/high findings and by unremediated medium findings unless the auditor and project sign a written, narrowly reasoned exception.
+
+## 5. Deployment and release runbook
+
+Before launch, replace placeholders with the verified values and commit them in a network config file:
+
+```text
+ETH_RPC_URL          Ethereum mainnet RPC (secret)
+DEPLOYER_KEY         funded hardware-backed deployment signer (secret; temporary use)
+ETHERSCAN_API_KEY    verification credential (secret)
+COLLECTION_ADDRESS   existing collection
+WETH_ADDRESS         canonical mainnet WETH from official source
+ARTIST_ADDRESS       production artist multisig
+```
+
+The repository README must contain executable commands matching the chosen framework. Expected Foundry-shaped runbook (adjust only if the team selects another framework in Week 1):
+
+```bash
+forge test
+forge test --fork-url "$ETH_RPC_URL"
+forge script script/Deploy.s.sol:Deploy --rpc-url "$ETH_RPC_URL" --broadcast --verify
+cast call "$MARKETPLACE_ADDRESS" "collection()(address)" --rpc-url "$ETH_RPC_URL"
+cast call "$MARKETPLACE_ADDRESS" "weth()(address)" --rpc-url "$ETH_RPC_URL"
+cast call "$MARKETPLACE_ADDRESS" "artist()(address)" --rpc-url "$ETH_RPC_URL"
+```
+
+Deployment controls:
+
+1. Use a clean audited tag; reproduce compiler output and confirm creation/runtime bytecode against the auditor’s artifact.
+2. Two people independently verify chain ID 1, deployer, collection, WETH, artist multisig, fixed 250 bps constant, gas parameters, and source verification arguments.
+3. Deploy and verify source on Etherscan. Because configuration is immutable and there is no owner role, record explicitly that there is no ownership transfer step; the artist payout destination is already the intended multisig.
+4. Configure the indexer from the deployment block and frontend with the verified address. Do not enable public order submission yet.
+5. Execute a low-value end-to-end canary using team-owned collection tokens: sign/list/buy with ETH, verify NFT ownership and exact credits, withdraw both credits, make/approve/accept a WETH offer, cancel another order, and verify replay rejection. This requires identifying team-owned tokens before launch; do not use a holder’s token.
+6. Have the independent reviewer compare receipts, balances, events, and UI/indexer state to expected values, then enable public order submission.
+7. Publish contract address, verified source, audit report, immutable fee/artist configuration, WETH-offer requirement, and user warnings about approvals and signed-order validity.
+
+Rollback is operational only: if a defect appears, disable the site’s order relay and warn users to cancel individual orders or increment their minimum nonce. The immutable contract cannot be paused or upgraded; already signed valid orders may remain executable until cancelled, invalidated, expired, or made invalid by revoking approval/ownership/balance/allowance. A replacement requires a newly audited deployment and frontend migration.

codex
Created [plan.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-28T143527Z-codex-with-skill-3/workspace/plan.md).

It covers:

- Non-custodial signed listings and WETH offers
- Immutable 2.5% artist royalty
- Minimal one-contract architecture
- Onchain/offchain boundaries
- State-transition callers and incentives
- Four-week delivery schedule
- Precise audit surface, invariants, assumptions, and exclusions
- Deployment, verification, canary, and incident runbooks

`git diff --check` passes.
diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..4db822094dfc5a9d4ed5b09cd684e4fa4b8c7968
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,202 @@
+# Four-week MVP plan: non-custodial NFT marketplace
+
+## 1. Product decisions and MVP boundary
+
+### Goal and acceptance criteria
+
+Ship a marketplace for the existing 5,000-token ERC-721 collection where:
+
+- An owner can advertise a token for a fixed ETH price without transferring it or approving a marketplace-wide custodian.
+- A buyer can purchase a still-valid listing atomically; the NFT moves directly from seller to buyer, 97.5% of the price goes to the seller, and 2.5% goes to the artist.
+- A buyer can make a WETH-denominated offer without escrow. The current owner can accept it later, atomically transferring the NFT and pulling WETH from the buyer, with the same split.
+- A signer can cancel an individual order or invalidate all their older orders.
+- No administrator can seize NFTs, redirect an existing order, change its price, or settle it without the required signatures and approvals.
+
+The launch chain is **Ethereum mainnet**, because the collection and its ownership/liquidity already live there. Bridging or wrapping the collection would fragment the market and violate the direct-resale goal. Mainnet gas is an accepted product constraint for this MVP; all browsing, indexing, and order creation remain offchain.
+
+### One-contract architecture
+
+Deploy one immutable `CollectionMarketplace` contract configured at construction with:
+
+- the existing ERC-721 collection address;
+- canonical Ethereum-mainnet WETH address, obtained from and checked against official verified deployment documentation during implementation;
+- the artist payout address (production multisig, not an EOA); and
+- a fixed royalty of 250 basis points out of 10,000.
+
+Do not add a factory, NFT escrow, fee splitter, upgrade proxy, governance token, auction, bidding currency list, or arbitrary-collection support. ETH listing purchases and WETH offers are the only payment paths. The contract is non-upgradeable and has no owner-only operational functions. Changing the artist address or fee requires a new deployment and explicit migration, eliminating a privileged fee-redirection surface.
+
+Listings and offers are EIP-712 typed signed orders stored in the application database/IPFS-free order relay, not contract storage. A signed order contains at least: order kind, maker, collection, token ID, payment token (`address(0)` for an ETH listing; WETH for an offer), price, expiration, and maker nonce. The EIP-712 domain binds signatures to chain ID and marketplace contract. An order hash can be filled only once or explicitly cancelled. A per-maker minimum nonce supports “cancel all older orders.” Expired orders need no onchain cleanup.
+
+For a listing purchase, the seller signs and the buyer submits `buy(...)` with exact ETH. For an offer, the buyer signs after holding WETH and approving the marketplace; the token’s current owner submits `acceptOffer(...)`. Offers cannot use native ETH because a contract cannot pull ETH from an absent buyer later without escrow; WETH preserves the non-custodial requirement through balance and allowance.
+
+Use pull-payment credits for ETH proceeds rather than pushing ETH during settlement: settlement credits seller and artist balances, and each recipient withdraws independently. This prevents a reverting recipient from blocking the NFT sale. For WETH offers, use `safeTransferFrom` directly from buyer to seller and artist in the same transaction; the canonical WETH behavior is covered by mainnet-fork tests. Apply `nonReentrant`, checks-effects-interactions, and mark an order filled before external calls.
+
+The seller must grant the marketplace token approval (`approve(tokenId)` or `setApprovalForAll`) before settlement, but the NFT remains in the seller’s wallet. The UI should recommend per-token approval. At execution, verify current ownership, approval, signature, nonce, expiry, collection/payment constraints, unfilled/uncancelled status, nonzero price, exact payment, and that the taker is not zero. Transfer with `safeTransferFrom` and intentionally require the buyer to be able to receive an ERC-721.
+
+### Onchain/offchain boundary
+
+Onchain:
+
+- signature verification, replay protection, cancellation, ownership/approval checks;
+- atomic NFT/payment settlement and the immutable 2.5%/97.5% split;
+- ETH withdrawal accounting; and
+- events sufficient to reconstruct fills and cancellations.
+
+Offchain:
+
+- signed-order relay/database, listing and offer APIs;
+- collection metadata, images, search, filtering, activity feed, floor price, and rankings;
+- chain event indexing and removal/marking of stale orders; and
+- wallet UI, transaction preparation, confirmations, and error explanations.
+
+The index is a convenience, not an authority: every fill is validated onchain. If the API/indexer is unavailable, already obtained signed orders remain executable directly against the contract.
+
+## 2. Contract surface and state transitions
+
+Expected public/external surface (names may change before the audit commit, semantics may not):
+
+```solidity
+constructor(address collection, address weth, address artist)
+buy(Order listing, bytes sellerSignature) external payable nonReentrant
+acceptOffer(Order offer, bytes buyerSignature) external nonReentrant
+cancelOrder(Order order) external
+incrementMinNonce() external
+withdrawETH(address payable recipient) external nonReentrant
+hashOrder(Order order) external view returns (bytes32)
+isOrderValid(Order order, bytes signature) external view returns (bool)
+```
+
+State is limited to immutable configuration, `filledOrCancelled[orderHash]`, `minNonce[maker]`, and `ethCredits[recipient]`. Emit `OrderFilled`, `OrderCancelled`, `MinNonceIncremented`, and `ETHWithdrawn` with indexed maker/token/order identifiers and amounts. Support EOAs through ECDSA and smart-contract wallets through ERC-1271 signature validation.
+
+| Transition | Caller | Why they pay gas | Safe outcome if nobody calls |
+| --- | --- | --- | --- |
+| Sign/publish listing or offer | Maker (offchain) | No gas; advertises sale or desired purchase | No order exists and nothing moves |
+| Approve NFT | Seller/current owner | Enables their desired eventual settlement | Order stays visible but cannot fill |
+| Approve WETH | Offer maker | Enables acceptance of their desired offer | Offer cannot be accepted |
+| `buy` | Buyer | Receives the listed NFT | Listing remains unfilled until expiry/cancellation/ownership change |
+| `acceptOffer` | Current owner | Receives 97.5% of offered WETH | Offer remains unfilled until expiry/cancellation/balance or allowance change |
+| `cancelOrder` | Maker | Removes a live signed order | Order remains fillable while otherwise valid |
+| `incrementMinNonce` | Maker | Invalidates many stale orders cheaply | Older signed orders remain valid individually |
+| `withdrawETH` | Credited seller or artist | Receives accrued ETH; recipient may be another address | Credit remains safely claimable indefinitely |
+
+There is no keeper or admin-dependent transition and no scheduled work.
+
+## 3. Four-week build plan
+
+### Week 1 — specification, UX, and skeleton
+
+- Confirm and checksum the collection, WETH, and artist multisig addresses; inspect the deployed ERC-721 for standard compliance and any transfer restrictions.
+- Freeze the EIP-712 `Order` schema, exact rounding rule (`royalty = price * 250 / 10_000`, seller receives the remainder), nonce rules, event schema, and revert/error catalogue.
+- Write invariants and threat model: replay/cross-chain replay, stale ownership, revoked approvals, signature malleability/ERC-1271, reentrancy, malicious receivers, fee rounding, forced ETH, and WETH allowance/balance changes.
+- Scaffold the non-upgradeable contract and tests. Build wireframes for browse, list, buy, offer, accept, cancel, and withdraw flows.
+- Exit: reviewed specification; addresses recorded with sources; compiling skeleton; no unresolved economic or privilege decisions.
+
+### Week 2 — contract and service vertical slice
+
+- Implement typed-order hashing/signature validation, fills, cancellations, nonce invalidation, ETH credits/withdrawals, WETH settlement, events, custom errors, and immutable configuration.
+- Build the order relay API with schema validation, signature recovery/1271-aware status checks, expiration, deduplication, and rate limiting. Never accept custody or private keys.
+- Build the event indexer with confirmation depth and reorg rollback; derive order status from fills/cancellations/nonces plus current ownership and approvals.
+- Unit-test every branch and invariant; add fuzz/property tests for price splits, nonces, replay prevention, and arbitrary call ordering.
+- Exit: local end-to-end flow for listing purchase and offer acceptance; all contract tests green.
+
+### Week 3 — frontend, fork integration, and hardening
+
+- Implement collection browsing, ownership-aware actions, typed-signature prompts with human-readable terms, per-token approval, WETH balance/approval, cancellation, acceptance, ETH withdrawal, pending/confirmed states, and stale-order warnings.
+- Run Ethereum-mainnet-fork tests against the actual collection and canonical WETH: EOA and ERC-1271 makers, safe-transfer receivers, revoked approvals, changed owners, insufficient WETH, expired/cancelled/replayed orders, and reverting payout recipients.
+- Add static analysis, coverage gates, gas snapshots, API/indexer monitoring, structured logs, CSP and dependency scanning. Ensure frontend verifies chain ID and configured contract addresses.
+- Deploy to an Ethereum test environment or a mainnet fork for stakeholder acceptance; run the full vertical slice with production-shaped configuration.
+- Exit: release candidate and frozen feature set. Tag the exact audit commit; generate source/LOC report, dependency lockfile, test commands, deployment parameters, architecture diagram, invariants, and known-issues list for the auditor.
+
+### Week 4 — audit, fixes, and launch rehearsal
+
+- Auditor reviews the frozen commit described below. Engineering answers questions but makes no untracked changes to audit files.
+- Classify findings; fix critical/high/medium findings and agreed lows. Provide a fix commit/diff and tests for each finding; auditor performs a focused remediation review and issues a final report.
+- Re-run unit, fuzz, static, fork, frontend, and API tests. A reviewer independent of the implementer executes the launch checklist and adversarial end-to-end scenarios.
+- Rehearse deployment, verification, configuration, indexer start block, frontend release, and rollback/pause-of-frontend procedure. Contracts themselves have no pause/admin escape hatch.
+- Exit: final report has no unresolved critical/high findings, all accepted medium findings are fixed, deployment bytecode matches the audited build, and sign-off is recorded. If the audit cannot finish in the week, launch slips; audit scope is not compressed.
+
+## 4. Precise audit scope for quotation
+
+### In-scope artifacts
+
+The quote should assume **one non-upgradeable Solidity contract** (`CollectionMarketplace.sol`) plus only locally written helper/library code, targeting Solidity 0.8.x. Budget on approximately **350–500 non-comment Solidity source lines**; the final frozen-commit LOC report controls. Also in scope:
+
+- EIP-712 order encoding/domain separation and ECDSA/ERC-1271 validation;
+- fixed-price ETH listing settlement and WETH offer settlement;
+- ERC-721 approval/ownership and `safeTransferFrom` integration;
+- royalty calculation and rounding, ETH credit accounting/withdrawal, WETH transfers;
+- fill/cancel replay protection, individual cancellation, per-maker minimum nonce, expiry;
+- event correctness relative to state and transferred value;
+- constructor validation, immutables, access-control absence, and forced/unexpected ETH handling;
+- all custom Solidity libraries and modifications to vendored code;
+- deployment script and constructor arguments, including deterministic reproduction of deployed bytecode;
+- unit, fuzz/invariant, and mainnet-fork tests as evidence (tests are reviewed but test-only bugs are not protocol findings unless they hide a production defect); and
+- integration assumptions for the exact deployed collection, canonical mainnet WETH, and artist multisig.
+
+Provide the auditor: frozen Git commit and tag; compiler/settings and dependency lockfile; flattened sources only as a convenience; source LOC output; architecture/data-flow diagram; order schema and example signatures; invariants/threat model; roles/privileges statement; deployment script/config; test and coverage commands/results; fork block number/RPC requirements; known issues; and the verified collection/WETH ABI and addresses.
+
+### Required security properties
+
+The auditor should explicitly assess and report on these invariants:
+
+1. A successful fill transfers exactly the specified token once, and only with a valid unexpired maker signature bound to this chain, contract, collection, terms, and nonce.
+2. A listing can be filled only while its maker owns and has approved the token. An offer can be accepted only by the token’s current owner.
+3. For any successful sale of price `P`, artist entitlement is `floor(P * 250 / 10_000)` and seller entitlement is exactly `P - royalty`; no other party can capture value and accounting cannot create value.
+4. No order hash can fill twice; cancellation and minimum-nonce invalidation are irreversible for affected orders.
+5. Failed NFT/payment transfers revert the entire fill. Reentrancy cannot double-fill, alter credits, or withdraw twice.
+6. One reverting ETH recipient cannot block settlement or another recipient’s withdrawal; only the credited account can initiate spending its credit, though it may choose a recipient.
+7. The contract never takes custody of an NFT, holds no escrowed WETH, and exposes no privileged seizure, fee-change, or upgrade route.
+8. Malformed signatures, ERC-1271 behavior, zero/extreme values, rounding dust, forced ETH, stale approvals/ownership, chain-ID changes, and malicious ERC-721 receivers fail safely.
+
+Review techniques expected in the quote: manual line-by-line review, threat-model/invariant review, automated static analysis, review of fuzz/invariant coverage, and reproduction of mainnet-fork integration tests. Quote one initial report plus one remediation review of a bounded fix diff delivered within an agreed window.
+
+### Out of scope and assumptions
+
+Out of scope unless separately quoted:
+
+- the already deployed ERC-721 collection bytecode, canonical WETH bytecode, and artist multisig internals (their interfaces and integration behavior remain in scope);
+- third-party libraries used unmodified (verify correct version/configuration/integration, but do not re-audit their internals);
+- frontend, API, database, indexer, hosting, wallet software, DNS, CI/CD, cloud accounts, key management, phishing/social engineering, and denial-of-service against the relay;
+- marketplace economics, tax/legal compliance, wash trading, sanctions, creator-royalty enforcement on other venues, and compromised user keys;
+- auctions, bundles, partial fills, collection bids, ERC-1155, arbitrary NFTs/tokens, permits, meta-transactions, delegated wallets, cross-chain behavior, upgradeability, and post-launch changes; and
+- formal verification and production penetration testing.
+
+Assumptions the auditor must validate at integration boundaries: the collection is the expected ERC-721 and permits ordinary approved transfers; canonical WETH returns/reverts as expected; artist and collection addresses are nonzero and correctly checksummed; price is denominated in wei; the frontend/relay do not change signed data; makers can revoke validity by ownership/balance/allowance changes even if the offchain UI is stale.
+
+Any semantic contract change after the frozen audit commit—order fields/hashing, external surface, payment flow, fee logic, dependencies, compiler settings, or deployment configuration—requires auditor review of the diff and may require a re-audit. A production launch is blocked by unresolved critical/high findings and by unremediated medium findings unless the auditor and project sign a written, narrowly reasoned exception.
+
+## 5. Deployment and release runbook
+
+Before launch, replace placeholders with the verified values and commit them in a network config file:
+
+```text
+ETH_RPC_URL          Ethereum mainnet RPC (secret)
+DEPLOYER_KEY         funded hardware-backed deployment signer (secret; temporary use)
+ETHERSCAN_API_KEY    verification credential (secret)
+COLLECTION_ADDRESS   existing collection
+WETH_ADDRESS         canonical mainnet WETH from official source
+ARTIST_ADDRESS       production artist multisig
+```
+
+The repository README must contain executable commands matching the chosen framework. Expected Foundry-shaped runbook (adjust only if the team selects another framework in Week 1):
+
+```bash
+forge test
+forge test --fork-url "$ETH_RPC_URL"
+forge script script/Deploy.s.sol:Deploy --rpc-url "$ETH_RPC_URL" --broadcast --verify
+cast call "$MARKETPLACE_ADDRESS" "collection()(address)" --rpc-url "$ETH_RPC_URL"
+cast call "$MARKETPLACE_ADDRESS" "weth()(address)" --rpc-url "$ETH_RPC_URL"
+cast call "$MARKETPLACE_ADDRESS" "artist()(address)" --rpc-url "$ETH_RPC_URL"
+```
+
+Deployment controls:
+
+1. Use a clean audited tag; reproduce compiler output and confirm creation/runtime bytecode against the auditor’s artifact.
+2. Two people independently verify chain ID 1, deployer, collection, WETH, artist multisig, fixed 250 bps constant, gas parameters, and source verification arguments.
+3. Deploy and verify source on Etherscan. Because configuration is immutable and there is no owner role, record explicitly that there is no ownership transfer step; the artist payout destination is already the intended multisig.
+4. Configure the indexer from the deployment block and frontend with the verified address. Do not enable public order submission yet.
+5. Execute a low-value end-to-end canary using team-owned collection tokens: sign/list/buy with ETH, verify NFT ownership and exact credits, withdraw both credits, make/approve/accept a WETH offer, cancel another order, and verify replay rejection. This requires identifying team-owned tokens before launch; do not use a holder’s token.
+6. Have the independent reviewer compare receipts, balances, events, and UI/indexer state to expected values, then enable public order submission.
+7. Publish contract address, verified source, audit report, immutable fee/artist configuration, WETH-offer requirement, and user warnings about approvals and signed-order validity.
+
+Rollback is operational only: if a defect appears, disable the site’s order relay and warn users to cancel individual orders or increment their minimum nonce. The immutable contract cannot be paused or upgraded; already signed valid orders may remain executable until cancelled, invalidated, expired, or made invalid by revoking approval/ownership/balance/allowance. A replacement requires a newly audited deployment and frontend migration.

tokens used
37,222
Created [plan.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-28T143527Z-codex-with-skill-3/workspace/plan.md).

It covers:

- Non-custodial signed listings and WETH offers
- Immutable 2.5% artist royalty
- Minimal one-contract architecture
- Onchain/offchain boundaries
- State-transition callers and incentives
- Four-week delivery schedule
- Precise audit surface, invariants, assumptions, and exclusions
- Deployment, verification, canary, and incident runbooks

`git diff --check` passes.
