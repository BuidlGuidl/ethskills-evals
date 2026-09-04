OpenAI Codex v0.150.1
--------
workdir: /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-28T143527Z-codex-with-skill-1/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a048cc-10bc-7521-b3cb-ba633b67d522
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

2026-08-28T14:35:28.547288Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a048cc-10bc-7521-b3cb-ba633b67d522.tmp-1787927728318239989: line 2547: syntax error near unexpected token `('

codex
I’m using the `ship` skill because this request needs the marketplace’s onchain boundary, caller/incentive decisions, launch chain, delivery plan, and audit handoff fixed before implementation.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/ship/SKILL.md" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-28T143527Z-codex-with-skill-1/workspace
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
The key product constraint is that non-custodial ETH listings work cleanly, while a later-accepted, non-escrowed offer cannot be denominated in native ETH because a contract cannot pull ETH from a buyer. I’ll scope offers in WETH and make that UX/conversion explicit, with exact signature, nonce, fee, and settlement rules for the auditor.
exec
/bin/bash -lc "rg --files -g '"'!*node_modules*'"' | sed -n '1,120p'" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-28T143527Z-codex-with-skill-1/workspace
 succeeded in 9ms:
TASK.md

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-28T143527Z-codex-with-skill-1/workspace/plan.md
diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..0dd7a97e3360763e6255a6b53d374c1a68fb21e7
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,188 @@
+# Four-week NFT marketplace MVP and audit scope
+
+## 1. Product decision and assumptions
+
+Ship a non-custodial, fixed-price secondary marketplace for the existing 5,000-token ERC-721 collection on Ethereum mainnet. There will be one new custom contract and no upgrade proxy, escrow, marketplace factory, auction, or admin-settable fee.
+
+The MVP assumptions to validate in kickoff are:
+
+- The collection is a standard ERC-721 whose `ownerOf` and `safeTransferFrom` behave normally, and it has no transfer restrictions that would prevent marketplace settlement.
+- The marketplace contract will be approved with `setApprovalForAll` (or token approval) by a seller before a sale can settle. Approval does not transfer custody.
+- The artist royalty recipient is a production multisig. It and the collection address are immutable constructor parameters. The fee is immutable at 250 basis points (2.5%). This marketplace enforces that fee on every settlement through it; it cannot force unrelated marketplaces or peer-to-peer transfers to pay it.
+- Listings are priced and paid in native ETH. Token-specific offers are priced and paid in mainnet WETH. WETH is necessary because native ETH cannot be pulled from a buyer later without escrow; the offer maker must retain enough WETH and allowance until acceptance. The site will explain this and offer a wrap-and-approve flow.
+- Offers are for one specific token, not collection-wide. Partial fills, bundles, auctions, traits, private sales, ERC-1155, delegated wallets, and arbitrary payment tokens are out of scope.
+- Both listings and offers are EIP-712 signed offchain orders. The API indexes them for browsing, but the contract independently validates every fact at settlement. Posting/removing an order in the API is not a security boundary.
+
+Before implementation, verify the actual collection contract on a mainnet fork, including ERC-721 approvals, transfers to contracts, any pause/blocklist mechanism, and existing ERC-2981 behavior. If any assumption is false, freeze the interface and revise this scope before obtaining a fixed audit quote.
+
+## 2. Smallest shippable architecture
+
+### Onchain
+
+One non-upgradeable `CollectionMarketplace` contract:
+
+- stores immutable `collection`, `weth`, and `royaltyRecipient` addresses;
+- verifies typed listing and offer signatures, including ERC-1271 signatures for smart-contract wallets via OpenZeppelin `SignatureChecker`;
+- validates deadline, token ID, nonce, current ownership, approval, exact consideration, and authorized taker where applicable;
+- atomically transfers the NFT and splits payment: 2.5% to the artist and 97.5% to the seller;
+- tracks order-hash cancellation and each account's minimum valid nonce;
+- has a reentrancy guard and emits settlement/cancellation events.
+
+There is no owner/admin role, pause key, upgrade path, custody function, or arbitrary token/native-ETH rescue function. ETH listings require exact `msg.value`, so the contract should finish successful calls with no retained ETH. WETH offer settlement transfers WETH directly from buyer to artist and seller; the marketplace retains no WETH. Accidental direct ETH transfers are rejected by omitting `receive` and payable fallback functions.
+
+Use audited OpenZeppelin primitives for EIP-712, signature checking, safe ERC-20 transfers, and reentrancy protection. Pin compiler and dependency versions in the audit commit.
+
+### Offchain
+
+- Web app: wallet connection, ownership/approval checks, create/sign/cancel listing, buy, create/sign/cancel WETH offer, wrap/approve WETH, accept offer, and transaction status/errors.
+- Indexer/API/database: signed orders, event ingestion, owner/approval state, order validity projection, token metadata, search/filtering, and activity history.
+- IPFS/existing collection metadata remains the display source. Search, sorting, floor price, and activity summaries are derived offchain from chain events; they are never authoritative contract state.
+
+The UI must re-simulate immediately before submission and label stale signatures, expired orders, ownership changes, missing approval, insufficient WETH, and insufficient allowance. It must never represent an API deletion as an onchain cancellation.
+
+## 3. Frozen contract surface for the audit quote
+
+The implementation may use structs internally, but the audited behavior and externally reachable surface is limited to:
+
+```solidity
+struct Listing {
+    address seller;
+    uint256 tokenId;
+    uint256 price;
+    address authorizedBuyer; // zero means public
+    uint256 nonce;
+    uint256 deadline;
+}
+
+struct Offer {
+    address buyer;
+    uint256 tokenId;
+    uint256 price;
+    address authorizedSeller; // zero means current owner
+    uint256 nonce;
+    uint256 deadline;
+}
+
+constructor(address collection, address weth, address royaltyRecipient)
+function buy(Listing calldata listing, bytes calldata signature) external payable nonReentrant
+function acceptOffer(Offer calldata offer, bytes calldata signature) external nonReentrant
+function cancel(bytes32 orderHash) external
+function incrementMinNonce(uint256 newMinNonce) external
+function isCancelled(bytes32 orderHash) external view returns (bool)
+function minNonce(address account) external view returns (uint256)
+function hashListing(Listing calldata listing) external view returns (bytes32)
+function hashOffer(Offer calldata offer) external view returns (bytes32)
+```
+
+Exact rules:
+
+- The EIP-712 domain binds signatures to the marketplace address, Ethereum chain ID, name, and version. Listing and offer have distinct type hashes.
+- `buy` requires an unexpired, uncancelled listing nonce at or above `minNonce[seller]`, valid seller signature, current `ownerOf(tokenId) == seller`, caller equal to `authorizedBuyer` when nonzero, nonzero price, and exact `msg.value == price`. It marks the order consumed before external calls, transfers the NFT from seller to buyer with `safeTransferFrom`, pays `floor(price * 250 / 10_000)` ETH to the artist, and pays the remainder to the seller. Any failed transfer or payout reverts the whole transaction.
+- `acceptOffer` requires the caller to be the current token owner and, when nonzero, equal to `authorizedSeller`; the offer must be unexpired, uncancelled, at or above `minNonce[buyer]`, nonzero-priced, and signed by the buyer. It marks the order consumed before external calls, transfers the NFT from caller to buyer, then uses `safeTransferFrom` on WETH to pull the royalty from buyer to artist and the remainder from buyer to seller. Insufficient balance/allowance or a failed transfer reverts everything.
+- An order hash can settle only once. Cancellation can only be performed by that order's signer; the implementation must either accept the full typed order to derive/authenticate its signer or otherwise prove `msg.sender` is the signer. The final ABI must not rely on an unauthenticated bare hash. `incrementMinNonce` is strictly increasing and invalidates all of the caller's older listing and offer nonces.
+- A transfer or approval change naturally invalidates settlement but does not consume the signature. If the token later returns to the signer while the order remains live, it can become fillable again. The UI warns about this; users use onchain cancellation or nonce invalidation for permanent cancellation.
+- The contract rejects token IDs outside the collection implicitly through `ownerOf`; no hard-coded 5,000 range is needed.
+- No ERC-2981 lookup is performed. The fixed 2.5%/recipient rule is the single royalty rule, avoiding a mutable or malformed external royalty response.
+
+Required events are `ListingFilled(orderHash, seller, buyer, tokenId, price, royalty)`, `OfferFilled(orderHash, buyer, seller, tokenId, price, royalty)`, `OrderCancelled(orderHash, signer)`, and `MinNonceIncremented(signer, oldNonce, newNonce)`. Define custom errors for every validation/failure branch so the UI and audit tests can distinguish them. Names and parameter indexing are frozen before audit.
+
+One ABI issue must be resolved before implementation: replace the illustrative `cancel(bytes32)` above with either `cancelListing(Listing)` and `cancelOffer(Offer)`, or `cancel(bytes32,address signer)` backed by an onchain order-hash-to-signer registration. The recommended minimal design is the two typed cancellation functions because it adds no registration/storage dependency. The auditor's quote should use the resulting final ABI, not the illustrative ambiguous function.
+
+## 4. State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| Sign/post listing | Seller (signature; API request) | Wants the NFT exposed for sale | Nothing is listed; NFT remains owned by seller |
+| `buy` | Buyer | Receives the NFT at the signed price | Listing remains fillable until expiry/cancellation/state invalidation |
+| Sign/post offer | Buyer (signature; API request) | Wants the NFT; retains WETH custody | No offer exists; no funds move |
+| `acceptOffer` | Current owner | Receives 97.5% of the offered WETH | Offer remains fillable until expiry/cancellation/state invalidation |
+| Cancel one order | Order signer | Permanently prevents that signature from settling | It may remain fillable if all validations hold |
+| `incrementMinNonce` | Account invalidating its orders | Cancels many old orders in one transaction | Older signatures remain individually valid |
+
+There are no scheduled transitions, keepers, privileged relayers, or owner-only liveness dependencies.
+
+## 5. Four-week build plan
+
+### Week 1 — freeze behavior and prove compatibility
+
+- Confirm collection, WETH, and artist multisig addresses from authoritative sources; document them without guessing.
+- Fork mainnet and prove buy/transfer/approval behavior against representative collection tokens and the canonical WETH contract.
+- Finalize EIP-712 schemas, typed cancellation ABI, payout ordering, rounding rule, events, errors, threat model, wireframes, and acceptance criteria.
+- Scaffold contract, deployment scripts, app, database schema, and event indexer. Produce deterministic typed-data fixtures shared by Solidity and TypeScript.
+- Exit: signed architecture/interface document, fork compatibility evidence, clickable happy-path UI shell, and audit firm confirms this scope is quoteable.
+
+### Week 2 — complete and test the contract
+
+- Implement the single immutable marketplace and deployment/verification scripts.
+- Unit and fuzz test signatures, ERC-1271, replay, cross-type/domain/chain replay, nonce boundaries, deadline boundaries, private takers, ownership/approval changes, fee rounding, exact ETH, WETH allowance/balance, hostile receivers/tokens, reentrancy, atomic rollback, and event correctness.
+- Add invariants: no order fills twice; only a valid current owner can sell; buyer receives exactly the specified token or the call reverts; artist gets exactly the calculated royalty; seller gets the remainder; successful settlement leaves no marketplace ETH/WETH/NFT custody; contract has no privileged state change.
+- Run static analysis, coverage, formatting, and mainnet-fork end-to-end tests. Freeze a release-candidate commit and provide it to the auditor at week end.
+- Exit: all tests green, high branch coverage on custom contract logic, compiler/dependencies locked, audit begins on a frozen hash.
+
+### Week 3 — vertical product slice while audit runs
+
+- Implement wallet and network guards, ownership gallery, signing, approval, buy, WETH wrap/approve, offer, acceptance, typed cancellation, bulk nonce cancellation, and clear transaction/error states.
+- Implement signature validation at API ingestion, event-driven order reconciliation, confirmations/reorg handling, periodic chain reconciliation, and filtering of currently invalid orders.
+- Add analytics/alerts for failed settlement, indexer lag, RPC failures, and unexpected marketplace balances. Never log signed payloads or sensitive API credentials unnecessarily.
+- Complete browser tests for seller, buyer, smart-wallet signer, stale listing, sold token, expired order, cancellation, insufficient WETH/allowance, rejected signature, and reverted payout.
+- Exit: staging vertical slice passes on a mainnet fork and a public Ethereum test environment; audit findings are triaged without deploying unaudited changes.
+
+### Week 4 — remediate, review, deploy, and launch
+
+- Fix audit findings, add regression tests, and return the exact remediation commit/diff for auditor verification. Any feature or contract-interface change triggers explicit audit-scope review.
+- Have an independent reviewer run the full acceptance checklist against the final commit, including mobile/wallet UX, indexer recovery, reorg simulation, and mainnet-fork settlements.
+- Deploy the exact audited bytecode to Ethereum mainnet, verify source, verify immutable values, seed/index historical metadata, and execute a low-value end-to-end sale and offer with team-owned tokens/accounts.
+- Publish contract address, verified-source link, fee/royalty disclosure, WETH-offer explanation, cancellation semantics, risk notice, and support/runbook documentation. Monitor closely and keep a launch rollback switch for the web UI only; the immutable contract cannot be paused.
+- Exit: auditor confirms remediation, bytecode matches audited build, smoke transactions and balance assertions pass, monitoring is live, and sign-off is recorded.
+
+The schedule assumes an auditor is booked before week 1 and starts at the end of week 2. Audit delay moves mainnet launch; it does not justify deploying the unaudited contract.
+
+## 6. Precise audit scope
+
+### In scope
+
+1. The final `CollectionMarketplace.sol` and every inherited or linked Solidity source compiled into it.
+2. The pinned OpenZeppelin contracts actually imported: EIP-712/signature checking, ERC-20 safe transfer, ERC-721 interfaces/receiver interactions as applicable, and reentrancy guard.
+3. Deployment and constructor-argument scripts insofar as they select chain ID, collection, canonical mainnet WETH, royalty multisig, compiler settings, optimizer settings, and deployed bytecode.
+4. Solidity unit, fuzz, invariant, and mainnet-fork tests as supporting evidence (tests are reviewed but are not a substitute for contract review).
+5. EIP-712 schema/constants and the TypeScript encoder fixture solely for equivalence with Solidity hashes.
+6. Integration assumptions for the exact existing collection and canonical WETH contracts, using their verified mainnet bytecode/interfaces. Those third-party contracts are not re-audited, but unusual behavior and integration risk are assessed.
+7. All externally reachable paths and trust boundaries described above: listing purchase, offer acceptance, individual/bulk cancellation, ETH/WETH payout, ERC-1271, ERC-721 callbacks, event truthfulness, and immutable configuration.
+
+Ask the auditor to assess at minimum: authorization and signature malleability; replay across orders/types/contracts/chains; nonce/cancellation correctness; stale ownership and approvals; frontrunning and authorized takers; self-sale; reentrancy/callback ordering; checks-effects-interactions; fee math/rounding; ETH accounting and forced ETH; WETH return-value/nonstandard behavior; atomicity; denial of service by payout recipients or ERC-1271 wallets; hostile buyer/seller contracts; event/indexer ambiguity; constructor misconfiguration; lack of admin recovery/pause; and compliance of the bytecode/build with the reviewed source.
+
+### Explicitly out of scope
+
+- The existing NFT and WETH implementations beyond integration assumptions; wallets, RPC providers, IPFS, metadata, and marketplace contracts not deployed by this project.
+- Frontend, API, database, indexer availability/security, cloud/IAM, DNS, analytics, and wallet-extension internals, except the typed-data encoder fixture noted above. These need separate application security and operational review.
+- Royalty enforcement outside this marketplace, legal/tax/regulatory conclusions, economic appraisal, wash trading, phishing/social engineering, private-key/multisig signer compromise, and marketplace discovery/traffic.
+- Auctions, bids requiring native-ETH escrow, collection offers, bundles, ERC-1155, lazy minting, permits, meta-transactions/relayers, delegated registries, arbitrary currencies/collections, upgradeability, pausing, fee changes, fee splitters, and recovery functions.
+
+### Quote package and change control
+
+Give the auditor: repository commit hash; exact in-scope file list and lines of Solidity; compiler/optimizer/EVM target and dependency lockfile; final ABI, storage layout, EIP-712 schemas and fixtures; architecture/payment-flow diagram; this threat model and invariants; test and coverage reports; static-analysis output; verified addresses and fork block; known issues; deployment script and intended constructor arguments.
+
+Request separate quote lines for (a) initial review, (b) one remediation review covering only fixes, and (c) optional deployment-bytecode verification. State the expected delivery dates needed for week 4. After scope freeze, record every Solidity, dependency, compiler-setting, constructor, or typed-data change in a diff manifest. New functionality or a changed trust boundary is a new audit scope; narrowly corrective changes receive remediation review. Mainnet deployment is gated on written closure or explicit risk acceptance for every finding.
+
+## 7. Deployment runbook and release gates
+
+The repository README must contain executable commands using the chosen framework for build, full tests, fixed-block mainnet-fork tests, deterministic deployment, source verification, and bytecode comparison. Do not invent commands until the framework is selected in week 1. Required secrets/configuration are an Ethereum mainnet RPC URL, block-explorer API key, deployer key/hardware-wallet path, collection address, canonical WETH address, royalty multisig, and deployer funding; secrets stay outside the repository.
+
+Pre-deploy gates:
+
+- final commit and bytecode are covered by audit/remediation confirmation;
+- chain ID is 1; all three constructor addresses are nonzero, checksummed, independently verified, and approved by two people;
+- royalty recipient is the intended multisig and its signer/recovery policy has been tested;
+- fork tests pass against the selected recent block and CI reproduces the build;
+- frontend/API point to the computed deployment address only after verified source and immutable values are checked.
+
+Post-deploy smoke test:
+
+1. Verify source and compare runtime bytecode with the audited artifact.
+2. Read and record all immutables and the EIP-712 domain.
+3. With a team-owned NFT, approve the marketplace, sign a low-price listing, buy it from a second account, and assert NFT ownership plus the exact 2.5%/97.5% ETH split.
+4. Wrap/approve WETH from the first account, sign a token offer, accept it from the current owner, and assert ownership plus the exact WETH split.
+5. Sign and cancel one order and bulk-invalidate another; prove both settlement attempts revert.
+6. Confirm indexed events match receipts and the marketplace holds no NFT, ETH, or WETH attributable to successful settlements.
+
+If a smoke step fails, keep creation and display of new orders disabled in the web UI, publish status, preserve evidence, and investigate. Because the contract is immutable and unpausable, do not advertise it as ready until every gate passes.

diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..0dd7a97e3360763e6255a6b53d374c1a68fb21e7
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,188 @@
+# Four-week NFT marketplace MVP and audit scope
+
+## 1. Product decision and assumptions
+
+Ship a non-custodial, fixed-price secondary marketplace for the existing 5,000-token ERC-721 collection on Ethereum mainnet. There will be one new custom contract and no upgrade proxy, escrow, marketplace factory, auction, or admin-settable fee.
+
+The MVP assumptions to validate in kickoff are:
+
+- The collection is a standard ERC-721 whose `ownerOf` and `safeTransferFrom` behave normally, and it has no transfer restrictions that would prevent marketplace settlement.
+- The marketplace contract will be approved with `setApprovalForAll` (or token approval) by a seller before a sale can settle. Approval does not transfer custody.
+- The artist royalty recipient is a production multisig. It and the collection address are immutable constructor parameters. The fee is immutable at 250 basis points (2.5%). This marketplace enforces that fee on every settlement through it; it cannot force unrelated marketplaces or peer-to-peer transfers to pay it.
+- Listings are priced and paid in native ETH. Token-specific offers are priced and paid in mainnet WETH. WETH is necessary because native ETH cannot be pulled from a buyer later without escrow; the offer maker must retain enough WETH and allowance until acceptance. The site will explain this and offer a wrap-and-approve flow.
+- Offers are for one specific token, not collection-wide. Partial fills, bundles, auctions, traits, private sales, ERC-1155, delegated wallets, and arbitrary payment tokens are out of scope.
+- Both listings and offers are EIP-712 signed offchain orders. The API indexes them for browsing, but the contract independently validates every fact at settlement. Posting/removing an order in the API is not a security boundary.
+
+Before implementation, verify the actual collection contract on a mainnet fork, including ERC-721 approvals, transfers to contracts, any pause/blocklist mechanism, and existing ERC-2981 behavior. If any assumption is false, freeze the interface and revise this scope before obtaining a fixed audit quote.
+
+## 2. Smallest shippable architecture
+
+### Onchain
+
+One non-upgradeable `CollectionMarketplace` contract:
+
+- stores immutable `collection`, `weth`, and `royaltyRecipient` addresses;
+- verifies typed listing and offer signatures, including ERC-1271 signatures for smart-contract wallets via OpenZeppelin `SignatureChecker`;
+- validates deadline, token ID, nonce, current ownership, approval, exact consideration, and authorized taker where applicable;
+- atomically transfers the NFT and splits payment: 2.5% to the artist and 97.5% to the seller;
+- tracks order-hash cancellation and each account's minimum valid nonce;
+- has a reentrancy guard and emits settlement/cancellation events.
+
+There is no owner/admin role, pause key, upgrade path, custody function, or arbitrary token/native-ETH rescue function. ETH listings require exact `msg.value`, so the contract should finish successful calls with no retained ETH. WETH offer settlement transfers WETH directly from buyer to artist and seller; the marketplace retains no WETH. Accidental direct ETH transfers are rejected by omitting `receive` and payable fallback functions.
+
+Use audited OpenZeppelin primitives for EIP-712, signature checking, safe ERC-20 transfers, and reentrancy protection. Pin compiler and dependency versions in the audit commit.
+
+### Offchain
+
+- Web app: wallet connection, ownership/approval checks, create/sign/cancel listing, buy, create/sign/cancel WETH offer, wrap/approve WETH, accept offer, and transaction status/errors.
+- Indexer/API/database: signed orders, event ingestion, owner/approval state, order validity projection, token metadata, search/filtering, and activity history.
+- IPFS/existing collection metadata remains the display source. Search, sorting, floor price, and activity summaries are derived offchain from chain events; they are never authoritative contract state.
+
+The UI must re-simulate immediately before submission and label stale signatures, expired orders, ownership changes, missing approval, insufficient WETH, and insufficient allowance. It must never represent an API deletion as an onchain cancellation.
+
+## 3. Frozen contract surface for the audit quote
+
+The implementation may use structs internally, but the audited behavior and externally reachable surface is limited to:
+
+```solidity
+struct Listing {
+    address seller;
+    uint256 tokenId;
+    uint256 price;
+    address authorizedBuyer; // zero means public
+    uint256 nonce;
+    uint256 deadline;
+}
+
+struct Offer {
+    address buyer;
+    uint256 tokenId;
+    uint256 price;
+    address authorizedSeller; // zero means current owner
+    uint256 nonce;
+    uint256 deadline;
+}
+
+constructor(address collection, address weth, address royaltyRecipient)
+function buy(Listing calldata listing, bytes calldata signature) external payable nonReentrant
+function acceptOffer(Offer calldata offer, bytes calldata signature) external nonReentrant
+function cancel(bytes32 orderHash) external
+function incrementMinNonce(uint256 newMinNonce) external
+function isCancelled(bytes32 orderHash) external view returns (bool)
+function minNonce(address account) external view returns (uint256)
+function hashListing(Listing calldata listing) external view returns (bytes32)
+function hashOffer(Offer calldata offer) external view returns (bytes32)
+```
+
+Exact rules:
+
+- The EIP-712 domain binds signatures to the marketplace address, Ethereum chain ID, name, and version. Listing and offer have distinct type hashes.
+- `buy` requires an unexpired, uncancelled listing nonce at or above `minNonce[seller]`, valid seller signature, current `ownerOf(tokenId) == seller`, caller equal to `authorizedBuyer` when nonzero, nonzero price, and exact `msg.value == price`. It marks the order consumed before external calls, transfers the NFT from seller to buyer with `safeTransferFrom`, pays `floor(price * 250 / 10_000)` ETH to the artist, and pays the remainder to the seller. Any failed transfer or payout reverts the whole transaction.
+- `acceptOffer` requires the caller to be the current token owner and, when nonzero, equal to `authorizedSeller`; the offer must be unexpired, uncancelled, at or above `minNonce[buyer]`, nonzero-priced, and signed by the buyer. It marks the order consumed before external calls, transfers the NFT from caller to buyer, then uses `safeTransferFrom` on WETH to pull the royalty from buyer to artist and the remainder from buyer to seller. Insufficient balance/allowance or a failed transfer reverts everything.
+- An order hash can settle only once. Cancellation can only be performed by that order's signer; the implementation must either accept the full typed order to derive/authenticate its signer or otherwise prove `msg.sender` is the signer. The final ABI must not rely on an unauthenticated bare hash. `incrementMinNonce` is strictly increasing and invalidates all of the caller's older listing and offer nonces.
+- A transfer or approval change naturally invalidates settlement but does not consume the signature. If the token later returns to the signer while the order remains live, it can become fillable again. The UI warns about this; users use onchain cancellation or nonce invalidation for permanent cancellation.
+- The contract rejects token IDs outside the collection implicitly through `ownerOf`; no hard-coded 5,000 range is needed.
+- No ERC-2981 lookup is performed. The fixed 2.5%/recipient rule is the single royalty rule, avoiding a mutable or malformed external royalty response.
+
+Required events are `ListingFilled(orderHash, seller, buyer, tokenId, price, royalty)`, `OfferFilled(orderHash, buyer, seller, tokenId, price, royalty)`, `OrderCancelled(orderHash, signer)`, and `MinNonceIncremented(signer, oldNonce, newNonce)`. Define custom errors for every validation/failure branch so the UI and audit tests can distinguish them. Names and parameter indexing are frozen before audit.
+
+One ABI issue must be resolved before implementation: replace the illustrative `cancel(bytes32)` above with either `cancelListing(Listing)` and `cancelOffer(Offer)`, or `cancel(bytes32,address signer)` backed by an onchain order-hash-to-signer registration. The recommended minimal design is the two typed cancellation functions because it adds no registration/storage dependency. The auditor's quote should use the resulting final ABI, not the illustrative ambiguous function.
+
+## 4. State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| Sign/post listing | Seller (signature; API request) | Wants the NFT exposed for sale | Nothing is listed; NFT remains owned by seller |
+| `buy` | Buyer | Receives the NFT at the signed price | Listing remains fillable until expiry/cancellation/state invalidation |
+| Sign/post offer | Buyer (signature; API request) | Wants the NFT; retains WETH custody | No offer exists; no funds move |
+| `acceptOffer` | Current owner | Receives 97.5% of the offered WETH | Offer remains fillable until expiry/cancellation/state invalidation |
+| Cancel one order | Order signer | Permanently prevents that signature from settling | It may remain fillable if all validations hold |
+| `incrementMinNonce` | Account invalidating its orders | Cancels many old orders in one transaction | Older signatures remain individually valid |
+
+There are no scheduled transitions, keepers, privileged relayers, or owner-only liveness dependencies.
+
+## 5. Four-week build plan
+
+### Week 1 — freeze behavior and prove compatibility
+
+- Confirm collection, WETH, and artist multisig addresses from authoritative sources; document them without guessing.
+- Fork mainnet and prove buy/transfer/approval behavior against representative collection tokens and the canonical WETH contract.
+- Finalize EIP-712 schemas, typed cancellation ABI, payout ordering, rounding rule, events, errors, threat model, wireframes, and acceptance criteria.
+- Scaffold contract, deployment scripts, app, database schema, and event indexer. Produce deterministic typed-data fixtures shared by Solidity and TypeScript.
+- Exit: signed architecture/interface document, fork compatibility evidence, clickable happy-path UI shell, and audit firm confirms this scope is quoteable.
+
+### Week 2 — complete and test the contract
+
+- Implement the single immutable marketplace and deployment/verification scripts.
+- Unit and fuzz test signatures, ERC-1271, replay, cross-type/domain/chain replay, nonce boundaries, deadline boundaries, private takers, ownership/approval changes, fee rounding, exact ETH, WETH allowance/balance, hostile receivers/tokens, reentrancy, atomic rollback, and event correctness.
+- Add invariants: no order fills twice; only a valid current owner can sell; buyer receives exactly the specified token or the call reverts; artist gets exactly the calculated royalty; seller gets the remainder; successful settlement leaves no marketplace ETH/WETH/NFT custody; contract has no privileged state change.
+- Run static analysis, coverage, formatting, and mainnet-fork end-to-end tests. Freeze a release-candidate commit and provide it to the auditor at week end.
+- Exit: all tests green, high branch coverage on custom contract logic, compiler/dependencies locked, audit begins on a frozen hash.
+
+### Week 3 — vertical product slice while audit runs
+
+- Implement wallet and network guards, ownership gallery, signing, approval, buy, WETH wrap/approve, offer, acceptance, typed cancellation, bulk nonce cancellation, and clear transaction/error states.
+- Implement signature validation at API ingestion, event-driven order reconciliation, confirmations/reorg handling, periodic chain reconciliation, and filtering of currently invalid orders.
+- Add analytics/alerts for failed settlement, indexer lag, RPC failures, and unexpected marketplace balances. Never log signed payloads or sensitive API credentials unnecessarily.
+- Complete browser tests for seller, buyer, smart-wallet signer, stale listing, sold token, expired order, cancellation, insufficient WETH/allowance, rejected signature, and reverted payout.
+- Exit: staging vertical slice passes on a mainnet fork and a public Ethereum test environment; audit findings are triaged without deploying unaudited changes.
+
+### Week 4 — remediate, review, deploy, and launch
+
+- Fix audit findings, add regression tests, and return the exact remediation commit/diff for auditor verification. Any feature or contract-interface change triggers explicit audit-scope review.
+- Have an independent reviewer run the full acceptance checklist against the final commit, including mobile/wallet UX, indexer recovery, reorg simulation, and mainnet-fork settlements.
+- Deploy the exact audited bytecode to Ethereum mainnet, verify source, verify immutable values, seed/index historical metadata, and execute a low-value end-to-end sale and offer with team-owned tokens/accounts.
+- Publish contract address, verified-source link, fee/royalty disclosure, WETH-offer explanation, cancellation semantics, risk notice, and support/runbook documentation. Monitor closely and keep a launch rollback switch for the web UI only; the immutable contract cannot be paused.
+- Exit: auditor confirms remediation, bytecode matches audited build, smoke transactions and balance assertions pass, monitoring is live, and sign-off is recorded.
+
+The schedule assumes an auditor is booked before week 1 and starts at the end of week 2. Audit delay moves mainnet launch; it does not justify deploying the unaudited contract.
+
+## 6. Precise audit scope
+
+### In scope
+
+1. The final `CollectionMarketplace.sol` and every inherited or linked Solidity source compiled into it.
+2. The pinned OpenZeppelin contracts actually imported: EIP-712/signature checking, ERC-20 safe transfer, ERC-721 interfaces/receiver interactions as applicable, and reentrancy guard.
+3. Deployment and constructor-argument scripts insofar as they select chain ID, collection, canonical mainnet WETH, royalty multisig, compiler settings, optimizer settings, and deployed bytecode.
+4. Solidity unit, fuzz, invariant, and mainnet-fork tests as supporting evidence (tests are reviewed but are not a substitute for contract review).
+5. EIP-712 schema/constants and the TypeScript encoder fixture solely for equivalence with Solidity hashes.
+6. Integration assumptions for the exact existing collection and canonical WETH contracts, using their verified mainnet bytecode/interfaces. Those third-party contracts are not re-audited, but unusual behavior and integration risk are assessed.
+7. All externally reachable paths and trust boundaries described above: listing purchase, offer acceptance, individual/bulk cancellation, ETH/WETH payout, ERC-1271, ERC-721 callbacks, event truthfulness, and immutable configuration.
+
+Ask the auditor to assess at minimum: authorization and signature malleability; replay across orders/types/contracts/chains; nonce/cancellation correctness; stale ownership and approvals; frontrunning and authorized takers; self-sale; reentrancy/callback ordering; checks-effects-interactions; fee math/rounding; ETH accounting and forced ETH; WETH return-value/nonstandard behavior; atomicity; denial of service by payout recipients or ERC-1271 wallets; hostile buyer/seller contracts; event/indexer ambiguity; constructor misconfiguration; lack of admin recovery/pause; and compliance of the bytecode/build with the reviewed source.
+
+### Explicitly out of scope
+
+- The existing NFT and WETH implementations beyond integration assumptions; wallets, RPC providers, IPFS, metadata, and marketplace contracts not deployed by this project.
+- Frontend, API, database, indexer availability/security, cloud/IAM, DNS, analytics, and wallet-extension internals, except the typed-data encoder fixture noted above. These need separate application security and operational review.
+- Royalty enforcement outside this marketplace, legal/tax/regulatory conclusions, economic appraisal, wash trading, phishing/social engineering, private-key/multisig signer compromise, and marketplace discovery/traffic.
+- Auctions, bids requiring native-ETH escrow, collection offers, bundles, ERC-1155, lazy minting, permits, meta-transactions/relayers, delegated registries, arbitrary currencies/collections, upgradeability, pausing, fee changes, fee splitters, and recovery functions.
+
+### Quote package and change control
+
+Give the auditor: repository commit hash; exact in-scope file list and lines of Solidity; compiler/optimizer/EVM target and dependency lockfile; final ABI, storage layout, EIP-712 schemas and fixtures; architecture/payment-flow diagram; this threat model and invariants; test and coverage reports; static-analysis output; verified addresses and fork block; known issues; deployment script and intended constructor arguments.
+
+Request separate quote lines for (a) initial review, (b) one remediation review covering only fixes, and (c) optional deployment-bytecode verification. State the expected delivery dates needed for week 4. After scope freeze, record every Solidity, dependency, compiler-setting, constructor, or typed-data change in a diff manifest. New functionality or a changed trust boundary is a new audit scope; narrowly corrective changes receive remediation review. Mainnet deployment is gated on written closure or explicit risk acceptance for every finding.
+
+## 7. Deployment runbook and release gates
+
+The repository README must contain executable commands using the chosen framework for build, full tests, fixed-block mainnet-fork tests, deterministic deployment, source verification, and bytecode comparison. Do not invent commands until the framework is selected in week 1. Required secrets/configuration are an Ethereum mainnet RPC URL, block-explorer API key, deployer key/hardware-wallet path, collection address, canonical WETH address, royalty multisig, and deployer funding; secrets stay outside the repository.
+
+Pre-deploy gates:
+
+- final commit and bytecode are covered by audit/remediation confirmation;
+- chain ID is 1; all three constructor addresses are nonzero, checksummed, independently verified, and approved by two people;
+- royalty recipient is the intended multisig and its signer/recovery policy has been tested;
+- fork tests pass against the selected recent block and CI reproduces the build;
+- frontend/API point to the computed deployment address only after verified source and immutable values are checked.
+
+Post-deploy smoke test:
+
+1. Verify source and compare runtime bytecode with the audited artifact.
+2. Read and record all immutables and the EIP-712 domain.
+3. With a team-owned NFT, approve the marketplace, sign a low-price listing, buy it from a second account, and assert NFT ownership plus the exact 2.5%/97.5% ETH split.
+4. Wrap/approve WETH from the first account, sign a token offer, accept it from the current owner, and assert ownership plus the exact WETH split.
+5. Sign and cancel one order and bulk-invalidate another; prove both settlement attempts revert.
+6. Confirm indexed events match receipts and the marketplace holds no NFT, ETH, or WETH attributable to successful settlements.
+
+If a smoke step fails, keep creation and display of new orders disabled in the web UI, publish status, preserve evidence, and investigate. Because the contract is immutable and unpausable, do not advertise it as ready until every gate passes.

codex
The plan is drafted with a one-contract, immutable design and a frozen behavioral surface. I’m doing a final consistency pass now, especially around cancellation authorization and whether the audit quote can be based on an unambiguous ABI.
exec
/bin/bash -lc "wc -l plan.md && rg -n \"TBD|illustrative|cancel\\(\" plan.md && sed -n '1,35p' plan.md" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-28T143527Z-codex-with-skill-1/workspace
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
188 plan.md
69:function cancel(bytes32 orderHash) external
89:One ABI issue must be resolved before implementation: replace the illustrative `cancel(bytes32)` above with either `cancelListing(Listing)` and `cancelOffer(Offer)`, or `cancel(bytes32,address signer)` backed by an onchain order-hash-to-signer registration. The recommended minimal design is the two typed cancellation functions because it adds no registration/storage dependency. The auditor's quote should use the resulting final ABI, not the illustrative ambiguous function.
# Four-week NFT marketplace MVP and audit scope

## 1. Product decision and assumptions

Ship a non-custodial, fixed-price secondary marketplace for the existing 5,000-token ERC-721 collection on Ethereum mainnet. There will be one new custom contract and no upgrade proxy, escrow, marketplace factory, auction, or admin-settable fee.

The MVP assumptions to validate in kickoff are:

- The collection is a standard ERC-721 whose `ownerOf` and `safeTransferFrom` behave normally, and it has no transfer restrictions that would prevent marketplace settlement.
- The marketplace contract will be approved with `setApprovalForAll` (or token approval) by a seller before a sale can settle. Approval does not transfer custody.
- The artist royalty recipient is a production multisig. It and the collection address are immutable constructor parameters. The fee is immutable at 250 basis points (2.5%). This marketplace enforces that fee on every settlement through it; it cannot force unrelated marketplaces or peer-to-peer transfers to pay it.
- Listings are priced and paid in native ETH. Token-specific offers are priced and paid in mainnet WETH. WETH is necessary because native ETH cannot be pulled from a buyer later without escrow; the offer maker must retain enough WETH and allowance until acceptance. The site will explain this and offer a wrap-and-approve flow.
- Offers are for one specific token, not collection-wide. Partial fills, bundles, auctions, traits, private sales, ERC-1155, delegated wallets, and arbitrary payment tokens are out of scope.
- Both listings and offers are EIP-712 signed offchain orders. The API indexes them for browsing, but the contract independently validates every fact at settlement. Posting/removing an order in the API is not a security boundary.

Before implementation, verify the actual collection contract on a mainnet fork, including ERC-721 approvals, transfers to contracts, any pause/blocklist mechanism, and existing ERC-2981 behavior. If any assumption is false, freeze the interface and revise this scope before obtaining a fixed audit quote.

## 2. Smallest shippable architecture

### Onchain

One non-upgradeable `CollectionMarketplace` contract:

- stores immutable `collection`, `weth`, and `royaltyRecipient` addresses;
- verifies typed listing and offer signatures, including ERC-1271 signatures for smart-contract wallets via OpenZeppelin `SignatureChecker`;
- validates deadline, token ID, nonce, current ownership, approval, exact consideration, and authorized taker where applicable;
- atomically transfers the NFT and splits payment: 2.5% to the artist and 97.5% to the seller;
- tracks order-hash cancellation and each account's minimum valid nonce;
- has a reentrancy guard and emits settlement/cancellation events.

There is no owner/admin role, pause key, upgrade path, custody function, or arbitrary token/native-ETH rescue function. ETH listings require exact `msg.value`, so the contract should finish successful calls with no retained ETH. WETH offer settlement transfers WETH directly from buyer to artist and seller; the marketplace retains no WETH. Accidental direct ETH transfers are rejected by omitting `receive` and payable fallback functions.

Use audited OpenZeppelin primitives for EIP-712, signature checking, safe ERC-20 transfers, and reentrancy protection. Pin compiler and dependency versions in the audit commit.

### Offchain

diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..0dd7a97e3360763e6255a6b53d374c1a68fb21e7
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,188 @@
+# Four-week NFT marketplace MVP and audit scope
+
+## 1. Product decision and assumptions
+
+Ship a non-custodial, fixed-price secondary marketplace for the existing 5,000-token ERC-721 collection on Ethereum mainnet. There will be one new custom contract and no upgrade proxy, escrow, marketplace factory, auction, or admin-settable fee.
+
+The MVP assumptions to validate in kickoff are:
+
+- The collection is a standard ERC-721 whose `ownerOf` and `safeTransferFrom` behave normally, and it has no transfer restrictions that would prevent marketplace settlement.
+- The marketplace contract will be approved with `setApprovalForAll` (or token approval) by a seller before a sale can settle. Approval does not transfer custody.
+- The artist royalty recipient is a production multisig. It and the collection address are immutable constructor parameters. The fee is immutable at 250 basis points (2.5%). This marketplace enforces that fee on every settlement through it; it cannot force unrelated marketplaces or peer-to-peer transfers to pay it.
+- Listings are priced and paid in native ETH. Token-specific offers are priced and paid in mainnet WETH. WETH is necessary because native ETH cannot be pulled from a buyer later without escrow; the offer maker must retain enough WETH and allowance until acceptance. The site will explain this and offer a wrap-and-approve flow.
+- Offers are for one specific token, not collection-wide. Partial fills, bundles, auctions, traits, private sales, ERC-1155, delegated wallets, and arbitrary payment tokens are out of scope.
+- Both listings and offers are EIP-712 signed offchain orders. The API indexes them for browsing, but the contract independently validates every fact at settlement. Posting/removing an order in the API is not a security boundary.
+
+Before implementation, verify the actual collection contract on a mainnet fork, including ERC-721 approvals, transfers to contracts, any pause/blocklist mechanism, and existing ERC-2981 behavior. If any assumption is false, freeze the interface and revise this scope before obtaining a fixed audit quote.
+
+## 2. Smallest shippable architecture
+
+### Onchain
+
+One non-upgradeable `CollectionMarketplace` contract:
+
+- stores immutable `collection`, `weth`, and `royaltyRecipient` addresses;
+- verifies typed listing and offer signatures, including ERC-1271 signatures for smart-contract wallets via OpenZeppelin `SignatureChecker`;
+- validates deadline, token ID, nonce, current ownership, approval, exact consideration, and authorized taker where applicable;
+- atomically transfers the NFT and splits payment: 2.5% to the artist and 97.5% to the seller;
+- tracks order-hash cancellation and each account's minimum valid nonce;
+- has a reentrancy guard and emits settlement/cancellation events.
+
+There is no owner/admin role, pause key, upgrade path, custody function, or arbitrary token/native-ETH rescue function. ETH listings require exact `msg.value`, so the contract should finish successful calls with no retained ETH. WETH offer settlement transfers WETH directly from buyer to artist and seller; the marketplace retains no WETH. Accidental direct ETH transfers are rejected by omitting `receive` and payable fallback functions.
+
+Use audited OpenZeppelin primitives for EIP-712, signature checking, safe ERC-20 transfers, and reentrancy protection. Pin compiler and dependency versions in the audit commit.
+
+### Offchain
+
+- Web app: wallet connection, ownership/approval checks, create/sign/cancel listing, buy, create/sign/cancel WETH offer, wrap/approve WETH, accept offer, and transaction status/errors.
+- Indexer/API/database: signed orders, event ingestion, owner/approval state, order validity projection, token metadata, search/filtering, and activity history.
+- IPFS/existing collection metadata remains the display source. Search, sorting, floor price, and activity summaries are derived offchain from chain events; they are never authoritative contract state.
+
+The UI must re-simulate immediately before submission and label stale signatures, expired orders, ownership changes, missing approval, insufficient WETH, and insufficient allowance. It must never represent an API deletion as an onchain cancellation.
+
+## 3. Frozen contract surface for the audit quote
+
+The implementation may use structs internally, but the audited behavior and externally reachable surface is limited to:
+
+```solidity
+struct Listing {
+    address seller;
+    uint256 tokenId;
+    uint256 price;
+    address authorizedBuyer; // zero means public
+    uint256 nonce;
+    uint256 deadline;
+}
+
+struct Offer {
+    address buyer;
+    uint256 tokenId;
+    uint256 price;
+    address authorizedSeller; // zero means current owner
+    uint256 nonce;
+    uint256 deadline;
+}
+
+constructor(address collection, address weth, address royaltyRecipient)
+function buy(Listing calldata listing, bytes calldata signature) external payable nonReentrant
+function acceptOffer(Offer calldata offer, bytes calldata signature) external nonReentrant
+function cancel(bytes32 orderHash) external
+function incrementMinNonce(uint256 newMinNonce) external
+function isCancelled(bytes32 orderHash) external view returns (bool)
+function minNonce(address account) external view returns (uint256)
+function hashListing(Listing calldata listing) external view returns (bytes32)
+function hashOffer(Offer calldata offer) external view returns (bytes32)
+```
+
+Exact rules:
+
+- The EIP-712 domain binds signatures to the marketplace address, Ethereum chain ID, name, and version. Listing and offer have distinct type hashes.
+- `buy` requires an unexpired, uncancelled listing nonce at or above `minNonce[seller]`, valid seller signature, current `ownerOf(tokenId) == seller`, caller equal to `authorizedBuyer` when nonzero, nonzero price, and exact `msg.value == price`. It marks the order consumed before external calls, transfers the NFT from seller to buyer with `safeTransferFrom`, pays `floor(price * 250 / 10_000)` ETH to the artist, and pays the remainder to the seller. Any failed transfer or payout reverts the whole transaction.
+- `acceptOffer` requires the caller to be the current token owner and, when nonzero, equal to `authorizedSeller`; the offer must be unexpired, uncancelled, at or above `minNonce[buyer]`, nonzero-priced, and signed by the buyer. It marks the order consumed before external calls, transfers the NFT from caller to buyer, then uses `safeTransferFrom` on WETH to pull the royalty from buyer to artist and the remainder from buyer to seller. Insufficient balance/allowance or a failed transfer reverts everything.
+- An order hash can settle only once. Cancellation can only be performed by that order's signer; the implementation must either accept the full typed order to derive/authenticate its signer or otherwise prove `msg.sender` is the signer. The final ABI must not rely on an unauthenticated bare hash. `incrementMinNonce` is strictly increasing and invalidates all of the caller's older listing and offer nonces.
+- A transfer or approval change naturally invalidates settlement but does not consume the signature. If the token later returns to the signer while the order remains live, it can become fillable again. The UI warns about this; users use onchain cancellation or nonce invalidation for permanent cancellation.
+- The contract rejects token IDs outside the collection implicitly through `ownerOf`; no hard-coded 5,000 range is needed.
+- No ERC-2981 lookup is performed. The fixed 2.5%/recipient rule is the single royalty rule, avoiding a mutable or malformed external royalty response.
+
+Required events are `ListingFilled(orderHash, seller, buyer, tokenId, price, royalty)`, `OfferFilled(orderHash, buyer, seller, tokenId, price, royalty)`, `OrderCancelled(orderHash, signer)`, and `MinNonceIncremented(signer, oldNonce, newNonce)`. Define custom errors for every validation/failure branch so the UI and audit tests can distinguish them. Names and parameter indexing are frozen before audit.
+
+One ABI issue must be resolved before implementation: replace the illustrative `cancel(bytes32)` above with either `cancelListing(Listing)` and `cancelOffer(Offer)`, or `cancel(bytes32,address signer)` backed by an onchain order-hash-to-signer registration. The recommended minimal design is the two typed cancellation functions because it adds no registration/storage dependency. The auditor's quote should use the resulting final ABI, not the illustrative ambiguous function.
+
+## 4. State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| Sign/post listing | Seller (signature; API request) | Wants the NFT exposed for sale | Nothing is listed; NFT remains owned by seller |
+| `buy` | Buyer | Receives the NFT at the signed price | Listing remains fillable until expiry/cancellation/state invalidation |
+| Sign/post offer | Buyer (signature; API request) | Wants the NFT; retains WETH custody | No offer exists; no funds move |
+| `acceptOffer` | Current owner | Receives 97.5% of the offered WETH | Offer remains fillable until expiry/cancellation/state invalidation |
+| Cancel one order | Order signer | Permanently prevents that signature from settling | It may remain fillable if all validations hold |
+| `incrementMinNonce` | Account invalidating its orders | Cancels many old orders in one transaction | Older signatures remain individually valid |
+
+There are no scheduled transitions, keepers, privileged relayers, or owner-only liveness dependencies.
+
+## 5. Four-week build plan
+
+### Week 1 — freeze behavior and prove compatibility
+
+- Confirm collection, WETH, and artist multisig addresses from authoritative sources; document them without guessing.
+- Fork mainnet and prove buy/transfer/approval behavior against representative collection tokens and the canonical WETH contract.
+- Finalize EIP-712 schemas, typed cancellation ABI, payout ordering, rounding rule, events, errors, threat model, wireframes, and acceptance criteria.
+- Scaffold contract, deployment scripts, app, database schema, and event indexer. Produce deterministic typed-data fixtures shared by Solidity and TypeScript.
+- Exit: signed architecture/interface document, fork compatibility evidence, clickable happy-path UI shell, and audit firm confirms this scope is quoteable.
+
+### Week 2 — complete and test the contract
+
+- Implement the single immutable marketplace and deployment/verification scripts.
+- Unit and fuzz test signatures, ERC-1271, replay, cross-type/domain/chain replay, nonce boundaries, deadline boundaries, private takers, ownership/approval changes, fee rounding, exact ETH, WETH allowance/balance, hostile receivers/tokens, reentrancy, atomic rollback, and event correctness.
+- Add invariants: no order fills twice; only a valid current owner can sell; buyer receives exactly the specified token or the call reverts; artist gets exactly the calculated royalty; seller gets the remainder; successful settlement leaves no marketplace ETH/WETH/NFT custody; contract has no privileged state change.
+- Run static analysis, coverage, formatting, and mainnet-fork end-to-end tests. Freeze a release-candidate commit and provide it to the auditor at week end.
+- Exit: all tests green, high branch coverage on custom contract logic, compiler/dependencies locked, audit begins on a frozen hash.
+
+### Week 3 — vertical product slice while audit runs
+
+- Implement wallet and network guards, ownership gallery, signing, approval, buy, WETH wrap/approve, offer, acceptance, typed cancellation, bulk nonce cancellation, and clear transaction/error states.
+- Implement signature validation at API ingestion, event-driven order reconciliation, confirmations/reorg handling, periodic chain reconciliation, and filtering of currently invalid orders.
+- Add analytics/alerts for failed settlement, indexer lag, RPC failures, and unexpected marketplace balances. Never log signed payloads or sensitive API credentials unnecessarily.
+- Complete browser tests for seller, buyer, smart-wallet signer, stale listing, sold token, expired order, cancellation, insufficient WETH/allowance, rejected signature, and reverted payout.
+- Exit: staging vertical slice passes on a mainnet fork and a public Ethereum test environment; audit findings are triaged without deploying unaudited changes.
+
+### Week 4 — remediate, review, deploy, and launch
+
+- Fix audit findings, add regression tests, and return the exact remediation commit/diff for auditor verification. Any feature or contract-interface change triggers explicit audit-scope review.
+- Have an independent reviewer run the full acceptance checklist against the final commit, including mobile/wallet UX, indexer recovery, reorg simulation, and mainnet-fork settlements.
+- Deploy the exact audited bytecode to Ethereum mainnet, verify source, verify immutable values, seed/index historical metadata, and execute a low-value end-to-end sale and offer with team-owned tokens/accounts.
+- Publish contract address, verified-source link, fee/royalty disclosure, WETH-offer explanation, cancellation semantics, risk notice, and support/runbook documentation. Monitor closely and keep a launch rollback switch for the web UI only; the immutable contract cannot be paused.
+- Exit: auditor confirms remediation, bytecode matches audited build, smoke transactions and balance assertions pass, monitoring is live, and sign-off is recorded.
+
+The schedule assumes an auditor is booked before week 1 and starts at the end of week 2. Audit delay moves mainnet launch; it does not justify deploying the unaudited contract.
+
+## 6. Precise audit scope
+
+### In scope
+
+1. The final `CollectionMarketplace.sol` and every inherited or linked Solidity source compiled into it.
+2. The pinned OpenZeppelin contracts actually imported: EIP-712/signature checking, ERC-20 safe transfer, ERC-721 interfaces/receiver interactions as applicable, and reentrancy guard.
+3. Deployment and constructor-argument scripts insofar as they select chain ID, collection, canonical mainnet WETH, royalty multisig, compiler settings, optimizer settings, and deployed bytecode.
+4. Solidity unit, fuzz, invariant, and mainnet-fork tests as supporting evidence (tests are reviewed but are not a substitute for contract review).
+5. EIP-712 schema/constants and the TypeScript encoder fixture solely for equivalence with Solidity hashes.
+6. Integration assumptions for the exact existing collection and canonical WETH contracts, using their verified mainnet bytecode/interfaces. Those third-party contracts are not re-audited, but unusual behavior and integration risk are assessed.
+7. All externally reachable paths and trust boundaries described above: listing purchase, offer acceptance, individual/bulk cancellation, ETH/WETH payout, ERC-1271, ERC-721 callbacks, event truthfulness, and immutable configuration.
+
+Ask the auditor to assess at minimum: authorization and signature malleability; replay across orders/types/contracts/chains; nonce/cancellation correctness; stale ownership and approvals; frontrunning and authorized takers; self-sale; reentrancy/callback ordering; checks-effects-interactions; fee math/rounding; ETH accounting and forced ETH; WETH return-value/nonstandard behavior; atomicity; denial of service by payout recipients or ERC-1271 wallets; hostile buyer/seller contracts; event/indexer ambiguity; constructor misconfiguration; lack of admin recovery/pause; and compliance of the bytecode/build with the reviewed source.
+
+### Explicitly out of scope
+
+- The existing NFT and WETH implementations beyond integration assumptions; wallets, RPC providers, IPFS, metadata, and marketplace contracts not deployed by this project.
+- Frontend, API, database, indexer availability/security, cloud/IAM, DNS, analytics, and wallet-extension internals, except the typed-data encoder fixture noted above. These need separate application security and operational review.
+- Royalty enforcement outside this marketplace, legal/tax/regulatory conclusions, economic appraisal, wash trading, phishing/social engineering, private-key/multisig signer compromise, and marketplace discovery/traffic.
+- Auctions, bids requiring native-ETH escrow, collection offers, bundles, ERC-1155, lazy minting, permits, meta-transactions/relayers, delegated registries, arbitrary currencies/collections, upgradeability, pausing, fee changes, fee splitters, and recovery functions.
+
+### Quote package and change control
+
+Give the auditor: repository commit hash; exact in-scope file list and lines of Solidity; compiler/optimizer/EVM target and dependency lockfile; final ABI, storage layout, EIP-712 schemas and fixtures; architecture/payment-flow diagram; this threat model and invariants; test and coverage reports; static-analysis output; verified addresses and fork block; known issues; deployment script and intended constructor arguments.
+
+Request separate quote lines for (a) initial review, (b) one remediation review covering only fixes, and (c) optional deployment-bytecode verification. State the expected delivery dates needed for week 4. After scope freeze, record every Solidity, dependency, compiler-setting, constructor, or typed-data change in a diff manifest. New functionality or a changed trust boundary is a new audit scope; narrowly corrective changes receive remediation review. Mainnet deployment is gated on written closure or explicit risk acceptance for every finding.
+
+## 7. Deployment runbook and release gates
+
+The repository README must contain executable commands using the chosen framework for build, full tests, fixed-block mainnet-fork tests, deterministic deployment, source verification, and bytecode comparison. Do not invent commands until the framework is selected in week 1. Required secrets/configuration are an Ethereum mainnet RPC URL, block-explorer API key, deployer key/hardware-wallet path, collection address, canonical WETH address, royalty multisig, and deployer funding; secrets stay outside the repository.
+
+Pre-deploy gates:
+
+- final commit and bytecode are covered by audit/remediation confirmation;
+- chain ID is 1; all three constructor addresses are nonzero, checksummed, independently verified, and approved by two people;
+- royalty recipient is the intended multisig and its signer/recovery policy has been tested;
+- fork tests pass against the selected recent block and CI reproduces the build;
+- frontend/API point to the computed deployment address only after verified source and immutable values are checked.
+
+Post-deploy smoke test:
+
+1. Verify source and compare runtime bytecode with the audited artifact.
+2. Read and record all immutables and the EIP-712 domain.
+3. With a team-owned NFT, approve the marketplace, sign a low-price listing, buy it from a second account, and assert NFT ownership plus the exact 2.5%/97.5% ETH split.
+4. Wrap/approve WETH from the first account, sign a token offer, accept it from the current owner, and assert ownership plus the exact WETH split.
+5. Sign and cancel one order and bulk-invalidate another; prove both settlement attempts revert.
+6. Confirm indexed events match receipts and the marketplace holds no NFT, ETH, or WETH attributable to successful settlements.
+
+If a smoke step fails, keep creation and display of new orders disabled in the web UI, publish status, preserve evidence, and investigate. Because the contract is immutable and unpausable, do not advertise it as ready until every gate passes.

apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-28T143527Z-codex-with-skill-1/workspace/plan.md
diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..b688f5a23ccc1daeec3a88623ffbf9c8cba02ee1
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,187 @@
+# Four-week NFT marketplace MVP and audit scope
+
+## 1. Product decision and assumptions
+
+Ship a non-custodial, fixed-price secondary marketplace for the existing 5,000-token ERC-721 collection on Ethereum mainnet. There will be one new custom contract and no upgrade proxy, escrow, marketplace factory, auction, or admin-settable fee.
+
+The MVP assumptions to validate in kickoff are:
+
+- The collection is a standard ERC-721 whose `ownerOf` and `safeTransferFrom` behave normally, and it has no transfer restrictions that would prevent marketplace settlement.
+- The marketplace contract will be approved with `setApprovalForAll` (or token approval) by a seller before a sale can settle. Approval does not transfer custody.
+- The artist royalty recipient is a production multisig. It and the collection address are immutable constructor parameters. The fee is immutable at 250 basis points (2.5%). This marketplace enforces that fee on every settlement through it; it cannot force unrelated marketplaces or peer-to-peer transfers to pay it.
+- Listings are priced and paid in native ETH. Token-specific offers are priced and paid in mainnet WETH. WETH is necessary because native ETH cannot be pulled from a buyer later without escrow; the offer maker must retain enough WETH and allowance until acceptance. The site will explain this and offer a wrap-and-approve flow.
+- Offers are for one specific token, not collection-wide. Partial fills, bundles, auctions, traits, private sales, ERC-1155, delegated wallets, and arbitrary payment tokens are out of scope.
+- Both listings and offers are EIP-712 signed offchain orders. The API indexes them for browsing, but the contract independently validates every fact at settlement. Posting/removing an order in the API is not a security boundary.
+
+Before implementation, verify the actual collection contract on a mainnet fork, including ERC-721 approvals, transfers to contracts, any pause/blocklist mechanism, and existing ERC-2981 behavior. If any assumption is false, freeze the interface and revise this scope before obtaining a fixed audit quote.
+
+## 2. Smallest shippable architecture
+
+### Onchain
+
+One non-upgradeable `CollectionMarketplace` contract:
+
+- stores immutable `collection`, `weth`, and `royaltyRecipient` addresses;
+- verifies typed listing and offer signatures, including ERC-1271 signatures for smart-contract wallets via OpenZeppelin `SignatureChecker`;
+- validates deadline, token ID, nonce, current ownership, approval, exact consideration, and authorized taker where applicable;
+- atomically transfers the NFT and splits payment: 2.5% to the artist and 97.5% to the seller;
+- tracks order-hash cancellation and each account's minimum valid nonce;
+- has a reentrancy guard and emits settlement/cancellation events.
+
+There is no owner/admin role, pause key, upgrade path, custody function, or arbitrary token/native-ETH rescue function. ETH listings require exact `msg.value`, so the contract should finish successful calls with no retained ETH. WETH offer settlement transfers WETH directly from buyer to artist and seller; the marketplace retains no WETH. Accidental direct ETH transfers are rejected by omitting `receive` and payable fallback functions.
+
+Use audited OpenZeppelin primitives for EIP-712, signature checking, safe ERC-20 transfers, and reentrancy protection. Pin compiler and dependency versions in the audit commit.
+
+### Offchain
+
+- Web app: wallet connection, ownership/approval checks, create/sign/cancel listing, buy, create/sign/cancel WETH offer, wrap/approve WETH, accept offer, and transaction status/errors.
+- Indexer/API/database: signed orders, event ingestion, owner/approval state, order validity projection, token metadata, search/filtering, and activity history.
+- IPFS/existing collection metadata remains the display source. Search, sorting, floor price, and activity summaries are derived offchain from chain events; they are never authoritative contract state.
+
+The UI must re-simulate immediately before submission and label stale signatures, expired orders, ownership changes, missing approval, insufficient WETH, and insufficient allowance. It must never represent an API deletion as an onchain cancellation.
+
+## 3. Frozen contract surface for the audit quote
+
+The implementation may use structs internally, but the audited behavior and externally reachable surface is limited to:
+
+```solidity
+struct Listing {
+    address seller;
+    uint256 tokenId;
+    uint256 price;
+    address authorizedBuyer; // zero means public
+    uint256 nonce;
+    uint256 deadline;
+}
+
+struct Offer {
+    address buyer;
+    uint256 tokenId;
+    uint256 price;
+    address authorizedSeller; // zero means current owner
+    uint256 nonce;
+    uint256 deadline;
+}
+
+constructor(address collection, address weth, address royaltyRecipient)
+function buy(Listing calldata listing, bytes calldata signature) external payable nonReentrant
+function acceptOffer(Offer calldata offer, bytes calldata signature) external nonReentrant
+function cancelListing(Listing calldata listing) external
+function cancelOffer(Offer calldata offer) external
+function incrementMinNonce(uint256 newMinNonce) external
+function isCancelled(bytes32 orderHash) external view returns (bool)
+function minNonce(address account) external view returns (uint256)
+function hashListing(Listing calldata listing) external view returns (bytes32)
+function hashOffer(Offer calldata offer) external view returns (bytes32)
+```
+
+Exact rules:
+
+- The EIP-712 domain binds signatures to the marketplace address, Ethereum chain ID, name, and version. Listing and offer have distinct type hashes.
+- `buy` requires an unexpired, uncancelled listing nonce at or above `minNonce[seller]`, valid seller signature, current `ownerOf(tokenId) == seller`, caller equal to `authorizedBuyer` when nonzero, nonzero price, and exact `msg.value == price`. It marks the order consumed before external calls, transfers the NFT from seller to buyer with `safeTransferFrom`, pays `floor(price * 250 / 10_000)` ETH to the artist, and pays the remainder to the seller. Any failed transfer or payout reverts the whole transaction.
+- `acceptOffer` requires the caller to be the current token owner and, when nonzero, equal to `authorizedSeller`; the offer must be unexpired, uncancelled, at or above `minNonce[buyer]`, nonzero-priced, and signed by the buyer. It marks the order consumed before external calls, transfers the NFT from caller to buyer, then uses `safeTransferFrom` on WETH to pull the royalty from buyer to artist and the remainder from buyer to seller. Insufficient balance/allowance or a failed transfer reverts everything.
+- An order hash can settle only once. `cancelListing` requires `msg.sender == listing.seller`; `cancelOffer` requires `msg.sender == offer.buyer`. Each derives and marks the typed order hash cancelled; no signature is required because the signer is the transaction sender. Repeated cancellation reverts. `incrementMinNonce` is strictly increasing and invalidates all of the caller's listing and offer nonces below the new minimum.
+- A transfer or approval change naturally invalidates settlement but does not consume the signature. If the token later returns to the signer while the order remains live, it can become fillable again. The UI warns about this; users use onchain cancellation or nonce invalidation for permanent cancellation.
+- The contract rejects token IDs outside the collection implicitly through `ownerOf`; no hard-coded 5,000 range is needed.
+- No ERC-2981 lookup is performed. The fixed 2.5%/recipient rule is the single royalty rule, avoiding a mutable or malformed external royalty response.
+
+Required events are `ListingFilled(orderHash, seller, buyer, tokenId, price, royalty)`, `OfferFilled(orderHash, buyer, seller, tokenId, price, royalty)`, `OrderCancelled(orderHash, signer)`, and `MinNonceIncremented(signer, oldNonce, newNonce)`. Define custom errors for every validation/failure branch so the UI and audit tests can distinguish them. Names and parameter indexing are frozen before audit.
+
+## 4. State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| Sign/post listing | Seller (signature; API request) | Wants the NFT exposed for sale | Nothing is listed; NFT remains owned by seller |
+| `buy` | Buyer | Receives the NFT at the signed price | Listing remains fillable until expiry/cancellation/state invalidation |
+| Sign/post offer | Buyer (signature; API request) | Wants the NFT; retains WETH custody | No offer exists; no funds move |
+| `acceptOffer` | Current owner | Receives 97.5% of the offered WETH | Offer remains fillable until expiry/cancellation/state invalidation |
+| Cancel one order | Order signer | Permanently prevents that signature from settling | It may remain fillable if all validations hold |
+| `incrementMinNonce` | Account invalidating its orders | Cancels many old orders in one transaction | Older signatures remain individually valid |
+
+There are no scheduled transitions, keepers, privileged relayers, or owner-only liveness dependencies.
+
+## 5. Four-week build plan
+
+### Week 1 — freeze behavior and prove compatibility
+
+- Confirm collection, WETH, and artist multisig addresses from authoritative sources; document them without guessing.
+- Fork mainnet and prove buy/transfer/approval behavior against representative collection tokens and the canonical WETH contract.
+- Finalize EIP-712 schemas, typed cancellation ABI, payout ordering, rounding rule, events, errors, threat model, wireframes, and acceptance criteria.
+- Scaffold contract, deployment scripts, app, database schema, and event indexer. Produce deterministic typed-data fixtures shared by Solidity and TypeScript.
+- Exit: signed architecture/interface document, fork compatibility evidence, clickable happy-path UI shell, and audit firm confirms this scope is quoteable.
+
+### Week 2 — complete and test the contract
+
+- Implement the single immutable marketplace and deployment/verification scripts.
+- Unit and fuzz test signatures, ERC-1271, replay, cross-type/domain/chain replay, nonce boundaries, deadline boundaries, private takers, ownership/approval changes, fee rounding, exact ETH, WETH allowance/balance, hostile receivers/tokens, reentrancy, atomic rollback, and event correctness.
+- Add invariants: no order fills twice; only a valid current owner can sell; buyer receives exactly the specified token or the call reverts; artist gets exactly the calculated royalty; seller gets the remainder; successful settlement leaves no marketplace ETH/WETH/NFT custody; contract has no privileged state change.
+- Run static analysis, coverage, formatting, and mainnet-fork end-to-end tests. Freeze a release-candidate commit and provide it to the auditor at week end.
+- Exit: all tests green, high branch coverage on custom contract logic, compiler/dependencies locked, audit begins on a frozen hash.
+
+### Week 3 — vertical product slice while audit runs
+
+- Implement wallet and network guards, ownership gallery, signing, approval, buy, WETH wrap/approve, offer, acceptance, typed cancellation, bulk nonce cancellation, and clear transaction/error states.
+- Implement signature validation at API ingestion, event-driven order reconciliation, confirmations/reorg handling, periodic chain reconciliation, and filtering of currently invalid orders.
+- Add analytics/alerts for failed settlement, indexer lag, RPC failures, and unexpected marketplace balances. Never log signed payloads or sensitive API credentials unnecessarily.
+- Complete browser tests for seller, buyer, smart-wallet signer, stale listing, sold token, expired order, cancellation, insufficient WETH/allowance, rejected signature, and reverted payout.
+- Exit: staging vertical slice passes on a mainnet fork and a public Ethereum test environment; audit findings are triaged without deploying unaudited changes.
+
+### Week 4 — remediate, review, deploy, and launch
+
+- Fix audit findings, add regression tests, and return the exact remediation commit/diff for auditor verification. Any feature or contract-interface change triggers explicit audit-scope review.
+- Have an independent reviewer run the full acceptance checklist against the final commit, including mobile/wallet UX, indexer recovery, reorg simulation, and mainnet-fork settlements.
+- Deploy the exact audited bytecode to Ethereum mainnet, verify source, verify immutable values, seed/index historical metadata, and execute a low-value end-to-end sale and offer with team-owned tokens/accounts.
+- Publish contract address, verified-source link, fee/royalty disclosure, WETH-offer explanation, cancellation semantics, risk notice, and support/runbook documentation. Monitor closely and keep a launch rollback switch for the web UI only; the immutable contract cannot be paused.
+- Exit: auditor confirms remediation, bytecode matches audited build, smoke transactions and balance assertions pass, monitoring is live, and sign-off is recorded.
+
+The schedule assumes an auditor is booked before week 1 and starts at the end of week 2. Audit delay moves mainnet launch; it does not justify deploying the unaudited contract.
+
+## 6. Precise audit scope
+
+### In scope
+
+1. The final `CollectionMarketplace.sol` and every inherited or linked Solidity source compiled into it.
+2. The pinned OpenZeppelin contracts actually imported: EIP-712/signature checking, ERC-20 safe transfer, ERC-721 interfaces/receiver interactions as applicable, and reentrancy guard.
+3. Deployment and constructor-argument scripts insofar as they select chain ID, collection, canonical mainnet WETH, royalty multisig, compiler settings, optimizer settings, and deployed bytecode.
+4. Solidity unit, fuzz, invariant, and mainnet-fork tests as supporting evidence (tests are reviewed but are not a substitute for contract review).
+5. EIP-712 schema/constants and the TypeScript encoder fixture solely for equivalence with Solidity hashes.
+6. Integration assumptions for the exact existing collection and canonical WETH contracts, using their verified mainnet bytecode/interfaces. Those third-party contracts are not re-audited, but unusual behavior and integration risk are assessed.
+7. All externally reachable paths and trust boundaries described above: listing purchase, offer acceptance, individual/bulk cancellation, ETH/WETH payout, ERC-1271, ERC-721 callbacks, event truthfulness, and immutable configuration.
+
+Ask the auditor to assess at minimum: authorization and signature malleability; replay across orders/types/contracts/chains; nonce/cancellation correctness; stale ownership and approvals; frontrunning and authorized takers; self-sale; reentrancy/callback ordering; checks-effects-interactions; fee math/rounding; ETH accounting and forced ETH; WETH return-value/nonstandard behavior; atomicity; denial of service by payout recipients or ERC-1271 wallets; hostile buyer/seller contracts; event/indexer ambiguity; constructor misconfiguration; lack of admin recovery/pause; and compliance of the bytecode/build with the reviewed source.
+
+### Explicitly out of scope
+
+- The existing NFT and WETH implementations beyond integration assumptions; wallets, RPC providers, IPFS, metadata, and marketplace contracts not deployed by this project.
+- Frontend, API, database, indexer availability/security, cloud/IAM, DNS, analytics, and wallet-extension internals, except the typed-data encoder fixture noted above. These need separate application security and operational review.
+- Royalty enforcement outside this marketplace, legal/tax/regulatory conclusions, economic appraisal, wash trading, phishing/social engineering, private-key/multisig signer compromise, and marketplace discovery/traffic.
+- Auctions, bids requiring native-ETH escrow, collection offers, bundles, ERC-1155, lazy minting, permits, meta-transactions/relayers, delegated registries, arbitrary currencies/collections, upgradeability, pausing, fee changes, fee splitters, and recovery functions.
+
+### Quote package and change control
+
+Give the auditor: repository commit hash; exact in-scope file list and lines of Solidity; compiler/optimizer/EVM target and dependency lockfile; final ABI, storage layout, EIP-712 schemas and fixtures; architecture/payment-flow diagram; this threat model and invariants; test and coverage reports; static-analysis output; verified addresses and fork block; known issues; deployment script and intended constructor arguments.
+
+Request separate quote lines for (a) initial review, (b) one remediation review covering only fixes, and (c) optional deployment-bytecode verification. State the expected delivery dates needed for week 4. After scope freeze, record every Solidity, dependency, compiler-setting, constructor, or typed-data change in a diff manifest. New functionality or a changed trust boundary is a new audit scope; narrowly corrective changes receive remediation review. Mainnet deployment is gated on written closure or explicit risk acceptance for every finding.
+
+## 7. Deployment runbook and release gates
+
+The repository README must contain executable commands using the chosen framework for build, full tests, fixed-block mainnet-fork tests, deterministic deployment, source verification, and bytecode comparison. Do not invent commands until the framework is selected in week 1. Required secrets/configuration are an Ethereum mainnet RPC URL, block-explorer API key, deployer key/hardware-wallet path, collection address, canonical WETH address, royalty multisig, and deployer funding; secrets stay outside the repository.
+
+Pre-deploy gates:
+
+- final commit and bytecode are covered by audit/remediation confirmation;
+- chain ID is 1; all three constructor addresses are nonzero, checksummed, independently verified, and approved by two people;
+- royalty recipient is the intended multisig and its signer/recovery policy has been tested;
+- fork tests pass against the selected recent block and CI reproduces the build;
+- frontend/API point to the computed deployment address only after verified source and immutable values are checked.
+
+Post-deploy smoke test:
+
+1. Verify source and compare runtime bytecode with the audited artifact.
+2. Read and record all immutables and the EIP-712 domain.
+3. With a team-owned NFT, approve the marketplace, sign a low-price listing, buy it from a second account, and assert NFT ownership plus the exact 2.5%/97.5% ETH split.
+4. Wrap/approve WETH from the first account, sign a token offer, accept it from the current owner, and assert ownership plus the exact WETH split.
+5. Sign and cancel one order and bulk-invalidate another; prove both settlement attempts revert.
+6. Confirm indexed events match receipts and the marketplace holds no NFT, ETH, or WETH attributable to successful settlements.
+
+If a smoke step fails, keep creation and display of new orders disabled in the web UI, publish status, preserve evidence, and investigate. Because the contract is immutable and unpausable, do not advertise it as ready until every gate passes.

diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..b688f5a23ccc1daeec3a88623ffbf9c8cba02ee1
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,187 @@
+# Four-week NFT marketplace MVP and audit scope
+
+## 1. Product decision and assumptions
+
+Ship a non-custodial, fixed-price secondary marketplace for the existing 5,000-token ERC-721 collection on Ethereum mainnet. There will be one new custom contract and no upgrade proxy, escrow, marketplace factory, auction, or admin-settable fee.
+
+The MVP assumptions to validate in kickoff are:
+
+- The collection is a standard ERC-721 whose `ownerOf` and `safeTransferFrom` behave normally, and it has no transfer restrictions that would prevent marketplace settlement.
+- The marketplace contract will be approved with `setApprovalForAll` (or token approval) by a seller before a sale can settle. Approval does not transfer custody.
+- The artist royalty recipient is a production multisig. It and the collection address are immutable constructor parameters. The fee is immutable at 250 basis points (2.5%). This marketplace enforces that fee on every settlement through it; it cannot force unrelated marketplaces or peer-to-peer transfers to pay it.
+- Listings are priced and paid in native ETH. Token-specific offers are priced and paid in mainnet WETH. WETH is necessary because native ETH cannot be pulled from a buyer later without escrow; the offer maker must retain enough WETH and allowance until acceptance. The site will explain this and offer a wrap-and-approve flow.
+- Offers are for one specific token, not collection-wide. Partial fills, bundles, auctions, traits, private sales, ERC-1155, delegated wallets, and arbitrary payment tokens are out of scope.
+- Both listings and offers are EIP-712 signed offchain orders. The API indexes them for browsing, but the contract independently validates every fact at settlement. Posting/removing an order in the API is not a security boundary.
+
+Before implementation, verify the actual collection contract on a mainnet fork, including ERC-721 approvals, transfers to contracts, any pause/blocklist mechanism, and existing ERC-2981 behavior. If any assumption is false, freeze the interface and revise this scope before obtaining a fixed audit quote.
+
+## 2. Smallest shippable architecture
+
+### Onchain
+
+One non-upgradeable `CollectionMarketplace` contract:
+
+- stores immutable `collection`, `weth`, and `royaltyRecipient` addresses;
+- verifies typed listing and offer signatures, including ERC-1271 signatures for smart-contract wallets via OpenZeppelin `SignatureChecker`;
+- validates deadline, token ID, nonce, current ownership, approval, exact consideration, and authorized taker where applicable;
+- atomically transfers the NFT and splits payment: 2.5% to the artist and 97.5% to the seller;
+- tracks order-hash cancellation and each account's minimum valid nonce;
+- has a reentrancy guard and emits settlement/cancellation events.
+
+There is no owner/admin role, pause key, upgrade path, custody function, or arbitrary token/native-ETH rescue function. ETH listings require exact `msg.value`, so the contract should finish successful calls with no retained ETH. WETH offer settlement transfers WETH directly from buyer to artist and seller; the marketplace retains no WETH. Accidental direct ETH transfers are rejected by omitting `receive` and payable fallback functions.
+
+Use audited OpenZeppelin primitives for EIP-712, signature checking, safe ERC-20 transfers, and reentrancy protection. Pin compiler and dependency versions in the audit commit.
+
+### Offchain
+
+- Web app: wallet connection, ownership/approval checks, create/sign/cancel listing, buy, create/sign/cancel WETH offer, wrap/approve WETH, accept offer, and transaction status/errors.
+- Indexer/API/database: signed orders, event ingestion, owner/approval state, order validity projection, token metadata, search/filtering, and activity history.
+- IPFS/existing collection metadata remains the display source. Search, sorting, floor price, and activity summaries are derived offchain from chain events; they are never authoritative contract state.
+
+The UI must re-simulate immediately before submission and label stale signatures, expired orders, ownership changes, missing approval, insufficient WETH, and insufficient allowance. It must never represent an API deletion as an onchain cancellation.
+
+## 3. Frozen contract surface for the audit quote
+
+The implementation may use structs internally, but the audited behavior and externally reachable surface is limited to:
+
+```solidity
+struct Listing {
+    address seller;
+    uint256 tokenId;
+    uint256 price;
+    address authorizedBuyer; // zero means public
+    uint256 nonce;
+    uint256 deadline;
+}
+
+struct Offer {
+    address buyer;
+    uint256 tokenId;
+    uint256 price;
+    address authorizedSeller; // zero means current owner
+    uint256 nonce;
+    uint256 deadline;
+}
+
+constructor(address collection, address weth, address royaltyRecipient)
+function buy(Listing calldata listing, bytes calldata signature) external payable nonReentrant
+function acceptOffer(Offer calldata offer, bytes calldata signature) external nonReentrant
+function cancelListing(Listing calldata listing) external
+function cancelOffer(Offer calldata offer) external
+function incrementMinNonce(uint256 newMinNonce) external
+function isCancelled(bytes32 orderHash) external view returns (bool)
+function minNonce(address account) external view returns (uint256)
+function hashListing(Listing calldata listing) external view returns (bytes32)
+function hashOffer(Offer calldata offer) external view returns (bytes32)
+```
+
+Exact rules:
+
+- The EIP-712 domain binds signatures to the marketplace address, Ethereum chain ID, name, and version. Listing and offer have distinct type hashes.
+- `buy` requires an unexpired, uncancelled listing nonce at or above `minNonce[seller]`, valid seller signature, current `ownerOf(tokenId) == seller`, caller equal to `authorizedBuyer` when nonzero, nonzero price, and exact `msg.value == price`. It marks the order consumed before external calls, transfers the NFT from seller to buyer with `safeTransferFrom`, pays `floor(price * 250 / 10_000)` ETH to the artist, and pays the remainder to the seller. Any failed transfer or payout reverts the whole transaction.
+- `acceptOffer` requires the caller to be the current token owner and, when nonzero, equal to `authorizedSeller`; the offer must be unexpired, uncancelled, at or above `minNonce[buyer]`, nonzero-priced, and signed by the buyer. It marks the order consumed before external calls, transfers the NFT from caller to buyer, then uses `safeTransferFrom` on WETH to pull the royalty from buyer to artist and the remainder from buyer to seller. Insufficient balance/allowance or a failed transfer reverts everything.
+- An order hash can settle only once. `cancelListing` requires `msg.sender == listing.seller`; `cancelOffer` requires `msg.sender == offer.buyer`. Each derives and marks the typed order hash cancelled; no signature is required because the signer is the transaction sender. Repeated cancellation reverts. `incrementMinNonce` is strictly increasing and invalidates all of the caller's listing and offer nonces below the new minimum.
+- A transfer or approval change naturally invalidates settlement but does not consume the signature. If the token later returns to the signer while the order remains live, it can become fillable again. The UI warns about this; users use onchain cancellation or nonce invalidation for permanent cancellation.
+- The contract rejects token IDs outside the collection implicitly through `ownerOf`; no hard-coded 5,000 range is needed.
+- No ERC-2981 lookup is performed. The fixed 2.5%/recipient rule is the single royalty rule, avoiding a mutable or malformed external royalty response.
+
+Required events are `ListingFilled(orderHash, seller, buyer, tokenId, price, royalty)`, `OfferFilled(orderHash, buyer, seller, tokenId, price, royalty)`, `OrderCancelled(orderHash, signer)`, and `MinNonceIncremented(signer, oldNonce, newNonce)`. Define custom errors for every validation/failure branch so the UI and audit tests can distinguish them. Names and parameter indexing are frozen before audit.
+
+## 4. State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| Sign/post listing | Seller (signature; API request) | Wants the NFT exposed for sale | Nothing is listed; NFT remains owned by seller |
+| `buy` | Buyer | Receives the NFT at the signed price | Listing remains fillable until expiry/cancellation/state invalidation |
+| Sign/post offer | Buyer (signature; API request) | Wants the NFT; retains WETH custody | No offer exists; no funds move |
+| `acceptOffer` | Current owner | Receives 97.5% of the offered WETH | Offer remains fillable until expiry/cancellation/state invalidation |
+| Cancel one order | Order signer | Permanently prevents that signature from settling | It may remain fillable if all validations hold |
+| `incrementMinNonce` | Account invalidating its orders | Cancels many old orders in one transaction | Older signatures remain individually valid |
+
+There are no scheduled transitions, keepers, privileged relayers, or owner-only liveness dependencies.
+
+## 5. Four-week build plan
+
+### Week 1 — freeze behavior and prove compatibility
+
+- Confirm collection, WETH, and artist multisig addresses from authoritative sources; document them without guessing.
+- Fork mainnet and prove buy/transfer/approval behavior against representative collection tokens and the canonical WETH contract.
+- Finalize EIP-712 schemas, typed cancellation ABI, payout ordering, rounding rule, events, errors, threat model, wireframes, and acceptance criteria.
+- Scaffold contract, deployment scripts, app, database schema, and event indexer. Produce deterministic typed-data fixtures shared by Solidity and TypeScript.
+- Exit: signed architecture/interface document, fork compatibility evidence, clickable happy-path UI shell, and audit firm confirms this scope is quoteable.
+
+### Week 2 — complete and test the contract
+
+- Implement the single immutable marketplace and deployment/verification scripts.
+- Unit and fuzz test signatures, ERC-1271, replay, cross-type/domain/chain replay, nonce boundaries, deadline boundaries, private takers, ownership/approval changes, fee rounding, exact ETH, WETH allowance/balance, hostile receivers/tokens, reentrancy, atomic rollback, and event correctness.
+- Add invariants: no order fills twice; only a valid current owner can sell; buyer receives exactly the specified token or the call reverts; artist gets exactly the calculated royalty; seller gets the remainder; successful settlement leaves no marketplace ETH/WETH/NFT custody; contract has no privileged state change.
+- Run static analysis, coverage, formatting, and mainnet-fork end-to-end tests. Freeze a release-candidate commit and provide it to the auditor at week end.
+- Exit: all tests green, high branch coverage on custom contract logic, compiler/dependencies locked, audit begins on a frozen hash.
+
+### Week 3 — vertical product slice while audit runs
+
+- Implement wallet and network guards, ownership gallery, signing, approval, buy, WETH wrap/approve, offer, acceptance, typed cancellation, bulk nonce cancellation, and clear transaction/error states.
+- Implement signature validation at API ingestion, event-driven order reconciliation, confirmations/reorg handling, periodic chain reconciliation, and filtering of currently invalid orders.
+- Add analytics/alerts for failed settlement, indexer lag, RPC failures, and unexpected marketplace balances. Never log signed payloads or sensitive API credentials unnecessarily.
+- Complete browser tests for seller, buyer, smart-wallet signer, stale listing, sold token, expired order, cancellation, insufficient WETH/allowance, rejected signature, and reverted payout.
+- Exit: staging vertical slice passes on a mainnet fork and a public Ethereum test environment; audit findings are triaged without deploying unaudited changes.
+
+### Week 4 — remediate, review, deploy, and launch
+
+- Fix audit findings, add regression tests, and return the exact remediation commit/diff for auditor verification. Any feature or contract-interface change triggers explicit audit-scope review.
+- Have an independent reviewer run the full acceptance checklist against the final commit, including mobile/wallet UX, indexer recovery, reorg simulation, and mainnet-fork settlements.
+- Deploy the exact audited bytecode to Ethereum mainnet, verify source, verify immutable values, seed/index historical metadata, and execute a low-value end-to-end sale and offer with team-owned tokens/accounts.
+- Publish contract address, verified-source link, fee/royalty disclosure, WETH-offer explanation, cancellation semantics, risk notice, and support/runbook documentation. Monitor closely and keep a launch rollback switch for the web UI only; the immutable contract cannot be paused.
+- Exit: auditor confirms remediation, bytecode matches audited build, smoke transactions and balance assertions pass, monitoring is live, and sign-off is recorded.
+
+The schedule assumes an auditor is booked before week 1 and starts at the end of week 2. Audit delay moves mainnet launch; it does not justify deploying the unaudited contract.
+
+## 6. Precise audit scope
+
+### In scope
+
+1. The final `CollectionMarketplace.sol` and every inherited or linked Solidity source compiled into it.
+2. The pinned OpenZeppelin contracts actually imported: EIP-712/signature checking, ERC-20 safe transfer, ERC-721 interfaces/receiver interactions as applicable, and reentrancy guard.
+3. Deployment and constructor-argument scripts insofar as they select chain ID, collection, canonical mainnet WETH, royalty multisig, compiler settings, optimizer settings, and deployed bytecode.
+4. Solidity unit, fuzz, invariant, and mainnet-fork tests as supporting evidence (tests are reviewed but are not a substitute for contract review).
+5. EIP-712 schema/constants and the TypeScript encoder fixture solely for equivalence with Solidity hashes.
+6. Integration assumptions for the exact existing collection and canonical WETH contracts, using their verified mainnet bytecode/interfaces. Those third-party contracts are not re-audited, but unusual behavior and integration risk are assessed.
+7. All externally reachable paths and trust boundaries described above: listing purchase, offer acceptance, individual/bulk cancellation, ETH/WETH payout, ERC-1271, ERC-721 callbacks, event truthfulness, and immutable configuration.
+
+Ask the auditor to assess at minimum: authorization and signature malleability; replay across orders/types/contracts/chains; nonce/cancellation correctness; stale ownership and approvals; frontrunning and authorized takers; self-sale; reentrancy/callback ordering; checks-effects-interactions; fee math/rounding; ETH accounting and forced ETH; WETH return-value/nonstandard behavior; atomicity; denial of service by payout recipients or ERC-1271 wallets; hostile buyer/seller contracts; event/indexer ambiguity; constructor misconfiguration; lack of admin recovery/pause; and compliance of the bytecode/build with the reviewed source.
+
+### Explicitly out of scope
+
+- The existing NFT and WETH implementations beyond integration assumptions; wallets, RPC providers, IPFS, metadata, and marketplace contracts not deployed by this project.
+- Frontend, API, database, indexer availability/security, cloud/IAM, DNS, analytics, and wallet-extension internals, except the typed-data encoder fixture noted above. These need separate application security and operational review.
+- Royalty enforcement outside this marketplace, legal/tax/regulatory conclusions, economic appraisal, wash trading, phishing/social engineering, private-key/multisig signer compromise, and marketplace discovery/traffic.
+- Auctions, bids requiring native-ETH escrow, collection offers, bundles, ERC-1155, lazy minting, permits, meta-transactions/relayers, delegated registries, arbitrary currencies/collections, upgradeability, pausing, fee changes, fee splitters, and recovery functions.
+
+### Quote package and change control
+
+Give the auditor: repository commit hash; exact in-scope file list and lines of Solidity; compiler/optimizer/EVM target and dependency lockfile; final ABI, storage layout, EIP-712 schemas and fixtures; architecture/payment-flow diagram; this threat model and invariants; test and coverage reports; static-analysis output; verified addresses and fork block; known issues; deployment script and intended constructor arguments.
+
+Request separate quote lines for (a) initial review, (b) one remediation review covering only fixes, and (c) optional deployment-bytecode verification. State the expected delivery dates needed for week 4. After scope freeze, record every Solidity, dependency, compiler-setting, constructor, or typed-data change in a diff manifest. New functionality or a changed trust boundary is a new audit scope; narrowly corrective changes receive remediation review. Mainnet deployment is gated on written closure or explicit risk acceptance for every finding.
+
+## 7. Deployment runbook and release gates
+
+The repository README must contain executable commands using the chosen framework for build, full tests, fixed-block mainnet-fork tests, deterministic deployment, source verification, and bytecode comparison. Do not invent commands until the framework is selected in week 1. Required secrets/configuration are an Ethereum mainnet RPC URL, block-explorer API key, deployer key/hardware-wallet path, collection address, canonical WETH address, royalty multisig, and deployer funding; secrets stay outside the repository.
+
+Pre-deploy gates:
+
+- final commit and bytecode are covered by audit/remediation confirmation;
+- chain ID is 1; all three constructor addresses are nonzero, checksummed, independently verified, and approved by two people;
+- royalty recipient is the intended multisig and its signer/recovery policy has been tested;
+- fork tests pass against the selected recent block and CI reproduces the build;
+- frontend/API point to the computed deployment address only after verified source and immutable values are checked.
+
+Post-deploy smoke test:
+
+1. Verify source and compare runtime bytecode with the audited artifact.
+2. Read and record all immutables and the EIP-712 domain.
+3. With a team-owned NFT, approve the marketplace, sign a low-price listing, buy it from a second account, and assert NFT ownership plus the exact 2.5%/97.5% ETH split.
+4. Wrap/approve WETH from the first account, sign a token offer, accept it from the current owner, and assert ownership plus the exact WETH split.
+5. Sign and cancel one order and bulk-invalidate another; prove both settlement attempts revert.
+6. Confirm indexed events match receipts and the marketplace holds no NFT, ETH, or WETH attributable to successful settlements.
+
+If a smoke step fails, keep creation and display of new orders disabled in the web UI, publish status, preserve evidence, and investigate. Because the contract is immutable and unpausable, do not advertise it as ready until every gate passes.

exec
/bin/bash -lc "git diff --check -- plan.md && rg -n \"TBD|illustrative|cancel\\(bytes32\" plan.md || true && git status --short" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-28T143527Z-codex-with-skill-1/workspace
 succeeded in 5ms:
?? plan.md

diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..b688f5a23ccc1daeec3a88623ffbf9c8cba02ee1
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,187 @@
+# Four-week NFT marketplace MVP and audit scope
+
+## 1. Product decision and assumptions
+
+Ship a non-custodial, fixed-price secondary marketplace for the existing 5,000-token ERC-721 collection on Ethereum mainnet. There will be one new custom contract and no upgrade proxy, escrow, marketplace factory, auction, or admin-settable fee.
+
+The MVP assumptions to validate in kickoff are:
+
+- The collection is a standard ERC-721 whose `ownerOf` and `safeTransferFrom` behave normally, and it has no transfer restrictions that would prevent marketplace settlement.
+- The marketplace contract will be approved with `setApprovalForAll` (or token approval) by a seller before a sale can settle. Approval does not transfer custody.
+- The artist royalty recipient is a production multisig. It and the collection address are immutable constructor parameters. The fee is immutable at 250 basis points (2.5%). This marketplace enforces that fee on every settlement through it; it cannot force unrelated marketplaces or peer-to-peer transfers to pay it.
+- Listings are priced and paid in native ETH. Token-specific offers are priced and paid in mainnet WETH. WETH is necessary because native ETH cannot be pulled from a buyer later without escrow; the offer maker must retain enough WETH and allowance until acceptance. The site will explain this and offer a wrap-and-approve flow.
+- Offers are for one specific token, not collection-wide. Partial fills, bundles, auctions, traits, private sales, ERC-1155, delegated wallets, and arbitrary payment tokens are out of scope.
+- Both listings and offers are EIP-712 signed offchain orders. The API indexes them for browsing, but the contract independently validates every fact at settlement. Posting/removing an order in the API is not a security boundary.
+
+Before implementation, verify the actual collection contract on a mainnet fork, including ERC-721 approvals, transfers to contracts, any pause/blocklist mechanism, and existing ERC-2981 behavior. If any assumption is false, freeze the interface and revise this scope before obtaining a fixed audit quote.
+
+## 2. Smallest shippable architecture
+
+### Onchain
+
+One non-upgradeable `CollectionMarketplace` contract:
+
+- stores immutable `collection`, `weth`, and `royaltyRecipient` addresses;
+- verifies typed listing and offer signatures, including ERC-1271 signatures for smart-contract wallets via OpenZeppelin `SignatureChecker`;
+- validates deadline, token ID, nonce, current ownership, approval, exact consideration, and authorized taker where applicable;
+- atomically transfers the NFT and splits payment: 2.5% to the artist and 97.5% to the seller;
+- tracks order-hash cancellation and each account's minimum valid nonce;
+- has a reentrancy guard and emits settlement/cancellation events.
+
+There is no owner/admin role, pause key, upgrade path, custody function, or arbitrary token/native-ETH rescue function. ETH listings require exact `msg.value`, so the contract should finish successful calls with no retained ETH. WETH offer settlement transfers WETH directly from buyer to artist and seller; the marketplace retains no WETH. Accidental direct ETH transfers are rejected by omitting `receive` and payable fallback functions.
+
+Use audited OpenZeppelin primitives for EIP-712, signature checking, safe ERC-20 transfers, and reentrancy protection. Pin compiler and dependency versions in the audit commit.
+
+### Offchain
+
+- Web app: wallet connection, ownership/approval checks, create/sign/cancel listing, buy, create/sign/cancel WETH offer, wrap/approve WETH, accept offer, and transaction status/errors.
+- Indexer/API/database: signed orders, event ingestion, owner/approval state, order validity projection, token metadata, search/filtering, and activity history.
+- IPFS/existing collection metadata remains the display source. Search, sorting, floor price, and activity summaries are derived offchain from chain events; they are never authoritative contract state.
+
+The UI must re-simulate immediately before submission and label stale signatures, expired orders, ownership changes, missing approval, insufficient WETH, and insufficient allowance. It must never represent an API deletion as an onchain cancellation.
+
+## 3. Frozen contract surface for the audit quote
+
+The implementation may use structs internally, but the audited behavior and externally reachable surface is limited to:
+
+```solidity
+struct Listing {
+    address seller;
+    uint256 tokenId;
+    uint256 price;
+    address authorizedBuyer; // zero means public
+    uint256 nonce;
+    uint256 deadline;
+}
+
+struct Offer {
+    address buyer;
+    uint256 tokenId;
+    uint256 price;
+    address authorizedSeller; // zero means current owner
+    uint256 nonce;
+    uint256 deadline;
+}
+
+constructor(address collection, address weth, address royaltyRecipient)
+function buy(Listing calldata listing, bytes calldata signature) external payable nonReentrant
+function acceptOffer(Offer calldata offer, bytes calldata signature) external nonReentrant
+function cancelListing(Listing calldata listing) external
+function cancelOffer(Offer calldata offer) external
+function incrementMinNonce(uint256 newMinNonce) external
+function isCancelled(bytes32 orderHash) external view returns (bool)
+function minNonce(address account) external view returns (uint256)
+function hashListing(Listing calldata listing) external view returns (bytes32)
+function hashOffer(Offer calldata offer) external view returns (bytes32)
+```
+
+Exact rules:
+
+- The EIP-712 domain binds signatures to the marketplace address, Ethereum chain ID, name, and version. Listing and offer have distinct type hashes.
+- `buy` requires an unexpired, uncancelled listing nonce at or above `minNonce[seller]`, valid seller signature, current `ownerOf(tokenId) == seller`, caller equal to `authorizedBuyer` when nonzero, nonzero price, and exact `msg.value == price`. It marks the order consumed before external calls, transfers the NFT from seller to buyer with `safeTransferFrom`, pays `floor(price * 250 / 10_000)` ETH to the artist, and pays the remainder to the seller. Any failed transfer or payout reverts the whole transaction.
+- `acceptOffer` requires the caller to be the current token owner and, when nonzero, equal to `authorizedSeller`; the offer must be unexpired, uncancelled, at or above `minNonce[buyer]`, nonzero-priced, and signed by the buyer. It marks the order consumed before external calls, transfers the NFT from caller to buyer, then uses `safeTransferFrom` on WETH to pull the royalty from buyer to artist and the remainder from buyer to seller. Insufficient balance/allowance or a failed transfer reverts everything.
+- An order hash can settle only once. `cancelListing` requires `msg.sender == listing.seller`; `cancelOffer` requires `msg.sender == offer.buyer`. Each derives and marks the typed order hash cancelled; no signature is required because the signer is the transaction sender. Repeated cancellation reverts. `incrementMinNonce` is strictly increasing and invalidates all of the caller's listing and offer nonces below the new minimum.
+- A transfer or approval change naturally invalidates settlement but does not consume the signature. If the token later returns to the signer while the order remains live, it can become fillable again. The UI warns about this; users use onchain cancellation or nonce invalidation for permanent cancellation.
+- The contract rejects token IDs outside the collection implicitly through `ownerOf`; no hard-coded 5,000 range is needed.
+- No ERC-2981 lookup is performed. The fixed 2.5%/recipient rule is the single royalty rule, avoiding a mutable or malformed external royalty response.
+
+Required events are `ListingFilled(orderHash, seller, buyer, tokenId, price, royalty)`, `OfferFilled(orderHash, buyer, seller, tokenId, price, royalty)`, `OrderCancelled(orderHash, signer)`, and `MinNonceIncremented(signer, oldNonce, newNonce)`. Define custom errors for every validation/failure branch so the UI and audit tests can distinguish them. Names and parameter indexing are frozen before audit.
+
+## 4. State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| Sign/post listing | Seller (signature; API request) | Wants the NFT exposed for sale | Nothing is listed; NFT remains owned by seller |
+| `buy` | Buyer | Receives the NFT at the signed price | Listing remains fillable until expiry/cancellation/state invalidation |
+| Sign/post offer | Buyer (signature; API request) | Wants the NFT; retains WETH custody | No offer exists; no funds move |
+| `acceptOffer` | Current owner | Receives 97.5% of the offered WETH | Offer remains fillable until expiry/cancellation/state invalidation |
+| Cancel one order | Order signer | Permanently prevents that signature from settling | It may remain fillable if all validations hold |
+| `incrementMinNonce` | Account invalidating its orders | Cancels many old orders in one transaction | Older signatures remain individually valid |
+
+There are no scheduled transitions, keepers, privileged relayers, or owner-only liveness dependencies.
+
+## 5. Four-week build plan
+
+### Week 1 — freeze behavior and prove compatibility
+
+- Confirm collection, WETH, and artist multisig addresses from authoritative sources; document them without guessing.
+- Fork mainnet and prove buy/transfer/approval behavior against representative collection tokens and the canonical WETH contract.
+- Finalize EIP-712 schemas, typed cancellation ABI, payout ordering, rounding rule, events, errors, threat model, wireframes, and acceptance criteria.
+- Scaffold contract, deployment scripts, app, database schema, and event indexer. Produce deterministic typed-data fixtures shared by Solidity and TypeScript.
+- Exit: signed architecture/interface document, fork compatibility evidence, clickable happy-path UI shell, and audit firm confirms this scope is quoteable.
+
+### Week 2 — complete and test the contract
+
+- Implement the single immutable marketplace and deployment/verification scripts.
+- Unit and fuzz test signatures, ERC-1271, replay, cross-type/domain/chain replay, nonce boundaries, deadline boundaries, private takers, ownership/approval changes, fee rounding, exact ETH, WETH allowance/balance, hostile receivers/tokens, reentrancy, atomic rollback, and event correctness.
+- Add invariants: no order fills twice; only a valid current owner can sell; buyer receives exactly the specified token or the call reverts; artist gets exactly the calculated royalty; seller gets the remainder; successful settlement leaves no marketplace ETH/WETH/NFT custody; contract has no privileged state change.
+- Run static analysis, coverage, formatting, and mainnet-fork end-to-end tests. Freeze a release-candidate commit and provide it to the auditor at week end.
+- Exit: all tests green, high branch coverage on custom contract logic, compiler/dependencies locked, audit begins on a frozen hash.
+
+### Week 3 — vertical product slice while audit runs
+
+- Implement wallet and network guards, ownership gallery, signing, approval, buy, WETH wrap/approve, offer, acceptance, typed cancellation, bulk nonce cancellation, and clear transaction/error states.
+- Implement signature validation at API ingestion, event-driven order reconciliation, confirmations/reorg handling, periodic chain reconciliation, and filtering of currently invalid orders.
+- Add analytics/alerts for failed settlement, indexer lag, RPC failures, and unexpected marketplace balances. Never log signed payloads or sensitive API credentials unnecessarily.
+- Complete browser tests for seller, buyer, smart-wallet signer, stale listing, sold token, expired order, cancellation, insufficient WETH/allowance, rejected signature, and reverted payout.
+- Exit: staging vertical slice passes on a mainnet fork and a public Ethereum test environment; audit findings are triaged without deploying unaudited changes.
+
+### Week 4 — remediate, review, deploy, and launch
+
+- Fix audit findings, add regression tests, and return the exact remediation commit/diff for auditor verification. Any feature or contract-interface change triggers explicit audit-scope review.
+- Have an independent reviewer run the full acceptance checklist against the final commit, including mobile/wallet UX, indexer recovery, reorg simulation, and mainnet-fork settlements.
+- Deploy the exact audited bytecode to Ethereum mainnet, verify source, verify immutable values, seed/index historical metadata, and execute a low-value end-to-end sale and offer with team-owned tokens/accounts.
+- Publish contract address, verified-source link, fee/royalty disclosure, WETH-offer explanation, cancellation semantics, risk notice, and support/runbook documentation. Monitor closely and keep a launch rollback switch for the web UI only; the immutable contract cannot be paused.
+- Exit: auditor confirms remediation, bytecode matches audited build, smoke transactions and balance assertions pass, monitoring is live, and sign-off is recorded.
+
+The schedule assumes an auditor is booked before week 1 and starts at the end of week 2. Audit delay moves mainnet launch; it does not justify deploying the unaudited contract.
+
+## 6. Precise audit scope
+
+### In scope
+
+1. The final `CollectionMarketplace.sol` and every inherited or linked Solidity source compiled into it.
+2. The pinned OpenZeppelin contracts actually imported: EIP-712/signature checking, ERC-20 safe transfer, ERC-721 interfaces/receiver interactions as applicable, and reentrancy guard.
+3. Deployment and constructor-argument scripts insofar as they select chain ID, collection, canonical mainnet WETH, royalty multisig, compiler settings, optimizer settings, and deployed bytecode.
+4. Solidity unit, fuzz, invariant, and mainnet-fork tests as supporting evidence (tests are reviewed but are not a substitute for contract review).
+5. EIP-712 schema/constants and the TypeScript encoder fixture solely for equivalence with Solidity hashes.
+6. Integration assumptions for the exact existing collection and canonical WETH contracts, using their verified mainnet bytecode/interfaces. Those third-party contracts are not re-audited, but unusual behavior and integration risk are assessed.
+7. All externally reachable paths and trust boundaries described above: listing purchase, offer acceptance, individual/bulk cancellation, ETH/WETH payout, ERC-1271, ERC-721 callbacks, event truthfulness, and immutable configuration.
+
+Ask the auditor to assess at minimum: authorization and signature malleability; replay across orders/types/contracts/chains; nonce/cancellation correctness; stale ownership and approvals; frontrunning and authorized takers; self-sale; reentrancy/callback ordering; checks-effects-interactions; fee math/rounding; ETH accounting and forced ETH; WETH return-value/nonstandard behavior; atomicity; denial of service by payout recipients or ERC-1271 wallets; hostile buyer/seller contracts; event/indexer ambiguity; constructor misconfiguration; lack of admin recovery/pause; and compliance of the bytecode/build with the reviewed source.
+
+### Explicitly out of scope
+
+- The existing NFT and WETH implementations beyond integration assumptions; wallets, RPC providers, IPFS, metadata, and marketplace contracts not deployed by this project.
+- Frontend, API, database, indexer availability/security, cloud/IAM, DNS, analytics, and wallet-extension internals, except the typed-data encoder fixture noted above. These need separate application security and operational review.
+- Royalty enforcement outside this marketplace, legal/tax/regulatory conclusions, economic appraisal, wash trading, phishing/social engineering, private-key/multisig signer compromise, and marketplace discovery/traffic.
+- Auctions, bids requiring native-ETH escrow, collection offers, bundles, ERC-1155, lazy minting, permits, meta-transactions/relayers, delegated registries, arbitrary currencies/collections, upgradeability, pausing, fee changes, fee splitters, and recovery functions.
+
+### Quote package and change control
+
+Give the auditor: repository commit hash; exact in-scope file list and lines of Solidity; compiler/optimizer/EVM target and dependency lockfile; final ABI, storage layout, EIP-712 schemas and fixtures; architecture/payment-flow diagram; this threat model and invariants; test and coverage reports; static-analysis output; verified addresses and fork block; known issues; deployment script and intended constructor arguments.
+
+Request separate quote lines for (a) initial review, (b) one remediation review covering only fixes, and (c) optional deployment-bytecode verification. State the expected delivery dates needed for week 4. After scope freeze, record every Solidity, dependency, compiler-setting, constructor, or typed-data change in a diff manifest. New functionality or a changed trust boundary is a new audit scope; narrowly corrective changes receive remediation review. Mainnet deployment is gated on written closure or explicit risk acceptance for every finding.
+
+## 7. Deployment runbook and release gates
+
+The repository README must contain executable commands using the chosen framework for build, full tests, fixed-block mainnet-fork tests, deterministic deployment, source verification, and bytecode comparison. Do not invent commands until the framework is selected in week 1. Required secrets/configuration are an Ethereum mainnet RPC URL, block-explorer API key, deployer key/hardware-wallet path, collection address, canonical WETH address, royalty multisig, and deployer funding; secrets stay outside the repository.
+
+Pre-deploy gates:
+
+- final commit and bytecode are covered by audit/remediation confirmation;
+- chain ID is 1; all three constructor addresses are nonzero, checksummed, independently verified, and approved by two people;
+- royalty recipient is the intended multisig and its signer/recovery policy has been tested;
+- fork tests pass against the selected recent block and CI reproduces the build;
+- frontend/API point to the computed deployment address only after verified source and immutable values are checked.
+
+Post-deploy smoke test:
+
+1. Verify source and compare runtime bytecode with the audited artifact.
+2. Read and record all immutables and the EIP-712 domain.
+3. With a team-owned NFT, approve the marketplace, sign a low-price listing, buy it from a second account, and assert NFT ownership plus the exact 2.5%/97.5% ETH split.
+4. Wrap/approve WETH from the first account, sign a token offer, accept it from the current owner, and assert ownership plus the exact WETH split.
+5. Sign and cancel one order and bulk-invalidate another; prove both settlement attempts revert.
+6. Confirm indexed events match receipts and the marketplace holds no NFT, ETH, or WETH attributable to successful settlements.
+
+If a smoke step fails, keep creation and display of new orders disabled in the web UI, publish status, preserve evidence, and investigate. Because the contract is immutable and unpausable, do not advertise it as ready until every gate passes.

codex
Created [plan.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-28T143527Z-codex-with-skill-1/workspace/plan.md).

It includes:

- Four-week MVP delivery plan
- Non-custodial signed listings
- WETH-based offers without escrow
- Immutable 2.5% artist royalty
- Exact contract interface and settlement rules
- State-transition and liveness table
- Precise audit inclusions, exclusions, and quote package
- Security invariants, testing requirements, deployment gates, and mainnet smoke tests
diff --git a/plan.md b/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..b688f5a23ccc1daeec3a88623ffbf9c8cba02ee1
--- /dev/null
+++ b/plan.md
@@ -0,0 +1,187 @@
+# Four-week NFT marketplace MVP and audit scope
+
+## 1. Product decision and assumptions
+
+Ship a non-custodial, fixed-price secondary marketplace for the existing 5,000-token ERC-721 collection on Ethereum mainnet. There will be one new custom contract and no upgrade proxy, escrow, marketplace factory, auction, or admin-settable fee.
+
+The MVP assumptions to validate in kickoff are:
+
+- The collection is a standard ERC-721 whose `ownerOf` and `safeTransferFrom` behave normally, and it has no transfer restrictions that would prevent marketplace settlement.
+- The marketplace contract will be approved with `setApprovalForAll` (or token approval) by a seller before a sale can settle. Approval does not transfer custody.
+- The artist royalty recipient is a production multisig. It and the collection address are immutable constructor parameters. The fee is immutable at 250 basis points (2.5%). This marketplace enforces that fee on every settlement through it; it cannot force unrelated marketplaces or peer-to-peer transfers to pay it.
+- Listings are priced and paid in native ETH. Token-specific offers are priced and paid in mainnet WETH. WETH is necessary because native ETH cannot be pulled from a buyer later without escrow; the offer maker must retain enough WETH and allowance until acceptance. The site will explain this and offer a wrap-and-approve flow.
+- Offers are for one specific token, not collection-wide. Partial fills, bundles, auctions, traits, private sales, ERC-1155, delegated wallets, and arbitrary payment tokens are out of scope.
+- Both listings and offers are EIP-712 signed offchain orders. The API indexes them for browsing, but the contract independently validates every fact at settlement. Posting/removing an order in the API is not a security boundary.
+
+Before implementation, verify the actual collection contract on a mainnet fork, including ERC-721 approvals, transfers to contracts, any pause/blocklist mechanism, and existing ERC-2981 behavior. If any assumption is false, freeze the interface and revise this scope before obtaining a fixed audit quote.
+
+## 2. Smallest shippable architecture
+
+### Onchain
+
+One non-upgradeable `CollectionMarketplace` contract:
+
+- stores immutable `collection`, `weth`, and `royaltyRecipient` addresses;
+- verifies typed listing and offer signatures, including ERC-1271 signatures for smart-contract wallets via OpenZeppelin `SignatureChecker`;
+- validates deadline, token ID, nonce, current ownership, approval, exact consideration, and authorized taker where applicable;
+- atomically transfers the NFT and splits payment: 2.5% to the artist and 97.5% to the seller;
+- tracks order-hash cancellation and each account's minimum valid nonce;
+- has a reentrancy guard and emits settlement/cancellation events.
+
+There is no owner/admin role, pause key, upgrade path, custody function, or arbitrary token/native-ETH rescue function. ETH listings require exact `msg.value`, so the contract should finish successful calls with no retained ETH. WETH offer settlement transfers WETH directly from buyer to artist and seller; the marketplace retains no WETH. Accidental direct ETH transfers are rejected by omitting `receive` and payable fallback functions.
+
+Use audited OpenZeppelin primitives for EIP-712, signature checking, safe ERC-20 transfers, and reentrancy protection. Pin compiler and dependency versions in the audit commit.
+
+### Offchain
+
+- Web app: wallet connection, ownership/approval checks, create/sign/cancel listing, buy, create/sign/cancel WETH offer, wrap/approve WETH, accept offer, and transaction status/errors.
+- Indexer/API/database: signed orders, event ingestion, owner/approval state, order validity projection, token metadata, search/filtering, and activity history.
+- IPFS/existing collection metadata remains the display source. Search, sorting, floor price, and activity summaries are derived offchain from chain events; they are never authoritative contract state.
+
+The UI must re-simulate immediately before submission and label stale signatures, expired orders, ownership changes, missing approval, insufficient WETH, and insufficient allowance. It must never represent an API deletion as an onchain cancellation.
+
+## 3. Frozen contract surface for the audit quote
+
+The implementation may use structs internally, but the audited behavior and externally reachable surface is limited to:
+
+```solidity
+struct Listing {
+    address seller;
+    uint256 tokenId;
+    uint256 price;
+    address authorizedBuyer; // zero means public
+    uint256 nonce;
+    uint256 deadline;
+}
+
+struct Offer {
+    address buyer;
+    uint256 tokenId;
+    uint256 price;
+    address authorizedSeller; // zero means current owner
+    uint256 nonce;
+    uint256 deadline;
+}
+
+constructor(address collection, address weth, address royaltyRecipient)
+function buy(Listing calldata listing, bytes calldata signature) external payable nonReentrant
+function acceptOffer(Offer calldata offer, bytes calldata signature) external nonReentrant
+function cancelListing(Listing calldata listing) external
+function cancelOffer(Offer calldata offer) external
+function incrementMinNonce(uint256 newMinNonce) external
+function isCancelled(bytes32 orderHash) external view returns (bool)
+function minNonce(address account) external view returns (uint256)
+function hashListing(Listing calldata listing) external view returns (bytes32)
+function hashOffer(Offer calldata offer) external view returns (bytes32)
+```
+
+Exact rules:
+
+- The EIP-712 domain binds signatures to the marketplace address, Ethereum chain ID, name, and version. Listing and offer have distinct type hashes.
+- `buy` requires an unexpired, uncancelled listing nonce at or above `minNonce[seller]`, valid seller signature, current `ownerOf(tokenId) == seller`, caller equal to `authorizedBuyer` when nonzero, nonzero price, and exact `msg.value == price`. It marks the order consumed before external calls, transfers the NFT from seller to buyer with `safeTransferFrom`, pays `floor(price * 250 / 10_000)` ETH to the artist, and pays the remainder to the seller. Any failed transfer or payout reverts the whole transaction.
+- `acceptOffer` requires the caller to be the current token owner and, when nonzero, equal to `authorizedSeller`; the offer must be unexpired, uncancelled, at or above `minNonce[buyer]`, nonzero-priced, and signed by the buyer. It marks the order consumed before external calls, transfers the NFT from caller to buyer, then uses `safeTransferFrom` on WETH to pull the royalty from buyer to artist and the remainder from buyer to seller. Insufficient balance/allowance or a failed transfer reverts everything.
+- An order hash can settle only once. `cancelListing` requires `msg.sender == listing.seller`; `cancelOffer` requires `msg.sender == offer.buyer`. Each derives and marks the typed order hash cancelled; no signature is required because the signer is the transaction sender. Repeated cancellation reverts. `incrementMinNonce` is strictly increasing and invalidates all of the caller's listing and offer nonces below the new minimum.
+- A transfer or approval change naturally invalidates settlement but does not consume the signature. If the token later returns to the signer while the order remains live, it can become fillable again. The UI warns about this; users use onchain cancellation or nonce invalidation for permanent cancellation.
+- The contract rejects token IDs outside the collection implicitly through `ownerOf`; no hard-coded 5,000 range is needed.
+- No ERC-2981 lookup is performed. The fixed 2.5%/recipient rule is the single royalty rule, avoiding a mutable or malformed external royalty response.
+
+Required events are `ListingFilled(orderHash, seller, buyer, tokenId, price, royalty)`, `OfferFilled(orderHash, buyer, seller, tokenId, price, royalty)`, `OrderCancelled(orderHash, signer)`, and `MinNonceIncremented(signer, oldNonce, newNonce)`. Define custom errors for every validation/failure branch so the UI and audit tests can distinguish them. Names and parameter indexing are frozen before audit.
+
+## 4. State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| Sign/post listing | Seller (signature; API request) | Wants the NFT exposed for sale | Nothing is listed; NFT remains owned by seller |
+| `buy` | Buyer | Receives the NFT at the signed price | Listing remains fillable until expiry/cancellation/state invalidation |
+| Sign/post offer | Buyer (signature; API request) | Wants the NFT; retains WETH custody | No offer exists; no funds move |
+| `acceptOffer` | Current owner | Receives 97.5% of the offered WETH | Offer remains fillable until expiry/cancellation/state invalidation |
+| Cancel one order | Order signer | Permanently prevents that signature from settling | It may remain fillable if all validations hold |
+| `incrementMinNonce` | Account invalidating its orders | Cancels many old orders in one transaction | Older signatures remain individually valid |
+
+There are no scheduled transitions, keepers, privileged relayers, or owner-only liveness dependencies.
+
+## 5. Four-week build plan
+
+### Week 1 — freeze behavior and prove compatibility
+
+- Confirm collection, WETH, and artist multisig addresses from authoritative sources; document them without guessing.
+- Fork mainnet and prove buy/transfer/approval behavior against representative collection tokens and the canonical WETH contract.
+- Finalize EIP-712 schemas, typed cancellation ABI, payout ordering, rounding rule, events, errors, threat model, wireframes, and acceptance criteria.
+- Scaffold contract, deployment scripts, app, database schema, and event indexer. Produce deterministic typed-data fixtures shared by Solidity and TypeScript.
+- Exit: signed architecture/interface document, fork compatibility evidence, clickable happy-path UI shell, and audit firm confirms this scope is quoteable.
+
+### Week 2 — complete and test the contract
+
+- Implement the single immutable marketplace and deployment/verification scripts.
+- Unit and fuzz test signatures, ERC-1271, replay, cross-type/domain/chain replay, nonce boundaries, deadline boundaries, private takers, ownership/approval changes, fee rounding, exact ETH, WETH allowance/balance, hostile receivers/tokens, reentrancy, atomic rollback, and event correctness.
+- Add invariants: no order fills twice; only a valid current owner can sell; buyer receives exactly the specified token or the call reverts; artist gets exactly the calculated royalty; seller gets the remainder; successful settlement leaves no marketplace ETH/WETH/NFT custody; contract has no privileged state change.
+- Run static analysis, coverage, formatting, and mainnet-fork end-to-end tests. Freeze a release-candidate commit and provide it to the auditor at week end.
+- Exit: all tests green, high branch coverage on custom contract logic, compiler/dependencies locked, audit begins on a frozen hash.
+
+### Week 3 — vertical product slice while audit runs
+
+- Implement wallet and network guards, ownership gallery, signing, approval, buy, WETH wrap/approve, offer, acceptance, typed cancellation, bulk nonce cancellation, and clear transaction/error states.
+- Implement signature validation at API ingestion, event-driven order reconciliation, confirmations/reorg handling, periodic chain reconciliation, and filtering of currently invalid orders.
+- Add analytics/alerts for failed settlement, indexer lag, RPC failures, and unexpected marketplace balances. Never log signed payloads or sensitive API credentials unnecessarily.
+- Complete browser tests for seller, buyer, smart-wallet signer, stale listing, sold token, expired order, cancellation, insufficient WETH/allowance, rejected signature, and reverted payout.
+- Exit: staging vertical slice passes on a mainnet fork and a public Ethereum test environment; audit findings are triaged without deploying unaudited changes.
+
+### Week 4 — remediate, review, deploy, and launch
+
+- Fix audit findings, add regression tests, and return the exact remediation commit/diff for auditor verification. Any feature or contract-interface change triggers explicit audit-scope review.
+- Have an independent reviewer run the full acceptance checklist against the final commit, including mobile/wallet UX, indexer recovery, reorg simulation, and mainnet-fork settlements.
+- Deploy the exact audited bytecode to Ethereum mainnet, verify source, verify immutable values, seed/index historical metadata, and execute a low-value end-to-end sale and offer with team-owned tokens/accounts.
+- Publish contract address, verified-source link, fee/royalty disclosure, WETH-offer explanation, cancellation semantics, risk notice, and support/runbook documentation. Monitor closely and keep a launch rollback switch for the web UI only; the immutable contract cannot be paused.
+- Exit: auditor confirms remediation, bytecode matches audited build, smoke transactions and balance assertions pass, monitoring is live, and sign-off is recorded.
+
+The schedule assumes an auditor is booked before week 1 and starts at the end of week 2. Audit delay moves mainnet launch; it does not justify deploying the unaudited contract.
+
+## 6. Precise audit scope
+
+### In scope
+
+1. The final `CollectionMarketplace.sol` and every inherited or linked Solidity source compiled into it.
+2. The pinned OpenZeppelin contracts actually imported: EIP-712/signature checking, ERC-20 safe transfer, ERC-721 interfaces/receiver interactions as applicable, and reentrancy guard.
+3. Deployment and constructor-argument scripts insofar as they select chain ID, collection, canonical mainnet WETH, royalty multisig, compiler settings, optimizer settings, and deployed bytecode.
+4. Solidity unit, fuzz, invariant, and mainnet-fork tests as supporting evidence (tests are reviewed but are not a substitute for contract review).
+5. EIP-712 schema/constants and the TypeScript encoder fixture solely for equivalence with Solidity hashes.
+6. Integration assumptions for the exact existing collection and canonical WETH contracts, using their verified mainnet bytecode/interfaces. Those third-party contracts are not re-audited, but unusual behavior and integration risk are assessed.
+7. All externally reachable paths and trust boundaries described above: listing purchase, offer acceptance, individual/bulk cancellation, ETH/WETH payout, ERC-1271, ERC-721 callbacks, event truthfulness, and immutable configuration.
+
+Ask the auditor to assess at minimum: authorization and signature malleability; replay across orders/types/contracts/chains; nonce/cancellation correctness; stale ownership and approvals; frontrunning and authorized takers; self-sale; reentrancy/callback ordering; checks-effects-interactions; fee math/rounding; ETH accounting and forced ETH; WETH return-value/nonstandard behavior; atomicity; denial of service by payout recipients or ERC-1271 wallets; hostile buyer/seller contracts; event/indexer ambiguity; constructor misconfiguration; lack of admin recovery/pause; and compliance of the bytecode/build with the reviewed source.
+
+### Explicitly out of scope
+
+- The existing NFT and WETH implementations beyond integration assumptions; wallets, RPC providers, IPFS, metadata, and marketplace contracts not deployed by this project.
+- Frontend, API, database, indexer availability/security, cloud/IAM, DNS, analytics, and wallet-extension internals, except the typed-data encoder fixture noted above. These need separate application security and operational review.
+- Royalty enforcement outside this marketplace, legal/tax/regulatory conclusions, economic appraisal, wash trading, phishing/social engineering, private-key/multisig signer compromise, and marketplace discovery/traffic.
+- Auctions, bids requiring native-ETH escrow, collection offers, bundles, ERC-1155, lazy minting, permits, meta-transactions/relayers, delegated registries, arbitrary currencies/collections, upgradeability, pausing, fee changes, fee splitters, and recovery functions.
+
+### Quote package and change control
+
+Give the auditor: repository commit hash; exact in-scope file list and lines of Solidity; compiler/optimizer/EVM target and dependency lockfile; final ABI, storage layout, EIP-712 schemas and fixtures; architecture/payment-flow diagram; this threat model and invariants; test and coverage reports; static-analysis output; verified addresses and fork block; known issues; deployment script and intended constructor arguments.
+
+Request separate quote lines for (a) initial review, (b) one remediation review covering only fixes, and (c) optional deployment-bytecode verification. State the expected delivery dates needed for week 4. After scope freeze, record every Solidity, dependency, compiler-setting, constructor, or typed-data change in a diff manifest. New functionality or a changed trust boundary is a new audit scope; narrowly corrective changes receive remediation review. Mainnet deployment is gated on written closure or explicit risk acceptance for every finding.
+
+## 7. Deployment runbook and release gates
+
+The repository README must contain executable commands using the chosen framework for build, full tests, fixed-block mainnet-fork tests, deterministic deployment, source verification, and bytecode comparison. Do not invent commands until the framework is selected in week 1. Required secrets/configuration are an Ethereum mainnet RPC URL, block-explorer API key, deployer key/hardware-wallet path, collection address, canonical WETH address, royalty multisig, and deployer funding; secrets stay outside the repository.
+
+Pre-deploy gates:
+
+- final commit and bytecode are covered by audit/remediation confirmation;
+- chain ID is 1; all three constructor addresses are nonzero, checksummed, independently verified, and approved by two people;
+- royalty recipient is the intended multisig and its signer/recovery policy has been tested;
+- fork tests pass against the selected recent block and CI reproduces the build;
+- frontend/API point to the computed deployment address only after verified source and immutable values are checked.
+
+Post-deploy smoke test:
+
+1. Verify source and compare runtime bytecode with the audited artifact.
+2. Read and record all immutables and the EIP-712 domain.
+3. With a team-owned NFT, approve the marketplace, sign a low-price listing, buy it from a second account, and assert NFT ownership plus the exact 2.5%/97.5% ETH split.
+4. Wrap/approve WETH from the first account, sign a token offer, accept it from the current owner, and assert ownership plus the exact WETH split.
+5. Sign and cancel one order and bulk-invalidate another; prove both settlement attempts revert.
+6. Confirm indexed events match receipts and the marketplace holds no NFT, ETH, or WETH attributable to successful settlements.
+
+If a smoke step fails, keep creation and display of new orders disabled in the web UI, publish status, preserve evidence, and investigate. Because the contract is immutable and unpausable, do not advertise it as ready until every gate passes.

tokens used
24,488
Created [plan.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-28T143527Z-codex-with-skill-1/workspace/plan.md).

It includes:

- Four-week MVP delivery plan
- Non-custodial signed listings
- WETH-based offers without escrow
- Immutable 2.5% artist royalty
- Exact contract interface and settlement rules
- State-transition and liveness table
- Precise audit inclusions, exclusions, and quote package
- Security invariants, testing requirements, deployment gates, and mainnet smoke tests
