# Flash-Loan Arbitrage Bot — Design

Borrow 100,000 USDC from Aave V3 (Ethereum mainnet), buy WETH on the cheaper DEX, sell it on the pricier DEX, repay the loan plus fee, keep what's left.

## 0. Live data this doc uses

Everything below was read on-chain on **2026-09-21, block 26,026,109 (13:13 UTC)** through `ethereum-rpc.publicnode.com`. Prices move every block, so rerun these reads before relying on any number.

| Item | Source | Value |
|---|---|---|
| Aave flash-loan fee | `Pool(0x8787…4E2).FLASHLOAN_PREMIUM_TOTAL()` | `5` bps = **0.05%** (all of it goes to the protocol) |
| USDC available in Aave to borrow | `USDC.balanceOf(aEthUSDC 0x98C2…5c)` | 158,766,560 USDC (a 100k loan is fine) |
| ETH/USD | Chainlink `0x5f4e…8419` | $2,734.20 |
| Base fee | latest block | 0.378 gwei |
| Priority fee (median, last 20 blocks) | `eth_feeHistory` | ~0.05–0.6 gwei |
| DEX A: Uniswap V3 USDC/WETH 0.05% (`0x88e6…5640`) | `slot0`, `liquidity` | 2,730.01 USDC/ETH, ~123.4M USDC virtual depth |
| DEX B: Uniswap V3 USDC/WETH 0.30% (`0x8ad5…6D8`) | `slot0`, `liquidity` | 2,735.08 USDC/ETH, ~161.4M USDC virtual depth |
| Uniswap V2 USDC/WETH (`0xB4e1…C9Dc`) | `getReserves` | 10.58M USDC / 3,866.8 WETH |
| SushiSwap V2 USDC/WETH (`0x397F…ACa0`) | `getReserves` | 145k USDC / 53.1 WETH (too small, excluded) |

The worked example uses the two Uniswap V3 pools as "DEX A" and "DEX B" because they were the deepest pair with a live price gap at the time of the reads. The math works the same for any two venues: plug in their fees and depth. Before picking the real second DEX (Curve, Balancer, Uniswap V4, etc.), check its pool, depth and fee on-chain the same way.

"Virtual depth" means the pool's current-tick liquidity expressed as USDC. The price-impact numbers assume that liquidity stays the same across the ~16 ticks this trade moves through. Confirm with the Uniswap `QuoterV2` on a mainnet fork.

## 1. Execution sequence (one run, live prices)

Everything happens in one transaction. If any check fails, the whole thing reverts.

| # | Step | Amounts moved |
|---|---|---|
| 1 | Bot EOA calls `Arb.execute(params)` | — |
| 2 | `Arb` calls `Pool.flashLoanSimple(Arb, USDC, 100_000e6, params, 0)` | Aave → Arb: **+100,000.00 USDC** |
| 3 | Aave calls `Arb.executeOperation(USDC, 100_000e6, premium=50e6, initiator, params)`; check `msg.sender == Pool` and `initiator == Arb` | — |
| 4 | Swap on DEX A: USDC → WETH (0.05% fee pool) | Arb → DEX A: **−100,000.00 USDC** (of which 50.00 is the LP fee)<br>DEX A → Arb: **+36.5820 WETH** (36.6116 at the no-impact price; the shortfall of 0.0296 WETH ≈ $80.9 is price impact) |
| 5 | Swap on DEX B: WETH → USDC (0.30% fee pool) | Arb → DEX B: **−36.5820 WETH** (of which 0.1097 WETH ≈ $300.2 is the LP fee)<br>DEX B → Arb: **+99,692.82 USDC** (99,754.45 at the no-impact price; impact ≈ $61.6) |
| 6 | Profit check: `require(balance ≥ 100_050e6 + minProfit)` | balance is 99,692.82 < 100,050.00 → **reverts** |
| 7 | (if step 6 passed) `USDC.approve(Pool, 100_050e6)`; return `true` | — |
| 8 | Aave pulls the repayment with `transferFrom` | Arb → Aave: **−100,050.00 USDC** (100,000 principal + 50 fee) |
| 9 | Sweep the profit to the owner | Arb → owner: **balance − 100,050** |

At the live prices, the result would be 99,692.82 − 100,050.00 = **−$357.18** before gas. The 0.19% ($185.74) gap between the pools is smaller than the pools' combined 0.35% fee, so there is nothing to take. That's normal: arbitrageurs keep live gaps inside the fee band. Profitable moments are short gaps that open after a large trade.

Notes:
- Swaps use `amountOutMinimum` values computed off-chain, plus the step-6 check. Never set 0.
- Send through a private builder route (e.g. Flashbots bundle) so reverted attempts are never included on-chain and cost no gas.
- Only the owner can call `execute`. The contract holds no funds between runs.

