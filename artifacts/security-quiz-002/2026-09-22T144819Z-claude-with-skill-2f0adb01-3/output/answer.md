# Oracle design review: WETH collateral / USDC debt, 85% LTV, mainnet

## Summary

The proposal has one arithmetic claim that is correct and one that is load-bearing
and wrong.

Correct: moving the WETH/USDC 0.05% pool 10% does require pushing tens of millions
of notional through it.

Wrong: "they would eat the loss for nothing." The attacker does not eat the notional.
They eat the *round-trip fee on* the notional, which is ~0.1%, and they eat it inside
one atomic transaction where arbitrage bots are structurally unable to intervene.

The cost to make our contract read a price 10% off market is on the order of
**$60k–$200k**. The payout, against a book of $2M positions at 85% LTV, is in the
**millions**. `slot0` is not an acceptable price source here.

---

## 1. What the attack actually is

The teammate's mental model is: attacker pushes the price, waits, arbitrageurs
restore it, attacker loses money. That model describes a *cross-block* manipulation.
It is not the attack.

The attack is a single transaction:

```
tx {
  1. flash-borrow USDC                     (Balancer / Morpho: 0 fee)
  2. swap USDC -> WETH in the 5bps pool    ← slot0 now reads +10%
  3. call OUR contract                     ← our health calc reads the manipulated slot0
  4. extract (borrow, or liquidate others)
  5. swap WETH -> USDC back                ← price restored, attacker's own backrun
  6. repay flash loan
}
```

Steps 2 through 5 are in the same transaction. There is no point at which an
arbitrage bot can insert a trade. The attacker *is* the arbitrageur on the way back —
the profit the teammate expects bots to take away is captured by the attacker in
step 5. "Arbitrage bots would drag it back within the same block" is true and
irrelevant: they drag it back in the block, but after the transaction has already
completed.

This also removes any need to win a priority auction. The bundle is atomic and
position-independent, so the attacker just needs inclusion, not top-of-block.

---

## 2. What it costs

### The depth-independent argument

The important property: **a round trip through a constant-function AMM is
price-path-independent.** Swap in, swap back, and you return the pool to the same
reserves and yourself to the same balance — minus fees. Uniswap V3 accrues fees to a
separate accumulator rather than folding them into `liquidity`, so the curve the
attacker swaps back along is the same curve they swapped out along.

So for notional `N` through a 5bp pool:

```
round-trip cost ≈ 2 × 0.0005 × N = 0.10% of N
net slippage    ≈ 0
```

This is the line that kills the proposal, and it does not depend on estimating the
pool's depth:

| If moving 10% takes... | Round-trip cost to the attacker |
|---|---|
| $30M notional  | **$30,000** |
| $60M notional  | **$60,000** |
| $120M notional | **$120,000** |
| $200M notional (whole TVL) | **$200,000** |

Even taking the teammate's own $200M figure and assuming the *entire* pool must be
traversed, the cost is $200k. The "tens of millions" number is flow, not cost. It
never leaves the attacker's control for more than a few microseconds of EVM time.

### Filling in the other line items

- **Flash loan fee: $0.** Balancer V2 and Morpho flash loans are zero-fee. Aave's
  5bps would add ~$30k; there is no reason to use it.
- **Gas:** manipulation swap + N liquidations ≈ 3–5M gas. At 20 gwei / $4,000 ETH
  that is roughly $250–400. Noise.
- **Builder tip:** a bundle, not a priority race. Call it a modest fraction of profit.
- **Real depth caveat:** V3 liquidity is concentrated near the tick and thins out
  away from it, so pushing 10% is *cheaper* than a uniform-liquidity model suggests.
  The $200M TVL is spread across the full curve; only the liquidity actually crossed
  matters. The realistic figure for this pool is well under the full TVL.

**All-in: roughly $60k–$200k to make our contract read a 10%-wrong price.**

And note the attacker chooses the direction. Pushing the price *down* means selling
WETH into the pool, which they can source from the same flash loan. Down is the
direction that hurts us most — see below.

---

## 3. What they get for it

Two different attacks, with materially different economics. It's worth doing both,
because one of them is weaker than people assume and the other is worse.

