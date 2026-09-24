# Oracle design review: `slot0` on Uniswap V3 WETH/USDC 0.05%

## Summary

The proposal is not safe and the reasoning behind it contains a specific,
load-bearing error. The error is this sentence:

> "arbitrage bots would drag it back within the same block, so they would eat
> the loss for nothing"

The attacker does not hold the displaced price for a block. They hold it for
the duration of one `CALL`. The manipulation, the read, and the unwind are
three steps of a single transaction. No arbitrage bot can interleave — the
EVM does not let them. The only agent who arbitrages the price back is the
attacker, on the last line of their own transaction, paying themselves.

That collapses the cost from "the loss on tens of millions of dollars" to
"the swap fee on a round trip," which is **0.1%** of whatever notional they
needed to push. The $200M TVL number does not enter the cost at all; it only
sets the notional, and the notional is flash-loanable.

Worked below: cost to move the read price 10% is **$5k–$100k** depending on
how the pool's liquidity is actually distributed. Payoff from a single
manipulated liquidation is **16.7% of whatever debt they repay**, and payoff
from the borrow side is bounded only by the USDC you have lent out.

Recommendation: price collateral with Chainlink ETH/USD ÷ USDC/USD, with the
validation listed in §7. Do not use `slot0`. Do not use a V3 TWAP as the
primary either, for reasons in §6.

---

## 1. Why the round trip is the whole story

An attacker's transaction:

```
1. flashLoan(N USDC)                         // Balancer/Morpho: 0% fee
2. pool.swap(USDC -> WETH, N)                // price moves up; fee 0.05% of N
3. lendingMarket.doTheThing()                // our contract calls slot0 HERE
4. pool.swap(WETH -> USDC, ~all of it)       // price moves back; fee 0.05%
5. repay flash loan
```

Steps 2 and 4 are symmetric moves along the same liquidity curve. Ignoring
fees, step 4 returns almost exactly the notional that step 2 consumed — the
"loss" the write-up imagines is a *price impact*, and price impact on a round
trip inside one transaction is not a loss, it is a temporary balance change
that reverses. What does not reverse is the fee, charged on volume:

```
cost ≈ 2 × 0.0005 × N  +  gas  +  flashLoanFee(N)
```

Note what is *absent* from that formula: pool TVL. TVL determines how large
`N` has to be to achieve a given displacement. It does not determine the cost
per unit of `N`. A deeper pool makes the attack require more *borrowed*
capital — which is free — and costs the attacker 0.1% more of a larger
number. It does not make the attack meaningfully harder.

A secondary consequence: the attacker never needs to own the capital. They
need it for ~200k gas worth of execution. Aave v3, Balancer and Morpho each
hold nine-figure USDC that is flash-loanable in a single call, Morpho and
Balancer at zero fee.

## 2. What N actually is

For a constant-product pool, moving the price by a factor `k` requires

```
N = y_virtual × (√k − 1)
```

where `y_virtual = L·√P` is the USDC-side virtual reserve. For `k = 1.10`,
`√1.10 − 1 = 4.881%`.

We cannot pin `L` from "$200M of liquidity," because TVL and *depth at spot*
are different quantities in a V3 pool — most of that $200M sits in ranges that
are not active. So rather than guess, here is the cost across a wide band of
assumptions, including ones far more favourable to the proposal than reality:

| Assumption about depth | N to move 10% | Swap fees (2 × 5bp) | Gas @ 20 gwei | Total |
|---|---|---|---|---|
| Pool behaves like a $200M constant-product pool | $4.9M | $4,900 | ~$150 | **~$5k** |
| 5× deeper than that near spot | $25M | $25,000 | ~$150 | **~$25k** |
| 20× deeper — i.e. all $200M packed inside ±1% | $100M | $100,000 | ~$150 | **~$100k** |

Add Aave's 0.05% flash fee if they use Aave instead of Balancer/Morpho —
$2.5k / $12.5k / $50k respectively. Worst cell in the table: **$150k**.

Two things push the real number toward the *low* end, not the high end:

