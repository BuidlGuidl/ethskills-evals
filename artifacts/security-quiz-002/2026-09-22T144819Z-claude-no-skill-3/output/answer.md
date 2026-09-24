# Oracle design review: pricing WETH collateral for the USDC lending market

**Verdict up front:** the proposal's cost model is wrong by roughly three orders of
magnitude. It prices the *notional* pushed through the pool as if it were the
attacker's loss. It isn't. The attacker never holds the position long enough to
lose anything, and never needs the capital in the first place. Moving the 0.05%
WETH/USDC pool 10% at the exact instant our contract reads it costs on the order
of **$25k–$130k, all of it swap fees**, with **zero capital at risk** and **zero
arbitrage exposure**. One $2M position pays that back several times over.

The three claims in the writeup, checked:

| Claim | Status |
|---|---|
| "$200M of liquidity, so tens of millions to move it 10%" | Notional is right-ish; calling it the attacker's cost is wrong |
| "arbitrage bots would drag it back within the same block" | Arbitrage cannot enter an atomic transaction. This is the load-bearing error |
| "they would eat the loss for nothing" | There is no loss to eat — round trips on an AMM are fee-only |

---

## 1. What it actually costs to move the price 10%

### 1.1 The TVL number is the wrong number

$200M is the pool's total value locked across *all* tick ranges. Price impact in
Uniswap V3 depends only on the liquidity `L` in the ticks the swap actually
crosses. Most of that $200M sits in ranges nowhere near spot. The number that
matters is depth around the current tick.

Work in terms of the virtual reserve `V = L·√P` (units: USDC). Within a constant-`L`
range, swapping token0 for token1 moves `√P → √P'`:

```
USDC out  Δy = L(√P − √P')          = V·(1 − √(1−δ))
WETH in   Δx = L(1/√P' − 1/√P)      = V/P·(1/√(1−δ) − 1)   [worth V·(1/√(1−δ) − 1) at the pre-trade price]
```

for a downward move of fraction `δ`. Calibrate `V` from a quantity people actually
publish — ±2% depth. `δ = 0.02` gives `Δy = V·(1 − √0.98) = 0.01005·V`, so
`V ≈ depth₂% / 0.01005 ≈ 99.5 × depth₂%`.

### 1.2 The round trip

The attack is one transaction:

```
1. flash-borrow WETH
2. swap WETH → USDC   (pushes pool price down 10%)
3. call our liquidate() / borrow() — our contract reads slot0 here
4. swap USDC → WETH   (pushes price back)
5. repay flash loan; keep the proceeds from step 3
```

Steps 2 and 4 are a round trip on a deterministic curve with no trades in
between. **A zero-fee round trip on an AMM returns exactly the input.** The
slippage on leg 2 is not a loss — it is recovered on leg 4, because the pool
walks back down the identical tick path. The only thing that does not come back
is the fee taken on each leg. That is the entire cost of the price move.

Cost = 0.05% × (leg-1 input) + 0.05% × (leg-2 input).

| ±2% depth | implied `V` | leg 1 in | leg 2 in | **round-trip fee cost** |
|---|---|---|---|---|
| $5M  | $0.50B | $26.9M | $25.5M | **~$26k** |
| $10M | $0.99B | $53.8M | $51.1M | **~$52k** |
| $15M | $1.49B | $80.7M | $76.6M | **~$79k** |
| $25M | $2.49B | $134.6M | $127.6M | **~$131k** |

Note what the "tens of millions" in the writeup actually is: the **leg 1 / leg 2
notional columns**. The teammate read the right column and then labelled it
"cost". It is turnover, not expenditure.

Two corrections, both in the attacker's favour:

- **Uniform `L` is optimistic for us.** Real V3 liquidity thins out as you walk
  away from spot. Past the dense band the same `Δx` buys a larger `δ`, so the
  real 10% costs *less* than the table. The table is an upper bound.
- **The attacker routes for cost, not for one pool.** If our contract reads the
  0.05% pool, they only have to move *that* pool. They can also split across the
  0.3% pool or an aggregator to minimise fees on the legs they don't need to
  distort.

### 1.3 Capital cost: zero

`$80M` is not the attacker's money. Flash-loan it:

