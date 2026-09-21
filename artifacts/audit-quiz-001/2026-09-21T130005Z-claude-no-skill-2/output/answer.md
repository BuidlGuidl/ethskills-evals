# Post-mortem: 38 liquidations after Arbitrum sequencer outage

## What actually happened

The chain didn't stop. **The Arbitrum sequencer went down.** The sequencer is the single operator that orders and includes L2 transactions. While it was down:

- no L2 blocks were produced, so no user tx could land (the only other route in, force-inclusion through the L1 delayed inbox, takes ~24h, so it was no help)
- the market kept moving: ETH -11% off-chain and on L1
- the Chainlink feed on Arbitrum couldn't update either, because its updates are L2 txs too

At 12:41 the sequencer came back. In the first blocks:

1. Chainlink pushed a new round straight away (11% move, far past the deviation threshold). `updatedAt` ≈ now.
2. Keeper bots, which had been watching L1/CEX prices for 3.5h and had their txs ready, landed their liquidations in the same or the next blocks.
3. Borrowers' "add collateral" txs from the morning had been dropped or had expired, or they were ordered behind the bots, or they needed a human to re-sign at the right moment. Either way they lost the race.

## Why the freshness check didn't help

`block.timestamp - updatedAt <= 3600` asks one question: **is this price recent?** It was. It was a few seconds old and correct.

It doesn't ask: **has everyone had a fair chance to react to this price?** Nobody had. The price moved 11% in one step between the last block before the outage and the first block after it. From the protocol's view, the gap between "healthy" and "liquidatable" took zero blocks. Borrowers had no block in which they could act.

So the check worked, but it guards against a different risk: an oracle that stopped updating while the chain kept running. This incident was the reverse: the oracle was fine and the chain stopped. The check can't see that, because `block.timestamp` and `updatedAt` both jump forward together when the sequencer comes back.

The missing input is **sequencer liveness**, plus a **grace period** after it comes back.

## The fix

### 1. Read Chainlink's L2 Sequencer Uptime Feed

Arbitrum One: `0xFdB631F5EE196F0ed6FAa767959853A9F217697D` (check it against Chainlink docs before deploying).

- `answer == 0`: sequencer up. `answer == 1`: sequencer down.
- `startedAt`: when the current status began, i.e. when it came back up.

The status flips are sent from L1. Arbitrum processes queued L1 messages before new L2 txs when it resumes, so the "down" status and then the "up" status (with its `startedAt`) are on-chain before any keeper tx.

### 2. Add a grace period after recovery

```solidity
AggregatorV2V3Interface public immutable sequencerUptimeFeed;
uint256 public constant GRACE_PERIOD = 3600; // 1h; governance-set if you prefer

error SequencerDown();
error GracePeriodNotOver();

function _checkSequencer() internal view {
    (, int256 answer, uint256 startedAt, , ) = sequencerUptimeFeed.latestRoundData();

    // answer: 0 = up, 1 = down
    if (answer != 0) revert SequencerDown();

    // On Arbitrum, startedAt can be 0 before the feed is initialised; treat as unsafe
    if (startedAt == 0) revert SequencerDown();

    if (block.timestamp - startedAt <= GRACE_PERIOD) revert GracePeriodNotOver();
}
```

Use `startedAt`, not `updatedAt`. You want the time the status changed, not the time of the last write.

### 3. Where it goes: gate by action, not inside `getPrice()`

Chainlink's sample code puts the check inside the price read. **Don't do that here.** If every price read reverts, users can't add collateral during the grace period either, and adding collateral is exactly what they need to do.

Keep the price read (with its existing `answer > 0` and staleness checks) unchanged and call `_checkSequencer()` at the start of these risk-increasing entry points:

| Action | During outage / grace period |
|---|---|
| `liquidate()` | **Blocked**. This is the core fix. |
| `borrow()` / increase debt | Blocked. Otherwise someone can open a position at a price the market hasn't caught up to. |
| `withdrawCollateral()` | Blocked. Same reason. |
| `depositCollateral()` | **Allowed.** No price needed. |
| `repay()` | **Allowed.** No price needed. |

Flow for `liquidate()`:

```
liquidate(user)
  -> _checkSequencer()         // NEW: up, and up for > GRACE_PERIOD
  -> price = _getPrice()       // existing: answer > 0, staleness check
  -> health factor < 125%?     // existing
  -> seize / repay             // existing
```

Last Tuesday this would have blocked liquidations from 12:41 until 13:41. Borrowers would have had an hour, at the new and correct price, to top up or repay. Only positions still under water after that would have been liquidated.

### 4. Choosing the grace period

It needs to cover the time a human needs to notice the outage ended and get a tx in: 1h is the common default. The cost is that genuinely bad debt waits too. If an 11% move could push positions below 100%, pair the grace period with a monitor that alerts you, or with a shorter period sized from your close factor and liquidation bonus. Don't drop the grace period.

## Separate issue found during review

A 3600s staleness bound on a feed with an **86400s heartbeat** isn't "tighter safety". It's a liveness bug. In a quiet market the feed only updates once a day, so for ~23h of each day every price read reverts and liquidations, borrows and withdrawals all fail. Set the bound to heartbeat plus a buffer (e.g. `86400 + 1800`) and store it per feed. If you actually need prices under 1h old, use a feed with a shorter heartbeat. A tighter check won't make this feed update more often.

## Summary

- **Root cause:** there was no check for sequencer liveness. The price was fresh and correct. The failure was that borrowers had zero time to react to it.
- **Change:** add Chainlink's L2 Sequencer Uptime Feed check with a grace period after recovery (measured from `startedAt`). Enforce it on `liquidate`, `borrow` and `withdrawCollateral`, and leave `deposit` and `repay` open.
- **Also:** fix the 3600s vs 86400s staleness mismatch.
