Reading additional input from stdin...
OpenAI Codex v0.146.0
--------
workdir: /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T194625Z-codex-no-skill-3/workspace
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: high
reasoning summaries: none
session id: 019fb490-560c-7c70-a39b-4ec5be74642c
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
I’ll inspect the workspace context, then write a concise implementation and audit plan.
exec
/bin/bash -lc "pwd && rg --files -g '"'!*node_modules*'"' -g '"'!*.lock'"' | sed -n '1,160p'" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T194625Z-codex-no-skill-3/workspace
 succeeded in 0ms:
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T194625Z-codex-no-skill-3/workspace
TASK.md

exec
/bin/bash -lc "sed -n '1,240p' TASK.md" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T194625Z-codex-no-skill-3/workspace
 succeeded in 0ms:
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
The safe four-week shape is an own-site integration over a battle-tested order protocol, not a new marketplace contract. I’m capturing the constraints, scope, and launch gate in the plan.
apply patch
patch: completed
/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T194625Z-codex-no-skill-3/workspace/plan.md
diff --git a/artifacts/ship-quiz-001/2026-07-30T194625Z-codex-no-skill-3/workspace/plan.md b/artifacts/ship-quiz-001/2026-07-30T194625Z-codex-no-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..0e98cb0518b2433eeb7cdf11a44c36909b5bdcd2
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-07-30T194625Z-codex-no-skill-3/workspace/plan.md
@@ -0,0 +1,136 @@
+# Resale marketplace plan
+
+## Recommendation
+
+Build the collection's own-site experience on a deployed, audited NFT order
+protocol (for example, Seaport), rather than write a custody or marketplace
+contract in four weeks. The site creates signed ERC-721 sell orders; it shows
+and fulfils only orders containing these exact proceeds:
+
+| Recipient | Share of a 0.4 ETH sale |
+| --- | ---: |
+| Seller | 97.5% / 0.39 ETH |
+| Artist royalty wallet | 2.5% / 0.01 ETH |
+
+The token stays in the holder's wallet while listed. At purchase, the protocol
+atomically transfers token #3312 to the buyer and sends ETH to seller and
+artist. A seller cancels through the protocol's on-chain cancellation; a sale
+also fails safely if the seller transferred the token, revoked approval, or the
+order expired.
+
+This enforces 2.5% only for trades executed through this site. An already
+minted, conventional mainnet ERC-721 cannot generally force royalties on
+transfers or sales through other marketplaces. State this plainly in product
+copy; do not claim collection-wide royalty enforcement.
+
+## Fixed launch scope
+
+- One existing Ethereum-mainnet ERC-721 collection; ERC-721 transfers only.
+- Native ETH fixed-price listings only. No offers, auctions, bids, bundles,
+  ERC-20 payments, trait pricing, private sales, or cross-chain support.
+- Wallet connect; list, sign, browse, buy, cancel; transaction history/status.
+- Off-chain index/API stores signed orders and discovery metadata only. Chain
+  events and current on-chain ownership/approval are authoritative.
+- A collection allowlist, fixed artist payout address, and fixed 250 basis-point
+  royalty rule in server-side order construction/validation. Reject any order
+  not matching every required field before display or fulfilment.
+- No platform fee at launch. This removes another payout and policy surface.
+
+Use the protocol's official mainnet deployment and SDK, pinned to exact
+versions and contract addresses. Do not deploy a wrapper, escrow, proxy,
+upgradeable contract, payment splitter, or custom royalty contract. A custom
+contract makes the deadline and single audit materially riskier.
+
+## Required flow and security rules
+
+1. Before signing, the UI verifies `ownerOf(tokenId)`, warns about the required
+   token approval, and displays the complete payout breakdown.
+2. The signed order offers exactly one collection token and requests exactly two
+   ETH consideration items: seller 9,750 bps and artist 250 bps. It has a
+   short, explicit expiry and a unique order salt.
+3. The API independently decodes and validates submitted orders; it never
+   accepts a client-provided royalty amount, recipient, collection, or chain.
+4. Search results are advisory. Before enabling Buy, refresh order status,
+   owner, approval, expiry, and full consideration from chain. The fulfilment
+   transaction remains the final authority.
+5. Buy uses the protocol's atomic fulfilment call with the exact ETH value.
+   The UI handles replacement, revert, already-filled, cancelled, expired, and
+   approval-revoked outcomes without saying a purchase succeeded early.
+6. Cancel calls the protocol's cancellation mechanism using the seller wallet;
+   alternatively an owner may invalidate via transfer/revoking approval, but
+   cancellation is the clear supported path. Remove cancelled/filled orders
+   from discovery from indexed events, not only an API flag.
+7. Never ask users to approve an unknown contract, sign arbitrary typed data,
+   or send ETH to a backend. Display protocol address, token ID, price,
+   seller, artist wallet, expiry, and network in the signing/buy review.
+
+Decide before implementation whether royalties must be enforced against an
+owner who uses another marketplace. If yes, stop: that is not achievable as a
+site-only feature for a typical already-deployed ERC-721 and needs a separate
+collection-contract/migration design and security review.
+
+## Four-week delivery plan
+
+| Week | Deliverable and gate |
+| --- | --- |
+| 1 | Inspect the live NFT contract on a mainnet fork: ownership, transfer behavior, approval APIs, token IDs, pausability, royalties, and known special cases. Freeze protocol/deployment/SDK versions. Write threat model, order schema, payout rules, and acceptance tests. Build a small end-to-end prototype against a test collection. |
+| 2 | Implement wallet flows and strictly validating order API/indexer. Build list, browse, buy, cancel screens. Add unit tests for all validator failures and protocol SDK/order encoding. |
+| 3 | Mainnet-fork integration tests for success and every invalidation path: fill, cancel, transfer-after-list, approval revoke, expiry, wrong chain, wrong collection/token, altered payout, duplicate submission, and concurrent buys. Do manual wallet/browser testing and freeze code/config/docs by week end. |
+| 4 | Send the frozen package to the auditor immediately. Triage findings, fix only agreed findings, rerun all tests and a fork smoke test, and obtain auditor retest/sign-off before mainnet release. Prepare monitoring, incident contacts, and a disabled-by-default launch switch. |
+
+Four weeks is realistic for this deliberately narrow integration if the NFT
+behaves like a standard transferable ERC-721 and the auditor can start in week
+4. It is realistic for a staging-ready build, not a guaranteed mainnet launch:
+one end-of-schedule audit pass leaves no reliable remediation buffer. Do not
+launch on a report containing unresolved high/medium findings, or without a
+retest of fixes. If the audit cannot include retest, reserve a fifth week for
+remediation and verification.
+
+## Audit scope package
+
+Send one frozen, tagged repository and deployment manifest. The audit covers
+the integration and its assumptions; it does not ask the auditor to re-audit
+the external protocol's entire codebase.
+
+- Exact protocol contract addresses, chain ID, SDK/package versions, commit
+  hashes, ABIs, and links to the protocol's existing audits; assert no custom
+  Solidity is deployed.
+- The live NFT contract address, verified source/ABI, deployment details, and
+  a short compatibility report for `ownerOf`, approvals, transfers, pauses,
+  operator filtering, token restrictions, and any existing royalty behavior.
+- Threat model and trust-boundary diagram: buyer, seller, artist wallet,
+  frontend, API/indexer, wallet provider, external protocol, and chain event
+  source. Include assumptions and out-of-scope risks.
+- Exact typed-data/order schema plus examples for a valid listing and each
+  rejected variation. Specify the invariant: collection/token/chain match;
+  seller receives 9,750 bps; artist wallet receives 250 bps; total ETH equals
+  the displayed price; no other consideration is accepted.
+- Source for frontend, API, order decoder/validator, indexer, configuration,
+  infrastructure-as-code, CI, and deployment scripts. Secrets are excluded,
+  but document secret locations, key rotation, RPC/provider trust, access
+  controls, and production environment variables.
+- Test evidence: unit, integration, and mainnet-fork results; test-wallet
+  addresses; reproducible commands; coverage; and manual test checklist.
+- All user-signing and transaction payloads/screenshots, including approval,
+  listing, purchase, cancellation, wrong-network, and failed-transaction UI.
+  The reviewer should check phishing/confused-deputy risks as well as code.
+- Operational runbook: event reconciliation/reorg handling, stale-listing
+  policy, monitoring/alerts, rate limits, API abuse controls, incident owner,
+  rollback/feature-disable plan, and disclosure contact.
+
+## Audit acceptance criteria
+
+The auditor must be able to reproduce that a valid fill transfers exactly the
+listed NFT and splits ETH 97.5%/2.5%; no accepted order can redirect the artist
+share; cancelled, filled, expired, unapproved, transferred, or wrong-chain
+orders cannot be bought; the backend cannot take custody or fabricate a valid
+seller signature; and stale/off-chain data cannot cause a buyer to overpay or
+buy a different token. Any deviation blocks launch.
+
+## Ownership
+
+The Solidity developer owns protocol integration, fork tests, deployment
+manifest, and remediation. A product/frontend owner owns the signing copy,
+artist-wallet verification, support workflow, and launch switch. Before audit,
+the artist verifies the royalty address from an independent channel and signs
+off on the immutable 2.5% policy.

