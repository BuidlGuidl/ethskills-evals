# Post-mortem explanation

The freshness check worked, but it was checking the wrong kind of freshness for this failure.

`updatedAt` tells us when the oracle answer was published. It does not tell us whether borrowers had a fair chance to transact before that answer became usable for liquidation.

During the Arbitrum outage, the market kept moving elsewhere while users could not submit effective transactions on Arbitrum. ETH/wstETH repriced on Binance, mainnet DEXes, and the oracle's upstream markets. When Arbitrum service returned, the oracle quickly published a current price on L2. That made this check pass:

```solidity
require(block.timestamp - updatedAt <= 3600, "stale price");
```

The answer was fresh relative to the first post-outage L2 blocks. It was also economically abrupt from the borrowers' point of view, because the price movement accumulated while the chain was unavailable to them. The protocol treated the first fresh post-outage price as immediately actionable, so keepers could liquidate before borrowers had any post-recovery window to add collateral or repay debt.

So the incident was:

1. The sequencer / L2 was unavailable.
2. Borrowers could not perform risk-reducing actions.
3. External markets moved sharply during that unavailable window.
4. The oracle updated promptly after service returned.
5. The price passed the staleness check.
6. Liquidations were allowed immediately, with no sequencer-recovery grace period.

This is why the price was fresh and correct, yet still unfairly actionable.

# Required change

Add an Arbitrum Sequencer Uptime Feed check, and enforce a grace period after the sequencer comes back up before allowing liquidations.

This must not replace the oracle freshness check. It is an additional precondition that answers a different question:

- Oracle freshness: "Is this price recent?"
- Sequencer availability: "Have users had time to react on this chain since service resumed?"

The liquidation flow should become:

1. Enter `liquidate(...)`.
2. Check the Arbitrum sequencer uptime feed.
3. If the sequencer is down, revert.
4. If the sequencer has recently come back up, revert until the grace period has elapsed.
5. Read the collateral price feed.
6. Apply the existing `answer > 0` and `block.timestamp - updatedAt <= 3600` checks.
7. Compute collateralisation.
8. Allow liquidation only if the position is still below 125%.

Example shape:

```solidity
AggregatorV3Interface public immutable sequencerUptimeFeed;
uint256 public constant SEQUENCER_GRACE_PERIOD = 1 hours;

function _checkSequencerUp() internal view {
    (, int256 answer, uint256 startedAt, , ) = sequencerUptimeFeed.latestRoundData();

    // Chainlink L2 Sequencer Uptime Feeds use answer == 0 for up, answer == 1 for down.
    require(answer == 0, "sequencer down");

    // After recovery, give users time to add collateral or repay before keepers can liquidate.
    require(block.timestamp - startedAt > SEQUENCER_GRACE_PERIOD, "sequencer grace period");
}

function liquidate(...) external {
    _checkSequencerUp();

    (, int256 answer, , uint256 updatedAt, ) = collateralFeed.latestRoundData();
    require(answer > 0, "bad price");
    require(block.timestamp - updatedAt <= 3600, "stale price");

    // existing health-factor / collateralisation check
    // existing liquidation execution
}
```

Place this gate on liquidation and any other user-adverse action that uses the oracle price to seize collateral or worsen a user's position. Do not put the same block in front of risk-reducing user actions such as adding collateral or repaying debt; those should remain available as soon as the chain is usable. For risk-increasing actions such as new borrows or collateral withdrawals, either keep them blocked during the same grace period or apply the protocol's existing conservative pause rules.

The key fix is the grace period after sequencer recovery. A one-hour stale-price bound only proves the oracle has caught up. It does not prove users had one hour of chain access before liquidation.
