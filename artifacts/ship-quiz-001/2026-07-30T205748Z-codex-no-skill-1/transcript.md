Reading additional input from stdin...
OpenAI Codex v0.146.0
--------
workdir: /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T205748Z-codex-no-skill-1/workspace
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: low
reasoning summaries: none
session id: 019fb4d1-c2d3-76e0-a102-9a0d0fc7cd16
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
I’ll inspect the workspace context, then write the implementation/audit plan to `plan.md`.
exec
/bin/bash -lc 'ls -la && find . -maxdepth 2 -type f -print' in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T205748Z-codex-no-skill-1/workspace
 succeeded in 0ms:
total 12
drwxrwxr-x 5 matt matt 4096 Jul 30 13:58 .
drwxrwxr-x 3 matt matt 4096 Jul 30 13:57 ..
dr-xr-xr-x 2 matt matt   40 Jul 30 13:58 .agents
dr-xr-xr-x 2 matt matt   40 Jul 30 13:58 .codex
dr-xr-xr-x 2 matt matt   40 Jul 30 13:58 .git
-rw-rw-r-- 1 matt matt  764 Jul 30 13:57 TASK.md
./TASK.md

apply patch
patch: completed
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T205748Z-codex-no-skill-1/workspace/plan.md
diff --git a/artifacts/ship-quiz-001/2026-07-30T205748Z-codex-no-skill-1/workspace/plan.md b/artifacts/ship-quiz-001/2026-07-30T205748Z-codex-no-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..6b100d1cd5293aaa8643ca3fc3ffe4f110b9d613
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-07-30T205748Z-codex-no-skill-1/workspace/plan.md
@@ -0,0 +1,68 @@
+# Mainnet NFT marketplace plan
+
+## Recommendation and feasibility
+
+Four weeks is realistic for one Solidity developer **only for a deliberately narrow marketplace**: one existing ERC-721 collection, fixed-price sales in ETH, no custody, and a fixed 2.5% artist royalty. Do not add offers, auctions, ERC-20 payments, bundles, upgradeability, delegated listing, or arbitrary collections. Freeze the contract by the end of week 2 so the final two weeks can be used for adversarial testing, integration, documentation, and audit preparation.
+
+The listing contract should be a new, non-upgradeable marketplace. The 2024 NFT contract should not be modified or upgraded. ERC-2981 only reports royalty information; it does not force payment. This marketplace must calculate and enforce the 2.5% split itself on every sale it executes.
+
+## Contract design
+
+Use a small Solidity contract built on pinned OpenZeppelin releases:
+
+- Constructor immutables: existing collection address, artist payout address, and royalty rate (`250` basis points). Reject zero/non-contract addresses. No owner-controlled fee changes, pausing, proxy, or upgrade path unless a concrete operational need justifies the added audit surface.
+- `list(tokenId, price)`: require `price > 0`, `ownerOf(tokenId) == msg.sender`, and marketplace approval through `getApproved` or `isApprovedForAll`. Store seller and price under the token ID; replacing a listing should be explicit and emit an event.
+- `cancel(tokenId)`: only the recorded seller can cancel. Delete the listing and emit an event. Allow cancellation even if the NFT has since moved, so stale state can be cleared.
+- `buy(tokenId, expectedSeller, expectedPrice) payable`: require an exact live listing and exact `msg.value`; re-check current ownership and marketplace approval. Delete the listing before external interaction, transfer with `safeTransferFrom(seller, buyer, tokenId)`, then credit 2.5% to the artist and 97.5% to the seller. The expected seller and price protect a buyer from a changed listing being filled unexpectedly.
+- `withdraw()`: use pull payments for seller and artist proceeds rather than pushing ETH during `buy`. Zero the balance before sending, revert on failure, and protect state-changing external-call paths with reentrancy guards. Define rounding explicitly: `royalty = price * 250 / 10_000`; the seller receives the remainder, so no dust is trapped.
+- Emit indexed `Listed`, `Cancelled`, `Purchased`, and `Withdrawn` events. Expose listing and pending-proceeds getters for the site/indexer.
+
+Listings are commitments in marketplace storage, not escrow. Owners retain their NFTs and may transfer them elsewhere or revoke approval. Such a listing becomes unfillable; `buy` must revert safely. The UI/indexer should hide invalid listings by checking current owner and approval. Users make two transactions the first time: approve the marketplace, then list.
+
+Avoid signatures in v1. On-chain listings cost sellers gas but eliminate signature replay, nonce, expiry, and domain-separation risks within the four-week/audit constraint.
+
+## Four-week build plan
+
+### Week 1 — specification and core implementation
+
+- Confirm the deployed collection address, standard behavior, artist beneficiary, and authority to receive the royalty.
+- Write invariants and state transitions before code: only the owner lists; listing never transfers custody; purchase is atomic; price is paid exactly once; royalty plus seller proceeds equals price; failed transfer changes nothing; only beneficiaries withdraw their balances.
+- Implement the minimal contract, events, custom errors, deployment script, and unit-test scaffold using pinned compiler/dependency versions.
+
+### Week 2 — complete tests and freeze Solidity
+
+- Unit and fuzz tests for list, relist/update, cancel, buy, withdrawal, rounding, exact payment, authorization, and event contents.
+- Adversarial tests: revoked approval; NFT transferred after listing and later returned; seller contract that rejects ETH; buyer/ERC-721 receiver callback reentrancy; withdrawal reentrancy; stale price/seller; nonexistent tokens; repeated buys/cancels; artist also being seller; forced ETH; and failed `safeTransferFrom` rollback.
+- Fork-test against the actual mainnet collection, including its real approval and transfer behavior. Run static analysis and coverage. Freeze contract behavior and provide the frozen commit to the auditor for scheduling.
+
+### Week 3 — site integration and audit package
+
+- Build list/cancel/buy/withdraw flows and transaction-state/error handling. Read events plus live ownership/approval to avoid showing stale listings.
+- Deploy to a testnet or mainnet fork and exercise complete flows with EOAs and contract wallets.
+- Prepare NatSpec, architecture/state-transition notes, deployment parameters, privilege table, threat model, known limitations, test instructions, coverage and static-analysis results.
+
+### Week 4 — stabilization and audit handoff
+
+- Stop feature work. Fix integration findings, rerun the full deterministic suite, rehearse deployment and source verification, and tag one immutable audit commit.
+- Send that exact commit and package for the single audit pass. Reserve developer time to answer auditor questions and fix findings. Any post-audit code change must be a narrowly reviewed remediation; material new behavior means the audit no longer covers the deployed code.
+
+This schedule assumes the auditor is booked now and receives the code near the start of week 4. It is not realistic if “four weeks” must include an auditor's unknown queue and turnaround, or if the existing NFT has nonstandard transfer restrictions. Confirm both in week 1. Do not launch before critical/high findings are remediated and reviewed.
+
+## Audit scope
+
+Send the auditor one tagged commit containing:
+
+- The marketplace Solidity source and every locally maintained library it compiles with.
+- Exact compiler, optimizer, EVM target, OpenZeppelin/dependency versions, build configuration, and dependency lockfile.
+- Unit, fuzz, invariant, adversarial, and mainnet-fork tests; deployment and verification scripts; and commands to reproduce all results.
+- The deployed NFT contract address, verified source/ABI, and documented assumptions about its `ownerOf`, approval, and `safeTransferFrom` behavior. The old NFT contract is an external dependency/interaction boundary, not code being changed; ask the auditor to review that integration explicitly.
+- Written specification, state diagram, event/API documentation, royalty math and rounding examples, threat model, trust/privilege matrix, intended deployment addresses, and known limitations.
+- Frontend transaction-building code if it determines `expectedSeller`, `expectedPrice`, recipients, or calldata. Ordinary layout/content can remain out of scope, but wallet/network validation and stale-listing behavior deserve integration review.
+
+Ask the audit to cover authorization, listing lifecycle and stale listings, approval/ownership races, checks-effects-interactions, all ERC-721 receiver and ETH-recipient reentrancy, denial of service, accounting conservation, rounding, trapped/forced ETH, withdrawal correctness, front-running and changed-price protection, malicious seller/buyer contracts, collection incompatibility, event correctness, and deployment misconfiguration.
+
+Explicitly declare out of scope: the historical mint, unrelated NFT functionality, Discord trades, wallet/provider security, and UI presentation. Also document product limitations: only this collection, ETH only, fixed-price sales, no expiry/offers/auctions, royalties enforced only for trades through this marketplace, stale listings possible after transfer/revocation, and no emergency admin recovery.
+
+## Release gate
+
+Deploy only the auditor-reviewed bytecode built from the tagged commit. Verify source on Etherscan, independently check constructor arguments and chain ID, perform a low-value canary listing/purchase/withdrawal, and publish the contract address. Launch requires all tests passing, no unresolved critical/high audit findings, documented disposition of medium findings, and review of every remediation by the auditor or an equivalently qualified independent reviewer.

