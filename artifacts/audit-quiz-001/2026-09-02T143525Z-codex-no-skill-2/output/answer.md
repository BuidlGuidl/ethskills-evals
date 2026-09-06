# Post-mortem: fresh price, no fair reaction window

## What happened

The price freshness check worked, but it checked the wrong kind of freshness for this incident.

`block.timestamp - updatedAt <= 3600` answers: **“Was this price published recently?”** It does not answer: **“Have borrowers been able to transact since the chain resumed and this price became actionable?”** Those are independent properties.

While Arbitrum's sequencer was unavailable, normal users could not get L2 transactions ordered. The external market continued moving and wstETH's economic value fell. Once block production resumed, the oracle correctly published the current lower price. That made `updatedAt` only seconds old, so the existing check correctly passed. Liquidators and borrowers then competed for ordering in the resumed chain; the keepers won. Nothing in the liquidation path required borrowers to have had even one usable block—let alone enough time—to deposit collateral or repay after recovery.

In other words, the outage compressed three and a half hours of offchain price discovery into an effectively instantaneous onchain repricing. Price freshness prevented liquidation using an old observation. It provided no protection from liquidation using a new observation immediately after a period in which users could not act.

The feed heartbeat is irrelevant to this failure. A one-hour maximum age may be stricter than the price feed's 86,400-second heartbeat, but it is still only an age test. Tightening it further would not create a reaction window; a price posted seconds after recovery would still pass.

This is the exact L2 failure mode for which Chainlink provides its Sequencer Uptime Feed. Chainlink notes that when a sequencer is unavailable, ordinary users lose the normal read/write path, producing unequal access and potentially disruptive liquidations; it recommends pausing during downtime and enforcing a grace period after recovery. On Arbitrum, downtime status messages are sent through the L1 delayed inbox and processed when the sequencer returns. [Chainlink: L2 Sequencer Uptime Feeds](https://docs.chain.link/data-feeds/l2-sequencer-feeds)

## Required change

Integrate the Chainlink Arbitrum Sequencer Uptime Feed at `0xFdB631F5EE196F0ed6FAa767959853A9F217697D` and reject liquidations in either of these states:

1. The sequencer feed says the sequencer is down (`answer != 0`).
2. The sequencer is up, but the configured recovery grace period has not elapsed since the uptime feed's `startedAt`.

Use `startedAt`, not the price feed's `updatedAt`, to measure the recovery interval. For Arbitrum, also reject `startedAt == 0`, which denotes an uninitialized uptime feed. Chainlink documents `answer == 0` as up, `answer == 1` as down, and `startedAt` as the time at which the uptime status last changed. Its example uses a one-hour recovery grace period. [Chainlink integration example](https://docs.chain.link/data-feeds/l2-sequencer-feeds#example-consumer-contract)

Illustrative Solidity:

```solidity
AggregatorV3Interface constant SEQUENCER_UPTIME_FEED =
    AggregatorV3Interface(0xFdB631F5EE196F0ed6FAa767959853A9F217697D);

uint256 constant SEQUENCER_GRACE_PERIOD = 1 hours;

error SequencerDown();
error SequencerFeedUninitialized();
error RecoveryGracePeriodActive();

function _requireLiquidationsAvailable() internal view {
    (, int256 status, uint256 startedAt,,) =
        SEQUENCER_UPTIME_FEED.latestRoundData();

    if (status != 0) revert SequencerDown();
    if (startedAt == 0) revert SequencerFeedUninitialized();

    // Written without subtraction so a future/malformed timestamp fails closed.
    if (
        block.timestamp <= startedAt ||
        block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD
    ) revert RecoveryGracePeriodActive();
}

function liquidate(/* ... */) external {
    _requireLiquidationsAvailable();       // first protocol-risk gate
    uint256 price = _readValidatedPrice(); // positivity + existing age check
    _requireBelowLiquidationRatio(/* price, ... */);
    _executeLiquidation(/* ... */);
}
```

## Where it goes in the flow

The uptime/grace check belongs at the **start of every liquidation entry point**, before reading the price, testing the 125% ratio, transferring collateral, or making any external keeper callback. No alternate batch, partial-liquidation, or internal liquidation route may bypass it. The existing positive-price and price-age validation remains in place immediately afterward; the two checks protect different invariants.

During sequencer downtime and the post-recovery grace period:

- Disable liquidations.
- Disable risk-increasing actions such as new borrowing and collateral withdrawal.
- Keep risk-reducing actions—adding collateral and repaying debt—available. Do not put the sequencer grace check in a shared oracle getter if that would also block those recovery actions.

The grace period should be a protocol parameter chosen to give ordinary users a realistic opportunity to reconnect, get a transaction included, and cure positions. One hour is Chainlink's illustrative value, not a universal guarantee. Changing it should be timelocked and bounded so governance cannot silently eliminate the protection.

Finally, add outage/recovery tests that simulate: down status; an up status with `startedAt == 0`; the exact recovery boundary; liquidation reverting throughout the grace period; liquidation succeeding only after it; and collateral deposits/repayments remaining usable during the grace period. Monitoring and front-end warnings are useful, but they are not substitutes for this onchain gate.
