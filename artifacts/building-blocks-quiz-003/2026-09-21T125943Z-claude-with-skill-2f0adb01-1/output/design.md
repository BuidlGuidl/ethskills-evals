# Flash-Loan Arbitrage Bot — Design

Ethereum mainnet. Borrow 100,000 USDC from Aave V3, buy WETH on the cheaper DEX, sell it on the pricier DEX, repay, keep the rest. All in one transaction; if the end balance can't cover the repayment, the tx reverts.

## Assumptions (used for all numbers below)

| Item | Value | Note |
|---|---|---|
| Loan | 100,000 USDC | |
| Pair | USDC/WETH | |
| DEX A (buy WETH) | Uniswap V3 USDC/WETH, 0.05% fee tier | deepest pool |
| DEX B (sell WETH) | a 0.30% fee USDC/WETH pool (e.g. Uni V3 0.30% tier, Sushi) | where gaps usually appear |
| ETH price on DEX A | $2,500 | placeholder; bot reads live |
| Aave flash premium | 0.05% (5 bps) | read live from `Pool.FLASHLOAN_PREMIUM_TOTAL()` — governance can change it |
| Price impact, DEX A | ~$10 (0.01%) | placeholder; bot gets it from an onchain quoter |
| Price impact, DEX B | ~$25 (0.025%) | placeholder; shallower pool |
| Gas used | ~400,000 | flash loan ~100k + 2 × V3 swap ~130–150k + transfers |
| Gas price | ~0.6 gwei (base 0.5 + tip 0.1) | 2026 mainnet levels |

Aave V3 Pool: `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2`

## 1. Execution sequence (one run)

Example: DEX B price = $2,511 (gap = 0.44% = $440 on 100k).

| # | Step | In | Out | Running state |
|---|---|---|---|---|
| 0 | Off-chain: bot sees gap, simulates full tx, checks profit > threshold | — | — | — |
| 1 | EOA calls `ArbContract.executeArb()` → `Pool.flashLoanSimple(USDC, 100,000)` | — | — | — |
| 2 | Aave sends loan to contract | — | +100,000 USDC | holds 100,000 USDC; owes 100,050 USDC |
| 3 | Aave calls `executeOperation(asset, 100,000, premium=50, …)` | — | — | — |
| 4 | Swap on DEX A: USDC → WETH | 100,000 USDC | 39.976 WETH | fee 50 USDC → 99,950 / 2,500 = 39.980 WETH, minus impact 0.004 WETH ($10) |
| 5 | Swap on DEX B: WETH → USDC, `amountOutMin` = 100,050 + gas margin | 39.976 WETH | 100,053.60 USDC | fee 0.3% = 0.1199 WETH (~$301); 39.856 × 2,511 = 100,078.60, minus impact $25 |
| 6 | `approve(Pool, 100,050)`, return `true` | — | — | — |
| 7 | Aave pulls 100,050 USDC (loan + premium) | 100,050 USDC | — | contract holds 3.60 USDC |
| 8 | Contract sends leftover to owner (or keeps it) | 3.60 USDC | — | profit before gas = $3.60 |
| — | Gas paid by EOA in ETH | 0.00024 ETH | — | net ≈ **+$3.00** |

If at step 5 output < repayment, the swap's `amountOutMin` (or Aave's pull) reverts the whole tx. Nothing moves; only gas is lost (and not even that if sent as a private bundle — see costs).

## 2. Costs, itemized

| # | Cost | Formula | Amount |
|---|---|---|---|
| 1 | Aave flash-loan premium | 0.05% × 100,000 | **$50.00** |
| 2 | DEX A swap fee | 0.05% × 100,000 | **$50.00** |
| 3 | DEX B swap fee | 0.30% × ~100,370 (WETH value sold) | **~$301** |
| 4 | Price impact, DEX A | pool depth dependent | **~$10** |
| 5 | Price impact, DEX B | pool depth dependent | **~$25** |
| 6 | Gas | 400,000 × 0.6 gwei = 0.00024 ETH × $2,500 | **~$0.60** |
| | **Total at break-even** | | **~$437** |

