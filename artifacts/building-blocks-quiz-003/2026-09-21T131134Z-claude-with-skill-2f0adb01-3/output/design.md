# Flash-Loan Arbitrage Bot — Design

Ethereum mainnet. Borrow 100,000 USDC from Aave V3, buy WETH on the cheap DEX, sell it on the expensive DEX, repay, keep the rest. Everything happens in one transaction: if the final USDC balance is below what we owe, the whole thing reverts.

## Assumptions (check these live before every run)

| Input | Value used | Where it comes from |
|---|---|---|
| Loan size L | 100,000 USDC | fixed by design |
| Aave V3 flash-loan fee | 0.05% (5 bps) | `Pool.FLASHLOAN_PREMIUM_TOTAL()` at `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2`. Governance can change it, so read it on-chain, don't hardcode it |
| DEX A (buy WETH) | Uniswap V3 USDC/WETH, 0.05% fee tier | pool `fee()` |
| DEX B (sell WETH) | a second venue, 0.30% fee tier (e.g. Sushi / Uni V2-style pool) | pool fee |
| Price impact, A | 0.03% (deep concentrated-liquidity pool) | assumption. Get the real number by simulating with Quoter/`eth_call` each block |
| Price impact, B | 0.10% | assumption, same as above |
| Gas used | ~350,000 (flash loan + 2 swaps + approvals + repay) | measure on a mainnet fork |
| Gas price | 0.5 gwei (base fee + priority fee) | current mainnet |
| ETH price | $3,000 | only matters for gas and the worked example |

"Price gap" means the difference between the two DEXes' mid prices (the price before fees and impact), expressed in USD on the 100k trade: `gap$ = L × (P_B / P_A − 1)`.

## 1. Steps of one execution (worked example: P_A = $3,000, P_B = $3,021, a 0.70% gap = $700)

| # | Action | Amount in | Amount out / balance after |
|---|---|---|---|
| 1 | Bot EOA calls `executeArb()` on our contract, which calls `POOL.flashLoanSimple(USDC, 100,000e6)` | — | — |
| 2 | Aave sends the loan to the contract | — | contract holds **100,000.00 USDC**. Debt = 100,000 + 50 fee = **100,050.00 USDC** |
| 3 | Aave calls `executeOperation()` on the contract | — | — |
| 4 | Swap USDC → WETH on DEX A. The 0.05% fee (50.00) and 0.03% impact (29.99) come out of it | 100,000.00 USDC | **33.3067 WETH** (worth 99,920.02 USDC at P_A) |
| 5 | Swap WETH → USDC on DEX B. Value at P_B = 100,619.46; minus 0.30% fee (301.86) and 0.10% impact (100.32) | 33.3067 WETH | **100,217.28 USDC** |
| 6 | Check `balance ≥ 100,050 + minProfit`, otherwise `revert` | — | — |
| 7 | `approve(POOL, 100,050.00)` and return `true`. Aave pulls the repayment | 100,050.00 USDC | contract holds **167.28 USDC** |
| 8 | Gas is paid in ETH by the EOA: 350k × 0.5 gwei = 0.000175 ETH | — | **−$0.53** |
| | **Net profit** | | **$166.75** (before any builder tip, see below) |

USDC has 6 decimals: 100,000 USDC = `100_000_000_000` raw units. Always pass `amountOutMin` to both swaps so a price move between simulation and inclusion reverts the transaction instead of losing money.

## 2. Costs, itemized (100k trade)

| Cost | Rate | USD | Notes |
|---|---|---|---|
| Aave flash-loan fee | 0.05% of L | **50.00** | fixed per run |
| DEX A swap fee | 0.05% of input | **50.00** | goes to LPs |
| DEX B swap fee | 0.30% of input | **~300** (301.86 in the example) | the biggest single cost. Selling on a 0.05% pool instead would cut it to ~50 |
| Price impact A | ~0.03% | **~30** | depends on pool depth; grows with trade size |
| Price impact B | ~0.10% | **~100** | same |
| Gas | 350k × 0.5 gwei × $3,000 | **0.53** | tiny on today's mainnet; ×10 if gas spikes to 5 gwei |
| **Total per successful run** | ≈0.53% | **≈ $532** | |

Costs that aren't fixed:

- **Builder tip / priority bribe.** Other bots see the same gap, and the block builder picks whoever pays them the most. In competitive arbitrage, searchers typically hand 80–99% of the surplus to the builder. This doesn't move the break-even point (it comes out of profit), but it means real profit ≈ (1 − tip share) × surplus.
- **Failed attempts.** If the transaction reverts in the public mempool, we still pay gas (~$0.53 each). Submitting as a private bundle (Flashbots / MEV-Share / builder RPCs) costs $0 when it doesn't land. So send privately; using the public mempool also invites front-running.
- **Price moving before inclusion.** Covered by `amountOutMin` and the step-6 check: a bad price becomes a revert, never a loss beyond gas.

## 3. Break-even price gap

The run makes money only if the USDC left after both swaps covers the loan, the flash-loan fee, and gas:

```
L × (P_B/P_A) × (1−fA)(1−iA)(1−fB)(1−iB)  ≥  L × (1 + flash) + gas
```

Plug in the numbers:

```
kept after fees and impact = 0.9995 × 0.9997 × 0.997 × 0.999 = 0.995206
required on the right      = 100,000 + 50 + 0.53           = 100,050.53
needed P_B/P_A             = 100,050.53 / (100,000 × 0.995206)
                           = 100,050.53 / 99,520.63
                           = 1.005324
```

**Break-even gap = 0.5324% ≈ $532 on the 100k trade.** With any smaller gap, running it loses money (or reverts and costs gas if sent publicly).

Quick check by simple addition: 50 + 50 + 300 + 30 + 100 + 0.53 = $530.53. The exact figure is ~$2 higher because the percentage costs compound on each other.

### How sensitive the number is

| Setup | Break-even gap |
|---|---|
| As above (0.05% + 0.30% pools, 13 bps impact) | **≈ $532** |
| Both pools 0.05%, zero impact (best case) | **≈ $151** (50 + 50 + 50 + 0.53, compounded) |
| Gas at 5 gwei instead of 0.5 | + $4.70 |
| Aave fee waived (0%) | − $50 |

Conclusion: gas barely matters now. The break-even point is set by pool fees and price impact, so choosing the cheapest fee tiers and the deepest pools matters more than anything else. The bot should work out the best trade size for each opportunity (price impact grows with size) instead of always borrowing exactly 100k.

## Open questions

- Which exact pools count as DEX A and DEX B? Both fees and impact depend on it.
- Minimum profit threshold, and what share of the surplus we're willing to tip builders?
- Fixed 100k loan size, or size each trade to its opportunity?
