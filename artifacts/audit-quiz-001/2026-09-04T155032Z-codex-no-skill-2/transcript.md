# Executor transcript — 2026-09-04T155032Z-codex-no-skill-2

**executor**: codex  |  **model**: gpt-5.6-sol  |  **exit**: 0
**workspace**: /tmp/ethskills-audit-eval/2026-09-04T155032Z-codex-no-skill-2/audit-quiz-001

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /tmp/ethskills-audit-eval/2026-09-04T155032Z-codex-no-skill-2/audit-quiz-001
model: gpt-5.6-sol
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a06d21-aefc-7291-b9aa-aa19220c0437
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
I’ll trace the failure as a liveness-versus-freshness issue, then turn it into a concrete liquidation-flow change with explicit recovery behavior and edge cases. I’ll inspect the workspace instructions first and write the finished post-mortem to `answer.md`.
exec
/bin/bash -lc "ls -la && find .. -name AGENTS.md -print && rg --files -g '"'!answer.md'"' | head -100" in /tmp/ethskills-audit-eval/2026-09-04T155032Z-codex-no-skill-2/audit-quiz-001
 succeeded in 6ms:
TASK.md
package.json

exec
/bin/bash -lc "sed -n '1,240p' TASK.md && git status --short && cat package.json" in /tmp/ethskills-audit-eval/2026-09-04T155032Z-codex-no-skill-2/audit-quiz-001
 succeeded in 5ms:
{
  "name": "eval-workspace",
  "private": true
}

