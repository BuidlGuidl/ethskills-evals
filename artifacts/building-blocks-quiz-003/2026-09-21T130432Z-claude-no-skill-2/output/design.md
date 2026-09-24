# Flash-Loan Arbitrage Bot — Design

Borrow 100,000 USDC from Aave V3, buy WETH on the cheaper DEX, sell it on the
more expensive DEX, repay Aave, keep what's left. Everything happens in **one
transaction**: if the end balance can't repay the loan, the whole tx reverts.

## 0. Assumptions (replace with live values before trusting any number)

| Parameter | Value used | Where it comes from |
|---|---|---|
| Loan size `L` | 100,000 USDC (6 decimals → `100_000e6`) | fixed by spec |
| Aave V3 flash-loan fee | 0.05% | `Pool.FLASHLOAN_PREMIUM_TOTAL()` on mainnet — read it on-chain, governance can change it |
| ETH price | $3,000 | only used to price gas |
| DEX A (buy WETH) | Uniswap V3 USDC/WETH, 0.05% fee tier | deep concentrated liquidity; price impact on $100k ≈ 0.01% |
| DEX B (sell WETH) | V2-style pool (SushiSwap / Uniswap V2), 0.30% fee | assumed reserves 20,000,000 USDC / (20M ÷ price) WETH |
| Gas used | ~350,000 | 21k base + ~90k flash loan + ~130k V3 swap + ~100k V2 swap + transfers/approve |
| Gas price | 5 gwei (base + priority) | sensitivity table below |

"Price gap" `G` = how much more the 100k of WETH is worth at DEX B's spot price
than at DEX A's, before fees and impact:
`G = L × (P_B − P_A) / P_A`. Example: P_A = $3,000, P_B = $3,030 → G = $1,000.

## 1. Execution sequence (worked example: P_A = $3,000, P_B = $3,030, G = $1,000)

| # | Step | Amount moving |
|---|---|---|
| 1 | Bot sends tx (private relay, see §2.6) calling our contract → `Pool.flashLoanSimple(receiver, USDC, 100_000e6, params, 0)` | — |
| 2 | Aave transfers USDC to our contract | **+100,000.00 USDC** |
| 3 | Aave calls `executeOperation(asset, amount, premium, initiator, params)`; `premium = 50e6` | owed: 100,050.00 USDC |
| 4 | Swap on DEX A: USDC → WETH. 0.05% fee takes $50, impact ~0.01% | **−100,000.00 USDC → +33.3133 WETH** (100,000 × 0.9995 ÷ 3,000 × 0.9999) |
| 5 | Swap on DEX B: WETH → USDC. 0.30% fee takes 0.0999 WETH (~$300); V2 formula `out = R_usdc·x/(R_weth + x)` with x = 33.2134, R_weth = 6,600.66 | **−33.3133 WETH → +100,132.74 USDC** |
| 6 | Check `balance ≥ 100,050` else `revert` (also enforce `amountOutMinimum` on each swap) | — |
| 7 | `USDC.approve(Pool, 100,050e6)`; return `true`; Aave pulls repayment | **−100,050.00 USDC** |
| 8 | Contract keeps the rest (sweep to owner) | **+82.74 USDC** |
| 9 | Gas paid by the bot's EOA | **−$5.25** (350k × 5 gwei × $3,000) |
|   | **Net** | **≈ +$77.49** |

So a $1,000 gap nets only ~$77. Most of the gap is eaten by costs.

## 2. Costs per execution (itemized, on the 100k trade)