- Concentrated liquidity is a cliff, not a slope. Once the swap walks out of
  the densely-provisioned band, the remaining ticks are thin and the price
  moves for almost nothing. Getting *to* ±10% is disproportionately cheaper
  than the constant-product model suggests, because the last several percent
  are nearly free.
- The attacker can be an LP. They may withdraw their own liquidity in step 1
  and re-add it in step 5, thinning the pool precisely for the block they
  attack in. They also *earn back* their pro-rata share of the fees they paid.
  An attacker holding 30% of the active-range liquidity pays 30% less.

The $200M is not a constant the protocol controls. It is a number that other
people can change, including the attacker, including within the attack.

## 3. Payoff, direction 1: push the price down, harvest liquidations

Suppose a borrower sits at 78% LTV — comfortably healthy, well inside your
85% threshold, exactly the kind of position your risk parameters are designed
to tolerate. $2M of WETH collateral, $1.56M of USDC debt.

Read the price 10% low and their collateral reads $1.8M. LTV reads
1.56 / 1.8 = **86.7%**. Liquidatable.

The attacker liquidates in the same transaction. With a 50% close factor and
a 5% liquidation bonus:

- Repay: $780,000 USDC (flash-loaned)
- Seize: $780,000 × 1.05 = $819,000 of collateral **valued at the manipulated
  price**
- That is $819,000 / 0.90 = **$910,000 of WETH at the true price**
- Unwind the pool, sell the WETH at true market, repay the flash loan

**Profit: $130,000 on one position.** As a fraction of the repaid amount:

```
(1 + bonus) / (1 − manipulation) − 1  =  1.05 / 0.90 − 1  =  16.67%
```

If your bonus is 10% rather than 5%, it is 22.2%.

Break-even against the cost table in §2:

| Attack cost | Debt that must be repaid to break even (5% bonus) |
|---|---|
| $5k | $30,000 |
| $25k | $150,000 |
| $150k (worst case, deep pool + Aave) | $900,000 |

With a $2M position cap and a 50% close factor, **one single position** clears
the worst-case break-even. And the attacker does not liquidate one position —
they liquidate *every* position that the 10% displacement pushes underwater,
in the same transaction, because the manipulation cost is paid once and is
independent of how much they extract against it.

The set of victims is not small. A 10% downward displacement makes every
borrower above **76.5% LTV** liquidatable. That is not an exotic corner of
your book; on a market with an 85% threshold, that band is where ordinary
leveraged users live. The attacker does not need to act today — they wait for
a block where enough debt has drifted into that band, and they can see the
whole book on-chain to decide when.

Note also who bears this. It is not the protocol, initially — it is honest,
solvent borrowers, who get liquidated at a 16.7% haircut for a price that
never existed on any exchange. That is a user-funds loss even in the scenario
where your treasury never takes a dollar of bad debt.

## 4. Payoff, direction 2: push the price up, borrow against air

Deposit real WETH, inflate the read price, borrow against the inflated value,
walk away and let the position default.

Profit on collateral of true value `C` at inflation `f`:

```
profit = 0.85 × C × (1 + f) − C
```

This turns positive at `f > 1/0.85 − 1 = 17.65%`. So a 10% move is not enough
for this one — correct, and worth stating precisely, because it is the one
place the write-up's intuition half-holds. But:

- 17.65% is not meaningfully more expensive than 10%. `√1.1765 − 1 = 8.47%`
  versus `√1.10 − 1 = 4.88%` — the notional roughly doubles, and the cost is
  0.1% of the notional. Under the mid assumption: ~$43k instead of ~$25k.
- At `f = 30%` (notional ~2.9×, so ~$72k under the mid assumption), profit is
  `0.85 × 1.30 − 1 = 10.5%` of collateral deposited, and the attack is
  repeatable within the same transaction across as many positions as they
  care to open.
- **Your $2M cap does not bound this.** It is a per-position cap on a
  permissionless system. Twenty addresses is twenty positions. The real bound
  on the loss is *the USDC you have available to lend* — i.e. the whole
  market — and it lands as unrecoverable protocol bad debt, not as a haircut
  to one user.