diff --git a/artifacts/ship-quiz-001/2026-07-30T194625Z-codex-no-skill-3/workspace/plan.md b/artifacts/ship-quiz-001/2026-07-30T194625Z-codex-no-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..0e98cb0518b2433eeb7cdf11a44c36909b5bdcd2
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-07-30T194625Z-codex-no-skill-3/workspace/plan.md
@@ -0,0 +1,136 @@
+# Resale marketplace plan
+
+## Recommendation
+
+Build the collection's own-site experience on a deployed, audited NFT order
+protocol (for example, Seaport), rather than write a custody or marketplace
+contract in four weeks. The site creates signed ERC-721 sell orders; it shows
+and fulfils only orders containing these exact proceeds:
+
+| Recipient | Share of a 0.4 ETH sale |
+| --- | ---: |
+| Seller | 97.5% / 0.39 ETH |
+| Artist royalty wallet | 2.5% / 0.01 ETH |
+
+The token stays in the holder's wallet while listed. At purchase, the protocol
+atomically transfers token #3312 to the buyer and sends ETH to seller and
+artist. A seller cancels through the protocol's on-chain cancellation; a sale
+also fails safely if the seller transferred the token, revoked approval, or the
+order expired.
+
+This enforces 2.5% only for trades executed through this site. An already
+minted, conventional mainnet ERC-721 cannot generally force royalties on
+transfers or sales through other marketplaces. State this plainly in product
+copy; do not claim collection-wide royalty enforcement.
+
+## Fixed launch scope
+
+- One existing Ethereum-mainnet ERC-721 collection; ERC-721 transfers only.
+- Native ETH fixed-price listings only. No offers, auctions, bids, bundles,
+  ERC-20 payments, trait pricing, private sales, or cross-chain support.
+- Wallet connect; list, sign, browse, buy, cancel; transaction history/status.
+- Off-chain index/API stores signed orders and discovery metadata only. Chain
+  events and current on-chain ownership/approval are authoritative.
+- A collection allowlist, fixed artist payout address, and fixed 250 basis-point
+  royalty rule in server-side order construction/validation. Reject any order
+  not matching every required field before display or fulfilment.
+- No platform fee at launch. This removes another payout and policy surface.
+
+Use the protocol's official mainnet deployment and SDK, pinned to exact
+versions and contract addresses. Do not deploy a wrapper, escrow, proxy,
+upgradeable contract, payment splitter, or custom royalty contract. A custom
+contract makes the deadline and single audit materially riskier.
+
+## Required flow and security rules
+
+1. Before signing, the UI verifies `ownerOf(tokenId)`, warns about the required
+   token approval, and displays the complete payout breakdown.
+2. The signed order offers exactly one collection token and requests exactly two
+   ETH consideration items: seller 9,750 bps and artist 250 bps. It has a
+   short, explicit expiry and a unique order salt.
+3. The API independently decodes and validates submitted orders; it never
+   accepts a client-provided royalty amount, recipient, collection, or chain.
+4. Search results are advisory. Before enabling Buy, refresh order status,
+   owner, approval, expiry, and full consideration from chain. The fulfilment
+   transaction remains the final authority.
+5. Buy uses the protocol's atomic fulfilment call with the exact ETH value.
+   The UI handles replacement, revert, already-filled, cancelled, expired, and
+   approval-revoked outcomes without saying a purchase succeeded early.
+6. Cancel calls the protocol's cancellation mechanism using the seller wallet;
+   alternatively an owner may invalidate via transfer/revoking approval, but
+   cancellation is the clear supported path. Remove cancelled/filled orders
+   from discovery from indexed events, not only an API flag.
+7. Never ask users to approve an unknown contract, sign arbitrary typed data,
+   or send ETH to a backend. Display protocol address, token ID, price,
+   seller, artist wallet, expiry, and network in the signing/buy review.
+
+Decide before implementation whether royalties must be enforced against an
+owner who uses another marketplace. If yes, stop: that is not achievable as a
+site-only feature for a typical already-deployed ERC-721 and needs a separate
+collection-contract/migration design and security review.
+
+## Four-week delivery plan
+
+| Week | Deliverable and gate |
+| --- | --- |
+| 1 | Inspect the live NFT contract on a mainnet fork: ownership, transfer behavior, approval APIs, token IDs, pausability, royalties, and known special cases. Freeze protocol/deployment/SDK versions. Write threat model, order schema, payout rules, and acceptance tests. Build a small end-to-end prototype against a test collection. |
+| 2 | Implement wallet flows and strictly validating order API/indexer. Build list, browse, buy, cancel screens. Add unit tests for all validator failures and protocol SDK/order encoding. |
+| 3 | Mainnet-fork integration tests for success and every invalidation path: fill, cancel, transfer-after-list, approval revoke, expiry, wrong chain, wrong collection/token, altered payout, duplicate submission, and concurrent buys. Do manual wallet/browser testing and freeze code/config/docs by week end. |
+| 4 | Send the frozen package to the auditor immediately. Triage findings, fix only agreed findings, rerun all tests and a fork smoke test, and obtain auditor retest/sign-off before mainnet release. Prepare monitoring, incident contacts, and a disabled-by-default launch switch. |
+
+Four weeks is realistic for this deliberately narrow integration if the NFT
+behaves like a standard transferable ERC-721 and the auditor can start in week
+4. It is realistic for a staging-ready build, not a guaranteed mainnet launch:
+one end-of-schedule audit pass leaves no reliable remediation buffer. Do not
+launch on a report containing unresolved high/medium findings, or without a
+retest of fixes. If the audit cannot include retest, reserve a fifth week for
+remediation and verification.
+
+## Audit scope package
+
+Send one frozen, tagged repository and deployment manifest. The audit covers
+the integration and its assumptions; it does not ask the auditor to re-audit
+the external protocol's entire codebase.
+
+- Exact protocol contract addresses, chain ID, SDK/package versions, commit
+  hashes, ABIs, and links to the protocol's existing audits; assert no custom
+  Solidity is deployed.
+- The live NFT contract address, verified source/ABI, deployment details, and
+  a short compatibility report for `ownerOf`, approvals, transfers, pauses,
+  operator filtering, token restrictions, and any existing royalty behavior.
+- Threat model and trust-boundary diagram: buyer, seller, artist wallet,
+  frontend, API/indexer, wallet provider, external protocol, and chain event
+  source. Include assumptions and out-of-scope risks.
+- Exact typed-data/order schema plus examples for a valid listing and each
+  rejected variation. Specify the invariant: collection/token/chain match;
+  seller receives 9,750 bps; artist wallet receives 250 bps; total ETH equals
+  the displayed price; no other consideration is accepted.
+- Source for frontend, API, order decoder/validator, indexer, configuration,
+  infrastructure-as-code, CI, and deployment scripts. Secrets are excluded,
+  but document secret locations, key rotation, RPC/provider trust, access
+  controls, and production environment variables.
+- Test evidence: unit, integration, and mainnet-fork results; test-wallet
+  addresses; reproducible commands; coverage; and manual test checklist.
+- All user-signing and transaction payloads/screenshots, including approval,
+  listing, purchase, cancellation, wrong-network, and failed-transaction UI.
+  The reviewer should check phishing/confused-deputy risks as well as code.
+- Operational runbook: event reconciliation/reorg handling, stale-listing
+  policy, monitoring/alerts, rate limits, API abuse controls, incident owner,
+  rollback/feature-disable plan, and disclosure contact.
+
+## Audit acceptance criteria
+
+The auditor must be able to reproduce that a valid fill transfers exactly the
+listed NFT and splits ETH 97.5%/2.5%; no accepted order can redirect the artist
+share; cancelled, filled, expired, unapproved, transferred, or wrong-chain
+orders cannot be bought; the backend cannot take custody or fabricate a valid
+seller signature; and stale/off-chain data cannot cause a buyer to overpay or
+buy a different token. Any deviation blocks launch.
+
+## Ownership
+
+The Solidity developer owns protocol integration, fork tests, deployment
+manifest, and remediation. A product/frontend owner owns the signing copy,
+artist-wallet verification, support workflow, and launch switch. Before audit,
+the artist verifies the royalty address from an independent channel and signs
+off on the immutable 2.5% policy.

