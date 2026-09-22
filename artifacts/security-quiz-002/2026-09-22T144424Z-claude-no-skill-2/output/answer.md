# Oracle design review: pricing WETH collateral in the USDC lending market

**Verdict up front:** do not use `slot0`. The write-up's numbers are right about the
*notional* required and wrong about the *cost*, and those are not the same quantity.
The attack costs roughly **$40k–$80k with zero capital at risk**, and a single one of our
own $2M positions pays about **$167k** back. We should price collateral with the
Chainlink ETH/USD aggregator (plus USDC/USD), with an explicit validation wrapper.

---

## 1. Where the teammate's argument breaks

Three separate errors, in increasing order of severity.

**"$200M of liquidity."** That is pool TVL, not depth at the tick. In Uniswap V3 that
$200M is spread across ranges; only the liquidity in the ticks the price actually crosses
resists the trade. The number that matters is `liquidity()` at the current tick plus the
tick bitmap above/below it, and it is a small fraction of TVL. It is also *withdrawable* —
an LP can pull or JIT-manage their range in the same block, and the attacker is allowed to
be that LP.

**"Arbitrage bots would drag it back within the same block."** They cannot. The attack is
one transaction: manipulate → read → unwind. No other actor gets to execute between our
`slot0` read and the price restoration, because nothing in the EVM interleaves with an
atomic call frame. "Same block" is the wrong granularity; the relevant granularity is "same
transaction," and inside that the attacker is alone.

**"They would eat the loss for nothing."** They eat no loss, because they reverse the trade
themselves at the end of the same transaction. A Uniswap swap curve is deterministic and
reversible: push the price out and push it back, and you get your tokens back **minus the
fee on each leg**. Arbitrageurs get nothing because there is nothing left to arbitrage by
the time the transaction ends. The cost of manipulation is not the notional — it is
`2 × fee × notional`.

That last point is the whole thing. The fee tier is 0.05%, so the round trip costs **0.10%
of whatever notional they route**. "Tens of millions of dollars" of flow costs tens of
*thousands* of dollars.

---

## 2. What it actually costs to move `slot0` by 10%

### Notional required

For a Uniswap V3 pool with liquidity `L` held constant across the traversed range, moving
the price from `P₀` to `P₁`:

```
quote token in  (price up):    Δy = L·(√P₁ − √P₀)      = y_virtual · (√(1+δ) − 1)
base token in   (price down):  Δx = L·(1/√P₁ − 1/√P₀)  = x_virtual · (1/√(1−δ) − 1)
```

The useful form is relative to a depth figure you can measure yourself. If `D₂` is the
notional that moves the pool 2% (the standard depth metric, and something you can read off
the Quoter in an afternoon), then the notional to move it by δ is:

| δ (price move) | multiple of `D₂`, price up | multiple of `D₂`, price down |
|---|---|---|
| 3%  | 1.50× | 1.51× |
| 5%  | 2.48× | 2.56× |
| **10%** | **4.91×** | **5.33×** |
| 20% | 9.59× | 11.6× |
| 30% | 14.1× | 19.2× |

The WETH/USDC 0.05% pool's ±2% depth sits in the **$8M–$15M** band under normal conditions
(lower during volatility, when LPs widen or pull). So a 10% move takes on the order of

```
N ≈ 4.9 × $8M  … 4.9 × $15M   ≈  $39M – $74M
```

This matches the teammate's "tens of millions" — and it is an **upper bound**, because
liquidity thins out past the tight band, so the tail of the move is cheaper per dollar than
the uniform-`L` extrapolation assumes.

### Cost of that notional

```
Round-trip swap fees   = 2 × 0.0005 × N     = $39k – $74k
Flash loan             = 0% (Balancer / Morpho / Uniswap V3 flash)
                         or 0.05% on Aave V3
Gas (~2M gas @ 20 gwei, ETH $4k)            ≈ $160
Capital required                            = $0
Downside if unprofitable                    = $0 (revert the whole transaction)
────────────────────────────────────────────────────────
Total                                       ≈ $40k – $80k
```

Call it **under $100k, fully flash-financed, risk-free**. The attacker never holds a
position, never takes price risk, and simulates the whole thing before sending it. If the
numbers don't work, the transaction reverts and they pay gas.

And they don't need a full 10%. They need exactly enough to clear the health threshold of
the positions they are targeting — see below.

---

## 3. What they get for it

### Attack A — push the price *down*, self-liquidate the book (the cheap one)

Dropping the read price by `d` inflates every measured LTV by `1/(1−d)`. Every position
with a *true* LTV at or above `0.85 × (1−d)` becomes liquidatable:

| price pushed down by | positions swept (true LTV ≥) | attacker profit per $1 of debt repaid, 5% bonus |
|---|---|---|
| 3%  | 82.45% | **8.3%** |
| 5%  | 80.75% | **10.5%** |
| 10% | 76.50% | **16.7%** |