diff --git a/artifacts/ship-quiz-001/2026-07-30T205748Z-codex-no-skill-1/workspace/plan.md b/artifacts/ship-quiz-001/2026-07-30T205748Z-codex-no-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..6b100d1cd5293aaa8643ca3fc3ffe4f110b9d613
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-07-30T205748Z-codex-no-skill-1/workspace/plan.md
@@ -0,0 +1,68 @@
+# Mainnet NFT marketplace plan
+
+## Recommendation and feasibility
+
+Four weeks is realistic for one Solidity developer **only for a deliberately narrow marketplace**: one existing ERC-721 collection, fixed-price sales in ETH, no custody, and a fixed 2.5% artist royalty. Do not add offers, auctions, ERC-20 payments, bundles, upgradeability, delegated listing, or arbitrary collections. Freeze the contract by the end of week 2 so the final two weeks can be used for adversarial testing, integration, documentation, and audit preparation.
+
+The listing contract should be a new, non-upgradeable marketplace. The 2024 NFT contract should not be modified or upgraded. ERC-2981 only reports royalty information; it does not force payment. This marketplace must calculate and enforce the 2.5% split itself on every sale it executes.
+
+## Contract design
+
+Use a small Solidity contract built on pinned OpenZeppelin releases:
+
+- Constructor immutables: existing collection address, artist payout address, and royalty rate (`250` basis points). Reject zero/non-contract addresses. No owner-controlled fee changes, pausing, proxy, or upgrade path unless a concrete operational need justifies the added audit surface.
+- `list(tokenId, price)`: require `price > 0`, `ownerOf(tokenId) == msg.sender`, and marketplace approval through `getApproved` or `isApprovedForAll`. Store seller and price under the token ID; replacing a listing should be explicit and emit an event.
+- `cancel(tokenId)`: only the recorded seller can cancel. Delete the listing and emit an event. Allow cancellation even if the NFT has since moved, so stale state can be cleared.
+- `buy(tokenId, expectedSeller, expectedPrice) payable`: require an exact live listing and exact `msg.value`; re-check current ownership and marketplace approval. Delete the listing before external interaction, transfer with `safeTransferFrom(seller, buyer, tokenId)`, then credit 2.5% to the artist and 97.5% to the seller. The expected seller and price protect a buyer from a changed listing being filled unexpectedly.
+- `withdraw()`: use pull payments for seller and artist proceeds rather than pushing ETH during `buy`. Zero the balance before sending, revert on failure, and protect state-changing external-call paths with reentrancy guards. Define rounding explicitly: `royalty = price * 250 / 10_000`; the seller receives the remainder, so no dust is trapped.
+- Emit indexed `Listed`, `Cancelled`, `Purchased`, and `Withdrawn` events. Expose listing and pending-proceeds getters for the site/indexer.
+
+Listings are commitments in marketplace storage, not escrow. Owners retain their NFTs and may transfer them elsewhere or revoke approval. Such a listing becomes unfillable; `buy` must revert safely. The UI/indexer should hide invalid listings by checking current owner and approval. Users make two transactions the first time: approve the marketplace, then list.
+
+Avoid signatures in v1. On-chain listings cost sellers gas but eliminate signature replay, nonce, expiry, and domain-separation risks within the four-week/audit constraint.
+
+## Four-week build plan
+
+### Week 1 — specification and core implementation
+
+- Confirm the deployed collection address, standard behavior, artist beneficiary, and authority to receive the royalty.
+- Write invariants and state transitions before code: only the owner lists; listing never transfers custody; purchase is atomic; price is paid exactly once; royalty plus seller proceeds equals price; failed transfer changes nothing; only beneficiaries withdraw their balances.
+- Implement the minimal contract, events, custom errors, deployment script, and unit-test scaffold using pinned compiler/dependency versions.
+
+### Week 2 — complete tests and freeze Solidity
+
+- Unit and fuzz tests for list, relist/update, cancel, buy, withdrawal, rounding, exact payment, authorization, and event contents.
+- Adversarial tests: revoked approval; NFT transferred after listing and later returned; seller contract that rejects ETH; buyer/ERC-721 receiver callback reentrancy; withdrawal reentrancy; stale price/seller; nonexistent tokens; repeated buys/cancels; artist also being seller; forced ETH; and failed `safeTransferFrom` rollback.
+- Fork-test against the actual mainnet collection, including its real approval and transfer behavior. Run static analysis and coverage. Freeze contract behavior and provide the frozen commit to the auditor for scheduling.
+
+### Week 3 — site integration and audit package
+
+- Build list/cancel/buy/withdraw flows and transaction-state/error handling. Read events plus live ownership/approval to avoid showing stale listings.
+- Deploy to a testnet or mainnet fork and exercise complete flows with EOAs and contract wallets.
+- Prepare NatSpec, architecture/state-transition notes, deployment parameters, privilege table, threat model, known limitations, test instructions, coverage and static-analysis results.
+
+### Week 4 — stabilization and audit handoff
+
+- Stop feature work. Fix integration findings, rerun the full deterministic suite, rehearse deployment and source verification, and tag one immutable audit commit.
+- Send that exact commit and package for the single audit pass. Reserve developer time to answer auditor questions and fix findings. Any post-audit code change must be a narrowly reviewed remediation; material new behavior means the audit no longer covers the deployed code.
+
+This schedule assumes the auditor is booked now and receives the code near the start of week 4. It is not realistic if “four weeks” must include an auditor's unknown queue and turnaround, or if the existing NFT has nonstandard transfer restrictions. Confirm both in week 1. Do not launch before critical/high findings are remediated and reviewed.
+
+## Audit scope
+
+Send the auditor one tagged commit containing:
+
+- The marketplace Solidity source and every locally maintained library it compiles with.
+- Exact compiler, optimizer, EVM target, OpenZeppelin/dependency versions, build configuration, and dependency lockfile.
+- Unit, fuzz, invariant, adversarial, and mainnet-fork tests; deployment and verification scripts; and commands to reproduce all results.
+- The deployed NFT contract address, verified source/ABI, and documented assumptions about its `ownerOf`, approval, and `safeTransferFrom` behavior. The old NFT contract is an external dependency/interaction boundary, not code being changed; ask the auditor to review that integration explicitly.
+- Written specification, state diagram, event/API documentation, royalty math and rounding examples, threat model, trust/privilege matrix, intended deployment addresses, and known limitations.
+- Frontend transaction-building code if it determines `expectedSeller`, `expectedPrice`, recipients, or calldata. Ordinary layout/content can remain out of scope, but wallet/network validation and stale-listing behavior deserve integration review.
+
+Ask the audit to cover authorization, listing lifecycle and stale listings, approval/ownership races, checks-effects-interactions, all ERC-721 receiver and ETH-recipient reentrancy, denial of service, accounting conservation, rounding, trapped/forced ETH, withdrawal correctness, front-running and changed-price protection, malicious seller/buyer contracts, collection incompatibility, event correctness, and deployment misconfiguration.
+
+Explicitly declare out of scope: the historical mint, unrelated NFT functionality, Discord trades, wallet/provider security, and UI presentation. Also document product limitations: only this collection, ETH only, fixed-price sales, no expiry/offers/auctions, royalties enforced only for trades through this marketplace, stale listings possible after transfer/revocation, and no emergency admin recovery.
+
+## Release gate
+
+Deploy only the auditor-reviewed bytecode built from the tagged commit. Verify source on Etherscan, independently check constructor arguments and chain ID, perform a low-value canary listing/purchase/withdrawal, and publish the contract address. Launch requires all tests passing, no unresolved critical/high audit findings, documented disposition of medium findings, and review of every remediation by the auditor or an equivalently qualified independent reviewer.