exec
/bin/bash -lc "test -s plan.md && sed -n '1,260p' plan.md" in /home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T194625Z-codex-no-skill-3/workspace
 succeeded in 0ms:
# Resale marketplace plan

## Recommendation

Build the collection's own-site experience on a deployed, audited NFT order
protocol (for example, Seaport), rather than write a custody or marketplace
contract in four weeks. The site creates signed ERC-721 sell orders; it shows
and fulfils only orders containing these exact proceeds:

| Recipient | Share of a 0.4 ETH sale |
| --- | ---: |
| Seller | 97.5% / 0.39 ETH |
| Artist royalty wallet | 2.5% / 0.01 ETH |

The token stays in the holder's wallet while listed. At purchase, the protocol
atomically transfers token #3312 to the buyer and sends ETH to seller and
artist. A seller cancels through the protocol's on-chain cancellation; a sale
also fails safely if the seller transferred the token, revoked approval, or the
order expired.

This enforces 2.5% only for trades executed through this site. An already
minted, conventional mainnet ERC-721 cannot generally force royalties on
transfers or sales through other marketplaces. State this plainly in product
copy; do not claim collection-wide royalty enforcement.

## Fixed launch scope

- One existing Ethereum-mainnet ERC-721 collection; ERC-721 transfers only.
- Native ETH fixed-price listings only. No offers, auctions, bids, bundles,
  ERC-20 payments, trait pricing, private sales, or cross-chain support.
