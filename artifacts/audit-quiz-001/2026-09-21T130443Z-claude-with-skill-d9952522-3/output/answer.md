# Post-mortem: 38 liquidations at 12:41 UTC

## What happened

Your freshness check answers one question: "is this price recent?" It does not ask whether **users were able to act on the chain** while the price was moving. Last Tuesday those two questions had different answers.

1. **The chain was not down. The Arbitrum sequencer was.** The sequencer is the single server that orders Arbitrum One transactions and produces blocks. When it stops, no L2 blocks are made and no normal transaction gets in. That matches what you saw: pending txs and no new blocks in the explorer. The rest of the world kept trading, and ETH fell 11%.

2. **Nobody could get in, including your users.** The only way around the sequencer is the L1 delayed inbox, and forced inclusion there only kicks in after about 24 hours. For a 3.5h outage, borrowers had no working route to add collateral or repay. They were not slow. They were locked out.

3. **The price jumped from before the outage to after it in a single step.** When the sequencer came back, Chainlink nodes pushed a fresh round at once: an 11% move is far past the deviation threshold. That round is genuinely fresh (`updatedAt` a few seconds old) and correct (it matches the market). So `block.timestamp - updatedAt <= 3600` passes, and it should.

4. **Keepers and borrowers were not on equal footing when the chain resumed.** Keeper bots are built to fire in the first blocks after the oracle update. The fresh price, the drop below 125%, and the liquidation all landed in the same first blocks. Borrowers were still waiting for their earlier txs to go through or for the app to reconnect. Some of their add-collateral txs may even have been ordered behind the liquidations.

**Root cause:** the protocol assumes that a fresh, correct price means users have had time to respond to it. On an L2 with a single sequencer, that is false whenever the sequencer has just come back up. What was missing is a **liveness** check (is the chain running normally?), not a **freshness** check (is the price recent?). A staleness bound can never catch this, because the dangerous price is always a new one.

## The fix: Chainlink L2 Sequencer Uptime Feed + grace period

Arbitrum One sequencer uptime feed: `0xFdB631F5EE196F0ed6FAa767959853A9F217697D` (check it against Chainlink's docs before you deploy).

- `answer == 0` → sequencer up, `answer == 1` → sequencer down
- `startedAt` → when the current status began, so after a restart it is the moment the sequencer came back up

The uptime status is written from L1, so the feed shows the outage and the restart time correctly, even though the outage happened on L2.

### Code

Put it in the single internal price-read function, **before** `latestRoundData()` on the price feed:

```solidity
AggregatorV2V3Interface public immutable sequencerUptimeFeed;
uint256 public constant GRACE_PERIOD = 3600; // 1h, see below

error SequencerDown();
error GracePeriodNotOver();

function _checkSequencer() internal view {
    (, int256 answer, uint256 startedAt, , ) = sequencerUptimeFeed.latestRoundData();
    // startedAt == 0: feed round not initialised yet -> treat as unsafe
    if (answer != 0 || startedAt == 0) revert SequencerDown();
    if (block.timestamp - startedAt <= GRACE_PERIOD) revert GracePeriodNotOver();
}

function _getPrice(AggregatorV3Interface feed, uint256 maxAge) internal view returns (uint256) {
    (, int256 answer, , uint256 updatedAt, ) = feed.latestRoundData();
    require(answer > 0, "bad price");
    require(block.timestamp - updatedAt <= maxAge, "stale price");
    return uint256(answer);
}
```

### Where in the flow it goes

Do **not** put it inside the plain price getter that every action calls. If you do, the grace period also blocks the rescue actions, which would repeat Tuesday's failure. Apply it per action:

| Action | Sequencer down / in grace period |
|---|---|
| `liquidate` | **blocked** (`_checkSequencer()` at the top) |
| `borrow`, `withdrawCollateral` | **blocked** (these rely on the price to cap risk, so don't let anyone lever up on a price others can't act on) |
| `depositCollateral`, `repay` | **allowed**, with no oracle gate at all. Only a health check that could *block* these actions should read the price, and you don't need one here because these actions only make a position safer |

So:

```solidity
function liquidate(...) external {
    _checkSequencer();
    uint256 price = _getPrice(collateralFeed, MAX_AGE);
    ...
}
```

Result on Tuesday: from 12:40 to 13:40 liquidations revert, and the 38 borrowers get one hour, with the real post-drop price visible, to add collateral or repay. After 13:40, positions that are still under 125% can be liquidated as usual. That is correct: they had a fair chance.

### Grace period length

It has to be longer than the time users need to notice, reconnect, and get a tx included through the post-restart backlog. 3600s is Chainlink's reference value and a sensible default. Make it a governance-adjustable param, but with a hard minimum (for example ≥ 30 min) so nobody can set it to 0.

## Second issue found on the way (not the cause, still a bug)

`maxAge = 3600` with a feed whose heartbeat is 86400 is not "safer". A heartbeat is the maximum time between updates when the price barely moves. So on quiet days the feed legitimately goes up to 24h without an update, and on any such day every price read reverts after an hour. That freezes liquidations exactly when they are needed and the market sits still. Set `maxAge` **per feed** to about heartbeat + a small buffer (for example 86400 + 1800). If the collateral price is built from two feeds (wstETH/ETH × ETH/USD), check each one against its own heartbeat. Check the heartbeats in Chainlink's docs for the exact Arbitrum feeds you use.

## Checklist

1. Add `_checkSequencer()` with the Arbitrum uptime feed and `GRACE_PERIOD = 3600`.
2. Call it in `liquidate`, `borrow`, `withdrawCollateral`. Do not call it in `depositCollateral` or `repay`.
3. Handle `startedAt == 0` as down.
4. Replace the global 3600 staleness bound with a per-feed `maxAge` based on each feed's heartbeat.
5. Tests: sequencer down → liquidate reverts; up for less than the grace period → reverts; up for more than the grace period → works; deposit/repay succeed in all three states.
6. Ops: alert on uptime-feed status changes, and have the app show a "grace period, add collateral now" banner.