exec
/bin/bash -lc "wc -w plan.md && sed -n '1,260p' plan.md" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T205748Z-codex-no-skill-1/workspace
 succeeded in 0ms:
1112 plan.md
# Mainnet NFT marketplace plan

## Recommendation and feasibility

Four weeks is realistic for one Solidity developer **only for a deliberately narrow marketplace**: one existing ERC-721 collection, fixed-price sales in ETH, no custody, and a fixed 2.5% artist royalty. Do not add offers, auctions, ERC-20 payments, bundles, upgradeability, delegated listing, or arbitrary collections. Freeze the contract by the end of week 2 so the final two weeks can be used for adversarial testing, integration, documentation, and audit preparation.

The listing contract should be a new, non-upgradeable marketplace. The 2024 NFT contract should not be modified or upgraded. ERC-2981 only reports royalty information; it does not force payment. This marketplace must calculate and enforce the 2.5% split itself on every sale it executes.

## Contract design

Use a small Solidity contract built on pinned OpenZeppelin releases:

- Constructor immutables: existing collection address, artist payout address, and royalty rate (`250` basis points). Reject zero/non-contract addresses. No owner-controlled fee changes, pausing, proxy, or upgrade path unless a concrete operational need justifies the added audit surface.
- `list(tokenId, price)`: require `price > 0`, `ownerOf(tokenId) == msg.sender`, and marketplace approval through `getApproved` or `isApprovedForAll`. Store seller and price under the token ID; replacing a listing should be explicit and emit an event.
- `cancel(tokenId)`: only the recorded seller can cancel. Delete the listing and emit an event. Allow cancellation even if the NFT has since moved, so stale state can be cleared.
- `buy(tokenId, expectedSeller, expectedPrice) payable`: require an exact live listing and exact `msg.value`; re-check current ownership and marketplace approval. Delete the listing before external interaction, transfer with `safeTransferFrom(seller, buyer, tokenId)`, then credit 2.5% to the artist and 97.5% to the seller. The expected seller and price protect a buyer from a changed listing being filled unexpectedly.
- `withdraw()`: use pull payments for seller and artist proceeds rather than pushing ETH during `buy`. Zero the balance before sending, revert on failure, and protect state-changing external-call paths with reentrancy guards. Define rounding explicitly: `royalty = price * 250 / 10_000`; the seller receives the remainder, so no dust is trapped.
- Emit indexed `Listed`, `Cancelled`, `Purchased`, and `Withdrawn` events. Expose listing and pending-proceeds getters for the site/indexer.

