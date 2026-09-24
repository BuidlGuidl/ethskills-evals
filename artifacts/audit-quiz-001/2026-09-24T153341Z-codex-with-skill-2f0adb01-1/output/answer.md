The liquidation price was fresh, but the market was not fair.

The existing check only proves one thing: the Chainlink collateral price used by
the protocol was recently updated on Arbitrum.

It does not prove that borrowers had been able to transact on Arbitrum before
that price became usable for liquidations.

During the 09:14-12:40 UTC outage, Arbitrum's sequencer was unavailable. No
normal user transactions were being included, so borrowers could not add
collateral, repay debt, close positions, or otherwise respond to the falling ETH
price. Meanwhile, the offchain market kept moving. When the sequencer came back,
the oracle update reflecting the 11% ETH move was posted and had a very recent
`updatedAt`. Your freshness check therefore passed exactly as designed:

```solidity
require(block.timestamp - updatedAt <= 3600, "stale price");
```

But that check answered the wrong question. It asked, "Is this price recent?"
The post-mortem question is, "Was the chain live long enough for users to react
to this new price before liquidation was allowed?"

The answer was no. The first live blocks after recovery gave keepers a fresh,
correct, liquidation-triggering price while borrowers had zero prior inclusion
opportunity on that same chain. The outage compressed three and a half hours of
market movement into the first usable L2 blocks. The protocol treated those
blocks as normal because the oracle was fresh, but for borrowers they were the
first chance to act.

This is the standard L2 sequencer-liveness failure mode. Price freshness and
sequencer availability are separate safety properties. A feed can be fresh
seconds after recovery and still be unsafe to use for liquidations because users
were censored by downtime until that same moment.

The fix is to gate liquidation-critical price use on the Arbitrum Sequencer
Uptime Feed, with a grace period after recovery.

Add a sequencer check alongside the price oracle:

```solidity
interface AggregatorV3Interface {
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

AggregatorV3Interface public immutable sequencerUptimeFeed;
uint256 public constant SEQUENCER_GRACE_PERIOD = 1 hours; // choose by governance/risk

function _requireSequencerLiveForLiquidation() internal view {
    (, int256 answer, uint256 startedAt,,) = sequencerUptimeFeed.latestRoundData();

    // Chainlink L2 sequencer uptime feeds use answer == 0 for up, answer == 1 for down.
    require(answer == 0, "sequencer down");

    // After the sequencer comes back, give users time to add collateral or repay
    // before keepers can use the newly posted market price to liquidate them.
    require(block.timestamp - startedAt > SEQUENCER_GRACE_PERIOD, "sequencer grace");
}
```

Then call it in the liquidation flow before the protocol determines whether the
account is liquidatable:

```solidity
function liquidate(address borrower, ...) external {
    _requireSequencerLiveForLiquidation();

    uint256 collateralPrice = oracle.getCollateralPrice(); // still does answer > 0 and stale checks
    uint256 debtPrice = oracle.getDebtPrice();

    require(_collateralRatio(borrower, collateralPrice, debtPrice) < 1.25e18, "healthy");

    _executeLiquidation(borrower, ...);
}
```

The important placement is before the health-factor or collateralisation check
that makes the position liquidatable. If the protocol has a shared function such
as `_isLiquidatable`, `_healthFactor`, `_validateLiquidation`, or
`Oracle.getPriceForLiquidation`, put the sequencer guard there so every
liquidation path inherits it.

Do not put this guard in front of borrower-rescue actions such as adding
collateral or repaying debt. Those should remain available immediately when the
chain is live again. The grace period should block liquidations and other
adverse oracle-driven actions, while allowing users to improve their positions.

Keep the existing price freshness checks. They are still necessary, but they are
not sufficient on L2. The complete invariant should be:

1. The price answer is valid.
2. The price answer is fresh.
3. The L2 sequencer is currently up.
4. The sequencer has been up for long enough that users had a reasonable chance
   to react before liquidation.

In this incident, conditions 1 and 2 held. Conditions 3 and 4 were missing from
the liquidation path, so a fresh and correct price was used at a moment when the
borrowers had not yet had any practical ability to respond to it.
