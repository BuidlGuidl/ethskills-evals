Reading additional input from stdin...
OpenAI Codex v0.146.0
--------
workdir: /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T194520Z-codex-no-skill-2/workspace
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: high
reasoning summaries: none
session id: 019fb48f-5651-77b2-a9c7-e6742bfe019b
--------
user
We minted a 5,000-piece NFT collection on Ethereum mainnet in 2024, and
holders keep trading it by hand in our Discord — someone posts "selling #3312
for 0.4 ETH", they DM, they send. We want listing and buying to happen on our
own site instead: a holder lists a piece at a price, anyone browsing can buy
it, and the artist takes 2.5% of every resale. Sellers can cancel a listing,
and nothing sits in escrow while it's listed — owners keep the piece until it
actually sells.

We have one Solidity dev, four weeks, and budget for exactly one audit pass at
the end. I need to know what we're sending to the auditor and whether four
weeks is realistic.

Write your answer to plan.md in this directory, covering the build plan and
what goes into the audit scope.
codex
I’ll draft a constrained four-week marketplace plan, with a deliberately narrow audit scope and explicit assumptions.
exec
/bin/bash -lc "pwd && rg --files -g '"'!*node_modules*'"' -g '"'!*.lock'"' | sed -n '1,160p'" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T194520Z-codex-no-skill-2/workspace
 succeeded in 0ms:
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T194520Z-codex-no-skill-2/workspace
TASK.md