| # | Cost | Rate | USD | Notes |
|---|---|---|---|---|
| 2.1 | Aave flash-loan premium | 0.05% of 100,000 | **$50.00** | fixed per loan |
| 2.2 | DEX A swap fee | 0.05% of 100,000 | **$50.00** | Uniswap V3 5bp tier |
| 2.3 | DEX A price impact | ~0.01% | **~$10.00** | depends on liquidity in current tick range |
| 2.4 | DEX B swap fee | 0.30% of ~$99,940 of WETH | **~$299.80** | V2 fee is on input |
| 2.5 | DEX B price impact | ≈ x / (R + x) = 100k / 20.1M ≈ 0.50% | **~$497.50** | biggest single cost; shrinks with deeper pool or smaller trade |
| 2.6 | Gas | 350k gas × 5 gwei × $3,000 | **$5.25** | see table |
| 2.7 | Builder tip / MEV bribe | share of profit | variable | needed to win the block vs. other searchers; paid only if included |
|   | **Total fixed-ish cost (2.1–2.6)** | | **≈ $912.55** | |

Gas sensitivity (350k gas, ETH $3,000):

| Gas price | 1 gwei | 5 gwei | 20 gwei | 50 gwei |
|---|---|---|---|---|
| Cost | $1.05 | $5.25 | $21.00 | $52.50 |

Other costs, not per-trade:
- **Failed attempts**: through Flashbots / a private builder, a reverting tx is
  not included → $0. Sent to the public mempool, a revert still burns gas
  (~$1–5 at the rates above) and the trade will likely be front-run.
- **One-time**: contract deploy (~1M gas ≈ $15 at 5 gwei), token approvals.
- **Off-chain**: RPC / node, servers. Not in the per-trade math.

## 3. Minimum price gap (break-even)

Break-even means final USDC − repayment − gas = 0.

**Additive estimate** (sum of §2):

```
  Aave premium        50.00
+ DEX A fee           50.00
+ DEX A impact        10.00
+ DEX B fee          299.80
+ DEX B impact       497.50
+ gas                  5.25
= ≈ $912.55
```

**Exact** (solve for P_B where net = 0, same formulas as §1):
fees compound on already-reduced amounts, and the V2 pool's impact is itself
priced at P_B, so the exact figure is slightly higher:

```
WETH after A   = 100,000 × 0.9995 × 0.9999 / 3,000         = 33.3133
x (after fee)  = 33.3133 × 0.997                           = 33.2134
need out       = 100,050 + 5.25                            = 100,055.25 USDC
out            = 20,000,000 · x / (20,000,000/P_B + x)
→ P_B ≈ $3,027.64
G_min = 100,000 × (3,027.64 − 3,000) / 3,000               ≈ $921
```

**→ Minimum gap ≈ $921 on the 100k trade (≈ 0.92%).** Below that the tx
either reverts (costs nothing if sent privately) or, if forced through, loses
money. Any builder bribe (§2.7) comes on top: e.g. paying 50% of profit to the
builder leaves ~$39 on a $1,000 gap.

Check with the §1 example: G = $1,000 → net $77.49 → 1,000 − 77.49 ≈ $922.5 ✓

### What moves the threshold

- **Pool depth on DEX B dominates.** If DEX B were also a deep V3 0.05% pool,
  the total is ≈ 50 + 50 + 10 + 50 + 10 + 5 ≈ **$175** (≈ 0.18%).
- **Trade size**: impact grows with size, fees are flat %. 100k is not
  necessarily optimal; the bot should size each trade to maximize
  `gap − costs`, capped at 100k.
- **Flash-loan source**: Balancer V2 / Morpho flash loans charge 0% — saves
  the $50.
- **Gas**: minor at 1–5 gwei, meaningful (~$50) in spikes.

## 4. Safety rules for the contract

- `executeOperation` must check `msg.sender == Pool` and `initiator == address(this)`.
- Only owner can trigger; profit swept to owner.
- Per-swap `amountOutMinimum` + final `balance ≥ amount + premium + minProfit`
  check → revert instead of losing.
- Quote both legs off-chain (Uniswap `Quoter`, V2 `getAmountsOut`) against the
  latest block before sending; send only via private relay.

## Open questions

- Which exact pools for DEX A / DEX B? Numbers above assume a 20M/side V2 pool.
- Is Aave required, or is a 0%-fee lender (Balancer/Morpho) acceptable?
- Fixed 100k size, or let the bot pick the optimal size?