Listings are commitments in marketplace storage, not escrow. Owners retain their NFTs and may transfer them elsewhere or revoke approval. Such a listing becomes unfillable; `buy` must revert safely. The UI/indexer should hide invalid listings by checking current owner and approval. Users make two transactions the first time: approve the marketplace, then list.

Avoid signatures in v1. On-chain listings cost sellers gas but eliminate signature replay, nonce, expiry, and domain-separation risks within the four-week/audit constraint.

## Four-week build plan

### Week 1 — specification and core implementation

- Confirm the deployed collection address, standard behavior, artist beneficiary, and authority to receive the royalty.
- Write invariants and state transitions before code: only the owner lists; listing never transfers custody; purchase is atomic; price is paid exactly once; royalty plus seller proceeds equals price; failed transfer changes nothing; only beneficiaries withdraw their balances.
- Implement the minimal contract, events, custom errors, deployment script, and unit-test scaffold using pinned compiler/dependency versions.

### Week 2 — complete tests and freeze Solidity

- Unit and fuzz tests for list, relist/update, cancel, buy, withdrawal, rounding, exact payment, authorization, and event contents.
- Adversarial tests: revoked approval; NFT transferred after listing and later returned; seller contract that rejects ETH; buyer/ERC-721 receiver callback reentrancy; withdrawal reentrancy; stale price/seller; nonexistent tokens; repeated buys/cancels; artist also being seller; forced ETH; and failed `safeTransferFrom` rollback.
- Fork-test against the actual mainnet collection, including its real approval and transfer behavior. Run static analysis and coverage. Freeze contract behavior and provide the frozen commit to the auditor for scheduling.