- Wallet connect; list, sign, browse, buy, cancel; transaction history/status.
- Off-chain index/API stores signed orders and discovery metadata only. Chain
  events and current on-chain ownership/approval are authoritative.
- A collection allowlist, fixed artist payout address, and fixed 250 basis-point
  royalty rule in server-side order construction/validation. Reject any order
  not matching every required field before display or fulfilment.
- No platform fee at launch. This removes another payout and policy surface.

Use the protocol's official mainnet deployment and SDK, pinned to exact
versions and contract addresses. Do not deploy a wrapper, escrow, proxy,
upgradeable contract, payment splitter, or custom royalty contract. A custom
contract makes the deadline and single audit materially riskier.

## Required flow and security rules

1. Before signing, the UI verifies `ownerOf(tokenId)`, warns about the required
   token approval, and displays the complete payout breakdown.
2. The signed order offers exactly one collection token and requests exactly two
   ETH consideration items: seller 9,750 bps and artist 250 bps. It has a
   short, explicit expiry and a unique order salt.
3. The API independently decodes and validates submitted orders; it never
   accepts a client-provided royalty amount, recipient, collection, or chain.
4. Search results are advisory. Before enabling Buy, refresh order status,
   owner, approval, expiry, and full consideration from chain. The fulfilment
   transaction remains the final authority.
5. Buy uses the protocol's atomic fulfilment call with the exact ETH value.
   The UI handles replacement, revert, already-filled, cancelled, expired, and
   approval-revoked outcomes without saying a purchase succeeded early.
6. Cancel calls the protocol's cancellation mechanism using the seller wallet;
   alternatively an owner may invalidate via transfer/revoking approval, but
   cancellation is the clear supported path. Remove cancelled/filled orders
   from discovery from indexed events, not only an API flag.
7. Never ask users to approve an unknown contract, sign arbitrary typed data,
   or send ETH to a backend. Display protocol address, token ID, price,
   seller, artist wallet, expiry, and network in the signing/buy review.

Decide before implementation whether royalties must be enforced against an
owner who uses another marketplace. If yes, stop: that is not achievable as a
site-only feature for a typical already-deployed ERC-721 and needs a separate
collection-contract/migration design and security review.

## Four-week delivery plan