apply patch
patch: completed
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T194520Z-codex-no-skill-2/workspace/plan.md
diff --git a/artifacts/ship-quiz-001/2026-07-30T194520Z-codex-no-skill-2/workspace/plan.md b/artifacts/ship-quiz-001/2026-07-30T194520Z-codex-no-skill-2/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..7eee0d8016f297ff5142e4bf2887fb1c8994c30e
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-07-30T194520Z-codex-no-skill-2/workspace/plan.md
@@ -0,0 +1,143 @@
+# Non-custodial resale marketplace plan
+
+## Recommendation
+
+Ship a deliberately small, fixed-price ETH marketplace: one collection, one
+artist payout address, 2.5% fee, no escrow, no offers, auctions, bundles,
+credit-card flow, currencies, or proxy upgrades. Listings must be canonical
+on-chain; Discord/site databases may index them but must not decide whether a
+sale is valid.
+
+This is feasible in four weeks **only if** the NFT is a conventional,
+verified ERC-721, the audit slot is booked now, and "one audit pass" means a
+short review plus remediation/retest. If the auditor begins only after week 4,
+four weeks is not a safe launch schedule. Leave time after the audit to fix
+findings; do not launch with unresolved high/medium findings.
+
+## Product and contract design
+
+Deploy a new, immutable `CollectionMarketplace` on mainnet. It references the
+existing NFT contract, an immutable artist payout address, and `ROYALTY_BPS =
+250`.
+
+Each listing records `tokenId`, seller, price in wei, and optional expiry. To
+list, the caller must currently own the token and have approved the marketplace
+for that token (or all their tokens). The NFT remains in the owner's wallet.
+
+`buy(tokenId)` is payable and, in one transaction:
+
+1. Loads an active, unexpired listing and requires `msg.value == price`.
+2. Re-checks that the recorded seller still owns the NFT and that the
+   marketplace remains approved.
+3. Deletes the listing before external calls.
+4. Credits `price * 250 / 10_000` to the artist and the remainder to the
+   seller, then transfers the NFT directly from seller to buyer using
+   `safeTransferFrom`.
+
+Use pull payments: `withdraw()` transfers a caller's credited ETH. This avoids
+a seller or artist fallback function making purchases fail. Protect purchase
+and withdrawal paths with a reentrancy guard. Exact-payment-only avoids refund
+logic. Emit `Listed`, `Cancelled`, `Sale`, and `Withdrawal` events; the site
+indexes these logs and displays on-chain state as authoritative.
+
+The seller can call `cancel(tokenId)` at any time. Transfers, approval
+revocations, and expiry make a listing unbuyable; the UI should label such
+listings inactive and offer cleanup. Optionally expose permissionless cleanup
+of provably stale/expired listings, with no payment or state beyond deletion.
+
+Do not add an admin withdrawal, fee switch, arbitrary NFT address, upgrade
+proxy, or relayer key. If artist-address changes are truly required, make that
+a separately governed, audited version; v1 should be immutable. This makes the
+royalty enforcement simple and credible, although it only applies to sales
+through this marketplace (not private transfers or other marketplaces).
+
+## Four-week delivery plan
+
+### Week 1 — validate and specify
+
+- Verify mainnet NFT source/ABI, ERC-721 behavior, token IDs, transfer hooks,
+  pausability, approval semantics, and whether it is upgradeable or has unusual
+  restrictions. Obtain artist payout address and confirm the 2.5% calculation
+  and rounding policy (round royalty down; seller receives the remainder).
+- Write a one-page protocol specification: state machine, authorization,
+  payment ordering, expiry policy, and explicit v1 exclusions.
+- Set up Foundry, pinned Solidity/OpenZeppelin versions, CI, formatting,
+  Slither, and a testnet fork of the real collection.
+- Book the audit now and send the intended scope and code-freeze date.
+
+### Week 2 — build and test contract
+
+- Implement the single marketplace contract, minimal interfaces, deployment
+  script, event indexer, and basic browse/list/cancel/buy/withdraw UI.
+- Write unit and integration tests against a mainnet fork. Cover approvals,
+  ownership changes, cancellation, expiry, exact value, royalty math, and
+  event contents.
+- Add invariant/fuzz tests: no NFT is held by marketplace; sale credits always
+  sum to price; only entitled accounts withdraw; a listing cannot be bought
+  twice; and invalidated listings never transfer a token or pay funds.
+
+### Week 3 — harden and freeze
+
+- Exercise adversarial ERC-721 recipients and ETH recipients, reentrancy,
+  forced ETH, zero/large prices, transfer between listing and buy, approval
+  revocation, duplicate listings, and stale UI/indexer data.
+- Deploy to Sepolia or a mainnet fork rehearsal; have real holders run the
+  approval, listing, cancellation, buy, and withdrawal journeys.
+- Complete deployment/runbook, monitoring, support copy, and a multisig
+  verification of the immutable constructor values. Freeze Solidity, compiler,
+  dependencies, and deployment scripts at the agreed audit commit.
+
+### Week 4 — audit, remediation, launch decision
+
+- Auditor reviews the frozen commit; team supplies evidence promptly and fixes
+  findings only through reviewed, tested commits.
+- Auditor retests fixes within the contracted pass. Re-run the full suite,
+  static analysis, and deployment rehearsal on the final commit.
+- Deploy only if audit report is accepted, critical/high issues are resolved,
+  test coverage is green, contracts are source-verified, and constructor
+  addresses/network/bytecode match the approved release artifact. Otherwise
+  delay mainnet; the Discord process remains the fallback.
+
+## Audit package and scope
+
+Send the auditor a tagged, reproducible release repository, not just a Solidity
+file:
+
+- `CollectionMarketplace.sol`, all local interfaces/libraries, exact
+  OpenZeppelin commit/package lock, compiler version/settings, and optimization
+  settings.
+- The existing NFT's verified mainnet source, address, ABI, ownership/admin
+  model, and a short note describing every non-standard transfer/approval
+  behavior. This dependency must be assessed because sale safety depends on it.
+- Protocol specification, state-transition diagram, invariants, trust model,
+  known limitations, fee/rounding examples, and a list of intended immutable
+  constructor values.
+- Full test suite (unit, fork, fuzz/invariant), test commands and results,
+  Slither/static-analysis output, coverage report, and deployment/rehearsal
+  scripts.
+- A deployment and operations runbook: deployer/multisig control, address
+  verification procedure, source verification, event/indexer assumptions,
+  incident response, and launch checklist.
+
+The audit scope is the marketplace's listing lifecycle, ownership/approval
+checks, direct NFT transfer, ETH accounting and pull withdrawals, royalty
+calculation, reentrancy/external-call ordering, denial-of-service behavior,
+event correctness, integer edge cases, and deployment configuration. Include
+the NFT integration and the exact deployment scripts in scope.
+
+The auditor need not audit unrelated website styling, Discord workflow, or a
+generic indexer implementation. However, test the UI separately for transaction
+construction, chain/address selection, stale-listing messaging, and wallet
+network handling; a correct contract can still be misused by an incorrect UI.
+
+## Acceptance gates
+
+- Contract never receives custody of an NFT during listing or after sale.
+- A valid sale delivers token to buyer and credits exactly 2.5% / 97.5% of the
+  paid ETH to artist / seller; no third party can withdraw either credit.
+- A seller can cancel; a listed token transferred away or unapproved cannot be
+  sold from the stale listing.
+- Mainnet-fork tests and fuzz/invariants pass; final audited commit, bytecode,
+  and constructor parameters are recorded before deployment.
+- Audit findings are triaged publicly to the team and all critical/high findings
+  are fixed and retested before launch.

