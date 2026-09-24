# Collateral pricing for the WETH/USDC lending market

**Verdict up front:** the proposal is not safe. Reading `slot0` from a Uniswap V3
pool for a health calculation costs an attacker roughly **$5k–$15k** to defeat and
pays out **~$170k per $2M position**, repeatable across every position in the book
inside a single transaction. Price collateral with Chainlink push feeds
(ETH/USD ÷ USDC/USD), validated per-read, with a TWAP used only as a
circuit breaker — never as a price.

---

## 1. Where the teammate's model goes wrong

The writeup prices the attack as if the attacker *keeps* the position they open.
They don't. The manipulation, the read, and the unwind all happen in **one
transaction**:

```
flash-borrow USDC  →  swap USDC→WETH (price up)  →  call our borrow()/liquidate()
                   →  swap WETH→USDC (price back)  →  repay flash loan
```

Three consequences:

- **The attacker never eats the slippage.** They walk up the same liquidity curve
  and back down it. The pool returns them to almost exactly the starting price and
  almost exactly the starting balance. Their cost is the **swap fee, twice** —
  not the notional, not the slippage.
- **"Arbitrage bots drag it back within the same block" is the wrong frame.**
  Arbitrage happens *between transactions*. There is no point inside an atomic
  transaction where a bot can insert itself. By the time any bot sees the state,
  the price is already back and our contract has already been robbed. The
  attacker is also free to buy the slot (or be the builder) to guarantee placement.
- **"$200M of liquidity" is TVL across all ticks, including out-of-range.**
  Out-of-range liquidity contributes exactly zero resistance to a price move.
  And because V3 liquidity is concentrated in a dense band near spot, once you
  clear that band the remaining ticks are *thinner* — each additional percent of
  movement gets **cheaper**, not more expensive.

`slot0` is specifically the worst value in the pool to read: it is the
instantaneous post-swap tick, with no time-averaging of any kind. It is the one
number a single swap in the same transaction fully controls.

## 2. Cost to move the read 10%

Model the pool as constant-product with the full $200M in range ($100M per side).
This is a **generous upper bound** for the defender, since concentrated liquidity
makes the tail cheaper to run through:

| | value |
|---|---|
| Notional to move price +10% (`x·(√1.1 − 1)`) | **$4.9M** |
| Notional to move price −10% | **$5.1M** |
| Round-trip pool fee (2 × 5 bps on notional) | **~$4,900** |
| Flash loan fee | **$0** (Balancer / Morpho / Uniswap `flash()`) or $2,400 (Aave v3, 5 bps) |
| Gas, ~400–600k at 20 gwei | **~$50** |
| **Total cost** | **~$5,000 – $7,500** |

Realistically the concentrated book gets there on $2–4M of notional, so the true
figure is likely **$2k–$5k**. Add priority fee if they have to outbid for
placement; call the honest range **$5k–$15k all-in**.

**Note what this does not require: any capital.** The $5M is flash-borrowed and
repaid in the same transaction. The attacker needs the gas and the fee, nothing else.

## 3. What they get for it

### Direction A — push the price down, liquidate healthy positions

This is the sharp one, because it has **no minimum move threshold**.

A borrower sitting at 77% LTV is healthy. Depress the price 10% and their LTV
reads 85.6% — liquidatable. Take a $2M position with $1.54M debt, 50% close
factor, 8% liquidation bonus:

- Repay $770k of USDC debt.
- Receive $770k × 1.08 = **$832k of WETH, valued at the depressed price**.
- That WETH is actually worth $832k / 0.9 = **$924k** once the price snaps back.
- **Profit ≈ $154k on one position.**

And the attacker does not have to pick one. Every position in the book whose LTV
is within ~10% of the threshold gets swept in the same transaction, sharing the
same one-time $5k manipulation cost. The payoff scales with the size of the book;
the cost does not.

### Direction B — push the price up, over-borrow

Worth doing the arithmetic, because it shows an attacker constraint the down-side
attack doesn't have. Deposit collateral worth `C`, inflate by factor `f`, borrow
`0.85·f·C` and abandon the collateral. That is only profitable when

```
0.85 · f > 1   →   f > 1.176
```

So a **10% inflation is not enough** — at max LTV the attacker would lose money.
But the cost of a bigger move barely moves:

| inflation | notional needed | round-trip fee | profit on $2M deposited |
|---|---|---|---|
| +17.7% (break-even) | $8.5M | $8,500 | $0 |
| +30% | $14.0M | $14,000 | **$210k** |

$14k to steal $210k, again per position and again repeatable within the
transaction until protocol USDC liquidity runs out. The $2M position cap does not
cap the attack — it caps one *address*.

### Ratio

