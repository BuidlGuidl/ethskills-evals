# Collateral pricing for the WETH/USDC lending market

**Verdict: do not read `slot0`.** Not as the price, not as a fallback, not with a
size cap. The write-up has one arithmetic error and one timing error, and the
timing error is the fatal one. Below is the cost of the attack, the payoff, and
what we should build instead.

---

## 1. The two errors in the proposal

### Error 1 (timing, fatal): arbitrage bots cannot act inside a transaction

> "arbitrage bots would drag it back within the same block, so they would eat the
> loss for nothing"

Arbitrage operates *between* transactions. The attack operates *within* one.
The entire sequence is a single call:

```
attacker's one transaction:
  1. flash-borrow 40M USDC          (Aave / Balancer / Morpho / DAI flash-mint)
  2. swap USDC -> WETH in the 0.05% pool     <- slot0 tick now sits 10% off market
  3. call OUR contract (borrow / liquidate)  <- we read slot0 HERE
  4. swap WETH -> USDC back                  <- pool restored
  5. repay flash loan
  -- transaction ends. Only now can any bot see or touch anything.
```

No bot, searcher, or other user can interleave at step 3. State between steps 2
and 4 is visible only to the attacker's own call stack. The whole premise that
the attacker "eats the loss" assumes they *hold* the manipulated price long
enough for someone to trade against it. They hold it for zero blocks.

This also means the attacker never eats the slippage. Steps 2 and 4 traverse the
same bonding curve in opposite directions with nobody trading in between, so the
pool returns them to (almost) their starting balances. **The 4.65% slippage is
not a cost. It is refunded on the way out.** What they actually pay is the fee on
each leg, plus a flash-loan fee, plus gas.

### Error 2 (arithmetic): $200M TVL is not $200M of price resistance

`slot0` is the *marginal* price at the current tick. Moving it consumes only the
liquidity `L` in the ticks you cross. Uniswap V3 TVL is dominated by positions
parked out of range or in wide ranges — they contribute nothing to resisting a
move at the current tick. The relevant number is in-range depth, not TVL.

---

## 2. What it actually costs

Constant-liquidity V3 approximation. Swapping USDC in to move price `P0 -> k*P0`:

```
usdc_in  = L * (sqrt(k*P0) - sqrt(P0))
weth_out = L * (1/sqrt(P0) - 1/sqrt(k*P0))
```

One-way slippage, as a share of notional pushed through (`P0` = $4,000):

| target move | notional / L | one-way slippage |
|---|---|---|
| +2%  | 0.629 | 0.99% |
| +10% | 3.087 | 4.65% |
| +25% | 7.465 | 10.56% |

Calibrating `L` from the pool's observable ±2% depth (constant-`L` is *generous*
to the defender here — real V3 liquidity thins past the concentrated band, so
true cost is at or below these figures):

| ±2% depth | notional to move 10% | **atomic cost @ 2 legs x 5bps** | notional to move 25% | **atomic cost** |
|---|---|---|---|---|
| $5M  | $24.5M | **$24.5k** | $59M  | **$59k**  |
| $8M  | $39.2M | **$39.2k** | $95M  | **$95k**  |
| $15M | $73.6M | **$73.6k** | $178M | **$178k** |

Add flash-loan fee — **$0 on Balancer, $0 on a Maker DAI flash-mint**, 5bps on
Aave — and a few thousand in gas.

> ### Cost to make our contract read a price 10% off market: **~$25k–$80k.**
> ### Required attacker capital: **$0.** It is all flash-borrowed.

The teammate's "tens of millions of dollars" is the *notional*, and it is correct
— but notional is borrowed and returned within the transaction. It is not a cost,
it is not at risk, and it is not a barrier. Treating it as one is the same
mistake that produced the Mango Markets, Inverse Finance, Rari/Fuse and bZx
losses. Inverse Finance is the closest analogue: a V2/V3 spot read on a deep
pool, ~$1.2M attacker cost for $15.6M taken.

Two further cost reductions available to a motivated attacker, not modelled
above: seed a concentrated LP position first and capture own-fees back, or route
around the 0.05% pool's thin edge into the 0.30% pool. Treat the table as a
ceiling.

---

## 3. What they get for it

### Attack A — crash the mark, liquidate the whole book