## 2. Cost breakdown (100,000 USDC trade)

| # | Cost | How it's calculated | USD |
|---|---|---|---|
| 1 | Aave flash-loan fee | 0.05% × 100,000 | **50.00** |
| 2 | DEX A swap fee | 0.05% × 100,000 | **50.00** |
| 3 | DEX B swap fee | 0.30% × ~100,000 of WETH (0.1097 WETH × $2,735) | **300.24** |
| 4 | DEX A price impact | ≈ 100,000 × 100,000 / (123.4M + 0.1M) = 0.081% | **80.88** |
| 5 | DEX B price impact | ≈ 100,000 × 100,000 / (161.4M + 0.1M) = 0.062% | **61.63** |
| 6 | Gas | ~350,000 gas (estimate: flash loan ~90k + 2 V3 swaps ~120k each + transfers/checks; measure on a fork) × (0.378 base + ~0.12 tip ≈ 0.5 gwei) × $2,734 | **0.48** |
| 7 | Builder bid / MEV competition | Other bots compete for the same gap, and the winner usually pays most of its profit to the block builder. This isn't a fixed number; it's whatever you choose to bid. | **variable** |
| 8 | Failed attempts | $0 through a private bundle (reverted bundles aren't included). If sent publicly, each revert costs the full gas (~$0.48 now, ~$19 at 20 gwei). | **0 / 0.48+** |
| | **Fixed + size-dependent total (1–6)** | | **≈ 543.23** |

Costs 1–3 grow linearly with trade size. Costs 4–5 grow roughly with size squared. Cost 6 stays the same whatever the size.

## 3. Minimum price gap (breakeven)

Gap = (price on DEX B − price on DEX A) / price on DEX A × 100,000, in USD.

The run makes money only if what you receive back is more than what you owe:

```
USDC out  >  100,000 + Aave fee + gas
```

**Simple additive estimate** (adding up each cost from section 2):

```
min gap ≈ Aave fee + fee A + fee B + impact A + impact B + gas
        ≈ 50.00  + 50.00 + 300.24 + 80.88 + 61.63 + 0.48
        ≈ $543.23      (0.543% of 100k)
```

**Exact figure** (found by raising DEX B's price in the pool math until output = 100,050 + gas, so fees and impact compound):

```
min gap = $545.29   (0.5453%)
         i.e. DEX B must quote ≥ 2,730.01 × 1.005453 ≈ 2,744.90 USDC/ETH
         when DEX A quotes 2,730.01
```

**Below a ~$545 gap on the 100k trade, the run loses money.** That's before any builder bid. If you expect to bid a share *b* of profit to win the block, you only profit when gap > $545 and you keep (1 − b) × (gap − 545).

### How it changes with the venue pair

| Pair | Fees (Aave + A + B) | Impact (A + B) | Gas | Breakeven gap |
|---|---|---|---|---|
| V3 0.05% ↔ V3 0.30% (live, above) | 50 + 50 + 300 | 81 + 62 | 0.5 | **≈ $545** |
| V3 0.05% ↔ Uniswap V2 0.30% | 50 + 50 + 300 | 81 + ~937 (100k / 10.68M) | ~0.4 | **≈ $1,420** (V2 too shallow at this size) |
| V3 0.05% ↔ a 0.05%-fee venue as deep as pool A | 50 + 50 + 50 | 81 + 81 | 0.5 | **≈ $313** (assumed, not verified) |
| Gas at 20 gwei instead of 0.5 | — | — | ~19 | adds ~$19 to any row |

Main takeaway: gas is almost nothing at today's fees. The Aave fee plus the DEX fees and depth decide profit or loss. Choose the lowest-fee, deepest pools, and size the loan to the gap: the best size is where the extra profit from trading one more dollar equals its extra impact cost. Don't fix it at 100k.

## 4. Before writing code

- Fork mainnet at a recent block. Replay the flow and measure real gas and the actual `QuoterV2` output for both legs.
- Test failure paths on the fork: gap closes mid-block (step 6 reverts), a swap returns less than `amountOutMinimum`, `executeOperation` called by someone other than the Pool or with the wrong initiator, and leftover allowance after the run.
- Recheck `FLASHLOAN_PREMIUM_TOTAL` at startup. Aave governance can change it.

## Unresolved questions

- Which exact second DEX? (Curve/Balancer/Uni V4 not yet checked on-chain)
- Fixed 100k loan size, or size set per opportunity?
- Private submission route: Flashbots only, or several builders?
- Only USDC/WETH, or other pairs too?
