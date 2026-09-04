# Executor transcript — 2026-09-04T155033Z-codex-no-skill-3

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-audit-eval/2026-09-04T155033Z-codex-no-skill-3/audit-quiz-001

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-audit-eval/2026-09-04T155033Z-codex-no-skill-3/audit-quiz-001
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a06d21-ea4e-7d21-ab9d-88f64fa5afb1
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
I’ll trace this as an L2 availability failure rather than a price-feed freshness failure, then write the post-mortem explanation and the exact liquidation-flow guard into `answer.md`.
exec
/bin/bash -lc "rg --files -g 'AGENTS.md' -g '"'!node_modules'"' -g '"'!vendor'"' && pwd && ls -la" in /tmp/ethskills-audit-eval/2026-09-04T155033Z-codex-no-skill-3/audit-quiz-001
 exited 1 in 15ms:
exec
/bin/bash -lc 'pwd; ls -la; find .. -name AGENTS.md -print' in /tmp/ethskills-audit-eval/2026-09-04T155033Z-codex-no-skill-3/audit-quiz-001
 succeeded in 6ms:
total 20
drwxrwxr-x 5 damu damu 4096 Sep  4 12:55 .
drwxrwxr-x 3 damu damu 4096 Sep  4 12:50 ..
dr-xr-xr-x 2 damu damu   40 Sep  4 12:55 .agents
dr-xr-xr-x 2 damu damu   40 Sep  4 12:55 .codex
drwxrwxr-x 8 damu damu 4096 Sep  4 12:50 .git
-rw-rw-r-- 1 damu damu 1609 Sep  4 12:50 TASK.md
-rw-rw-r-- 1 damu damu   50 Sep  4 12:50 package.json