### Week 3 — site integration and audit package

- Build list/cancel/buy/withdraw flows and transaction-state/error handling. Read events plus live ownership/approval to avoid showing stale listings.
- Deploy to a testnet or mainnet fork and exercise complete flows with EOAs and contract wallets.
- Prepare NatSpec, architecture/state-transition notes, deployment parameters, privilege table, threat model, known limitations, test instructions, coverage and static-analysis results.

### Week 4 — stabilization and audit handoff

- Stop feature work. Fix integration findings, rerun the full deterministic suite, rehearse deployment and source verification, and tag one immutable audit commit.
- Send that exact commit and package for the single audit pass. Reserve developer time to answer auditor questions and fix findings. Any post-audit code change must be a narrowly reviewed remediation; material new behavior means the audit no longer covers the deployed code.

This schedule assumes the auditor is booked now and receives the code near the start of week 4. It is not realistic if “four weeks” must include an auditor's unknown queue and turnaround, or if the existing NFT has nonstandard transfer restrictions. Confirm both in week 1. Do not launch before critical/high findings are remediated and reviewed.

## Audit scope

Send the auditor one tagged commit containing:

- The marketplace Solidity source and every locally maintained library it compiles with.
- Exact compiler, optimizer, EVM target, OpenZeppelin/dependency versions, build configuration, and dependency lockfile.
- Unit, fuzz, invariant, adversarial, and mainnet-fork tests; deployment and verification scripts; and commands to reproduce all results.
- The deployed NFT contract address, verified source/ABI, and documented assumptions about its `ownerOf`, approval, and `safeTransferFrom` behavior. The old NFT contract is an external dependency/interaction boundary, not code being changed; ask the auditor to review that integration explicitly.
- Written specification, state diagram, event/API documentation, royalty math and rounding examples, threat model, trust/privilege matrix, intended deployment addresses, and known limitations.
- Frontend transaction-building code if it determines `expectedSeller`, `expectedPrice`, recipients, or calldata. Ordinary layout/content can remain out of scope, but wallet/network validation and stale-listing behavior deserve integration review.

Ask the audit to cover authorization, listing lifecycle and stale listings, approval/ownership races, checks-effects-interactions, all ERC-721 receiver and ETH-recipient reentrancy, denial of service, accounting conservation, rounding, trapped/forced ETH, withdrawal correctness, front-running and changed-price protection, malicious seller/buyer contracts, collection incompatibility, event correctness, and deployment misconfiguration.

Explicitly declare out of scope: the historical mint, unrelated NFT functionality, Discord trades, wallet/provider security, and UI presentation. Also document product limitations: only this collection, ETH only, fixed-price sales, no expiry/offers/auctions, royalties enforced only for trades through this marketplace, stale listings possible after transfer/revocation, and no emergency admin recovery.

## Release gate

Deploy only the auditor-reviewed bytecode built from the tagged commit. Verify source on Etherscan, independently check constructor arguments and chain ID, perform a low-value canary listing/purchase/withdrawal, and publish the contract address. Launch requires all tests passing, no unresolved critical/high audit findings, documented disposition of medium findings, and review of every remediation by the auditor or an equivalently qualified independent reviewer.