diff --git a/artifacts/ship-quiz-001/2026-07-30T194520Z-codex-no-skill-2/workspace/plan.md b/artifacts/ship-quiz-001/2026-07-30T194520Z-codex-no-skill-2/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..7eee0d8016f297ff5142e4bf2887fb1c8994c30e
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-07-30T194520Z-codex-no-skill-2/workspace/plan.md
@@ -0,0 +1,143 @@
+# Non-custodial resale marketplace plan
+
+## Recommendation
+
+Ship a deliberately small, fixed-price ETH marketplace: one collection, one
+artist payout address, 2.5% fee, no escrow, no offers, auctions, bundles,
+credit-card flow, currencies, or proxy upgrades. Listings must be canonical
+on-chain; Discord/site databases may index them but must not decide whether a
+sale is valid.
+
+This is feasible in four weeks **only if** the NFT is a conventional,
+verified ERC-721, the audit slot is booked now, and "one audit pass" means a
+short review plus remediation/retest. If the auditor begins only after week 4,
+four weeks is not a safe launch schedule. Leave time after the audit to fix
+findings; do not launch with unresolved high/medium findings.
+
+## Product and contract design
+
+Deploy a new, immutable `CollectionMarketplace` on mainnet. It references the
+existing NFT contract, an immutable artist payout address, and `ROYALTY_BPS =
+250`.
+
+Each listing records `tokenId`, seller, price in wei, and optional expiry. To
+list, the caller must currently own the token and have approved the marketplace
+for that token (or all their tokens). The NFT remains in the owner's wallet.
+
+`buy(tokenId)` is payable and, in one transaction:
+
+1. Loads an active, unexpired listing and requires `msg.value == price`.
+2. Re-checks that the recorded seller still owns the NFT and that the
+   marketplace remains approved.
+3. Deletes the listing before external calls.
+4. Credits `price * 250 / 10_000` to the artist and the remainder to the
+   seller, then transfers the NFT directly from seller to buyer using
+   `safeTransferFrom`.
+
+Use pull payments: `withdraw()` transfers a caller's credited ETH. This avoids
+a seller or artist fallback function making purchases fail. Protect purchase
+and withdrawal paths with a reentrancy guard. Exact-payment-only avoids refund
+logic. Emit `Listed`, `Cancelled`, `Sale`, and `Withdrawal` events; the site
+indexes these logs and displays on-chain state as authoritative.
+
+The seller can call `cancel(tokenId)` at any time. Transfers, approval
+revocations, and expiry make a listing unbuyable; the UI should label such
+listings inactive and offer cleanup. Optionally expose permissionless cleanup
+of provably stale/expired listings, with no payment or state beyond deletion.
+
+Do not add an admin withdrawal, fee switch, arbitrary NFT address, upgrade
+proxy, or relayer key. If artist-address changes are truly required, make that
+a separately governed, audited version; v1 should be immutable. This makes the
+royalty enforcement simple and credible, although it only applies to sales
+through this marketplace (not private transfers or other marketplaces).
+
+## Four-week delivery plan
+
+### Week 1 — validate and specify
+
+- Verify mainnet NFT source/ABI, ERC-721 behavior, token IDs, transfer hooks,
+  pausability, approval semantics, and whether it is upgradeable or has unusual
+  restrictions. Obtain artist payout address and confirm the 2.5% calculation
+  and rounding policy (round royalty down; seller receives the remainder).
+- Write a one-page protocol specification: state machine, authorization,
+  payment ordering, expiry policy, and explicit v1 exclusions.
+- Set up Foundry, pinned Solidity/OpenZeppelin versions, CI, formatting,
+  Slither, and a testnet fork of the real collection.
+- Book the audit now and send the intended scope and code-freeze date.
+
+### Week 2 — build and test contract
+
+- Implement the single marketplace contract, minimal interfaces, deployment
+  script, event indexer, and basic browse/list/cancel/buy/withdraw UI.
+- Write unit and integration tests against a mainnet fork. Cover approvals,
+  ownership changes, cancellation, expiry, exact value, royalty math, and
+  event contents.
+- Add invariant/fuzz tests: no NFT is held by marketplace; sale credits always
+  sum to price; only entitled accounts withdraw; a listing cannot be bought
+  twice; and invalidated listings never transfer a token or pay funds.
+
+### Week 3 — harden and freeze
+
+- Exercise adversarial ERC-721 recipients and ETH recipients, reentrancy,
+  forced ETH, zero/large prices, transfer between listing and buy, approval
+  revocation, duplicate listings, and stale UI/indexer data.
+- Deploy to Sepolia or a mainnet fork rehearsal; have real holders run the
+  approval, listing, cancellation, buy, and withdrawal journeys.
+- Complete deployment/runbook, monitoring, support copy, and a multisig
+  verification of the immutable constructor values. Freeze Solidity, compiler,
+  dependencies, and deployment scripts at the agreed audit commit.
+
+### Week 4 — audit, remediation, launch decision
+
+- Auditor reviews the frozen commit; team supplies evidence promptly and fixes
+  findings only through reviewed, tested commits.
+- Auditor retests fixes within the contracted pass. Re-run the full suite,
+  static analysis, and deployment rehearsal on the final commit.
+- Deploy only if audit report is accepted, critical/high issues are resolved,
+  test coverage is green, contracts are source-verified, and constructor
+  addresses/network/bytecode match the approved release artifact. Otherwise
+  delay mainnet; the Discord process remains the fallback.
+
+## Audit package and scope
+
+Send the auditor a tagged, reproducible release repository, not just a Solidity
+file:
+
+- `CollectionMarketplace.sol`, all local interfaces/libraries, exact
+  OpenZeppelin commit/package lock, compiler version/settings, and optimization
+  settings.
+- The existing NFT's verified mainnet source, address, ABI, ownership/admin
+  model, and a short note describing every non-standard transfer/approval
+  behavior. This dependency must be assessed because sale safety depends on it.
+- Protocol specification, state-transition diagram, invariants, trust model,
+  known limitations, fee/rounding examples, and a list of intended immutable
+  constructor values.
+- Full test suite (unit, fork, fuzz/invariant), test commands and results,
+  Slither/static-analysis output, coverage report, and deployment/rehearsal
+  scripts.
+- A deployment and operations runbook: deployer/multisig control, address
+  verification procedure, source verification, event/indexer assumptions,
+  incident response, and launch checklist.
+
+The audit scope is the marketplace's listing lifecycle, ownership/approval
+checks, direct NFT transfer, ETH accounting and pull withdrawals, royalty
+calculation, reentrancy/external-call ordering, denial-of-service behavior,
+event correctness, integer edge cases, and deployment configuration. Include
+the NFT integration and the exact deployment scripts in scope.
+
+The auditor need not audit unrelated website styling, Discord workflow, or a
+generic indexer implementation. However, test the UI separately for transaction
+construction, chain/address selection, stale-listing messaging, and wallet
+network handling; a correct contract can still be misused by an incorrect UI.
+
+## Acceptance gates
+
+- Contract never receives custody of an NFT during listing or after sale.
+- A valid sale delivers token to buyer and credits exactly 2.5% / 97.5% of the
+  paid ETH to artist / seller; no third party can withdraw either credit.
+- A seller can cancel; a listed token transferred away or unapproved cannot be
+  sold from the stale listing.
+- Mainnet-fork tests and fuzz/invariants pass; final audited commit, bytecode,
+  and constructor parameters are recorded before deployment.
+- Audit findings are triaged publicly to the team and all critical/high findings
+  are fixed and retested before launch.

