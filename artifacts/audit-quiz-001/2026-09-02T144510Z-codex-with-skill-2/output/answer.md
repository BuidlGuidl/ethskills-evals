# Post-mortem: fresh price, unavailable market

The freshness check worked, but it checked the wrong liveness property for this incident.

`updatedAt` is the timestamp of the **price round**. It says how recently the oracle published the value being consumed. It says nothing about whether Arbitrum users had recently been able to submit transactions, nor how long they had had an opportunity to react to that value.

During the sequencer outage, ordinary users could not get L2 transactions included. ETH nevertheless continued trading elsewhere and fell 11%. On recovery, the oracle promptly published the current lower price. Therefore, in the first post-recovery blocks both of these statements were true:

1. the price was accurate and only seconds old, so `block.timestamp - updatedAt <= 3600` passed; and
2. borrowers had had effectively zero time on the restored L2 to add collateral or repay at that price.

The keepers and borrowers then competed for ordering in the first recovered blocks. The protocol treated a fresh oracle observation as proof of fair market access, so keepers could liquidate before borrowers' rescue transactions were accepted. A tighter price-age bound cannot solve this; it can actually make the discontinuity sharper by accepting the first post-outage price immediately. The feed's 86,400-second heartbeat is a separate issue from sequencer availability.

This is an L2 sequencer-liveness failure, not stale-price or liquidation-math failure. Chainlink documents exactly this access asymmetry and provides an Arbitrum Sequencer Uptime Feed so applications can stop liquidations and apply a post-recovery grace period. The current documented Arbitrum One proxy is `0xFdB631F5EE196F0ed6FAa767959853A9F217697D`; the deployment must verify that address against Chainlink's registry at release time.

## Required contract change

Add the Sequencer Uptime Feed as a separate dependency and require, before any liquidation or other health-decreasing price-dependent action, that:

- the uptime feed is initialized;
- its answer is `0` (sequencer up; `1` means down); and
- at least a configured grace period has elapsed since `startedAt`, which is when the current uptime status began.

For this market, use no less than one hour initially, and make the value an explicitly governed, timelocked risk parameter. It must be long enough for RPCs, the app, and wallets to recover and for users to notice, resubmit, and obtain inclusion. Monitoring should alert on both sequencer transitions and grace-period expiry.

```solidity
AggregatorV3Interface public immutable sequencerUptimeFeed;
uint256 public constant SEQUENCER_GRACE_PERIOD = 1 hours;

error SequencerDown();
error SequencerFeedUninitialized();
error SequencerGracePeriodActive();

function _requireLiquidationsAvailable() internal view {
    (, int256 status, uint256 startedAt,,) =
        sequencerUptimeFeed.latestRoundData();

    // Fail closed on an uninitialized or unexpected response.
    if (startedAt == 0) revert SequencerFeedUninitialized();
    if (status != 0) revert SequencerDown();

    // The explicit <= check also fails closed if timestamps are anomalous and
    // avoids relying on subtraction underflow for that case.
    if (
        block.timestamp <= startedAt ||
        block.timestamp - startedAt <= SEQUENCER_GRACE_PERIOD
    ) revert SequencerGracePeriodActive();
}

function _readPrice() internal view returns (uint256) {
    (uint80 roundId, int256 answer, uint256 startedAt,
        uint256 updatedAt, uint80 answeredInRound) = feed.latestRoundData();

    require(answer > 0, "bad price");
    require(startedAt != 0 && updatedAt != 0, "incomplete round");
    require(answeredInRound >= roundId, "incomplete round");
    require(updatedAt <= block.timestamp, "future price");
    require(block.timestamp - updatedAt <= 3600, "stale price");
    return uint256(answer);
}

function liquidate(/* ... */) external {
    _requireLiquidationsAvailable(); // first external-data gate
    uint256 price = _readPrice();     // independent price-validity gate
    // test health, update accounting, and transfer collateral
}
```

The sequencer check belongs **before the price read and health calculation in every liquidation entry point**, including batch liquidation and any indirect/internal route. Keep the existing price validation after it: sequencer liveness and price freshness are independent requirements, and both must pass. Apply the same guard to actions that can increase insolvency risk, such as new borrowing and collateral withdrawal.

Do **not** put this guard in a universal modifier used by every market action. As soon as blocks resume, users must be able to perform risk-reducing actions during the grace period:

- allow collateral deposits;
- allow debt repayment and full close; and
- block liquidations, new borrowing, and collateral withdrawals until the grace period ends.

Those protective paths should be refactored not to require a price or liquidation-availability check where the price is unnecessary. Otherwise the proposed safety mechanism would also prevent the very cures the grace period is intended to permit. If a protective operation genuinely needs a conversion price, it needs deliberately conservative semantics rather than accidentally inheriting the liquidation gate.

Operationally, keeper infrastructure should also honor the pause, but that is defense in depth; enforcement must be on-chain. A UI banner or off-chain pause alone does not stop permissionless keepers. Tests should simulate: sequencer down, the first recovered block, a fresh post-recovery price, borrower deposits/repayments during grace, attempted batch liquidation during grace, and successful liquidation only after grace plus a valid fresh price.

Reference: [Chainlink L2 Sequencer Uptime Feeds](https://docs.chain.link/data-feeds/l2-sequencer-feeds).