| | |
|---|---|
| Attacker cost | ~$5k–$15k, one-time per transaction |
| Attacker revenue | ~$150k–$210k **per position**, × every position touched |
| Capital required | $0 (flash loan) |
| Window for defenders to react | none (atomic) |

The economics are not close. This is a 10×–100× return on the first position and
strictly better on every additional one.

---

## 4. What we should price collateral with

**Chainlink push feeds on mainnet, two of them:**

- `ETH/USD` — 0.5% deviation threshold, 1 hour heartbeat
- `USDC/USD` — 0.25% deviation threshold, 24 hour heartbeat

Collateral value in debt terms = `(ETH/USD) / (USDC/USD)`.

Do **not** hardcode USDC = $1. A USDC depeg (March 2023 touched $0.87) with a
hardcoded peg mis-prices every loan in the system simultaneously, in the
direction that makes debt look smaller than it is.

On the teammate's "third party between us and our liquidations" objection: the
alternative is not *no trust*. It is trusting whoever has the most capital in
the block. A push feed's trust assumption is a known, priced set of node
operators with a published deviation and heartbeat. A `slot0` read's trust
assumption is an anonymous flash borrower. The second is strictly worse.

## 5. Checks required around every price read

None of these are optional — a Chainlink integration without them is roughly as
exploitable as the spot read.

**Use `latestRoundData()`.** Never `latestAnswer()` / `latestTimestamp()` — they
are deprecated and carry no staleness information.

1. **Positive answer.** `require(answer > 0)`. Revert; do not clamp to a floor,
   do not substitute a last-known value.
2. **Per-feed staleness bound.** `require(updatedAt != 0 && block.timestamp - updatedAt <= maxAge)`,
   where `maxAge` is derived from *that feed's* published heartbeat plus a
   justified margin — ETH/USD ≈ 4800s (1h + 20min), USDC/USD ≈ 90000s (24h + 1h).
   One global `MAX_AGE` constant is a bug: it is either too tight for USDC (spurious
   reverts, borrowers can't repay, liquidations stall) or far too loose for ETH.
3. **Min/max answer bounds.** Aggregators have `minAnswer`/`maxAnswer` circuit
   breakers; if the real price crosses one, the feed keeps reporting the bound as
   a normal-looking fresh answer. This is exactly how Venus lost money on LUNA.
   Enforce our own sanity band and revert outside it.
4. **Decimals read, not assumed.** Read `decimals()` from each feed at deploy and
   store it `immutable`. Normalize WETH (18), USDC (6) and both feeds to one
   documented internal scale (1e18 USD), with `mulDiv` and multiply-before-divide.
   Do not assume 8.
5. **Fail closed, on every path.** If a feed fails any check, revert — for borrows,
   for withdrawals, **and for liquidations**. A "fall back to the Uniswap spot price
   if Chainlink is unavailable" branch reintroduces the entire attack above and
   hands the attacker a trigger for it. Handle extended outage with an explicit
   guardian pause, not a fallback price.
6. **One price per transaction.** Read each feed once and pass the value through
   the whole health calculation, so no path can see two different prices.
7. **`answeredInRound >= roundId` is obsolete** on OCR aggregators — it is a no-op
   today. Staleness is covered by check 2; don't rely on it instead.

**Not applicable today but pin it now:** if we deploy to Arbitrum/Optimism/Base,
add the L2 sequencer uptime feed with a grace period. Without it, the first
transactions after a sequencer restart execute against stale prices with a
backlog of liquidations behind them.

## 6. Where the Uniswap pool still belongs

As a **circuit breaker, never as a price**. Maintain a 30-minute
`observe()`-based TWAP (this requires paying to increase the pool's observation
cardinality — do it at deploy) and compare:

```
if |chainlink − twap| / chainlink > 2%:  pause new borrows and liquidations
```

Two rules about this:

- **Never pick the more favourable of the two.** That gives the attacker a menu.
  Divergence means *stop*, not *choose*.
- **A 30-min TWAP is not a substitute for the push feed.** Its manipulation cost
  scales with duration × depth, which is real but finite — and with known proposer
  schedules, multi-block manipulation is a live technique. It is not adequate
  security for $2M positions on its own.

## 7. Adjacent things this changes

- **Oracle deviation has to fit inside the LTV buffer.** ETH/USD only updates on a
  0.5% move or the 1h heartbeat, so the reported price can lag the market. At 85%
  LTV the headroom to 100% is 15%; with an 8% liquidation bonus that leaves ~7% for
  lag plus the gap-down during a fast move. That's tight for a $2M position —
  I'd argue for 80% LTV, or a lower bonus, or both. Worth modelling separately.
- **Bound the liquidation incentive explicitly** (5–8%) and enforce a close factor,
  so that even a partially-wrong price has a capped payout.
- **Borrow caps and a per-block borrow limit** cut the blast radius of any pricing
  failure, oracle or otherwise.