Push ETH *down* 10%. Anything with true LTV >= 0.85 x 0.90 = **76.5%** now reads
as underwater. Attacker liquidates: repays USDC debt, seizes WETH marked at the
depressed oracle price, *plus* the liquidation bonus. Assuming a 5% bonus and 50%
close factor:

| eligible collateral in that band | debt repaid | collateral seized (true value) | **profit** |
|---|---|---|---|
| $2M  | $0.85M  | $0.99M  | **$142k** |
| $20M | $8.50M  | $9.92M  | **$1.42M** |
| $50M | $21.25M | $24.79M | **$3.54M** |

**This is the one that breaks the design.** The $2M-per-position cap does nothing,
because manipulation cost is *paid once per transaction* while payoff scales with
the *whole book*. One $40k price push evaluates every position against the same
fake price and harvests all of them in one call. Our per-position cap limits the
victim, not the attack.

It also victimizes honest, properly-collateralized users. A borrower sitting at a
conservative 78% LTV gets liquidated by a price that never existed on any real
market. That is a reputational event, not just a loss.

### Attack B — pump the mark, over-borrow, walk away

Break-even inflation is `1 / 0.85 = +17.6%`. Above that, borrowing power exceeds
true collateral value and the debt is rational to abandon:

| inflation | deposit $2M real WETH | borrow | % of true value | bad debt / position |
|---|---|---|---|---|
| +10% | $2M | $1.870M | 93.5% | $0 |
| +18% | $2M | $2.006M | 100.3% | $6k |
| +25% | $2M | $2.125M | 106.2% | **$125k** |

At +25% the manipulation costs ~$60–180k and is *still* paid once, while the
attacker opens as many $2M positions from as many addresses as our USDC
liquidity allows, inside the same transaction. Our cap is a per-address cap, not
a per-attacker cap. Ten positions = $1.25M of bad debt for one ~$100k push.

> **Bottom line: ~$25k–$180k in, seven figures out, no capital at risk, one
> transaction, one attacker, no cooperation required.** The attack is
> overwhelmingly profitable and the margin grows as the book grows.

---

## 4. The three objections to Chainlink

**"An extra external call."** ~25k gas, roughly $1–2. We are weighing it against
a seven-figure expected loss. This is not a real consideration.

**"Its answer can be stale between updates."** This is the objection that is
exactly backwards. Chainlink ETH/USD on mainnet publishes a **0.5% deviation
threshold and a 3600s heartbeat**, so its staleness is *bounded and, crucially,
measurable on-chain* — `updatedAt` tells us precisely how stale, and we can
refuse to act. `slot0` has no such field because it needs none: it is always
perfectly fresh, and that is the problem. `slot0` is fresh in the worst possible
sense — it is, by definition, the marginal price set by the immediately preceding
swap, which in an attack is *the attacker's own swap from three instructions
ago*. We would not be reading the market. We would be reading the attacker's
input buffer. A known, bounded, detectable lag beats an unbounded,
undetectable, attacker-controlled error.

**"It puts a third party between us and our own liquidations."** There is a third
party either way. With Chainlink it is a known, accountable, multi-node
aggregate of many off-chain venues with published SLAs. With `slot0` it is an
anonymous flash-loan borrower who chooses our price for us and is not accountable
to anyone. "Our own on-chain source of truth" is not ours — it is writable by
anyone with a transaction and a flash loan. There is no such thing as an
unmanipulable on-chain spot price; there is only a price whose manipulation cost
we have or have not calculated.

---

## 5. What to price collateral with

**Primary: the Chainlink ETH/USD push feed** (mainnet
`0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419`, 8 decimals, 0.5% deviation /
3600s heartbeat). Price USDC debt via **ETH/USD and USDC/USD**, or hold USDC at
$1 only if we have consciously accepted depeg risk — do not read a WETH/USDC
pair price off a DEX to bridge the two, which reintroduces the same hole.

On a V3 TWAP: a meaningful TWAP (30+ min) is genuinely harder to move than
`slot0`, because holding a price across blocks *does* expose the attacker to
arbitrage — the mechanism the teammate described, which is real for a TWAP and
absent for spot. But it lags hard in a fast market, which causes its own bad debt
during real volatility, and multi-block proposer control weakens it further. For
$2M positions at 85% LTV, a push feed is the right primary. **A TWAP is worth
having only as a disagreement detector (below), never as the price.**

