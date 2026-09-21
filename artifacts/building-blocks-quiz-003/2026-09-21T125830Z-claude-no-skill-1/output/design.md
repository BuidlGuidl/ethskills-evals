# Flash-Loan Arbitrage Bot — Design

Borrow 100,000 USDC from Aave V3 (Ethereum mainnet), buy WETH on the cheaper DEX,
sell it on the pricier DEX, repay the loan plus fee, keep what's left. All in one
transaction: if the final balance can't cover repayment, the whole tx reverts.

## Assumptions (check these before going live)

| Item | Value used | Where it comes from |
|---|---|---|
| Loan size | 100,000 USDC | fixed by design |
| Aave V3 flash-loan fee | 0.05% (5 bps) | `Pool.FLASHLOAN_PREMIUM_TOTAL()` on `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2`. Governance can change it (was 0.09% before) — read it on-chain, don't hardcode |
| DEX A | Uniswap V3 USDC/WETH, 0.05% fee tier | pool fee |
| DEX B | second USDC/WETH pool, 0.05% fee tier (e.g. another V3-style DEX) | pool fee |
| Price impact | ~0.015% per leg for 100k in a deep pool | estimate; real value from an on-chain quote each block |
| Gas used | ~400,000 gas | flash loan (~100k) + 2 V3 swaps (~120k each) + overhead |
| Gas price | 2 gwei (base 1 + priority 1) | varies; recompute every block |
| ETH price | $3,000 | example only |
| Example prices | DEX A: 3,000 USDC/ETH, DEX B: 3,006 USDC/ETH (0.2% gap = $200 on 100k) | example only |

"Price gap" in this doc = difference between the two pools' current (mid) prices,
expressed as USD on a 100k trade: `(P_B − P_A) / P_A × 100,000`.

## 1. Execution sequence (with example amounts)

| # | Step | Amount in | Amount out / balance after |
|---|---|---|---|
| 1 | Bot EOA calls `ArbContract.execute(...)`, which calls `Pool.flashLoanSimple(USDC, 100,000)` | — | contract holds **100,000 USDC**, owes 100,050 |
| 2 | Aave calls back `executeOperation(...)` on our contract | — | — |
| 3 | Swap on DEX A (buy WETH at 3,000): pay 0.05% fee (50 USDC), then price impact (~15 USDC) | 100,000 USDC | 99,950 / 3,000 × (1 − 0.00015) = **33.3117 WETH** |
| 4 | Swap on DEX B (sell WETH at 3,006): 0.05% fee (0.0167 WETH ≈ $50), then price impact (~$15) | 33.3117 WETH | 33.2950 × 3,006 × (1 − 0.00015) = **100,069.79 USDC** |
| 5 | Check: balance ≥ 100,050 and ≥ min-profit, else revert | — | — |
| 6 | Approve Aave; Aave pulls 100,000 + 50 fee | 100,050 USDC | contract keeps **19.79 USDC** |
| 7 | Sweep profit to owner | 19.79 USDC | owner +19.79 USDC |
| — | Gas paid by bot EOA in ETH | 0.0008 ETH | ≈ **$2.40** |

Net result at a $200 gap: 19.79 − 2.40 ≈ **$17.39** (before any builder tip, see below).

## 2. Costs per execution (itemized)

| Cost | Formula | USD |
|---|---|---|
| Aave flash-loan fee | 100,000 × 0.05% | 50.00 |
| DEX A swap fee | 100,000 × 0.05% | 50.00 |
| DEX A price impact | 99,950 × 0.015% | 14.99 |
| DEX B swap fee | ~100,135 × 0.05% | 50.07 |
| DEX B price impact | ~100,085 × 0.015% | 15.01 |
| Gas | 400,000 × 2 gwei = 0.0008 ETH × $3,000 | 2.40 |
| **Total** | | **≈ $182.47** |

Not per-trade but worth knowing:

- **Builder tip / MEV bribe**: other bots compete for the same gap. Winning usually
  means paying most of the profit to the block builder (via priority fee or
  `block.coinbase` transfer). It comes out of profit, so it doesn't move the
  breakeven, but expect to keep only a small share of `gap − costs`.
- **Failed attempts**: a reverted tx sent to the public mempool still pays gas
  (~$1–2 at 2 gwei). Send via private relays (Flashbots Protect / builder RPCs)
  so losing attempts are dropped instead of mined.
- **One-time**: contract deployment, ~1.5M gas ≈ $9 at 2 gwei.

## 3. Minimum price gap (breakeven)

Profit = gap − (flash fee + swap fees + price impact + gas)

```
flash fee        50.00
swap fee A       50.00
swap fee B       50.07
impact A + B     30.00
gas               2.40
-----------------------
breakeven gap  ≈ 182.47 USD   (≈ 0.18% of 100k)
```

Check against the walkthrough: $200 gap − $182.47 ≈ $17.5 profit, matching the
$17.39 above (small difference is rounding / fees compounding on each other).

**Below ~$183 gap on 100k, running it loses money.** Fees are ~83% of that
number; gas is almost irrelevant at 2 gwei.

### Sensitivity

| Change | New breakeven |
|---|---|
| Gas at 20 gwei instead of 2 | +$21.60 → **≈ $204** |
| DEX B is a 0.30% pool (e.g. Uniswap V2 / Sushi) instead of 0.05% | +$250 → **≈ $433** |
| Both pools 0.01% tier (stable-ish pairs only) | −$80 → **≈ $103** |
| Flash-loan source with 0 fee (Balancer, Morpho) instead of Aave | −$50 → **≈ $132** |

Takeaway: the pool fee tiers dominate. With Aave + two 0.05% pools, only gaps
above ~0.18% are worth taking, and those get closed fast by competing bots.

## Open questions

1. Which exact pair + two DEXes? (Numbers above assume USDC/WETH, both 0.05%.)
2. Stay with Aave (0.05% fee) or allow a zero-fee flash source?
3. Fixed 100k size, or size the trade per opportunity (usually more profitable)?
4. Target min profit after tip — e.g. only fire if expected net ≥ $X?
