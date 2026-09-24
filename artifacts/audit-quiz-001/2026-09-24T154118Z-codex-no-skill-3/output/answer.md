This was not a stale-oracle incident. It was a sequencer-liveness incident.

The `updatedAt` check only answers one question: "was this oracle round
published recently relative to the current Arbitrum block timestamp?"

During the outage, that question was not the question that mattered. From
09:14 to 12:40 UTC, borrowers could not get Arbitrum transactions included.
They could not add wstETH, repay USDC, or otherwise repair their positions on
the chain where the lending market lives. Meanwhile, the offchain and L1
market kept moving, and ETH fell by 11%.

When Arbitrum resumed, the oracle could publish a fresh, accurate post-drop
price within seconds. At that point:

```solidity
block.timestamp - updatedAt <= 3600
```

was true, because the oracle update was fresh. But the users' opportunity to
react was not fresh. It had been unavailable for the entire sequencer outage.

So the liquidations were valid according to the contract's price freshness
rule, but unfair according to the market's liveness assumptions. The protocol
allowed keepers to liquidate immediately using a price that became actionable
only after users had been unable to submit protective transactions for hours.

The missing check is the L2 sequencer uptime check. On Arbitrum, before using
an oracle price for liquidation-sensitive logic, the protocol must ask whether
the sequencer has been down recently, not only whether the price round is
recent.

Use Chainlink's Arbitrum Sequencer Uptime Feed in the price/risk path.

The flow should be:

1. Enter a price-sensitive action.

   This includes at least liquidation, opening new debt, increasing debt, and
   withdrawing collateral. Liquidation is the critical incident path.

2. Read the sequencer uptime feed before accepting the asset price.

   The uptime feed reports whether the L2 sequencer is currently down, and when
   the current status period began.

3. If the sequencer is down, revert price-sensitive actions.

   No liquidation should execute while the market cannot reliably accept user
   transactions.

4. If the sequencer has recently come back up, enforce a grace period.

   During this period, block liquidations and other risk-increasing actions.
   Allow risk-reducing user actions such as adding collateral and repaying debt.
   This gives borrowers a real onchain chance to react to the price move that
   occurred while the chain was unreachable.

5. Only after the sequencer is up and the grace period has elapsed should the
   contract read and use the collateral oracle price, including the existing
   `answer > 0` and `updatedAt` freshness checks.

In code shape, the guard belongs before the price is trusted for liquidation:

```solidity
function _checkSequencerUp() internal view {
    (, int256 answer, uint256 startedAt,,) = sequencerUptimeFeed.latestRoundData();

    // Chainlink L2 sequencer feeds use answer == 0 for up, answer == 1 for down.
    require(answer == 0, "sequencer down");

    // startedAt is the time the sequencer entered its current status.
    require(block.timestamp - startedAt > SEQUENCER_GRACE_PERIOD, "sequencer grace period");
}

function _getCollateralPriceForLiquidation() internal view returns (uint256) {
    _checkSequencerUp();

    (, int256 answer,, uint256 updatedAt,) = collateralFeed.latestRoundData();
    require(answer > 0, "bad price");
    require(block.timestamp - updatedAt <= 3600, "stale price");

    return uint256(answer);
}
```

Then route liquidation through that guarded price path:

```solidity
function liquidate(...) external {
    uint256 collateralPrice = _getCollateralPriceForLiquidation();
    // health-factor / collateralisation check
    // liquidation execution
}
```

The important placement is before the liquidation eligibility calculation, not
after it and not only in the app. The contract must refuse to decide that a
position is liquidatable while the sequencer is down or inside the post-recovery
grace window.

The existing oracle freshness check should stay. It protects against old oracle
rounds. It just does not protect against a fresh oracle round arriving
immediately after a period when users had no practical path to transact.