exec
/bin/bash -lc "sed -n '1,260p' plan.md" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T194520Z-codex-no-skill-2/workspace
 succeeded in 0ms:
# Non-custodial resale marketplace plan

## Recommendation

Ship a deliberately small, fixed-price ETH marketplace: one collection, one
artist payout address, 2.5% fee, no escrow, no offers, auctions, bundles,
credit-card flow, currencies, or proxy upgrades. Listings must be canonical
on-chain; Discord/site databases may index them but must not decide whether a
sale is valid.

This is feasible in four weeks **only if** the NFT is a conventional,
verified ERC-721, the audit slot is booked now, and "one audit pass" means a
short review plus remediation/retest. If the auditor begins only after week 4,
four weeks is not a safe launch schedule. Leave time after the audit to fix
findings; do not launch with unresolved high/medium findings.

## Product and contract design

Deploy a new, immutable `CollectionMarketplace` on mainnet. It references the
existing NFT contract, an immutable artist payout address, and `ROYALTY_BPS =
250`.

Each listing records `tokenId`, seller, price in wei, and optional expiry. To
list, the caller must currently own the token and have approved the marketplace
for that token (or all their tokens). The NFT remains in the owner's wallet.

`buy(tokenId)` is payable and, in one transaction:

1. Loads an active, unexpired listing and requires `msg.value == price`.
2. Re-checks that the recorded seller still owns the NFT and that the
   marketplace remains approved.
3. Deletes the listing before external calls.
4. Credits `price * 250 / 10_000` to the artist and the remainder to the
   seller, then transfers the NFT directly from seller to buyer using
   `safeTransferFrom`.

Use pull payments: `withdraw()` transfers a caller's credited ETH. This avoids
a seller or artist fallback function making purchases fail. Protect purchase
and withdrawal paths with a reentrancy guard. Exact-payment-only avoids refund
logic. Emit `Listed`, `Cancelled`, `Sale`, and `Withdrawal` events; the site
indexes these logs and displays on-chain state as authoritative.

The seller can call `cancel(tokenId)` at any time. Transfers, approval
revocations, and expiry make a listing unbuyable; the UI should label such
listings inactive and offer cleanup. Optionally expose permissionless cleanup
of provably stale/expired listings, with no payment or state beyond deletion.

Do not add an admin withdrawal, fee switch, arbitrary NFT address, upgrade
proxy, or relayer key. If artist-address changes are truly required, make that
a separately governed, audited version; v1 should be immutable. This makes the
royalty enforcement simple and credible, although it only applies to sales
through this marketplace (not private transfers or other marketplaces).

## Four-week delivery plan

### Week 1 — validate and specify

- Verify mainnet NFT source/ABI, ERC-721 behavior, token IDs, transfer hooks,
  pausability, approval semantics, and whether it is upgradeable or has unusual
  restrictions. Obtain artist payout address and confirm the 2.5% calculation
  and rounding policy (round royalty down; seller receives the remainder).
- Write a one-page protocol specification: state machine, authorization,
  payment ordering, expiry policy, and explicit v1 exclusions.
