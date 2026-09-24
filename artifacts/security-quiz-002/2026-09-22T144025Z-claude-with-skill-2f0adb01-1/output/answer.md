# Design review: collateral pricing for the WETH/USDC lending market

**Verdict up front:** the proposal is wrong, and it is wrong for a reason that no
amount of pool TVL fixes. `slot0` is not "our own on-chain reserve of truth" — it
is a number an attacker sets, inside our own transaction, for roughly the cost of
two swap fees. The $200M figure is not the attacker's cost. Their cost is about
**$20k–$75k**, and against $2M positions at an 85% liquidation threshold a single
atomic transaction returns **$130k–$350k per position**, repeatable across every
position in the book in the same transaction.

Below: the numbers, then the recommendation, then what has to be checked around
the price before it touches a health calculation.

---

## 1. The load-bearing error: atomicity

The teammate's argument has two claims. The first is about cost, the second about
arbitrage. The second one is the fatal one, so take it first.

> "arbitrage bots would drag it back within the same block, so they would eat the
> loss for nothing"

This assumes the attacker moves the price, *waits*, and lets us read it. That is
not the attack. The attack is one transaction:

```
flashLoan(40_000_000 USDC)                 // Balancer / Morpho / Uniswap flash-swap: 0% fee
  swap USDC -> WETH on the 0.05% pool      // slot0 now reads +10%
  ourMarket.borrow(...)  /  ourMarket.liquidate(...)   // <-- our contract reads slot0 HERE
  swap WETH -> USDC on the 0.05% pool      // slot0 restored
repay flash loan
```

There is no intervening block, no intervening transaction, and therefore **no
moment at which an arbitrage bot can act**. Arbitrageurs correct prices *between*
transactions. This manipulation exists only *within* one. Nothing is left on the
table for a bot to take, because the attacker's own closing swap takes it. By the
time any bot observes the chain, the price is already back and the money is gone.

The corollary is the cost error: because the attacker reverses their own trade,
they do **not** pay the price impact. Price impact on the way in is recovered on
the way out. What they actually pay is the round-trip fee, plus gas.

## 2. What it actually costs to move slot0 10%

For a Uniswap V3 pool with active liquidity `L` at price `P`, pushing the price up
by a factor `k` requires an input of

```
Δy (USDC in)  = L·√P · (√k − 1)
Δx (WETH out) = (L/√P) · (1 − 1/√k)
```

Write `D ≡ L·√P` (the virtual USDC reserve of the active range). The coefficients:

| price move | `√k − 1` (in) | `1 − 1/√k` (out) |
|---|---|---|
| 1%  | 0.00499 | 0.00496 |
| 2%  | 0.00995 | 0.00985 |
| 5%  | 0.02470 | 0.02410 |
| **10%** | **0.04881** | **0.04654** |
| 20% | 0.09545 | 0.08713 |

`D` is not the pool's TVL. In a concentrated-liquidity pool most TVL sits in ranges
away from spot, and we only care about liquidity in the path the price travels.
Calibrate `D` from the pool's published ±2% depth instead, since `D ≈ 100 × (2% depth)`:

| 2% depth | implied `D` | notional to push +10% | **round-trip fee @ 0.05%/leg** |
|---|---|---|---|
| $4M  | $402M  | $19.6M | **$19.2k** |
| $8M  | $804M  | $39.2M | **$38.3k** |
| $15M | $1,508M | $73.6M | **$71.9k** |

So the teammate's "tens of millions of dollars" is correct as a *notional* and
completely irrelevant as a *cost*. That notional is flash-loaned and repaid in the
same transaction. The real cost is the bottom column: **$20k–$72k**, i.e. 0.01%–0.04%
of the $200M that was supposed to be protecting us.

Three things push this lower, not higher:

- **Flash loan fee = 0.** Balancer, Morpho, and Uniswap flash-swaps charge nothing.
  Aave V3's 0.05% only applies if you pick the worst venue.
- **JIT liquidity rebate.** The attacker can mint a concentrated LP position around
  spot in the same transaction, capture their own swap fees pro-rata, and burn it.
  Capturing 70–80% of active liquidity recovers 70–80% of the fee, taking the cost
  toward **gas plus single-digit thousands**.
- **Timing.** Liquidity is not constant. The attacker picks a block where active
  liquidity is thin (after a large trade, during volatility, when ALM vaults have
  rebalanced out). They only need one such block, ever, and they can wait.

And nothing pushes it higher — there is no race to win, because the attack is
self-contained in one transaction and works at any position in the block.

## 3. What they get for it

Two directions. The second is the one that will actually happen.

### Direction A — inflate, then over-borrow

Deposit real WETH, have it priced high, borrow more USDC than it is worth, walk
away leaving bad debt. Profit per $1 of collateral is `maxLTV × (1+m) − 1`:

