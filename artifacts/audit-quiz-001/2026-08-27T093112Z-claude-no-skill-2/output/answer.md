# Post-mortem: 38 liquidations at 12:41 UTC

## 1. What actually happened

The Arbitrum One sequencer was down from 09:14 to 12:40. No blocks, so no
transactions — not your users' collateral top-ups, and not the Chainlink
transmitters either. The on-chain wstETH price froze at its 09:14 value.
The real price did not: ETH fell 11% on venues that were still running.

At 12:41 the sequencer resumed. In the first blocks:

1. Chainlink's OCR transmitters landed a fresh round. `updatedAt` ≈ now.
   The answer was correct — it matched the real, post-crash market price.
2. Keeper bots, which had been polling and queuing for 3.5 hours, called
   `liquidate()` in the same block or the one after.
3. Your users' top-up transactions were in the same mempool flood, competing
   for inclusion with bots that had better gas strategy and had been warm the
   entire time.

So the sequence your contract saw was: block N-1, all 38 positions healthy
at the 09:14 price. Block N, all 38 positions deeply underwater at the 12:41
price. From the contract's point of view the market gapped 11% in one block
and every position became liquidatable simultaneously. It did exactly what
it was written to do.

From the borrower's point of view, they had been trying to fix it since
mid-morning and the chain would not take their transaction.

**Both are true.** That gap is the whole bug.

## 2. Why your freshness check could never have caught this

Your check is:

```solidity
require(block.timestamp - updatedAt <= 3600, "stale price");
```

Both operands are L2 clocks. `block.timestamp` comes from the sequencer;
`updatedAt` comes from an oracle that can only publish through that same
sequencer. When the sequencer halts, **both hands of the clock stop
together, and both resume together.** The difference between them is
never large. An L2-wide halt is invisible to any measurement taken
entirely inside L2 time.

Note also that during the outage your check never even *ran* — nothing ran.
It only executed at 12:41, at which point the price genuinely was seconds
old. The check was correct. It was correct about the wrong thing.

Concretely, staleness is a property of **the data**. What you needed to know
is a property of **the user**:

| Question | Answered by |
|---|---|
| Is this price current? | `block.timestamp - updatedAt` ✅ working fine |
| Did the borrower have a chance to react to it? | **nothing in your system** ❌ |

Liquidation is not a pure function of price. It is a bargain with the
borrower: *if your health drops, you get an opportunity to cure it; if you
don't take it, we seize.* The legitimacy of the seizure rests entirely on
the cure opportunity having existed. An L2 outage silently voids that
premise while leaving every number in your oracle pipeline perfectly valid.

You validated the price. You never validated the borrower's ability to act.

(For completeness: Arbitrum's delayed inbox does let users force-include
transactions from L1 when the sequencer censors or halts. The force-inclusion
delay is ~24 hours. For a 3.5-hour liquidation window it is not a usable
escape hatch, and no normal borrower knows it exists.)

## 3. The fix

Gate liquidations on the **Chainlink L2 Sequencer Uptime Feed**, plus a
grace period after recovery. This is the standard remedy and it is the one
that maps exactly to your failure.

```solidity
interface IAggregatorV3 {
    function latestRoundData() external view returns (
        uint80 roundId, int256 answer, uint256 startedAt,
        uint256 updatedAt, uint80 answeredInRound
    );
}

// Arbitrum One sequencer uptime feed. VERIFY against Chainlink docs before deploy.
IAggregatorV3 constant SEQUENCER = IAggregatorV3(0xFdB631F5EE196F0ed6FAa767959853A9F217697D);

uint256 public gracePeriod = 3600; // see sizing note in §6

error SequencerDown();
error GracePeriodNotOver(uint256 secondsRemaining);

function _requireL2Live() internal view {
    (, int256 answer, uint256 startedAt, , ) = SEQUENCER.latestRoundData();

    // answer: 0 = sequencer up, 1 = sequencer down
    if (answer != 0) revert SequencerDown();

    // startedAt == 0 means the round is not yet initialised (e.g. immediately
    // after an L2 upgrade). Treat as unknown, i.e. as down.
    if (startedAt == 0) revert SequencerDown();

    uint256 sinceUp = block.timestamp - startedAt;
    if (sinceUp <= gracePeriod) {
        revert GracePeriodNotOver(gracePeriod - sinceUp + 1);
    }
}
```

`startedAt` on the uptime feed is the timestamp at which the *current status*
began. After a recovery it is the moment the sequencer came back — 12:40 in
your incident. So `_requireL2Live()` would have reverted every one of the 38
liquidations until 13:40, giving those borrowers a full hour of live chain in
which to add collateral or repay.

That is the entire fix for the reported incident. The rest of this document
is placement and hardening.

## 4. Where it goes in the flow

This is the part people get wrong, and getting it wrong reproduces the same
harm from a different direction.

**Do not put this in your shared `getPrice()`.** If the guard lives in the
price path, it reverts on *every* function that reads a price — including
`repay()` and `addCollateral()`. You would spend the grace period blocking
the exact transactions the grace period exists to permit. That turns a fair
fix into a second outage.

The guard belongs at the **entry point of each risk-increasing action**, as
the first statement, before any price read or health computation.

```
liquidate(user, repayAmount)
  ├─ _requireL2Live()          ← NEW. first line. reverts during outage + grace.
  ├─ price = _getPrice()       ← unchanged freshness check lives here (see §5)
  ├─ hf = _healthFactor(user, price)
  ├─ require(hf < 1.25e18)
  └─ seize()

borrow(amount)            ├─ _requireL2Live()  ← NEW
withdrawCollateral(amount)├─ _requireL2Live()  ← NEW

repay(amount)             ← NO GATE. must always work.
addCollateral(amount)     ← NO GATE. must always work.
```