The profit arithmetic: the liquidator repays `D` of USDC and receives collateral worth
`D×(1+bonus)` **at the oracle price**. Since the oracle price is `(1−d)` of the true price,
what they actually receive is worth `D×(1+bonus)/(1−d)` in the real market. With a 5% bonus
and a 10% push: `1.05/0.90 − 1 = 16.67%`.

At 10% and a $60k cost, break-even is **$360k of debt repaid**. Our positions go to $2M.
One $2M position at ~78% true LTV, with a 50% close factor, is $1M of debt repaid →
**$167k gross, ~$107k net on a single position.**

The structural problem is that **the manipulation cost is paid once and the extraction
scales linearly with the book.** Every additional position in the 76.5%–85% band in that
same transaction is pure marginal profit. A healthy $50M book with a normal LTV
distribution might have $5–10M of debt sitting in that band; at 16.7% that's $0.8M–$1.7M
extracted for one $60k fee payment.

If the bonus is 8% or 10% rather than 5%, the numbers get worse (20% and 22% per dollar at
a 10% push), and the attack becomes profitable at a 3% push — which costs about $12k–$22k
of notional fees and sweeps everything above 82.45% true LTV. That is a rounding error
against the natural liquidation queue.

Note the positions being liquidated are *healthy*. Their owners did nothing wrong; they are
simply deleted at a discount by whoever pays $60k in Uniswap fees.

### Attack B — push the price *up*, over-borrow (the expensive one)

Deposit WETH of true value `V`, have the contract read it at `(1+δ)`, borrow
`0.85 × (1+δ) × V`. This only clears break-even when `0.85 × (1+δ) > 1`, i.e.
**δ > 17.6%**, and realistically ~20%+ once you account for slippage on the unwind.

Cost at δ = 20–25%: notional ≈ 9.6–11.9 × `D₂` ≈ $77M–$180M → **$77k–$180k in fees**.
Gain at δ = 25%: `0.85 × 1.25 − 1 = 6.25%` of the collateral deposited. Deposit $10M of
flash-loaned WETH → **$625k**, leaving a bad-debt hole of the same size in the pool. Also
fully self-financing: flash-loan the WETH, deposit it, borrow the USDC, swap back to repay
the flash loan — the condition for that to close is exactly the profitability condition.

The cap on this one is our available USDC borrow liquidity, not the attacker's capital.

### The bound that isn't there

Our $2M per-position cap does not cap either attack. Attack A aggregates across every
position in the band; attack B is capped by pool USDC liquidity, not per-position limits.

---

## 4. Why "stale Chainlink" is the wrong thing to be worried about

The teammate's objections to Chainlink are real but they are the *small* risks, and
critically they are **bounded and checkable**:

- Staleness is measurable. `updatedAt` is in the return value. You can read it and decide.
- Deviation is bounded. Mainnet ETH/USD is a 0.5% deviation threshold / 1h heartbeat feed,
  so the worst-case drift is a known quantity you can size an LTV buffer against.
- The "third party between us and our liquidations" is a real dependency. But the
  alternative is a dependency on *whoever is paying the most for blockspace in the block
  our liquidation lands in* — an unaccountable adversary instead of an accountable vendor.

`slot0`'s error, by contrast, is **unbounded and uncheckable**. There is no field on the
pool that tells you "this price was set 400ms ago by someone who is about to unset it."
That is the asymmetry: one oracle's failure mode has a number attached to it and the other
doesn't.

Moving the Chainlink aggregate requires moving the **global** ETH spot market across the
feed's off-chain sources, for the duration of the aggregation window, against the whole
world's arbitrage. That is a nine-figure, non-atomic, at-risk operation. Not $60k of
Uniswap fees.

### What about a Uniswap TWAP instead?

Better than `slot0` — sustaining a deviation across N blocks means genuinely bleeding to
arbitrageurs each block, and the cost becomes real. But:

- Post-Merge, a proposer with consecutive slots (or a builder relationship) weakens
  multi-block TWAPs materially. The pre-Merge cost analyses no longer hold.
- More importantly, a TWAP **lags**. A 30-minute TWAP in a fast ETH drawdown means
  positions are deeply underwater before the oracle notices, and liquidators can't act.
  You've traded manipulation risk for latency risk, and for a lending market latency risk
  *is* bad debt. This is a bad trade at 85% LTV.

Use the TWAP as a sanity check, not as the price. See §5, item 12.

---

## 5. What to price with, and what to check

**Price collateral with Chainlink ETH/USD (the proxy, `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419`), and USDC with Chainlink USDC/USD.** Aave and Morpho both do this; it is the
boring, correct answer.

Then, the checks. In rough order of how likely each is to actually cost us money:

