# Post-mortem: 38 liquidations at 12:41 UTC

## What happened

The problem was never the price. It was that **the Arbitrum sequencer was down**.
The sequencer is the single operator that orders transactions and makes L2 blocks.

- 09:14–12:40: the sequencer stopped. No L2 blocks, so no transactions went through:
  not the borrowers' top-ups, not oracle updates, not liquidations. Arbitrum's
  "force-include through L1" escape route exists, but it has a ~24h delay, so in
  practice nobody could get in.
- Meanwhile ETH fell 11% everywhere else. Every position was getting worse, and the
  chain couldn't record it.
- 12:41: the sequencer came back. In the first blocks, Chainlink pushed the new
  (correct, current) price, and keeper bots that had been queued up waiting fired
  immediately. The price moved by 11% all at once, from the chain's point of view.
  Borrowers got **zero blocks** between "the price is now visible" and "you are
  liquidated".

## Why the freshness check didn't catch it

It isn't built to. `block.timestamp - updatedAt <= 3600` asks one thing:
*"is this price recent compared to the chain's current time?"* After recovery, the
answer was honestly yes: the round was seconds old and matched the market.

The question you needed to ask is different:
*"has the chain been up long enough for users to react to this price?"*
Both `block.timestamp` and `updatedAt` come from the chain that just restarted, so
no comparison between them can tell you that the chain was down for 3.5 hours.
The outage is invisible to anything that only looks at the price feed.

You need a second input: **was the sequencer down, and when did it come back?**

## The fix: Chainlink L2 Sequencer Uptime Feed + grace period

Chainlink publishes a Sequencer Uptime Feed on Arbitrum (mainnet:
`0xFdB631F5EE196F0ed6FAa767959853A9F217697D`, confirm against Chainlink docs before
deploying). It is updated from L1, so its status change is guaranteed to be ordered
before normal L2 transactions once the sequencer resumes.

- `answer == 0` → sequencer up, `answer == 1` → sequencer down
- `startedAt` → when the current status began (i.e. when it came back up)

```solidity
AggregatorV2V3Interface public immutable sequencerUptimeFeed;
uint256 public constant GRACE_PERIOD = 3600; // 1h after recovery

error SequencerDown();
error GracePeriodNotOver();

function _checkSequencer() internal view {
    (, int256 answer, uint256 startedAt, , ) = sequencerUptimeFeed.latestRoundData();
    if (answer != 0) revert SequencerDown();
    // startedAt == 0 means the feed round is not initialised; treat as unsafe
    if (startedAt == 0) revert SequencerDown();
    if (block.timestamp - startedAt <= GRACE_PERIOD) revert GracePeriodNotOver();
}
```

## Where it goes in the flow

**Not** inside the shared price getter. If you put it there, you also block the
very actions users need during the grace period (add collateral, repay), which
recreates the same trap.

Put it per action:

| Action | Sequencer down / in grace period |
|---|---|
| `liquidate` | **blocked** (`_checkSequencer()` first, before reading the price) |
| `borrow`, `withdrawCollateral` | **blocked** (they rely on price to stay safe; prevents borrowing against a price that is about to jump) |
| `depositCollateral`, `repay` | **always allowed** (they only make positions safer) |

Liquidation flow becomes:

1. `_checkSequencer()`  ← new
2. `latestRoundData()` on the wstETH price feed, with the existing `answer > 0` and staleness checks
3. health-factor check against 125%
4. liquidate

That hour is the window the 38 borrowers never got: from 12:41 they could have
topped up before any keeper was allowed to touch them.

Optional (Aave v3's `PriceOracleSentinel` does this): during the grace period, still
allow liquidating positions that are *deeply* underwater (e.g. health factor < 0.95)
so bad debt can't pile up, while giving borderline positions time to recover. Your
call whether bad-debt risk justifies that exception.

## Side note on the existing staleness check

A 3600s bound on a feed with an 86400s heartbeat is not "extra safe". On a quiet day
the feed only updates every 24h, so for ~23h of that day your check reverts and
**every** price read fails, including liquidations of really bad positions. Set
the bound per feed from its heartbeat plus a margin (e.g. 86400 + a buffer), and if
the wstETH price is built from several feeds (e.g. wstETH/stETH rate × ETH/USD),
check each one against its own heartbeat.

## Changes, summary

1. Add sequencer uptime feed address (immutable) + `GRACE_PERIOD` constant.
2. Add `_checkSequencer()`; call it first in `liquidate`, `borrow`, `withdrawCollateral`.
3. Leave `depositCollateral` and `repay` ungated.
4. Fix staleness bound to match each feed's heartbeat.
5. (Optional) deep-underwater exception during grace period.
6. Tests: fork test simulating sequencer down → up, assert liquidation reverts until
   `startedAt + GRACE_PERIOD`, and deposit/repay succeed throughout.
