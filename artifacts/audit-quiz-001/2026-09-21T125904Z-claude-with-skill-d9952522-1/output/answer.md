# Post-mortem: 38 liquidations after the Arbitrum sequencer outage

## Short answer

Your freshness check answers one question: **is this price recent?** It does not ask:
**could the borrowers have acted on the market that produced this price?**

On a rollup those questions have different answers. The sequencer (the single node that
orders Arbitrum transactions and makes blocks) was down. So nobody could transact, and
no blocks were made. Off Arbitrum, ETH kept falling. When the sequencer came back, the
first blocks got a fresh oracle update showing the full 11% move all at once. Keepers
were ready and borrowers were not. The price was correct and recent. The borrowers had
3.5 hours of price movement land on them in one block, with no chance to react.

You don't have a stale-price bug. You're missing a **sequencer liveness check**, plus a
**grace period** after the sequencer restarts.

## Why the staleness check could not catch it

1. **The outage stopped `block.timestamp` too.** No blocks means no on-chain time moves
   forward and no contract call runs. Your check never saw the outage. It only ran again
   after recovery.
2. **The first blocks after recovery have a real, current timestamp and a real, current
   price.** Chainlink nodes pushed the new round right away. `block.timestamp - updatedAt`
   was a few seconds, so the check passed, as it should.
3. **Freshness says nothing about access.** Your check assumes that if the price is fresh,
   users could have seen it and responded. On L1 that roughly holds. On an L2 with one
   sequencer it does not.
4. **The escape hatch was too slow.** Arbitrum lets users force a transaction in through
   the L1 delayed inbox, but it only goes through after about 24 hours. For a 3.5h outage,
   in practice no one could get out.
5. **Who gets in first after restart.** Keepers watch for recovery and submit right away.
   Borrowers' old wallet transactions may have dropped or have stale nonces or gas. Their
   add-collateral calls were sequenced after the liquidations, or never at all.

So each part worked as designed. The system as a whole assumed "the chain is live",
and that was false.

## What to change

### 1. Read Chainlink's L2 Sequencer Uptime Feed before using any price

Arbitrum One uptime feed proxy: `0xFdB631F5EE196F0ed6FAa767959853A9F217697D`
(check this against Chainlink's docs before you deploy).

- `answer == 0` → sequencer up, `answer == 1` → sequencer down.
- `startedAt` → when the status last changed. After recovery, this is when it came back up.
- The status is set by a message sent from L1, so the "down" flag is already on-chain
  before any queued transaction when the sequencer restarts. Your contract can see the
  outage even in the very first block afterward.

### 2. Add a grace period after recovery

Liquidations stay blocked until the sequencer has been back up for `GRACE_PERIOD`
(typical value: 3600s; pick one long enough for users to top up). This gives borrowers
the window they lost.

### 3. Where it goes in the flow

Put it in the **single oracle-read function** that every price consumer goes through.
Run it **before** `latestRoundData()` on the price feed. Don't put it inside `liquidate()`
alone. Then choose per action:

| Action | Sequencer down / in grace | Reason |
|---|---|---|
| `liquidate` | **revert** | the whole point of the fix |
| `borrow`, `withdrawCollateral` | **revert** | these need a trusted price. Stops people from pulling value while the price is jumping |
| `depositCollateral`, `repay` | **allow** (don't need a price) | these are how users save their own positions. Never block them |

```solidity
AggregatorV2V3Interface public immutable sequencerUptimeFeed;
uint256 public constant GRACE_PERIOD = 3600;

error SequencerDown();
error GracePeriodNotOver();

function _checkSequencer() internal view {
    (, int256 answer, uint256 startedAt, , ) = sequencerUptimeFeed.latestRoundData();

    // startedAt == 0: feed not initialised on this round -> treat as unsafe
    if (answer != 0 || startedAt == 0) revert SequencerDown();
    if (block.timestamp - startedAt <= GRACE_PERIOD) revert GracePeriodNotOver();
}

function _getPrice(AggregatorV3Interface feed, uint256 maxAge) internal view returns (uint256) {
    _checkSequencer();                                   // NEW: first, before price read

    (uint80 roundId, int256 answer, , uint256 updatedAt, uint80 answeredInRound) =
        feed.latestRoundData();
    require(answer > 0, "bad price");
    require(updatedAt != 0 && answeredInRound >= roundId, "incomplete round");
    require(block.timestamp - updatedAt <= maxAge, "stale price");
    return uint256(answer);
}
```

`liquidate`, `borrow`, `withdrawCollateral` → call `_getPrice` (so they run the sequencer check).
`depositCollateral`, `repay` → don't read the price, so they never run the sequencer check.

### 4. Related issue: your 3600s bound vs an 86400s heartbeat

A heartbeat of 86400s means the feed only promises one update per 24h, **plus** an update
whenever the price moves past the deviation threshold. On a quiet day the price can
legitimately sit unchanged for many hours. Your 1-hour check will then revert on a
correct price. That blocks liquidations right when you might need them, and bad debt
builds up. A tighter bound is not safer here. Set `maxAge` for each feed to its heartbeat
plus a small buffer (for example `86400 + 1800`). If you price wstETH through two feeds,
e.g. wstETH/ETH × ETH/USD (or a rate × a USD feed), check **each leg** against its own
heartbeat.

## Remediation for this incident (optional but worth considering)

The 38 borrowers were liquidated with no chance to act, and that was a failure in how the
protocol was designed. Consider paying back the liquidation bonus/penalty from the
treasury. Keepers did nothing wrong, so take the cost from the protocol, not from them.

## Checklist

- [ ] Add `sequencerUptimeFeed` + `GRACE_PERIOD` (immutable/constant, or governed with bounds)
- [ ] Call `_checkSequencer()` at the top of the shared price getter
- [ ] Make sure `repay` / `depositCollateral` never go through the price getter
- [ ] Set staleness bound per feed to heartbeat + buffer. Check every leg of any combined price
- [ ] Fork test: mock uptime feed `answer=1` → liquidate reverts, deposit/repay work.
      `answer=0, startedAt=now-10` → liquidate reverts. `startedAt=now-GRACE-1` → liquidate works
- [ ] Do the same on any other L2 deployment (Optimism, Base, etc. have their own uptime feeds)