### Attack A — inflate the price, over-borrow, walk away

Attacker deposits real collateral `C`, oracle reads `(1+Δ)` times true value,
borrows `0.85 × (1+Δ) × C`, abandons the position.

Profitable only when the borrow exceeds the collateral surrendered:

```
0.85 × (1 + Δ) > 1   →   Δ > 1/0.85 − 1 = 17.6%
```

**At Δ = 10% this attack loses money.** They borrow 93.5% of true collateral value
and give up 100%. A 6.5% loss.

At Δ = 20%, profit is 2% of collateral — $40k on a $2M position — against a
manipulation cost that has also roughly doubled to ~$120k+. With the $2M per-position
cap, this attack is marginal on a single position. It becomes real only if the
attacker can open many positions in the same transaction, in which case the
$120k manipulation cost is amortized across all of them and every position past the
first is pure profit. **Whether that is possible is a function of our position-cap
enforcement, not of the oracle.** Worth checking independently.

Honest read: Attack A is the one that gets cited most often, and at 10% it doesn't
work against our parameters. Attack B is the one that does.

### Attack B — crash the price, liquidate the healthy book

This is the real exposure, and it works at Δ = 10%.

A position is liquidatable when oracle LTV > 85%. Crash the oracle 10% and every
position with a *true* LTV above `0.85 × 0.9 = 76.5%` becomes liquidatable. That
76.5%–85% band is exactly where a lending market's positions cluster — borrowers
deliberately sit just under the threshold.

Single $2M position at 78% true LTV, 50% close factor, 8% liquidation bonus:

```
debt                = 0.78 × $2,000,000        = $1,560,000
repaid (50%)                                    =   $780,000
collateral seized   = $780,000 / 0.90 × 1.08    =   $936,000  (at true price)
profit                                          =   $156,000
```

That is one position, and it already clears the full manipulation cost.

The attack does not stop at one. The price crash applies to the **entire book
simultaneously**, inside the same transaction, paid for by the **same single
manipulation**. Every position in the 76.5%–85% band is liquidated in the same tx.

| Value of positions in the vulnerable band | Attacker profit @ ~20% extraction |
|---|---|
| $5M  | ~$390k |
| $20M | ~$1.6M |
| $50M | ~$3.9M |

Against a fixed ~$60k–$200k cost. The cost is constant in the size of our book; the
profit is linear in it. **The attack gets strictly more profitable the more successful
our protocol becomes.** That is the wrong shape for a security assumption.

Two things make this worse than the table suggests:

- The liquidation bonus is *our* money. We are not merely failing to prevent the
  attack; we are paying the attacker a premium to execute it, out of our users'
  collateral.
- The victims did nothing wrong. Someone at 78% LTV was, by our own parameters,
  healthy. We liquidate them because of a price that existed for the duration of one
  transaction and was never real.

---

## 4. On the three objections to Chainlink

They deserve direct answers rather than dismissal — one of them is a genuine
tradeoff.

**"An extra external call."** ~30k gas, call it $2.40 at 20 gwei. On positions up to
$2M. This is not a consideration.

**"Its answer can be stale between updates."** This is the objection that inverts on
inspection. The mainnet ETH/USD feed has a 0.5% deviation threshold and a 1-hour
heartbeat, so its error is *bounded at roughly ±0.5%* and it re-reports whenever the
market moves more than that. Compare the two failure modes:

| | Chainlink staleness | `slot0` manipulation |
|---|---|---|
| Magnitude | bounded, ~0.5% | unbounded — attacker picks it |
| Detectable on-chain | yes, `updatedAt` | no |
| Adversarially triggerable | no | yes, for ~$60k |

Staleness is a bounded error we can measure and reject. Manipulation is an unbounded
error we cannot see. Trading the first for the second is not a trade.

**"It puts a third party between us and our own liquidations."** This one is real.
Chainlink is a genuine trust and liveness dependency, and it should be named as such
in our risk docs. But the alternative on offer is not "no third party." It is
**putting every party with $60k and a flash loan between us and our liquidations.**
We are choosing which dependency, not whether to have one. Mitigate the Chainlink
dependency with the TWAP cross-check below, don't pretend it away.

