# Executor transcript — 2026-09-04T155031Z-codex-no-skill-1

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-audit-eval/2026-09-04T155031Z-codex-no-skill-1/audit-quiz-001

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-audit-eval/2026-09-04T155031Z-codex-no-skill-1/audit-quiz-001
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a06d20-d692-7b73-b368-50a2fd6724a2
--------
user
Post-mortem, and I am stuck on it.

We run a lending market on Arbitrum One. Collateral is wstETH, debt is USDC,
positions are liquidatable below 125% collateralisation.

Last Tuesday, from 09:14 to 12:40 UTC, our users could not reach the chain.
Transactions submitted from the app sat unconfirmed and the explorer showed
no new blocks for three and a half hours. Everywhere else trading carried on:
ETH fell 11% over that window on Binance and on mainnet DEXes.

At 12:41, in the first blocks after service came back, keeper bots liquidated
38 positions in one sweep. Every one of those borrowers had been trying to
add collateral since mid-morning and could not get a transaction through.

Here is the part I cannot explain. Before any price is used we already do
this:

  (, int256 answer, , uint256 updatedAt, ) = feed.latestRoundData();
  require(answer > 0, "bad price");
  require(block.timestamp - updatedAt <= 3600, "stale price");

Our collateral feed's heartbeat is 86400 seconds, so our one-hour bound is far
tighter than the feed itself promises. I pulled the round data for all 38
liquidations: the check passed every time, and the answer we read had been
published seconds earlier and matched the real market price. The price was
not stale. The math was not wrong. Our liquidation logic did exactly what it
was written to do.

Explain how 38 users lost their positions to a price they had no way to react
to, when our freshness check was working correctly the whole time. Then tell
me precisely what we change, and where in the flow it goes.

Write your answer to answer.md in this directory.

codex
I’ll inspect the repository guidance and contract context, then write a concrete post-mortem and mitigation sequence into `answer.md`.
exec
/bin/bash -lc "pwd && rg --files -g 'AGENTS.md' -g '"'!node_modules'"' -g '"'!lib'"' -g '"'!out'"' && rg -n \"latestRoundData|liquidat|collateral|wstETH|USDC\" . -g '"'!node_modules'"' -g '"'!lib'"' -g '"'!out'"'" in /tmp/ethskills-audit-eval/2026-09-04T155031Z-codex-no-skill-1/audit-quiz-001
 exited 1 in 3ms:
