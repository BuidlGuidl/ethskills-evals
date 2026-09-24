# Post-mortem: 38 liquidations at 12:41 UTC

## What happened

The price was right. The problem was that **the chain itself was down**, and your contract had no way to know that.

Arbitrum One orders transactions through a single **sequencer** (the operator node that puts transactions into blocks). From 09:14 to 12:40 it was offline:

- No L2 blocks were made, so the explorer showed nothing new.
- User transactions (add collateral, repay) sat unconfirmed.
- The Chainlink wstETH price feed on Arbitrum also could not update, because it writes on the same chain.
- Off-chain, ETH fell 11%.

Your freshness check only answers one question: "Is this price recent?" It cannot answer the question that mattered here: "Have users had a fair chance to react to this price?"

The bug shows up the moment the sequencer comes back:

1. The first Chainlink update after restart lands with `updatedAt` at about 12:41. It shows the full 11% drop in one step.
2. `block.timestamp - updatedAt` is only a few seconds, so the check passes. This is correct: the price really is fresh.
3. Keeper bots watch for the restart and send liquidations at once. They are faster than people reloading a dApp, and they often pay more for priority. Their transactions land in the same first blocks as the new price.
4. Borrowers who had been locked out for 3.5 hours meet the new price at the same moment as the liquidators. Their first real chance to add collateral comes **after** they have already been liquidated.

The staleness check can't catch this even in principle. During the outage no L2 blocks existed, so no transaction ever ran with a stale price. By the time any code ran again, the price was fresh. The unsafe part was the **gap in time**, not the price.

(Arbitrum does have a slow bypass: sending a transaction through L1 via the delayed inbox. But force-inclusion only kicks in after about 24h, and ordinary users won't find it from an app. In practice they had no way out.)

## The fix: check the L2 Sequencer Uptime Feed, then wait a grace period

Chainlink runs a **Sequencer Uptime Feed** on Arbitrum One:

- **Address:** `0xFdB631F5EE196F0ed6FAa767959853A9F217697D`
- **Meaning of `answer`:** 0 = up, 1 = down
- **Meaning of `startedAt`:** when the current status began

Its updates start on L1 and reach L2 through the delayed inbox. So the "down" and "back up" events are recorded on L2 **before** any post-restart transaction, including the keepers' ones. That makes it safe to rely on in exactly this situation.

### Code

```solidity
AggregatorV2V3Interface public immutable sequencerUptimeFeed; // 0xFdB631F5EE196F0ed6FAa767959853A9F217697D
uint256 public constant GRACE_PERIOD = 3600; // time users get after restart

error SequencerDown();
error GracePeriodNotOver();

function _checkSequencer() internal view {
    (, int256 answer, uint256 startedAt, , ) = sequencerUptimeFeed.latestRoundData();
    // answer: 0 = up, 1 = down
    if (answer != 0) revert SequencerDown();
    // startedAt == 0 means the feed round is not initialised yet (possible on Arbitrum)
    if (startedAt == 0) revert SequencerDown();
    if (block.timestamp - startedAt <= GRACE_PERIOD) revert GracePeriodNotOver();
}
```

### Where it goes

Don't put this inside the general `getPrice()` used by every action. That would also block repay and add-collateral, which are the exact actions users need during the grace period. Gate each action instead:

| Action | Sequencer down | During grace period | Why |
|---|---|---|---|
| `liquidate` | **block** | **block** | This is the fix: borrowers get time to top up first. |
| `borrow` / increase debt | block | block | Stops anyone opening risky positions against a price that just jumped. |
| `withdrawCollateral` | block | block | Same reason: it lowers the health factor. |
| `addCollateral` / `repay` | allow | **allow** | This is the whole point of the grace period. |

In the liquidation path, the order should be:

```
liquidate():
  _checkSequencer();        // 1. is the chain up, and has the grace period passed?
  price = _getPrice();      // 2. your existing answer > 0 and staleness checks
  require(hf < 1.25e18);    // 3. the existing solvency logic
  ...
```

Keep the existing `answer > 0` and staleness checks as they are. They guard against a different failure: the feed stops updating while the chain keeps running.

## Tuning and follow-ups

- **Grace period.** 1h is Chainlink's reference value and what Aave's `PriceOracleSentinel` uses. It's a trade-off. Too long, and a position that is truly insolvent sinks deeper into bad debt while liquidation is paused. Too short, and users get no real chance to react. With 38 users, a 125% threshold and an 11% move, 1h is a reasonable start. Make it settable by governance, within set limits.
- **Staleness bound vs heartbeat.** You set a 3600s bound on a feed whose heartbeat is 86400s. That means that in a calm market, where the price moves less than the deviation threshold, the feed can legitimately go up to 24h without an update. Your check will then revert every price read, including liquidations. It's a separate risk from this incident but worth fixing. Set the bound to heartbeat plus a margin, or read a feed with a shorter heartbeat.
- **Frontend.** Read the same uptime feed and show a "sequencer down / grace period ends at X" banner. That tells users when they can act.
- **Remediation for the 38.** Their liquidations came from a missing protocol check, not from user error. Consider paying back the liquidation bonus that was taken from them.
