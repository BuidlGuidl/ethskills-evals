# Executor transcript — 2026-09-02T143117Z-codex-no-skill-1

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-audit-eval/2026-09-02T143117Z-codex-no-skill-1/audit-quiz-001

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-audit-eval/2026-09-02T143117Z-codex-no-skill-1/audit-quiz-001
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a06288-5471-7561-817c-8d993e785ad1
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

2026-09-02T14:31:37.049850Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a06288-5471-7561-817c-8d993e785ad1.tmp-1788359496826155469: line 2547: syntax error near unexpected token `('

codex
I’ll inspect the repository guidance and relevant files, then write a concrete post-mortem and mitigation flow into `answer.md`.
exec
/bin/bash -lc "ls -la && (rg --files -g 'AGENTS.md' -g '"'!**/.git/**'"' -g '"'!answer.md'"' || true) && (test -f AGENTS.md && sed -n '1,240p' AGENTS.md || true)" in /tmp/ethskills-audit-eval/2026-09-02T143117Z-codex-no-skill-1/audit-quiz-001
 succeeded in 9ms:
exec
/bin/bash -lc "find .agents .codex -maxdepth 3 -type f -print -exec sed -n '1,260p' {} \\; && sed -n '1,260p' TASK.md && git status --short" in /tmp/ethskills-audit-eval/2026-09-02T143117Z-codex-no-skill-1/audit-quiz-001
 succeeded in 5ms:
codex
The failure mode is orthogonal to oracle staleness: it is an L2 liveness outage followed by an immediately fresh oracle update. I’m verifying the exact Arbitrum sequencer-feed semantics so the proposed guard is implementable, including its placement and recovery grace period.
web search: 
web search: site:docs.chain.link data feeds l2 sequencer feeds Arbitrum grace period startedAt answer 0 ...
web search: 
web search: https://docs.chain.link/data-feeds/l2-sequencer-feeds
apply patch
patch: completed
/tmp/ethskills-audit-eval/2026-09-02T143117Z-codex-no-skill-1/audit-quiz-001/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..adbc736f30ddefcbbcd853b0f4aae101004b9ef7
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,76 @@
+# Post-mortem: fresh price, unavailable market
+
+## Root cause
+
+The check we had answers **“is this oracle observation recent?”** It does not answer **“have borrowers recently had a fair opportunity to transact on this L2?”** Those are independent properties.
+
+From 09:14 through 12:40 the Arbitrum sequencer was unavailable. Ordinary users could neither get an L2 transaction ordered nor add collateral or repay. Meanwhile, price discovery and Chainlink's offchain reporting continued outside Arbitrum. ETH therefore moved 11% while the lending-market state was effectively frozen.
+
+When sequencing resumed, two things became possible at nearly the same time:
+
+1. the oracle could publish the current, lower market price; and
+2. liquidators could submit transactions against positions valued at that price.
+
+The new oracle round was genuinely fresh, so `block.timestamp - updatedAt <= 3600` correctly passed. At the same instant, positions that had last been actionable by their owners before the 11% move became liquidatable. A pending app transaction gave its borrower no ordering priority over a keeper. Thus the freshness check behaved exactly as designed while providing no protection at all against the actual risk: **sequencer downtime followed by immediate liquidation on recovery**.
+
+The 86,400-second price-feed heartbeat is not the explanation and tightening the 3,600-second price-age limit further is not the fix. Heartbeat/deviation rules concern when price rounds update; they do not establish chain availability or a reaction window.
+
+## Required change
+
+Integrate Chainlink's Arbitrum Sequencer Uptime Feed and add a recovery grace-period gate. The current documented Arbitrum One proxy is `0xFdB631F5EE196F0ed6FAa767959853A9F217697D`; its address should be verified against the [official Chainlink deployment list](https://docs.chain.link/data-feeds/l2-sequencer-feeds) when configured.
+
+The uptime feed's `answer` is `0` when the sequencer is up and `1` when it is down. Its `startedAt` is the time at which the current status began. On Arbitrum, `startedAt == 0` can also mean that the feed has not been initialized, so that state must fail closed.
+
+A minimal guard is:
+
+```solidity
+AggregatorV3Interface public immutable sequencerUptimeFeed;
+uint256 public constant SEQUENCER_GRACE_PERIOD = 1 hours;
+
+error SequencerDown();
+error SequencerFeedUninitialized();
+error SequencerGracePeriod();
+
+function _requireLiquidationsAvailable() internal view {
+    (, int256 status, uint256 startedAt,,) =
+        sequencerUptimeFeed.latestRoundData();
+
+    // Fail closed for every value except the documented "up" value.
+    if (status != 0) revert SequencerDown();
+    if (startedAt == 0 || startedAt > block.timestamp) {
+        revert SequencerFeedUninitialized();
+    }
+    if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) {
+        revert SequencerGracePeriod();
+    }
+}
+```
+
+Production code should also treat a reverted/malformed uptime-feed read as unavailable rather than allowing liquidation. The grace period is a protocol risk parameter: one hour is the standard starting point and matches the existing example, but it should be chosen from measured wallet/RPC recovery time and governance's insolvency tolerance. It must be long enough for normal users to learn that service has returned and have a collateral-addition or repayment transaction confirmed.
+
+## Exact placement in the flow
+
+Call `_requireLiquidationsAvailable()` **at the beginning of the state-changing liquidation path, before reading a collateral price, testing health, transferring collateral, or repaying debt**:
+
+```solidity
+function liquidate(address borrower, uint256 repayAmount) external {
+    _requireLiquidationsAvailable();       // new liveness/recovery gate
+
+    uint256 price = _validatedPrice();     // existing answer/freshness checks
+    _requireBelowLiquidationThreshold(borrower, price);
+    _executeLiquidation(borrower, repayAmount, price);
+}
+```
+
+If there are multiple liquidation entry points (single, batch, callback, keeper-only, or internal routes), put the guard in a common internal function that every route must cross. A batch must not be able to bypass it. Apply the same gate to other operations that worsen account risk during the recovery window, especially new borrowing and collateral withdrawal.
+
+Do **not** put this guard indiscriminately in a shared oracle getter if that would also block protective actions. During the grace period, users must still be able to add collateral and repay debt; those paths generally do not need a price at all and should remain open. Deposits, repayments, and other risk-reducing operations should be processed while liquidations, borrowing, and collateral withdrawals remain disabled. Keep the existing positive-answer and price-age validation after the sequencer guard for every operation that consumes a price; it protects against a different failure mode.
+
+The resulting recovery sequence is:
+
+1. while the sequencer is down, no normal L2 execution occurs;
+2. after it reports up, liquidation and other risk-increasing operations remain disabled for the grace period;
+3. collateral additions and repayments are allowed and confirmed during that window; and
+4. only after the window expires may liquidation proceed, using a separately validated fresh price.
+
+Chainlink documents both the access asymmetry caused by sequencer outages and this precise uptime-feed/grace-period mitigation in its [L2 Sequencer Uptime Feeds guidance](https://docs.chain.link/data-feeds/l2-sequencer-feeds).

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..adbc736f30ddefcbbcd853b0f4aae101004b9ef7
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,76 @@
+# Post-mortem: fresh price, unavailable market
+
+## Root cause
+
+The check we had answers **“is this oracle observation recent?”** It does not answer **“have borrowers recently had a fair opportunity to transact on this L2?”** Those are independent properties.
+
+From 09:14 through 12:40 the Arbitrum sequencer was unavailable. Ordinary users could neither get an L2 transaction ordered nor add collateral or repay. Meanwhile, price discovery and Chainlink's offchain reporting continued outside Arbitrum. ETH therefore moved 11% while the lending-market state was effectively frozen.
+
+When sequencing resumed, two things became possible at nearly the same time:
+
+1. the oracle could publish the current, lower market price; and
+2. liquidators could submit transactions against positions valued at that price.
+
+The new oracle round was genuinely fresh, so `block.timestamp - updatedAt <= 3600` correctly passed. At the same instant, positions that had last been actionable by their owners before the 11% move became liquidatable. A pending app transaction gave its borrower no ordering priority over a keeper. Thus the freshness check behaved exactly as designed while providing no protection at all against the actual risk: **sequencer downtime followed by immediate liquidation on recovery**.
+
+The 86,400-second price-feed heartbeat is not the explanation and tightening the 3,600-second price-age limit further is not the fix. Heartbeat/deviation rules concern when price rounds update; they do not establish chain availability or a reaction window.
+
+## Required change
+
+Integrate Chainlink's Arbitrum Sequencer Uptime Feed and add a recovery grace-period gate. The current documented Arbitrum One proxy is `0xFdB631F5EE196F0ed6FAa767959853A9F217697D`; its address should be verified against the [official Chainlink deployment list](https://docs.chain.link/data-feeds/l2-sequencer-feeds) when configured.
+
+The uptime feed's `answer` is `0` when the sequencer is up and `1` when it is down. Its `startedAt` is the time at which the current status began. On Arbitrum, `startedAt == 0` can also mean that the feed has not been initialized, so that state must fail closed.
+
+A minimal guard is:
+
+```solidity
+AggregatorV3Interface public immutable sequencerUptimeFeed;
+uint256 public constant SEQUENCER_GRACE_PERIOD = 1 hours;
+
+error SequencerDown();
+error SequencerFeedUninitialized();
+error SequencerGracePeriod();
+
+function _requireLiquidationsAvailable() internal view {
+    (, int256 status, uint256 startedAt,,) =
+        sequencerUptimeFeed.latestRoundData();
+
+    // Fail closed for every value except the documented "up" value.
+    if (status != 0) revert SequencerDown();
+    if (startedAt == 0 || startedAt > block.timestamp) {
+        revert SequencerFeedUninitialized();
+    }
+    if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) {
+        revert SequencerGracePeriod();
+    }
+}
+```
+
+Production code should also treat a reverted/malformed uptime-feed read as unavailable rather than allowing liquidation. The grace period is a protocol risk parameter: one hour is the standard starting point and matches the existing example, but it should be chosen from measured wallet/RPC recovery time and governance's insolvency tolerance. It must be long enough for normal users to learn that service has returned and have a collateral-addition or repayment transaction confirmed.
+
+## Exact placement in the flow
+
+Call `_requireLiquidationsAvailable()` **at the beginning of the state-changing liquidation path, before reading a collateral price, testing health, transferring collateral, or repaying debt**:
+
+```solidity
+function liquidate(address borrower, uint256 repayAmount) external {
+    _requireLiquidationsAvailable();       // new liveness/recovery gate
+
+    uint256 price = _validatedPrice();     // existing answer/freshness checks
+    _requireBelowLiquidationThreshold(borrower, price);
+    _executeLiquidation(borrower, repayAmount, price);
+}
+```
+
+If there are multiple liquidation entry points (single, batch, callback, keeper-only, or internal routes), put the guard in a common internal function that every route must cross. A batch must not be able to bypass it. Apply the same gate to other operations that worsen account risk during the recovery window, especially new borrowing and collateral withdrawal.
+
+Do **not** put this guard indiscriminately in a shared oracle getter if that would also block protective actions. During the grace period, users must still be able to add collateral and repay debt; those paths generally do not need a price at all and should remain open. Deposits, repayments, and other risk-reducing operations should be processed while liquidations, borrowing, and collateral withdrawals remain disabled. Keep the existing positive-answer and price-age validation after the sequencer guard for every operation that consumes a price; it protects against a different failure mode.
+
+The resulting recovery sequence is:
+
+1. while the sequencer is down, no normal L2 execution occurs;
+2. after it reports up, liquidation and other risk-increasing operations remain disabled for the grace period;
+3. collateral additions and repayments are allowed and confirmed during that window; and
+4. only after the window expires may liquidation proceed, using a separately validated fresh price.
+
+Chainlink documents both the access asymmetry caused by sequencer outages and this precise uptime-feed/grace-period mitigation in its [L2 Sequencer Uptime Feeds guidance](https://docs.chain.link/data-feeds/l2-sequencer-feeds).

exec
/bin/bash -lc "sed -n '1,280p' answer.md && git diff --check && git status --short" in /tmp/ethskills-audit-eval/2026-09-02T143117Z-codex-no-skill-1/audit-quiz-001
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
# Post-mortem: fresh price, unavailable market

## Root cause

The check we had answers **“is this oracle observation recent?”** It does not answer **“have borrowers recently had a fair opportunity to transact on this L2?”** Those are independent properties.

From 09:14 through 12:40 the Arbitrum sequencer was unavailable. Ordinary users could neither get an L2 transaction ordered nor add collateral or repay. Meanwhile, price discovery and Chainlink's offchain reporting continued outside Arbitrum. ETH therefore moved 11% while the lending-market state was effectively frozen.

When sequencing resumed, two things became possible at nearly the same time:

1. the oracle could publish the current, lower market price; and
2. liquidators could submit transactions against positions valued at that price.

The new oracle round was genuinely fresh, so `block.timestamp - updatedAt <= 3600` correctly passed. At the same instant, positions that had last been actionable by their owners before the 11% move became liquidatable. A pending app transaction gave its borrower no ordering priority over a keeper. Thus the freshness check behaved exactly as designed while providing no protection at all against the actual risk: **sequencer downtime followed by immediate liquidation on recovery**.

The 86,400-second price-feed heartbeat is not the explanation and tightening the 3,600-second price-age limit further is not the fix. Heartbeat/deviation rules concern when price rounds update; they do not establish chain availability or a reaction window.

## Required change

Integrate Chainlink's Arbitrum Sequencer Uptime Feed and add a recovery grace-period gate. The current documented Arbitrum One proxy is `0xFdB631F5EE196F0ed6FAa767959853A9F217697D`; its address should be verified against the [official Chainlink deployment list](https://docs.chain.link/data-feeds/l2-sequencer-feeds) when configured.

The uptime feed's `answer` is `0` when the sequencer is up and `1` when it is down. Its `startedAt` is the time at which the current status began. On Arbitrum, `startedAt == 0` can also mean that the feed has not been initialized, so that state must fail closed.

A minimal guard is:

```solidity
AggregatorV3Interface public immutable sequencerUptimeFeed;
uint256 public constant SEQUENCER_GRACE_PERIOD = 1 hours;

