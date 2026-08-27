# Post-mortem: 38 liquidations after the Arbitrum sequencer outage

## 1. What actually broke

Your freshness check is correct. It is also structurally incapable of detecting
what happened.

Look at what the check compares:

```solidity
require(block.timestamp - updatedAt <= 3600, "stale price");
```

`block.timestamp` is the chain's clock. `updatedAt` is the oracle's clock. The
check measures **the gap between the price and the chain**. That gap was never
the problem.

The gap that hurt you was **between the chain and the world** — and neither
term in that subtraction can see it.

Walk the timeline through the two clocks:

| Wall clock (UTC) | Real market | L2 `block.timestamp` | Feed `updatedAt` | `block.timestamp - updatedAt` |
|---|---|---|---|---|
| 09:14 | ETH starts falling | frozen ~09:14 | frozen ~09:14 | — no blocks, nothing executes |
| 09:14–12:40 | ETH −11% | **not advancing** | **not advancing** | — |
| 12:41 | ETH −11%, settled | jumps to ~12:41 | jumps to ~12:41 (aggregator's own queued tx lands in the same first blocks) | **a few seconds** |

During the outage no blocks were produced, so no contract call ran and no check
could fire. When the sequencer restarted, the Chainlink aggregator's update
transaction was in the same first batch as everything else. By the time your
`liquidate()` executed, a genuine, seconds-old, market-accurate ETH/USD price
was on chain.

So every statement in your write-up is true simultaneously:

- The price was fresh (seconds old).
- The price was correct (matched Binance).
- The check passed legitimately.
- The liquidation math was right.
- The users were robbed of any chance to respond.

**The vulnerability is not a stale price. It is an 11% price movement delivered
to your contract in a single atomic step, at a moment when your users had been
unable to transact for three and a half hours and keepers could transact
immediately.**

Tightening the bound does nothing. A 60-second bound would have passed too. A
10-second bound would have passed too. You cannot fix this on the price axis
because the price was never wrong.

## 2. Why the asymmetry was total

This is the part worth naming explicitly in the post-mortem, because it explains
why *all 38* went at once rather than some fraction.

Under normal conditions, the liquidation threshold is a *race*: price moves,
borrowers and keepers both see it, both submit transactions, and borrowers who
are paying attention usually win because they only need to move collateral a
short distance. Your 125% ratio is priced on the assumption that this race
exists.

The outage deleted the race:

- **Borrowers' recourse was gone.** Their top-up transactions sat in the public
  mempool / the app's RPC path, which routes through the sequencer. Arbitrum's
  force-inclusion path via the L1 delayed inbox exists, but the delay is ~24
  hours — useless over a 3.5-hour window, and not something an app user can
  invoke from your frontend anyway.
- **Keepers' recourse was intact.** A keeper does not need to act *during* the
  outage. It only needs to be first in the queue when the sequencer returns —
  which is a solved, commoditised problem. Bots were already positioned.

So at 12:41 the entire 11% move landed at once, on positions frozen at their
09:14 collateral, with only one side of the market able to act. 38 positions
crossing simultaneously is exactly the expected shape of that event, not an
anomaly on top of it.

The users did not fail to defend themselves. **The chain refused their defence
and accepted the attack.** Your contract could not tell the difference, because
from inside the EVM those three and a half hours simply did not exist.

## 3. The fix

You need a second oracle — one that answers a question `latestRoundData()` on
the price feed cannot: *was this chain reachable recently enough that a user
could have responded to this price?*

Chainlink publishes exactly that as the **L2 Sequencer Uptime Feed**. It is fed
from L1 through the delayed inbox — the same path that keeps working when the
sequencer is down — so it can record downtime that the sequencer itself could
never have written.

Arbitrum One: `0xFdB631F5EE196F0ed6FAa767959853A9F217697D`
(verify against Chainlink docs at deploy time; treat it as a constructor arg,
not a hardcoded constant, so you can migrate without a redeploy).

Semantics:
- `answer == 0` → sequencer up
- `answer == 1` → sequencer down
- `startedAt` → when the *current* status began. After a restart this is the
  restart timestamp. This is the field that matters.

```solidity
uint256 public constant GRACE_PERIOD = 1 hours;

error SequencerDown();
error GracePeriodNotOver();

function _requireSequencerHealthy() internal view {
    (, int256 answer, uint256 startedAt, , ) = sequencerUptimeFeed.latestRoundData();

    // 1 == down. Do NOT apply a staleness bound to this feed: it only
    // updates on status change and can legitimately be months old.
    if (answer != 0) revert SequencerDown();

    // startedAt == 0 means the feed round is not yet initialised (fresh
    // deployment / post-upgrade). Treat as unknown, i.e. not safe.
    if (startedAt == 0) revert GracePeriodNotOver();

    // Users need a window in which they can transact but keepers cannot.
    if (block.timestamp - startedAt <= GRACE_PERIOD) revert GracePeriodNotOver();
}
```

Applied to last Tuesday: `startedAt` = 12:41. Until 13:41, every one of those 38
liquidations reverts. The borrowers — whose transactions confirm normally from
12:41 onward — get a full hour to add wstETH or repay USDC. Positions still
underwater at 13:41 get liquidated, correctly, and the protocol is made whole.

## 4. Where it goes in the flow — this is the part that is easy to get wrong

**Do not put this inside `getPrice()`.**

It is the obvious place and it is the wrong place. If the sequencer gate lives in
the shared price getter, then during the grace period *every* price-consuming
path reverts — including the borrower's `addCollateral()` and `repay()` calls, if
those touch the price at all. You would hand your users a one-hour window in
which they are protected from liquidation and also **prevented from saving
themselves**, and then liquidate them at 13:41 anyway. That converts a
three-and-a-half-hour lockout into a four-and-a-half-hour lockout and changes the
outcome for nobody.

The gate belongs on **adverse actions only**, at the entry point, before any
price is read:

| Function | Gate? | Reason |
|---|---|---|
| `liquidate()` | **Yes** | The action the outage weaponised. Primary fix. |
| `borrow()` | Yes | Increases risk; nothing is lost by making users wait an hour. |
| `withdrawCollateral()` | Yes | Same. |
| `addCollateral()` | **No** | Strictly improves health. Must stay open — this is the escape hatch. |
| `repay()` | **No** | Strictly improves health. Must stay open. |
| `getPrice()` | **No** | Keep it a pure price read. Freshness check stays exactly as written. |

Concretely:

```solidity
function liquidate(address borrower, uint256 repayAmount) external {
    _requireSequencerHealthy();          // <-- first line, before any price read
    uint256 price = _getPrice();         // existing freshness check, unchanged
    ...
}

function addCollateral(uint256 amount) external {
    // no sequencer gate, no price needed — health can only improve
    ...
}

function repay(uint256 amount) external {
    // no sequencer gate, no price needed — health can only improve
    ...
}
```

Then **audit `addCollateral()` and `repay()` for incidental price dependencies**.
If either calls a shared `_healthFactor()` or `_accrueAndCheck()` helper that
reads the oracle, that helper is a hidden coupling that will re-break the escape
hatch. Split it: a `_healthAfter()` used by the gated paths, and a no-price fast
path for deposits and repayments. If a repayment path must read a price for
interest accrual, make sure it cannot revert on the sequencer gate.

Two-line summary of the placement rule, worth putting in a comment:

> The sequencer gate is a fairness check, not a data-validity check. It belongs
> where the protocol acts *against* a user, never where a user acts to protect
> themselves.

## 5. Trade-offs you are accepting, stated plainly

- **Grace period = deliberate bad-debt exposure.** For one hour after any
  restart, insolvent positions cannot be closed. If the market keeps falling
  during that hour, the shortfall lands on the protocol. That is the price of
  not confiscating collateral from users who were locked out; it is a real cost,
  not a free win. One hour is Chainlink's suggested default and a reasonable
  starting point. If your risk team wants tighter, 30 minutes is defensible for
  a wstETH/USDC book; below ~15 minutes the window stops being long enough for a
  human to notice and act, which defeats the purpose.
- **A softer alternative, if the bad-debt exposure is unacceptable:** instead of
  a hard revert, ramp the close factor from 0% to 100% across the grace window,
  and/or zero out the liquidation bonus during it. Borrowers get a shrinking but
  real window; the protocol keeps a release valve on a genuinely collapsing
  market. More moving parts — only take this on if the hard gate is modelled as
  too risky. Start with the hard gate.
- **This does not cover every liveness failure.** The uptime feed reports
  sequencer status. It will not catch your own RPC provider failing, the
  frontend breaking, or a gas-spike lockout. Those are separate problems with
  separate fixes.

## 6. Remediation for the 38

Out of scope for the code change, but it should be in the post-mortem as an
explicit decision rather than an omission: those liquidations were valid under
the contract as written and invalid under the contract as it should have been
written. The liquidation bonus paid to keepers over those 38 positions is
quantifiable from the receipts. Whether to reimburse it is a governance call —
but make it a call, not a silence.

## 7. Unresolved questions

1. Do `addCollateral()` / `repay()` currently read the oracle, directly or via a
   shared health helper? This decides whether the fix is three lines or a
   refactor.
2. Grace period: 1 hour, or does risk want it shorter given the bad-debt
   exposure at 125%?
3. Sequencer feed address — constructor arg with a setter, or immutable? Setter
   means an admin key that can disable the protection; immutable means a
   redeploy if Chainlink migrates. I lean immutable + redeploy.
4. Are there other keeper-driven or admin-driven adverse paths beyond
   `liquidate()` (auction starts, forced deleveraging, socialisation of loss)
   that need the same gate?
5. Reimbursement decision for the 38, and who owns it.
