# Post-mortem: fresh price, unfair liquidation window

The stale-price check worked, but it was checking the wrong failure mode.

`updatedAt` tells us when the Chainlink price round was published. It does not
tell us whether Arbitrum users had a usable chance to transact before that price
was applied against them.

During the 09:14-12:40 UTC outage, no ordinary borrower could get an Arbitrum
transaction included. ETH continued repricing everywhere else. When the
sequencer came back, the oracle could immediately publish a fresh wstETH/ETH or
wstETH/USD price reflecting the 11% move. At that point:

```solidity
block.timestamp - updatedAt <= 3600
```

was true because the oracle update had just happened. The price was fresh and
accurate. But it was also the first price borrowers saw after a period where
they had no practical L2 execution path to add collateral or repay. Keeper bots
then competed in the same first post-recovery blocks, so liquidation access
returned at the same time as the new adverse price, with no borrower reaction
window.

So the root cause is not stale oracle data. The root cause is missing L2
sequencer-liveness handling in the liquidation flow. Price freshness protects
against old market data. It does not protect against a chain outage followed by
a fresh price update and immediate liquidations.

## Change

Add the Chainlink L2 Sequencer Uptime Feed for Arbitrum One and enforce a
post-recovery grace period before any liquidation or other adverse
price-dependent action can execute.

For Arbitrum One, the current Chainlink sequencer uptime feed proxy is:

```text
0xFdB631F5EE196F0ed6FAa767959853A9F217697D
```

Use it in addition to the existing collateral price feed.

Example guard:

```solidity
uint256 public constant SEQUENCER_GRACE_PERIOD = 1 hours;
AggregatorV3Interface public immutable sequencerUptimeFeed;

error SequencerDown();
error SequencerGracePeriod();
error SequencerFeedUninitialized();

function _checkSequencerForLiquidation() internal view {
    (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        ,
        uint80 answeredInRound
    ) = sequencerUptimeFeed.latestRoundData();

    if (startedAt == 0 || answeredInRound < roundId) {
        revert SequencerFeedUninitialized();
    }

    // Chainlink L2 sequencer feeds use 0 = up, 1 = down.
    if (answer != 0) {
        revert SequencerDown();
    }

    if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) {
        revert SequencerGracePeriod();
    }
}
```

Keep the existing price freshness check:

```solidity
function _readFreshCollateralPrice() internal view returns (uint256 price) {
    (, int256 answer, , uint256 updatedAt, ) = feed.latestRoundData();
    require(answer > 0, "bad price");
    require(block.timestamp - updatedAt <= 3600, "stale price");
    return uint256(answer);
}
```

## Where it goes

Put the sequencer guard at the start of `liquidate`, before the health-factor
calculation reads the price and before any collateral/debt state is changed:

```solidity
function liquidate(address borrower, uint256 repayAmount) external {
    _checkSequencerForLiquidation();

    uint256 price = _readFreshCollateralPrice();
    require(_collateralization(borrower, price) < 1.25e18, "healthy");

    _executeLiquidation(borrower, repayAmount, price);
}
```

Also apply the same guard to actions that let an account worsen risk during the
post-outage grace period, such as:

- borrowing more USDC;
- withdrawing collateral;
- increasing leverage;
- opening new positions if they depend on the same live price.

Do not put this guard on defensive actions. Borrowers must be able to recover
while the grace period is running:

- add collateral: allowed;
- repay debt: allowed;
- close debt: allowed;
- reduce leverage: allowed.

In other words, after the sequencer comes back the protocol should enter a
temporary recovery mode:

```text
sequencer down:      no normal L2 execution; liquidations must revert if reached
sequencer just up:   liquidations and risk-increasing actions revert
grace period:        users may add collateral or repay
grace elapsed:       normal liquidation flow resumes
```

The correct invariant is:

> A position cannot be liquidated using the first fresh oracle price after an L2
> sequencer outage until borrowers have had a defined on-chain grace period to
> react.

That is the missing protection. The stale-price check should stay, but it must
be paired with sequencer status plus a grace period on Arbitrum.

Reference: Chainlink L2 Sequencer Uptime Feeds,
https://docs.chain.link/data-feeds/l2-sequencer-feeds
