# Oracle design review: `slot0` as the collateral price for a WETH/USDC lending market

**Verdict: do not ship this.** The proposal's cost estimate is off by roughly three orders of
magnitude, because it prices the wrong thing. The numbers below are the argument.

---

## 1. Where the reasoning goes wrong

Two claims are doing all the work, and both fail.

> "To move its price 10% an attacker would have to push tens of millions of dollars through it"

True and irrelevant. Notional pushed through the pool is not cost. A swap is not a payment — the
attacker gets the other asset back. The only thing they actually *lose* on a round trip is fees
and gas.

> "arbitrage bots would drag it back within the same block, so they would eat the loss for nothing"

This is the load-bearing error. Arbitrage operates *between* transactions. The attack is a single
transaction:

```
tx (one atomic call, optionally funded by a 0-fee flash loan):
  1. swap USDC -> WETH ... push pool price down 10%
  2. call OurLendingMarket.liquidate(victim)   <-- our contract reads slot0 HERE
  3. swap WETH -> USDC ... push price back
  4. repay flash loan, keep the profit
```

No searcher can insert a transaction into the middle of another contract's call stack. The price is
wrong only for the duration of step 2, and the attacker restores it themselves in step 3. There is
no window for anyone to arbitrage, and therefore no "loss they eat for nothing." If step 2 turns out
unprofitable, the whole transaction reverts and the attacker has spent gas. **The attack is atomic,
capital-free, and risk-free.**

---

## 2. What it actually costs

A V3 round trip traverses the same bonding curve out and back, so the price impact is fully
recovered. Cost ≈ fee on both legs:

```
cost ≈ 2 · f · N        f = 0.0005 (the 0.05% tier)   N = notional needed to move price by δ
```

Note what this means: **the 0.05% fee tier is the cheapest pool on mainnet to manipulate per dollar
of depth.** The low fee that makes it the best execution venue also makes it the worst oracle.

Sizing `N`. Treating the $200M as full-range (v2-equivalent) gives a lower bound; real V3 liquidity
is concentrated near the tick, so crossing a wide band costs more than this near the price and less
than linear extrapolation far from it. Bracketing both ways:

| price move δ | full-range N (TVL $200M) | round-trip fee | concentrated-liquidity estimate (N ≈ $10–25M) |
|---|---|---|---|
| 2%  | $1.0M | ~$1,000 | $3k – $8k |
| 5%  | $2.6M | ~$2,600 | $5k – $15k |
| **10%** | **$5.4M** | **~$5,400** | **$10k – $25k** |
| 18% | $10.4M | ~$10,400 | $20k – $50k |

Add gas (a few hundred dollars) and a flash-loan fee of **$0** — Balancer and Morpho flash loans are
free; Aave's 0.05% is optional and avoidable.

> **Cost to make our contract read a 10%-wrong price: roughly $10,000–$25,000.**

Even if my liquidity estimate is wrong by 3× in the safe direction, it's ~$75k. Hold that number
against the payoff.

---

## 3. What they get for it

### Attack A — mass liquidation (the real one)

Push the price *down*, liquidate, push it back. Against a single $2M position at 85% LTV, 50% close
factor, 8% liquidation bonus, oracle reading 10% low:

```
debt                       $1,700,000
repaid by attacker (50%)     $850,000
seized WETH, at TRUE market value:
  850,000 × 1.08 / 0.90  =  $1,020,000
profit                       $170,000
```

Of that, $68k is the ordinary liquidation bonus and **$102k is pure theft from the borrower**,
manufactured by the oracle error. Against ~$15k of cost, that is **~11× on one position.**

Three things make this much worse than the single-position figure:

1. **It hits the whole book at once.** A 10% depression makes *every* position above 76.5% real LTV
   liquidatable in the same transaction. The $15k is paid once regardless of how many positions the
   attacker drains. Cost is fixed; revenue scales with our TVL.
2. **The attacker doesn't need 10%.** They need the gap to the nearest liquidatable position, and
   cost falls steeply with δ:

   | position's real LTV | drop needed to flip it |
   |---|---|
   | 80% | 5.9% |
   | 83% | 2.4% |
   | 84% | 1.2% |

   In any healthy book there is always something sitting near the threshold. The **marginal** attack
   costs low single-digit thousands, and it is profitable at *any* δ > 0 that flips a position. This
   is not a tail risk that needs a whale — it is a steady-state MEV strategy that a searcher will run
   as a matter of course.
3. **Honest borrowers cannot defend.** They can be liquidated at any moment regardless of how
   conservatively they are positioned, because the trigger is purchasable.

### Attack B — inflate and borrow

Push the price *up*, deposit, borrow against the inflated mark, walk away. This needs the inflation
to exceed `1/0.85 − 1 = 17.65%` before the borrow exceeds the collateral. At +20% on a $2M deposit
it nets ~$40k against ~$20–50k of cost — marginal, and it is the attack the "deep pool" intuition is
actually defending against. Attack A is the one that matters, and the intuition offers it nothing.

### The asymmetry to internalize

> Manipulation cost scales with **pool depth**. Attacker revenue scales with **our book**.
> Those are independent. There is no pool deep enough to make this safe — growth makes it worse.

---

## 4. Answering the two objections to Chainlink on their merits

**"Its answer can be stale between updates."** Correct, and that is the *advantage*. Staleness is
**detectable**: `updatedAt` is right there in the return value and we can refuse to act on it. A
manipulated `slot0` read is indistinguishable from a real one — there is no field to check. A failure
mode you can test for beats one you cannot observe.

