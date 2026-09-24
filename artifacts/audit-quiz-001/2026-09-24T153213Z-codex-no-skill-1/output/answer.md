# What happened

The freshness check was answering the wrong question.

`updatedAt` tells us when the oracle round was published. It does not tell us
whether borrowers had a fair opportunity to react to the market move before that
round was used for liquidation.

During 09:14-12:40 UTC, Arbitrum was not producing usable blocks for our users.
The external market continued moving, so ETH/wstETH collateral value fell while
borrowers could not add collateral, repay, or otherwise repair their positions.
When Arbitrum resumed, the oracle quickly published a new round reflecting the
real market price. That round was genuinely fresh:

```solidity
block.timestamp - updatedAt <= 3600
```

passed because `updatedAt` was only seconds old. But that only proved the price
was current after the outage. It did not prove that the market had been live
while the price moved.

So the protocol used a correct, fresh, post-outage price immediately after
sequencer recovery. Keeper bots could transact in the first resumed blocks, but
borrowers had been unable to transact during the entire price move. The result
was economically unfair even though the price feed, staleness check, and
liquidation math all behaved exactly as written.

This is a sequencer-liveness failure, not an oracle-staleness failure.

# What we change

Add an Arbitrum sequencer uptime check, and enforce a liquidation grace period
after the sequencer comes back up.

Use Chainlink's L2 Sequencer Uptime Feed for Arbitrum. Before accepting an
oracle price for liquidation, read the sequencer feed:

```solidity
(
    ,
    int256 sequencerAnswer,
    uint256 startedAt,
    ,
) = sequencerUptimeFeed.latestRoundData();

require(startedAt != 0, "sequencer status unset");
require(sequencerAnswer == 0, "sequencer down");
require(block.timestamp - startedAt > LIQUIDATION_GRACE_PERIOD, "sequencer grace");
```

For Chainlink L2 sequencer feeds, `answer == 0` means the sequencer is up and
`answer == 1` means it is down. `startedAt` is the time the current sequencer
status began. After an outage, `startedAt` is the recovery time, so
`block.timestamp - startedAt` measures how long users have had to react since
the chain became usable again.

Then, only after that check passes, read and validate the collateral price:

```solidity
function _getPriceForLiquidation() internal view returns (uint256 price) {
    _requireSequencerUpAndGraceElapsed();

    (, int256 answer, , uint256 updatedAt, ) = feed.latestRoundData();
    require(answer > 0, "bad price");
    require(block.timestamp - updatedAt <= 3600, "stale price");

    return uint256(answer);
}
```

# Where it goes in the flow

The guard belongs in the price path used by liquidation eligibility, before the
health factor or collateralisation ratio is computed.

The liquidation flow should become:

1. `liquidate(positionId)` is called.
2. Protocol calls `_getPriceForLiquidation()`.
3. `_getPriceForLiquidation()` first checks the Arbitrum sequencer uptime feed.
4. If the sequencer is down, revert.
5. If the sequencer has only recently recovered, revert until the grace period
   has elapsed.
6. Then read the collateral price feed and apply the existing `answer > 0` and
   `updatedAt <= 3600` checks.
7. Compute collateralisation using that price.
8. Allow liquidation only if the position is still below 125%.

The grace period should be long enough for borrowers to observe the recovered
chain and submit protective transactions. During the grace period, liquidations
and other risk-increasing actions such as new borrowing or collateral withdrawal
should be blocked. Protective actions such as adding collateral and repaying debt
should remain allowed.

This fix does not replace the stale-price check. It adds the missing condition:
do not use a fresh post-outage price to liquidate users until the L2 has been
live again for a defined reaction window.