- Set up Foundry, pinned Solidity/OpenZeppelin versions, CI, formatting,
  Slither, and a testnet fork of the real collection.
- Book the audit now and send the intended scope and code-freeze date.

### Week 2 — build and test contract

- Implement the single marketplace contract, minimal interfaces, deployment
  script, event indexer, and basic browse/list/cancel/buy/withdraw UI.
- Write unit and integration tests against a mainnet fork. Cover approvals,
  ownership changes, cancellation, expiry, exact value, royalty math, and
  event contents.
- Add invariant/fuzz tests: no NFT is held by marketplace; sale credits always
  sum to price; only entitled accounts withdraw; a listing cannot be bought
  twice; and invalidated listings never transfer a token or pay funds.

### Week 3 — harden and freeze

- Exercise adversarial ERC-721 recipients and ETH recipients, reentrancy,
  forced ETH, zero/large prices, transfer between listing and buy, approval
  revocation, duplicate listings, and stale UI/indexer data.
- Deploy to Sepolia or a mainnet fork rehearsal; have real holders run the
  approval, listing, cancellation, buy, and withdrawal journeys.
- Complete deployment/runbook, monitoring, support copy, and a multisig
  verification of the immutable constructor values. Freeze Solidity, compiler,
  dependencies, and deployment scripts at the agreed audit commit.

### Week 4 — audit, remediation, launch decision

- Auditor reviews the frozen commit; team supplies evidence promptly and fixes
  findings only through reviewed, tested commits.
- Auditor retests fixes within the contracted pass. Re-run the full suite,
  static analysis, and deployment rehearsal on the final commit.
- Deploy only if audit report is accepted, critical/high issues are resolved,
  test coverage is green, contracts are source-verified, and constructor
  addresses/network/bytecode match the approved release artifact. Otherwise
  delay mainnet; the Discord process remains the fallback.

## Audit package and scope

Send the auditor a tagged, reproducible release repository, not just a Solidity
file:

- `CollectionMarketplace.sol`, all local interfaces/libraries, exact
  OpenZeppelin commit/package lock, compiler version/settings, and optimization
  settings.
- The existing NFT's verified mainnet source, address, ABI, ownership/admin
  model, and a short note describing every non-standard transfer/approval
  behavior. This dependency must be assessed because sale safety depends on it.
- Protocol specification, state-transition diagram, invariants, trust model,
  known limitations, fee/rounding examples, and a list of intended immutable
  constructor values.
- Full test suite (unit, fork, fuzz/invariant), test commands and results,
  Slither/static-analysis output, coverage report, and deployment/rehearsal
  scripts.
- A deployment and operations runbook: deployer/multisig control, address
  verification procedure, source verification, event/indexer assumptions,
  incident response, and launch checklist.

The audit scope is the marketplace's listing lifecycle, ownership/approval
checks, direct NFT transfer, ETH accounting and pull withdrawals, royalty
calculation, reentrancy/external-call ordering, denial-of-service behavior,
event correctness, integer edge cases, and deployment configuration. Include
the NFT integration and the exact deployment scripts in scope.

The auditor need not audit unrelated website styling, Discord workflow, or a
generic indexer implementation. However, test the UI separately for transaction
construction, chain/address selection, stale-listing messaging, and wallet
network handling; a correct contract can still be misused by an incorrect UI.

## Acceptance gates

- Contract never receives custody of an NFT during listing or after sale.
- A valid sale delivers token to buyer and credits exactly 2.5% / 97.5% of the
  paid ETH to artist / seller; no third party can withdraw either credit.
- A seller can cancel; a listed token transferred away or unapproved cannot be
  sold from the stale listing.
- Mainnet-fork tests and fuzz/invariants pass; final audited commit, bytecode,
  and constructor parameters are recorded before deployment.
- Audit findings are triaged publicly to the team and all critical/high findings
  are fixed and retested before launch.

