# Post-mortem: 38 liquidations after the Arbitrum sequencer outage

## What happened

The chain didn't stop. **The Arbitrum sequencer did.** The sequencer is the one
operator machine that orders transactions on Arbitrum One. When it is down:

- no new L2 blocks are made, so no user transaction lands (users can force a
  transaction in through L1 via the delayed inbox, but only after a ~24h delay,
  far longer than 3.5h);
- the rest of the world keeps trading. ETH fell 11%;
- Chainlink's own price updates can't land either. The on-chain price stays
  frozen at the 09:14 value.

When the sequencer came back at 12:41, the first transactions in were:

1. Chainlink's price update: the new price, 11% lower, with `updatedAt = now`.
2. Keeper liquidations in the same or the next blocks. Keepers are bots, and
   they were queued and ready.
3. Borrowers' "add collateral" transactions, too late. Humans react in minutes,
   and their wallets and RPC nodes were still retrying.

## Why the freshness check didn't help

`block.timestamp - updatedAt <= 3600` answers one question: **is this price
recent?** It was. It was published seconds earlier and matched the market.

The question you needed answered was different: **did users have a fair chance
to react to this price?** They didn't. From their side, the whole 11% move
arrived in one step at 12:41. For 3.5 hours they couldn't act. Then the price
jumped, and they had no time before liquidation.

A staleness check looks at the price. This failure was about the chain, and
nothing in your flow checks the chain's liveness. Everything worked as written.
What's missing is a check that the chain has been up long enough for users to
act.

## The fix: sequencer uptime check + grace period

Chainlink publishes an **L2 Sequencer Uptime Feed** for Arbitrum One:
`0xFdB631F5EE196F0ed6FAa767959853A9F217697D` (check it against Chainlink's docs
before you deploy).

- `answer == 0`: sequencer up. `answer == 1`: sequencer down.
- `startedAt`: when the status last changed, which is when it came back up.

The "down" and "up" flags are sent from L1 through the delayed inbox. When the
sequencer restarts, it processes them before any new transaction. So the first
L2 block after an outage already shows the recent "back up" time.

### Code

```solidity
AggregatorV2V3Interface public immutable sequencerUptimeFeed;
uint256 public constant GRACE_PERIOD = 3600; // 1h after sequencer restarts

error SequencerDown();
error GracePeriodNotOver();

function _checkSequencer() internal view {
    (, int256 answer, uint256 startedAt, , ) = sequencerUptimeFeed.latestRoundData();
    if (answer != 0) revert SequencerDown();
    // startedAt == 0 means the feed has no valid round yet; treat as not safe
    if (startedAt == 0) revert SequencerDown();
    if (block.timestamp - startedAt <= GRACE_PERIOD) revert GracePeriodNotOver();
}
```

### Where it goes in the flow

Put it in the protocol logic, not inside the generic price getter, because
different actions need different rules:

| Action | Sequencer down | Grace period after restart |
|---|---|---|
| `liquidate` | **block** | **block**. This is the fix that would have saved the 38. |
| `borrow` / increase debt | block | block (prices just jumped; don't open new risk at them) |
| `withdrawCollateral` | block | block (same reason: it lowers health) |
| `addCollateral` / `repay` | **allow** | **allow**. Users must be able to save themselves. |

Order inside `liquidate` (and `borrow` / `withdraw`):

```solidity
function liquidate(address borrower, uint256 repayAmount) external {
    _checkSequencer();                 // 1. chain up + grace period over
    uint256 price = _getPrice();       // 2. your existing answer>0 / staleness checks
    require(_healthFactor(borrower, price) < 1e18, "healthy"); // 3. existing logic
    ...
}
```

`addCollateral` and `repay` must **not** call `_checkSequencer()`. Check this:
if they read the price through a shared modifier or helper that calls it, the
fix locks users out of the only actions that help them.

### Choosing the grace period

One hour is the common default (Aave's `PriceOracleSentinel` works the same
way). It should be long enough for a user to notice, open the app, and get a
transaction in, even with RPC backlogs after a restart. Make it an admin
parameter with sane bounds, not a hardcoded value, if you expect to tune it.

Optional refinement, like Aave v3.1: during the grace period, still allow
liquidation of positions that are *deeply* insolvent (e.g. collateral below
~105%), so the protocol doesn't eat bad debt. Positions that are only slightly
under 125% get the grace period. Decide based on how much bad debt you can
absorb.

## Also fix: your staleness window vs. heartbeat

You say the collateral feed's heartbeat is 86400s and you require
`<= 3600`. Your bound is tighter than the feed's promise, so this isn't extra
safety. It means that on any calm day with no price-deviation update, the feed
is legitimately more than 1h old and **every price read reverts**. That blocks
liquidations, borrows and withdrawals at random. Set the bound per feed to
heartbeat plus a small buffer (e.g. `86400 + 1800` for that feed). If wstETH/USD
is built from two feeds (wstETH/ETH rate × ETH/USD), check each feed against its
own heartbeat.

## Summary

- **Cause:** the price was fresh, but users had no chance to react to it. A
  staleness check can't detect sequencer downtime.
- **Change:** add a Chainlink L2 Sequencer Uptime Feed check with a grace period
  (~1h). Call it first in `liquidate`, `borrow` and `withdrawCollateral`, before
  the price read. Never call it in `addCollateral` or `repay`.
- **Side fix:** set the staleness bound per feed from its heartbeat; it's
  currently shorter than the heartbeat.
