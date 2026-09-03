# Post-mortem: fresh price, no opportunity to act

The freshness check was working, but it checked the wrong kind of liveness for this failure.

`updatedAt` answers **“how recently did the oracle publish this value?”** It does not answer **“have users had a functioning chain, and a reasonable inclusion window, since this value became actionable?”** Those are independent properties.

During the outage, ordinary users could not get Arbitrum transactions executed while the off-chain wstETH/ETH market continued moving. When the sequencer recovered, the oracle correctly published the accumulated price move. That round was both accurate and only seconds old, so

```solidity
block.timestamp - updatedAt <= 3600
```

correctly evaluated to true. But that same recovery also re-enabled liquidation. The newly executable price and the ability to liquidate arrived without an intervening period in which borrowers could get rescue transactions included. Their previously submitted transactions had no ordering guarantee; the keepers won the first-block ordering race.

Thus the protocol enforced market liveness immediately after restoring keeper access, without first restoring borrower access for long enough to cure positions. This was a sequencer-recovery/fair-access failure, not a stale-price or arithmetic failure.

The feed heartbeat does not change that conclusion. A heartbeat of 86,400 seconds describes the feed's update policy in the absence of a deviation-triggered update. A locally imposed one-hour maximum age can reject older rounds, but it cannot make users able to transact. In fact, on a quiet market that tighter bound can cause an unrelated availability failure when a valid round is more than an hour old.

## Required change

Integrate Chainlink's Arbitrum Sequencer Uptime Feed and impose a recovery grace period. The Arbitrum One uptime-feed proxy currently documented by Chainlink is `0xFdB631F5EE196F0ed6FAa767959853A9F217697D`; deployment configuration should still verify the address rather than silently reusing it across chains.

For the uptime feed:

- `answer == 0` means the sequencer is up.
- `answer == 1` means it is down.
- `startedAt` is when the current status began. Once the status is up again, `block.timestamp - startedAt` is the recovery age.

Use a fail-closed guard such as:

```solidity
uint256 internal constant SEQUENCER_GRACE_PERIOD = 1 hours;

error SequencerDown();
error InvalidSequencerRound();
error SequencerGracePeriodNotOver();

function _requireSequencerSafeForRiskAction() internal view {
    (
        ,
        int256 status,
        uint256 startedAt,
        ,

    ) = sequencerUptimeFeed.latestRoundData();

    if (status != 0) revert SequencerDown();
    // startedAt == 0 is an uninitialized-state possibility on Arbitrum.
    if (startedAt == 0 || startedAt > block.timestamp) {
        revert InvalidSequencerRound();
    }
    if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) {
        revert SequencerGracePeriodNotOver();
    }
}
```

An uptime-feed revert or malformed result must also fail closed for the guarded actions. One hour is the common baseline; the production value should be explicitly chosen from expected RPC recovery, transaction inclusion, borrower response, and protocol solvency constraints. It must be long enough to be a real cure window, not merely enough time for an oracle update.

## Exact placement and ordering

Put the guard at the **start of every liquidation entry path**, before reading a collateral price, checking health, changing state, or transferring collateral:

```solidity
function liquidate(/* ... */) external {
    _requireSequencerSafeForRiskAction();

    uint256 price = _readValidatedCollateralPrice();
    // Accrue debt as required, calculate collateralisation, and liquidate.
}
```

The resulting order is:

1. Verify that the sequencer is up.
2. Verify that the post-recovery grace period has elapsed.
3. Read and validate the collateral price (`answer > 0`, valid/nonfuture `updatedAt`, and the configured feed-specific maximum age).
4. Accrue debt and calculate the position's current collateralisation.
5. If it is below 125%, execute liquidation.

Enforce the guard in the shared internal liquidation primitive, or in every externally reachable single, batch, keeper, and callback liquidation path. A protected public wrapper is insufficient if an alternate entry point can reach an unguarded internal implementation.

Apply the same downtime-and-grace guard to actions that create or increase risk, including new borrowing, increasing debt, withdrawing collateral, and equivalent leverage/refinance paths. This prevents users from exploiting an unreliable or discontinuously updated price during recovery.

Do **not** attach this guard indiscriminately to the whole protocol or to a generic price modifier used by cure operations. As soon as blocks resume, borrowers must be able to:

- add collateral; and
- repay or close debt.

Those risk-reducing paths should not need an oracle price or a sequencer-grace check. If `addCollateral` or `repay` currently calls the price adapter merely to re-check health, refactor it so the transfer and accounting can complete without that unnecessary read. During the grace period, cure transactions are allowed while liquidation and risk-increasing transactions remain blocked.

This is the missing invariant: after sequencer recovery, borrowers receive an explicit executable cure window before a fresh post-outage price may be used against them. Keep the existing price-freshness validation as a separate defense; it protects oracle-data age, while the uptime feed and grace period protect chain access and recovery ordering.

Reference: [Chainlink L2 Sequencer Uptime Feeds](https://docs.chain.link/data-feeds/l2-sequencer-feeds).