error SequencerDown();
error SequencerFeedUninitialized();
error SequencerGracePeriod();

function _requireLiquidationsAvailable() internal view {
    (, int256 status, uint256 startedAt,,) =
        sequencerUptimeFeed.latestRoundData();

    // Fail closed for every value except the documented "up" value.
    if (status != 0) revert SequencerDown();
    if (startedAt == 0 || startedAt > block.timestamp) {
        revert SequencerFeedUninitialized();
    }
    if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) {
        revert SequencerGracePeriod();
    }
}
```

Production code should also treat a reverted/malformed uptime-feed read as unavailable rather than allowing liquidation. The grace period is a protocol risk parameter: one hour is the standard starting point and matches the existing example, but it should be chosen from measured wallet/RPC recovery time and governance's insolvency tolerance. It must be long enough for normal users to learn that service has returned and have a collateral-addition or repayment transaction confirmed.

## Exact placement in the flow

Call `_requireLiquidationsAvailable()` **at the beginning of the state-changing liquidation path, before reading a collateral price, testing health, transferring collateral, or repaying debt**:

```solidity
function liquidate(address borrower, uint256 repayAmount) external {
    _requireLiquidationsAvailable();       // new liveness/recovery gate

    uint256 price = _validatedPrice();     // existing answer/freshness checks
    _requireBelowLiquidationThreshold(borrower, price);
    _executeLiquidation(borrower, repayAmount, price);
}
```

If there are multiple liquidation entry points (single, batch, callback, keeper-only, or internal routes), put the guard in a common internal function that every route must cross. A batch must not be able to bypass it. Apply the same gate to other operations that worsen account risk during the recovery window, especially new borrowing and collateral withdrawal.

Do **not** put this guard indiscriminately in a shared oracle getter if that would also block protective actions. During the grace period, users must still be able to add collateral and repay debt; those paths generally do not need a price at all and should remain open. Deposits, repayments, and other risk-reducing operations should be processed while liquidations, borrowing, and collateral withdrawals remain disabled. Keep the existing positive-answer and price-age validation after the sequencer guard for every operation that consumes a price; it protects against a different failure mode.

The resulting recovery sequence is:

1. while the sequencer is down, no normal L2 execution occurs;
2. after it reports up, liquidation and other risk-increasing operations remain disabled for the grace period;
3. collateral additions and repayments are allowed and confirmed during that window; and
4. only after the window expires may liquidation proceed, using a separately validated fresh price.

Chainlink documents both the access asymmetry caused by sequencer outages and this precise uptime-feed/grace-period mitigation in its [L2 Sequencer Uptime Feeds guidance](https://docs.chain.link/data-feeds/l2-sequencer-feeds).
?? answer.md

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..adbc736f30ddefcbbcd853b0f4aae101004b9ef7
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,76 @@
+# Post-mortem: fresh price, unavailable market
+
+## Root cause
+
+The check we had answers **“is this oracle observation recent?”** It does not answer **“have borrowers recently had a fair opportunity to transact on this L2?”** Those are independent properties.
+
+From 09:14 through 12:40 the Arbitrum sequencer was unavailable. Ordinary users could neither get an L2 transaction ordered nor add collateral or repay. Meanwhile, price discovery and Chainlink's offchain reporting continued outside Arbitrum. ETH therefore moved 11% while the lending-market state was effectively frozen.
+
+When sequencing resumed, two things became possible at nearly the same time:
+
+1. the oracle could publish the current, lower market price; and
+2. liquidators could submit transactions against positions valued at that price.
+
+The new oracle round was genuinely fresh, so `block.timestamp - updatedAt <= 3600` correctly passed. At the same instant, positions that had last been actionable by their owners before the 11% move became liquidatable. A pending app transaction gave its borrower no ordering priority over a keeper. Thus the freshness check behaved exactly as designed while providing no protection at all against the actual risk: **sequencer downtime followed by immediate liquidation on recovery**.
+
+The 86,400-second price-feed heartbeat is not the explanation and tightening the 3,600-second price-age limit further is not the fix. Heartbeat/deviation rules concern when price rounds update; they do not establish chain availability or a reaction window.
+
+## Required change
+
+Integrate Chainlink's Arbitrum Sequencer Uptime Feed and add a recovery grace-period gate. The current documented Arbitrum One proxy is `0xFdB631F5EE196F0ed6FAa767959853A9F217697D`; its address should be verified against the [official Chainlink deployment list](https://docs.chain.link/data-feeds/l2-sequencer-feeds) when configured.
+
+The uptime feed's `answer` is `0` when the sequencer is up and `1` when it is down. Its `startedAt` is the time at which the current status began. On Arbitrum, `startedAt == 0` can also mean that the feed has not been initialized, so that state must fail closed.
+
+A minimal guard is:
+
+```solidity
+AggregatorV3Interface public immutable sequencerUptimeFeed;
+uint256 public constant SEQUENCER_GRACE_PERIOD = 1 hours;
+
+error SequencerDown();
+error SequencerFeedUninitialized();
+error SequencerGracePeriod();
+
+function _requireLiquidationsAvailable() internal view {
+    (, int256 status, uint256 startedAt,,) =
+        sequencerUptimeFeed.latestRoundData();
+
+    // Fail closed for every value except the documented "up" value.
+    if (status != 0) revert SequencerDown();
+    if (startedAt == 0 || startedAt > block.timestamp) {
+        revert SequencerFeedUninitialized();
+    }
+    if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) {
+        revert SequencerGracePeriod();
+    }
+}
+```
+
+Production code should also treat a reverted/malformed uptime-feed read as unavailable rather than allowing liquidation. The grace period is a protocol risk parameter: one hour is the standard starting point and matches the existing example, but it should be chosen from measured wallet/RPC recovery time and governance's insolvency tolerance. It must be long enough for normal users to learn that service has returned and have a collateral-addition or repayment transaction confirmed.
+
+## Exact placement in the flow
+
+Call `_requireLiquidationsAvailable()` **at the beginning of the state-changing liquidation path, before reading a collateral price, testing health, transferring collateral, or repaying debt**:
+
+```solidity
+function liquidate(address borrower, uint256 repayAmount) external {
+    _requireLiquidationsAvailable();       // new liveness/recovery gate
+
+    uint256 price = _validatedPrice();     // existing answer/freshness checks
+    _requireBelowLiquidationThreshold(borrower, price);
+    _executeLiquidation(borrower, repayAmount, price);
+}
+```
+
+If there are multiple liquidation entry points (single, batch, callback, keeper-only, or internal routes), put the guard in a common internal function that every route must cross. A batch must not be able to bypass it. Apply the same gate to other operations that worsen account risk during the recovery window, especially new borrowing and collateral withdrawal.
+
+Do **not** put this guard indiscriminately in a shared oracle getter if that would also block protective actions. During the grace period, users must still be able to add collateral and repay debt; those paths generally do not need a price at all and should remain open. Deposits, repayments, and other risk-reducing operations should be processed while liquidations, borrowing, and collateral withdrawals remain disabled. Keep the existing positive-answer and price-age validation after the sequencer guard for every operation that consumes a price; it protects against a different failure mode.
+
+The resulting recovery sequence is:
+
+1. while the sequencer is down, no normal L2 execution occurs;
+2. after it reports up, liquidation and other risk-increasing operations remain disabled for the grace period;
+3. collateral additions and repayments are allowed and confirmed during that window; and
+4. only after the window expires may liquidation proceed, using a separately validated fresh price.
+
+Chainlink documents both the access asymmetry caused by sequencer outages and this precise uptime-feed/grace-period mitigation in its [L2 Sequencer Uptime Feeds guidance](https://docs.chain.link/data-feeds/l2-sequencer-feeds).

codex
Completed [answer.md](/tmp/ethskills-audit-eval/2026-09-02T143117Z-codex-no-skill-1/audit-quiz-001/answer.md).

It explains the sequencer-liveness failure, why oracle freshness did not help, and precisely places an uptime-feed recovery grace-period guard before liquidation while keeping collateral additions and repayments available.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..adbc736f30ddefcbbcd853b0f4aae101004b9ef7
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,76 @@
+# Post-mortem: fresh price, unavailable market
+
+## Root cause
+
+The check we had answers **“is this oracle observation recent?”** It does not answer **“have borrowers recently had a fair opportunity to transact on this L2?”** Those are independent properties.
+
+From 09:14 through 12:40 the Arbitrum sequencer was unavailable. Ordinary users could neither get an L2 transaction ordered nor add collateral or repay. Meanwhile, price discovery and Chainlink's offchain reporting continued outside Arbitrum. ETH therefore moved 11% while the lending-market state was effectively frozen.
+
+When sequencing resumed, two things became possible at nearly the same time:
+
+1. the oracle could publish the current, lower market price; and
+2. liquidators could submit transactions against positions valued at that price.
+
+The new oracle round was genuinely fresh, so `block.timestamp - updatedAt <= 3600` correctly passed. At the same instant, positions that had last been actionable by their owners before the 11% move became liquidatable. A pending app transaction gave its borrower no ordering priority over a keeper. Thus the freshness check behaved exactly as designed while providing no protection at all against the actual risk: **sequencer downtime followed by immediate liquidation on recovery**.
+
+The 86,400-second price-feed heartbeat is not the explanation and tightening the 3,600-second price-age limit further is not the fix. Heartbeat/deviation rules concern when price rounds update; they do not establish chain availability or a reaction window.
+
+## Required change
+
+Integrate Chainlink's Arbitrum Sequencer Uptime Feed and add a recovery grace-period gate. The current documented Arbitrum One proxy is `0xFdB631F5EE196F0ed6FAa767959853A9F217697D`; its address should be verified against the [official Chainlink deployment list](https://docs.chain.link/data-feeds/l2-sequencer-feeds) when configured.
+
+The uptime feed's `answer` is `0` when the sequencer is up and `1` when it is down. Its `startedAt` is the time at which the current status began. On Arbitrum, `startedAt == 0` can also mean that the feed has not been initialized, so that state must fail closed.
+
+A minimal guard is:
+
+```solidity
+AggregatorV3Interface public immutable sequencerUptimeFeed;
+uint256 public constant SEQUENCER_GRACE_PERIOD = 1 hours;
+
+error SequencerDown();
+error SequencerFeedUninitialized();
+error SequencerGracePeriod();
+
+function _requireLiquidationsAvailable() internal view {
+    (, int256 status, uint256 startedAt,,) =
+        sequencerUptimeFeed.latestRoundData();
+
+    // Fail closed for every value except the documented "up" value.
+    if (status != 0) revert SequencerDown();
+    if (startedAt == 0 || startedAt > block.timestamp) {
+        revert SequencerFeedUninitialized();
+    }
+    if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) {
+        revert SequencerGracePeriod();
+    }
+}
+```
+
+Production code should also treat a reverted/malformed uptime-feed read as unavailable rather than allowing liquidation. The grace period is a protocol risk parameter: one hour is the standard starting point and matches the existing example, but it should be chosen from measured wallet/RPC recovery time and governance's insolvency tolerance. It must be long enough for normal users to learn that service has returned and have a collateral-addition or repayment transaction confirmed.
+
+## Exact placement in the flow
+
+Call `_requireLiquidationsAvailable()` **at the beginning of the state-changing liquidation path, before reading a collateral price, testing health, transferring collateral, or repaying debt**:
+
+```solidity
+function liquidate(address borrower, uint256 repayAmount) external {
+    _requireLiquidationsAvailable();       // new liveness/recovery gate
+
+    uint256 price = _validatedPrice();     // existing answer/freshness checks
+    _requireBelowLiquidationThreshold(borrower, price);
+    _executeLiquidation(borrower, repayAmount, price);
+}
+```
+
+If there are multiple liquidation entry points (single, batch, callback, keeper-only, or internal routes), put the guard in a common internal function that every route must cross. A batch must not be able to bypass it. Apply the same gate to other operations that worsen account risk during the recovery window, especially new borrowing and collateral withdrawal.
+
+Do **not** put this guard indiscriminately in a shared oracle getter if that would also block protective actions. During the grace period, users must still be able to add collateral and repay debt; those paths generally do not need a price at all and should remain open. Deposits, repayments, and other risk-reducing operations should be processed while liquidations, borrowing, and collateral withdrawals remain disabled. Keep the existing positive-answer and price-age validation after the sequencer guard for every operation that consumes a price; it protects against a different failure mode.
+
+The resulting recovery sequence is:
+
+1. while the sequencer is down, no normal L2 execution occurs;
+2. after it reports up, liquidation and other risk-increasing operations remain disabled for the grace period;
+3. collateral additions and repayments are allowed and confirmed during that window; and
+4. only after the window expires may liquidation proceed, using a separately validated fresh price.
+
+Chainlink documents both the access asymmetry caused by sequencer outages and this precise uptime-feed/grace-period mitigation in its [L2 Sequencer Uptime Feeds guidance](https://docs.chain.link/data-feeds/l2-sequencer-feeds).

2026-09-02T14:33:31.662811Z  WARN codex_core::tasks: failed to flush rollout after emitting terminal turn event: thread 01a06288-5471-7561-817c-8d993e785ad1 not found
tokens used
27,113
````

## final message

Completed [answer.md](/tmp/ethskills-audit-eval/2026-09-02T143117Z-codex-no-skill-1/audit-quiz-001/answer.md).

It explains the sequencer-liveness failure, why oracle freshness did not help, and precisely places an uptime-feed recovery grace-period guard before liquidation while keeping collateral additions and repayments available.
