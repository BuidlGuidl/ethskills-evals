OpenAI Codex v0.150.1
--------
workdir: /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-28T143527Z-codex-with-skill-2/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a048cc-10c8-7931-8b64-22d71e2383a1
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

2026-08-28T14:35:28.572733Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a048cc-10c8-7931-8b64-22d71e2383a1.tmp-1787927728330958572: line 2547: syntax error near unexpected token `('

codex
I’m using the `ship` skill because this request needs the marketplace boundary, contract surface, incentives, launch chain, and release runbook fixed before implementation. I’ll inspect its instructions and the workspace, then write `plan.md`.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/ship/SKILL.md && printf '\\nFILES\\n' && rg --files -g 'AGENTS.md' -g '"'!node_modules'"' | head -50" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-28T143527Z-codex-with-skill-2/workspace
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

FILES

codex
The smallest defensible MVP is one custom, collection-specific exchange contract on Ethereum mainnet. Listings are signed offchain and settled atomically in ETH; offers are signed offchain and settled atomically in WETH, so neither NFTs nor offer funds enter marketplace escrow. I’m making the royalty an enforced settlement split, not a UI convention.
apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-28T143527Z-codex-with-skill-2/workspace/plan.md
diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..b17a28e6a5530dccabfc7cb3b946246174b1033f
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,163 @@
+# Four-week MVP plan: collection marketplace
+
+## Product decision and assumptions
+
+Ship a collection-specific, fixed-price secondary marketplace for the existing 5,000-token ERC-721 collection on **Ethereum mainnet**. This keeps settlement beside the collection and its existing holders/liquidity and avoids a bridge or wrapped representation.
+
+The MVP uses one immutable `CollectionExchange` contract. It enforces a 2.5% artist fee on every sale it settles. NFTs remain in their owners' wallets until an atomic sale. Listings are EIP-712 signatures stored/indexed offchain and paid in native ETH. Offers are EIP-712 signatures paid in canonical mainnet WETH using the buyer's balance and allowance; WETH is not deposited in the exchange. An offer can therefore become unfillable if the buyer spends the WETH or revokes allowance—this is intentional non-custodial behavior and must be shown in the UI.
+
+Before implementation, record and verify these inputs:
+
+- collection contract address and confirmation that it behaves as ERC-721 (`ownerOf`, approvals, `safeTransferFrom`);
+- artist royalty recipient, preferably a Safe multisig, and its acceptance of the role;
+- canonical Ethereum mainnet WETH address from official WETH/deployment documentation (never infer it);
+- whether smart-contract-wallet signatures (ERC-1271) are required. This plan includes them;
+- whether the collection has transfer restrictions, staking wrappers, or an existing ERC-2981 policy. The MVP fee remains exactly 250 basis points regardless of ERC-2981 output.
+
+Out of scope: auctions, collection-wide offers, traits-based offers, multiple currencies, partial fills, bundles, primary minting, custody, fiat/on-ramp, cross-chain support, fee configurability, upgradeability, platform fees, royalties on sales outside this exchange, and moderation/dispute reversal. “Every resale” means every resale settled through this contract; no contract can force unrelated peer-to-peer transfers or external marketplaces to pay this fee unless the NFT itself already restricts transfers.
+
+## Onchain and offchain boundary
+
+Onchain responsibilities are signature and order validation, replay/cancellation state, payment splitting, and atomic ERC-721 transfer. The contract is non-upgradeable and has no owner-only operational powers, pause switch, withdrawal function, proxy, custody ledger, or fee setter. Constructor immutables are the collection, WETH, artist recipient, and `feeBps = 250`; denominator is 10,000.
+
+Offchain services store signed listings/offers and cancellation metadata, index contract events, check current ownership/approvals/balances/allowances, and serve browsing, search, filtering, images, and status. They are convenience and discovery only: a buyer or seller can submit a valid signed order directly to the contract. The database never decides settlement validity. The API must treat chain state as authoritative and mark stale/unfillable orders rather than deleting their history.
+
+## Minimal contract surface
+
+Use OpenZeppelin's pinned, audited `EIP712`, `SignatureChecker`, `ReentrancyGuard`, `SafeERC20`, and ERC-721 interfaces. Pin the compiler and dependency commit/release in the repository and audit manifest.
+
+`Listing` signed data:
+
+```solidity
+address seller;
+uint256 tokenId;
+uint256 price;       // wei, nonzero
+uint256 nonce;       // maker-selected unique nonce
+uint256 deadline;    // inclusive timestamp
+```
+
+`Offer` signed data:
+
+```solidity
+address buyer;
+uint256 tokenId;
+uint256 price;       // WETH units, nonzero
+uint256 nonce;
+uint256 deadline;
+```
+
+The EIP-712 domain includes contract name/version, chain ID, and verifying contract. The order type/hash must distinguish listing from offer. No arbitrary NFT, currency, recipient, calldata, or fee fields are signed.
+
+Public/external functions:
+
+- `buy(Listing order, bytes signature) external payable nonReentrant`: require exact `msg.value == price`, live deadline, valid seller signature (EOA or ERC-1271), unused/uncancelled order hash, current `ownerOf(tokenId) == seller`, and exchange approval. Mark filled before interactions; transfer the NFT to `msg.sender`; pay `price * 250 / 10_000` to the immutable artist recipient and the remainder to seller. Any failed leg reverts the whole sale. Document the exact transfer order selected during implementation and test it adversarially.
+- `acceptOffer(Offer order, bytes signature) external nonReentrant`: require caller is the current token owner, live deadline, valid buyer signature, unused/uncancelled order hash, and exchange approval; mark filled before interactions; pull the royalty and seller proceeds directly from buyer using WETH `transferFrom`, then transfer the NFT to the caller-selected recipient policy. For the MVP the NFT recipient is exactly `buyer`, and proceeds go exactly to `msg.sender`. Any failed leg reverts atomically.
+- `cancel(bytes32 orderHash) external`: only the maker recovered/identified from the complete supplied order should be able to cancel. To avoid an ambiguous bare hash API, implementation should instead expose typed `cancelListing(Listing)` and `cancelOffer(Offer)`, recompute the hash, and require `msg.sender` equals the order maker. Cancellation is idempotent or reverts with a documented custom error.
+- `incrementNonce() external`: invalidates all of the caller's orders whose signed nonce is below the new maker nonce. Prefer a strictly increasing `minNonce[msg.sender]`; individual cancellation remains available.
+- pure/view helpers: `hashListing`, `hashOffer`, `isCancelledOrFilled`, current `minNonce`, `feeAmount`, and EIP-712 domain introspection where supported.
+
+Storage is limited to used/cancelled order hashes and each maker's minimum nonce. Emit `ListingFilled`, `OfferFilled`, `OrderCancelled`, and `MinNonceIncremented`, each with indexed order hash, token ID, buyer, and seller as applicable, plus gross price and artist fee on fills. Signed-order publication is not an onchain event.
+
+Important implementation decisions to freeze before audit:
+
+- native ETH payout uses checked low-level calls and reverts atomically if either recipient rejects ETH; the UI warns contract-wallet sellers/artist recipients;
+- fee rounding is `floor(price * 250 / 10_000)`, seller receives `price - fee`, and tests cover dust prices and overflow-safe calculation;
+- an order becomes consumed before any external token/payment call and stays consumed only if the transaction succeeds;
+- `buy` cannot choose an NFT recipient, and `acceptOffer` sends only to the signed buyer, preventing unintended redirection;
+- no relayed seller acceptance in the MVP; the current owner calls `acceptOffer` and pays gas;
+- ERC-721 receiver behavior, WETH return behavior, signature malleability, chain/domain replay, reentrancy, self-purchase, expired orders, transferred-then-returned tokens, and nonce boundary semantics are explicitly tested.
+
+## State transitions and incentives
+
+| Transition | Caller | Why they pay gas | Safe outcome if nobody calls |
+| --- | --- | --- | --- |
+| Publish listing/offer signature | Seller/buyer via site (offchain) | No gas; creates a discoverable order | No order is available |
+| `buy` | Buyer | Receives the NFT at the signed price | Listing remains unfilled until expiry/cancellation or becomes stale |
+| `acceptOffer` | Current NFT owner | Receives WETH proceeds | Offer remains unfilled until expiry/cancellation or becomes unfillable |
+| Cancel one order | Order maker | Removes an unwanted signed order | Order remains fillable while otherwise valid |
+| Raise minimum nonce | Order maker | Cancels a group of old orders | Old orders remain individually valid |
+| Approve exchange for NFT | Owner | Enables a desired sale | Settlement reverts; NFT remains with owner |
+| Approve WETH / acquire WETH | Offer maker | Enables their offer to settle | Acceptance reverts; WETH and NFT remain where they are |
+
+There are no scheduled transitions, keepers, admin crons, or stranded marketplace funds to claim.
+
+## Four-week build plan
+
+### Week 1 — specification and contract skeleton
+
+- Confirm the four immutable addresses/values and inspect the deployed collection on a mainnet fork, including transfer behavior and approval paths.
+- Freeze EIP-712 schemas, cancellation/nonce semantics, fee rounding, ETH/WETH payout ordering, custom errors, and events in a short protocol specification.
+- Implement the non-upgradeable contract and deployment script with pinned Solidity/OpenZeppelin/toolchain versions.
+- Add unit tests for happy paths and every validation branch. Generate shared signature test vectors for Solidity and the web client.
+- Deliverable: compiling contract, ABI, protocol spec, transition table, and initial test report.
+
+### Week 2 — adversarial tests and vertical slice
+
+- Add fuzz/property tests: conservation of gross price, exact 2.5% floor split, at-most-once fill, cancellation monotonicity, only-current-owner acceptance, and no successful partial settlement.
+- Add malicious ERC-721 receiver, reverting payee, reentrant recipient, ERC-1271 wallet, malformed signature, and unusual ERC-20 return-path tests as applicable.
+- Run mainnet-fork integration tests against the exact collection and WETH addresses. Test ownership changes, approvals revoked, WETH spent, simultaneous fill attempts, expiry boundaries, and transferred-away/transferred-back NFTs.
+- Build the API/indexer for signed-order submission, signature verification, event ingestion, reorg-safe confirmation, and periodic fillability refresh.
+- Deliverable: end-to-end local/fork flow for list, buy, offer, accept, cancel, and bulk invalidate.
+
+### Week 3 — site, operations, and audit handoff
+
+- Build collection grid/detail pages and wallet flows. Show gross price, artist fee, seller proceeds, currency, expiry, approval transaction, and gas as separate confirmations.
+- Clearly label stale/unfillable offers and listings; recheck immediately before wallet submission. Prevent API publication of invalid signatures but never imply the API is the source of truth.
+- Add monitoring for fill/cancel events, indexer lag/reorgs, RPC health, failed transaction spikes, and unexpected contract ETH/WETH balances (which should remain zero apart from forced ETH).
+- Freeze the commit and provide the auditor the exact scope below, dependency lockfiles, deployed-address assumptions, diagrams, specs, tests, coverage/fuzz settings, known issues, and reproducible commands.
+- Deliverable: feature-complete release candidate; no feature changes after audit freeze except separately reviewed fixes.
+
+### Week 4 — audit fixes, rehearsal, and launch
+
+- Triage findings by severity, fix in-scope code, add regression tests for every accepted finding, and send one bounded remediation commit/diff for auditor verification.
+- Have a fresh reviewer run the complete user journey on a mainnet fork and then on the chosen pre-production environment with production configuration.
+- Rehearse deployment from a clean checkout, verify bytecode/source, validate immutables and EIP-712 domain, and execute a small end-to-end transaction after deployment.
+- Deploy to Ethereum mainnet, verify source, compare runtime bytecode and constructor arguments, publish address/ABI, configure the indexer/site, and perform a low-value controlled listing purchase and WETH offer acceptance.
+- Launch only if the auditor has cleared critical/high findings, all tests pass at the frozen commit, monitoring is live, and rollback for the site/indexer is rehearsed. The immutable exchange cannot be patched; a contract issue means stop linking new orders in the UI, warn users, and deploy/audit a replacement. Existing signed orders are domain-bound to the old address.
+
+## Precise audit scope for quotation
+
+The quote should cover one Solidity exchange contract, its directly inherited/library code as compiled, and contract-facing tests/deployment configuration—not the NFT collection itself or a general audit of OpenZeppelin/WETH.
+
+### In-scope artifacts
+
+Provide exact paths and frozen commit hash once the repository exists:
+
+1. `src/CollectionExchange.sol` (expected approximately 250–400 non-comment Solidity lines).
+2. Any local Solidity interfaces/libraries imported by it; no unlisted local code may enter deployed bytecode.
+3. Exact pinned OpenZeppelin contracts reached by the import graph: EIP-712/domain handling, `SignatureChecker`/ECDSA/ERC-1271, `ReentrancyGuard`, `SafeERC20`, and ERC-721/ERC-20 interfaces. Review is integration/misuse-focused; note library version and commit.
+4. Deployment script and constructor/config validation for collection, WETH, artist recipient, 250 bps fee, chain ID, compiler settings, optimizer, and EVM target.
+5. Contract tests, fuzz/invariant harnesses, signature fixtures, and mainnet-fork tests insofar as they demonstrate intended security properties.
+6. The protocol specification, state-transition table, threat model, and this scope document as normative intent.
+
+The auditor should quote separately for initial review and one remediation review of a bounded diff. Require a report with severity, exploit scenario, affected lines, recommendation, status, and the frozen commit hash; request disclosure of methodology, reviewer-days, and whether tests/fuzzing are run or extended.
+
+### Security properties and attack surfaces to assess
+
+- Only a valid, unexpired, domain-bound maker authorization can fill an order; EOA and ERC-1271 validation cannot be confused, replayed across order types/chains/contracts, or malleated.
+- An order can settle at most once. Individual cancellation and minimum-nonce invalidation cannot be bypassed, grief another maker, collide across types, or create off-by-one validity.
+- Seller/current-owner/approval checks are correct at execution time, including ownership changing away and back; an offer cannot be accepted by a former owner or redirect NFT/proceeds.
+- Gross payment is conserved exactly: artist gets `floor(gross * 250 / 10_000)`, seller gets the remainder, no platform/admin captures value, and zero/dust/maximum values behave safely.
+- Listing settlement accepts exactly the signed ETH amount and cannot retain accidental overpayment. Offer settlement pulls only the signed WETH amount from the signed buyer and cannot spend an unlimited allowance beyond that order.
+- NFT and both payment legs are atomic under all revert/reentrancy/token-callback cases; checks-effects-interactions and guards prevent double fills, stale-state use, and callback manipulation.
+- External-call assumptions are safe for the exact deployed collection, canonical WETH, artist recipient, EOAs, Safe/ERC-1271 wallets, ERC-721 receivers, reverting recipients, and forced ETH. Confirm there is no reachable withdrawal or trapped-fund expectation.
+- Typed-data encoding matches the client fixtures exactly; field omission, type confusion, hash collision, ambiguous packed encoding, deadline boundary, chain fork, and signature replay risks are covered.
+- Denial-of-service and griefing are assessed: rejecting ETH recipient, artist recipient behavior, revoked approvals, insufficient WETH, gas-heavy ERC-1271 checks, front-running, competing fills, self-trades, and cancellation/fill ordering.
+- Immutability and deployment are verified: no proxy/admin backdoor, correct constructor validation, correct mainnet addresses and code hashes, reproducible bytecode, verified source, and correct EIP-712 domain after deployment.
+- Events faithfully represent settlement/cancellation for a reorg-aware indexer and do not allow event-only state to diverge from contract truth.
+
+### Explicitly out of scope for the contract audit
+
+- The already-deployed NFT's source code, metadata/media, rarity, provenance, and any vulnerabilities intrinsic to it, except black-box integration behavior tested on a fork.
+- Canonical WETH and OpenZeppelin internals as standalone codebases, except whether pinned versions are appropriate and used correctly.
+- Web UI, API, database, indexer availability/reorg logic, wallet/RPC providers, DNS/hosting, analytics, and social engineering. A separate application security review should cover order-substitution/phishing, XSS, API abuse, signature presentation, dependency/supply-chain security, secrets, and deployment access.
+- Economic appraisal, wash trading, tax/securities advice, sanctions compliance, marketplace terms, and the enforceability of royalties outside this contract.
+- Features listed as out of MVP scope and any code or configuration changed after the frozen audit commit. Such changes require auditor confirmation or a new scope.
+
+## Deployment and verification runbook requirements
+
+The implementation README must replace placeholders with exact, executable commands for a clean install, tests, fork tests, deployment simulation, mainnet deployment, and source verification. It must list environment variables without committing secrets: mainnet RPC URL, deployer key or hardware-wallet/Safe flow, block explorer API key, collection address, WETH address, and artist recipient.
+
+Before broadcast, independently verify chain ID 1, deployer balance, all constructor addresses and their code, artist multisig owners/threshold, compiler/optimizer settings, clean Git status, passing tests, audit commit, and simulated bytecode. Deploy from a dedicated deployer; because the contract has no admin role, ownership transfer is not applicable. Verify the source and constructor arguments, compare deployed runtime bytecode, inspect immutables/domain separator, and publish the canonical address.
+
+Post-deploy, use low-value tokens/prices approved by their owners to execute: listing signature → buy → royalty/proceeds balance checks; offer signature with exact WETH approval → owner acceptance → balance/ownership checks; individual cancellation; and minimum-nonce invalidation. Confirm emitted events, indexer ingestion after the chosen confirmation depth, zero marketplace token balances, site links/domain, monitoring alerts, and a public support/incident channel. Keep the old Discord manual process read-only during the controlled rollout and never ask users to sign opaque typed data.

diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..b17a28e6a5530dccabfc7cb3b946246174b1033f
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,163 @@
+# Four-week MVP plan: collection marketplace
+
+## Product decision and assumptions
+
+Ship a collection-specific, fixed-price secondary marketplace for the existing 5,000-token ERC-721 collection on **Ethereum mainnet**. This keeps settlement beside the collection and its existing holders/liquidity and avoids a bridge or wrapped representation.
+
+The MVP uses one immutable `CollectionExchange` contract. It enforces a 2.5% artist fee on every sale it settles. NFTs remain in their owners' wallets until an atomic sale. Listings are EIP-712 signatures stored/indexed offchain and paid in native ETH. Offers are EIP-712 signatures paid in canonical mainnet WETH using the buyer's balance and allowance; WETH is not deposited in the exchange. An offer can therefore become unfillable if the buyer spends the WETH or revokes allowance—this is intentional non-custodial behavior and must be shown in the UI.
+
+Before implementation, record and verify these inputs:
+
+- collection contract address and confirmation that it behaves as ERC-721 (`ownerOf`, approvals, `safeTransferFrom`);
+- artist royalty recipient, preferably a Safe multisig, and its acceptance of the role;
+- canonical Ethereum mainnet WETH address from official WETH/deployment documentation (never infer it);
+- whether smart-contract-wallet signatures (ERC-1271) are required. This plan includes them;
+- whether the collection has transfer restrictions, staking wrappers, or an existing ERC-2981 policy. The MVP fee remains exactly 250 basis points regardless of ERC-2981 output.
+
+Out of scope: auctions, collection-wide offers, traits-based offers, multiple currencies, partial fills, bundles, primary minting, custody, fiat/on-ramp, cross-chain support, fee configurability, upgradeability, platform fees, royalties on sales outside this exchange, and moderation/dispute reversal. “Every resale” means every resale settled through this contract; no contract can force unrelated peer-to-peer transfers or external marketplaces to pay this fee unless the NFT itself already restricts transfers.
+
+## Onchain and offchain boundary
+
+Onchain responsibilities are signature and order validation, replay/cancellation state, payment splitting, and atomic ERC-721 transfer. The contract is non-upgradeable and has no owner-only operational powers, pause switch, withdrawal function, proxy, custody ledger, or fee setter. Constructor immutables are the collection, WETH, artist recipient, and `feeBps = 250`; denominator is 10,000.
+
+Offchain services store signed listings/offers and cancellation metadata, index contract events, check current ownership/approvals/balances/allowances, and serve browsing, search, filtering, images, and status. They are convenience and discovery only: a buyer or seller can submit a valid signed order directly to the contract. The database never decides settlement validity. The API must treat chain state as authoritative and mark stale/unfillable orders rather than deleting their history.
+
+## Minimal contract surface
+
+Use OpenZeppelin's pinned, audited `EIP712`, `SignatureChecker`, `ReentrancyGuard`, `SafeERC20`, and ERC-721 interfaces. Pin the compiler and dependency commit/release in the repository and audit manifest.
+
+`Listing` signed data:
+
+```solidity
+address seller;
+uint256 tokenId;
+uint256 price;       // wei, nonzero
+uint256 nonce;       // maker-selected unique nonce
+uint256 deadline;    // inclusive timestamp
+```
+
+`Offer` signed data:
+
+```solidity
+address buyer;
+uint256 tokenId;
+uint256 price;       // WETH units, nonzero
+uint256 nonce;
+uint256 deadline;
+```
+
+The EIP-712 domain includes contract name/version, chain ID, and verifying contract. The order type/hash must distinguish listing from offer. No arbitrary NFT, currency, recipient, calldata, or fee fields are signed.
+
+Public/external functions:
+
+- `buy(Listing order, bytes signature) external payable nonReentrant`: require exact `msg.value == price`, live deadline, valid seller signature (EOA or ERC-1271), unused/uncancelled order hash, current `ownerOf(tokenId) == seller`, and exchange approval. Mark filled before interactions; transfer the NFT to `msg.sender`; pay `price * 250 / 10_000` to the immutable artist recipient and the remainder to seller. Any failed leg reverts the whole sale. Document the exact transfer order selected during implementation and test it adversarially.
+- `acceptOffer(Offer order, bytes signature) external nonReentrant`: require caller is the current token owner, live deadline, valid buyer signature, unused/uncancelled order hash, and exchange approval; mark filled before interactions; pull the royalty and seller proceeds directly from buyer using WETH `transferFrom`, then transfer the NFT to the caller-selected recipient policy. For the MVP the NFT recipient is exactly `buyer`, and proceeds go exactly to `msg.sender`. Any failed leg reverts atomically.
+- `cancel(bytes32 orderHash) external`: only the maker recovered/identified from the complete supplied order should be able to cancel. To avoid an ambiguous bare hash API, implementation should instead expose typed `cancelListing(Listing)` and `cancelOffer(Offer)`, recompute the hash, and require `msg.sender` equals the order maker. Cancellation is idempotent or reverts with a documented custom error.
+- `incrementNonce() external`: invalidates all of the caller's orders whose signed nonce is below the new maker nonce. Prefer a strictly increasing `minNonce[msg.sender]`; individual cancellation remains available.
+- pure/view helpers: `hashListing`, `hashOffer`, `isCancelledOrFilled`, current `minNonce`, `feeAmount`, and EIP-712 domain introspection where supported.
+
+Storage is limited to used/cancelled order hashes and each maker's minimum nonce. Emit `ListingFilled`, `OfferFilled`, `OrderCancelled`, and `MinNonceIncremented`, each with indexed order hash, token ID, buyer, and seller as applicable, plus gross price and artist fee on fills. Signed-order publication is not an onchain event.
+
+Important implementation decisions to freeze before audit:
+
+- native ETH payout uses checked low-level calls and reverts atomically if either recipient rejects ETH; the UI warns contract-wallet sellers/artist recipients;
+- fee rounding is `floor(price * 250 / 10_000)`, seller receives `price - fee`, and tests cover dust prices and overflow-safe calculation;
+- an order becomes consumed before any external token/payment call and stays consumed only if the transaction succeeds;
+- `buy` cannot choose an NFT recipient, and `acceptOffer` sends only to the signed buyer, preventing unintended redirection;
+- no relayed seller acceptance in the MVP; the current owner calls `acceptOffer` and pays gas;
+- ERC-721 receiver behavior, WETH return behavior, signature malleability, chain/domain replay, reentrancy, self-purchase, expired orders, transferred-then-returned tokens, and nonce boundary semantics are explicitly tested.
+
+## State transitions and incentives
+
+| Transition | Caller | Why they pay gas | Safe outcome if nobody calls |
+| --- | --- | --- | --- |
+| Publish listing/offer signature | Seller/buyer via site (offchain) | No gas; creates a discoverable order | No order is available |
+| `buy` | Buyer | Receives the NFT at the signed price | Listing remains unfilled until expiry/cancellation or becomes stale |
+| `acceptOffer` | Current NFT owner | Receives WETH proceeds | Offer remains unfilled until expiry/cancellation or becomes unfillable |
+| Cancel one order | Order maker | Removes an unwanted signed order | Order remains fillable while otherwise valid |
+| Raise minimum nonce | Order maker | Cancels a group of old orders | Old orders remain individually valid |
+| Approve exchange for NFT | Owner | Enables a desired sale | Settlement reverts; NFT remains with owner |
+| Approve WETH / acquire WETH | Offer maker | Enables their offer to settle | Acceptance reverts; WETH and NFT remain where they are |
+
+There are no scheduled transitions, keepers, admin crons, or stranded marketplace funds to claim.
+
+## Four-week build plan
+
+### Week 1 — specification and contract skeleton
+
+- Confirm the four immutable addresses/values and inspect the deployed collection on a mainnet fork, including transfer behavior and approval paths.
+- Freeze EIP-712 schemas, cancellation/nonce semantics, fee rounding, ETH/WETH payout ordering, custom errors, and events in a short protocol specification.
+- Implement the non-upgradeable contract and deployment script with pinned Solidity/OpenZeppelin/toolchain versions.
+- Add unit tests for happy paths and every validation branch. Generate shared signature test vectors for Solidity and the web client.
+- Deliverable: compiling contract, ABI, protocol spec, transition table, and initial test report.
+
+### Week 2 — adversarial tests and vertical slice
+
+- Add fuzz/property tests: conservation of gross price, exact 2.5% floor split, at-most-once fill, cancellation monotonicity, only-current-owner acceptance, and no successful partial settlement.
+- Add malicious ERC-721 receiver, reverting payee, reentrant recipient, ERC-1271 wallet, malformed signature, and unusual ERC-20 return-path tests as applicable.
+- Run mainnet-fork integration tests against the exact collection and WETH addresses. Test ownership changes, approvals revoked, WETH spent, simultaneous fill attempts, expiry boundaries, and transferred-away/transferred-back NFTs.
+- Build the API/indexer for signed-order submission, signature verification, event ingestion, reorg-safe confirmation, and periodic fillability refresh.
+- Deliverable: end-to-end local/fork flow for list, buy, offer, accept, cancel, and bulk invalidate.
+
+### Week 3 — site, operations, and audit handoff
+
+- Build collection grid/detail pages and wallet flows. Show gross price, artist fee, seller proceeds, currency, expiry, approval transaction, and gas as separate confirmations.
+- Clearly label stale/unfillable offers and listings; recheck immediately before wallet submission. Prevent API publication of invalid signatures but never imply the API is the source of truth.
+- Add monitoring for fill/cancel events, indexer lag/reorgs, RPC health, failed transaction spikes, and unexpected contract ETH/WETH balances (which should remain zero apart from forced ETH).
+- Freeze the commit and provide the auditor the exact scope below, dependency lockfiles, deployed-address assumptions, diagrams, specs, tests, coverage/fuzz settings, known issues, and reproducible commands.
+- Deliverable: feature-complete release candidate; no feature changes after audit freeze except separately reviewed fixes.
+
+### Week 4 — audit fixes, rehearsal, and launch
+
+- Triage findings by severity, fix in-scope code, add regression tests for every accepted finding, and send one bounded remediation commit/diff for auditor verification.
+- Have a fresh reviewer run the complete user journey on a mainnet fork and then on the chosen pre-production environment with production configuration.
+- Rehearse deployment from a clean checkout, verify bytecode/source, validate immutables and EIP-712 domain, and execute a small end-to-end transaction after deployment.
+- Deploy to Ethereum mainnet, verify source, compare runtime bytecode and constructor arguments, publish address/ABI, configure the indexer/site, and perform a low-value controlled listing purchase and WETH offer acceptance.
+- Launch only if the auditor has cleared critical/high findings, all tests pass at the frozen commit, monitoring is live, and rollback for the site/indexer is rehearsed. The immutable exchange cannot be patched; a contract issue means stop linking new orders in the UI, warn users, and deploy/audit a replacement. Existing signed orders are domain-bound to the old address.
+
+## Precise audit scope for quotation
+
+The quote should cover one Solidity exchange contract, its directly inherited/library code as compiled, and contract-facing tests/deployment configuration—not the NFT collection itself or a general audit of OpenZeppelin/WETH.
+
+### In-scope artifacts
+
+Provide exact paths and frozen commit hash once the repository exists:
+
+1. `src/CollectionExchange.sol` (expected approximately 250–400 non-comment Solidity lines).
+2. Any local Solidity interfaces/libraries imported by it; no unlisted local code may enter deployed bytecode.
+3. Exact pinned OpenZeppelin contracts reached by the import graph: EIP-712/domain handling, `SignatureChecker`/ECDSA/ERC-1271, `ReentrancyGuard`, `SafeERC20`, and ERC-721/ERC-20 interfaces. Review is integration/misuse-focused; note library version and commit.
+4. Deployment script and constructor/config validation for collection, WETH, artist recipient, 250 bps fee, chain ID, compiler settings, optimizer, and EVM target.
+5. Contract tests, fuzz/invariant harnesses, signature fixtures, and mainnet-fork tests insofar as they demonstrate intended security properties.
+6. The protocol specification, state-transition table, threat model, and this scope document as normative intent.
+
+The auditor should quote separately for initial review and one remediation review of a bounded diff. Require a report with severity, exploit scenario, affected lines, recommendation, status, and the frozen commit hash; request disclosure of methodology, reviewer-days, and whether tests/fuzzing are run or extended.
+
+### Security properties and attack surfaces to assess
+
+- Only a valid, unexpired, domain-bound maker authorization can fill an order; EOA and ERC-1271 validation cannot be confused, replayed across order types/chains/contracts, or malleated.
+- An order can settle at most once. Individual cancellation and minimum-nonce invalidation cannot be bypassed, grief another maker, collide across types, or create off-by-one validity.
+- Seller/current-owner/approval checks are correct at execution time, including ownership changing away and back; an offer cannot be accepted by a former owner or redirect NFT/proceeds.
+- Gross payment is conserved exactly: artist gets `floor(gross * 250 / 10_000)`, seller gets the remainder, no platform/admin captures value, and zero/dust/maximum values behave safely.
+- Listing settlement accepts exactly the signed ETH amount and cannot retain accidental overpayment. Offer settlement pulls only the signed WETH amount from the signed buyer and cannot spend an unlimited allowance beyond that order.
+- NFT and both payment legs are atomic under all revert/reentrancy/token-callback cases; checks-effects-interactions and guards prevent double fills, stale-state use, and callback manipulation.
+- External-call assumptions are safe for the exact deployed collection, canonical WETH, artist recipient, EOAs, Safe/ERC-1271 wallets, ERC-721 receivers, reverting recipients, and forced ETH. Confirm there is no reachable withdrawal or trapped-fund expectation.
+- Typed-data encoding matches the client fixtures exactly; field omission, type confusion, hash collision, ambiguous packed encoding, deadline boundary, chain fork, and signature replay risks are covered.
+- Denial-of-service and griefing are assessed: rejecting ETH recipient, artist recipient behavior, revoked approvals, insufficient WETH, gas-heavy ERC-1271 checks, front-running, competing fills, self-trades, and cancellation/fill ordering.
+- Immutability and deployment are verified: no proxy/admin backdoor, correct constructor validation, correct mainnet addresses and code hashes, reproducible bytecode, verified source, and correct EIP-712 domain after deployment.
+- Events faithfully represent settlement/cancellation for a reorg-aware indexer and do not allow event-only state to diverge from contract truth.
+
+### Explicitly out of scope for the contract audit
+
+- The already-deployed NFT's source code, metadata/media, rarity, provenance, and any vulnerabilities intrinsic to it, except black-box integration behavior tested on a fork.
+- Canonical WETH and OpenZeppelin internals as standalone codebases, except whether pinned versions are appropriate and used correctly.
+- Web UI, API, database, indexer availability/reorg logic, wallet/RPC providers, DNS/hosting, analytics, and social engineering. A separate application security review should cover order-substitution/phishing, XSS, API abuse, signature presentation, dependency/supply-chain security, secrets, and deployment access.
+- Economic appraisal, wash trading, tax/securities advice, sanctions compliance, marketplace terms, and the enforceability of royalties outside this contract.
+- Features listed as out of MVP scope and any code or configuration changed after the frozen audit commit. Such changes require auditor confirmation or a new scope.
+
+## Deployment and verification runbook requirements
+
+The implementation README must replace placeholders with exact, executable commands for a clean install, tests, fork tests, deployment simulation, mainnet deployment, and source verification. It must list environment variables without committing secrets: mainnet RPC URL, deployer key or hardware-wallet/Safe flow, block explorer API key, collection address, WETH address, and artist recipient.
+
+Before broadcast, independently verify chain ID 1, deployer balance, all constructor addresses and their code, artist multisig owners/threshold, compiler/optimizer settings, clean Git status, passing tests, audit commit, and simulated bytecode. Deploy from a dedicated deployer; because the contract has no admin role, ownership transfer is not applicable. Verify the source and constructor arguments, compare deployed runtime bytecode, inspect immutables/domain separator, and publish the canonical address.
+
+Post-deploy, use low-value tokens/prices approved by their owners to execute: listing signature → buy → royalty/proceeds balance checks; offer signature with exact WETH approval → owner acceptance → balance/ownership checks; individual cancellation; and minimum-nonce invalidation. Confirm emitted events, indexer ingestion after the chosen confirmation depth, zero marketplace token balances, site links/domain, monitoring alerts, and a public support/incident channel. Keep the old Discord manual process read-only during the controlled rollout and never ask users to sign opaque typed data.

exec
/bin/bash -lc "wc -l plan.md && sed -n '1,40p' plan.md && git diff --check -- plan.md" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-28T143527Z-codex-with-skill-2/workspace
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
163 plan.md
# Four-week MVP plan: collection marketplace

## Product decision and assumptions

Ship a collection-specific, fixed-price secondary marketplace for the existing 5,000-token ERC-721 collection on **Ethereum mainnet**. This keeps settlement beside the collection and its existing holders/liquidity and avoids a bridge or wrapped representation.

The MVP uses one immutable `CollectionExchange` contract. It enforces a 2.5% artist fee on every sale it settles. NFTs remain in their owners' wallets until an atomic sale. Listings are EIP-712 signatures stored/indexed offchain and paid in native ETH. Offers are EIP-712 signatures paid in canonical mainnet WETH using the buyer's balance and allowance; WETH is not deposited in the exchange. An offer can therefore become unfillable if the buyer spends the WETH or revokes allowance—this is intentional non-custodial behavior and must be shown in the UI.

Before implementation, record and verify these inputs:

- collection contract address and confirmation that it behaves as ERC-721 (`ownerOf`, approvals, `safeTransferFrom`);
- artist royalty recipient, preferably a Safe multisig, and its acceptance of the role;
- canonical Ethereum mainnet WETH address from official WETH/deployment documentation (never infer it);
- whether smart-contract-wallet signatures (ERC-1271) are required. This plan includes them;
- whether the collection has transfer restrictions, staking wrappers, or an existing ERC-2981 policy. The MVP fee remains exactly 250 basis points regardless of ERC-2981 output.

Out of scope: auctions, collection-wide offers, traits-based offers, multiple currencies, partial fills, bundles, primary minting, custody, fiat/on-ramp, cross-chain support, fee configurability, upgradeability, platform fees, royalties on sales outside this exchange, and moderation/dispute reversal. “Every resale” means every resale settled through this contract; no contract can force unrelated peer-to-peer transfers or external marketplaces to pay this fee unless the NFT itself already restricts transfers.

## Onchain and offchain boundary

Onchain responsibilities are signature and order validation, replay/cancellation state, payment splitting, and atomic ERC-721 transfer. The contract is non-upgradeable and has no owner-only operational powers, pause switch, withdrawal function, proxy, custody ledger, or fee setter. Constructor immutables are the collection, WETH, artist recipient, and `feeBps = 250`; denominator is 10,000.

Offchain services store signed listings/offers and cancellation metadata, index contract events, check current ownership/approvals/balances/allowances, and serve browsing, search, filtering, images, and status. They are convenience and discovery only: a buyer or seller can submit a valid signed order directly to the contract. The database never decides settlement validity. The API must treat chain state as authoritative and mark stale/unfillable orders rather than deleting their history.

## Minimal contract surface

Use OpenZeppelin's pinned, audited `EIP712`, `SignatureChecker`, `ReentrancyGuard`, `SafeERC20`, and ERC-721 interfaces. Pin the compiler and dependency commit/release in the repository and audit manifest.

`Listing` signed data:

```solidity
address seller;
uint256 tokenId;
uint256 price;       // wei, nonzero
uint256 nonce;       // maker-selected unique nonce
uint256 deadline;    // inclusive timestamp
```

`Offer` signed data:


diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..b17a28e6a5530dccabfc7cb3b946246174b1033f
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,163 @@
+# Four-week MVP plan: collection marketplace
+
+## Product decision and assumptions
+
+Ship a collection-specific, fixed-price secondary marketplace for the existing 5,000-token ERC-721 collection on **Ethereum mainnet**. This keeps settlement beside the collection and its existing holders/liquidity and avoids a bridge or wrapped representation.
+
+The MVP uses one immutable `CollectionExchange` contract. It enforces a 2.5% artist fee on every sale it settles. NFTs remain in their owners' wallets until an atomic sale. Listings are EIP-712 signatures stored/indexed offchain and paid in native ETH. Offers are EIP-712 signatures paid in canonical mainnet WETH using the buyer's balance and allowance; WETH is not deposited in the exchange. An offer can therefore become unfillable if the buyer spends the WETH or revokes allowance—this is intentional non-custodial behavior and must be shown in the UI.
+
+Before implementation, record and verify these inputs:
+
+- collection contract address and confirmation that it behaves as ERC-721 (`ownerOf`, approvals, `safeTransferFrom`);
+- artist royalty recipient, preferably a Safe multisig, and its acceptance of the role;
+- canonical Ethereum mainnet WETH address from official WETH/deployment documentation (never infer it);
+- whether smart-contract-wallet signatures (ERC-1271) are required. This plan includes them;
+- whether the collection has transfer restrictions, staking wrappers, or an existing ERC-2981 policy. The MVP fee remains exactly 250 basis points regardless of ERC-2981 output.
+
+Out of scope: auctions, collection-wide offers, traits-based offers, multiple currencies, partial fills, bundles, primary minting, custody, fiat/on-ramp, cross-chain support, fee configurability, upgradeability, platform fees, royalties on sales outside this exchange, and moderation/dispute reversal. “Every resale” means every resale settled through this contract; no contract can force unrelated peer-to-peer transfers or external marketplaces to pay this fee unless the NFT itself already restricts transfers.
+
+## Onchain and offchain boundary
+
+Onchain responsibilities are signature and order validation, replay/cancellation state, payment splitting, and atomic ERC-721 transfer. The contract is non-upgradeable and has no owner-only operational powers, pause switch, withdrawal function, proxy, custody ledger, or fee setter. Constructor immutables are the collection, WETH, artist recipient, and `feeBps = 250`; denominator is 10,000.
+
+Offchain services store signed listings/offers and cancellation metadata, index contract events, check current ownership/approvals/balances/allowances, and serve browsing, search, filtering, images, and status. They are convenience and discovery only: a buyer or seller can submit a valid signed order directly to the contract. The database never decides settlement validity. The API must treat chain state as authoritative and mark stale/unfillable orders rather than deleting their history.
+
+## Minimal contract surface
+
+Use OpenZeppelin's pinned, audited `EIP712`, `SignatureChecker`, `ReentrancyGuard`, `SafeERC20`, and ERC-721 interfaces. Pin the compiler and dependency commit/release in the repository and audit manifest.
+
+`Listing` signed data:
+
+```solidity
+address seller;
+uint256 tokenId;
+uint256 price;       // wei, nonzero
+uint256 nonce;       // maker-selected unique nonce
+uint256 deadline;    // inclusive timestamp
+```
+
+`Offer` signed data:
+
+```solidity
+address buyer;
+uint256 tokenId;
+uint256 price;       // WETH units, nonzero
+uint256 nonce;
+uint256 deadline;
+```
+
+The EIP-712 domain includes contract name/version, chain ID, and verifying contract. The order type/hash must distinguish listing from offer. No arbitrary NFT, currency, recipient, calldata, or fee fields are signed.
+
+Public/external functions:
+
+- `buy(Listing order, bytes signature) external payable nonReentrant`: require exact `msg.value == price`, live deadline, valid seller signature (EOA or ERC-1271), unused/uncancelled order hash, current `ownerOf(tokenId) == seller`, and exchange approval. Mark filled before interactions; transfer the NFT to `msg.sender`; pay `price * 250 / 10_000` to the immutable artist recipient and the remainder to seller. Any failed leg reverts the whole sale. Document the exact transfer order selected during implementation and test it adversarially.
+- `acceptOffer(Offer order, bytes signature) external nonReentrant`: require caller is the current token owner, live deadline, valid buyer signature, unused/uncancelled order hash, and exchange approval; mark filled before interactions; pull the royalty and seller proceeds directly from buyer using WETH `transferFrom`, then transfer the NFT to the caller-selected recipient policy. For the MVP the NFT recipient is exactly `buyer`, and proceeds go exactly to `msg.sender`. Any failed leg reverts atomically.
+- `cancel(bytes32 orderHash) external`: only the maker recovered/identified from the complete supplied order should be able to cancel. To avoid an ambiguous bare hash API, implementation should instead expose typed `cancelListing(Listing)` and `cancelOffer(Offer)`, recompute the hash, and require `msg.sender` equals the order maker. Cancellation is idempotent or reverts with a documented custom error.
+- `incrementNonce() external`: invalidates all of the caller's orders whose signed nonce is below the new maker nonce. Prefer a strictly increasing `minNonce[msg.sender]`; individual cancellation remains available.
+- pure/view helpers: `hashListing`, `hashOffer`, `isCancelledOrFilled`, current `minNonce`, `feeAmount`, and EIP-712 domain introspection where supported.
+
+Storage is limited to used/cancelled order hashes and each maker's minimum nonce. Emit `ListingFilled`, `OfferFilled`, `OrderCancelled`, and `MinNonceIncremented`, each with indexed order hash, token ID, buyer, and seller as applicable, plus gross price and artist fee on fills. Signed-order publication is not an onchain event.
+
+Important implementation decisions to freeze before audit:
+
+- native ETH payout uses checked low-level calls and reverts atomically if either recipient rejects ETH; the UI warns contract-wallet sellers/artist recipients;
+- fee rounding is `floor(price * 250 / 10_000)`, seller receives `price - fee`, and tests cover dust prices and overflow-safe calculation;
+- an order becomes consumed before any external token/payment call and stays consumed only if the transaction succeeds;
+- `buy` cannot choose an NFT recipient, and `acceptOffer` sends only to the signed buyer, preventing unintended redirection;
+- no relayed seller acceptance in the MVP; the current owner calls `acceptOffer` and pays gas;
+- ERC-721 receiver behavior, WETH return behavior, signature malleability, chain/domain replay, reentrancy, self-purchase, expired orders, transferred-then-returned tokens, and nonce boundary semantics are explicitly tested.
+
+## State transitions and incentives
+
+| Transition | Caller | Why they pay gas | Safe outcome if nobody calls |
+| --- | --- | --- | --- |
+| Publish listing/offer signature | Seller/buyer via site (offchain) | No gas; creates a discoverable order | No order is available |
+| `buy` | Buyer | Receives the NFT at the signed price | Listing remains unfilled until expiry/cancellation or becomes stale |
+| `acceptOffer` | Current NFT owner | Receives WETH proceeds | Offer remains unfilled until expiry/cancellation or becomes unfillable |
+| Cancel one order | Order maker | Removes an unwanted signed order | Order remains fillable while otherwise valid |
+| Raise minimum nonce | Order maker | Cancels a group of old orders | Old orders remain individually valid |
+| Approve exchange for NFT | Owner | Enables a desired sale | Settlement reverts; NFT remains with owner |
+| Approve WETH / acquire WETH | Offer maker | Enables their offer to settle | Acceptance reverts; WETH and NFT remain where they are |
+
+There are no scheduled transitions, keepers, admin crons, or stranded marketplace funds to claim.
+
+## Four-week build plan
+
+### Week 1 — specification and contract skeleton
+
+- Confirm the four immutable addresses/values and inspect the deployed collection on a mainnet fork, including transfer behavior and approval paths.
+- Freeze EIP-712 schemas, cancellation/nonce semantics, fee rounding, ETH/WETH payout ordering, custom errors, and events in a short protocol specification.
+- Implement the non-upgradeable contract and deployment script with pinned Solidity/OpenZeppelin/toolchain versions.
+- Add unit tests for happy paths and every validation branch. Generate shared signature test vectors for Solidity and the web client.
+- Deliverable: compiling contract, ABI, protocol spec, transition table, and initial test report.
+
+### Week 2 — adversarial tests and vertical slice
+
+- Add fuzz/property tests: conservation of gross price, exact 2.5% floor split, at-most-once fill, cancellation monotonicity, only-current-owner acceptance, and no successful partial settlement.
+- Add malicious ERC-721 receiver, reverting payee, reentrant recipient, ERC-1271 wallet, malformed signature, and unusual ERC-20 return-path tests as applicable.
+- Run mainnet-fork integration tests against the exact collection and WETH addresses. Test ownership changes, approvals revoked, WETH spent, simultaneous fill attempts, expiry boundaries, and transferred-away/transferred-back NFTs.
+- Build the API/indexer for signed-order submission, signature verification, event ingestion, reorg-safe confirmation, and periodic fillability refresh.
+- Deliverable: end-to-end local/fork flow for list, buy, offer, accept, cancel, and bulk invalidate.
+
+### Week 3 — site, operations, and audit handoff
+
+- Build collection grid/detail pages and wallet flows. Show gross price, artist fee, seller proceeds, currency, expiry, approval transaction, and gas as separate confirmations.
+- Clearly label stale/unfillable offers and listings; recheck immediately before wallet submission. Prevent API publication of invalid signatures but never imply the API is the source of truth.
+- Add monitoring for fill/cancel events, indexer lag/reorgs, RPC health, failed transaction spikes, and unexpected contract ETH/WETH balances (which should remain zero apart from forced ETH).
+- Freeze the commit and provide the auditor the exact scope below, dependency lockfiles, deployed-address assumptions, diagrams, specs, tests, coverage/fuzz settings, known issues, and reproducible commands.
+- Deliverable: feature-complete release candidate; no feature changes after audit freeze except separately reviewed fixes.
+
+### Week 4 — audit fixes, rehearsal, and launch
+
+- Triage findings by severity, fix in-scope code, add regression tests for every accepted finding, and send one bounded remediation commit/diff for auditor verification.
+- Have a fresh reviewer run the complete user journey on a mainnet fork and then on the chosen pre-production environment with production configuration.
+- Rehearse deployment from a clean checkout, verify bytecode/source, validate immutables and EIP-712 domain, and execute a small end-to-end transaction after deployment.
+- Deploy to Ethereum mainnet, verify source, compare runtime bytecode and constructor arguments, publish address/ABI, configure the indexer/site, and perform a low-value controlled listing purchase and WETH offer acceptance.
+- Launch only if the auditor has cleared critical/high findings, all tests pass at the frozen commit, monitoring is live, and rollback for the site/indexer is rehearsed. The immutable exchange cannot be patched; a contract issue means stop linking new orders in the UI, warn users, and deploy/audit a replacement. Existing signed orders are domain-bound to the old address.
+
+## Precise audit scope for quotation
+
+The quote should cover one Solidity exchange contract, its directly inherited/library code as compiled, and contract-facing tests/deployment configuration—not the NFT collection itself or a general audit of OpenZeppelin/WETH.
+
+### In-scope artifacts
+
+Provide exact paths and frozen commit hash once the repository exists:
+
+1. `src/CollectionExchange.sol` (expected approximately 250–400 non-comment Solidity lines).
+2. Any local Solidity interfaces/libraries imported by it; no unlisted local code may enter deployed bytecode.
+3. Exact pinned OpenZeppelin contracts reached by the import graph: EIP-712/domain handling, `SignatureChecker`/ECDSA/ERC-1271, `ReentrancyGuard`, `SafeERC20`, and ERC-721/ERC-20 interfaces. Review is integration/misuse-focused; note library version and commit.
+4. Deployment script and constructor/config validation for collection, WETH, artist recipient, 250 bps fee, chain ID, compiler settings, optimizer, and EVM target.
+5. Contract tests, fuzz/invariant harnesses, signature fixtures, and mainnet-fork tests insofar as they demonstrate intended security properties.
+6. The protocol specification, state-transition table, threat model, and this scope document as normative intent.
+
+The auditor should quote separately for initial review and one remediation review of a bounded diff. Require a report with severity, exploit scenario, affected lines, recommendation, status, and the frozen commit hash; request disclosure of methodology, reviewer-days, and whether tests/fuzzing are run or extended.
+
+### Security properties and attack surfaces to assess
+
+- Only a valid, unexpired, domain-bound maker authorization can fill an order; EOA and ERC-1271 validation cannot be confused, replayed across order types/chains/contracts, or malleated.
+- An order can settle at most once. Individual cancellation and minimum-nonce invalidation cannot be bypassed, grief another maker, collide across types, or create off-by-one validity.
+- Seller/current-owner/approval checks are correct at execution time, including ownership changing away and back; an offer cannot be accepted by a former owner or redirect NFT/proceeds.
+- Gross payment is conserved exactly: artist gets `floor(gross * 250 / 10_000)`, seller gets the remainder, no platform/admin captures value, and zero/dust/maximum values behave safely.
+- Listing settlement accepts exactly the signed ETH amount and cannot retain accidental overpayment. Offer settlement pulls only the signed WETH amount from the signed buyer and cannot spend an unlimited allowance beyond that order.
+- NFT and both payment legs are atomic under all revert/reentrancy/token-callback cases; checks-effects-interactions and guards prevent double fills, stale-state use, and callback manipulation.
+- External-call assumptions are safe for the exact deployed collection, canonical WETH, artist recipient, EOAs, Safe/ERC-1271 wallets, ERC-721 receivers, reverting recipients, and forced ETH. Confirm there is no reachable withdrawal or trapped-fund expectation.
+- Typed-data encoding matches the client fixtures exactly; field omission, type confusion, hash collision, ambiguous packed encoding, deadline boundary, chain fork, and signature replay risks are covered.
+- Denial-of-service and griefing are assessed: rejecting ETH recipient, artist recipient behavior, revoked approvals, insufficient WETH, gas-heavy ERC-1271 checks, front-running, competing fills, self-trades, and cancellation/fill ordering.
+- Immutability and deployment are verified: no proxy/admin backdoor, correct constructor validation, correct mainnet addresses and code hashes, reproducible bytecode, verified source, and correct EIP-712 domain after deployment.
+- Events faithfully represent settlement/cancellation for a reorg-aware indexer and do not allow event-only state to diverge from contract truth.
+
+### Explicitly out of scope for the contract audit
+
+- The already-deployed NFT's source code, metadata/media, rarity, provenance, and any vulnerabilities intrinsic to it, except black-box integration behavior tested on a fork.
+- Canonical WETH and OpenZeppelin internals as standalone codebases, except whether pinned versions are appropriate and used correctly.
+- Web UI, API, database, indexer availability/reorg logic, wallet/RPC providers, DNS/hosting, analytics, and social engineering. A separate application security review should cover order-substitution/phishing, XSS, API abuse, signature presentation, dependency/supply-chain security, secrets, and deployment access.
+- Economic appraisal, wash trading, tax/securities advice, sanctions compliance, marketplace terms, and the enforceability of royalties outside this contract.
+- Features listed as out of MVP scope and any code or configuration changed after the frozen audit commit. Such changes require auditor confirmation or a new scope.
+
+## Deployment and verification runbook requirements
+
+The implementation README must replace placeholders with exact, executable commands for a clean install, tests, fork tests, deployment simulation, mainnet deployment, and source verification. It must list environment variables without committing secrets: mainnet RPC URL, deployer key or hardware-wallet/Safe flow, block explorer API key, collection address, WETH address, and artist recipient.
+
+Before broadcast, independently verify chain ID 1, deployer balance, all constructor addresses and their code, artist multisig owners/threshold, compiler/optimizer settings, clean Git status, passing tests, audit commit, and simulated bytecode. Deploy from a dedicated deployer; because the contract has no admin role, ownership transfer is not applicable. Verify the source and constructor arguments, compare deployed runtime bytecode, inspect immutables/domain separator, and publish the canonical address.
+
+Post-deploy, use low-value tokens/prices approved by their owners to execute: listing signature → buy → royalty/proceeds balance checks; offer signature with exact WETH approval → owner acceptance → balance/ownership checks; individual cancellation; and minimum-nonce invalidation. Confirm emitted events, indexer ingestion after the chosen confirmation depth, zero marketplace token balances, site links/domain, monitoring alerts, and a public support/incident channel. Keep the old Discord manual process read-only during the controlled rollout and never ask users to sign opaque typed data.

codex
Created [plan.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-28T143527Z-codex-with-skill-2/workspace/plan.md).

It covers:

- Four-week implementation and launch plan
- Non-custodial signed listings and WETH offers
- Enforced 2.5% artist fee
- Minimal contract interface and state transitions
- Onchain/offchain boundaries
- Security assumptions and test requirements
- Precise auditor quotation scope
- Deployment, verification, and post-launch runbook

`git diff --check` passes.
diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..b17a28e6a5530dccabfc7cb3b946246174b1033f
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,163 @@
+# Four-week MVP plan: collection marketplace
+
+## Product decision and assumptions
+
+Ship a collection-specific, fixed-price secondary marketplace for the existing 5,000-token ERC-721 collection on **Ethereum mainnet**. This keeps settlement beside the collection and its existing holders/liquidity and avoids a bridge or wrapped representation.
+
+The MVP uses one immutable `CollectionExchange` contract. It enforces a 2.5% artist fee on every sale it settles. NFTs remain in their owners' wallets until an atomic sale. Listings are EIP-712 signatures stored/indexed offchain and paid in native ETH. Offers are EIP-712 signatures paid in canonical mainnet WETH using the buyer's balance and allowance; WETH is not deposited in the exchange. An offer can therefore become unfillable if the buyer spends the WETH or revokes allowance—this is intentional non-custodial behavior and must be shown in the UI.
+
+Before implementation, record and verify these inputs:
+
+- collection contract address and confirmation that it behaves as ERC-721 (`ownerOf`, approvals, `safeTransferFrom`);
+- artist royalty recipient, preferably a Safe multisig, and its acceptance of the role;
+- canonical Ethereum mainnet WETH address from official WETH/deployment documentation (never infer it);
+- whether smart-contract-wallet signatures (ERC-1271) are required. This plan includes them;
+- whether the collection has transfer restrictions, staking wrappers, or an existing ERC-2981 policy. The MVP fee remains exactly 250 basis points regardless of ERC-2981 output.
+
+Out of scope: auctions, collection-wide offers, traits-based offers, multiple currencies, partial fills, bundles, primary minting, custody, fiat/on-ramp, cross-chain support, fee configurability, upgradeability, platform fees, royalties on sales outside this exchange, and moderation/dispute reversal. “Every resale” means every resale settled through this contract; no contract can force unrelated peer-to-peer transfers or external marketplaces to pay this fee unless the NFT itself already restricts transfers.
+
+## Onchain and offchain boundary
+
+Onchain responsibilities are signature and order validation, replay/cancellation state, payment splitting, and atomic ERC-721 transfer. The contract is non-upgradeable and has no owner-only operational powers, pause switch, withdrawal function, proxy, custody ledger, or fee setter. Constructor immutables are the collection, WETH, artist recipient, and `feeBps = 250`; denominator is 10,000.
+
+Offchain services store signed listings/offers and cancellation metadata, index contract events, check current ownership/approvals/balances/allowances, and serve browsing, search, filtering, images, and status. They are convenience and discovery only: a buyer or seller can submit a valid signed order directly to the contract. The database never decides settlement validity. The API must treat chain state as authoritative and mark stale/unfillable orders rather than deleting their history.
+
+## Minimal contract surface
+
+Use OpenZeppelin's pinned, audited `EIP712`, `SignatureChecker`, `ReentrancyGuard`, `SafeERC20`, and ERC-721 interfaces. Pin the compiler and dependency commit/release in the repository and audit manifest.
+
+`Listing` signed data:
+
+```solidity
+address seller;
+uint256 tokenId;
+uint256 price;       // wei, nonzero
+uint256 nonce;       // maker-selected unique nonce
+uint256 deadline;    // inclusive timestamp
+```
+
+`Offer` signed data:
+
+```solidity
+address buyer;
+uint256 tokenId;
+uint256 price;       // WETH units, nonzero
+uint256 nonce;
+uint256 deadline;
+```
+
+The EIP-712 domain includes contract name/version, chain ID, and verifying contract. The order type/hash must distinguish listing from offer. No arbitrary NFT, currency, recipient, calldata, or fee fields are signed.
+
+Public/external functions:
+
+- `buy(Listing order, bytes signature) external payable nonReentrant`: require exact `msg.value == price`, live deadline, valid seller signature (EOA or ERC-1271), unused/uncancelled order hash, current `ownerOf(tokenId) == seller`, and exchange approval. Mark filled before interactions; transfer the NFT to `msg.sender`; pay `price * 250 / 10_000` to the immutable artist recipient and the remainder to seller. Any failed leg reverts the whole sale. Document the exact transfer order selected during implementation and test it adversarially.
+- `acceptOffer(Offer order, bytes signature) external nonReentrant`: require caller is the current token owner, live deadline, valid buyer signature, unused/uncancelled order hash, and exchange approval; mark filled before interactions; pull the royalty and seller proceeds directly from buyer using WETH `transferFrom`, then transfer the NFT to the caller-selected recipient policy. For the MVP the NFT recipient is exactly `buyer`, and proceeds go exactly to `msg.sender`. Any failed leg reverts atomically.
+- `cancel(bytes32 orderHash) external`: only the maker recovered/identified from the complete supplied order should be able to cancel. To avoid an ambiguous bare hash API, implementation should instead expose typed `cancelListing(Listing)` and `cancelOffer(Offer)`, recompute the hash, and require `msg.sender` equals the order maker. Cancellation is idempotent or reverts with a documented custom error.
+- `incrementNonce() external`: invalidates all of the caller's orders whose signed nonce is below the new maker nonce. Prefer a strictly increasing `minNonce[msg.sender]`; individual cancellation remains available.
+- pure/view helpers: `hashListing`, `hashOffer`, `isCancelledOrFilled`, current `minNonce`, `feeAmount`, and EIP-712 domain introspection where supported.
+
+Storage is limited to used/cancelled order hashes and each maker's minimum nonce. Emit `ListingFilled`, `OfferFilled`, `OrderCancelled`, and `MinNonceIncremented`, each with indexed order hash, token ID, buyer, and seller as applicable, plus gross price and artist fee on fills. Signed-order publication is not an onchain event.
+
+Important implementation decisions to freeze before audit:
+
+- native ETH payout uses checked low-level calls and reverts atomically if either recipient rejects ETH; the UI warns contract-wallet sellers/artist recipients;
+- fee rounding is `floor(price * 250 / 10_000)`, seller receives `price - fee`, and tests cover dust prices and overflow-safe calculation;
+- an order becomes consumed before any external token/payment call and stays consumed only if the transaction succeeds;
+- `buy` cannot choose an NFT recipient, and `acceptOffer` sends only to the signed buyer, preventing unintended redirection;
+- no relayed seller acceptance in the MVP; the current owner calls `acceptOffer` and pays gas;
+- ERC-721 receiver behavior, WETH return behavior, signature malleability, chain/domain replay, reentrancy, self-purchase, expired orders, transferred-then-returned tokens, and nonce boundary semantics are explicitly tested.
+
+## State transitions and incentives
+
+| Transition | Caller | Why they pay gas | Safe outcome if nobody calls |
+| --- | --- | --- | --- |
+| Publish listing/offer signature | Seller/buyer via site (offchain) | No gas; creates a discoverable order | No order is available |
+| `buy` | Buyer | Receives the NFT at the signed price | Listing remains unfilled until expiry/cancellation or becomes stale |
+| `acceptOffer` | Current NFT owner | Receives WETH proceeds | Offer remains unfilled until expiry/cancellation or becomes unfillable |
+| Cancel one order | Order maker | Removes an unwanted signed order | Order remains fillable while otherwise valid |
+| Raise minimum nonce | Order maker | Cancels a group of old orders | Old orders remain individually valid |
+| Approve exchange for NFT | Owner | Enables a desired sale | Settlement reverts; NFT remains with owner |
+| Approve WETH / acquire WETH | Offer maker | Enables their offer to settle | Acceptance reverts; WETH and NFT remain where they are |
+
+There are no scheduled transitions, keepers, admin crons, or stranded marketplace funds to claim.
+
+## Four-week build plan
+
+### Week 1 — specification and contract skeleton
+
+- Confirm the four immutable addresses/values and inspect the deployed collection on a mainnet fork, including transfer behavior and approval paths.
+- Freeze EIP-712 schemas, cancellation/nonce semantics, fee rounding, ETH/WETH payout ordering, custom errors, and events in a short protocol specification.
+- Implement the non-upgradeable contract and deployment script with pinned Solidity/OpenZeppelin/toolchain versions.
+- Add unit tests for happy paths and every validation branch. Generate shared signature test vectors for Solidity and the web client.
+- Deliverable: compiling contract, ABI, protocol spec, transition table, and initial test report.
+
+### Week 2 — adversarial tests and vertical slice
+
+- Add fuzz/property tests: conservation of gross price, exact 2.5% floor split, at-most-once fill, cancellation monotonicity, only-current-owner acceptance, and no successful partial settlement.
+- Add malicious ERC-721 receiver, reverting payee, reentrant recipient, ERC-1271 wallet, malformed signature, and unusual ERC-20 return-path tests as applicable.
+- Run mainnet-fork integration tests against the exact collection and WETH addresses. Test ownership changes, approvals revoked, WETH spent, simultaneous fill attempts, expiry boundaries, and transferred-away/transferred-back NFTs.
+- Build the API/indexer for signed-order submission, signature verification, event ingestion, reorg-safe confirmation, and periodic fillability refresh.
+- Deliverable: end-to-end local/fork flow for list, buy, offer, accept, cancel, and bulk invalidate.
+
+### Week 3 — site, operations, and audit handoff
+
+- Build collection grid/detail pages and wallet flows. Show gross price, artist fee, seller proceeds, currency, expiry, approval transaction, and gas as separate confirmations.
+- Clearly label stale/unfillable offers and listings; recheck immediately before wallet submission. Prevent API publication of invalid signatures but never imply the API is the source of truth.
+- Add monitoring for fill/cancel events, indexer lag/reorgs, RPC health, failed transaction spikes, and unexpected contract ETH/WETH balances (which should remain zero apart from forced ETH).
+- Freeze the commit and provide the auditor the exact scope below, dependency lockfiles, deployed-address assumptions, diagrams, specs, tests, coverage/fuzz settings, known issues, and reproducible commands.
+- Deliverable: feature-complete release candidate; no feature changes after audit freeze except separately reviewed fixes.
+
+### Week 4 — audit fixes, rehearsal, and launch
+
+- Triage findings by severity, fix in-scope code, add regression tests for every accepted finding, and send one bounded remediation commit/diff for auditor verification.
+- Have a fresh reviewer run the complete user journey on a mainnet fork and then on the chosen pre-production environment with production configuration.
+- Rehearse deployment from a clean checkout, verify bytecode/source, validate immutables and EIP-712 domain, and execute a small end-to-end transaction after deployment.
+- Deploy to Ethereum mainnet, verify source, compare runtime bytecode and constructor arguments, publish address/ABI, configure the indexer/site, and perform a low-value controlled listing purchase and WETH offer acceptance.
+- Launch only if the auditor has cleared critical/high findings, all tests pass at the frozen commit, monitoring is live, and rollback for the site/indexer is rehearsed. The immutable exchange cannot be patched; a contract issue means stop linking new orders in the UI, warn users, and deploy/audit a replacement. Existing signed orders are domain-bound to the old address.
+
+## Precise audit scope for quotation
+
+The quote should cover one Solidity exchange contract, its directly inherited/library code as compiled, and contract-facing tests/deployment configuration—not the NFT collection itself or a general audit of OpenZeppelin/WETH.
+
+### In-scope artifacts
+
+Provide exact paths and frozen commit hash once the repository exists:
+
+1. `src/CollectionExchange.sol` (expected approximately 250–400 non-comment Solidity lines).
+2. Any local Solidity interfaces/libraries imported by it; no unlisted local code may enter deployed bytecode.
+3. Exact pinned OpenZeppelin contracts reached by the import graph: EIP-712/domain handling, `SignatureChecker`/ECDSA/ERC-1271, `ReentrancyGuard`, `SafeERC20`, and ERC-721/ERC-20 interfaces. Review is integration/misuse-focused; note library version and commit.
+4. Deployment script and constructor/config validation for collection, WETH, artist recipient, 250 bps fee, chain ID, compiler settings, optimizer, and EVM target.
+5. Contract tests, fuzz/invariant harnesses, signature fixtures, and mainnet-fork tests insofar as they demonstrate intended security properties.
+6. The protocol specification, state-transition table, threat model, and this scope document as normative intent.
+
+The auditor should quote separately for initial review and one remediation review of a bounded diff. Require a report with severity, exploit scenario, affected lines, recommendation, status, and the frozen commit hash; request disclosure of methodology, reviewer-days, and whether tests/fuzzing are run or extended.
+
+### Security properties and attack surfaces to assess
+
+- Only a valid, unexpired, domain-bound maker authorization can fill an order; EOA and ERC-1271 validation cannot be confused, replayed across order types/chains/contracts, or malleated.
+- An order can settle at most once. Individual cancellation and minimum-nonce invalidation cannot be bypassed, grief another maker, collide across types, or create off-by-one validity.
+- Seller/current-owner/approval checks are correct at execution time, including ownership changing away and back; an offer cannot be accepted by a former owner or redirect NFT/proceeds.
+- Gross payment is conserved exactly: artist gets `floor(gross * 250 / 10_000)`, seller gets the remainder, no platform/admin captures value, and zero/dust/maximum values behave safely.
+- Listing settlement accepts exactly the signed ETH amount and cannot retain accidental overpayment. Offer settlement pulls only the signed WETH amount from the signed buyer and cannot spend an unlimited allowance beyond that order.
+- NFT and both payment legs are atomic under all revert/reentrancy/token-callback cases; checks-effects-interactions and guards prevent double fills, stale-state use, and callback manipulation.
+- External-call assumptions are safe for the exact deployed collection, canonical WETH, artist recipient, EOAs, Safe/ERC-1271 wallets, ERC-721 receivers, reverting recipients, and forced ETH. Confirm there is no reachable withdrawal or trapped-fund expectation.
+- Typed-data encoding matches the client fixtures exactly; field omission, type confusion, hash collision, ambiguous packed encoding, deadline boundary, chain fork, and signature replay risks are covered.
+- Denial-of-service and griefing are assessed: rejecting ETH recipient, artist recipient behavior, revoked approvals, insufficient WETH, gas-heavy ERC-1271 checks, front-running, competing fills, self-trades, and cancellation/fill ordering.
+- Immutability and deployment are verified: no proxy/admin backdoor, correct constructor validation, correct mainnet addresses and code hashes, reproducible bytecode, verified source, and correct EIP-712 domain after deployment.
+- Events faithfully represent settlement/cancellation for a reorg-aware indexer and do not allow event-only state to diverge from contract truth.
+
+### Explicitly out of scope for the contract audit
+
+- The already-deployed NFT's source code, metadata/media, rarity, provenance, and any vulnerabilities intrinsic to it, except black-box integration behavior tested on a fork.
+- Canonical WETH and OpenZeppelin internals as standalone codebases, except whether pinned versions are appropriate and used correctly.
+- Web UI, API, database, indexer availability/reorg logic, wallet/RPC providers, DNS/hosting, analytics, and social engineering. A separate application security review should cover order-substitution/phishing, XSS, API abuse, signature presentation, dependency/supply-chain security, secrets, and deployment access.
+- Economic appraisal, wash trading, tax/securities advice, sanctions compliance, marketplace terms, and the enforceability of royalties outside this contract.
+- Features listed as out of MVP scope and any code or configuration changed after the frozen audit commit. Such changes require auditor confirmation or a new scope.
+
+## Deployment and verification runbook requirements
+
+The implementation README must replace placeholders with exact, executable commands for a clean install, tests, fork tests, deployment simulation, mainnet deployment, and source verification. It must list environment variables without committing secrets: mainnet RPC URL, deployer key or hardware-wallet/Safe flow, block explorer API key, collection address, WETH address, and artist recipient.
+
+Before broadcast, independently verify chain ID 1, deployer balance, all constructor addresses and their code, artist multisig owners/threshold, compiler/optimizer settings, clean Git status, passing tests, audit commit, and simulated bytecode. Deploy from a dedicated deployer; because the contract has no admin role, ownership transfer is not applicable. Verify the source and constructor arguments, compare deployed runtime bytecode, inspect immutables/domain separator, and publish the canonical address.
+
+Post-deploy, use low-value tokens/prices approved by their owners to execute: listing signature → buy → royalty/proceeds balance checks; offer signature with exact WETH approval → owner acceptance → balance/ownership checks; individual cancellation; and minimum-nonce invalidation. Confirm emitted events, indexer ingestion after the chosen confirmation depth, zero marketplace token balances, site links/domain, monitoring alerts, and a public support/incident channel. Keep the old Discord manual process read-only during the controlled rollout and never ask users to sign opaque typed data.

tokens used
20,521
Created [plan.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-28T143527Z-codex-with-skill-2/workspace/plan.md).

It covers:

- Four-week implementation and launch plan
- Non-custodial signed listings and WETH offers
- Enforced 2.5% artist fee
- Minimal contract interface and state transitions
- Onchain/offchain boundaries
- Security assumptions and test requirements
- Precise auditor quotation scope
- Deployment, verification, and post-launch runbook

`git diff --check` passes.