Per-action policy:

| Action | During outage | During grace period | Rationale |
|---|---|---|---|
| `repay` | n/a (no blocks) | **allowed** | this is the cure; never block it |
| `addCollateral` | n/a | **allowed** | this is the cure; never block it |
| `liquidate` | n/a | **blocked** | borrower has not had their window yet |
| `borrow` | n/a | **blocked** | see below |
| `withdrawCollateral` | n/a | **blocked** | see below |

`borrow` and `withdrawCollateral` must be blocked during grace for a reason
that is not obvious: during grace, liquidation is disabled. That is a window
in which a position cannot be seized no matter how underwater it goes. If
risk-increasing actions stay open, an attacker can deliberately lever up into
guaranteed-unliquidatable territory and hand you the bad debt. Disable
liquidation and leverage together, or not at all.

Deleveraging is always permitted. Levering is not. That asymmetry is the
correctness condition.

## 5. Secondary finding: your staleness bound is backwards

> "Our collateral feed's heartbeat is 86400 seconds, so our one-hour bound is
> far tighter than the feed itself promises."

Tighter than the heartbeat is not safer — it is a self-inflicted liveness
bug. The feed's contract with you is: *it will publish at least every 86400s,
and sooner if the deviation threshold is breached.* In a calm market with no
deviation trigger, a perfectly healthy feed can legitimately go four hours
without a round. Your 3600s bound reverts **everything** at that point,
including `repay()` and `addCollateral()`. You are currently being saved only
by the fact that wstETH moves often enough to trip the deviation threshold.
A quiet weekend brings the protocol down.

```solidity
// per-feed, from that feed's published heartbeat, plus buffer for
// transmitter/inclusion latency
uint256 maxStaleness; // wstETH/USD on Arbitrum: 86400 + ~1800 buffer
```

Derive the bound from the feed's actual heartbeat. Store it per feed, not as
a global constant. If you want a tighter safety property than the feed
offers, that is a job for a deviation circuit breaker, not for a staleness
bound — a staleness bound can only convert a data-quality question into an
availability failure.

## 6. Sizing the grace period, and what it costs you

The grace period is not free. For its duration you carry positions that are
underwater and unseizable. If the market keeps falling during that hour, some
of that becomes bad debt on your books. You are explicitly buying borrower
fairness with protocol solvency risk. That is the right trade — the
alternative is what happened last Tuesday — but price it deliberately:

- **1 hour is the conventional value** and is enough for an attentive user
  with a funded wallet. It is not enough for someone asleep. If your borrower
  base is retail, consider 2–4 hours and size your reserve fund accordingly.
- **Ramp the close factor after grace instead of a cliff.** At `sinceUp ==
  gracePeriod + 1` you otherwise get the same synchronised 38-position sweep,
  just an hour later, and the same gas auction against user top-ups. Linearly
  scaling the max close factor from 0 → 100% over the following 30–60 minutes
  spreads the unwind and lets late top-ups still land.
- **Notify.** The on-chain grace period is worthless if nobody knows their
  clock is running. Your keeper/monitoring stack already knows which positions
  are underwater at recovery; that list should trigger user alerts at minute
  zero of grace, not be handed straight to a liquidation bot.

## 7. Optional backstop: oracle-gap detection

The uptime feed covers *sequencer* outages. It does not cover the symmetric
case where the chain is fine but the feed itself stops updating — an OCR
transmitter failure, or an aggregator that stops reporting during exactly the
kind of volatility that matters. That produces the same shape of harm: a
frozen price, then a jump, then a sweep.

Cheap detection, since a real gap is visible in the round history:

```solidity
uint256 constant MAX_FEED_GAP = 1800;

/// @return resumedAt 0 if no gap detected, else the timestamp the feed resumed
function _feedGapResumedAt(IAggregatorV3 feed) internal view returns (uint256) {
    (uint80 roundId, , , uint256 updatedAt, ) = feed.latestRoundData();
    if (roundId == 0) return 0;
    // NOTE: proxy roundIds are phase-encoded; roundId-1 does not exist across a
    // phase boundary, hence the try/catch. Degrades to "no gap detected".
    try feed.getRoundData(roundId - 1) returns (uint80, int256, uint256, uint256 prevUpdatedAt, uint80) {
        if (prevUpdatedAt != 0 && updatedAt - prevUpdatedAt > MAX_FEED_GAP) {
            return updatedAt;
        }
    } catch {}
    return 0;
}
```

Feed the result into the same grace-period logic as `_requireL2Live()`. Treat
this as defense in depth, not as a substitute for the uptime feed — the
phase-boundary caveat means it can silently return "no gap".

## 8. The 38 positions

Separate from the code change, and your call: those borrowers were liquidated
by a system that was working as designed and whose design was wrong. The
liquidation bonuses paid out are recoverable from your reserve if you choose
to make them whole. Deciding that before you ship the fix is better than
deciding it after, because the fix is an implicit admission that the sweep
should not have happened.

## Unresolved questions

1. Grace period length — 1h (convention) or longer (your borrowers are retail
   and were asleep)? Depends on reserve size. Need your bad-debt tolerance.
2. Close-factor ramp — worth the extra complexity, or accept the cliff?
3. Is wstETH/USD a single feed for you, or composed stETH/ETH × ETH/USD? If
   composed, each leg needs its own heartbeat-derived staleness bound and both
   need the gap check.
4. Should `gracePeriod` be governance-settable, and if so with what timelock?
   Settable-to-zero is a liquidation backdoor.
5. Restitution for the 38 — in scope for this post-mortem or a separate call?
