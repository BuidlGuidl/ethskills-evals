# Post-mortem: 38 liquidations at 12:41 UTC

## What happened

Your check answers one question: **"How old is this price?"**
The question that mattered was different: **"Have borrowers had a fair chance to respond to this price?"**
Normally both have the same answer. On Tuesday they didn't.

Arbitrum One has a single **sequencer**, the service that orders transactions and makes blocks. From 09:14 to 12:40 it was down. So:

1. **No blocks meant no time passed on-chain.** Borrowers couldn't send transactions. Chainlink couldn't post prices either. The chain was frozen at the ~09:14 price.
2. **Off-chain, the market kept moving.** ETH (and so wstETH) fell 11%. Positions that had a small safety margin above 125% slid under the line, but only in the real world, not on-chain yet.
3. **At 12:40 the sequencer came back.** In the first blocks, Chainlink posted the new price. That's a normal deviation update, and it was fresh, correct, and published seconds earlier. Keeper bots, sitting ready with transactions, went into those same blocks.
4. **Your check passed** because `block.timestamp - updatedAt` was only a few seconds. It passed correctly. The price *was* fresh.
5. **Borrowers had no window at all.** The price jumped 11% in one step. Liquidations became valid in the same block where it became possible to act again. Keepers are faster than people clicking "add collateral" in an app. Transactions users had submitted earlier had also been dropped or were stuck behind the bots.

So nothing in your code was wrong. What's missing is a check. A fresh price only tells you the price is accurate. It doesn't tell you users could reach the chain. Freshness is about the **oracle**. The missing check is about the **chain**.

(Side note: users could in theory have forced a transaction in through Ethereum mainnet via Arbitrum's delayed inbox. But forced inclusion only kicks in after about 24 hours, so it was no help in a 3.5-hour outage.)

## The fix: sequencer uptime check + grace period

Chainlink publishes an **L2 Sequencer Uptime Feed** on Arbitrum One. Its status is written from Ethereum mainnet, so it stays accurate even while the sequencer is down.

- `answer == 0` → sequencer up, `answer == 1` → sequencer down
- `startedAt` → time the current status began (for "up", that's when the sequencer came back)

Arbitrum One address: `0xFdB631F5EE196F0ed6FAa767959853A9F217697D`. Verify it against Chainlink's docs before deploying.

The rule is: **no liquidations while the sequencer is down, or until a grace period has passed since it came back.** That gives borrowers time to add collateral or repay at the new price.

```solidity
AggregatorV2V3Interface public immutable sequencerUptimeFeed;
uint256 public constant GRACE_PERIOD = 3600; // 1h after sequencer returns

error SequencerDown();
error GracePeriodNotOver();

function _checkSequencer() internal view {
    (, int256 status, uint256 startedAt, , ) = sequencerUptimeFeed.latestRoundData();
    if (status != 0) revert SequencerDown();
    if (startedAt == 0) revert SequencerDown();                 // feed not initialised / invalid round
    if (block.timestamp - startedAt <= GRACE_PERIOD) revert GracePeriodNotOver();
}
```

## Where it goes in the flow

Put it **before** the price read, and only on actions that *use the price against the user*:

| Action | Sequencer + grace check? | Why |
|---|---|---|
| `liquidate` | **Yes**. First line, before `latestRoundData()` on the collateral feed | This is the fix |
| `borrow` / increase debt | **Yes** | Stops people taking on debt at a price the market may already have moved past |
| `withdrawCollateral` | **Yes** | Same reason: it lowers the collateral ratio based on the price |
| `addCollateral` / `repay` | **No, never block these** | These are exactly what users need during the grace period |

The order inside the price function (`_getPrice()` or equivalent) for the gated actions:

```solidity
function _getPrice() internal view returns (uint256) {
    _checkSequencer();                                   // 1. could users reach the chain?
    (, int256 answer, , uint256 updatedAt, ) = feed.latestRoundData();
    require(answer > 0, "bad price");                    // 2. valid price
    require(block.timestamp - updatedAt <= MAX_AGE, "stale price"); // 3. fresh price
    return uint256(answer);
}
```

If your deposit and repay paths share `_getPrice()`, don't put the check inside it. Call `_checkSequencer()` directly at the top of `liquidate`, `borrow` and `withdrawCollateral`.

## Choosing the grace period, and a softer version

- **3600s** is the common default (Chainlink's example, Aave v3). Pick one that's long enough for a real person to see the alert and top up their position.
- **Softer option (Aave v3 `PriceOracleSentinel` style):** during the grace period, don't block liquidations entirely. Allow them only for positions that are badly under water, for example below 105%, where waiting risks bad debt. Positions between 105% and 125% get the grace period. This protects the protocol's solvency without handing keepers the borderline positions.
- Tell users when the grace period is active: show a banner in the app and keep repay/add collateral working.

## Related issue found while checking

`MAX_AGE = 3600` against a feed whose heartbeat is 86400 is **too strict in the other direction**. In a calm market the feed only updates once a day, so your check will revert for up to 23 hours out of 24. That blocks liquidations (bad debt risk) and anything else that reads the price. Set `MAX_AGE` to heartbeat + a small buffer (e.g. `86400 + 1800`) and keep one setting per feed.

## Summary

- **Root cause:** a stale *chain*, not a stale *price*. The sequencer outage froze on-chain time, and the whole 11% move landed in one update. Liquidations became valid in the same block users regained access.
- **Change:** add a Chainlink L2 Sequencer Uptime Feed check with a grace period. Put it at the start of `liquidate`, `borrow` and `withdrawCollateral`, before the price read. Never gate `repay` or `addCollateral`.
- **Also:** raise the staleness limit to match the feed's 24h heartbeat.