codex
The key distinction is confirmed: the existing check proves only that the oracle observation is recent. It says nothing about whether borrowers had recent transaction access. I’m placing a sequencer-recovery gate ahead of liquidation eligibility, while keeping collateral deposits and repayments usable during the recovery window.
apply patch
patch: completed
/tmp/ethskills-audit-eval/2026-09-04T155032Z-codex-no-skill-2/audit-quiz-001/answer.md
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..7bd7516ebe4b3f8af20ce6285cb1b89d7271fbf5
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,75 @@
+# Post-mortem: fresh price, unavailable market
+
+The freshness check worked, but it checked the wrong failure mode.
+
+`updatedAt` answers: **“How recently was this oracle answer published?”** It does not answer: **“Have borrowers had a fair opportunity to transact since the chain became usable?”** Oracle freshness and L2 transaction availability are independent properties.
+
+While the Arbitrum sequencer was unavailable, borrowers could not get collateral-deposit transactions ordered into L2 blocks. The external ETH market nevertheless fell 11%. When sequencing resumed, the oracle transmitted the current lower price. That made the new round only seconds old, so the one-hour freshness check correctly passed. In that same recovery block race, keepers' liquidation transactions were ordered before the borrowers' rescue transactions. The contracts therefore saw both a fresh, correct price and undercollateralised accounts. Nothing in the existing logic represented the three-and-a-half-hour loss of user access or required a reaction period after access returned.
+
+This was not a stale-oracle incident. It was an **L2 liveness/recovery-ordering incident**: a fresh post-outage price caused a discontinuous repricing before users were given an executable response window. A tighter price-age limit cannot fix that. In fact, because the collateral feed permits an 86,400-second heartbeat, an unconditional 3,600-second maximum age can also unnecessarily halt the market during a quiet period in which no deviation update occurs. Price validity must be configured against the feed's actual heartbeat/deviation policy; it is separate from the sequencer control.
+
+## Required change
+
+Integrate Chainlink's **Arbitrum Sequencer Uptime Feed** and add a post-recovery grace period. Check it before evaluating a position with the collateral price and before making any liquidation state change:
+
+```solidity
+AggregatorV3Interface public immutable sequencerUptimeFeed;
+
+// Governance-set and publicly documented. One hour is a common starting
+// value; choose a value long enough for users to observe recovery and obtain
+// inclusion under expected congestion.
+uint256 public constant SEQUENCER_GRACE_PERIOD = 1 hours;
+
+error SequencerDown();
+error SequencerGracePeriod();
+error InvalidSequencerStatus();
+
+function _requireSequencerHealthy() internal view {
+    (, int256 status, uint256 startedAt,,) =
+        sequencerUptimeFeed.latestRoundData();
+
+    // For this feed: 0 = up, 1 = down. Unknown values fail closed.
+    if (status == 1) revert SequencerDown();
+    if (status != 0 || startedAt == 0 || startedAt > block.timestamp) {
+        revert InvalidSequencerStatus();
+    }
+
+    // startedAt is the time of the latest status transition. When status is
+    // up, this is when the sequencer most recently recovered.
+    if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) {
+        revert SequencerGracePeriod();
+    }
+}
+
+function liquidate(address borrower, /* ... */) external {
+    _requireSequencerHealthy();       // first: outage/recovery eligibility
+    uint256 price = _validatedPrice(); // second: answer and feed-age checks
+    _liquidateIfUnsafe(borrower, price);
+}
+```
+
+`_validatedPrice()` should continue to reject non-positive values and should explicitly reject an unset or future timestamp before subtracting:
+
+```solidity
+function _validatedPrice() internal view returns (uint256) {
+    (, int256 answer,, uint256 updatedAt,) = feed.latestRoundData();
+    if (answer <= 0) revert BadPrice();
+    if (updatedAt == 0 || updatedAt > block.timestamp) revert BadPriceTime();
+    if (block.timestamp - updatedAt > MAX_PRICE_AGE) revert StalePrice();
+    return uint256(answer);
+}
+```
+
+`MAX_PRICE_AGE` must be chosen consistently with the exact feed's documented heartbeat and deviation threshold (or the protocol must deliberately accept that a shorter bound can pause operations). It is not the sequencer grace period and must not be used as one.
+
+## Where the gate applies
+
+Apply the sequencer-health check at the common internal entry point used by **every liquidation path**—single, batch, delegated, callback, and any alternate collateral route—so it cannot be bypassed. The check must occur before health-factor evaluation and before transfers, debt burns, or collateral seizure. A batch must revert while the sequencer is down or within the grace period.
+
+Use the same fail-closed gate for user actions that create or increase insolvency risk, such as borrowing more, withdrawing collateral, or enabling riskier leverage. Do **not** gate risk-reducing actions during the post-recovery grace period: collateral deposits, debt repayments, and voluntary position closure must remain available. That asymmetry is the purpose of the grace period—borrowers can repair positions while keepers cannot seize them. Normal pause/reentrancy/access controls still apply.
+
+If the uptime-feed call fails, returns an unknown/uninitialised value, reports `down`, or has an impossible timestamp, liquidations and risk-increasing actions must fail closed. The protocol should alert on each of those states and on status transitions.
+
+Finally, the grace period is measured from the uptime feed's `startedAt` for the transition back to `up`, not from the collateral price's `updatedAt`, not from the first application transaction, and not from a locally observed RPC recovery time. Tests should cover down status, the exact recovery boundary, batch liquidation, unavailable/malformed uptime data, a fresh price immediately after recovery, and successful deposits/repayments while liquidations remain blocked.
+
+Had this gate existed, the price at 12:41 would still have been accepted as fresh and correct, but liquidation would have reverted until the recovery grace period expired. The 38 borrowers would have had that interval to get their already-attempted collateral additions or repayments included.

diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..7bd7516ebe4b3f8af20ce6285cb1b89d7271fbf5
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,75 @@
+# Post-mortem: fresh price, unavailable market
+
+The freshness check worked, but it checked the wrong failure mode.
+
+`updatedAt` answers: **“How recently was this oracle answer published?”** It does not answer: **“Have borrowers had a fair opportunity to transact since the chain became usable?”** Oracle freshness and L2 transaction availability are independent properties.
+
+While the Arbitrum sequencer was unavailable, borrowers could not get collateral-deposit transactions ordered into L2 blocks. The external ETH market nevertheless fell 11%. When sequencing resumed, the oracle transmitted the current lower price. That made the new round only seconds old, so the one-hour freshness check correctly passed. In that same recovery block race, keepers' liquidation transactions were ordered before the borrowers' rescue transactions. The contracts therefore saw both a fresh, correct price and undercollateralised accounts. Nothing in the existing logic represented the three-and-a-half-hour loss of user access or required a reaction period after access returned.
+
+This was not a stale-oracle incident. It was an **L2 liveness/recovery-ordering incident**: a fresh post-outage price caused a discontinuous repricing before users were given an executable response window. A tighter price-age limit cannot fix that. In fact, because the collateral feed permits an 86,400-second heartbeat, an unconditional 3,600-second maximum age can also unnecessarily halt the market during a quiet period in which no deviation update occurs. Price validity must be configured against the feed's actual heartbeat/deviation policy; it is separate from the sequencer control.
+
+## Required change
+
+Integrate Chainlink's **Arbitrum Sequencer Uptime Feed** and add a post-recovery grace period. Check it before evaluating a position with the collateral price and before making any liquidation state change:
+
+```solidity
+AggregatorV3Interface public immutable sequencerUptimeFeed;
+
+// Governance-set and publicly documented. One hour is a common starting
+// value; choose a value long enough for users to observe recovery and obtain
+// inclusion under expected congestion.
+uint256 public constant SEQUENCER_GRACE_PERIOD = 1 hours;
+
+error SequencerDown();
+error SequencerGracePeriod();
+error InvalidSequencerStatus();
+
+function _requireSequencerHealthy() internal view {
+    (, int256 status, uint256 startedAt,,) =
+        sequencerUptimeFeed.latestRoundData();
+
+    // For this feed: 0 = up, 1 = down. Unknown values fail closed.
+    if (status == 1) revert SequencerDown();
+    if (status != 0 || startedAt == 0 || startedAt > block.timestamp) {
+        revert InvalidSequencerStatus();
+    }
+
+    // startedAt is the time of the latest status transition. When status is
+    // up, this is when the sequencer most recently recovered.
+    if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) {
+        revert SequencerGracePeriod();
+    }
+}
+
+function liquidate(address borrower, /* ... */) external {
+    _requireSequencerHealthy();       // first: outage/recovery eligibility
+    uint256 price = _validatedPrice(); // second: answer and feed-age checks
+    _liquidateIfUnsafe(borrower, price);
+}
+```
+
+`_validatedPrice()` should continue to reject non-positive values and should explicitly reject an unset or future timestamp before subtracting:
+
+```solidity
+function _validatedPrice() internal view returns (uint256) {
+    (, int256 answer,, uint256 updatedAt,) = feed.latestRoundData();
+    if (answer <= 0) revert BadPrice();
+    if (updatedAt == 0 || updatedAt > block.timestamp) revert BadPriceTime();
+    if (block.timestamp - updatedAt > MAX_PRICE_AGE) revert StalePrice();
+    return uint256(answer);
+}
+```
+
+`MAX_PRICE_AGE` must be chosen consistently with the exact feed's documented heartbeat and deviation threshold (or the protocol must deliberately accept that a shorter bound can pause operations). It is not the sequencer grace period and must not be used as one.
+
+## Where the gate applies
+
+Apply the sequencer-health check at the common internal entry point used by **every liquidation path**—single, batch, delegated, callback, and any alternate collateral route—so it cannot be bypassed. The check must occur before health-factor evaluation and before transfers, debt burns, or collateral seizure. A batch must revert while the sequencer is down or within the grace period.
+
+Use the same fail-closed gate for user actions that create or increase insolvency risk, such as borrowing more, withdrawing collateral, or enabling riskier leverage. Do **not** gate risk-reducing actions during the post-recovery grace period: collateral deposits, debt repayments, and voluntary position closure must remain available. That asymmetry is the purpose of the grace period—borrowers can repair positions while keepers cannot seize them. Normal pause/reentrancy/access controls still apply.
+
+If the uptime-feed call fails, returns an unknown/uninitialised value, reports `down`, or has an impossible timestamp, liquidations and risk-increasing actions must fail closed. The protocol should alert on each of those states and on status transitions.
+
+Finally, the grace period is measured from the uptime feed's `startedAt` for the transition back to `up`, not from the collateral price's `updatedAt`, not from the first application transaction, and not from a locally observed RPC recovery time. Tests should cover down status, the exact recovery boundary, batch liquidation, unavailable/malformed uptime data, a fresh price immediately after recovery, and successful deposits/repayments while liquidations remain blocked.
+
+Had this gate existed, the price at 12:41 would still have been accepted as fresh and correct, but liquidation would have reverted until the recovery grace period expired. The 38 borrowers would have had that interval to get their already-attempted collateral additions or repayments included.

