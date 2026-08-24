Reading additional input from stdin...
2026-08-24T20:55:03.899224Z ERROR codex_models_manager::cache: failed to load models cache: missing field `base_instructions` at line 97 column 5
OpenAI Codex v0.146.1
--------
workdir: /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-24T205503Z-codex-with-skill-1/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a0358e-2977-77d3-8cbc-f8211532c9cf
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
2026-08-24T20:55:04.536758Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a0358e-2977-77d3-8cbc-f8211532c9cf.tmp-1787604904343769012: line 2547: syntax error near unexpected token `('

codex
I’m using the `ship` skill because this request is specifically about defining an Ethereum dApp boundary, contract surface, and production/audit handoff. I’ll read its guidance, inspect the workspace task, then write `plan.md`.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/ship/SKILL.md && find . -maxdepth 2 -type f -not -path './.git/*' -print" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-24T205503Z-codex-with-skill-1/workspace
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
./TASK.md

codex
The key architecture choice is a single non-custodial marketplace contract on Ethereum mainnet. Listings store intent but never transfer the NFT; delayed offers use WETH, since native ETH cannot be pulled from a buyer’s wallet later. Acceptance remains atomic and can fail safely if ownership, approval, balance, or allowance changed.
apply patch
patch: completed
/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-24T205503Z-codex-with-skill-1/workspace/plan.md
diff --git a/artifacts/ship-quiz-001/2026-08-24T205503Z-codex-with-skill-1/workspace/plan.md b/artifacts/ship-quiz-001/2026-08-24T205503Z-codex-with-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..e124f085be7e877aa613599f83612309f5ae864e
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-08-24T205503Z-codex-with-skill-1/workspace/plan.md
@@ -0,0 +1,128 @@
+# Four-week NFT marketplace MVP plan
+
+## MVP decision
+
+Ship one non-upgradeable `CollectionMarketplace` contract on Ethereum mainnet for the existing ERC-721 collection. The site and indexer are offchain; ownership and settlement remain onchain.
+
+The marketplace is non-custodial while an item is listed. A listing records the seller's intent, but the NFT stays in the seller's wallet until `buy` transfers it atomically. A seller must approve the marketplace as an operator. If ownership or approval changes, a purchase reverts and the indexer marks the listing stale.
+
+Use native ETH for immediate purchases and WETH for offers. A later contract call cannot pull native ETH from an offer maker, so an offer maker must hold WETH and approve the marketplace. WETH is not escrowed: at acceptance, the contract atomically pulls it from the buyer and pays the seller and artist. An offer can therefore become unfillable if the buyer withdraws WETH or revokes approval; the UI must show this and acceptance must fail without moving the NFT.
+
+The artist receives exactly 250 basis points of the gross sale price and the seller receives the other 9,750 basis points. The artist payout address is immutable. This guarantees the cut for sales settled through this contract, not for direct transfers or other marketplaces. If collection-wide royalty enforcement is a requirement, that is a separate token-contract and ecosystem decision and is outside this MVP.
+
+### Onchain boundary
+
+One custom contract stores active listings and offers and performs atomic ERC-721/payment settlement. It emits events for every create, cancel, fill, and invalidation-relevant action. It has no proxy, owner, pause switch, arbitrary-call router, custody function, protocol fee, or admin price control.
+
+Offchain services provide collection metadata, image hosting, search/filter/sort, activity history, wallet notifications, fiat estimates, and an indexed view of active/stale orders. The chain remains the source of truth at execution time. No rankings or derived marketplace state are stored onchain.
+
+### Proposed contract surface
+
+Constructor parameters are `collection`, canonical mainnet `WETH`, and `artistRecipient`; each is immutable. The contract accepts only tokens from `collection`.
+
+- `list(tokenId, price)` — current owner creates or replaces an active ETH listing; `price > 0`.
+- `cancelListing(tokenId)` — recorded seller cancels their listing.
+- `buy(tokenId)` payable — checks the recorded seller still owns the token, marketplace approval remains valid, and `msg.value == price`; deletes listing before external calls, transfers the NFT to the buyer, then pays 2.5% to the artist and 97.5% to the seller.
+- `makeOffer(tokenId, amount, expiry)` — records or replaces the caller's WETH offer; `amount > 0` and `expiry > block.timestamp`. No WETH is moved here.
+- `cancelOffer(tokenId)` — maker cancels their offer.
+- `acceptOffer(tokenId, maker)` — current owner accepts an unexpired offer; deletes it before external calls, pulls the exact WETH amount from the maker, transfers the NFT, and distributes WETH 2.5%/97.5%.
+
+Use an offer key of `(tokenId, maker)`, so competing offers can coexist. Bind every order to this contract, chain, and immutable collection by storage rather than accepting arbitrary targets. Define rounding as `artistAmount = price * 250 / 10_000` (round down) and `sellerAmount = price - artistAmount`, so no dust remains.
+
+Settlement uses OpenZeppelin `ReentrancyGuard`, `SafeERC20`, and ERC-721 interfaces. State is cleared before interactions. ETH payout behavior must be chosen before implementation and frozen for audit: the recommended MVP uses a pull-payment credit ledger when an ETH send fails, with `withdrawCredits()` callable only by the credited recipient. This prevents a reverting seller or artist wallet from blocking delivery while ensuring the full amount remains owed. WETH settlement uses `safeTransferFrom` directly and reverts atomically on failure. The contract rejects accidental ETH except through `buy` and has no general token rescue function.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `list` | NFT owner | Offers the NFT for sale | No listing exists |
+| `cancelListing` | recorded seller | Removes unwanted sale authorization | Listing stays visible but can only fill if ownership/approval and price checks pass |
+| `buy` | buyer | Receives the NFT | Listing remains open |
+| `makeOffer` | buyer | Creates a purchasable bid | No offer exists |
+| `cancelOffer` | offer maker | Removes their bid | Offer remains until expiry/acceptance, but cannot pull funds without balance and allowance |
+| `acceptOffer` | current NFT owner | Receives sale proceeds | NFT and buyer's WETH remain in their wallets |
+| `withdrawCredits` | credited seller or artist | Receives an ETH payout that previously failed | Credit remains claimable indefinitely |
+
+Expiry does not require a keeper: expired offers simply fail validation and are hidden by the indexer. Stale listings similarly need no cleanup transaction.
+
+## Four-week build plan
+
+### Week 1 — specification and contract skeleton
+
+- Confirm the deployed collection address, standard ERC-721 behavior, artist multisig/payout address, canonical WETH address, and exact event/schema requirements.
+- Freeze the invariants, rounding, ETH fallback-credit behavior, approval UX, offer expiry limits, and explicit exclusions below.
+- Implement the single contract and events using pinned OpenZeppelin dependencies.
+- Add unit tests for authorization, replacement/cancellation, expiry, exact payment, fee math, stale ownership/approval, replay/double-fill, and revert atomicity.
+- Deliver a contract API/event document and threat model for auditor review. This is the scope-freeze milestone.
+
+### Week 2 — integration and adversarial tests
+
+- Complete fuzz and invariant tests: conservation of value, no double fills, only current owner can sell, fee is always 250 bps, deleted state cannot replay, and no successful path strands an NFT in the marketplace.
+- Add a mainnet-fork suite against the exact collection and canonical WETH contracts, including approvals, safe transfers, WETH allowance/balance failure, contract sellers/buyers, and payout recipients that reject ETH.
+- Build the event indexer and API for active listings/offers and stale-order detection.
+- Implement wallet flows for list, cancel, buy, wrap/approve WETH, offer, cancel offer, accept, and withdraw credit.
+
+### Week 3 — complete vertical slice and audit candidate
+
+- Integrate browse/detail/activity screens, transaction simulation, chain/account checks, clear ETH-versus-WETH copy, expiry display, and actionable failure messages.
+- Exercise the full path on a mainnet fork and a public Ethereum test environment using representative collection tokens or a faithful test collection.
+- Run static analysis, coverage, lint/type checks, dependency review, and an independent internal security review; resolve all findings.
+- Freeze commit, compiler/settings, dependency lockfile, deployment script, test corpus, NatSpec, architecture diagram, and audit package. No feature work enters the audit commit.
+
+### Week 4 — audit, remediation, and launch readiness
+
+- Auditor reviews the frozen commit; team answers questions without silently changing scope.
+- Fix findings on a dedicated branch, add a regression test for each finding, and provide a compact diff for auditor retest/sign-off.
+- Deploy from the signed-off commit to Ethereum mainnet, verify source, and configure the production indexer/UI from emitted deployment data.
+- Run a low-value end-to-end listing, purchase, offer, acceptance, cancellation, fee, and failed-ETH-credit withdrawal check before opening the UI.
+- Publish contract address, verified source, known limitations, and incident contacts; monitor events, RPC/indexing lag, revert rates, and failed payout credits.
+
+The four-week target assumes an auditor reserves Week 4 in advance and receives the frozen package at the end of Week 3. A critical finding or scope change moves launch; the audit is not compressed to preserve the date.
+
+## Precise audit scope for quotation
+
+### In scope
+
+The quote should cover one Solidity contract, expected at roughly 250–400 non-comment source lines, plus directly used local libraries (if any):
+
+1. `CollectionMarketplace.sol` at a named frozen Git commit.
+2. Solidity compiler version, optimizer settings, deployment/constructor script, and dependency lockfile.
+3. All seven state-changing entry points listed above, receive/fallback rejection behavior, events, storage layout, and constructor validation.
+4. Integration assumptions for the exact Ethereum mainnet ERC-721 collection and canonical WETH9 addresses.
+5. Unit, fuzz, invariant, and mainnet-fork tests as evidence; the auditor is asked to identify missing cases, not to certify frontend behavior.
+6. Deployment bytecode reproducibility and verification of constructor arguments and immutables.
+7. One remediation review of changes made solely in response to findings.
+
+Provide the auditor the collection ABI/source or verified address, WETH address, architecture and transition table, trust assumptions, invariants, known limitations, test commands, coverage report, static-analysis output, and intended deployment configuration before the quote is finalized.
+
+### Security properties to assess
+
+- Only the current owner can list/cancel their listing or accept an offer; an offer can only be cancelled by its maker.
+- A fill cannot succeed after cancellation, expiry, prior fill, ownership change, or lost NFT approval.
+- Each successful settlement transfers exactly one intended collection token to the intended buyer and charges exactly the recorded price once.
+- Artist and seller accounting always sum to the gross price; artist accounting is exactly floor(2.5%), with no retained dust or hidden protocol fee.
+- Reentrancy, malicious ERC-721 receiver callbacks, reverting ETH recipients, and unexpected token behavior cannot double-fill, steal funds, corrupt order state, or permanently block legitimate withdrawals.
+- WETH offers cannot spend more than authorized; insufficient/revoked balance or allowance reverts the whole acceptance, including NFT transfer.
+- Failed ETH sends create the correct credit exactly once; only the credited address can withdraw it; failed withdrawals preserve credit.
+- Front-running and transaction-ordering outcomes are understood: listed prices are public; seller cancellation can race a buy; offer cancellation/allowance changes can race acceptance. No transaction promises priority beyond Ethereum ordering.
+- There is no admin path, upgrade path, arbitrary external call, cross-collection fill, signature replay surface, accidental NFT custody path, or unbounded loop/keeper dependency.
+- Gas consumption cannot make any user path practically uncallable; mappings do not require onchain enumeration.
+
+### Explicitly out of scope
+
+- The already-deployed NFT contract, its mint, metadata, provenance, and any royalty behavior outside this marketplace.
+- Frontend, wallet software, indexer/database, RPC providers, hosting, DNS, analytics, notifications, fiat conversion, and Discord migration, except where they reveal a mismatch with the documented contract API.
+- Third-party OpenZeppelin and canonical WETH source internals; their correct configuration and interaction remain in scope.
+- Other marketplaces, aggregator/router integration, signed gasless orders, auctions, collection bids, trait bids, bundles, partial fills, private sales, ERC-20 currencies other than WETH, fee changes, upgradeability, pausing, governance, allowlists, and cross-chain deployment.
+- Formal verification, economic/market manipulation analysis, compromised wallets/keys, artist multisig operations, and production infrastructure penetration testing.
+- Enforcing the 2.5% fee on transfers or sales that do not use this marketplace.
+
+Any addition or semantic change after scope freeze—including a proxy, signature orders, new currency, configurable fee/recipient, escrow, bulk operation, rescue/admin function, or alternate NFT standard—requires auditor approval and a revised quote. The launch artifact must match the auditor-reviewed commit apart from documented constructor arguments.
+
+## Deployment and production handoff
+
+Target Ethereum mainnet because the collection and its liquidity already live there; moving marketplace settlement to an L2 would not move mainnet NFTs without a bridge and would fragment the product. Exact gas costs must be measured against the final bytecode and current mainnet conditions before launch, then displayed as wallet estimates rather than promised figures.
+
+The repository README must contain executable test, fork-test, deploy, and source-verification commands; pinned toolchain versions; required RPC/explorer/deployer environment variable names; expected constructor arguments; deployed address; verified-source link; and rollback posture (disable the UI/indexer submission path, since the immutable contract cannot be paused). Deployment should use a dedicated hardware-backed deployer. Because the contract has no owner, there is no production ownership transfer; the immutable `artistRecipient` should be the artist's intended Safe multisig and must be independently checked before broadcast.
+
+Launch only after the audit remediation review closes all accepted critical/high findings, the exact bytecode verifies, and a fresh reviewer completes the low-value end-to-end checks. Keep the old Discord process available during a short staged rollout, but clearly warn users that only onchain state—not Discord messages or the indexer—is authoritative.

diff --git a/artifacts/ship-quiz-001/2026-08-24T205503Z-codex-with-skill-1/workspace/plan.md b/artifacts/ship-quiz-001/2026-08-24T205503Z-codex-with-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..e124f085be7e877aa613599f83612309f5ae864e
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-08-24T205503Z-codex-with-skill-1/workspace/plan.md
@@ -0,0 +1,128 @@
+# Four-week NFT marketplace MVP plan
+
+## MVP decision
+
+Ship one non-upgradeable `CollectionMarketplace` contract on Ethereum mainnet for the existing ERC-721 collection. The site and indexer are offchain; ownership and settlement remain onchain.
+
+The marketplace is non-custodial while an item is listed. A listing records the seller's intent, but the NFT stays in the seller's wallet until `buy` transfers it atomically. A seller must approve the marketplace as an operator. If ownership or approval changes, a purchase reverts and the indexer marks the listing stale.
+
+Use native ETH for immediate purchases and WETH for offers. A later contract call cannot pull native ETH from an offer maker, so an offer maker must hold WETH and approve the marketplace. WETH is not escrowed: at acceptance, the contract atomically pulls it from the buyer and pays the seller and artist. An offer can therefore become unfillable if the buyer withdraws WETH or revokes approval; the UI must show this and acceptance must fail without moving the NFT.
+
+The artist receives exactly 250 basis points of the gross sale price and the seller receives the other 9,750 basis points. The artist payout address is immutable. This guarantees the cut for sales settled through this contract, not for direct transfers or other marketplaces. If collection-wide royalty enforcement is a requirement, that is a separate token-contract and ecosystem decision and is outside this MVP.
+
+### Onchain boundary
+
+One custom contract stores active listings and offers and performs atomic ERC-721/payment settlement. It emits events for every create, cancel, fill, and invalidation-relevant action. It has no proxy, owner, pause switch, arbitrary-call router, custody function, protocol fee, or admin price control.
+
+Offchain services provide collection metadata, image hosting, search/filter/sort, activity history, wallet notifications, fiat estimates, and an indexed view of active/stale orders. The chain remains the source of truth at execution time. No rankings or derived marketplace state are stored onchain.
+
+### Proposed contract surface
+
+Constructor parameters are `collection`, canonical mainnet `WETH`, and `artistRecipient`; each is immutable. The contract accepts only tokens from `collection`.
+
+- `list(tokenId, price)` — current owner creates or replaces an active ETH listing; `price > 0`.
+- `cancelListing(tokenId)` — recorded seller cancels their listing.
+- `buy(tokenId)` payable — checks the recorded seller still owns the token, marketplace approval remains valid, and `msg.value == price`; deletes listing before external calls, transfers the NFT to the buyer, then pays 2.5% to the artist and 97.5% to the seller.
+- `makeOffer(tokenId, amount, expiry)` — records or replaces the caller's WETH offer; `amount > 0` and `expiry > block.timestamp`. No WETH is moved here.
+- `cancelOffer(tokenId)` — maker cancels their offer.
+- `acceptOffer(tokenId, maker)` — current owner accepts an unexpired offer; deletes it before external calls, pulls the exact WETH amount from the maker, transfers the NFT, and distributes WETH 2.5%/97.5%.
+
+Use an offer key of `(tokenId, maker)`, so competing offers can coexist. Bind every order to this contract, chain, and immutable collection by storage rather than accepting arbitrary targets. Define rounding as `artistAmount = price * 250 / 10_000` (round down) and `sellerAmount = price - artistAmount`, so no dust remains.
+
+Settlement uses OpenZeppelin `ReentrancyGuard`, `SafeERC20`, and ERC-721 interfaces. State is cleared before interactions. ETH payout behavior must be chosen before implementation and frozen for audit: the recommended MVP uses a pull-payment credit ledger when an ETH send fails, with `withdrawCredits()` callable only by the credited recipient. This prevents a reverting seller or artist wallet from blocking delivery while ensuring the full amount remains owed. WETH settlement uses `safeTransferFrom` directly and reverts atomically on failure. The contract rejects accidental ETH except through `buy` and has no general token rescue function.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `list` | NFT owner | Offers the NFT for sale | No listing exists |
+| `cancelListing` | recorded seller | Removes unwanted sale authorization | Listing stays visible but can only fill if ownership/approval and price checks pass |
+| `buy` | buyer | Receives the NFT | Listing remains open |
+| `makeOffer` | buyer | Creates a purchasable bid | No offer exists |
+| `cancelOffer` | offer maker | Removes their bid | Offer remains until expiry/acceptance, but cannot pull funds without balance and allowance |
+| `acceptOffer` | current NFT owner | Receives sale proceeds | NFT and buyer's WETH remain in their wallets |
+| `withdrawCredits` | credited seller or artist | Receives an ETH payout that previously failed | Credit remains claimable indefinitely |
+
+Expiry does not require a keeper: expired offers simply fail validation and are hidden by the indexer. Stale listings similarly need no cleanup transaction.
+
+## Four-week build plan
+
+### Week 1 — specification and contract skeleton
+
+- Confirm the deployed collection address, standard ERC-721 behavior, artist multisig/payout address, canonical WETH address, and exact event/schema requirements.
+- Freeze the invariants, rounding, ETH fallback-credit behavior, approval UX, offer expiry limits, and explicit exclusions below.
+- Implement the single contract and events using pinned OpenZeppelin dependencies.
+- Add unit tests for authorization, replacement/cancellation, expiry, exact payment, fee math, stale ownership/approval, replay/double-fill, and revert atomicity.
+- Deliver a contract API/event document and threat model for auditor review. This is the scope-freeze milestone.
+
+### Week 2 — integration and adversarial tests
+
+- Complete fuzz and invariant tests: conservation of value, no double fills, only current owner can sell, fee is always 250 bps, deleted state cannot replay, and no successful path strands an NFT in the marketplace.
+- Add a mainnet-fork suite against the exact collection and canonical WETH contracts, including approvals, safe transfers, WETH allowance/balance failure, contract sellers/buyers, and payout recipients that reject ETH.
+- Build the event indexer and API for active listings/offers and stale-order detection.
+- Implement wallet flows for list, cancel, buy, wrap/approve WETH, offer, cancel offer, accept, and withdraw credit.
+
+### Week 3 — complete vertical slice and audit candidate
+
+- Integrate browse/detail/activity screens, transaction simulation, chain/account checks, clear ETH-versus-WETH copy, expiry display, and actionable failure messages.
+- Exercise the full path on a mainnet fork and a public Ethereum test environment using representative collection tokens or a faithful test collection.
+- Run static analysis, coverage, lint/type checks, dependency review, and an independent internal security review; resolve all findings.
+- Freeze commit, compiler/settings, dependency lockfile, deployment script, test corpus, NatSpec, architecture diagram, and audit package. No feature work enters the audit commit.
+
+### Week 4 — audit, remediation, and launch readiness
+
+- Auditor reviews the frozen commit; team answers questions without silently changing scope.
+- Fix findings on a dedicated branch, add a regression test for each finding, and provide a compact diff for auditor retest/sign-off.
+- Deploy from the signed-off commit to Ethereum mainnet, verify source, and configure the production indexer/UI from emitted deployment data.
+- Run a low-value end-to-end listing, purchase, offer, acceptance, cancellation, fee, and failed-ETH-credit withdrawal check before opening the UI.
+- Publish contract address, verified source, known limitations, and incident contacts; monitor events, RPC/indexing lag, revert rates, and failed payout credits.
+
+The four-week target assumes an auditor reserves Week 4 in advance and receives the frozen package at the end of Week 3. A critical finding or scope change moves launch; the audit is not compressed to preserve the date.
+
+## Precise audit scope for quotation
+
+### In scope
+
+The quote should cover one Solidity contract, expected at roughly 250–400 non-comment source lines, plus directly used local libraries (if any):
+
+1. `CollectionMarketplace.sol` at a named frozen Git commit.
+2. Solidity compiler version, optimizer settings, deployment/constructor script, and dependency lockfile.
+3. All seven state-changing entry points listed above, receive/fallback rejection behavior, events, storage layout, and constructor validation.
+4. Integration assumptions for the exact Ethereum mainnet ERC-721 collection and canonical WETH9 addresses.
+5. Unit, fuzz, invariant, and mainnet-fork tests as evidence; the auditor is asked to identify missing cases, not to certify frontend behavior.
+6. Deployment bytecode reproducibility and verification of constructor arguments and immutables.
+7. One remediation review of changes made solely in response to findings.
+
+Provide the auditor the collection ABI/source or verified address, WETH address, architecture and transition table, trust assumptions, invariants, known limitations, test commands, coverage report, static-analysis output, and intended deployment configuration before the quote is finalized.
+
+### Security properties to assess
+
+- Only the current owner can list/cancel their listing or accept an offer; an offer can only be cancelled by its maker.
+- A fill cannot succeed after cancellation, expiry, prior fill, ownership change, or lost NFT approval.
+- Each successful settlement transfers exactly one intended collection token to the intended buyer and charges exactly the recorded price once.
+- Artist and seller accounting always sum to the gross price; artist accounting is exactly floor(2.5%), with no retained dust or hidden protocol fee.
+- Reentrancy, malicious ERC-721 receiver callbacks, reverting ETH recipients, and unexpected token behavior cannot double-fill, steal funds, corrupt order state, or permanently block legitimate withdrawals.
+- WETH offers cannot spend more than authorized; insufficient/revoked balance or allowance reverts the whole acceptance, including NFT transfer.
+- Failed ETH sends create the correct credit exactly once; only the credited address can withdraw it; failed withdrawals preserve credit.
+- Front-running and transaction-ordering outcomes are understood: listed prices are public; seller cancellation can race a buy; offer cancellation/allowance changes can race acceptance. No transaction promises priority beyond Ethereum ordering.
+- There is no admin path, upgrade path, arbitrary external call, cross-collection fill, signature replay surface, accidental NFT custody path, or unbounded loop/keeper dependency.
+- Gas consumption cannot make any user path practically uncallable; mappings do not require onchain enumeration.
+
+### Explicitly out of scope
+
+- The already-deployed NFT contract, its mint, metadata, provenance, and any royalty behavior outside this marketplace.
+- Frontend, wallet software, indexer/database, RPC providers, hosting, DNS, analytics, notifications, fiat conversion, and Discord migration, except where they reveal a mismatch with the documented contract API.
+- Third-party OpenZeppelin and canonical WETH source internals; their correct configuration and interaction remain in scope.
+- Other marketplaces, aggregator/router integration, signed gasless orders, auctions, collection bids, trait bids, bundles, partial fills, private sales, ERC-20 currencies other than WETH, fee changes, upgradeability, pausing, governance, allowlists, and cross-chain deployment.
+- Formal verification, economic/market manipulation analysis, compromised wallets/keys, artist multisig operations, and production infrastructure penetration testing.
+- Enforcing the 2.5% fee on transfers or sales that do not use this marketplace.
+
+Any addition or semantic change after scope freeze—including a proxy, signature orders, new currency, configurable fee/recipient, escrow, bulk operation, rescue/admin function, or alternate NFT standard—requires auditor approval and a revised quote. The launch artifact must match the auditor-reviewed commit apart from documented constructor arguments.
+
+## Deployment and production handoff
+
+Target Ethereum mainnet because the collection and its liquidity already live there; moving marketplace settlement to an L2 would not move mainnet NFTs without a bridge and would fragment the product. Exact gas costs must be measured against the final bytecode and current mainnet conditions before launch, then displayed as wallet estimates rather than promised figures.
+
+The repository README must contain executable test, fork-test, deploy, and source-verification commands; pinned toolchain versions; required RPC/explorer/deployer environment variable names; expected constructor arguments; deployed address; verified-source link; and rollback posture (disable the UI/indexer submission path, since the immutable contract cannot be paused). Deployment should use a dedicated hardware-backed deployer. Because the contract has no owner, there is no production ownership transfer; the immutable `artistRecipient` should be the artist's intended Safe multisig and must be independently checked before broadcast.
+
+Launch only after the audit remediation review closes all accepted critical/high findings, the exact bytecode verifies, and a fresh reviewer completes the low-value end-to-end checks. Keep the old Discord process available during a short staged rollout, but clearly warn users that only onchain state—not Discord messages or the indexer—is authoritative.

2026-08-24T20:56:14.171397Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `base_instructions` at line 97 column 5
exec
/bin/bash -lc "wc -l plan.md && sed -n '1,80p' plan.md && git diff -- plan.md" in /ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-24T205503Z-codex-with-skill-1/workspace
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
128 plan.md
# Four-week NFT marketplace MVP plan

## MVP decision

Ship one non-upgradeable `CollectionMarketplace` contract on Ethereum mainnet for the existing ERC-721 collection. The site and indexer are offchain; ownership and settlement remain onchain.

The marketplace is non-custodial while an item is listed. A listing records the seller's intent, but the NFT stays in the seller's wallet until `buy` transfers it atomically. A seller must approve the marketplace as an operator. If ownership or approval changes, a purchase reverts and the indexer marks the listing stale.

Use native ETH for immediate purchases and WETH for offers. A later contract call cannot pull native ETH from an offer maker, so an offer maker must hold WETH and approve the marketplace. WETH is not escrowed: at acceptance, the contract atomically pulls it from the buyer and pays the seller and artist. An offer can therefore become unfillable if the buyer withdraws WETH or revokes approval; the UI must show this and acceptance must fail without moving the NFT.

The artist receives exactly 250 basis points of the gross sale price and the seller receives the other 9,750 basis points. The artist payout address is immutable. This guarantees the cut for sales settled through this contract, not for direct transfers or other marketplaces. If collection-wide royalty enforcement is a requirement, that is a separate token-contract and ecosystem decision and is outside this MVP.

### Onchain boundary

One custom contract stores active listings and offers and performs atomic ERC-721/payment settlement. It emits events for every create, cancel, fill, and invalidation-relevant action. It has no proxy, owner, pause switch, arbitrary-call router, custody function, protocol fee, or admin price control.

Offchain services provide collection metadata, image hosting, search/filter/sort, activity history, wallet notifications, fiat estimates, and an indexed view of active/stale orders. The chain remains the source of truth at execution time. No rankings or derived marketplace state are stored onchain.

### Proposed contract surface

Constructor parameters are `collection`, canonical mainnet `WETH`, and `artistRecipient`; each is immutable. The contract accepts only tokens from `collection`.

- `list(tokenId, price)` — current owner creates or replaces an active ETH listing; `price > 0`.
- `cancelListing(tokenId)` — recorded seller cancels their listing.
- `buy(tokenId)` payable — checks the recorded seller still owns the token, marketplace approval remains valid, and `msg.value == price`; deletes listing before external calls, transfers the NFT to the buyer, then pays 2.5% to the artist and 97.5% to the seller.
- `makeOffer(tokenId, amount, expiry)` — records or replaces the caller's WETH offer; `amount > 0` and `expiry > block.timestamp`. No WETH is moved here.
- `cancelOffer(tokenId)` — maker cancels their offer.
- `acceptOffer(tokenId, maker)` — current owner accepts an unexpired offer; deletes it before external calls, pulls the exact WETH amount from the maker, transfers the NFT, and distributes WETH 2.5%/97.5%.

Use an offer key of `(tokenId, maker)`, so competing offers can coexist. Bind every order to this contract, chain, and immutable collection by storage rather than accepting arbitrary targets. Define rounding as `artistAmount = price * 250 / 10_000` (round down) and `sellerAmount = price - artistAmount`, so no dust remains.

Settlement uses OpenZeppelin `ReentrancyGuard`, `SafeERC20`, and ERC-721 interfaces. State is cleared before interactions. ETH payout behavior must be chosen before implementation and frozen for audit: the recommended MVP uses a pull-payment credit ledger when an ETH send fails, with `withdrawCredits()` callable only by the credited recipient. This prevents a reverting seller or artist wallet from blocking delivery while ensuring the full amount remains owed. WETH settlement uses `safeTransferFrom` directly and reverts atomically on failure. The contract rejects accidental ETH except through `buy` and has no general token rescue function.

### State transitions and liveness

| Transition | Caller | Why they pay gas | If nobody calls |
| --- | --- | --- | --- |
| `list` | NFT owner | Offers the NFT for sale | No listing exists |
| `cancelListing` | recorded seller | Removes unwanted sale authorization | Listing stays visible but can only fill if ownership/approval and price checks pass |
| `buy` | buyer | Receives the NFT | Listing remains open |
| `makeOffer` | buyer | Creates a purchasable bid | No offer exists |
| `cancelOffer` | offer maker | Removes their bid | Offer remains until expiry/acceptance, but cannot pull funds without balance and allowance |
| `acceptOffer` | current NFT owner | Receives sale proceeds | NFT and buyer's WETH remain in their wallets |
| `withdrawCredits` | credited seller or artist | Receives an ETH payout that previously failed | Credit remains claimable indefinitely |

Expiry does not require a keeper: expired offers simply fail validation and are hidden by the indexer. Stale listings similarly need no cleanup transaction.

## Four-week build plan

### Week 1 — specification and contract skeleton

- Confirm the deployed collection address, standard ERC-721 behavior, artist multisig/payout address, canonical WETH address, and exact event/schema requirements.
- Freeze the invariants, rounding, ETH fallback-credit behavior, approval UX, offer expiry limits, and explicit exclusions below.
- Implement the single contract and events using pinned OpenZeppelin dependencies.
- Add unit tests for authorization, replacement/cancellation, expiry, exact payment, fee math, stale ownership/approval, replay/double-fill, and revert atomicity.
- Deliver a contract API/event document and threat model for auditor review. This is the scope-freeze milestone.

### Week 2 — integration and adversarial tests

- Complete fuzz and invariant tests: conservation of value, no double fills, only current owner can sell, fee is always 250 bps, deleted state cannot replay, and no successful path strands an NFT in the marketplace.
- Add a mainnet-fork suite against the exact collection and canonical WETH contracts, including approvals, safe transfers, WETH allowance/balance failure, contract sellers/buyers, and payout recipients that reject ETH.
- Build the event indexer and API for active listings/offers and stale-order detection.
- Implement wallet flows for list, cancel, buy, wrap/approve WETH, offer, cancel offer, accept, and withdraw credit.

### Week 3 — complete vertical slice and audit candidate

- Integrate browse/detail/activity screens, transaction simulation, chain/account checks, clear ETH-versus-WETH copy, expiry display, and actionable failure messages.
- Exercise the full path on a mainnet fork and a public Ethereum test environment using representative collection tokens or a faithful test collection.
- Run static analysis, coverage, lint/type checks, dependency review, and an independent internal security review; resolve all findings.
- Freeze commit, compiler/settings, dependency lockfile, deployment script, test corpus, NatSpec, architecture diagram, and audit package. No feature work enters the audit commit.

### Week 4 — audit, remediation, and launch readiness

- Auditor reviews the frozen commit; team answers questions without silently changing scope.
- Fix findings on a dedicated branch, add a regression test for each finding, and provide a compact diff for auditor retest/sign-off.
- Deploy from the signed-off commit to Ethereum mainnet, verify source, and configure the production indexer/UI from emitted deployment data.
- Run a low-value end-to-end listing, purchase, offer, acceptance, cancellation, fee, and failed-ETH-credit withdrawal check before opening the UI.
- Publish contract address, verified source, known limitations, and incident contacts; monitor events, RPC/indexing lag, revert rates, and failed payout credits.

The four-week target assumes an auditor reserves Week 4 in advance and receives the frozen package at the end of Week 3. A critical finding or scope change moves launch; the audit is not compressed to preserve the date.

diff --git a/artifacts/ship-quiz-001/2026-08-24T205503Z-codex-with-skill-1/workspace/plan.md b/artifacts/ship-quiz-001/2026-08-24T205503Z-codex-with-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..e124f085be7e877aa613599f83612309f5ae864e
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-08-24T205503Z-codex-with-skill-1/workspace/plan.md
@@ -0,0 +1,128 @@
+# Four-week NFT marketplace MVP plan
+
+## MVP decision
+
+Ship one non-upgradeable `CollectionMarketplace` contract on Ethereum mainnet for the existing ERC-721 collection. The site and indexer are offchain; ownership and settlement remain onchain.
+
+The marketplace is non-custodial while an item is listed. A listing records the seller's intent, but the NFT stays in the seller's wallet until `buy` transfers it atomically. A seller must approve the marketplace as an operator. If ownership or approval changes, a purchase reverts and the indexer marks the listing stale.
+
+Use native ETH for immediate purchases and WETH for offers. A later contract call cannot pull native ETH from an offer maker, so an offer maker must hold WETH and approve the marketplace. WETH is not escrowed: at acceptance, the contract atomically pulls it from the buyer and pays the seller and artist. An offer can therefore become unfillable if the buyer withdraws WETH or revokes approval; the UI must show this and acceptance must fail without moving the NFT.
+
+The artist receives exactly 250 basis points of the gross sale price and the seller receives the other 9,750 basis points. The artist payout address is immutable. This guarantees the cut for sales settled through this contract, not for direct transfers or other marketplaces. If collection-wide royalty enforcement is a requirement, that is a separate token-contract and ecosystem decision and is outside this MVP.
+
+### Onchain boundary
+
+One custom contract stores active listings and offers and performs atomic ERC-721/payment settlement. It emits events for every create, cancel, fill, and invalidation-relevant action. It has no proxy, owner, pause switch, arbitrary-call router, custody function, protocol fee, or admin price control.
+
+Offchain services provide collection metadata, image hosting, search/filter/sort, activity history, wallet notifications, fiat estimates, and an indexed view of active/stale orders. The chain remains the source of truth at execution time. No rankings or derived marketplace state are stored onchain.
+
+### Proposed contract surface
+
+Constructor parameters are `collection`, canonical mainnet `WETH`, and `artistRecipient`; each is immutable. The contract accepts only tokens from `collection`.
+
+- `list(tokenId, price)` — current owner creates or replaces an active ETH listing; `price > 0`.
+- `cancelListing(tokenId)` — recorded seller cancels their listing.
+- `buy(tokenId)` payable — checks the recorded seller still owns the token, marketplace approval remains valid, and `msg.value == price`; deletes listing before external calls, transfers the NFT to the buyer, then pays 2.5% to the artist and 97.5% to the seller.
+- `makeOffer(tokenId, amount, expiry)` — records or replaces the caller's WETH offer; `amount > 0` and `expiry > block.timestamp`. No WETH is moved here.
+- `cancelOffer(tokenId)` — maker cancels their offer.
+- `acceptOffer(tokenId, maker)` — current owner accepts an unexpired offer; deletes it before external calls, pulls the exact WETH amount from the maker, transfers the NFT, and distributes WETH 2.5%/97.5%.
+
+Use an offer key of `(tokenId, maker)`, so competing offers can coexist. Bind every order to this contract, chain, and immutable collection by storage rather than accepting arbitrary targets. Define rounding as `artistAmount = price * 250 / 10_000` (round down) and `sellerAmount = price - artistAmount`, so no dust remains.
+
+Settlement uses OpenZeppelin `ReentrancyGuard`, `SafeERC20`, and ERC-721 interfaces. State is cleared before interactions. ETH payout behavior must be chosen before implementation and frozen for audit: the recommended MVP uses a pull-payment credit ledger when an ETH send fails, with `withdrawCredits()` callable only by the credited recipient. This prevents a reverting seller or artist wallet from blocking delivery while ensuring the full amount remains owed. WETH settlement uses `safeTransferFrom` directly and reverts atomically on failure. The contract rejects accidental ETH except through `buy` and has no general token rescue function.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `list` | NFT owner | Offers the NFT for sale | No listing exists |
+| `cancelListing` | recorded seller | Removes unwanted sale authorization | Listing stays visible but can only fill if ownership/approval and price checks pass |
+| `buy` | buyer | Receives the NFT | Listing remains open |
+| `makeOffer` | buyer | Creates a purchasable bid | No offer exists |
+| `cancelOffer` | offer maker | Removes their bid | Offer remains until expiry/acceptance, but cannot pull funds without balance and allowance |
+| `acceptOffer` | current NFT owner | Receives sale proceeds | NFT and buyer's WETH remain in their wallets |
+| `withdrawCredits` | credited seller or artist | Receives an ETH payout that previously failed | Credit remains claimable indefinitely |
+
+Expiry does not require a keeper: expired offers simply fail validation and are hidden by the indexer. Stale listings similarly need no cleanup transaction.
+
+## Four-week build plan
+
+### Week 1 — specification and contract skeleton
+
+- Confirm the deployed collection address, standard ERC-721 behavior, artist multisig/payout address, canonical WETH address, and exact event/schema requirements.
+- Freeze the invariants, rounding, ETH fallback-credit behavior, approval UX, offer expiry limits, and explicit exclusions below.
+- Implement the single contract and events using pinned OpenZeppelin dependencies.
+- Add unit tests for authorization, replacement/cancellation, expiry, exact payment, fee math, stale ownership/approval, replay/double-fill, and revert atomicity.
+- Deliver a contract API/event document and threat model for auditor review. This is the scope-freeze milestone.
+
+### Week 2 — integration and adversarial tests
+
+- Complete fuzz and invariant tests: conservation of value, no double fills, only current owner can sell, fee is always 250 bps, deleted state cannot replay, and no successful path strands an NFT in the marketplace.
+- Add a mainnet-fork suite against the exact collection and canonical WETH contracts, including approvals, safe transfers, WETH allowance/balance failure, contract sellers/buyers, and payout recipients that reject ETH.
+- Build the event indexer and API for active listings/offers and stale-order detection.
+- Implement wallet flows for list, cancel, buy, wrap/approve WETH, offer, cancel offer, accept, and withdraw credit.
+
+### Week 3 — complete vertical slice and audit candidate
+
+- Integrate browse/detail/activity screens, transaction simulation, chain/account checks, clear ETH-versus-WETH copy, expiry display, and actionable failure messages.
+- Exercise the full path on a mainnet fork and a public Ethereum test environment using representative collection tokens or a faithful test collection.
+- Run static analysis, coverage, lint/type checks, dependency review, and an independent internal security review; resolve all findings.
+- Freeze commit, compiler/settings, dependency lockfile, deployment script, test corpus, NatSpec, architecture diagram, and audit package. No feature work enters the audit commit.
+
+### Week 4 — audit, remediation, and launch readiness
+
+- Auditor reviews the frozen commit; team answers questions without silently changing scope.
+- Fix findings on a dedicated branch, add a regression test for each finding, and provide a compact diff for auditor retest/sign-off.
+- Deploy from the signed-off commit to Ethereum mainnet, verify source, and configure the production indexer/UI from emitted deployment data.
+- Run a low-value end-to-end listing, purchase, offer, acceptance, cancellation, fee, and failed-ETH-credit withdrawal check before opening the UI.
+- Publish contract address, verified source, known limitations, and incident contacts; monitor events, RPC/indexing lag, revert rates, and failed payout credits.
+
+The four-week target assumes an auditor reserves Week 4 in advance and receives the frozen package at the end of Week 3. A critical finding or scope change moves launch; the audit is not compressed to preserve the date.
+
+## Precise audit scope for quotation
+
+### In scope
+
+The quote should cover one Solidity contract, expected at roughly 250–400 non-comment source lines, plus directly used local libraries (if any):
+
+1. `CollectionMarketplace.sol` at a named frozen Git commit.
+2. Solidity compiler version, optimizer settings, deployment/constructor script, and dependency lockfile.
+3. All seven state-changing entry points listed above, receive/fallback rejection behavior, events, storage layout, and constructor validation.
+4. Integration assumptions for the exact Ethereum mainnet ERC-721 collection and canonical WETH9 addresses.
+5. Unit, fuzz, invariant, and mainnet-fork tests as evidence; the auditor is asked to identify missing cases, not to certify frontend behavior.
+6. Deployment bytecode reproducibility and verification of constructor arguments and immutables.
+7. One remediation review of changes made solely in response to findings.
+
+Provide the auditor the collection ABI/source or verified address, WETH address, architecture and transition table, trust assumptions, invariants, known limitations, test commands, coverage report, static-analysis output, and intended deployment configuration before the quote is finalized.
+
+### Security properties to assess
+
+- Only the current owner can list/cancel their listing or accept an offer; an offer can only be cancelled by its maker.
+- A fill cannot succeed after cancellation, expiry, prior fill, ownership change, or lost NFT approval.
+- Each successful settlement transfers exactly one intended collection token to the intended buyer and charges exactly the recorded price once.
+- Artist and seller accounting always sum to the gross price; artist accounting is exactly floor(2.5%), with no retained dust or hidden protocol fee.
+- Reentrancy, malicious ERC-721 receiver callbacks, reverting ETH recipients, and unexpected token behavior cannot double-fill, steal funds, corrupt order state, or permanently block legitimate withdrawals.
+- WETH offers cannot spend more than authorized; insufficient/revoked balance or allowance reverts the whole acceptance, including NFT transfer.
+- Failed ETH sends create the correct credit exactly once; only the credited address can withdraw it; failed withdrawals preserve credit.
+- Front-running and transaction-ordering outcomes are understood: listed prices are public; seller cancellation can race a buy; offer cancellation/allowance changes can race acceptance. No transaction promises priority beyond Ethereum ordering.
+- There is no admin path, upgrade path, arbitrary external call, cross-collection fill, signature replay surface, accidental NFT custody path, or unbounded loop/keeper dependency.
+- Gas consumption cannot make any user path practically uncallable; mappings do not require onchain enumeration.
+
+### Explicitly out of scope
+
+- The already-deployed NFT contract, its mint, metadata, provenance, and any royalty behavior outside this marketplace.
+- Frontend, wallet software, indexer/database, RPC providers, hosting, DNS, analytics, notifications, fiat conversion, and Discord migration, except where they reveal a mismatch with the documented contract API.
+- Third-party OpenZeppelin and canonical WETH source internals; their correct configuration and interaction remain in scope.
+- Other marketplaces, aggregator/router integration, signed gasless orders, auctions, collection bids, trait bids, bundles, partial fills, private sales, ERC-20 currencies other than WETH, fee changes, upgradeability, pausing, governance, allowlists, and cross-chain deployment.
+- Formal verification, economic/market manipulation analysis, compromised wallets/keys, artist multisig operations, and production infrastructure penetration testing.
+- Enforcing the 2.5% fee on transfers or sales that do not use this marketplace.
+
+Any addition or semantic change after scope freeze—including a proxy, signature orders, new currency, configurable fee/recipient, escrow, bulk operation, rescue/admin function, or alternate NFT standard—requires auditor approval and a revised quote. The launch artifact must match the auditor-reviewed commit apart from documented constructor arguments.
+
+## Deployment and production handoff
+
+Target Ethereum mainnet because the collection and its liquidity already live there; moving marketplace settlement to an L2 would not move mainnet NFTs without a bridge and would fragment the product. Exact gas costs must be measured against the final bytecode and current mainnet conditions before launch, then displayed as wallet estimates rather than promised figures.
+
+The repository README must contain executable test, fork-test, deploy, and source-verification commands; pinned toolchain versions; required RPC/explorer/deployer environment variable names; expected constructor arguments; deployed address; verified-source link; and rollback posture (disable the UI/indexer submission path, since the immutable contract cannot be paused). Deployment should use a dedicated hardware-backed deployer. Because the contract has no owner, there is no production ownership transfer; the immutable `artistRecipient` should be the artist's intended Safe multisig and must be independently checked before broadcast.
+
+Launch only after the audit remediation review closes all accepted critical/high findings, the exact bytecode verifies, and a fresh reviewer completes the low-value end-to-end checks. Keep the old Discord process available during a short staged rollout, but clearly warn users that only onchain state—not Discord messages or the indexer—is authoritative.

2026-08-24T20:56:17.582603Z ERROR codex_models_manager::manager: failed to renew cache TTL: missing field `base_instructions` at line 97 column 5
codex
Created [plan.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-24T205503Z-codex-with-skill-1/workspace/plan.md).

It covers the four-week MVP schedule, non-custodial architecture, ETH purchases and WETH offers, 2.5% artist payouts, contract surface, state-transition responsibilities, security properties, exact audit boundaries, exclusions, and production handoff.
diff --git a/artifacts/ship-quiz-001/2026-08-24T205503Z-codex-with-skill-1/workspace/plan.md b/artifacts/ship-quiz-001/2026-08-24T205503Z-codex-with-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..e124f085be7e877aa613599f83612309f5ae864e
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-08-24T205503Z-codex-with-skill-1/workspace/plan.md
@@ -0,0 +1,128 @@
+# Four-week NFT marketplace MVP plan
+
+## MVP decision
+
+Ship one non-upgradeable `CollectionMarketplace` contract on Ethereum mainnet for the existing ERC-721 collection. The site and indexer are offchain; ownership and settlement remain onchain.
+
+The marketplace is non-custodial while an item is listed. A listing records the seller's intent, but the NFT stays in the seller's wallet until `buy` transfers it atomically. A seller must approve the marketplace as an operator. If ownership or approval changes, a purchase reverts and the indexer marks the listing stale.
+
+Use native ETH for immediate purchases and WETH for offers. A later contract call cannot pull native ETH from an offer maker, so an offer maker must hold WETH and approve the marketplace. WETH is not escrowed: at acceptance, the contract atomically pulls it from the buyer and pays the seller and artist. An offer can therefore become unfillable if the buyer withdraws WETH or revokes approval; the UI must show this and acceptance must fail without moving the NFT.
+
+The artist receives exactly 250 basis points of the gross sale price and the seller receives the other 9,750 basis points. The artist payout address is immutable. This guarantees the cut for sales settled through this contract, not for direct transfers or other marketplaces. If collection-wide royalty enforcement is a requirement, that is a separate token-contract and ecosystem decision and is outside this MVP.
+
+### Onchain boundary
+
+One custom contract stores active listings and offers and performs atomic ERC-721/payment settlement. It emits events for every create, cancel, fill, and invalidation-relevant action. It has no proxy, owner, pause switch, arbitrary-call router, custody function, protocol fee, or admin price control.
+
+Offchain services provide collection metadata, image hosting, search/filter/sort, activity history, wallet notifications, fiat estimates, and an indexed view of active/stale orders. The chain remains the source of truth at execution time. No rankings or derived marketplace state are stored onchain.
+
+### Proposed contract surface
+
+Constructor parameters are `collection`, canonical mainnet `WETH`, and `artistRecipient`; each is immutable. The contract accepts only tokens from `collection`.
+
+- `list(tokenId, price)` — current owner creates or replaces an active ETH listing; `price > 0`.
+- `cancelListing(tokenId)` — recorded seller cancels their listing.
+- `buy(tokenId)` payable — checks the recorded seller still owns the token, marketplace approval remains valid, and `msg.value == price`; deletes listing before external calls, transfers the NFT to the buyer, then pays 2.5% to the artist and 97.5% to the seller.
+- `makeOffer(tokenId, amount, expiry)` — records or replaces the caller's WETH offer; `amount > 0` and `expiry > block.timestamp`. No WETH is moved here.
+- `cancelOffer(tokenId)` — maker cancels their offer.
+- `acceptOffer(tokenId, maker)` — current owner accepts an unexpired offer; deletes it before external calls, pulls the exact WETH amount from the maker, transfers the NFT, and distributes WETH 2.5%/97.5%.
+
+Use an offer key of `(tokenId, maker)`, so competing offers can coexist. Bind every order to this contract, chain, and immutable collection by storage rather than accepting arbitrary targets. Define rounding as `artistAmount = price * 250 / 10_000` (round down) and `sellerAmount = price - artistAmount`, so no dust remains.
+
+Settlement uses OpenZeppelin `ReentrancyGuard`, `SafeERC20`, and ERC-721 interfaces. State is cleared before interactions. ETH payout behavior must be chosen before implementation and frozen for audit: the recommended MVP uses a pull-payment credit ledger when an ETH send fails, with `withdrawCredits()` callable only by the credited recipient. This prevents a reverting seller or artist wallet from blocking delivery while ensuring the full amount remains owed. WETH settlement uses `safeTransferFrom` directly and reverts atomically on failure. The contract rejects accidental ETH except through `buy` and has no general token rescue function.
+
+### State transitions and liveness
+
+| Transition | Caller | Why they pay gas | If nobody calls |
+| --- | --- | --- | --- |
+| `list` | NFT owner | Offers the NFT for sale | No listing exists |
+| `cancelListing` | recorded seller | Removes unwanted sale authorization | Listing stays visible but can only fill if ownership/approval and price checks pass |
+| `buy` | buyer | Receives the NFT | Listing remains open |
+| `makeOffer` | buyer | Creates a purchasable bid | No offer exists |
+| `cancelOffer` | offer maker | Removes their bid | Offer remains until expiry/acceptance, but cannot pull funds without balance and allowance |
+| `acceptOffer` | current NFT owner | Receives sale proceeds | NFT and buyer's WETH remain in their wallets |
+| `withdrawCredits` | credited seller or artist | Receives an ETH payout that previously failed | Credit remains claimable indefinitely |
+
+Expiry does not require a keeper: expired offers simply fail validation and are hidden by the indexer. Stale listings similarly need no cleanup transaction.
+
+## Four-week build plan
+
+### Week 1 — specification and contract skeleton
+
+- Confirm the deployed collection address, standard ERC-721 behavior, artist multisig/payout address, canonical WETH address, and exact event/schema requirements.
+- Freeze the invariants, rounding, ETH fallback-credit behavior, approval UX, offer expiry limits, and explicit exclusions below.
+- Implement the single contract and events using pinned OpenZeppelin dependencies.
+- Add unit tests for authorization, replacement/cancellation, expiry, exact payment, fee math, stale ownership/approval, replay/double-fill, and revert atomicity.
+- Deliver a contract API/event document and threat model for auditor review. This is the scope-freeze milestone.
+
+### Week 2 — integration and adversarial tests
+
+- Complete fuzz and invariant tests: conservation of value, no double fills, only current owner can sell, fee is always 250 bps, deleted state cannot replay, and no successful path strands an NFT in the marketplace.
+- Add a mainnet-fork suite against the exact collection and canonical WETH contracts, including approvals, safe transfers, WETH allowance/balance failure, contract sellers/buyers, and payout recipients that reject ETH.
+- Build the event indexer and API for active listings/offers and stale-order detection.
+- Implement wallet flows for list, cancel, buy, wrap/approve WETH, offer, cancel offer, accept, and withdraw credit.
+
+### Week 3 — complete vertical slice and audit candidate
+
+- Integrate browse/detail/activity screens, transaction simulation, chain/account checks, clear ETH-versus-WETH copy, expiry display, and actionable failure messages.
+- Exercise the full path on a mainnet fork and a public Ethereum test environment using representative collection tokens or a faithful test collection.
+- Run static analysis, coverage, lint/type checks, dependency review, and an independent internal security review; resolve all findings.
+- Freeze commit, compiler/settings, dependency lockfile, deployment script, test corpus, NatSpec, architecture diagram, and audit package. No feature work enters the audit commit.
+
+### Week 4 — audit, remediation, and launch readiness
+
+- Auditor reviews the frozen commit; team answers questions without silently changing scope.
+- Fix findings on a dedicated branch, add a regression test for each finding, and provide a compact diff for auditor retest/sign-off.
+- Deploy from the signed-off commit to Ethereum mainnet, verify source, and configure the production indexer/UI from emitted deployment data.
+- Run a low-value end-to-end listing, purchase, offer, acceptance, cancellation, fee, and failed-ETH-credit withdrawal check before opening the UI.
+- Publish contract address, verified source, known limitations, and incident contacts; monitor events, RPC/indexing lag, revert rates, and failed payout credits.
+
+The four-week target assumes an auditor reserves Week 4 in advance and receives the frozen package at the end of Week 3. A critical finding or scope change moves launch; the audit is not compressed to preserve the date.
+
+## Precise audit scope for quotation
+
+### In scope
+
+The quote should cover one Solidity contract, expected at roughly 250–400 non-comment source lines, plus directly used local libraries (if any):
+
+1. `CollectionMarketplace.sol` at a named frozen Git commit.
+2. Solidity compiler version, optimizer settings, deployment/constructor script, and dependency lockfile.
+3. All seven state-changing entry points listed above, receive/fallback rejection behavior, events, storage layout, and constructor validation.
+4. Integration assumptions for the exact Ethereum mainnet ERC-721 collection and canonical WETH9 addresses.
+5. Unit, fuzz, invariant, and mainnet-fork tests as evidence; the auditor is asked to identify missing cases, not to certify frontend behavior.
+6. Deployment bytecode reproducibility and verification of constructor arguments and immutables.
+7. One remediation review of changes made solely in response to findings.
+
+Provide the auditor the collection ABI/source or verified address, WETH address, architecture and transition table, trust assumptions, invariants, known limitations, test commands, coverage report, static-analysis output, and intended deployment configuration before the quote is finalized.
+
+### Security properties to assess
+
+- Only the current owner can list/cancel their listing or accept an offer; an offer can only be cancelled by its maker.
+- A fill cannot succeed after cancellation, expiry, prior fill, ownership change, or lost NFT approval.
+- Each successful settlement transfers exactly one intended collection token to the intended buyer and charges exactly the recorded price once.
+- Artist and seller accounting always sum to the gross price; artist accounting is exactly floor(2.5%), with no retained dust or hidden protocol fee.
+- Reentrancy, malicious ERC-721 receiver callbacks, reverting ETH recipients, and unexpected token behavior cannot double-fill, steal funds, corrupt order state, or permanently block legitimate withdrawals.
+- WETH offers cannot spend more than authorized; insufficient/revoked balance or allowance reverts the whole acceptance, including NFT transfer.
+- Failed ETH sends create the correct credit exactly once; only the credited address can withdraw it; failed withdrawals preserve credit.
+- Front-running and transaction-ordering outcomes are understood: listed prices are public; seller cancellation can race a buy; offer cancellation/allowance changes can race acceptance. No transaction promises priority beyond Ethereum ordering.
+- There is no admin path, upgrade path, arbitrary external call, cross-collection fill, signature replay surface, accidental NFT custody path, or unbounded loop/keeper dependency.
+- Gas consumption cannot make any user path practically uncallable; mappings do not require onchain enumeration.
+
+### Explicitly out of scope
+
+- The already-deployed NFT contract, its mint, metadata, provenance, and any royalty behavior outside this marketplace.
+- Frontend, wallet software, indexer/database, RPC providers, hosting, DNS, analytics, notifications, fiat conversion, and Discord migration, except where they reveal a mismatch with the documented contract API.
+- Third-party OpenZeppelin and canonical WETH source internals; their correct configuration and interaction remain in scope.
+- Other marketplaces, aggregator/router integration, signed gasless orders, auctions, collection bids, trait bids, bundles, partial fills, private sales, ERC-20 currencies other than WETH, fee changes, upgradeability, pausing, governance, allowlists, and cross-chain deployment.
+- Formal verification, economic/market manipulation analysis, compromised wallets/keys, artist multisig operations, and production infrastructure penetration testing.
+- Enforcing the 2.5% fee on transfers or sales that do not use this marketplace.
+
+Any addition or semantic change after scope freeze—including a proxy, signature orders, new currency, configurable fee/recipient, escrow, bulk operation, rescue/admin function, or alternate NFT standard—requires auditor approval and a revised quote. The launch artifact must match the auditor-reviewed commit apart from documented constructor arguments.
+
+## Deployment and production handoff
+
+Target Ethereum mainnet because the collection and its liquidity already live there; moving marketplace settlement to an L2 would not move mainnet NFTs without a bridge and would fragment the product. Exact gas costs must be measured against the final bytecode and current mainnet conditions before launch, then displayed as wallet estimates rather than promised figures.
+
+The repository README must contain executable test, fork-test, deploy, and source-verification commands; pinned toolchain versions; required RPC/explorer/deployer environment variable names; expected constructor arguments; deployed address; verified-source link; and rollback posture (disable the UI/indexer submission path, since the immutable contract cannot be paused). Deployment should use a dedicated hardware-backed deployer. Because the contract has no owner, there is no production ownership transfer; the immutable `artistRecipient` should be the artist's intended Safe multisig and must be independently checked before broadcast.
+
+Launch only after the audit remediation review closes all accepted critical/high findings, the exact bytecode verifies, and a fresh reviewer completes the low-value end-to-end checks. Keep the old Discord process available during a short staged rollout, but clearly warn users that only onchain state—not Discord messages or the indexer—is authoritative.

tokens used
19,058
Created [plan.md](/ssd/workspace/buidlguidl/ethskills-evals-test/artifacts/ship-quiz-001/2026-08-24T205503Z-codex-with-skill-1/workspace/plan.md).

It covers the four-week MVP schedule, non-custodial architecture, ETH purchases and WETH offers, 2.5% artist payouts, contract surface, state-transition responsibilities, security properties, exact audit boundaries, exclusions, and production handoff.