**Why not just use a Uniswap TWAP instead?** A 30-minute V3 TWAP *does* restore the
teammate's argument — sustaining an off-market price across many blocks means
bleeding to arbitrageurs the whole time, which is genuinely expensive. But it costs
us 30 minutes of lag on real moves, which is dangerous in the other direction during
a sharp selloff, and a validator with consecutive slots can attack short TWAPs.
Use it as a bound, not as the price.

---

## 5. Recommendation

**Primary: Chainlink ETH/USD and USDC/USD, combined to get ETH/USDC.**
Do not hardcode USDC at $1.00. It traded at $0.88 in March 2023. Deriving the pair
from two USD feeds also means both legs get the same staleness treatment.

**Secondary: Uniswap V3 30-minute TWAP (`observe()`), used only as a sanity bound.**
If the two disagree by more than ~2%, fail closed on value-extracting operations —
block new borrows and block liquidations — while still allowing repayments and
collateral deposits. A borrower must always be able to save their own position even
when the oracle is degraded. `slot0` is never read.

The TWAP here is doing a specific job: it is the check on the Chainlink trust
assumption the teammate correctly identified. If Chainlink is compromised or wedged,
we halt rather than liquidate on a bad number.

---

## 6. Checks required around the price before it enters a health calculation

Reading the feed is the easy part. These are the checks; several of them correspond
to real incidents.

**On the feed read:**

1. **`answer > 0`** — revert on zero or negative. A signed int that has gone
   negative must never be cast to `uint256`.
2. **Staleness against the feed's actual heartbeat.** ETH/USD is 3600s → reject
   above ~3900s. Do *not* use a blanket 24h window; that is wide enough to be
   meaningless. The threshold must be per-feed, because feeds differ.
3. **`updatedAt != 0`** — an incomplete round.
4. **min/max circuit-breaker bounds.** Chainlink aggregators clamp at
   `minAnswer`/`maxAnswer`, and when the true price exits that band the feed keeps
   reporting the bound. This is how Venus lost money on LUNA: the feed reported
   $0.10 while LUNA was worth a fraction of a cent, and the protocol happily lent
   against it. Either read the aggregator's bounds and reject at them, or enforce
   our own absolute sanity range for ETH.
5. **Read `decimals()` from the feed; do not hardcode 8.**

**On the arithmetic:**

6. **Decimal normalization.** WETH is 18, USDC is **6**, the feed is 8. Every one of
   these is a different scale. Normalize to a single internal precision at the
   boundary, and derive the scale from `IERC20Metadata.decimals()` rather than
   literals.
7. **Multiply before dividing** in the LTV computation, and **round conservatively
   in our favour**: round collateral value *down*, round debt value *up*. A health
   factor that rounds the wrong way is a free dust-sized loan.

**On the cross-check:**

8. **Chainlink vs. 30-min TWAP divergence check**, with the fail-closed policy above.
9. **Rate-of-change guard.** If the price has moved more than some threshold since
   our last observation, pause liquidations for a short window. This buys time
   against a feed that has gone wrong, at the cost of some liquidation latency in a
   genuinely fast market — a tradeoff worth taking explicitly rather than by default.

**On usage:**

10. **One price read per transaction, cached in memory and reused.** Borrow-side and
    liquidation-side checks must not read the price at two different moments and
    reach inconsistent conclusions within one call.
11. **Never persist a price to storage for later reuse.** A stored favourable price
    is a stale price waiting to be exploited.
12. **No `try/catch` that swallows an oracle failure into a default value.** If the
    oracle fails, the transaction reverts. Silent fallbacks are how a bounded failure
    becomes an unbounded one.

---

## 7. One thing outside the oracle, since it interacts with these numbers

At $2M positions and an 8% liquidation bonus, confirm the bonus actually covers the
market impact of liquidating $2M of WETH. If a liquidator's real execution cost
exceeds the bonus, nobody liquidates, and positions go underwater into bad debt
regardless of how good our price is. A correct oracle attached to an uneconomic
liquidation incentive still produces losses. Worth sizing separately.