exec
/bin/bash -lc "sed -n '1,280p' answer.md && git diff --check && git status --short" in /tmp/ethskills-audit-eval/2026-09-04T155032Z-codex-no-skill-2/audit-quiz-001
 succeeded in 3ms:
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..7bd7516ebe4b3f8af20ce6285cb1b89d7271fbf5
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,75 @@
+# Post-mortem: fresh price, unavailable market
+
+The freshness check worked, but it checked the wrong failure mode.
+
+`updatedAt` answers: **“How recently was this oracle answer published?”** It does not answer: **“Have borrowers had a fair opportunity to transact since the chain became usable?”** Oracle freshness and L2 transaction availability are independent properties.
+
+While the Arbitrum sequencer was unavailable, borrowers could not get collateral-deposit transactions ordered into L2 blocks. The external ETH market nevertheless fell 11%. When sequencing resumed, the oracle transmitted the current lower price. That made the new round only seconds old, so the one-hour freshness check correctly passed. In that same recovery block race, keepers' liquidation transactions were ordered before the borrowers' rescue transactions. The contracts therefore saw both a fresh, correct price and undercollateralised accounts. Nothing in the existing logic represented the three-and-a-half-hour loss of user access or required a reaction period after access returned.
+
+This was not a stale-oracle incident. It was an **L2 liveness/recovery-ordering incident**: a fresh post-outage price caused a discontinuous repricing before users were given an executable response window. A tighter price-age limit cannot fix that. In fact, because the collateral feed permits an 86,400-second heartbeat, an unconditional 3,600-second maximum age can also unnecessarily halt the market during a quiet period in which no deviation update occurs. Price validity must be configured against the feed's actual heartbeat/deviation policy; it is separate from the sequencer control.
+
+## Required change
+
+Integrate Chainlink's **Arbitrum Sequencer Uptime Feed** and add a post-recovery grace period. Check it before evaluating a position with the collateral price and before making any liquidation state change:
+
+```solidity
+AggregatorV3Interface public immutable sequencerUptimeFeed;
+
+// Governance-set and publicly documented. One hour is a common starting
+// value; choose a value long enough for users to observe recovery and obtain
+// inclusion under expected congestion.
+uint256 public constant SEQUENCER_GRACE_PERIOD = 1 hours;
+
+error SequencerDown();
+error SequencerGracePeriod();
+error InvalidSequencerStatus();
+
+function _requireSequencerHealthy() internal view {
+    (, int256 status, uint256 startedAt,,) =
+        sequencerUptimeFeed.latestRoundData();
+
+    // For this feed: 0 = up, 1 = down. Unknown values fail closed.
+    if (status == 1) revert SequencerDown();
+    if (status != 0 || startedAt == 0 || startedAt > block.timestamp) {
+        revert InvalidSequencerStatus();
+    }
+
+    // startedAt is the time of the latest status transition. When status is
+    // up, this is when the sequencer most recently recovered.
+    if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) {
+        revert SequencerGracePeriod();
+    }
+}
+
+function liquidate(address borrower, /* ... */) external {
+    _requireSequencerHealthy();       // first: outage/recovery eligibility
+    uint256 price = _validatedPrice(); // second: answer and feed-age checks
+    _liquidateIfUnsafe(borrower, price);
+}
+```
+
+`_validatedPrice()` should continue to reject non-positive values and should explicitly reject an unset or future timestamp before subtracting:
+
+```solidity
+function _validatedPrice() internal view returns (uint256) {
+    (, int256 answer,, uint256 updatedAt,) = feed.latestRoundData();
+    if (answer <= 0) revert BadPrice();
+    if (updatedAt == 0 || updatedAt > block.timestamp) revert BadPriceTime();
+    if (block.timestamp - updatedAt > MAX_PRICE_AGE) revert StalePrice();
+    return uint256(answer);
+}
+```
+
+`MAX_PRICE_AGE` must be chosen consistently with the exact feed's documented heartbeat and deviation threshold (or the protocol must deliberately accept that a shorter bound can pause operations). It is not the sequencer grace period and must not be used as one.
+
+## Where the gate applies
+
+Apply the sequencer-health check at the common internal entry point used by **every liquidation path**—single, batch, delegated, callback, and any alternate collateral route—so it cannot be bypassed. The check must occur before health-factor evaluation and before transfers, debt burns, or collateral seizure. A batch must revert while the sequencer is down or within the grace period.
+
+Use the same fail-closed gate for user actions that create or increase insolvency risk, such as borrowing more, withdrawing collateral, or enabling riskier leverage. Do **not** gate risk-reducing actions during the post-recovery grace period: collateral deposits, debt repayments, and voluntary position closure must remain available. That asymmetry is the purpose of the grace period—borrowers can repair positions while keepers cannot seize them. Normal pause/reentrancy/access controls still apply.
+
+If the uptime-feed call fails, returns an unknown/uninitialised value, reports `down`, or has an impossible timestamp, liquidations and risk-increasing actions must fail closed. The protocol should alert on each of those states and on status transitions.
+
+Finally, the grace period is measured from the uptime feed's `startedAt` for the transition back to `up`, not from the collateral price's `updatedAt`, not from the first application transaction, and not from a locally observed RPC recovery time. Tests should cover down status, the exact recovery boundary, batch liquidation, unavailable/malformed uptime data, a fresh price immediately after recovery, and successful deposits/repayments while liquidations remain blocked.
+
+Had this gate existed, the price at 12:41 would still have been accepted as fresh and correct, but liquidation would have reverted until the recovery grace period expired. The 38 borrowers would have had that interval to get their already-attempted collateral additions or repayments included.