| move | maxLTV 80% | maxLTV 85% |
|---|---|---|
| +10% | −$0.120 | −$0.065 |
| +20% | −$0.040 | **+$0.020** |
| +30% | +$0.040 | **+$0.105** |

**Credit where due: a 10% pump does not profitably over-borrow at these
parameters.** The collateral haircut absorbs it; the break-even is `m > 1/LTV − 1`,
which is +17.6% at an 85% borrow LTV. If the teammate's claim had been "10% of
inflation can't over-borrow us," that part would hold.

But the attack cost is *fixed* — it does not scale with how much is stolen — and
the required move is only ~1.8× the 10% case, which costs only ~2× more
(~$37k–$138k). At +30% with an 85% borrow LTV that is +$210k on a single $2M
position, and the attacker can open as many positions as the market has USDC to
lend. The cost is paid once for all of them.

### Direction B — deflate, then liquidate everyone (the real one)

This is cheaper, needs no bad debt, and the profit is bounded only by book size.
Take a *healthy* $2M position at 80% LTV — $1.6M debt, comfortably inside the 85%
threshold, a user who has done nothing wrong:

| price move | LTV our contract computes | |
|---|---|---|
| −5%  | 84.2% | safe |
| **−8%** | **87.0%** | **liquidatable** |
| −10% | 88.9% | liquidatable |
| −15% | 94.1% | liquidatable |

Note it only takes **−8%**, not −10%, to make an untouched 80%-LTV position
liquidatable. And the attacker is the liquidator, so they capture both the
liquidation bonus *and* the 10% gap between the price we pay them on and the real
price of the WETH they seize:

| bonus | close factor | debt repaid | real value of WETH seized | **profit** |
|---|---|---|---|---|
| 5%  | 50%  | $800k  | $933k  | **$133k** |
| 7.5% | 50%  | $800k  | $956k  | **$156k** |
| 7.5% | 100% | $1.6M  | $1.91M | **$311k** |
| 10% | 100% | $1.6M  | $1.96M | **$356k** |

Against a $20k–$72k cost. **Return on attack: 2×–17× on one position**, and the
push is a shared fixed cost — the same transaction liquidates every position in
the book that −8% reaches. On a $50M book that is millions, for one flash loan.

The victims are users who were never unhealthy. That is the part that ends the
protocol: we would have seized solvent users' collateral because of a number we
let an attacker write.

## 4. Answering the three objections to Chainlink on their merits

- **"An extra external call."** One `staticcall`, ~2–5k gas, against a
  low-six-figure exploit. This is not a real cost.
- **"Its answer can be stale between updates."** True, and this is the right
  concern — but it is the *opposite kind* of risk. Staleness is **bounded**
  (heartbeat + deviation threshold), **detectable** (`updatedAt`), and **fails
  closed** — we check it and revert. Manipulation is **unbounded**, **undetectable**
  from inside the read, and **fails open** — it pays out. A failure mode you can
  assert on is not equivalent to one you cannot.
- **"It puts a third party between us and our own liquidations."** It does, and
  that is a genuine trust assumption worth naming — Chainlink's operator set can
  halt or misreport, and we should bound that (see §5.11). But `slot0` does not
  remove a third party; it replaces a known, reputation-bonded, multi-operator
  committee with *whoever sends the next transaction*. The choice is not
  "third party vs. no third party," it is "accountable third party vs. anonymous
  adversary with a flash loan."

**On the TWAP middle ground:** if the pool must be used, a 30-minute
`observe()` TWAP is enormously better than `slot0` — it removes the atomic attack
entirely and forces the attacker to sustain the move across blocks. But it is
still not adequate as the *primary* feed for $2M tickets: post-Merge, proposers
learn in advance when they have consecutive slots, which makes multi-block
manipulation a real (if occasional) capability, and a TWAP lags exactly when we
need accuracy most — a genuine 15% market drop takes 30 minutes to register, which
is how a lending market accumulates bad debt. Use it as a cross-check, not a source.

---

## 5. What to price collateral with, and what to check

**Price with Chainlink as primary**, as a pair of feeds, with a Uniswap V3 TWAP as
a divergence circuit-breaker only. Concretely:

**5.1 — Use two feeds, not one.** We are pricing WETH *against USDC debt*. Read
ETH/USD **and** USDC/USD and divide. Do not hardcode USDC = $1. In March 2023 USDC
traded to $0.88; a market that assumes the peg silently misprices every position
by 12% at precisely the moment it is under stress.

**5.2 — `latestRoundData()`, never `latestAnswer()`.** `latestAnswer()` has no
timestamp, so staleness cannot be checked at all.

**5.3 — Validate the answer.** `require(answer > 0)` — the return is `int256` and
an unchecked cast of a negative value becomes an astronomically large price.