### Required checks before that price enters a health calculation

Call `latestRoundData()`, never the deprecated `latestAnswer()`. Then:

1. **`answer > 0`** — reject zero and negative. Cast to `uint256` only after this
   check; a negative `int256` cast becomes an enormous `uint256`.
2. **`updatedAt != 0`** — guards the incomplete-round case.
3. **`block.timestamp - updatedAt <= maxAge`**, with `maxAge` a **per-feed
   constant derived from that feed's published heartbeat plus a justified
   margin** — e.g. `3600 + 300 = 3900s` for ETH/USD. Not one global timeout
   shared across feeds; USDC/USD and ETH/USD have different heartbeats and must
   carry different constants. Do **not** cargo-cult `answeredInRound >= roundId`
   — it is meaningless on modern OCR2 feeds.
4. **Aggregator bounds.** If the underlying aggregator still exposes
   `minAnswer`/`maxAnswer`, revert when the answer sits at either bound rather
   than accepting a clamped price. This is the Venus/LUNA failure: the feed
   floored, the protocol kept quoting the floor. Verify per feed at integration
   time.
5. **Decimals, explicitly.** Feed 8, WETH 18, USDC 6. Normalize to one documented
   internal scale (1e18) in one shared library function. Never inline the
   conversion at each call site.
6. **Full-precision arithmetic.** `mulDiv`, multiply before divide. Round
   **collateral value down and debt value up**, always against the user, so
   rounding can never manufacture a solvent-looking position.
7. **Sequencer uptime.** Not applicable on mainnet. If we ever deploy to
   Arbitrum/Optimism/Base this becomes mandatory — check the L2 sequencer uptime
   feed plus a grace period, or a downtime-recovery flood liquidates everyone.
8. **Fail-closed, asymmetrically.** On a stale or invalid price, revert
   everything that *increases* risk: new borrows, collateral withdrawals, **and
   liquidations**. Liquidating on a bad price is as damaging as lending on one —
   do not leave liquidations open "so the protocol stays safe." Repayments and
   collateral deposits can stay open; they only reduce risk.
9. **Disagreement circuit breaker.** Compare the Chainlink answer against a
   secondary source — a 30-minute Uniswap V3 TWAP is fine *for this purpose
   only*. If they diverge beyond a threshold (say 2%), **pause and alert; do not
   pick a winner.** The DEX here is a smoke alarm, never a price. This is the one
   legitimate use of the pool the teammate wanted, and it is worth building.
10. **Bound the incentives.** Cap the liquidation bonus and close factor as
    consts, and enforce a minimum output on any swap in the liquidation path.
    These cap the damage if a price ever does slip through.

### Testing that must exist before this ships

- Pinned-fork test that flash-borrows, swaps the 0.05% pool ~10%, calls our
  health function mid-transaction, and asserts the read price is **unchanged**.
  This is the regression test for the entire discussion above — write it first,
  and it will fail loudly the day anyone reintroduces a spot read.
- Stale-price, zero-price, negative-price, and at-bound cases for every feed.
- Fuzz the health calculation across decimals and extreme prices for rounding
  direction.

---

## 6. Summary

| | `slot0` spot | Chainlink push feed |
|---|---|---|
| Cost to move 10% at read time | **~$25k–$80k, flash-borrowed, $0 capital** | not movable by a trader |
| Time the false price must hold | **one instruction, atomically** | — |
| Can arbitrage correct it first? | **No — same transaction** | — |
| Attacker payoff on our book | **$1.4M–$3.5M+, scales with TVL** | — |
| Staleness | 0s, and attacker-authored | bounded 3600s, **on-chain measurable** |
| Failure mode | silent, undetectable, total | detectable, we revert |

The proposal's own framing gets us to the answer: to move a TWAP you pay for
every block you hold it, and arbitrage bills you. To move `slot0` you pay for
zero blocks, and arbitrage never gets a turn. The pool depth argument is an
argument *for* a TWAP and has no force at all for spot.

Price collateral with Chainlink ETH/USD, validated per the ten checks above,
failing closed on both borrows and liquidations, with a TWAP wired in solely as a
divergence alarm.