codex
Completed the post-mortem and remediation guidance in [answer.md](/tmp/ethskills-audit-eval/2026-09-04T155032Z-codex-no-skill-2/audit-quiz-001/answer.md).

It identifies the missing control as an Arbitrum Sequencer Uptime Feed check with a post-recovery grace period, applied before all liquidation and risk-increasing flows while leaving repayments and collateral deposits available.
diff --git a/answer.md b/answer.md
new file mode 100644
index 0000000000000000000000000000000000000000..7bd7516ebe4b3f8af20ce6285cb1b89d7271fbf5
--- /dev/null
+++ b/answer.md
@@ -0,0 +1,75 @@
+# Post-mortem: fresh price, unavailable market
+
+The freshness check worked, but it checked the wrong failure mode.
+
+`updatedAt` answers: **“How recently was this oracle answer published?”** It does not answer: **“Have borrowers had a fair opportunity to transact since the chain became usable?”** Oracle freshness and L2 transaction availability are independent properties.
+
+While the Arbitrum sequencer was unavailable, borrowers could not get collateral-deposit transactions ordered into L2 blocks. The external ETH market nevertheless fell 11%. When sequencing resumed, the oracle transmitted the current lower price. That made the new round only seconds old, so the one-hour freshness check correctly passed. In that same recovery block race, keepers' liquidation transactions were ordered before the borrowers' rescue transactions. The contracts therefore saw both a fresh, correct price and undercollateralised accounts. Nothing in the existing logic represented the three-and-a-half-hour loss of user access or required a reaction period after access returned.
+
+This was not a stale-oracle incident. It was an **L2 liveness/recovery-ordering incident**: a fresh post-outage price caused a discontinuous repricing before users were given an executable response window. A tighter price-age limit cannot fix that. In fact, because the collateral feed permits an 86,400-second heartbeat, an unconditional 3,600-second maximum age can also unnecessarily halt the market during a quiet period in which no deviation update occurs. Price validity must be configured against the feed's actual heartbeat/deviation policy; it is separate from the sequencer control.
+
+## Required change
+
+Integrate Chainlink's **Arbitrum Sequencer Uptime Feed** and add a post-recovery grace period. Check it before evaluating a position with the collateral price and before making any liquidation state change:
+
+```solidity
+AggregatorV3Interface public immutable sequencerUptimeFeed;
+
+// Governance-set and publicly documented. One hour is a common starting
+// value; choose a value long enough for users to observe recovery and obtain
+// inclusion under expected congestion.
+uint256 public constant SEQUENCER_GRACE_PERIOD = 1 hours;
+
+error SequencerDown();
+error SequencerGracePeriod();
+error InvalidSequencerStatus();
+
+function _requireSequencerHealthy() internal view {
+    (, int256 status, uint256 startedAt,,) =
+        sequencerUptimeFeed.latestRoundData();
+
+    // For this feed: 0 = up, 1 = down. Unknown values fail closed.
+    if (status == 1) revert SequencerDown();
+    if (status != 0 || startedAt == 0 || startedAt > block.timestamp) {
+        revert InvalidSequencerStatus();
+    }
+
+    // startedAt is the time of the latest status transition. When status is
+    // up, this is when the sequencer most recently recovered.
+    if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) {
+        revert SequencerGracePeriod();
+    }
+}
+
+function liquidate(address borrower, /* ... */) external {
+    _requireSequencerHealthy();       // first: outage/recovery eligibility
+    uint256 price = _validatedPrice(); // second: answer and feed-age checks
+    _liquidateIfUnsafe(borrower, price);
+}
+```
+
+`_validatedPrice()` should continue to reject non-positive values and should explicitly reject an unset or future timestamp before subtracting:
+
+```solidity
+function _validatedPrice() internal view returns (uint256) {
+    (, int256 answer,, uint256 updatedAt,) = feed.latestRoundData();
+    if (answer <= 0) revert BadPrice();
+    if (updatedAt == 0 || updatedAt > block.timestamp) revert BadPriceTime();
+    if (block.timestamp - updatedAt > MAX_PRICE_AGE) revert StalePrice();
+    return uint256(answer);
+}
+```
+
+`MAX_PRICE_AGE` must be chosen consistently with the exact feed's documented heartbeat and deviation threshold (or the protocol must deliberately accept that a shorter bound can pause operations). It is not the sequencer grace period and must not be used as one.
+
+## Where the gate applies
+
+Apply the sequencer-health check at the common internal entry point used by **every liquidation path**—single, batch, delegated, callback, and any alternate collateral route—so it cannot be bypassed. The check must occur before health-factor evaluation and before transfers, debt burns, or collateral seizure. A batch must revert while the sequencer is down or within the grace period.
+
+Use the same fail-closed gate for user actions that create or increase insolvency risk, such as borrowing more, withdrawing collateral, or enabling riskier leverage. Do **not** gate risk-reducing actions during the post-recovery grace period: collateral deposits, debt repayments, and voluntary position closure must remain available. That asymmetry is the purpose of the grace period—borrowers can repair positions while keepers cannot seize them. Normal pause/reentrancy/access controls still apply.
+
+If the uptime-feed call fails, returns an unknown/uninitialised value, reports `down`, or has an impossible timestamp, liquidations and risk-increasing actions must fail closed. The protocol should alert on each of those states and on status transitions.
+
+Finally, the grace period is measured from the uptime feed's `startedAt` for the transition back to `up`, not from the collateral price's `updatedAt`, not from the first application transaction, and not from a locally observed RPC recovery time. Tests should cover down status, the exact recovery boundary, batch liquidation, unavailable/malformed uptime data, a fresh price immediately after recovery, and successful deposits/repayments while liquidations remain blocked.
+
+Had this gate existed, the price at 12:41 would still have been accepted as fresh and correct, but liquidation would have reverted until the recovery grace period expired. The 38 borrowers would have had that interval to get their already-attempted collateral additions or repayments included.

tokens used
11,395
````

## final message

Completed the post-mortem and remediation guidance in [answer.md](/tmp/ethskills-audit-eval/2026-09-04T155032Z-codex-no-skill-2/audit-quiz-001/answer.md).

It identifies the missing control as an Arbitrum Sequencer Uptime Feed check with a post-recovery grace period, applied before all liquidation and risk-increasing flows while leaving repayments and collateral deposits available.