diff --git a/artifacts/ship-quiz-001/2026-07-30T205748Z-codex-no-skill-1/workspace/plan.md b/artifacts/ship-quiz-001/2026-07-30T205748Z-codex-no-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..6b100d1cd5293aaa8643ca3fc3ffe4f110b9d613
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-07-30T205748Z-codex-no-skill-1/workspace/plan.md
@@ -0,0 +1,68 @@
+# Mainnet NFT marketplace plan
+
+## Recommendation and feasibility
+
+Four weeks is realistic for one Solidity developer **only for a deliberately narrow marketplace**: one existing ERC-721 collection, fixed-price sales in ETH, no custody, and a fixed 2.5% artist royalty. Do not add offers, auctions, ERC-20 payments, bundles, upgradeability, delegated listing, or arbitrary collections. Freeze the contract by the end of week 2 so the final two weeks can be used for adversarial testing, integration, documentation, and audit preparation.
+
+The listing contract should be a new, non-upgradeable marketplace. The 2024 NFT contract should not be modified or upgraded. ERC-2981 only reports royalty information; it does not force payment. This marketplace must calculate and enforce the 2.5% split itself on every sale it executes.
+
+## Contract design
+
+Use a small Solidity contract built on pinned OpenZeppelin releases:
+
+- Constructor immutables: existing collection address, artist payout address, and royalty rate (`250` basis points). Reject zero/non-contract addresses. No owner-controlled fee changes, pausing, proxy, or upgrade path unless a concrete operational need justifies the added audit surface.
+- `list(tokenId, price)`: require `price > 0`, `ownerOf(tokenId) == msg.sender`, and marketplace approval through `getApproved` or `isApprovedForAll`. Store seller and price under the token ID; replacing a listing should be explicit and emit an event.
+- `cancel(tokenId)`: only the recorded seller can cancel. Delete the listing and emit an event. Allow cancellation even if the NFT has since moved, so stale state can be cleared.
+- `buy(tokenId, expectedSeller, expectedPrice) payable`: require an exact live listing and exact `msg.value`; re-check current ownership and marketplace approval. Delete the listing before external interaction, transfer with `safeTransferFrom(seller, buyer, tokenId)`, then credit 2.5% to the artist and 97.5% to the seller. The expected seller and price protect a buyer from a changed listing being filled unexpectedly.
+- `withdraw()`: use pull payments for seller and artist proceeds rather than pushing ETH during `buy`. Zero the balance before sending, revert on failure, and protect state-changing external-call paths with reentrancy guards. Define rounding explicitly: `royalty = price * 250 / 10_000`; the seller receives the remainder, so no dust is trapped.
+- Emit indexed `Listed`, `Cancelled`, `Purchased`, and `Withdrawn` events. Expose listing and pending-proceeds getters for the site/indexer.
+
+Listings are commitments in marketplace storage, not escrow. Owners retain their NFTs and may transfer them elsewhere or revoke approval. Such a listing becomes unfillable; `buy` must revert safely. The UI/indexer should hide invalid listings by checking current owner and approval. Users make two transactions the first time: approve the marketplace, then list.
+
+Avoid signatures in v1. On-chain listings cost sellers gas but eliminate signature replay, nonce, expiry, and domain-separation risks within the four-week/audit constraint.
+
+## Four-week build plan
+
+### Week 1 — specification and core implementation
+
+- Confirm the deployed collection address, standard behavior, artist beneficiary, and authority to receive the royalty.
+- Write invariants and state transitions before code: only the owner lists; listing never transfers custody; purchase is atomic; price is paid exactly once; royalty plus seller proceeds equals price; failed transfer changes nothing; only beneficiaries withdraw their balances.
+- Implement the minimal contract, events, custom errors, deployment script, and unit-test scaffold using pinned compiler/dependency versions.
+
+### Week 2 — complete tests and freeze Solidity
+
+- Unit and fuzz tests for list, relist/update, cancel, buy, withdrawal, rounding, exact payment, authorization, and event contents.
+- Adversarial tests: revoked approval; NFT transferred after listing and later returned; seller contract that rejects ETH; buyer/ERC-721 receiver callback reentrancy; withdrawal reentrancy; stale price/seller; nonexistent tokens; repeated buys/cancels; artist also being seller; forced ETH; and failed `safeTransferFrom` rollback.
+- Fork-test against the actual mainnet collection, including its real approval and transfer behavior. Run static analysis and coverage. Freeze contract behavior and provide the frozen commit to the auditor for scheduling.
+
+### Week 3 — site integration and audit package
+
+- Build list/cancel/buy/withdraw flows and transaction-state/error handling. Read events plus live ownership/approval to avoid showing stale listings.
+- Deploy to a testnet or mainnet fork and exercise complete flows with EOAs and contract wallets.
+- Prepare NatSpec, architecture/state-transition notes, deployment parameters, privilege table, threat model, known limitations, test instructions, coverage and static-analysis results.
+
+### Week 4 — stabilization and audit handoff
+
+- Stop feature work. Fix integration findings, rerun the full deterministic suite, rehearse deployment and source verification, and tag one immutable audit commit.
+- Send that exact commit and package for the single audit pass. Reserve developer time to answer auditor questions and fix findings. Any post-audit code change must be a narrowly reviewed remediation; material new behavior means the audit no longer covers the deployed code.
+
+This schedule assumes the auditor is booked now and receives the code near the start of week 4. It is not realistic if “four weeks” must include an auditor's unknown queue and turnaround, or if the existing NFT has nonstandard transfer restrictions. Confirm both in week 1. Do not launch before critical/high findings are remediated and reviewed.
+
+## Audit scope
+
+Send the auditor one tagged commit containing:
+
+- The marketplace Solidity source and every locally maintained library it compiles with.
+- Exact compiler, optimizer, EVM target, OpenZeppelin/dependency versions, build configuration, and dependency lockfile.
+- Unit, fuzz, invariant, adversarial, and mainnet-fork tests; deployment and verification scripts; and commands to reproduce all results.
+- The deployed NFT contract address, verified source/ABI, and documented assumptions about its `ownerOf`, approval, and `safeTransferFrom` behavior. The old NFT contract is an external dependency/interaction boundary, not code being changed; ask the auditor to review that integration explicitly.
+- Written specification, state diagram, event/API documentation, royalty math and rounding examples, threat model, trust/privilege matrix, intended deployment addresses, and known limitations.
+- Frontend transaction-building code if it determines `expectedSeller`, `expectedPrice`, recipients, or calldata. Ordinary layout/content can remain out of scope, but wallet/network validation and stale-listing behavior deserve integration review.
+
+Ask the audit to cover authorization, listing lifecycle and stale listings, approval/ownership races, checks-effects-interactions, all ERC-721 receiver and ETH-recipient reentrancy, denial of service, accounting conservation, rounding, trapped/forced ETH, withdrawal correctness, front-running and changed-price protection, malicious seller/buyer contracts, collection incompatibility, event correctness, and deployment misconfiguration.
+
+Explicitly declare out of scope: the historical mint, unrelated NFT functionality, Discord trades, wallet/provider security, and UI presentation. Also document product limitations: only this collection, ETH only, fixed-price sales, no expiry/offers/auctions, royalties enforced only for trades through this marketplace, stale listings possible after transfer/revocation, and no emergency admin recovery.
+
+## Release gate
+
+Deploy only the auditor-reviewed bytecode built from the tagged commit. Verify source on Etherscan, independently check constructor arguments and chain ID, perform a low-value canary listing/purchase/withdrawal, and publish the contract address. Launch requires all tests passing, no unresolved critical/high audit findings, documented disposition of medium findings, and review of every remediation by the auditor or an equivalently qualified independent reviewer.

