# Flash-loan arbitrage bot — design

Borrow 100,000 USDC from Aave V3, buy WETH on the cheaper DEX, sell it on the
pricier DEX, repay the loan, keep the rest. All in one transaction: if the
money doesn't add up, the whole thing reverts and only gas is lost.

## Assumptions (base case)

Change these and redo the math in the last section.

| Item | Value | Note |
|---|---|---|
| Loan | 100,000 USDC | |
| Aave V3 flash-loan fee | 0.05% | Check live: `FLASHLOAN_PREMIUM_TOTAL()` on Pool `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2` (returns bps) |
| DEX A (buy WETH) | Uniswap V3 USDC/WETH, 0.05% fee tier | pool `0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640` |
| DEX B (sell WETH) | another 0.05% USDC/WETH pool (e.g. Sushi V3 / Pancake V3 / Uniswap V4) | |
| Price impact | 2 bps (0.02%) per leg | deep pools, 100k size; measure per pool with a quote before sending |
| ETH price on DEX A | $3,000 | |
| Gas used | 400,000 | flash loan + 2 swaps + repay |
| Gas price | 4 gwei (base + priority) | |

## 1. Steps of one execution (amounts)

Price on DEX B = `P_B` (unknown; solved for in section 3).

| # | Step | In | Out / state |
|---|---|---|---|
| 1 | Bot EOA calls our contract → `Pool.flashLoanSimple(USDC, 100,000)` | — | contract holds **100,000 USDC**, owes **100,050 USDC** (100,000 + 0.05%) |
| 2 | Swap on DEX A: USDC → WETH | 100,000 USDC | fee 0.05% → 99,950 USDC effective; 99,950 / 3,000 = 33.3167 WETH; minus 2 bps impact → **33.3100 WETH** |
| 3 | Swap on DEX B: WETH → USDC | 33.3100 WETH | fee 0.05% → 33.2933; minus 2 bps impact → 33.2867 WETH effective → **33.2867 × P_B USDC** |
| 4 | Check: USDC balance ≥ 100,050 + min profit, else revert | | |
| 5 | Aave pulls repayment (contract approved it) | 100,050 USDC | loan closed |
| 6 | Leftover USDC sent to owner | 33.2867 × P_B − 100,050 | profit before gas |
| 7 | Gas paid in ETH by bot EOA (outside the USDC flow) | 0.0016 ETH | ≈ $4.80 |

## 2. Costs, itemized

| Cost | How computed | USD |
|---|---|---|
| Aave flash-loan fee | 100,000 × 0.05% | **$50.00** |
| DEX A swap fee | 100,000 × 0.05% | **$50.00** |
| DEX B swap fee | ~100,000 of WETH × 0.05% | **~$50.00** |
| Price impact, DEX A | ~100,000 × 0.02% | **~$20.00** |
| Price impact, DEX B | ~100,000 × 0.02% | **~$20.00** |
| Gas | 400,000 × 4 gwei = 0.0016 ETH × $3,000 | **$4.80** |
| **Total** | | **≈ $195** |

Not in the table, but real:

- **Builder tip / MEV competition.** Other bots see the same gap. To win the
  block we send a Flashbots-style bundle and pay the builder a share of profit
  (often most of it). It's a share of profit, so it doesn't move break-even,
  but it decides whether we win at all.
- **Failed attempts.** Sent via private bundle: a failed trade isn't included,
  costs $0. Sent publicly: a revert still burns gas (~$2–5 here) and can be
  front-run.
- **Gas spikes.** At 30 gwei, gas = 400,000 × 30 gwei × $3,000 = $36.

## 3. Minimum price gap (break-even)

Break-even: USDC out of step 3 must cover repayment + gas.

```
33.2867 × P_B = 100,050 + 4.80 = 100,054.80
P_B           = 100,054.80 / 33.2867 = 3,005.85
gap per ETH   = 3,005.85 − 3,000 = $5.85   (0.195%)
gap on 100k   = 0.195% × 100,000 = $195
```

Quick check by summing costs in bps:

```
flash 5 + swap A 5 + swap B 5 + impact 2 + impact 2 = 19 bps
19 bps × 100,000 = $190  + gas $4.80  ≈ $195
```

**Below ~$195 gap on the 100k trade (≈0.195% price difference), the bot loses money.**
The contract's on-chain check (step 4) should enforce this so an unprofitable
trade reverts instead of settling at a loss.

### Sensitivity

| Change | Break-even gap |
|---|---|
| Base case | $195 |
| Gas at 30 gwei | $226 |
| DEX B is a 0.30% pool (e.g. Sushi V2) | $445 |
| Zero-fee flash loan (Balancer / Morpho) instead of Aave | ~$145 |

Note: the "gap" here is the difference between the two pools' prices *before*
we trade. Our own trade moves both prices toward each other, which is what the
price-impact line accounts for; bigger size → bigger impact, so 100k may not be
the best size for a given gap.

## Open questions

- Which exact second DEX/pool? Its fee tier dominates break-even.
- Aave (0.05% fee) required, or ok to use zero-fee flash loans (Balancer/Morpho)?
- Private bundles only (Flashbots etc.), or also public mempool?
- Fixed 100k size, or compute the best size per opportunity?