codex
The key distinction is already clear: `updatedAt` proves the market observation is recent; it says nothing about whether borrowers had recent transaction access. I’m checking the precise Arbitrum sequencer-feed semantics so the proposed guard handles recovery and initialization correctly.
web search: 
web search: site:docs.chain.link data-feeds l2-sequencer-feeds Arbitrum grace period startedAt answer 0 ...
web search: 
web search: https://docs.chain.link/data-feeds/l2-sequencer-feeds
apply patch
patch: completed
/tmp/ethskills-audit-eval/2026-09-04T155033Z-codex-no-skill-3/audit-quiz-001/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..07c20513ce534e379c5a5f429be945e70a73126e
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,79 @@
+# Post-mortem: fresh price, unavailable market
+
+## What happened
+
+The check we had answers only this question: **how recently was this price published?** It does not answer: **how recently could a borrower transact on Arbitrum?** Those are independent properties.
+
+From 09:14 to 12:40 the sequencer outage denied ordinary users the standard L2 read/write path. Their collateral-add transactions could not be included, while the wstETH market continued moving elsewhere. No liquidation could execute during the halt either, so the problem remained latent.
+
+On recovery, two things became possible at nearly the same time:
+
+1. the oracle published/caught up to the current, 11%-lower market price; and
+2. keepers could submit liquidations again.
+
+Consequently, the oracle round used by each liquidation really was only seconds old. `block.timestamp - updatedAt <= 3600` correctly passed. The borrowers nevertheless had had zero usable reaction time: their last practical opportunity to act was before the outage, when that lower price did not yet exist, and keepers won the race in the first recovery blocks.
+
+The 86,400-second heartbeat and our 3,600-second maximum age are not the relevant protection. A heartbeat/age check protects against an old market observation. Tightening it further can make the recovery cliff sharper, not fairer: liquidation is enabled as soon as the first fresh post-outage observation arrives. The missing control was **sequencer availability plus a post-recovery grace period**.
+
+## Required change
+
+Integrate Chainlink's Arbitrum Sequencer Uptime Feed (Arbitrum One proxy `0xFdB631F5EE196F0ed6FAa767959853A9F217697D`) and fail closed for liquidation when:
+
+- the uptime feed's `answer` is not `0` (`0` means up; `1` means down);
+- `startedAt` is zero (the Arbitrum uptime feed is uninitialized);
+- `startedAt` is in the future or otherwise yields an invalid elapsed time; or
+- less than the configured recovery grace period has elapsed since `startedAt`, which is the time the current "up" status began.
+
+For example:
+
+```solidity
+AggregatorV3Interface constant SEQUENCER_UPTIME_FEED =
+    AggregatorV3Interface(0xFdB631F5EE196F0ed6FAa767959853A9F217697D);
+
+uint256 constant SEQUENCER_GRACE_PERIOD = 1 hours; // governance/risk parameter
+
+error SequencerUnavailable();
+error SequencerGracePeriod();
+
+function _requireLiquidationsAvailable() internal view {
+    (, int256 status, uint256 startedAt,,) =
+        SEQUENCER_UPTIME_FEED.latestRoundData();
+
+    // Fail closed on down or an unexpected status.
+    if (status != 0) revert SequencerUnavailable();
+
+    // On Arbitrum, zero can mean the uptime feed has not initialized.
+    if (startedAt == 0 || startedAt > block.timestamp) {
+        revert SequencerUnavailable();
+    }
+
+    if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) {
+        revert SequencerGracePeriod();
+    }
+}
+```
+
+The uptime-feed call reverting must also make the liquidation revert; it must not be caught and treated as "up." The boundary (`<=` above versus `<`) should match the protocol's stated grace-period semantics and tests.
+
+## Where it goes in the flow
+
+Call `_requireLiquidationsAvailable()` at the **entry to every liquidation path**, before reading a collateral price, deciding that an account is unhealthy, transferring collateral, repaying debt, or paying a keeper incentive:
+
+```solidity
+function liquidate(address borrower, uint256 repayAmount) external {
+    _requireLiquidationsAvailable(); // availability/fair-access gate first
+
+    uint256 price = _readFreshPositiveCollateralPrice(); // existing checks retained
+    _liquidateUsingPrice(borrower, repayAmount, price);
+}
+```
+
+The same guard must cover batch liquidations, keeper-only endpoints, callbacks, and any internal route that can produce liquidation effects; otherwise the unguarded route is a bypass. Putting the check only in the app or keeper is insufficient because enforcement must be onchain. Putting it only in a general oracle helper is also undesirable if that helper is used by rescue actions.
+
+During the recovery grace period, keep **risk-reducing borrower actions** available—notably adding collateral and repaying USDC—while liquidation stays disabled. Borrowing more and withdrawing collateral may be paused under the same recovery policy. This is what turns the grace period into an actual opportunity to cure positions rather than merely a delay.
+
+Keep the existing positive-answer and price-age checks after the sequencer gate. They address a different failure mode and remain necessary. Also validate the feed configuration and price-feed decimals/round behavior as part of the existing oracle integration.
+
+The one-hour value is Chainlink's example, not a fact implied by the price heartbeat. Risk governance should choose and document a period long enough for RPCs, wallets, the app, and oracle delivery to normalize and for users to get transactions included; it can be longer than one hour. Alerting and an emergency pause are useful defense in depth, but neither replaces this deterministic onchain gate.
+
+Reference: [Chainlink L2 Sequencer Uptime Feeds](https://docs.chain.link/data-feeds/l2-sequencer-feeds).

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..07c20513ce534e379c5a5f429be945e70a73126e
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,79 @@
+# Post-mortem: fresh price, unavailable market
+
+## What happened
+
+The check we had answers only this question: **how recently was this price published?** It does not answer: **how recently could a borrower transact on Arbitrum?** Those are independent properties.
+
+From 09:14 to 12:40 the sequencer outage denied ordinary users the standard L2 read/write path. Their collateral-add transactions could not be included, while the wstETH market continued moving elsewhere. No liquidation could execute during the halt either, so the problem remained latent.
+
+On recovery, two things became possible at nearly the same time:
+
+1. the oracle published/caught up to the current, 11%-lower market price; and
+2. keepers could submit liquidations again.
+
+Consequently, the oracle round used by each liquidation really was only seconds old. `block.timestamp - updatedAt <= 3600` correctly passed. The borrowers nevertheless had had zero usable reaction time: their last practical opportunity to act was before the outage, when that lower price did not yet exist, and keepers won the race in the first recovery blocks.
+
+The 86,400-second heartbeat and our 3,600-second maximum age are not the relevant protection. A heartbeat/age check protects against an old market observation. Tightening it further can make the recovery cliff sharper, not fairer: liquidation is enabled as soon as the first fresh post-outage observation arrives. The missing control was **sequencer availability plus a post-recovery grace period**.
+
+## Required change
+
+Integrate Chainlink's Arbitrum Sequencer Uptime Feed (Arbitrum One proxy `0xFdB631F5EE196F0ed6FAa767959853A9F217697D`) and fail closed for liquidation when:
+
+- the uptime feed's `answer` is not `0` (`0` means up; `1` means down);
+- `startedAt` is zero (the Arbitrum uptime feed is uninitialized);
+- `startedAt` is in the future or otherwise yields an invalid elapsed time; or
+- less than the configured recovery grace period has elapsed since `startedAt`, which is the time the current "up" status began.
+
+For example:
+
+```solidity
+AggregatorV3Interface constant SEQUENCER_UPTIME_FEED =
+    AggregatorV3Interface(0xFdB631F5EE196F0ed6FAa767959853A9F217697D);
+
+uint256 constant SEQUENCER_GRACE_PERIOD = 1 hours; // governance/risk parameter
+
+error SequencerUnavailable();
+error SequencerGracePeriod();
+
+function _requireLiquidationsAvailable() internal view {
+    (, int256 status, uint256 startedAt,,) =
+        SEQUENCER_UPTIME_FEED.latestRoundData();
+
+    // Fail closed on down or an unexpected status.
+    if (status != 0) revert SequencerUnavailable();
+
+    // On Arbitrum, zero can mean the uptime feed has not initialized.
+    if (startedAt == 0 || startedAt > block.timestamp) {
+        revert SequencerUnavailable();
+    }
+
+    if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) {
+        revert SequencerGracePeriod();
+    }
+}
+```
+
+The uptime-feed call reverting must also make the liquidation revert; it must not be caught and treated as "up." The boundary (`<=` above versus `<`) should match the protocol's stated grace-period semantics and tests.
+
+## Where it goes in the flow
+
+Call `_requireLiquidationsAvailable()` at the **entry to every liquidation path**, before reading a collateral price, deciding that an account is unhealthy, transferring collateral, repaying debt, or paying a keeper incentive:
+
+```solidity
+function liquidate(address borrower, uint256 repayAmount) external {
+    _requireLiquidationsAvailable(); // availability/fair-access gate first
+
+    uint256 price = _readFreshPositiveCollateralPrice(); // existing checks retained
+    _liquidateUsingPrice(borrower, repayAmount, price);
+}
+```
+
+The same guard must cover batch liquidations, keeper-only endpoints, callbacks, and any internal route that can produce liquidation effects; otherwise the unguarded route is a bypass. Putting the check only in the app or keeper is insufficient because enforcement must be onchain. Putting it only in a general oracle helper is also undesirable if that helper is used by rescue actions.
+
+During the recovery grace period, keep **risk-reducing borrower actions** available—notably adding collateral and repaying USDC—while liquidation stays disabled. Borrowing more and withdrawing collateral may be paused under the same recovery policy. This is what turns the grace period into an actual opportunity to cure positions rather than merely a delay.
+
+Keep the existing positive-answer and price-age checks after the sequencer gate. They address a different failure mode and remain necessary. Also validate the feed configuration and price-feed decimals/round behavior as part of the existing oracle integration.
+
+The one-hour value is Chainlink's example, not a fact implied by the price heartbeat. Risk governance should choose and document a period long enough for RPCs, wallets, the app, and oracle delivery to normalize and for users to get transactions included; it can be longer than one hour. Alerting and an emergency pause are useful defense in depth, but neither replaces this deterministic onchain gate.
+
+Reference: [Chainlink L2 Sequencer Uptime Feeds](https://docs.chain.link/data-feeds/l2-sequencer-feeds).

exec
/bin/bash -lc "sed -n '1,260p' answer.md; git diff --check; git status --short" in /tmp/ethskills-audit-eval/2026-09-04T155033Z-codex-no-skill-3/audit-quiz-001
 succeeded in 19ms:
# Post-mortem: fresh price, unavailable market

## What happened

The check we had answers only this question: **how recently was this price published?** It does not answer: **how recently could a borrower transact on Arbitrum?** Those are independent properties.

From 09:14 to 12:40 the sequencer outage denied ordinary users the standard L2 read/write path. Their collateral-add transactions could not be included, while the wstETH market continued moving elsewhere. No liquidation could execute during the halt either, so the problem remained latent.

On recovery, two things became possible at nearly the same time:

1. the oracle published/caught up to the current, 11%-lower market price; and
2. keepers could submit liquidations again.

Consequently, the oracle round used by each liquidation really was only seconds old. `block.timestamp - updatedAt <= 3600` correctly passed. The borrowers nevertheless had had zero usable reaction time: their last practical opportunity to act was before the outage, when that lower price did not yet exist, and keepers won the race in the first recovery blocks.

The 86,400-second heartbeat and our 3,600-second maximum age are not the relevant protection. A heartbeat/age check protects against an old market observation. Tightening it further can make the recovery cliff sharper, not fairer: liquidation is enabled as soon as the first fresh post-outage observation arrives. The missing control was **sequencer availability plus a post-recovery grace period**.

## Required change

Integrate Chainlink's Arbitrum Sequencer Uptime Feed (Arbitrum One proxy `0xFdB631F5EE196F0ed6FAa767959853A9F217697D`) and fail closed for liquidation when:

- the uptime feed's `answer` is not `0` (`0` means up; `1` means down);
- `startedAt` is zero (the Arbitrum uptime feed is uninitialized);
- `startedAt` is in the future or otherwise yields an invalid elapsed time; or
- less than the configured recovery grace period has elapsed since `startedAt`, which is the time the current "up" status began.

For example:

```solidity
AggregatorV3Interface constant SEQUENCER_UPTIME_FEED =
    AggregatorV3Interface(0xFdB631F5EE196F0ed6FAa767959853A9F217697D);

uint256 constant SEQUENCER_GRACE_PERIOD = 1 hours; // governance/risk parameter

error SequencerUnavailable();
error SequencerGracePeriod();

function _requireLiquidationsAvailable() internal view {
    (, int256 status, uint256 startedAt,,) =
        SEQUENCER_UPTIME_FEED.latestRoundData();

    // Fail closed on down or an unexpected status.
    if (status != 0) revert SequencerUnavailable();

    // On Arbitrum, zero can mean the uptime feed has not initialized.
    if (startedAt == 0 || startedAt > block.timestamp) {
        revert SequencerUnavailable();
    }

    if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) {
        revert SequencerGracePeriod();
    }
}
```

The uptime-feed call reverting must also make the liquidation revert; it must not be caught and treated as "up." The boundary (`<=` above versus `<`) should match the protocol's stated grace-period semantics and tests.

## Where it goes in the flow

Call `_requireLiquidationsAvailable()` at the **entry to every liquidation path**, before reading a collateral price, deciding that an account is unhealthy, transferring collateral, repaying debt, or paying a keeper incentive:

```solidity
function liquidate(address borrower, uint256 repayAmount) external {
    _requireLiquidationsAvailable(); // availability/fair-access gate first

    uint256 price = _readFreshPositiveCollateralPrice(); // existing checks retained
    _liquidateUsingPrice(borrower, repayAmount, price);
}
```

The same guard must cover batch liquidations, keeper-only endpoints, callbacks, and any internal route that can produce liquidation effects; otherwise the unguarded route is a bypass. Putting the check only in the app or keeper is insufficient because enforcement must be onchain. Putting it only in a general oracle helper is also undesirable if that helper is used by rescue actions.

During the recovery grace period, keep **risk-reducing borrower actions** available—notably adding collateral and repaying USDC—while liquidation stays disabled. Borrowing more and withdrawing collateral may be paused under the same recovery policy. This is what turns the grace period into an actual opportunity to cure positions rather than merely a delay.

Keep the existing positive-answer and price-age checks after the sequencer gate. They address a different failure mode and remain necessary. Also validate the feed configuration and price-feed decimals/round behavior as part of the existing oracle integration.

The one-hour value is Chainlink's example, not a fact implied by the price heartbeat. Risk governance should choose and document a period long enough for RPCs, wallets, the app, and oracle delivery to normalize and for users to get transactions included; it can be longer than one hour. Alerting and an emergency pause are useful defense in depth, but neither replaces this deterministic onchain gate.

Reference: [Chainlink L2 Sequencer Uptime Feeds](https://docs.chain.link/data-feeds/l2-sequencer-feeds).
?? answer.md

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..07c20513ce534e379c5a5f429be945e70a73126e
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,79 @@
+# Post-mortem: fresh price, unavailable market
+
+## What happened
+
+The check we had answers only this question: **how recently was this price published?** It does not answer: **how recently could a borrower transact on Arbitrum?** Those are independent properties.
+
+From 09:14 to 12:40 the sequencer outage denied ordinary users the standard L2 read/write path. Their collateral-add transactions could not be included, while the wstETH market continued moving elsewhere. No liquidation could execute during the halt either, so the problem remained latent.
+
+On recovery, two things became possible at nearly the same time:
+
+1. the oracle published/caught up to the current, 11%-lower market price; and
+2. keepers could submit liquidations again.
+
+Consequently, the oracle round used by each liquidation really was only seconds old. `block.timestamp - updatedAt <= 3600` correctly passed. The borrowers nevertheless had had zero usable reaction time: their last practical opportunity to act was before the outage, when that lower price did not yet exist, and keepers won the race in the first recovery blocks.
+
+The 86,400-second heartbeat and our 3,600-second maximum age are not the relevant protection. A heartbeat/age check protects against an old market observation. Tightening it further can make the recovery cliff sharper, not fairer: liquidation is enabled as soon as the first fresh post-outage observation arrives. The missing control was **sequencer availability plus a post-recovery grace period**.
+
+## Required change
+
+Integrate Chainlink's Arbitrum Sequencer Uptime Feed (Arbitrum One proxy `0xFdB631F5EE196F0ed6FAa767959853A9F217697D`) and fail closed for liquidation when:
+
+- the uptime feed's `answer` is not `0` (`0` means up; `1` means down);
+- `startedAt` is zero (the Arbitrum uptime feed is uninitialized);
+- `startedAt` is in the future or otherwise yields an invalid elapsed time; or
+- less than the configured recovery grace period has elapsed since `startedAt`, which is the time the current "up" status began.
+
+For example:
+
+```solidity
+AggregatorV3Interface constant SEQUENCER_UPTIME_FEED =
+    AggregatorV3Interface(0xFdB631F5EE196F0ed6FAa767959853A9F217697D);
+
+uint256 constant SEQUENCER_GRACE_PERIOD = 1 hours; // governance/risk parameter
+
+error SequencerUnavailable();
+error SequencerGracePeriod();
+
+function _requireLiquidationsAvailable() internal view {
+    (, int256 status, uint256 startedAt,,) =
+        SEQUENCER_UPTIME_FEED.latestRoundData();
+
+    // Fail closed on down or an unexpected status.
+    if (status != 0) revert SequencerUnavailable();
+
+    // On Arbitrum, zero can mean the uptime feed has not initialized.
+    if (startedAt == 0 || startedAt > block.timestamp) {
+        revert SequencerUnavailable();
+    }
+
+    if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) {
+        revert SequencerGracePeriod();
+    }
+}
+```
+
+The uptime-feed call reverting must also make the liquidation revert; it must not be caught and treated as "up." The boundary (`<=` above versus `<`) should match the protocol's stated grace-period semantics and tests.
+
+## Where it goes in the flow
+
+Call `_requireLiquidationsAvailable()` at the **entry to every liquidation path**, before reading a collateral price, deciding that an account is unhealthy, transferring collateral, repaying debt, or paying a keeper incentive:
+
+```solidity
+function liquidate(address borrower, uint256 repayAmount) external {
+    _requireLiquidationsAvailable(); // availability/fair-access gate first
+
+    uint256 price = _readFreshPositiveCollateralPrice(); // existing checks retained
+    _liquidateUsingPrice(borrower, repayAmount, price);
+}
+```
+
+The same guard must cover batch liquidations, keeper-only endpoints, callbacks, and any internal route that can produce liquidation effects; otherwise the unguarded route is a bypass. Putting the check only in the app or keeper is insufficient because enforcement must be onchain. Putting it only in a general oracle helper is also undesirable if that helper is used by rescue actions.
+
+During the recovery grace period, keep **risk-reducing borrower actions** available—notably adding collateral and repaying USDC—while liquidation stays disabled. Borrowing more and withdrawing collateral may be paused under the same recovery policy. This is what turns the grace period into an actual opportunity to cure positions rather than merely a delay.
+
+Keep the existing positive-answer and price-age checks after the sequencer gate. They address a different failure mode and remain necessary. Also validate the feed configuration and price-feed decimals/round behavior as part of the existing oracle integration.
+
+The one-hour value is Chainlink's example, not a fact implied by the price heartbeat. Risk governance should choose and document a period long enough for RPCs, wallets, the app, and oracle delivery to normalize and for users to get transactions included; it can be longer than one hour. Alerting and an emergency pause are useful defense in depth, but neither replaces this deterministic onchain gate.
+
+Reference: [Chainlink L2 Sequencer Uptime Feeds](https://docs.chain.link/data-feeds/l2-sequencer-feeds).

codex
Created [answer.md](/tmp/ethskills-audit-eval/2026-09-04T155033Z-codex-no-skill-3/audit-quiz-001/answer.md) with the post-mortem, sequencer-uptime guard, recovery grace period, and exact placement in every liquidation path.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..07c20513ce534e379c5a5f429be945e70a73126e
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,79 @@
+# Post-mortem: fresh price, unavailable market
+
+## What happened
+
+The check we had answers only this question: **how recently was this price published?** It does not answer: **how recently could a borrower transact on Arbitrum?** Those are independent properties.
+
+From 09:14 to 12:40 the sequencer outage denied ordinary users the standard L2 read/write path. Their collateral-add transactions could not be included, while the wstETH market continued moving elsewhere. No liquidation could execute during the halt either, so the problem remained latent.
+
+On recovery, two things became possible at nearly the same time:
+
+1. the oracle published/caught up to the current, 11%-lower market price; and
+2. keepers could submit liquidations again.
+
+Consequently, the oracle round used by each liquidation really was only seconds old. `block.timestamp - updatedAt <= 3600` correctly passed. The borrowers nevertheless had had zero usable reaction time: their last practical opportunity to act was before the outage, when that lower price did not yet exist, and keepers won the race in the first recovery blocks.
+
+The 86,400-second heartbeat and our 3,600-second maximum age are not the relevant protection. A heartbeat/age check protects against an old market observation. Tightening it further can make the recovery cliff sharper, not fairer: liquidation is enabled as soon as the first fresh post-outage observation arrives. The missing control was **sequencer availability plus a post-recovery grace period**.
+
+## Required change
+
+Integrate Chainlink's Arbitrum Sequencer Uptime Feed (Arbitrum One proxy `0xFdB631F5EE196F0ed6FAa767959853A9F217697D`) and fail closed for liquidation when:
+
+- the uptime feed's `answer` is not `0` (`0` means up; `1` means down);
+- `startedAt` is zero (the Arbitrum uptime feed is uninitialized);
+- `startedAt` is in the future or otherwise yields an invalid elapsed time; or
+- less than the configured recovery grace period has elapsed since `startedAt`, which is the time the current "up" status began.
+
+For example:
+
+```solidity
+AggregatorV3Interface constant SEQUENCER_UPTIME_FEED =
+    AggregatorV3Interface(0xFdB631F5EE196F0ed6FAa767959853A9F217697D);
+
+uint256 constant SEQUENCER_GRACE_PERIOD = 1 hours; // governance/risk parameter
+
+error SequencerUnavailable();
+error SequencerGracePeriod();
+
+function _requireLiquidationsAvailable() internal view {
+    (, int256 status, uint256 startedAt,,) =
+        SEQUENCER_UPTIME_FEED.latestRoundData();
+
+    // Fail closed on down or an unexpected status.
+    if (status != 0) revert SequencerUnavailable();
+
+    // On Arbitrum, zero can mean the uptime feed has not initialized.
+    if (startedAt == 0 || startedAt > block.timestamp) {
+        revert SequencerUnavailable();
+    }
+
+    if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) {
+        revert SequencerGracePeriod();
+    }
+}
+```
+
+The uptime-feed call reverting must also make the liquidation revert; it must not be caught and treated as "up." The boundary (`<=` above versus `<`) should match the protocol's stated grace-period semantics and tests.
+
+## Where it goes in the flow
+
+Call `_requireLiquidationsAvailable()` at the **entry to every liquidation path**, before reading a collateral price, deciding that an account is unhealthy, transferring collateral, repaying debt, or paying a keeper incentive:
+
+```solidity
+function liquidate(address borrower, uint256 repayAmount) external {
+    _requireLiquidationsAvailable(); // availability/fair-access gate first
+
+    uint256 price = _readFreshPositiveCollateralPrice(); // existing checks retained
+    _liquidateUsingPrice(borrower, repayAmount, price);
+}
+```
+
+The same guard must cover batch liquidations, keeper-only endpoints, callbacks, and any internal route that can produce liquidation effects; otherwise the unguarded route is a bypass. Putting the check only in the app or keeper is insufficient because enforcement must be onchain. Putting it only in a general oracle helper is also undesirable if that helper is used by rescue actions.
+
+During the recovery grace period, keep **risk-reducing borrower actions** available—notably adding collateral and repaying USDC—while liquidation stays disabled. Borrowing more and withdrawing collateral may be paused under the same recovery policy. This is what turns the grace period into an actual opportunity to cure positions rather than merely a delay.
+
+Keep the existing positive-answer and price-age checks after the sequencer gate. They address a different failure mode and remain necessary. Also validate the feed configuration and price-feed decimals/round behavior as part of the existing oracle integration.
+
+The one-hour value is Chainlink's example, not a fact implied by the price heartbeat. Risk governance should choose and document a period long enough for RPCs, wallets, the app, and oracle delivery to normalize and for users to get transactions included; it can be longer than one hour. Alerting and an emergency pause are useful defense in depth, but neither replaces this deterministic onchain gate.
+
+Reference: [Chainlink L2 Sequencer Uptime Feeds](https://docs.chain.link/data-feeds/l2-sequencer-feeds).

tokens used
29,975
````

## final message

Created [answer.md](/tmp/ethskills-audit-eval/2026-09-04T155033Z-codex-no-skill-3/audit-quiz-001/answer.md) with the post-mortem, sequencer-uptime guard, recovery grace period, and exact placement in every liquidation path.
