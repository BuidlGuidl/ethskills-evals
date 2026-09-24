# Post-mortem: fresh oracle price, no borrower reaction window

The freshness check was working, but it was checking the wrong liveness property.

`updatedAt` on the collateral price feed only says when the oracle round was last
published on Arbitrum. It does not say that borrowers had a usable chain during
the market move, or that they had any chance to react before liquidations became
executable.

During 09:14-12:40 UTC the Arbitrum sequencer was unavailable. No borrower could
get an `addCollateral()` or `repay()` transaction executed, even though the
off-chain market continued to move and the true value of wstETH fell. When the
sequencer resumed, Chainlink posted a new price round reflecting the current
market. That made:

```solidity
require(block.timestamp - updatedAt <= 3600, "stale price");
```

pass correctly. The feed was fresh. The failure was that liquidation became
available immediately after the first post-outage price update, before users had
an executable recovery window.

So the sequence was:

1. Positions were healthy before the outage.
2. The chain stopped accepting/executing user defense transactions.
3. ETH/wstETH fell off-chain while users could not add collateral or repay.
4. The chain resumed.
5. The oracle updated seconds later with the real lower price.
6. Keepers liquidated in the first available blocks.

This is not an oracle-staleness bug. It is an L2 sequencer-liveness/liquidation
grace-period bug.

## Change to make

Add the Chainlink L2 sequencer uptime feed for Arbitrum and enforce a liquidation
grace period after the sequencer comes back up.

On Arbitrum, the uptime feed answer convention is:

```solidity
// answer == 0: sequencer is up
// answer == 1: sequencer is down
```

The check should be separate from the collateral price freshness check:

```solidity
AggregatorV3Interface public immutable sequencerUptimeFeed;
uint256 public constant SEQUENCER_GRACE_PERIOD = 1 hours;

error SequencerDown();
error SequencerGracePeriod();

function _requireSequencerLiveForLiquidation() internal view {
    (, int256 answer, uint256 startedAt,,) = sequencerUptimeFeed.latestRoundData();

    if (answer != 0) revert SequencerDown();

    // If the sequencer has only just come back, borrowers still have not had a
    // fair chance to submit defensive transactions.
    if (startedAt == 0 || block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) {
        revert SequencerGracePeriod();
    }
}
```

Then call it at the start of every liquidation entry point, before reading the
price and before checking the health factor:

```solidity
function liquidate(address borrower, uint256 repayAmount) external {
    _accrueInterest(borrower);
    _requireSequencerLiveForLiquidation();

    uint256 price = _getFreshCollateralPrice();
    require(_isLiquidatable(borrower, price), "healthy");

    _executeLiquidation(borrower, repayAmount, price);
}
```

Do the same for batch/sweep liquidation functions. A keeper should not be able to
route around the guard through `batchLiquidate()`, `liquidateMany()`, auction
creation, or any internal liquidation helper exposed by another entry point.

## Flow policy

During sequencer downtime:

- Block liquidations.
- Block new borrows and collateral withdrawals if they depend on current prices.
- Allow defensive actions that improve account safety: `addCollateral()`,
  `repay()`, `closePosition()`, and similar paths.

During the post-recovery grace period:

- Continue blocking liquidations.
- Continue blocking risk-increasing actions such as new borrows and collateral
  withdrawals.
- Allow users to add collateral or repay using the now-live chain.

After the grace period expires:

- Use the normal Chainlink price checks.
- Re-enable liquidation.

The existing price check should stay, but it is only one half of the invariant:

```solidity
require(answer > 0, "bad price");
require(block.timestamp - updatedAt <= PRICE_STALENESS_LIMIT, "stale price");
```

The missing invariant is:

```solidity
require(sequencerHasBeenUpLongEnough, "sequencer grace period");
```

Put differently: a price can be fresh and still be unfair to liquidate against if
the chain was unavailable for the entire period in which users needed to respond.
