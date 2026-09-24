# Post-mortem: fresh oracle, unavailable chain

The liquidation price was fresh, but the market was not actionable for borrowers.

The bug was treating Chainlink price freshness as if it also proved L2 execution
liveness. It does not. The check:

```solidity
(, int256 answer, , uint256 updatedAt, ) = feed.latestRoundData();
require(answer > 0, "bad price");
require(block.timestamp - updatedAt <= 3600, "stale price");
```

only answers one question: "was this oracle round updated recently?" In the
incident, the answer was yes. After Arbitrum started producing blocks again, the
oracle round had just been published and reflected the real 11% ETH move.

But from 09:14 to 12:40 UTC, borrowers could not execute defensive transactions
on Arbitrum. They could see the off-chain market falling, and they could submit
transactions from the app, but those transactions could not be included. When
service resumed, the protocol immediately accepted the new lower collateral
price and allowed liquidations in the first available blocks. Keepers had the
same restored execution access as borrowers, but liquidation bots are optimized
to win that race. So the protocol liquidated positions against a price that was
fresh, correct, and still unfairly unreactable.

This is a sequencer-liveness failure mode, not an oracle-staleness failure mode.
The missing invariant was: after an L2 outage, users must have a grace window to
repair positions before the protocol permits liquidations based on the post-outage
price.

## Change

Add the Arbitrum Chainlink L2 Sequencer Uptime Feed to the oracle/risk layer and
gate liquidation on it.

The sequencer feed reports whether the sequencer is up or down. For Chainlink L2
sequencer feeds, `answer == 0` means up and `answer == 1` means down. The
`startedAt` value is the timestamp of the current sequencer-status round, so when
the feed says "up", `block.timestamp - startedAt` is the time elapsed since
recovery.

Implement a guard like this:

```solidity
AggregatorV3Interface public immutable sequencerUptimeFeed;

uint256 public constant LIQUIDATION_GRACE_PERIOD = 1 hours;

function _requireSequencerUpForLiquidation() internal view {
    (, int256 status, uint256 startedAt, , ) =
        sequencerUptimeFeed.latestRoundData();

    require(startedAt != 0, "sequencer status unset");
    require(status == 0, "sequencer down");
    require(
        block.timestamp - startedAt > LIQUIDATION_GRACE_PERIOD,
        "sequencer grace period"
    );
}
```

Use a governance/config parameter rather than a magic constant if the market has
different risk tiers, but the important part is that it is a post-recovery
liquidation grace period, separate from the collateral price-feed freshness
threshold. One hour is the common minimum; for this market it should be long
enough for users to get collateral-add or repay transactions included after a
multi-hour outage.

## Where it goes

Put the sequencer guard at the start of every liquidation entrypoint, before the
health check, before reading the collateral price for liquidation, and before any
state mutation or token transfer:

```solidity
function liquidate(address borrower, uint256 repayAmount) external {
    _requireSequencerUpForLiquidation();

    _accrueInterest(borrower);

    uint256 collateralPrice = _readFreshCollateralPrice();
    require(_isLiquidatable(borrower, collateralPrice), "healthy");

    _executeLiquidation(borrower, repayAmount, collateralPrice);
}
```

Do the same for batch/sweep liquidation functions. Checking once at the top of a
batch is fine if the whole batch executes atomically under the same block
timestamp.

Do not put this guard on borrower rescue paths. `addCollateral()` and `repay()`
must remain callable immediately after the sequencer comes back. If those
functions currently call the same generic health-check code as borrow/withdraw,
split the flow:

- Safety-improving actions, such as adding collateral or repaying USDC, should
  be allowed during the grace period.
- Risk-increasing actions, such as borrowing more, withdrawing collateral, or
  opening new leverage, should either use the same sequencer/grace guard or be
  paused until the grace period has elapsed.
- Liquidation must be blocked while the sequencer is down and during the
  post-recovery grace period.

The existing price freshness check should stay. It protects against stale oracle
rounds. It just needs to be paired with a separate L2 sequencer-liveness and
post-recovery grace check so that a correct price is not used before borrowers
have had any realistic chance to react on-chain.