**5.4 — Per-feed staleness, not one global constant.** Mainnet ETH/USD is a 1-hour
heartbeat / 0.5% deviation; USDC/USD is a 24-hour heartbeat / 0.25% deviation. A
single `3600` constant either permanently reverts on USDC or under-checks ETH.
Store the threshold per feed in the asset config. Also `require(updatedAt != 0)`
to reject incomplete rounds.

**5.5 — Read `decimals()` at configuration time; never hardcode.** Chainlink
USD feeds are 8 decimals, WETH is 18, USDC is 6. Normalize explicitly to one
internal precision (18 is conventional), and **multiply before dividing** in the
ETH/USD ÷ USDC/USD composition so the division truncation lands at the end, not
in the middle.

**5.6 — Sanity band.** Aggregators have historically clamped at `minAnswer`/
`maxAnswer` — this is exactly what turned the Venus/LUNA incident into an
eight-figure loss, with the feed reporting a $0.10 floor while the asset was worth
~$0.00001. Where the underlying aggregator exposes the bounds, reject answers at
them; where it does not, enforce our own absolute floor/ceiling per asset and
revert outside it.

**5.7 — Fail closed, and never fall back to a DEX.** If the feed is stale or
invalid: revert borrows, revert withdrawals, **and revert liquidations**. The
tempting design is "fall back to the pool if Chainlink is down" — do not build it.
That hands the attacker a second, cheaper attack: grief the oracle path, force the
fallback, then manipulate the fallback they just selected. A fallback to a
manipulable source is not a safety net, it is a feature request from the attacker.

**5.8 — Divergence circuit-breaker.** Compare Chainlink against a 30-minute
Uniswap V3 TWAP on every read. If they diverge beyond a threshold (~2% steady-state,
sized against real ETH 30-minute volatility so it does not trip constantly), **pause
rather than choose**. This bounds oracle-compromise risk symmetrically: neither
source alone can move us, and it catches both a manipulated pool and a misbehaving
feed without requiring us to know which one broke.

**5.9 — Grace period on resume.** When the market unpauses or a feed recovers, do
not let liquidations fire on the first block against prices accumulated during the
outage. Give borrowers a window (Aave and Compound both do this) to top up.
Otherwise our own recovery becomes a mass-liquidation event.

**5.10 — Read the price once per transaction and use it consistently.** Fetch at
the top, cache in memory, use the same value for the pre-check, the seize amount,
and the post-check. Reading twice across an external call lets a reentrant
callback change what "the price" means mid-liquidation. Pair this with CEI and
`nonReentrant` on `liquidate`, `borrow`, and `withdraw`, and prefer
`safeTransfer`/`safeTransferFrom` for the USDC and WETH legs.

**5.11 — Bound the trust we just took on.** The teammate's third-party objection
deserves a real answer in the design, not a dismissal: put the feed registry behind
a timelock (so a compromised admin key cannot swap in a malicious feed and drain
the book in one transaction), validate a feed's `description`/pair at configuration
time, and keep the §5.8 divergence check as the live check on the oracle itself.

**5.12 — Verify feed addresses against Chainlink's official docs at deploy time.**
The mainnet aggregators are widely cited as `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419`
(ETH/USD) and `0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6` (USDC/USD) — treat those
as a starting point to check, not as authoritative here, and confirm both the
address and the heartbeat from `docs.chain.link` before they go into config. The
skill's address reference was not available in this checkout, so nothing above
should be copied into a deploy script unverified.

**5.13 — Not applicable today, but note it:** on Ethereum mainnet there is no
sequencer uptime feed to check. If this market is ever deployed to Arbitrum,
Optimism, or Base, the L2 sequencer uptime feed becomes mandatory alongside every
price read, with its own grace period after restart.

**5.14 — Price conservatively in the health calculation.** Where a band exists,
value collateral at the low end and debt at the high end. At an 85% liquidation
threshold on $2M tickets, the margin for rounding in the borrower's favour is thin.

---

## 6. Summary for the teammate

The claim "$200M of liquidity makes this expensive" measures the wrong quantity.
The attacker's cost is not the notional they push — it is the fee on a round trip
they immediately reverse, **$20k–$72k for a 10% move, less with JIT liquidity
rebates and a well-chosen block**. And "arbitrage bots would drag it back" does not
apply, because there is no block boundary for a bot to act across: the push, our
read, and the reversal are three instructions in one transaction.

For that cost, deflating 8% makes untouched 80%-LTV borrowers liquidatable and
returns **$133k–$356k per $2M position** to the attacker as liquidation bonus plus
discounted collateral — repeatable across the whole book at the same fixed cost.
The over-borrow direction is genuinely unprofitable at +10% and turns profitable
around +20%, for a cost increase of roughly 2×.

Price with Chainlink ETH/USD ÷ USDC/USD, validate answer/staleness/decimals/bounds
per feed, fail closed with no DEX fallback, pause on divergence from a 30-minute
TWAP, and give borrowers a grace period on resume.
