# Post-mortem: fresh price, unavailable market

## What happened

The check we had answers only this question: **how recently was this price published?** It does not answer: **how recently could a borrower transact on Arbitrum?** Those are independent properties.

From 09:14 to 12:40 the sequencer outage denied ordinary users the standard L2 read/write path. Their collateral-add transactions could not be included, while the wstETH market continued moving elsewhere. No liquidation could execute during the halt either, so the problem remained latent.

On recovery, two things became possible at nearly the same time:

1. the oracle published/caught up to the current, 11%-lower market price; and
2. keepers could submit liquidations again.

Consequently, the oracle round used by each liquidation really was only seconds old. `block.timestamp - updatedAt <= 3600` correctly passed. The borrowers nevertheless had had zero usable reaction time: their last practical opportunity to act was before the outage, when that lower price did not yet exist, and keepers won the race in the first recovery blocks.

The 86,400-second heartbeat and our 3,600-second maximum age are not the relevant protection. A heartbeat/age check protects against an old market observation. Tightening it further can make the recovery cliff sharper, not fairer: liquidation is enabled as soon as the first fresh post-outage observation arrives. The missing control was **sequencer availability plus a post-recovery grace period**.

## Required change

Integrate Chainlink's Arbitrum Sequencer Uptime Feed (Arbitrum One proxy `0xFdB631F5EE196F0ed6FAa767959853A9F217697D`) and fail closed for liquidation when:

- the uptime feed's `answer` is not `0` (`0` means up; `1` means down);
- `startedAt` is zero (the Arbitrum uptime feed is uninitialized);
- `startedAt` is in the future or otherwise yields an invalid elapsed time; or
- less than the configured recovery grace period has elapsed since `startedAt`, which is the time the current "up" status began.

For example:

```solidity
AggregatorV3Interface constant SEQUENCER_UPTIME_FEED =
    AggregatorV3Interface(0xFdB631F5EE196F0ed6FAa767959853A9F217697D);

uint256 constant SEQUENCER_GRACE_PERIOD = 1 hours; // governance/risk parameter

error SequencerUnavailable();
error SequencerGracePeriod();

function _requireLiquidationsAvailable() internal view {
    (, int256 status, uint256 startedAt,,) =
        SEQUENCER_UPTIME_FEED.latestRoundData();

    // Fail closed on down or an unexpected status.
    if (status != 0) revert SequencerUnavailable();

    // On Arbitrum, zero can mean the uptime feed has not initialized.
    if (startedAt == 0 || startedAt > block.timestamp) {
        revert SequencerUnavailable();
    }

    if (block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD) {
        revert SequencerGracePeriod();
    }
}
```

The uptime-feed call reverting must also make the liquidation revert; it must not be caught and treated as "up." The boundary (`<=` above versus `<`) should match the protocol's stated grace-period semantics and tests.

## Where it goes in the flow

Call `_requireLiquidationsAvailable()` at the **entry to every liquidation path**, before reading a collateral price, deciding that an account is unhealthy, transferring collateral, repaying debt, or paying a keeper incentive:

```solidity
function liquidate(address borrower, uint256 repayAmount) external {
    _requireLiquidationsAvailable(); // availability/fair-access gate first

    uint256 price = _readFreshPositiveCollateralPrice(); // existing checks retained
    _liquidateUsingPrice(borrower, repayAmount, price);
}
```

The same guard must cover batch liquidations, keeper-only endpoints, callbacks, and any internal route that can produce liquidation effects; otherwise the unguarded route is a bypass. Putting the check only in the app or keeper is insufficient because enforcement must be onchain. Putting it only in a general oracle helper is also undesirable if that helper is used by rescue actions.

During the recovery grace period, keep **risk-reducing borrower actions** available—notably adding collateral and repaying USDC—while liquidation stays disabled. Borrowing more and withdrawing collateral may be paused under the same recovery policy. This is what turns the grace period into an actual opportunity to cure positions rather than merely a delay.

Keep the existing positive-answer and price-age checks after the sequencer gate. They address a different failure mode and remain necessary. Also validate the feed configuration and price-feed decimals/round behavior as part of the existing oracle integration.

The one-hour value is Chainlink's example, not a fact implied by the price heartbeat. Risk governance should choose and document a period long enough for RPCs, wallets, the app, and oracle delivery to normalize and for users to get transactions included; it can be longer than one hour. Alerting and an emergency pause are useful defense in depth, but neither replaces this deterministic onchain gate.

Reference: [Chainlink L2 Sequencer Uptime Feeds](https://docs.chain.link/data-feeds/l2-sequencer-feeds).