**"It puts a third party between us and our own liquidations."** It replaces a *known, accountable*
third party with an *anonymous flash-loan borrower* who has a direct financial interest in our
liquidations. Chainlink ETH/USD is the price source for Aave, Compound and Spark, securing tens of
billions. That said, the concern is legitimate and I address it in §5.3 — the answer is a bounded
secondary check, not spot.

---

## 5. What to price collateral with

### 5.1 Primary: Chainlink push feeds

Two feeds, not one. Our debt is USDC, and treating USDC as exactly $1.00 is an unpriced depeg bet on
a $2M-per-position book.

| feed | mainnet address | heartbeat | deviation |
|---|---|---|---|
| ETH / USD  | `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419` | 3600s | 0.5% |
| USDC / USD | `0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6` | 86400s | 0.25% |

*(Re-verify both addresses and both parameter sets against docs.chain.link at implementation time —
do not take them from this document.)*

### 5.2 The checks that must wrap every read

This is the part that gets skipped, so it is spelled out. Any one of these missing reintroduces a
real exploit path.

```solidity
function _price(AggregatorV3Interface feed, uint256 maxAge) internal view returns (uint256) {
    (uint80 roundId, int256 answer,, uint256 updatedAt,) = feed.latestRoundData();

    if (answer <= 0)                             revert BadPrice();
    if (updatedAt == 0 || roundId == 0)          revert IncompleteRound();
    if (block.timestamp - updatedAt > maxAge)    revert StalePrice();   // per-feed, see below
    if (answer < minBound || answer > maxBound)  revert PriceOutOfBounds();

    return uint256(answer);   // 8 decimals — assert feed.decimals() == 8 at deploy
}
```

- **`latestRoundData()`, never `latestAnswer()`.** The legacy getter returns no timestamp, so
  staleness cannot be checked at all. It is deprecated; treat any use of it as a bug.
- **`answer <= 0` → revert.** The return type is signed. A zero or negative answer must never reach
  division.
- **`updatedAt` against a *per-feed* max age.** Derived from that feed's published heartbeat plus a
  justified margin — e.g. ~4800s for ETH/USD (3600 + 20 min), ~90000s for USDC/USD (86400 + margin).
  **Do not use one global constant**: a single 3600s timeout would revert constantly on the 24-hour
  USDC feed and brick the market; a single 86400s timeout would accept a 23-hour-old ETH price.
- **Sanity bounds.** Historic aggregators carried `minAnswer`/`maxAnswer` circuit breakers that
  returned the *bound* rather than the true price during a crash — this is exactly what cost Venus
  ~$11M on LUNA. Most modern feeds have removed them; check the underlying aggregator for ours and,
  if present, revert when the answer is pinned at a bound. Keep our own wide bounds regardless as a
  backstop against a compromised aggregator.
- **Decimals explicitly.** WETH 18, USDC 6, feed 8. Assert `feed.decimals()` at deployment rather
  than hardcoding silently; normalize everything to one documented scale (1e18), and multiply before
  dividing using `mulDiv` so the intermediate doesn't lose precision.
- **Skip `answeredInRound < roundId`.** It is a pre-OCR artifact that is meaningless on current
  feeds; `updatedAt` is the check that does the work. Including it is harmless but don't mistake it
  for staleness protection.
- **One snapshot per transaction.** Read both prices once at entry and pass the pair through the
  health calculation. Never re-read between valuing collateral and valuing debt.
- **Sequencer uptime feed:** not needed on mainnet. Required before any L2 deployment — without it,
  a sequencer restart delivers a queue of stale-priced liquidations.

### 5.3 Secondary: a TWAP as a *bound*, not as a price

This addresses the single-provider concern honestly. Take a **30-minute TWAP via `observe()`** on the
same pool — `observe()`, not `slot0`; they are completely different security properties — and use it
only to decide whether to *trust* Chainlink:

- If `|chainlink − twap| / twap > ~2%`: **halt new borrows and withdrawals.**
- **Keep liquidations running**, using the more conservative of the two prices. Pausing liquidations
  during a divergence is how a protocol converts an oracle wobble into permanent bad debt — the
  failure must be fail-*closed* on risk-taking and fail-*open* on risk-reduction.
- Call `increaseObservationCardinalityNext` on the pool at deployment, or `observe()` reverts for
  lack of history.

Note this is a *circuit breaker*, not a fallback price. Never silently fall back to the TWAP when
Chainlink is stale — a 30-min TWAP still lags a fast crash and is attackable via multi-block MEV now
that proposers are known in advance. If we want a genuine second price source, add Chronicle or
RedStone and take a median of three.

### 5.4 One parameter flag while we're here

At 85% LTV with an 8% bonus, a liquidator seizes `0.85 × 1.08 = 91.8%` of collateral value — leaving
**8.2% of buffer** to absorb oracle deviation (up to 0.5% by design, plus intra-heartbeat drift) plus
real price movement between the position crossing the threshold and a liquidator landing the
transaction. On $2M WETH positions in a volatile market that is thin. It is defensible, but it should
be a deliberate decision with a documented bad-debt model, not an inherited default.

---

## 6. Summary

| | |
|---|---|
| Cost to move `slot0` 10% at the instant we read it | **~$10k–$25k**, atomic, zero capital, zero risk |
| Cost to flip a position already at 83% LTV | **low single-digit thousands** |
| Profit, one $2M position, 10% error | **~$170k** (~11× return) |
| Profit, whole book | scales with our TVL at the same fixed cost |
| Arbitrage protection | **none** — the attacker restores the price themselves, in the same call |

Price collateral with **Chainlink ETH/USD and USDC/USD**, wrapped in the validation in §5.2, bounded
by a **30-minute `observe()` TWAP used as a circuit breaker** that halts borrowing but never halts
liquidation. `slot0` must not appear anywhere in the health-check path.