codex
Created [plan.md](/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T205748Z-codex-no-skill-1/workspace/plan.md). Covers minimal architecture, four-week schedule, audit scope, risks, and release gates.
diff --git a/artifacts/ship-quiz-001/2026-07-30T205748Z-codex-no-skill-1/workspace/plan.md b/artifacts/ship-quiz-001/2026-07-30T205748Z-codex-no-skill-1/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..6b100d1cd5293aaa8643ca3fc3ffe4f110b9d613
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-07-30T205748Z-codex-no-skill-1/workspace/plan.md
@@ -0,0 +1,68 @@
+# Mainnet NFT marketplace plan
+
+## Recommendation and feasibility
+
+Four weeks is realistic for one Solidity developer **only for a deliberately narrow marketplace**: one existing ERC-721 collection, fixed-price sales in ETH, no custody, and a fixed 2.5% artist royalty. Do not add offers, auctions, ERC-20 payments, bundles, upgradeability, delegated listing, or arbitrary collections. Freeze the contract by the end of week 2 so the final two weeks can be used for adversarial testing, integration, documentation, and audit preparation.
+
+The listing contract should be a new, non-upgradeable marketplace. The 2024 NFT contract should not be modified or upgraded. ERC-2981 only reports royalty information; it does not force payment. This marketplace must calculate and enforce the 2.5% split itself on every sale it executes.
+
+## Contract design
+
+Use a small Solidity contract built on pinned OpenZeppelin releases:
+
+- Constructor immutables: existing collection address, artist payout address, and royalty rate (`250` basis points). Reject zero/non-contract addresses. No owner-controlled fee changes, pausing, proxy, or upgrade path unless a concrete operational need justifies the added audit surface.
+- `list(tokenId, price)`: require `price > 0`, `ownerOf(tokenId) == msg.sender`, and marketplace approval through `getApproved` or `isApprovedForAll`. Store seller and price under the token ID; replacing a listing should be explicit and emit an event.
+- `cancel(tokenId)`: only the recorded seller can cancel. Delete the listing and emit an event. Allow cancellation even if the NFT has since moved, so stale state can be cleared.
+- `buy(tokenId, expectedSeller, expectedPrice) payable`: require an exact live listing and exact `msg.value`; re-check current ownership and marketplace approval. Delete the listing before external interaction, transfer with `safeTransferFrom(seller, buyer, tokenId)`, then credit 2.5% to the artist and 97.5% to the seller. The expected seller and price protect a buyer from a changed listing being filled unexpectedly.
+- `withdraw()`: use pull payments for seller and artist proceeds rather than pushing ETH during `buy`. Zero the balance before sending, revert on failure, and protect state-changing external-call paths with reentrancy guards. Define rounding explicitly: `royalty = price * 250 / 10_000`; the seller receives the remainder, so no dust is trapped.
+- Emit indexed `Listed`, `Cancelled`, `Purchased`, and `Withdrawn` events. Expose listing and pending-proceeds getters for the site/indexer.
+
+Listings are commitments in marketplace storage, not escrow. Owners retain their NFTs and may transfer them elsewhere or revoke approval. Such a listing becomes unfillable; `buy` must revert safely. The UI/indexer should hide invalid listings by checking current owner and approval. Users make two transactions the first time: approve the marketplace, then list.
+
+Avoid signatures in v1. On-chain listings cost sellers gas but eliminate signature replay, nonce, expiry, and domain-separation risks within the four-week/audit constraint.
+
+## Four-week build plan
+
+### Week 1 — specification and core implementation
+
+- Confirm the deployed collection address, standard behavior, artist beneficiary, and authority to receive the royalty.
+- Write invariants and state transitions before code: only the owner lists; listing never transfers custody; purchase is atomic; price is paid exactly once; royalty plus seller proceeds equals price; failed transfer changes nothing; only beneficiaries withdraw their balances.
+- Implement the minimal contract, events, custom errors, deployment script, and unit-test scaffold using pinned compiler/dependency versions.
+
+### Week 2 — complete tests and freeze Solidity
+
+- Unit and fuzz tests for list, relist/update, cancel, buy, withdrawal, rounding, exact payment, authorization, and event contents.
+- Adversarial tests: revoked approval; NFT transferred after listing and later returned; seller contract that rejects ETH; buyer/ERC-721 receiver callback reentrancy; withdrawal reentrancy; stale price/seller; nonexistent tokens; repeated buys/cancels; artist also being seller; forced ETH; and failed `safeTransferFrom` rollback.
+- Fork-test against the actual mainnet collection, including its real approval and transfer behavior. Run static analysis and coverage. Freeze contract behavior and provide the frozen commit to the auditor for scheduling.
+
+### Week 3 — site integration and audit package
+
+- Build list/cancel/buy/withdraw flows and transaction-state/error handling. Read events plus live ownership/approval to avoid showing stale listings.
+- Deploy to a testnet or mainnet fork and exercise complete flows with EOAs and contract wallets.
+- Prepare NatSpec, architecture/state-transition notes, deployment parameters, privilege table, threat model, known limitations, test instructions, coverage and static-analysis results.
+
+### Week 4 — stabilization and audit handoff
+
+- Stop feature work. Fix integration findings, rerun the full deterministic suite, rehearse deployment and source verification, and tag one immutable audit commit.
+- Send that exact commit and package for the single audit pass. Reserve developer time to answer auditor questions and fix findings. Any post-audit code change must be a narrowly reviewed remediation; material new behavior means the audit no longer covers the deployed code.
+
+This schedule assumes the auditor is booked now and receives the code near the start of week 4. It is not realistic if “four weeks” must include an auditor's unknown queue and turnaround, or if the existing NFT has nonstandard transfer restrictions. Confirm both in week 1. Do not launch before critical/high findings are remediated and reviewed.
+
+## Audit scope
+
+Send the auditor one tagged commit containing:
+
+- The marketplace Solidity source and every locally maintained library it compiles with.
+- Exact compiler, optimizer, EVM target, OpenZeppelin/dependency versions, build configuration, and dependency lockfile.
+- Unit, fuzz, invariant, adversarial, and mainnet-fork tests; deployment and verification scripts; and commands to reproduce all results.
+- The deployed NFT contract address, verified source/ABI, and documented assumptions about its `ownerOf`, approval, and `safeTransferFrom` behavior. The old NFT contract is an external dependency/interaction boundary, not code being changed; ask the auditor to review that integration explicitly.
+- Written specification, state diagram, event/API documentation, royalty math and rounding examples, threat model, trust/privilege matrix, intended deployment addresses, and known limitations.
+- Frontend transaction-building code if it determines `expectedSeller`, `expectedPrice`, recipients, or calldata. Ordinary layout/content can remain out of scope, but wallet/network validation and stale-listing behavior deserve integration review.
+
+Ask the audit to cover authorization, listing lifecycle and stale listings, approval/ownership races, checks-effects-interactions, all ERC-721 receiver and ETH-recipient reentrancy, denial of service, accounting conservation, rounding, trapped/forced ETH, withdrawal correctness, front-running and changed-price protection, malicious seller/buyer contracts, collection incompatibility, event correctness, and deployment misconfiguration.
+
+Explicitly declare out of scope: the historical mint, unrelated NFT functionality, Discord trades, wallet/provider security, and UI presentation. Also document product limitations: only this collection, ETH only, fixed-price sales, no expiry/offers/auctions, royalties enforced only for trades through this marketplace, stale listings possible after transfer/revocation, and no emergency admin recovery.
+
+## Release gate
+
+Deploy only the auditor-reviewed bytecode built from the tagged commit. Verify source on Etherscan, independently check constructor arguments and chain ID, perform a low-value canary listing/purchase/withdrawal, and publish the contract address. Launch requires all tests passing, no unresolved critical/high audit findings, documented disposition of medium findings, and review of every remediation by the auditor or an equivalently qualified independent reviewer.

tokens used
22,427
Created [plan.md](/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T205748Z-codex-no-skill-1/workspace/plan.md). Covers minimal architecture, four-week schedule, audit scope, risks, and release gates.
