# Flash-Loan Arbitrage Bot — Design

Ethereum mainnet. Borrow 100,000 USDC from Aave V3, buy WETH on the cheaper DEX, sell it on the pricier DEX, repay, keep the rest. Everything happens in one transaction: if the trade doesn't make money, it reverts.

## Assumptions (used for every number below)

| Item | Value | Notes |
|---|---|---|
| Loan | 100,000 USDC | USDC has 6 decimals → `100_000e6` |
| Aave V3 flash-loan fee | 0.05% (5 bps) | read `POOL.FLASHLOAN_PREMIUM_TOTAL()` at runtime, don't hardcode |
| Pair | USDC/WETH | |
| DEX A (buy WETH) | Uniswap V3 USDC/WETH, 0.05% fee tier | |
| DEX B (sell WETH) | second DEX's USDC/WETH pool, 0.05% fee tier | see sensitivity table for a 0.30% pool |
| Price impact | 0.01% per leg (~$10 on $100k) | deep pools only; must be quoted live per trade |
| ETH price | $3,000 on DEX A, $3,006 on DEX B | example gap = 0.2% = $200 on 100k |
| Gas used | ~350,000 | flash loan + 2 swaps + approvals |
| Gas price | 0.5 gwei (base + priority) | typical 2026 mainnet; spikes happen |

Addresses: Aave V3 Pool `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2`, Uniswap V3 SwapRouter02 `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45`.

## 1. Execution sequence (with amounts)

Off-chain (bot):

0. Watch both pools. When the gap is above the break-even (section 3), simulate the full tx against the latest block (`eth_call`). If simulated profit > threshold, send it as a private bundle (Flashbots / MEV-Share), not to the public mempool.

On-chain (one tx):

| # | Step | USDC | WETH |
|---|---|---|---|
| 1 | Bot calls `ArbContract.execute()` → `POOL.flashLoanSimple(this, USDC, 100_000e6, params, 0)` | — | — |
| 2 | Aave sends loan to contract, calls `executeOperation(asset, amount, premium, …)` | contract holds **100,000.00** | 0 |
| | Debt now owed: 100,000 + 0.05% × 100,000 = **100,050.00** | | |
| 3 | Swap 100,000 USDC → WETH on DEX A. Fee 0.05% = $50.00, impact 0.01% = $10.00 → $99,940 worth at $3,000 | 0 | **33.31333** |
| 4 | Swap 33.31333 WETH → USDC on DEX B at $3,006 → gross $100,139.88; fee 0.05% = $50.07; impact 0.01% = $10.01 | **100,079.80** | 0 |
| 5 | Check: balance ≥ owed + `minProfit`, else `revert` (loses only gas, and with a private bundle, not even that) | 100,079.80 | |
| 6 | `approve(POOL, 100,050.00)`, return `true`; Aave pulls loan + fee | **29.80** left | |
| 7 | Transfer 29.80 USDC profit to owner | 0 | |

Net after gas ($0.53): **≈ $29.27** on a $200 gap. Most of the gap is eaten by fees.

Each swap sets `amountOutMinimum` (slippage limit) so a moved price makes the swap revert instead of losing money.

## 2. Costs, itemized

Per successful run, at the assumptions above:

| # | Cost | How computed | USD |
|---|---|---|---|
| 1 | Aave flash-loan fee | 100,000 × 0.05% | **50.00** |
| 2 | DEX A swap fee | 100,000 × 0.05% | **50.00** |
| 3 | DEX B swap fee | ~100,090 × 0.05% | **~50.05** |
| 4 | Price impact, leg A | 100,000 × 0.01% | **~10.00** |
| 5 | Price impact, leg B | ~100,080 × 0.01% | **~10.01** |
| 6 | Gas | 350,000 × 0.5 gwei = 0.000175 ETH × $3,000 | **~0.53** |
| | **Fixed + proportional total** | | **~170.6** |
| 7 | Builder tip / priority bid | competitive: other bots bid 80–99% of profit to the block builder | variable, from profit |

Other costs, not per-run:

- **Failed attempts.** Public mempool: a reverted tx still pays gas (~$0.53 each). Private bundle: reverted bundles aren't included → $0. Use private bundles.
- **Contract deploy:** one-off, ~1–1.5M gas ≈ $1.50–2.25 at 0.5 gwei.
- **RPC / node infra:** off-chain, outside this per-trade math.

Swap fees (items 2–3) are the biggest lever: with a 0.30% pool on either side, that leg costs $300 instead of $50.

## 3. Minimum price gap (break-even)

Let the gap `G` = how much more 100k USDC worth of WETH sells for on DEX B than it costs on DEX A, i.e. `G = 100,000 × (P_B / P_A − 1)`.

**Simple (additive) estimate:**

```
G_min = flash fee + fee A + fee B + impact A + impact B + gas
      = 50 + 50 + 50 + 10 + 10 + 0.53
      ≈ $170.53
```

**Exact (fees compound on each leg):**

```
USDC back = 100,000 × (1 − 0.0005) × (1 − 0.0001) × (P_B/P_A) × (1 − 0.0005) × (1 − 0.0001)
          = 100,000 × 0.99880046 × (P_B/P_A)

Need: USDC back ≥ loan + flash fee + gas = 100,000 + 50 + 0.53 = 100,050.53

P_B/P_A ≥ 100,050.53 / 99,880.046 = 1.0017069
G_min   = 100,000 × 0.0017069 ≈ $170.69   (≈ 0.171% price gap)
```

**Below ~$171 on the 100k trade, running it loses money.** In practice add a margin for the builder tip and model error; e.g. require `G ≥ ~$200` before sending.

Check against section 1: gap $200 → net $29.27 ≈ 200 − 170.69 = 29.31 (tiny rounding diff). ✔

### Sensitivity

| Scenario | Change vs. base | G_min on 100k |
|---|---|---|
| Base (5 bp + 5 bp pools, 0.5 gwei) | — | **~$171** |
| DEX B is a 0.30% pool | fee B $50 → ~$300 | ~$421 |
| Both pools 0.30% | fees A+B $100 → ~$600 | ~$671 |
| Gas spikes to 20 gwei | gas $0.53 → $21 | ~$191 |
| Thinner pools, 0.1% impact per leg | impact $20 → $200 | ~$351 |
| Zero-fee flash source (e.g. Balancer / Morpho) instead of Aave | flash fee $50 → $0 | ~$121 |

Takeaway: gas is now almost irrelevant on mainnet; the break-even is set by the three 5-bp fees (flash loan + 2 swaps) plus price impact. The gap must exceed ~0.17% of trade size, and such gaps between deep USDC/WETH pools are rare and heavily contested.

## Open questions

1. Which exact DEX B (Uniswap V4 pool, Sushi, Curve tricrypto, …) and fee tier?
2. Aave required, or OK to use a zero-fee flash source (saves $50/run)?
3. Fixed 100k size, or size each trade to maximize profit (optimal size is usually smaller than 100k for small gaps)?
4. How much of profit to bid to builders (tip policy)?