diff --git a/artifacts/ship-quiz-001/2026-07-30T194520Z-codex-no-skill-2/workspace/plan.md b/artifacts/ship-quiz-001/2026-07-30T194520Z-codex-no-skill-2/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..7eee0d8016f297ff5142e4bf2887fb1c8994c30e
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-07-30T194520Z-codex-no-skill-2/workspace/plan.md
@@ -0,0 +1,143 @@
+# Non-custodial resale marketplace plan
+
+## Recommendation
+
+Ship a deliberately small, fixed-price ETH marketplace: one collection, one
+artist payout address, 2.5% fee, no escrow, no offers, auctions, bundles,
+credit-card flow, currencies, or proxy upgrades. Listings must be canonical
+on-chain; Discord/site databases may index them but must not decide whether a
+sale is valid.
+
+This is feasible in four weeks **only if** the NFT is a conventional,
+verified ERC-721, the audit slot is booked now, and "one audit pass" means a
+short review plus remediation/retest. If the auditor begins only after week 4,
+four weeks is not a safe launch schedule. Leave time after the audit to fix
+findings; do not launch with unresolved high/medium findings.
+
+## Product and contract design
+
+Deploy a new, immutable `CollectionMarketplace` on mainnet. It references the
+existing NFT contract, an immutable artist payout address, and `ROYALTY_BPS =
+250`.
+
+Each listing records `tokenId`, seller, price in wei, and optional expiry. To
+list, the caller must currently own the token and have approved the marketplace
+for that token (or all their tokens). The NFT remains in the owner's wallet.
+
+`buy(tokenId)` is payable and, in one transaction:
+
+1. Loads an active, unexpired listing and requires `msg.value == price`.
+2. Re-checks that the recorded seller still owns the NFT and that the
+   marketplace remains approved.
+3. Deletes the listing before external calls.
+4. Credits `price * 250 / 10_000` to the artist and the remainder to the
+   seller, then transfers the NFT directly from seller to buyer using
+   `safeTransferFrom`.
+
+Use pull payments: `withdraw()` transfers a caller's credited ETH. This avoids
+a seller or artist fallback function making purchases fail. Protect purchase
+and withdrawal paths with a reentrancy guard. Exact-payment-only avoids refund
+logic. Emit `Listed`, `Cancelled`, `Sale`, and `Withdrawal` events; the site
+indexes these logs and displays on-chain state as authoritative.
+
+The seller can call `cancel(tokenId)` at any time. Transfers, approval
+revocations, and expiry make a listing unbuyable; the UI should label such
+listings inactive and offer cleanup. Optionally expose permissionless cleanup
+of provably stale/expired listings, with no payment or state beyond deletion.
+
+Do not add an admin withdrawal, fee switch, arbitrary NFT address, upgrade
+proxy, or relayer key. If artist-address changes are truly required, make that
+a separately governed, audited version; v1 should be immutable. This makes the
+royalty enforcement simple and credible, although it only applies to sales
+through this marketplace (not private transfers or other marketplaces).
+
+## Four-week delivery plan
+
+### Week 1 — validate and specify
+
+- Verify mainnet NFT source/ABI, ERC-721 behavior, token IDs, transfer hooks,
+  pausability, approval semantics, and whether it is upgradeable or has unusual
+  restrictions. Obtain artist payout address and confirm the 2.5% calculation
+  and rounding policy (round royalty down; seller receives the remainder).
+- Write a one-page protocol specification: state machine, authorization,
+  payment ordering, expiry policy, and explicit v1 exclusions.
+- Set up Foundry, pinned Solidity/OpenZeppelin versions, CI, formatting,
+  Slither, and a testnet fork of the real collection.
+- Book the audit now and send the intended scope and code-freeze date.
+
+### Week 2 — build and test contract
+
+- Implement the single marketplace contract, minimal interfaces, deployment
+  script, event indexer, and basic browse/list/cancel/buy/withdraw UI.
+- Write unit and integration tests against a mainnet fork. Cover approvals,
+  ownership changes, cancellation, expiry, exact value, royalty math, and
+  event contents.
+- Add invariant/fuzz tests: no NFT is held by marketplace; sale credits always
+  sum to price; only entitled accounts withdraw; a listing cannot be bought
+  twice; and invalidated listings never transfer a token or pay funds.
+
+### Week 3 — harden and freeze
+
+- Exercise adversarial ERC-721 recipients and ETH recipients, reentrancy,
+  forced ETH, zero/large prices, transfer between listing and buy, approval
+  revocation, duplicate listings, and stale UI/indexer data.
+- Deploy to Sepolia or a mainnet fork rehearsal; have real holders run the
+  approval, listing, cancellation, buy, and withdrawal journeys.
+- Complete deployment/runbook, monitoring, support copy, and a multisig
+  verification of the immutable constructor values. Freeze Solidity, compiler,
+  dependencies, and deployment scripts at the agreed audit commit.
+
+### Week 4 — audit, remediation, launch decision
+
+- Auditor reviews the frozen commit; team supplies evidence promptly and fixes
+  findings only through reviewed, tested commits.
+- Auditor retests fixes within the contracted pass. Re-run the full suite,
+  static analysis, and deployment rehearsal on the final commit.
+- Deploy only if audit report is accepted, critical/high issues are resolved,
+  test coverage is green, contracts are source-verified, and constructor
+  addresses/network/bytecode match the approved release artifact. Otherwise
+  delay mainnet; the Discord process remains the fallback.
+
+## Audit package and scope
+
+Send the auditor a tagged, reproducible release repository, not just a Solidity
+file:
+
+- `CollectionMarketplace.sol`, all local interfaces/libraries, exact
+  OpenZeppelin commit/package lock, compiler version/settings, and optimization
+  settings.
+- The existing NFT's verified mainnet source, address, ABI, ownership/admin
+  model, and a short note describing every non-standard transfer/approval
+  behavior. This dependency must be assessed because sale safety depends on it.
+- Protocol specification, state-transition diagram, invariants, trust model,
+  known limitations, fee/rounding examples, and a list of intended immutable
+  constructor values.
+- Full test suite (unit, fork, fuzz/invariant), test commands and results,
+  Slither/static-analysis output, coverage report, and deployment/rehearsal
+  scripts.
+- A deployment and operations runbook: deployer/multisig control, address
+  verification procedure, source verification, event/indexer assumptions,
+  incident response, and launch checklist.
+
+The audit scope is the marketplace's listing lifecycle, ownership/approval
+checks, direct NFT transfer, ETH accounting and pull withdrawals, royalty
+calculation, reentrancy/external-call ordering, denial-of-service behavior,
+event correctness, integer edge cases, and deployment configuration. Include
+the NFT integration and the exact deployment scripts in scope.
+
+The auditor need not audit unrelated website styling, Discord workflow, or a
+generic indexer implementation. However, test the UI separately for transaction
+construction, chain/address selection, stale-listing messaging, and wallet
+network handling; a correct contract can still be misused by an incorrect UI.
+
+## Acceptance gates
+
+- Contract never receives custody of an NFT during listing or after sale.
+- A valid sale delivers token to buyer and credits exactly 2.5% / 97.5% of the
+  paid ETH to artist / seller; no third party can withdraw either credit.
+- A seller can cancel; a listed token transferred away or unapproved cannot be
+  sold from the stale listing.
+- Mainnet-fork tests and fuzz/invariants pass; final audited commit, bytecode,
+  and constructor parameters are recorded before deployment.
+- Audit findings are triaged publicly to the team and all critical/high findings
+  are fixed and retested before launch.