codex
The key distinction is already clear: oracle freshness measures the age of market data, not whether borrowers had usable chain access. I’m verifying the exact Arbitrum sequencer-uptime semantics and edge cases before drafting the required control flow.
web search: 
web search: site:docs.chain.link data-feeds l2-sequencer-feeds Arbitrum grace period startedAt answer 0 1 ...
web search: 
web search: https://docs.chain.link/data-feeds/l2-sequencer-feeds
codex
I’m turning the finding into an actionable design: a sequencer-status gate and post-recovery grace period on adverse actions, while keeping rescue actions such as deposit and repay available. The existing price-age check remains, because it protects a different failure mode.
apply patch
patch: completed
/tmp/ethskills-audit-eval/2026-09-04T155031Z-codex-no-skill-1/audit-quiz-001/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..99f7acdbcafe0d5cf1b132607d30085559fbc1c7
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,102 @@
+# Post-mortem: liquidations immediately after Arbitrum sequencer recovery
+
+## What happened
+
+The freshness check worked, but it checked the wrong kind of liveness for this incident.
+
+`updatedAt` answers: **how recently did the oracle publish this price?** It does not answer: **how recently could an ordinary borrower get a transaction included on Arbitrum?** Those clocks can diverge.
+
+During the outage, Arbitrum's sequencer stopped producing blocks and ordinary users could not execute collateral deposits. Meanwhile, price discovery continued elsewhere and ETH fell 11%. Once sequencing resumed, the oracle could publish the current lower price immediately. That new round had an `updatedAt` only seconds old, so the one-hour price-age test correctly passed. It also correctly reflected the accumulated off-chain/mainnet price move.
+
+The first post-recovery block therefore combined two facts:
+
+1. borrowers had been unable to improve their positions for roughly 3.5 hours; and
+2. the protocol could suddenly observe the full current price decline.
+
+The keepers and borrowers were then racing from unequal starting positions. Keepers could submit prebuilt, automated liquidation transactions as soon as service returned, while users needed their rescue transactions to be accepted and ordered first. The protocol had no rule giving users time to react after chain access returned. Thus the liquidations were valid under the implemented rules but unfair under the intended market design.
+
+The feed heartbeat is not a remedy. A heartbeat is the maximum scheduled interval absent a sufficiently large deviation; an 11% move can trigger a fresh update immediately. Tightening the price-age bound below the heartbeat only rejects older oracle observations. It cannot detect that transaction inclusion was unavailable, and tightening it further would not create a reaction window.
+
+## Required change
+
+Integrate the Chainlink **Arbitrum Sequencer Uptime Feed** and add a post-recovery grace period. On Arbitrum One, the documented uptime-feed proxy is `0xFdB631F5EE196F0ed6FAa767959853A9F217697D`. Treat this as a separately governed/configured dependency and verify the address and interface during deployment.
+
+The uptime feed's `answer` has different semantics from a price feed:
+
+- `0` means the sequencer is up;
+- `1` means it is down; and
+- `startedAt` is when the current sequencer status began. When the answer returns to `0`, it is the recovery time from which the grace period is measured.
+
+Use a protocol-chosen grace period long enough for users to regain RPC access and have rescue transactions included. One hour is a reasonable initial minimum, but it is a risk parameter, not an oracle-heartbeat parameter. It should be set through governance based on the desired borrower reaction window.
+
+```solidity
+AggregatorV3Interface public immutable priceFeed;
+AggregatorV3Interface public immutable sequencerUptimeFeed;
+
+uint256 public constant MAX_PRICE_AGE = 1 hours;
+uint256 public constant SEQUENCER_GRACE_PERIOD = 1 hours;
+
+error SequencerDown();
+error SequencerFeedUninitialized();
+error SequencerGracePeriodActive();
+error InvalidPrice();
+error StalePrice();
+
+function _requireLiquidationsAvailable() internal view {
+    (, int256 status, uint256 startedAt,,) =
+        sequencerUptimeFeed.latestRoundData();
+
+    // Fail closed for liquidations on an unknown value or while down.
+    if (status != 0) revert SequencerDown();
+
+    // On Arbitrum, startedAt == 0 can mean that the uptime feed has not
+    // initialized. Do not interpret that as a very long period of uptime.
+    if (startedAt == 0 || startedAt > block.timestamp) {
+        revert SequencerFeedUninitialized();
+    }
+
+    if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) {
+        revert SequencerGracePeriodActive();
+    }
+}
+
+function _readPriceForLiquidation() internal view returns (uint256) {
+    _requireLiquidationsAvailable();
+
+    (, int256 answer,, uint256 updatedAt,) = priceFeed.latestRoundData();
+    if (answer <= 0) revert InvalidPrice();
+    if (updatedAt == 0 || updatedAt > block.timestamp) revert StalePrice();
+    if (block.timestamp - updatedAt > MAX_PRICE_AGE) revert StalePrice();
+
+    return uint256(answer);
+}
+```
+
+## Where the check belongs
+
+Put the sequencer/grace check in the on-chain liquidation execution path, **before reading the price, testing collateralisation, transferring collateral, or changing debt**. Every liquidation entry point—including batch liquidation, callbacks, and alternate keeper routes—must pass through the same internal gate. A UI warning or a keeper-side check is insufficient because it is bypassable.
+
+The resulting liquidation flow is:
+
+```text
+liquidate / batchLiquidate
+    -> require uptime feed initialized
+    -> require sequencer status == up
+    -> require now > recovery startedAt + grace period
+    -> validate price answer and price age
+    -> calculate collateral ratio
+    -> execute liquidation
+```
+
+Apply the same fail-closed gate to other **risk-increasing/adverse** operations that depend on a live market price, especially borrowing more collateral value or withdrawing collateral. Do **not** put it in a shared modifier that also blocks protective actions. Depositing collateral and repaying debt should remain available whenever the chain can execute them, including during the recovery grace period. Otherwise the mitigation itself prevents users from becoming safe.
+
+Keep the existing price validation after the sequencer check. The controls are complementary:
+
+- the uptime/grace check protects fair access and reaction time after an L2 outage;
+- the price-age and positive-answer checks protect oracle validity and freshness.
+
+Operationally, monitoring should pause keeper submissions when the uptime feed reports down and alert on recovery, but correctness must not depend on that monitoring. Add fork/integration tests for: status `1`; unknown status; `startedAt == 0`; future `startedAt`; exactly the grace-period boundary; the first timestamp after the boundary; stale/invalid price after a healthy sequencer check; all batch and alternate liquidation entry points; and successful deposit/repay during the grace period.
+
+This change would have made the 12:41 liquidations revert. Borrowers would have had the configured grace period, beginning at sequencer recovery—not at the oracle update—to deposit collateral or repay before liquidations became executable.
+
+Sources: [Chainlink L2 Sequencer Uptime Feeds](https://docs.chain.link/data-feeds/l2-sequencer-feeds) and [Arbitrum Nitro architecture](https://docs.arbitrum.io/nitro-whitepaper.pdf).

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..99f7acdbcafe0d5cf1b132607d30085559fbc1c7
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,102 @@
+# Post-mortem: liquidations immediately after Arbitrum sequencer recovery
+
+## What happened
+
+The freshness check worked, but it checked the wrong kind of liveness for this incident.
+
+`updatedAt` answers: **how recently did the oracle publish this price?** It does not answer: **how recently could an ordinary borrower get a transaction included on Arbitrum?** Those clocks can diverge.
+
+During the outage, Arbitrum's sequencer stopped producing blocks and ordinary users could not execute collateral deposits. Meanwhile, price discovery continued elsewhere and ETH fell 11%. Once sequencing resumed, the oracle could publish the current lower price immediately. That new round had an `updatedAt` only seconds old, so the one-hour price-age test correctly passed. It also correctly reflected the accumulated off-chain/mainnet price move.
+
+The first post-recovery block therefore combined two facts:
+
+1. borrowers had been unable to improve their positions for roughly 3.5 hours; and
+2. the protocol could suddenly observe the full current price decline.
+
+The keepers and borrowers were then racing from unequal starting positions. Keepers could submit prebuilt, automated liquidation transactions as soon as service returned, while users needed their rescue transactions to be accepted and ordered first. The protocol had no rule giving users time to react after chain access returned. Thus the liquidations were valid under the implemented rules but unfair under the intended market design.
+
+The feed heartbeat is not a remedy. A heartbeat is the maximum scheduled interval absent a sufficiently large deviation; an 11% move can trigger a fresh update immediately. Tightening the price-age bound below the heartbeat only rejects older oracle observations. It cannot detect that transaction inclusion was unavailable, and tightening it further would not create a reaction window.
+
+## Required change
+
+Integrate the Chainlink **Arbitrum Sequencer Uptime Feed** and add a post-recovery grace period. On Arbitrum One, the documented uptime-feed proxy is `0xFdB631F5EE196F0ed6FAa767959853A9F217697D`. Treat this as a separately governed/configured dependency and verify the address and interface during deployment.
+
+The uptime feed's `answer` has different semantics from a price feed:
+
+- `0` means the sequencer is up;
+- `1` means it is down; and
+- `startedAt` is when the current sequencer status began. When the answer returns to `0`, it is the recovery time from which the grace period is measured.
+
+Use a protocol-chosen grace period long enough for users to regain RPC access and have rescue transactions included. One hour is a reasonable initial minimum, but it is a risk parameter, not an oracle-heartbeat parameter. It should be set through governance based on the desired borrower reaction window.
+
+```solidity
+AggregatorV3Interface public immutable priceFeed;
+AggregatorV3Interface public immutable sequencerUptimeFeed;
+
+uint256 public constant MAX_PRICE_AGE = 1 hours;
+uint256 public constant SEQUENCER_GRACE_PERIOD = 1 hours;
+
+error SequencerDown();
+error SequencerFeedUninitialized();
+error SequencerGracePeriodActive();
+error InvalidPrice();
+error StalePrice();
+
+function _requireLiquidationsAvailable() internal view {
+    (, int256 status, uint256 startedAt,,) =
+        sequencerUptimeFeed.latestRoundData();
+
+    // Fail closed for liquidations on an unknown value or while down.
+    if (status != 0) revert SequencerDown();
+
+    // On Arbitrum, startedAt == 0 can mean that the uptime feed has not
+    // initialized. Do not interpret that as a very long period of uptime.
+    if (startedAt == 0 || startedAt > block.timestamp) {
+        revert SequencerFeedUninitialized();
+    }
+
+    if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) {
+        revert SequencerGracePeriodActive();
+    }
+}
+
+function _readPriceForLiquidation() internal view returns (uint256) {
+    _requireLiquidationsAvailable();
+
+    (, int256 answer,, uint256 updatedAt,) = priceFeed.latestRoundData();
+    if (answer <= 0) revert InvalidPrice();
+    if (updatedAt == 0 || updatedAt > block.timestamp) revert StalePrice();
+    if (block.timestamp - updatedAt > MAX_PRICE_AGE) revert StalePrice();
+
+    return uint256(answer);
+}
+```
+
+## Where the check belongs
+
+Put the sequencer/grace check in the on-chain liquidation execution path, **before reading the price, testing collateralisation, transferring collateral, or changing debt**. Every liquidation entry point—including batch liquidation, callbacks, and alternate keeper routes—must pass through the same internal gate. A UI warning or a keeper-side check is insufficient because it is bypassable.
+
+The resulting liquidation flow is:
+
+```text
+liquidate / batchLiquidate
+    -> require uptime feed initialized
+    -> require sequencer status == up
+    -> require now > recovery startedAt + grace period
+    -> validate price answer and price age
+    -> calculate collateral ratio
+    -> execute liquidation
+```
+
+Apply the same fail-closed gate to other **risk-increasing/adverse** operations that depend on a live market price, especially borrowing more collateral value or withdrawing collateral. Do **not** put it in a shared modifier that also blocks protective actions. Depositing collateral and repaying debt should remain available whenever the chain can execute them, including during the recovery grace period. Otherwise the mitigation itself prevents users from becoming safe.
+
+Keep the existing price validation after the sequencer check. The controls are complementary:
+
+- the uptime/grace check protects fair access and reaction time after an L2 outage;
+- the price-age and positive-answer checks protect oracle validity and freshness.
+
+Operationally, monitoring should pause keeper submissions when the uptime feed reports down and alert on recovery, but correctness must not depend on that monitoring. Add fork/integration tests for: status `1`; unknown status; `startedAt == 0`; future `startedAt`; exactly the grace-period boundary; the first timestamp after the boundary; stale/invalid price after a healthy sequencer check; all batch and alternate liquidation entry points; and successful deposit/repay during the grace period.
+
+This change would have made the 12:41 liquidations revert. Borrowers would have had the configured grace period, beginning at sequencer recovery—not at the oracle update—to deposit collateral or repay before liquidations became executable.
+
+Sources: [Chainlink L2 Sequencer Uptime Feeds](https://docs.chain.link/data-feeds/l2-sequencer-feeds) and [Arbitrum Nitro architecture](https://docs.arbitrum.io/nitro-whitepaper.pdf).

exec
/bin/bash -lc "sed -n '1,260p' answer.md && git diff --check -- answer.md" in /tmp/ethskills-audit-eval/2026-09-04T155031Z-codex-no-skill-1/audit-quiz-001
 succeeded in 5ms:
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..99f7acdbcafe0d5cf1b132607d30085559fbc1c7
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,102 @@
+# Post-mortem: liquidations immediately after Arbitrum sequencer recovery
+
+## What happened
+
+The freshness check worked, but it checked the wrong kind of liveness for this incident.
+
+`updatedAt` answers: **how recently did the oracle publish this price?** It does not answer: **how recently could an ordinary borrower get a transaction included on Arbitrum?** Those clocks can diverge.
+
+During the outage, Arbitrum's sequencer stopped producing blocks and ordinary users could not execute collateral deposits. Meanwhile, price discovery continued elsewhere and ETH fell 11%. Once sequencing resumed, the oracle could publish the current lower price immediately. That new round had an `updatedAt` only seconds old, so the one-hour price-age test correctly passed. It also correctly reflected the accumulated off-chain/mainnet price move.
+
+The first post-recovery block therefore combined two facts:
+
+1. borrowers had been unable to improve their positions for roughly 3.5 hours; and
+2. the protocol could suddenly observe the full current price decline.
+
+The keepers and borrowers were then racing from unequal starting positions. Keepers could submit prebuilt, automated liquidation transactions as soon as service returned, while users needed their rescue transactions to be accepted and ordered first. The protocol had no rule giving users time to react after chain access returned. Thus the liquidations were valid under the implemented rules but unfair under the intended market design.
+
+The feed heartbeat is not a remedy. A heartbeat is the maximum scheduled interval absent a sufficiently large deviation; an 11% move can trigger a fresh update immediately. Tightening the price-age bound below the heartbeat only rejects older oracle observations. It cannot detect that transaction inclusion was unavailable, and tightening it further would not create a reaction window.
+
+## Required change
+
+Integrate the Chainlink **Arbitrum Sequencer Uptime Feed** and add a post-recovery grace period. On Arbitrum One, the documented uptime-feed proxy is `0xFdB631F5EE196F0ed6FAa767959853A9F217697D`. Treat this as a separately governed/configured dependency and verify the address and interface during deployment.
+
+The uptime feed's `answer` has different semantics from a price feed:
+
+- `0` means the sequencer is up;
+- `1` means it is down; and
+- `startedAt` is when the current sequencer status began. When the answer returns to `0`, it is the recovery time from which the grace period is measured.
+
+Use a protocol-chosen grace period long enough for users to regain RPC access and have rescue transactions included. One hour is a reasonable initial minimum, but it is a risk parameter, not an oracle-heartbeat parameter. It should be set through governance based on the desired borrower reaction window.
+
+```solidity
+AggregatorV3Interface public immutable priceFeed;
+AggregatorV3Interface public immutable sequencerUptimeFeed;
+
+uint256 public constant MAX_PRICE_AGE = 1 hours;
+uint256 public constant SEQUENCER_GRACE_PERIOD = 1 hours;
+
+error SequencerDown();
+error SequencerFeedUninitialized();
+error SequencerGracePeriodActive();
+error InvalidPrice();
+error StalePrice();
+
+function _requireLiquidationsAvailable() internal view {
+    (, int256 status, uint256 startedAt,,) =
+        sequencerUptimeFeed.latestRoundData();
+
+    // Fail closed for liquidations on an unknown value or while down.
+    if (status != 0) revert SequencerDown();
+
+    // On Arbitrum, startedAt == 0 can mean that the uptime feed has not
+    // initialized. Do not interpret that as a very long period of uptime.
+    if (startedAt == 0 || startedAt > block.timestamp) {
+        revert SequencerFeedUninitialized();
+    }
+
+    if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) {
+        revert SequencerGracePeriodActive();
+    }
+}
+
+function _readPriceForLiquidation() internal view returns (uint256) {
+    _requireLiquidationsAvailable();
+
+    (, int256 answer,, uint256 updatedAt,) = priceFeed.latestRoundData();
+    if (answer <= 0) revert InvalidPrice();
+    if (updatedAt == 0 || updatedAt > block.timestamp) revert StalePrice();
+    if (block.timestamp - updatedAt > MAX_PRICE_AGE) revert StalePrice();
+
+    return uint256(answer);
+}
+```
+
+## Where the check belongs
+
+Put the sequencer/grace check in the on-chain liquidation execution path, **before reading the price, testing collateralisation, transferring collateral, or changing debt**. Every liquidation entry point—including batch liquidation, callbacks, and alternate keeper routes—must pass through the same internal gate. A UI warning or a keeper-side check is insufficient because it is bypassable.
+
+The resulting liquidation flow is:
+
+```text
+liquidate / batchLiquidate
+    -> require uptime feed initialized
+    -> require sequencer status == up
+    -> require now > recovery startedAt + grace period
+    -> validate price answer and price age
+    -> calculate collateral ratio
+    -> execute liquidation
+```
+
+Apply the same fail-closed gate to other **risk-increasing/adverse** operations that depend on a live market price, especially borrowing more collateral value or withdrawing collateral. Do **not** put it in a shared modifier that also blocks protective actions. Depositing collateral and repaying debt should remain available whenever the chain can execute them, including during the recovery grace period. Otherwise the mitigation itself prevents users from becoming safe.
+
+Keep the existing price validation after the sequencer check. The controls are complementary:
+
+- the uptime/grace check protects fair access and reaction time after an L2 outage;
+- the price-age and positive-answer checks protect oracle validity and freshness.
+
+Operationally, monitoring should pause keeper submissions when the uptime feed reports down and alert on recovery, but correctness must not depend on that monitoring. Add fork/integration tests for: status `1`; unknown status; `startedAt == 0`; future `startedAt`; exactly the grace-period boundary; the first timestamp after the boundary; stale/invalid price after a healthy sequencer check; all batch and alternate liquidation entry points; and successful deposit/repay during the grace period.
+
+This change would have made the 12:41 liquidations revert. Borrowers would have had the configured grace period, beginning at sequencer recovery—not at the oracle update—to deposit collateral or repay before liquidations became executable.
+
+Sources: [Chainlink L2 Sequencer Uptime Feeds](https://docs.chain.link/data-feeds/l2-sequencer-feeds) and [Arbitrum Nitro architecture](https://docs.arbitrum.io/nitro-whitepaper.pdf).

codex
Created [answer.md](/tmp/ethskills-audit-eval/2026-09-04T155031Z-codex-no-skill-1/audit-quiz-001/answer.md) with the post-mortem, Solidity mitigation, control-flow placement, and recommended tests.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..99f7acdbcafe0d5cf1b132607d30085559fbc1c7
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,102 @@
+# Post-mortem: liquidations immediately after Arbitrum sequencer recovery
+
+## What happened
+
+The freshness check worked, but it checked the wrong kind of liveness for this incident.
+
+`updatedAt` answers: **how recently did the oracle publish this price?** It does not answer: **how recently could an ordinary borrower get a transaction included on Arbitrum?** Those clocks can diverge.
+
+During the outage, Arbitrum's sequencer stopped producing blocks and ordinary users could not execute collateral deposits. Meanwhile, price discovery continued elsewhere and ETH fell 11%. Once sequencing resumed, the oracle could publish the current lower price immediately. That new round had an `updatedAt` only seconds old, so the one-hour price-age test correctly passed. It also correctly reflected the accumulated off-chain/mainnet price move.
+
+The first post-recovery block therefore combined two facts:
+
+1. borrowers had been unable to improve their positions for roughly 3.5 hours; and
+2. the protocol could suddenly observe the full current price decline.
+
+The keepers and borrowers were then racing from unequal starting positions. Keepers could submit prebuilt, automated liquidation transactions as soon as service returned, while users needed their rescue transactions to be accepted and ordered first. The protocol had no rule giving users time to react after chain access returned. Thus the liquidations were valid under the implemented rules but unfair under the intended market design.
+
+The feed heartbeat is not a remedy. A heartbeat is the maximum scheduled interval absent a sufficiently large deviation; an 11% move can trigger a fresh update immediately. Tightening the price-age bound below the heartbeat only rejects older oracle observations. It cannot detect that transaction inclusion was unavailable, and tightening it further would not create a reaction window.
+
+## Required change
+
+Integrate the Chainlink **Arbitrum Sequencer Uptime Feed** and add a post-recovery grace period. On Arbitrum One, the documented uptime-feed proxy is `0xFdB631F5EE196F0ed6FAa767959853A9F217697D`. Treat this as a separately governed/configured dependency and verify the address and interface during deployment.
+
+The uptime feed's `answer` has different semantics from a price feed:
+
+- `0` means the sequencer is up;
+- `1` means it is down; and
+- `startedAt` is when the current sequencer status began. When the answer returns to `0`, it is the recovery time from which the grace period is measured.
+
+Use a protocol-chosen grace period long enough for users to regain RPC access and have rescue transactions included. One hour is a reasonable initial minimum, but it is a risk parameter, not an oracle-heartbeat parameter. It should be set through governance based on the desired borrower reaction window.
+
+```solidity
+AggregatorV3Interface public immutable priceFeed;
+AggregatorV3Interface public immutable sequencerUptimeFeed;
+
+uint256 public constant MAX_PRICE_AGE = 1 hours;
+uint256 public constant SEQUENCER_GRACE_PERIOD = 1 hours;
+
+error SequencerDown();
+error SequencerFeedUninitialized();
+error SequencerGracePeriodActive();
+error InvalidPrice();
+error StalePrice();
+
+function _requireLiquidationsAvailable() internal view {
+    (, int256 status, uint256 startedAt,,) =
+        sequencerUptimeFeed.latestRoundData();
+
+    // Fail closed for liquidations on an unknown value or while down.
+    if (status != 0) revert SequencerDown();
+
+    // On Arbitrum, startedAt == 0 can mean that the uptime feed has not
+    // initialized. Do not interpret that as a very long period of uptime.
+    if (startedAt == 0 || startedAt > block.timestamp) {
+        revert SequencerFeedUninitialized();
+    }
+
+    if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) {
+        revert SequencerGracePeriodActive();
+    }
+}
+
+function _readPriceForLiquidation() internal view returns (uint256) {
+    _requireLiquidationsAvailable();
+
+    (, int256 answer,, uint256 updatedAt,) = priceFeed.latestRoundData();
+    if (answer <= 0) revert InvalidPrice();
+    if (updatedAt == 0 || updatedAt > block.timestamp) revert StalePrice();
+    if (block.timestamp - updatedAt > MAX_PRICE_AGE) revert StalePrice();
+
+    return uint256(answer);
+}
+```
+
+## Where the check belongs
+
+Put the sequencer/grace check in the on-chain liquidation execution path, **before reading the price, testing collateralisation, transferring collateral, or changing debt**. Every liquidation entry point—including batch liquidation, callbacks, and alternate keeper routes—must pass through the same internal gate. A UI warning or a keeper-side check is insufficient because it is bypassable.
+
+The resulting liquidation flow is:
+
+```text
+liquidate / batchLiquidate
+    -> require uptime feed initialized
+    -> require sequencer status == up
+    -> require now > recovery startedAt + grace period
+    -> validate price answer and price age
+    -> calculate collateral ratio
+    -> execute liquidation
+```
+
+Apply the same fail-closed gate to other **risk-increasing/adverse** operations that depend on a live market price, especially borrowing more collateral value or withdrawing collateral. Do **not** put it in a shared modifier that also blocks protective actions. Depositing collateral and repaying debt should remain available whenever the chain can execute them, including during the recovery grace period. Otherwise the mitigation itself prevents users from becoming safe.
+
+Keep the existing price validation after the sequencer check. The controls are complementary:
+
+- the uptime/grace check protects fair access and reaction time after an L2 outage;
+- the price-age and positive-answer checks protect oracle validity and freshness.
+
+Operationally, monitoring should pause keeper submissions when the uptime feed reports down and alert on recovery, but correctness must not depend on that monitoring. Add fork/integration tests for: status `1`; unknown status; `startedAt == 0`; future `startedAt`; exactly the grace-period boundary; the first timestamp after the boundary; stale/invalid price after a healthy sequencer check; all batch and alternate liquidation entry points; and successful deposit/repay during the grace period.
+
+This change would have made the 12:41 liquidations revert. Borrowers would have had the configured grace period, beginning at sequencer recovery—not at the oracle update—to deposit collateral or repay before liquidations became executable.
+
+Sources: [Chainlink L2 Sequencer Uptime Feeds](https://docs.chain.link/data-feeds/l2-sequencer-feeds) and [Arbitrum Nitro architecture](https://docs.arbitrum.io/nitro-whitepaper.pdf).

tokens used
27,268
````

## final message

Created [answer.md](/tmp/ethskills-audit-eval/2026-09-04T155031Z-codex-no-skill-1/audit-quiz-001/answer.md) with the post-mortem, Solidity mitigation, control-flow placement, and recommended tests.