So direction 1 is the cheap, repeatable, quiet attack; direction 2 is the one
that ends the protocol.

## 5. The asymmetry, stated plainly

- Manipulation cost is **fixed** and scales with 0.1% of notional.
- Extraction scales **linearly with your TVL**, and is paid once per attack.
- Therefore there exists no set of risk parameters — LTV, bonus, close
  factor, position cap — that makes this safe. Growth makes it worse. The
  more successful the market is, the larger the prize behind a lock whose
  cost does not move.

This is not a hypothetical class of bug. bZx (2020), Cheese Bank, Warp
Finance, Inverse Finance (2022, $15.6M, Curve/Sushi spot), Mango Markets
(2022, $114M, thin-book spot) are the same transaction shape. Inverse
Finance in particular had used a TWAP and was still drained; §6.

## 6. Why the obvious patch — a V3 TWAP — is also not the answer here

Raising this pre-emptively, because it is where this conversation usually
goes next.

A TWAP does remove the single-transaction attack: sustaining a displacement
across `N` blocks means giving up arbitrage profit to outside searchers every
block, so cost becomes roughly linear in the window length. That is a genuine
improvement. But:

1. **It is bounded, not prohibitive.** Cost scales with window length and
   pool depth. For a prize that scales with your TVL, a long enough window is
   needed, and the needed window grows as you grow.
2. **Post-Merge, block proposers are known in advance.** An attacker who
   controls or bribes consecutive slots can hold a displacement across them
   with no arbitrage leakage at all. Multi-block MEV directly attacks the
   TWAP's only security assumption.
3. **Lag is itself a liability.** A 30-minute TWAP during a real 15% ETH move
   prices your collateral 15% wrong for half an hour — in the direction that
   prevents liquidations that should happen. You trade manipulation risk for
   guaranteed bad debt on volatile days. This is what actually broke Inverse
   Finance's second incident: the oracle was working as designed and was
   simply too slow.
4. **Denomination.** A WETH/USDC TWAP is ETH priced in USDC. If USDC depegs,
   the oracle reports an ETH price move that did not happen.

A long TWAP is a reasonable *sanity bound*. It is not a price.

## 7. Recommendation

**Price collateral with Chainlink push feeds: ETH/USD ÷ USDC/USD.**

Both legs. Do not hardcode USDC = $1 — you are computing a WETH/USDC exchange
rate, and USDC has traded at $0.88 within living memory (March 2023). Pricing
USDC at par during a depeg understates the real dollar burden of the debt and
suppresses liquidations exactly when you need them.

Addressing the three objections directly, because two of them are fair:

- *"An extra external call."* Yes — ~25k gas for a proxy-routed
  `latestRoundData`. Against a $2M position cap, this is not a cost worth
  discussing.
- *"Its answer can be stale between updates."* True and the most substantive
  objection. Mainnet ETH/USD updates on a 0.5% deviation threshold with a 1h
  heartbeat, so the on-chain price can legitimately sit up to ~0.5% away from
  market. That is a bounded, known, one-directional error and it must fit
  inside your liquidation bonus — with a 5% bonus and an 85% threshold, it
  does, comfortably. Compare to the alternative, where the error is not
  bounded at all: it is whatever the attacker pays for.
- *"It puts a third party between us and our liquidations."* Also true, and a
  real risk, not one to wave away: feed deprecation, aggregator
  misconfiguration, the min/max circuit-breaker failure mode that cost Venus
  ~$11M in the LUNA collapse. The answer is to manage that risk with the
  validation below plus a divergence guard — not to replace a third party you
  can monitor and bound with a price surface anyone can rewrite for $25k.
  "Our own on-chain source of truth" is a category error: `slot0` is not a
  source of truth, it is the last trade in a venue with no access control.

### Secondary source: guard, not fallback

Add an independent second source (Chronicle, RedStone, Pyth, or a 30-minute
V3 TWAP). Use it **only as a divergence check**. If the two disagree by more
than a threshold (say 2%), **pause borrows and liquidations** rather than
silently picking one. A "fallback" that automatically switches to the weaker
oracle when the strong one is unavailable just hands the attacker a
two-step attack: break the primary, then manipulate the fallback.