Costs not in the break-even total but real:

| Cost | Size | Why it matters |
|---|---|---|
| Builder payment (MEV bribe) | usually 50–95% of profit | Other bots see the same gap. To get included first, you pay the block builder (coinbase transfer in a Flashbots-style bundle). Doesn't move break-even, but cuts real profit hard. |
| Reverted txs | ~$0.30–0.60 each (partial gas) | Only if sent to public mempool. Private bundles that fail aren't included → $0. |
| Being front-run / sandwiched | up to the whole gap | Public mempool exposes the trade. Use private submission only. |
| Infra | RPC node, simulation, servers | Fixed monthly, off-chain. |
| Deploy contract | one-time, ~1–2M gas ≈ $1–3 | |

Main takeaway: **swap fees + flash premium are ~92% of the cost; gas is ~0.1%.** Cheap gas doesn't make small gaps profitable — pool fees do the damage.

## 3. Minimum price gap (break-even)

Define gap `G = 100,000 × (P_B / P_A − 1)` in USD — the profit a fee-free, impact-free round trip would make.

Break-even: USDC out of step 5 = repayment + gas.

```
USDC needed out of DEX B = 100,000 + 50 (Aave) + 0.60 (gas) = 100,050.60
Add back DEX B impact:                                        + 25
→ DEX B must pay (before impact)                              = 100,075.60

WETH arriving at DEX B:
  (100,000 × (1 − 0.0005) / 2,500) − 0.004   = 39.976 WETH
  after 0.30% fee: 39.976 × 0.997             = 39.8561 WETH

Required DEX B price:
  P_B = 100,075.60 / 39.8561                  = $2,510.92

G = 100,000 × (2,510.92 / 2,500 − 1)          = $437
```

Same thing as a sum of costs (first-order):

```
G_min ≈ 50 (Aave) + 50 (DEX A fee) + 301 (DEX B fee) + 10 + 25 (impact) + 0.60 (gas)
      ≈ $437   → 0.437% price difference
```

**Below a ~$437 gap (0.44%) on 100k, a run loses money.** Above it, profit ≈ `G − 437`, minus whatever goes to the builder.

### Sensitivity

| Scenario | G_min |
|---|---|
| Base case (0.05% + 0.30% pools) | **$437** |
| Both legs on 0.05% pools | 50 + 50 + 50 + 35 + 0.6 ≈ **$186** |
| Zero-fee flash source (Balancer / Morpho) instead of Aave, base pools | **$387** |
| Gas spike to 20 gwei | +$19.40 → **$456** |
| Shallow DEX B pool, impact 0.5% ($500) | **~$912** |

Impact grows with trade size; fees grow linearly. So 100k isn't necessarily the best size — the bot should pick the size that maximizes `G(size) − costs(size)` per opportunity.

## 4. Design implications

- Contract must revert unless `final USDC ≥ loan + premium + minProfit`. Enforce via `amountOutMin` on the last swap.
- Read the Aave premium and pool fees onchain every run; don't hardcode 5 bps.
- Quote both legs with onchain quoters (e.g. Uniswap `QuoterV2`) against the pending block; decide with simulated numbers, not spot prices.
- Submit only via private bundles (Flashbots / builder RPCs). Never public mempool.
- Only the owner EOA can trigger; `executeOperation` must check `msg.sender == POOL` and `initiator == address(this)`.

## Open questions

1. Which two DEXes / pools exactly? Fee tiers drive most of the break-even.
2. Must it be Aave? Balancer/Morpho flash loans are fee-free (saves $50/run).
3. Fixed 100k size, or dynamic sizing per opportunity?
4. Profit threshold above break-even to demand (covers builder bribe + model error)?