| Week | Deliverable and gate |
| --- | --- |
| 1 | Inspect the live NFT contract on a mainnet fork: ownership, transfer behavior, approval APIs, token IDs, pausability, royalties, and known special cases. Freeze protocol/deployment/SDK versions. Write threat model, order schema, payout rules, and acceptance tests. Build a small end-to-end prototype against a test collection. |
| 2 | Implement wallet flows and strictly validating order API/indexer. Build list, browse, buy, cancel screens. Add unit tests for all validator failures and protocol SDK/order encoding. |
| 3 | Mainnet-fork integration tests for success and every invalidation path: fill, cancel, transfer-after-list, approval revoke, expiry, wrong chain, wrong collection/token, altered payout, duplicate submission, and concurrent buys. Do manual wallet/browser testing and freeze code/config/docs by week end. |
| 4 | Send the frozen package to the auditor immediately. Triage findings, fix only agreed findings, rerun all tests and a fork smoke test, and obtain auditor retest/sign-off before mainnet release. Prepare monitoring, incident contacts, and a disabled-by-default launch switch. |

Four weeks is realistic for this deliberately narrow integration if the NFT
behaves like a standard transferable ERC-721 and the auditor can start in week
4. It is realistic for a staging-ready build, not a guaranteed mainnet launch:
one end-of-schedule audit pass leaves no reliable remediation buffer. Do not
launch on a report containing unresolved high/medium findings, or without a
retest of fixes. If the audit cannot include retest, reserve a fifth week for
remediation and verification.

## Audit scope package

Send one frozen, tagged repository and deployment manifest. The audit covers
the integration and its assumptions; it does not ask the auditor to re-audit
the external protocol's entire codebase.

- Exact protocol contract addresses, chain ID, SDK/package versions, commit
  hashes, ABIs, and links to the protocol's existing audits; assert no custom
  Solidity is deployed.
- The live NFT contract address, verified source/ABI, deployment details, and
  a short compatibility report for `ownerOf`, approvals, transfers, pauses,
  operator filtering, token restrictions, and any existing royalty behavior.
- Threat model and trust-boundary diagram: buyer, seller, artist wallet,
  frontend, API/indexer, wallet provider, external protocol, and chain event
  source. Include assumptions and out-of-scope risks.
- Exact typed-data/order schema plus examples for a valid listing and each
  rejected variation. Specify the invariant: collection/token/chain match;
  seller receives 9,750 bps; artist wallet receives 250 bps; total ETH equals
  the displayed price; no other consideration is accepted.
- Source for frontend, API, order decoder/validator, indexer, configuration,
  infrastructure-as-code, CI, and deployment scripts. Secrets are excluded,
  but document secret locations, key rotation, RPC/provider trust, access
  controls, and production environment variables.
- Test evidence: unit, integration, and mainnet-fork results; test-wallet
  addresses; reproducible commands; coverage; and manual test checklist.
- All user-signing and transaction payloads/screenshots, including approval,
  listing, purchase, cancellation, wrong-network, and failed-transaction UI.
  The reviewer should check phishing/confused-deputy risks as well as code.
- Operational runbook: event reconciliation/reorg handling, stale-listing
  policy, monitoring/alerts, rate limits, API abuse controls, incident owner,
  rollback/feature-disable plan, and disclosure contact.

## Audit acceptance criteria

The auditor must be able to reproduce that a valid fill transfers exactly the
listed NFT and splits ETH 97.5%/2.5%; no accepted order can redirect the artist
share; cancelled, filled, expired, unapproved, transferred, or wrong-chain
orders cannot be bought; the backend cannot take custody or fabricate a valid
seller signature; and stale/off-chain data cannot cause a buyer to overpay or
buy a different token. Any deviation blocks launch.

## Ownership

The Solidity developer owns protocol integration, fork tests, deployment
manifest, and remediation. A product/frontend owner owns the signing copy,
artist-wallet verification, support workflow, and launch switch. Before audit,
the artist verifies the royalty address from an independent channel and signs
off on the immutable 2.5% policy.