- Balancer V2 / Morpho flash loans: **0 bps**
- Uniswap V3 flash: 0.05% (but you're already in the pool)
- Aave V3: 5 bps → ~$40k on $80M, and even that is avoidable

Realistic all-in: **$25k–$130k**, dominated by Uniswap fees, with the best
routing landing at the low end. No inventory, no overnight exposure, no price
risk.

### 1.4 Why "arbitrage bots would drag it back" fails

Arbitrage is a cross-transaction mechanism. It cannot insert a transaction into
the middle of an atomic transaction. Between the attacker's step 2 and step 4,
no other EVM state transition occurs. The manipulated price exists for exactly
one call frame, and our `slot0` read happens inside it.

This is the whole vulnerability. `slot0` is not "the market price" — it is the
last price any caller wrote, including the caller currently on the stack. It is
a value the attacker controls at read time.

And even non-atomically it's cheap: top-of-block / end-of-block placement is a
purchasable good via builder bundles, so the attacker can straddle a block
boundary for the price of a bribe if they ever needed to.

### 1.5 Failure is free

The whole thing is wrapped in a profitability check. If the position isn't
liquidatable, or someone front-ran it, the attacker reverts the transaction and
pays only gas. The $80k is spent **only on the branch where it profits.** So this
isn't even an expected-value gamble — it's a one-sided option. That asymmetry
matters more than the headline cost.

---

## 2. What they get for it

### 2.1 The liquidation direction (the real one)

Push the reported price **down** 10%. Every position whose *true* LTV exceeds
`0.85 × 0.90 = 76.5%` now reports as underwater and can be liquidated at a
discount — at an ETH price that does not exist anywhere else on earth.

With a typical 5–10% liquidation bonus, call it 8%:

| Catchable collateral (true LTV 76.5–85%) | Bonus extracted @8% | Cost | Net |
|---|---|---|---|
| $2M (one max position) | $160k | ~$80k | **+$80k** |
| $10M | $800k | ~$80k | **+$720k** |
| $50M | $4.0M | ~$80k | **+$3.9M** |

Break-even is about **$1M of catchable collateral**. Our position cap is $2M.
**A single max-size position at the top of the LTV band makes this profitable
on its own**, and the cost does not scale with how many positions get caught —
one price move liquidates the entire band at once. As the market grows, the
attack's ROI grows linearly while its cost stays flat.

Worse, the victims did nothing wrong. A borrower sitting at a perfectly prudent
78% LTV gets seized. That's not a bad-debt event, it's a "user funds stolen"
event, which is a different kind of incident.

### 2.2 The inflate-and-borrow direction

Push the reported price **up**, deposit WETH, borrow against the inflated mark,
walk away and leave the protocol with bad debt. Break-even needs
`LTV_max × (1+δ) > 1`, i.e. `δ > 1/0.85 − 1 = **17.6%**`. An 18% move costs
~$49k–$148k (table above, right-hand rows).

At δ = 25%, a $2M position (measured at the inflated price, so ~$1.6M of real
WETH) borrows ~$1.7M → ~$100k profit against ~$180k of fees. **Marginal.** The
$2M cap is doing real work here.

But note the cap is only load-bearing if it's **global and Sybil-resistant**. If
it's per-position or per-address, the attacker opens forty of them from forty
addresses inside the same transaction and amortises the one price move across
all of them, at which point this direction is also comfortably profitable. Worth
confirming which one we built.

Either way, direction 2.1 is already sufficient, needs a smaller move, and is
strictly cheaper.

---

## 3. The "Chainlink is a third party" objection

Taken seriously, because it's not a stupid point — it's just mis-scoped.

- **"Its answer can be stale between updates."** Mainnet ETH/USD is a 0.5%
  deviation threshold with a 1-hour heartbeat. So the bounded error is **0.5%**,
  and it's only unbounded if the feed genuinely halts — which we detect and
  handle (§4). Compare to `slot0`, whose bounded error is **whatever an attacker
  pays for**, ~$80k per 10%. We are choosing between a 0.5% known staleness band
  and an attacker-chosen arbitrary number. That's not close.
- **"It puts a third party between us and our liquidations."** True, and it is a
  real trust assumption: an upgradable aggregator, a permissioned node set, a real
  concentration risk. But the alternative is not "no trust."
  The alternative is trusting *whoever has $80k and an RPC endpoint*, with no
  reputation, no identity, and no incentive to behave. Substituting an
  accountable third party for an anonymous adversarial one is a trade we should
  take.
- **"An extra external call."** ~5–10k gas on a read. Against a six-figure
  single-transaction loss. Not a consideration.
- **"Our own on-chain reserve of truth."** The pool is a *trading venue*, not a
  truth oracle. Its state variable is designed to be mutated by anyone who pays
  the fee. That's a feature of an AMM and a fatal flaw in a price feed.

This class of bug has a long empirical record — Mango Markets ($116M), Inverse
Finance ($15.6M), Cream, Warp, Rari. All of them read a spot AMM price.

---

## 4. Recommendation

### 4.1 Price collateral with Chainlink, as a composite, never with spot

```
WETH/USDC = (ETH/USD feed) / (USDC/USD feed)
```

**Do not hardcode USDC = $1.** USDC traded at $0.88 in March 2023. Our debt is
denominated in it; if it depegs and we assume par, every position is
mismarked in the borrower's favour and we take the loss. Price both legs and
divide.

**Never call `slot0()` for anything that feeds a valuation.** If we ever need a
pool price for a non-critical path, use `observe()` (TWAP), never `slot0`.

### 4.2 Mandatory checks before the price enters a health calculation

Every one of these has a real incident behind it.

```solidity
function _price(AggregatorV3Interface feed, uint256 maxAge, uint8 dec)
    internal view returns (uint256)
{
    (uint80 roundId, int256 answer,, uint256 updatedAt, uint80 answeredInRound)
        = feed.latestRoundData();

    if (answer <= 0)                       revert BadPrice();        // never cast a negative int256
    if (updatedAt == 0)                    revert IncompleteRound();
    if (roundId == 0)                      revert BadRound();
    if (answeredInRound < roundId)         revert StaleRound();      // where the feed still exposes it
    if (block.timestamp - updatedAt > maxAge) revert StalePrice();   // heartbeat + buffer, per-feed
    if (answer <= minAnswer || answer >= maxAnswer) revert Circuit(); // see below

    return _scaleTo18(uint256(answer), dec);
}
```

1. **`answer > 0`** before the `int256 → uint256` cast. A negative answer casts
   to an astronomically large uint and marks every position healthy forever.
2. **Freshness against a per-feed `maxAge`**, configured as *that feed's*
   heartbeat plus a small buffer — not one global constant. ETH/USD (1h) and
   USDC/USD (24h) have different heartbeats; a single constant is either too
   loose for one or permanently reverting on the other.
3. **Composite staleness = the worse of the two.** A fresh ETH/USD divided by a
   six-hour-old USDC/USD is a six-hour-old price. Take `min(updatedAt_eth,
   updatedAt_usdc)` and age-check that.
4. **`minAnswer`/`maxAnswer` circuit breakers.** This is precisely how Venus lost
   money on LUNA: the aggregator floored at `minAnswer = $0.10` while LUNA was
   at $0.000001, so the protocol kept pricing it at ten cents. Read the bounds
   off the underlying aggregator and revert on contact rather than trusting a
   clamped number. (Newer feeds are dropping these; the check should tolerate
   their absence rather than assume it.)
5. **Read `decimals()` — don't assume 8.** Cache it at construction; it's
   immutable per feed. Normalise everything to 18 before arithmetic.
6. **Fail closed, never fall back to spot.** On staleness or a tripped breaker,
   revert. A fallback path to `slot0` reintroduces the entire attack and hands
   the attacker the trigger: they stall or grief the primary and drop into the
   manipulable path deliberately. If we want graceful degradation, degrade to
   *pausing new borrows and liquidations*, not to a worse oracle.
7. **Round direction consistently against the protocol.** Round collateral value
   down and debt value up in the health check, so rounding error can never open
   a position that shouldn't exist.

### 4.3 Defence in depth: TWAP as a guardrail, not as an oracle

Add a Uniswap V3 **30-minute TWAP** via `observe()` and compare:

```
if (|chainlink − twap| / twap > DIVERGENCE_BPS)  →  pause borrows (and optionally liquidations)
```

Set `DIVERGENCE_BPS` around 200–300 to avoid tripping on normal volatility. The
framing matters: this is a **disagreement detector**, not a second price source.
We never *use* the TWAP number; we only use the fact that it disagrees. If the
two diverge, something is wrong — either the feed is stuck or the pool is being
worked — and pausing is the correct response to "we don't know the price."

Don't be tempted to promote the TWAP to primary. Post-Merge, a proposer who
knows they have consecutive slots can sustain a manipulated price across blocks,
so multi-block MEV makes TWAP manipulation materially cheaper than the original
Uniswap whitepaper analysis assumed. It's a decent sanity bound and a bad oracle.

### 4.4 Parameters worth revisiting while we're here

- **85% LTV against a 0.5%-deviation, 1-hour-heartbeat feed.** The 15% buffer
  has to absorb the feed's deviation band *plus* whatever ETH does between
  updates *plus* liquidation execution slippage. ETH has moved >15% inside an
  hour. Either tighten to ~80–82.5%, or source a lower-latency feed for this
  market.
- **Liquidation bonus must exceed expected oracle-to-execution divergence**, or
  liquidators won't show up exactly when we need them and we eat bad debt.
- **Confirm the $2M cap is global**, not per-address (§2.2).
- **Add a close factor** so a single liquidation can't take an entire position
  on one oracle tick.

### 4.5 Test that proves it

Fork mainnet. In one transaction: flash-borrow, swap the 0.05% pool down 10%,
assert `slot0` moved, assert **our health calculation is unchanged**, swap back.
Assert the total cost of the round trip, and put the number in the test name.
That test is the artefact that settles this discussion permanently, and it will
fail today.

---

## Summary

The proposal's safety argument rests on arbitrage closing the manipulation. Inside
an atomic transaction there is no arbitrage, no time, and no loss — only two
swap fees. That turns "tens of millions at risk" into **~$25k–$130k of fees, zero
capital, free on failure**, against a **$160k payday from one max-size position**
and linear upside as the book grows.

Price with **Chainlink ETH/USD ÷ USDC/USD**, validated for sign, round
completeness, per-feed freshness, composite freshness, circuit-breaker bounds and
decimals; **fail closed to a pause, never to spot**; and keep a **30-minute TWAP
purely as a divergence tripwire**.
