# Post-mortem: fresh price, unavailable market

The freshness check worked, but it checks the wrong kind of liveness for this incident.

`updatedAt` answers: **“How recently was this price published on Arbitrum?”** It does not answer: **“Have borrowers had a fair opportunity to transact since the market moved to this price?”**

From 09:14 through 12:40, the Arbitrum sequencer was unavailable. The lending market's state was effectively frozen for ordinary users while price discovery continued elsewhere. Borrowers could not get their collateral top-ups included, but ETH could still fall 11% on the venues observed by the oracle network. When sequencing resumed, the oracle published the current lower price. That report was both accurate and only seconds old, so:

```solidity
block.timestamp - updatedAt <= 3600
```

correctly passed. The positions then appeared below 125% at that new price, and keepers competed to liquidate them before borrowers' rescue transactions could be included. A tighter price-age limit cannot solve this; it can make the cliff sharper by admitting a newly published catch-up price immediately after recovery.

The missing invariant was therefore not price freshness. It was **sequencer availability plus a post-recovery reaction window**. Price-feed heartbeat and sequencer liveness are independent controls. The 86,400-second heartbeat is relevant when choosing and documenting the price staleness policy, but it says nothing about whether users could transact.

## Required change

Integrate the Chainlink Arbitrum Sequencer Uptime Feed. The documented Arbitrum One proxy is `0xFdB631F5EE196F0ed6FAa767959853A9F217697D`. Its `answer` is `0` when the sequencer is up and `1` when it is down; `startedAt` records when the current status began. On Arbitrum, `startedAt == 0` means that the uptime feed is not initialized and must fail closed. See the [Chainlink L2 Sequencer Uptime Feed documentation](https://docs.chain.link/data-feeds/l2-sequencer-feeds).

Add a liquidation gate like this (production code should use the project's existing access patterns, errors, and audited Chainlink interface):

```solidity
AggregatorV3Interface constant SEQUENCER_UPTIME_FEED =
    AggregatorV3Interface(0xFdB631F5EE196F0ed6FAa767959853A9F217697D);

uint256 public constant LIQUIDATION_GRACE_PERIOD = 1 hours; // governance/risk parameter

error SequencerDown();
error SequencerFeedUninitialized();
error LiquidationGracePeriodActive();

function _requireLiquidationsAvailable() internal view {
    (, int256 status, uint256 startedAt,,) =
        SEQUENCER_UPTIME_FEED.latestRoundData();

    if (startedAt == 0) revert SequencerFeedUninitialized();
    if (status != 0) revert SequencerDown(); // also fail closed on unexpected values
    if (block.timestamp < startedAt ||
        block.timestamp - startedAt <= LIQUIDATION_GRACE_PERIOD) {
        revert LiquidationGracePeriodActive();
    }
}
```

The decisive placement is **at the start of every state-changing liquidation path, before reading a price, testing collateralisation, transferring collateral, or paying a liquidator**:

```solidity
function liquidate(/* ... */) external nonReentrant {
    _requireLiquidationsAvailable();
    uint256 price = _readAndValidatePrice(); // retains answer > 0 and updatedAt checks
    _liquidateUsing(price /* ... */);
}
```

Put the guard in the shared internal liquidation routine as well if there are multiple external entry points (single liquidation, batch liquidation, callbacks, auctions, or keeper-only routes), so none can bypass it. A check only in the UI or keeper is insufficient.

The resulting order is:

1. Read the sequencer uptime feed and fail closed if it is down, uninitialized, malformed, or has only recently recovered.
2. After the configured grace period has elapsed, read the asset price and apply the existing positivity, round-validity, and staleness checks.
3. Compute health and execute liquidation.

During sequencer downtime, no ordinary L2 action can be relied upon. After recovery and throughout the grace period, keep **protective** actions enabled: adding collateral and repaying debt. Keep liquidations disabled. Also disable or conservatively gate risk-increasing actions such as new borrowing and collateral withdrawal during that window; otherwise actors could intentionally create new risk while liquidation is paused. Do not put the sequencer/grace check inside a universal oracle function if that would accidentally prevent repayment or collateral deposits.

The grace period is a protocol risk parameter, not another oracle freshness limit. One hour is Chainlink's illustrative value and would have prevented the immediate 12:41 sweep, but the production value should cover user detection, RPC recovery, wallet submission, congestion, and inclusion with margin. Its effect should be tested against long outages, queued transactions, repeated up/down transitions, `startedAt == 0`, unexpected status values, timestamp edge cases, batch liquidation, and every alternate liquidation entry point.

Thus the incident was not an oracle failure: it was an availability/fairness failure at the boundary between a live external market and a temporarily unavailable L2. The remedy is to retain price freshness validation and add sequencer-aware, asymmetric circuit breaking before liquidation.