1. **Decimal scaling — this is the one that will bite you, not the oracle attack.**
   ETH/USD is 8 decimals, WETH is 18, USDC is 6. Read `decimals()` once at deployment and
   store it; do not hardcode `8`. Write the scaling out explicitly and unit-test it against
   a known price. A scaling bug loses the pool in one transaction with no attacker required.

2. **Use `latestRoundData()`, never `latestAnswer()` / `latestTimestamp()`.** The legacy
   getters return no staleness information at all.

3. **Reject non-positive answers.** `require(answer > 0)`. Signed return type, and a zero
   or negative reading must not flow into a health factor.

4. **Staleness check, per-feed.** `require(block.timestamp - updatedAt <= maxStaleness)`,
   where `maxStaleness` is derived from *that feed's* heartbeat plus a margin — e.g. 3600 +
   ~900s for ETH/USD. Do **not** use one global constant across feeds: USDC/USD is a
   0.25% deviation / **24 hour** heartbeat feed, so the same constant is either far too
   tight for one or uselessly loose for the other. Make it per-feed and configurable.

5. **Own min/max sanity bounds.** The underlying aggregator historically had
   `minAnswer`/`maxAnswer` bounds; if the true price left the band, the feed reported the
   *bound* rather than reality. That is exactly how Venus lost money on LUNA. Newer
   aggregators have widened or removed these, but check the specific aggregator behind the
   proxy, and keep your own absolute sanity band that reverts or pauses outside it.

6. **Read the proxy, not the aggregator.** Chainlink rotates the underlying aggregator; the
   proxy address is the stable one. Hardcoding the aggregator means silently reading a dead
   feed after a rotation.

7. **`answeredInRound >= roundId` is a no-op on modern OCR feeds** (it always equals
   `roundId`). Include it if you like, but do not count it as staleness protection —
   item 4 is what protects you.

8. **Price both legs.** You need WETH/USDC, not ETH/USD. Treating USDC as exactly $1.00 is
   an unhedged bet against a depeg — USDC traded at $0.88 in March 2023. Combine ETH/USD
   and USDC/USD so a depeg shows up in health factors. (And note item 4: the USDC feed's
   24h heartbeat is genuinely slow and needs its own thinking.)

9. **Decide the failure mode deliberately, per operation.** Reverting on a stale price
   blocks *liquidations*, which creates bad debt in precisely the scenario where you most
   need liquidations to work. Recommendation:
   - **borrow / withdraw:** revert on stale or out-of-band. Fail closed.
   - **liquidate:** revert too, but have a defined fallback — a secondary feed
     (Redstone/Pyth/API3) behind a divergence check, plus a guardian pause. A single feed's
     heartbeat gap must not be able to turn into unbounded bad debt.

10. **Round conservatively and asymmetrically.** Collateral valued at the low end, debt at
    the high end, wherever you have a band or two sources. Never let rounding create
    borrowing headroom.

11. **Never combine oracles with `max()` or `min()` naively.** Taking the max of Chainlink
    and a spot read reintroduces the manipulable oracle as an upper bound on collateral
    value — you get the worst of both. Combine only via *agreement* checks.

12. **Keep the Uniswap pool, but only as a circuit breaker.** A 30-min TWAP (not `slot0`)
    compared against Chainlink: if `|chainlink − twap| / chainlink > X%` (say 2–3%), pause
    *new borrows* and flag for the guardian. Do not pause liquidations, and do not let the
    TWAP price anything. This gets the "our own on-chain source of truth" benefit the
    teammate wants without letting it set a single health factor.

13. **Use one price consistently within a transaction.** The health check and the
    liquidation payout must read the same price at the same moment. Re-reading between
    them is a reentrancy-shaped bug even without reentrancy.

14. **Size the LTV buffer against the oracle's own tolerance.** At a 0.5% deviation
    threshold the feed can legitimately be ~0.5% off, plus intra-threshold drift, plus
    price movement during the liquidation window. 85% LTV on WETH leaves 15% for all of
    that, which is fine — but make sure the liquidation bonus and close factor are sized so
    that an error *within* the tolerated band is not itself a profitable trade.

---

## 6. The number to take away

| | Uniswap V3 `slot0` | Chainlink ETH/USD |
|---|---|---|
| Cost to move the read price 10% | **~$40k–$80k**, flash-financed, atomic, risk-free | move the global ETH market for the aggregation window; 9 figures, at risk, non-atomic |
| Return on one $2M position at 78% LTV | **~$167k gross** | — |
| Marginal cost of extending to the whole book | **$0** | — |
| Error bound | none, and unobservable on-chain | ~0.5% + heartbeat, and readable from the return value |

The teammate is right that it takes tens of millions of dollars of flow. They're wrong that
flow is cost. At 5 basis points a side, reversed in the same transaction, tens of millions
of flow is a **$40,000 invoice** — and we'd be handing over six figures for it.