diff --git a/artifacts/ship-quiz-001/2026-07-30T194625Z-codex-no-skill-3/workspace/plan.md b/artifacts/ship-quiz-001/2026-07-30T194625Z-codex-no-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..0e98cb0518b2433eeb7cdf11a44c36909b5bdcd2
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-07-30T194625Z-codex-no-skill-3/workspace/plan.md
@@ -0,0 +1,136 @@
+# Resale marketplace plan
+
+## Recommendation
+
+Build the collection's own-site experience on a deployed, audited NFT order
+protocol (for example, Seaport), rather than write a custody or marketplace
+contract in four weeks. The site creates signed ERC-721 sell orders; it shows
+and fulfils only orders containing these exact proceeds:
+
+| Recipient | Share of a 0.4 ETH sale |
+| --- | ---: |
+| Seller | 97.5% / 0.39 ETH |
+| Artist royalty wallet | 2.5% / 0.01 ETH |
+
+The token stays in the holder's wallet while listed. At purchase, the protocol
+atomically transfers token #3312 to the buyer and sends ETH to seller and
+artist. A seller cancels through the protocol's on-chain cancellation; a sale
+also fails safely if the seller transferred the token, revoked approval, or the
+order expired.
+
+This enforces 2.5% only for trades executed through this site. An already
+minted, conventional mainnet ERC-721 cannot generally force royalties on
+transfers or sales through other marketplaces. State this plainly in product
+copy; do not claim collection-wide royalty enforcement.
+
+## Fixed launch scope
+
+- One existing Ethereum-mainnet ERC-721 collection; ERC-721 transfers only.
+- Native ETH fixed-price listings only. No offers, auctions, bids, bundles,
+  ERC-20 payments, trait pricing, private sales, or cross-chain support.
+- Wallet connect; list, sign, browse, buy, cancel; transaction history/status.
+- Off-chain index/API stores signed orders and discovery metadata only. Chain
+  events and current on-chain ownership/approval are authoritative.
+- A collection allowlist, fixed artist payout address, and fixed 250 basis-point
+  royalty rule in server-side order construction/validation. Reject any order
+  not matching every required field before display or fulfilment.
+- No platform fee at launch. This removes another payout and policy surface.
+
+Use the protocol's official mainnet deployment and SDK, pinned to exact
+versions and contract addresses. Do not deploy a wrapper, escrow, proxy,
+upgradeable contract, payment splitter, or custom royalty contract. A custom
+contract makes the deadline and single audit materially riskier.
+
+## Required flow and security rules
+
+1. Before signing, the UI verifies `ownerOf(tokenId)`, warns about the required
+   token approval, and displays the complete payout breakdown.
+2. The signed order offers exactly one collection token and requests exactly two
+   ETH consideration items: seller 9,750 bps and artist 250 bps. It has a
+   short, explicit expiry and a unique order salt.
+3. The API independently decodes and validates submitted orders; it never
+   accepts a client-provided royalty amount, recipient, collection, or chain.
+4. Search results are advisory. Before enabling Buy, refresh order status,
+   owner, approval, expiry, and full consideration from chain. The fulfilment
+   transaction remains the final authority.
+5. Buy uses the protocol's atomic fulfilment call with the exact ETH value.
+   The UI handles replacement, revert, already-filled, cancelled, expired, and
+   approval-revoked outcomes without saying a purchase succeeded early.
+6. Cancel calls the protocol's cancellation mechanism using the seller wallet;
+   alternatively an owner may invalidate via transfer/revoking approval, but
+   cancellation is the clear supported path. Remove cancelled/filled orders
+   from discovery from indexed events, not only an API flag.
+7. Never ask users to approve an unknown contract, sign arbitrary typed data,
+   or send ETH to a backend. Display protocol address, token ID, price,
+   seller, artist wallet, expiry, and network in the signing/buy review.
+
+Decide before implementation whether royalties must be enforced against an
+owner who uses another marketplace. If yes, stop: that is not achievable as a
+site-only feature for a typical already-deployed ERC-721 and needs a separate
+collection-contract/migration design and security review.
+
+## Four-week delivery plan
+
+| Week | Deliverable and gate |
+| --- | --- |
+| 1 | Inspect the live NFT contract on a mainnet fork: ownership, transfer behavior, approval APIs, token IDs, pausability, royalties, and known special cases. Freeze protocol/deployment/SDK versions. Write threat model, order schema, payout rules, and acceptance tests. Build a small end-to-end prototype against a test collection. |
+| 2 | Implement wallet flows and strictly validating order API/indexer. Build list, browse, buy, cancel screens. Add unit tests for all validator failures and protocol SDK/order encoding. |
+| 3 | Mainnet-fork integration tests for success and every invalidation path: fill, cancel, transfer-after-list, approval revoke, expiry, wrong chain, wrong collection/token, altered payout, duplicate submission, and concurrent buys. Do manual wallet/browser testing and freeze code/config/docs by week end. |
+| 4 | Send the frozen package to the auditor immediately. Triage findings, fix only agreed findings, rerun all tests and a fork smoke test, and obtain auditor retest/sign-off before mainnet release. Prepare monitoring, incident contacts, and a disabled-by-default launch switch. |
+
+Four weeks is realistic for this deliberately narrow integration if the NFT
+behaves like a standard transferable ERC-721 and the auditor can start in week
+4. It is realistic for a staging-ready build, not a guaranteed mainnet launch:
+one end-of-schedule audit pass leaves no reliable remediation buffer. Do not
+launch on a report containing unresolved high/medium findings, or without a
+retest of fixes. If the audit cannot include retest, reserve a fifth week for
+remediation and verification.
+
+## Audit scope package
+
+Send one frozen, tagged repository and deployment manifest. The audit covers
+the integration and its assumptions; it does not ask the auditor to re-audit
+the external protocol's entire codebase.
+
+- Exact protocol contract addresses, chain ID, SDK/package versions, commit
+  hashes, ABIs, and links to the protocol's existing audits; assert no custom
+  Solidity is deployed.
+- The live NFT contract address, verified source/ABI, deployment details, and
+  a short compatibility report for `ownerOf`, approvals, transfers, pauses,
+  operator filtering, token restrictions, and any existing royalty behavior.
+- Threat model and trust-boundary diagram: buyer, seller, artist wallet,
+  frontend, API/indexer, wallet provider, external protocol, and chain event
+  source. Include assumptions and out-of-scope risks.
+- Exact typed-data/order schema plus examples for a valid listing and each
+  rejected variation. Specify the invariant: collection/token/chain match;
+  seller receives 9,750 bps; artist wallet receives 250 bps; total ETH equals
+  the displayed price; no other consideration is accepted.
+- Source for frontend, API, order decoder/validator, indexer, configuration,
+  infrastructure-as-code, CI, and deployment scripts. Secrets are excluded,
+  but document secret locations, key rotation, RPC/provider trust, access
+  controls, and production environment variables.
+- Test evidence: unit, integration, and mainnet-fork results; test-wallet
+  addresses; reproducible commands; coverage; and manual test checklist.
+- All user-signing and transaction payloads/screenshots, including approval,
+  listing, purchase, cancellation, wrong-network, and failed-transaction UI.
+  The reviewer should check phishing/confused-deputy risks as well as code.
+- Operational runbook: event reconciliation/reorg handling, stale-listing
+  policy, monitoring/alerts, rate limits, API abuse controls, incident owner,
+  rollback/feature-disable plan, and disclosure contact.
+
+## Audit acceptance criteria
+
+The auditor must be able to reproduce that a valid fill transfers exactly the
+listed NFT and splits ETH 97.5%/2.5%; no accepted order can redirect the artist
+share; cancelled, filled, expired, unapproved, transferred, or wrong-chain
+orders cannot be bought; the backend cannot take custody or fabricate a valid
+seller signature; and stale/off-chain data cannot cause a buyer to overpay or
+buy a different token. Any deviation blocks launch.
+
+## Ownership
+
+The Solidity developer owns protocol integration, fork tests, deployment
+manifest, and remediation. A product/frontend owner owns the signing copy,
+artist-wallet verification, support workflow, and launch switch. Before audit,
+the artist verifies the royalty address from an independent channel and signs
+off on the immutable 2.5% policy.

