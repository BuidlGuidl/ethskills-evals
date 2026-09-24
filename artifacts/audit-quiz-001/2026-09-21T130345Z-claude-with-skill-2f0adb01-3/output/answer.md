# Post-mortem: 38 liquidations at 12:41 UTC

## What happened

Arbitrum's **sequencer** went down. The sequencer is the single Arbitrum operator that takes transactions, puts them in order, and makes blocks. When it stops, no blocks are made. Nobody on Arbitrum can do anything: not your users, not the keepers, not Chainlink. Everywhere else, trading keeps going.

The price check did its job. It just measures the wrong thing for this problem.

- `block.timestamp - updatedAt <= 3600` asks: **"is this price recent?"**
- It never asks: **"have borrowers had any chance to act on this price?"**

Most of the time those two questions have the same answer. During a sequencer outage they come apart:

1. 09:14–12:40: no L2 blocks. Your contract doesn't run, so no check runs. Borrowers try to add collateral and fail. The app sends their txs to the sequencer, which is down. The fallback is forced inclusion through the L1 delayed inbox, and that only kicks in after about 24h, so it was no help in a 3.5h outage.
2. 12:40: the sequencer comes back. ETH has fallen 11%, far past the feed's deviation trigger. So Chainlink sends a new round right away, and it lands in the first blocks.
3. 12:41: keepers were ready and waiting with transactions. They read a price published seconds earlier, which is correct and fresh. `block.timestamp` is also current. The check passes, and the positions really are below 125% **at that price**.
4. The borrowers' add-collateral txs are competing for the same first blocks as the keepers' txs. Keeper bots pay for priority and are built for exactly this moment. The borrowers lose the race.

So the whole 11% drop landed in one step, at a moment when only bots could act. Users spent 3.5h watching the price fall and had no way to respond. The staleness check can't see this, because at 12:41 nothing is stale. The price is fresh. What was missing was **time for users to act**, and your code never measures that.

This is a known L2 risk. Chainlink publishes an **L2 Sequencer Uptime Feed** for exactly this purpose, and Aave v3 guards against it with its `PriceOracleSentinel`.

## The fix

### 1. Add a sequencer-uptime + grace-period check to the price read

On Arbitrum One, Chainlink's sequencer uptime feed is at `0xFdB631F5EE196F0ed6FAa767959853A9F217697D`. Check it against Chainlink's docs before you deploy. Its `answer` is `0` when the sequencer is up and `1` when it's down. Its `startedAt` is the time the status last changed.

```solidity
AggregatorV2V3Interface public immutable sequencerUptimeFeed;
uint256 public constant GRACE_PERIOD = 3600; // 1h after restart

error SequencerDown();
error GracePeriodNotOver();

function _checkSequencer() internal view {
    (, int256 status, uint256 startedAt, , ) = sequencerUptimeFeed.latestRoundData();
    if (startedAt == 0) revert SequencerDown();       // feed round not initialised / invalid
    if (status != 0) revert SequencerDown();          // 1 = sequencer down
    if (block.timestamp - startedAt <= GRACE_PERIOD)  // just came back
        revert GracePeriodNotOver();
}
```

On Tuesday: the feed flips to "up" at about 12:40, so `startedAt` is about 12:40. With a 1h grace period, liquidations become possible at about 13:40, not 12:41. Borrowers get an hour to top up, and so does the app's retry queue.

### 2. Where it goes in the flow

Split your price read into two functions and choose which one each action calls:

```solidity
function _getPriceStrict() internal view returns (uint256) {
    _checkSequencer();               // FIRST: can users act?
    return _getPrice();              // then your existing answer>0 + staleness checks
}
function _getPrice() internal view returns (uint256) { /* existing code, unchanged */ }
```

| Action | Price read | Why |
|---|---|---|
| `liquidate` | **strict** | This is the fix. No liquidations while the sequencer is down or during the grace period. |
| `borrow`, `withdrawCollateral` | **strict** | Stops people from using the restart-gap price to open or loosen positions before things settle. |
| `depositCollateral`, `repay` | **no sequencer check** (or no price read at all) | These only make positions safer. They must **never** be blocked, because being able to call them is the whole point of the grace period. |

The sequencer check must run **before** the staleness check, inside the same function that liquidation calls. Then no code path can reach liquidation math without passing through it. Don't do this check in the keeper, the frontend, or any off-chain place. Keepers are third parties and will skip it.

### 3. Trade-off to decide on

A grace period means that for an hour after a restart you might carry positions that are **underwater** (collateral worth less than the debt). Aave's approach is to block liquidations during the grace period only while health factor is above a threshold. Positions that are truly insolvent stay liquidatable. If you want the same thing, let `liquidate` skip the grace-period revert when collateral ratio is below ~100–105%. Keep the "sequencer down" revert in every case. Choose the grace period and that cutoff based on how much bad debt you can accept.

### 4. Side notes from the same review

- **The 3600s bound on an 86400s-heartbeat feed is not "safer". It's a liveness bug.** In a quiet market that feed can go up to 24h without an update, and then every price read reverts, including liquidations of positions that really are bad. Set the staleness bound to heartbeat + a buffer (e.g. 86400 + 1800), and set it **per feed**. If your wstETH price is built from two feeds (wstETH/ETH or its exchange rate × ETH/USD), check each one against its own heartbeat.
- Also consider `pause`-style handling for longer outages, and tell users about the grace period in the app. After a restart, the app should show "you have until HH:MM to top up".

## Summary

The price was fresh. But during the 3.5h outage, only bots could act at the moment the chain came back, and the freshness check can't see that. Fix it with the Chainlink L2 Sequencer Uptime Feed plus a grace period. Check it first in the price function that `liquidate` (and `borrow`/`withdraw`) call. Never gate `deposit`/`repay` on it.
