# Post-mortem explanation

The freshness check was working, but it was checking the wrong failure mode.

`updatedAt` on the collateral price feed answers this question:

> Was the oracle value recently published on this chain?

It does not answer this question:

> Did borrowers have a fair chance to transact on this chain before this price became enforceable?

During the Arbitrum outage, the market was effectively closed for users. They could not add collateral, repay debt, or otherwise defend their accounts. The rest of the world was not closed: ETH kept trading on Binance and mainnet DEXes, and the economically correct wstETH/ETH/USDC price moved down.

When Arbitrum started producing blocks again, the oracle could publish a fresh price that incorporated the whole off-chain/mainnet move. That update had a new on-chain timestamp, so this check passed:

```solidity
require(block.timestamp - updatedAt <= 3600, "stale price");
```

The price was fresh in the oracle sense. It was also accurate. The bug was that the protocol immediately allowed liquidations against a price movement that accumulated while borrowers had no access to the chain.

So the 38 users were not liquidated because the protocol accepted a stale price. They were liquidated because the protocol treated "fresh after sequencer recovery" as equivalent to "users had time to react." Those are different properties.

This is an L2 sequencer-liveness failure, not an oracle-freshness failure.

# Required change

Add an Arbitrum sequencer uptime check and a post-recovery grace period before liquidations may use oracle prices.

Use Chainlink's L2 Sequencer Uptime Feed for Arbitrum One. The feed reports whether the sequencer is down or up. If it is down, liquidations must be disabled. If it has just come back up, liquidations must remain disabled until a configured grace period has elapsed.

The grace period should be long enough for borrowers to get rescue transactions included after service returns. A common starting value is one hour, but the value should be a governance/configured risk parameter based on the market's collateral volatility, liquidation penalty, keeper speed, UI/RPC behavior, and expected user response time.

Example shape:

```solidity
AggregatorV3Interface public immutable priceFeed;
AggregatorV3Interface public immutable sequencerUptimeFeed;

uint256 public constant PRICE_STALE_AFTER = 1 hours;
uint256 public constant SEQUENCER_GRACE_PERIOD = 1 hours;

error SequencerDown();
error SequencerGracePeriod();
error BadPrice();
error StalePrice();

function _requireSequencerLiveForLiquidation() internal view {
    (
        ,
        int256 answer,
        uint256 startedAt,
        ,
    ) = sequencerUptimeFeed.latestRoundData();

    // Chainlink L2 sequencer feeds use 0 for up and 1 for down.
    if (answer != 0) revert SequencerDown();

    // `startedAt` is the time the current sequencer status began.
    // If the sequencer only recently came back up, borrowers have not yet
    // had a reasonable chance to add collateral or repay.
    if (startedAt == 0 || block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) {
        revert SequencerGracePeriod();
    }
}

function _readCollateralPrice() internal view returns (uint256 price) {
    (
        ,
        int256 answer,
        ,
        uint256 updatedAt,
    ) = priceFeed.latestRoundData();

    if (answer <= 0) revert BadPrice();
    if (block.timestamp - updatedAt > PRICE_STALE_AFTER) revert StalePrice();

    return uint256(answer);
}
```

# Where it goes in the flow

Put the sequencer-liveness gate in the liquidation path before the protocol reads the price for liquidation eligibility or executes any liquidation state changes.

The liquidation flow should become:

```solidity
function liquidate(address borrower, ...) external {
    _requireSequencerLiveForLiquidation();

    uint256 collateralPrice = _readCollateralPrice();
    uint256 healthFactor = _healthFactor(borrower, collateralPrice);

    require(healthFactor < LIQUIDATION_THRESHOLD, "not liquidatable");

    _executeLiquidation(borrower, ...);
}
```

Also apply the same gate to any other entry point that can seize collateral, mark an account liquidatable, start an auction, crystallize bad debt, or otherwise enforce insolvency using oracle prices.

Do not simply put this as a global protocol pause around all actions. During the recovery window, borrowers should still be able to improve their position: add collateral, repay debt, close debt, cancel risky orders, or otherwise reduce leverage. The thing that should be delayed is adverse enforcement based on the newly caught-up price.

# Why the existing stale check stays

Keep the existing price freshness check. It protects against old oracle data.

Add the sequencer check alongside it because it protects against a different condition: a fresh and accurate price becoming enforceable immediately after a period when users could not transact.

In short:

- Price freshness says: "Is this price recent?"
- Sequencer liveness says: "Was the market reachable?"
- Grace period says: "Have users had time to react after it became reachable again?"

The incident happened because the protocol had the first check but not the second and third.