codex
Wrote [plan.md](/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T194625Z-codex-no-skill-3/workspace/plan.md).

Recommendation: protocol integration, no custom marketplace contract. Four weeks = staging-ready; reserve remediation/retest before mainnet launch.
diff --git a/artifacts/ship-quiz-001/2026-07-30T194625Z-codex-no-skill-3/workspace/plan.md b/artifacts/ship-quiz-001/2026-07-30T194625Z-codex-no-skill-3/workspace/plan.md
new file mode 100644
index 0000000000000000000000000000000000000000..0e98cb0518b2433eeb7cdf11a44c36909b5bdcd2
--- /dev/null
+++ b/artifacts/ship-quiz-001/2026-07-30T194625Z-codex-no-skill-3/workspace/plan.md
@@ -0,0 +1,136 @@
+# Resale marketplace plan
+
+## Recommendation
+
+Build the collection's own-site experience on a deployed, audited NFT order
+protocol (for example, Seaport), rather than write a custody or marketplace
+contract in four weeks. The site creates signed ERC-721 sell orders; it shows
+and fulfils only orders containing these exact proceeds:
+
+| Recipient | Share of a 0.4 ETH sale |
+| --- | ---: |
+| Seller | 97.5% / 0.39 ETH |
+| Artist royalty wallet | 2.5% / 0.01 ETH |
+
+The token stays in the holder's wallet while listed. At purchase, the protocol
+atomically transfers token #3312 to the buyer and sends ETH to seller and
+artist. A seller cancels through the protocol's on-chain cancellation; a sale
+also fails safely if the seller transferred the token, revoked approval, or the
+order expired.
+
+This enforces 2.5% only for trades executed through this site. An already
+minted, conventional mainnet ERC-721 cannot generally force royalties on
+transfers or sales through other marketplaces. State this plainly in product
+copy; do not claim collection-wide royalty enforcement.
+
+## Fixed launch scope
+
+- One existing Ethereum-mainnet ERC-721 collection; ERC-721 transfers only.
+- Native ETH fixed-price listings only. No offers, auctions, bids, bundles,
+  ERC-20 payments, trait pricing, private sales, or cross-chain support.
+- Wallet connect; list, sign, browse, buy, cancel; transaction history/status.
+- Off-chain index/API stores signed orders and discovery metadata only. Chain
+  events and current on-chain ownership/approval are authoritative.
+- A collection allowlist, fixed artist payout address, and fixed 250 basis-point
+  royalty rule in server-side order construction/validation. Reject any order
+  not matching every required field before display or fulfilment.
+- No platform fee at launch. This removes another payout and policy surface.
+
+Use the protocol's official mainnet deployment and SDK, pinned to exact
+versions and contract addresses. Do not deploy a wrapper, escrow, proxy,
+upgradeable contract, payment splitter, or custom royalty contract. A custom
+contract makes the deadline and single audit materially riskier.
+
+## Required flow and security rules
+
+1. Before signing, the UI verifies `ownerOf(tokenId)`, warns about the required
+   token approval, and displays the complete payout breakdown.
+2. The signed order offers exactly one collection token and requests exactly two
+   ETH consideration items: seller 9,750 bps and artist 250 bps. It has a
+   short, explicit expiry and a unique order salt.
+3. The API independently decodes and validates submitted orders; it never
+   accepts a client-provided royalty amount, recipient, collection, or chain.
+4. Search results are advisory. Before enabling Buy, refresh order status,
+   owner, approval, expiry, and full consideration from chain. The fulfilment
+   transaction remains the final authority.
+5. Buy uses the protocol's atomic fulfilment call with the exact ETH value.
+   The UI handles replacement, revert, already-filled, cancelled, expired, and
+   approval-revoked outcomes without saying a purchase succeeded early.
+6. Cancel calls the protocol's cancellation mechanism using the seller wallet;
+   alternatively an owner may invalidate via transfer/revoking approval, but
+   cancellation is the clear supported path. Remove cancelled/filled orders
+   from discovery from indexed events, not only an API flag.
+7. Never ask users to approve an unknown contract, sign arbitrary typed data,
+   or send ETH to a backend. Display protocol address, token ID, price,
+   seller, artist wallet, expiry, and network in the signing/buy review.
+
+Decide before implementation whether royalties must be enforced against an
+owner who uses another marketplace. If yes, stop: that is not achievable as a
+site-only feature for a typical already-deployed ERC-721 and needs a separate
+collection-contract/migration design and security review.
+
+## Four-week delivery plan
+
+| Week | Deliverable and gate |
+| --- | --- |
+| 1 | Inspect the live NFT contract on a mainnet fork: ownership, transfer behavior, approval APIs, token IDs, pausability, royalties, and known special cases. Freeze protocol/deployment/SDK versions. Write threat model, order schema, payout rules, and acceptance tests. Build a small end-to-end prototype against a test collection. |
+| 2 | Implement wallet flows and strictly validating order API/indexer. Build list, browse, buy, cancel screens. Add unit tests for all validator failures and protocol SDK/order encoding. |
+| 3 | Mainnet-fork integration tests for success and every invalidation path: fill, cancel, transfer-after-list, approval revoke, expiry, wrong chain, wrong collection/token, altered payout, duplicate submission, and concurrent buys. Do manual wallet/browser testing and freeze code/config/docs by week end. |
+| 4 | Send the frozen package to the auditor immediately. Triage findings, fix only agreed findings, rerun all tests and a fork smoke test, and obtain auditor retest/sign-off before mainnet release. Prepare monitoring, incident contacts, and a disabled-by-default launch switch. |
+
+Four weeks is realistic for this deliberately narrow integration if the NFT
+behaves like a standard transferable ERC-721 and the auditor can start in week
+4. It is realistic for a staging-ready build, not a guaranteed mainnet launch:
+one end-of-schedule audit pass leaves no reliable remediation buffer. Do not
+launch on a report containing unresolved high/medium findings, or without a
+retest of fixes. If the audit cannot include retest, reserve a fifth week for
+remediation and verification.
+
+## Audit scope package
+
+Send one frozen, tagged repository and deployment manifest. The audit covers
+the integration and its assumptions; it does not ask the auditor to re-audit
+the external protocol's entire codebase.
+
+- Exact protocol contract addresses, chain ID, SDK/package versions, commit
+  hashes, ABIs, and links to the protocol's existing audits; assert no custom
+  Solidity is deployed.
+- The live NFT contract address, verified source/ABI, deployment details, and
+  a short compatibility report for `ownerOf`, approvals, transfers, pauses,
+  operator filtering, token restrictions, and any existing royalty behavior.
+- Threat model and trust-boundary diagram: buyer, seller, artist wallet,
+  frontend, API/indexer, wallet provider, external protocol, and chain event
+  source. Include assumptions and out-of-scope risks.
+- Exact typed-data/order schema plus examples for a valid listing and each
+  rejected variation. Specify the invariant: collection/token/chain match;
+  seller receives 9,750 bps; artist wallet receives 250 bps; total ETH equals
+  the displayed price; no other consideration is accepted.
+- Source for frontend, API, order decoder/validator, indexer, configuration,
+  infrastructure-as-code, CI, and deployment scripts. Secrets are excluded,
+  but document secret locations, key rotation, RPC/provider trust, access
+  controls, and production environment variables.
+- Test evidence: unit, integration, and mainnet-fork results; test-wallet
+  addresses; reproducible commands; coverage; and manual test checklist.
+- All user-signing and transaction payloads/screenshots, including approval,
+  listing, purchase, cancellation, wrong-network, and failed-transaction UI.
+  The reviewer should check phishing/confused-deputy risks as well as code.
+- Operational runbook: event reconciliation/reorg handling, stale-listing
+  policy, monitoring/alerts, rate limits, API abuse controls, incident owner,
+  rollback/feature-disable plan, and disclosure contact.
+
+## Audit acceptance criteria
+
+The auditor must be able to reproduce that a valid fill transfers exactly the
+listed NFT and splits ETH 97.5%/2.5%; no accepted order can redirect the artist
+share; cancelled, filled, expired, unapproved, transferred, or wrong-chain
+orders cannot be bought; the backend cannot take custody or fabricate a valid
+seller signature; and stale/off-chain data cannot cause a buyer to overpay or
+buy a different token. Any deviation blocks launch.
+
+## Ownership
+
+The Solidity developer owns protocol integration, fork tests, deployment
+manifest, and remediation. A product/frontend owner owns the signing copy,
+artist-wallet verification, support workflow, and launch switch. Before audit,
+the artist verifies the royalty address from an independent channel and signs
+off on the immutable 2.5% policy.

tokens used
17,224
Wrote [plan.md](/home/matt/Code/BuidlGuidl/ethskills-evals/artifacts/ship-quiz-001/2026-07-30T194625Z-codex-no-skill-3/workspace/plan.md).

Recommendation: protocol integration, no custom marketplace contract. Four weeks = staging-ready; reserve remediation/retest before mainnet launch.