## 8. What must be checked around the price before it enters a health calc

Per feed leg, every read:

1. **`latestRoundData()`, never `latestAnswer()`.** The latter gives you no
   timestamp and cannot be validated.
2. **`answer > 0`.** Revert on zero or negative. An `int256` of 0 silently
   produces infinite health or zero collateral value depending on where it
   lands.
3. **Staleness: `block.timestamp - updatedAt <= heartbeat + grace`.** Use a
   **per-feed** configured heartbeat, not one global constant — ETH/USD is 1h
   on mainnet, USDC/USD is 24h. A single 1h constant applied to USDC/USD
   bricks your market; a single 24h constant applied to ETH/USD lets you
   liquidate on a day-old price.
4. **Min/max circuit breaker.** Read `minAnswer`/`maxAnswer` off the current
   aggregator and revert if `answer` is pinned at either bound. When the real
   price exits the aggregator's configured band, the feed does not fail — it
   keeps reporting the bound as though it were true. This is precisely the
   Venus/LUNA loss. This check must read the aggregator live, because the
   proxy can be repointed.
5. **`decimals()` read from the feed, not hardcoded to 8.** USD feeds are
   generally 8, but this is not guaranteed and is not stable across
   aggregator upgrades.
6. **`updatedAt != 0`** — an incomplete round.
7. **Sequencer uptime feed + grace period.** Not applicable on mainnet, but
   mandatory the day this deploys to an L2, and cheaper to build in now.

At the health-calculation level:

8. **Round against the protocol, always.** Collateral value rounds *down*,
   debt value rounds *up*. Rounding must never be able to manufacture
   solvency.
9. **Cross the two legs at full precision.** Compute `ethUsd * 1e_k / usdcUsd`
   in one expression; do not normalise each leg to a USD value and divide
   afterwards, and do not truncate between the two.
10. **Same price snapshot for every position inside one transaction.** Read
    once, pass it down. A batch liquidation that re-reads per position can
    behave inconsistently across an update boundary.
11. **Divergence guard against the secondary → pause**, per §7.
12. **Document the staleness budget against the liquidation bonus.** Write
    down that the maximum benign oracle error (deviation threshold + the
    worst-case heartbeat gap) is strictly less than the bonus, and re-check
    that inequality whenever either parameter is changed. This is the
    invariant that makes the whole design sound, and it should be an explicit,
    reviewed number rather than an accident.

### Sketch

```solidity
function _price(Feed memory f) internal view returns (uint256) {
    (uint80 roundId, int256 answer,, uint256 updatedAt,) =
        f.agg.latestRoundData();

    require(updatedAt != 0,                                 "incomplete");
    require(block.timestamp - updatedAt <= f.heartbeat,     "stale");
    require(answer > 0,                                     "bad price");

    // Live aggregator: the proxy can be repointed under us.
    IAggregator a = IAggregator(f.agg.aggregator());
    require(answer > a.minAnswer() && answer < a.maxAnswer(), "at bound");

    return uint256(answer);  // caller scales by f.agg.decimals()
}

// WETH/USDC, both legs validated, no par assumption on USDC.
function wethInUsdc() public view returns (uint256) {
    uint256 eth  = _price(ethUsd);
    uint256 usdc = _price(usdcUsd);
    return eth * 1e6 * 1e8 / (usdc * 1e8);  // fix scaling to actual decimals()
}
```

## 9. One number to take away

To move the price your contract reads by 10%, an attacker pays the swap fee
on a round trip — **0.1% of the notional, with the notional flash-loaned**.
Under the assumption most favourable to the proposal (all $200M packed inside
±1% of spot, Aave's flash fee, mainnet gas), that is **$150,000**.

Against that, they recover **16.7% of every dollar of debt they repay** in
manipulated liquidations, across every position in the book above 76.5% LTV,
in one transaction. Break-even is under **$900,000** of repaid debt — less
than one maxed-out position at a 50% close factor.

The cost is fixed. The prize is your TVL. There is no LTV that fixes that.
