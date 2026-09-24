# Post-mortem answer

The stale-price check was working, but it was checking the wrong failure mode.

`updatedAt <= 1 hours ago` answers only: "was the oracle value recently published on this chain?" It does not answer: "did borrowers have a fair opportunity to react to the market move before this price became liquidatable?"

During 09:14-12:40 UTC, Arbitrum was unavailable from the users' point of view. No borrower could add wstETH, repay USDC, or otherwise repair a position. Meanwhile the external ETH market kept moving. When the sequencer resumed, Chainlink published a fresh price reflecting the 11% move. That price was correct and recent, so this passed:

```solidity
require(block.timestamp - updatedAt <= 3600, "stale price");
```

The problem is that the first usable post-outage price compressed three and a half hours of off-chain market movement into the first few L2 blocks after recovery. Keeper bots could react in those blocks. Borrowers could not have reacted during the outage, and they had no protocol-level grace period after the outage. So the protocol allowed liquidations at a fresh, accurate price before affected users had any realistic chance to defend their positions.

This is a sequencer-liveness / post-recovery grace-period bug, not an oracle-staleness bug.

## Required change

Add the Arbitrum Chainlink L2 Sequencer Uptime Feed to the oracle/risk layer and use it to gate liquidations.

The liquidation flow should become:

```solidity
function liquidate(address borrower, ...) external {
    _revertIfSequencerDown();
    _revertIfSequencerGracePeriodActive();

    uint256 price = oracle.getFreshPrice(); // existing answer > 0 and updatedAt check
    _accrueInterest(borrower);
    _requireLiquidatable(borrower, price);
    _executeLiquidation(borrower, ...);
}
```

The uptime check should read the sequencer feed before the asset price is used for liquidation:

```solidity
function _checkSequencerForLiquidation() internal view {
    (, int256 answer, uint256 startedAt,,) =
        sequencerUptimeFeed.latestRoundData();

    require(answer == 0, "sequencer down"); // 0 = up, 1 = down
    require(startedAt != 0, "sequencer status unknown");
    require(block.timestamp - startedAt > LIQUIDATION_GRACE_PERIOD, "sequencer grace");
}
```

`LIQUIDATION_GRACE_PERIOD` should be long enough for normal users, not just keepers, to get transactions included after recovery. At minimum use one hour; for a three-and-a-half-hour outage, a policy such as `max(1 hours, outageDuration)` capped by governance is more borrower-protective. If the uptime feed only gives the latest transition time, track downtime internally or via an operations-controlled circuit breaker so the protocol can enforce an outage-length-based grace window.

## Where it belongs

Put the sequencer guard in the protocol's liquidation eligibility path, before reading or applying the collateral price for liquidation. Any function that can seize collateral, mark a position liquidatable, start a liquidation auction, or batch-liquidate accounts must go through this same guard.

Do not put the same revert in front of all user actions. During the grace period:

- allow `addCollateral`, `repay`, `close`, and other risk-reducing actions;
- block `liquidate`, `batchLiquidate`, auction starts, and keeper sweeps;
- block or conservatively restrict risk-increasing actions such as new borrows, collateral withdrawals, leverage increases, and position transfers that worsen health.

Keep the existing Chainlink price checks as well:

```solidity
require(answer > 0, "bad price");
require(block.timestamp - updatedAt <= maxPriceAge, "stale price");
```

They protect against stale or invalid oracle rounds. The new sequencer/grace guard protects against a different condition: a fresh price arriving immediately after a period when borrowers could not transact.

The incident happened because those two notions were treated as the same. They are not. A price can be perfectly fresh and still be unfair to liquidate against if the chain was unavailable until moments before that price was applied.