codex
Wrote [plan.md](/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T194520Z-codex-no-skill-2/workspace/plan.md).

Recommends immutable ETH-only fixed-price marketplace, on-chain listings, no escrow, pull payments, and a tightly bounded audit scope. Four weeks: feasible only with audit booked now and time for remediation/retest.
diff --git a/artifacts/ship-quiz-001/2026-07-30T194520Z-codex-no-skill-2/workspace/plan.md b/artifacts/ship-quiz-001/2026-07-30T194520Z-codex-no-skill-2/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..7eee0d8016f297ff5142e4bf2887fb1c8994c30e
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-07-30T194520Z-codex-no-skill-2/workspace/plan.md
@@ -0,0 +1,143 @@
+# Non-custodial resale marketplace plan
+
+## Recommendation
+
+Ship a deliberately small, fixed-price ETH marketplace: one collection, one
+artist payout address, 2.5% fee, no escrow, no offers, auctions, bundles,
+credit-card flow, currencies, or proxy upgrades. Listings must be canonical
+on-chain; Discord/site databases may index them but must not decide whether a
+sale is valid.
+
+This is feasible in four weeks **only if** the NFT is a conventional,
+verified ERC-721, the audit slot is booked now, and "one audit pass" means a
+short review plus remediation/retest. If the auditor begins only after week 4,
+four weeks is not a safe launch schedule. Leave time after the audit to fix
+findings; do not launch with unresolved high/medium findings.
+
+## Product and contract design
+
+Deploy a new, immutable `CollectionMarketplace` on mainnet. It references the
+existing NFT contract, an immutable artist payout address, and `ROYALTY_BPS =
+250`.
+
+Each listing records `tokenId`, seller, price in wei, and optional expiry. To
+list, the caller must currently own the token and have approved the marketplace
+for that token (or all their tokens). The NFT remains in the owner's wallet.
+
+`buy(tokenId)` is payable and, in one transaction:
+
+1. Loads an active, unexpired listing and requires `msg.value == price`.
+2. Re-checks that the recorded seller still owns the NFT and that the
+   marketplace remains approved.
+3. Deletes the listing before external calls.
+4. Credits `price * 250 / 10_000` to the artist and the remainder to the
+   seller, then transfers the NFT directly from seller to buyer using
+   `safeTransferFrom`.
+
+Use pull payments: `withdraw()` transfers a caller's credited ETH. This avoids
+a seller or artist fallback function making purchases fail. Protect purchase
+and withdrawal paths with a reentrancy guard. Exact-payment-only avoids refund
+logic. Emit `Listed`, `Cancelled`, `Sale`, and `Withdrawal` events; the site
+indexes these logs and displays on-chain state as authoritative.
+
+The seller can call `cancel(tokenId)` at any time. Transfers, approval
+revocations, and expiry make a listing unbuyable; the UI should label such
+listings inactive and offer cleanup. Optionally expose permissionless cleanup
+of provably stale/expired listings, with no payment or state beyond deletion.
+
+Do not add an admin withdrawal, fee switch, arbitrary NFT address, upgrade
+proxy, or relayer key. If artist-address changes are truly required, make that
+a separately governed, audited version; v1 should be immutable. This makes the
+royalty enforcement simple and credible, although it only applies to sales
+through this marketplace (not private transfers or other marketplaces).
+
+## Four-week delivery plan
+
+### Week 1 — validate and specify
+
+- Verify mainnet NFT source/ABI, ERC-721 behavior, token IDs, transfer hooks,
+  pausability, approval semantics, and whether it is upgradeable or has unusual
+  restrictions. Obtain artist payout address and confirm the 2.5% calculation
+  and rounding policy (round royalty down; seller receives the remainder).
+- Write a one-page protocol specification: state machine, authorization,
+  payment ordering, expiry policy, and explicit v1 exclusions.
+- Set up Foundry, pinned Solidity/OpenZeppelin versions, CI, formatting,
+  Slither, and a testnet fork of the real collection.
+- Book the audit now and send the intended scope and code-freeze date.
+
+### Week 2 — build and test contract
+
+- Implement the single marketplace contract, minimal interfaces, deployment
+  script, event indexer, and basic browse/list/cancel/buy/withdraw UI.
+- Write unit and integration tests against a mainnet fork. Cover approvals,
+  ownership changes, cancellation, expiry, exact value, royalty math, and
+  event contents.
+- Add invariant/fuzz tests: no NFT is held by marketplace; sale credits always
+  sum to price; only entitled accounts withdraw; a listing cannot be bought
+  twice; and invalidated listings never transfer a token or pay funds.
+
+### Week 3 — harden and freeze
+
+- Exercise adversarial ERC-721 recipients and ETH recipients, reentrancy,
+  forced ETH, zero/large prices, transfer between listing and buy, approval
+  revocation, duplicate listings, and stale UI/indexer data.
+- Deploy to Sepolia or a mainnet fork rehearsal; have real holders run the
+  approval, listing, cancellation, buy, and withdrawal journeys.
+- Complete deployment/runbook, monitoring, support copy, and a multisig
+  verification of the immutable constructor values. Freeze Solidity, compiler,
+  dependencies, and deployment scripts at the agreed audit commit.
+
+### Week 4 — audit, remediation, launch decision
+
+- Auditor reviews the frozen commit; team supplies evidence promptly and fixes
+  findings only through reviewed, tested commits.
+- Auditor retests fixes within the contracted pass. Re-run the full suite,
+  static analysis, and deployment rehearsal on the final commit.
+- Deploy only if audit report is accepted, critical/high issues are resolved,
+  test coverage is green, contracts are source-verified, and constructor
+  addresses/network/bytecode match the approved release artifact. Otherwise
+  delay mainnet; the Discord process remains the fallback.
+
+## Audit package and scope
+
+Send the auditor a tagged, reproducible release repository, not just a Solidity
+file:
+
+- `CollectionMarketplace.sol`, all local interfaces/libraries, exact
+  OpenZeppelin commit/package lock, compiler version/settings, and optimization
+  settings.
+- The existing NFT's verified mainnet source, address, ABI, ownership/admin
+  model, and a short note describing every non-standard transfer/approval
+  behavior. This dependency must be assessed because sale safety depends on it.
+- Protocol specification, state-transition diagram, invariants, trust model,
+  known limitations, fee/rounding examples, and a list of intended immutable
+  constructor values.
+- Full test suite (unit, fork, fuzz/invariant), test commands and results,
+  Slither/static-analysis output, coverage report, and deployment/rehearsal
+  scripts.
+- A deployment and operations runbook: deployer/multisig control, address
+  verification procedure, source verification, event/indexer assumptions,
+  incident response, and launch checklist.
+
+The audit scope is the marketplace's listing lifecycle, ownership/approval
+checks, direct NFT transfer, ETH accounting and pull withdrawals, royalty
+calculation, reentrancy/external-call ordering, denial-of-service behavior,
+event correctness, integer edge cases, and deployment configuration. Include
+the NFT integration and the exact deployment scripts in scope.
+
+The auditor need not audit unrelated website styling, Discord workflow, or a
+generic indexer implementation. However, test the UI separately for transaction
+construction, chain/address selection, stale-listing messaging, and wallet
+network handling; a correct contract can still be misused by an incorrect UI.
+
+## Acceptance gates
+
+- Contract never receives custody of an NFT during listing or after sale.
+- A valid sale delivers token to buyer and credits exactly 2.5% / 97.5% of the
+  paid ETH to artist / seller; no third party can withdraw either credit.
+- A seller can cancel; a listed token transferred away or unapproved cannot be
+  sold from the stale listing.
+- Mainnet-fork tests and fuzz/invariants pass; final audited commit, bytecode,
+  and constructor parameters are recorded before deployment.
+- Audit findings are triaged publicly to the team and all critical/high findings
+  are fixed and retested before launch.

tokens used
21,707
Wrote [plan.md](/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T194520Z-codex-no-skill-2/workspace/plan.md).

Recommends immutable ETH-only fixed-price marketplace, on-chain listings, no escrow, pull payments, and a tightly bounded audit scope. Four weeks: feasible only with audit booked now and time for remediation/retest.
