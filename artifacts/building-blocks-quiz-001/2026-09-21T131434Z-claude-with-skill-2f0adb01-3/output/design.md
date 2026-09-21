# USDC Yield Vault on Base — Design

ERC-4626 vault. Asset = USDC. Strategy = LP into Aero (ex-Aerodrome) stable pool, stake LP in pool's gauge, keeper compounds AERO emissions back into LP.

> Addresses below: verify onchain before deploy. Gauge address never hardcoded — read from `Voter.gauges(pool)`.

| Thing | Base address |
|---|---|
| USDC (native) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| AERO | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` |
| Aero Router | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` |
| Aero PoolFactory (classic) | `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` |
| Aero Voter | `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5` |

---

## 1. Which pool, and why

**Choice: Aero classic stable pool (`sAMM`) — USDC paired with a major USD stablecoin** (e.g. `sAMM-USDC/USDT` or whichever USDC/USD-stable pair has best emissions-per-TVL and a pair token we trust at deploy time).

Why Aero, not Uniswap:
- Aero is dominant DEX on Base; emissions are directed there by veAERO votes. Uniswap V3/V4 on Base pays LPs fees only, and USDC/stable fee tiers earn little.

Why stable pool:
- Users deposit USDC and expect USDC back. Both sides ≈ $1 → near-zero impermanent loss (value lost vs just holding, caused by price moving between the two tokens).
- `sAMM` curve (x³y + y³x, Curve-like) keeps swap cost low for the zap (USDC → half into pair token).

Why not the alternatives:
- `vAMM-WETH/USDC` / CL WETH/USDC: higher headline APR, but vault becomes ~50% ETH exposure + IL. Wrong product for a USDC vault.
- Slipstream (concentrated liquidity) stable pools: position is an NFT with a price range, needs rebalancing logic, gauge rewards only while in range. More code, more ways to fail. Revisit in v2.
- USDC/USDbC: USDbC is legacy bridged USDC being wound down; emissions and liquidity shrinking.

Pair token = extra risk. If it depegs, the pool drifts toward holding mostly that token. Pick by: issuer quality, Base liquidity depth, emissions/TVL. Make pool **immutable per vault** (new pool → new vault), simpler than migration logic.

---

## 2. harvest() flow

Key fact: **staked Aero LPs earn AERO emissions, not trading fees.** When LP sits in the gauge, the pool's swap fees go to the gauge's `FeesVotingReward` contract → paid to veAERO voters. So harvest claims **only AERO, only from the Gauge.** Calling `pool.claimFees()` returns ~nothing because the vault holds no unstaked LP.

Contracts touched:
- `Gauge` (pool's gauge, = `Voter.gauges(pool)`) — source of AERO
- `Router` — AERO→USDC swap, add liquidity
- `Pool` — only indirectly via router

Steps (`onlyKeeper`, `nonReentrant`):

1. **Claim** — `gauge.getReward(address(this))`. Transfers accrued AERO to vault. (Gauge only lets `_account` itself or Voter call this.)
2. **Skip if dust** — if AERO balance < `minHarvest`, return (saves swap cost on tiny amounts).
3. **Sell AERO → USDC** — `router.swapExactTokensForTokens(aeroBal, minOut, route, vault, deadline)`, route = `AERO → USDC` volatile pool (or `AERO → WETH → USDC` if deeper). `minOut` passed by keeper, and contract checks it against an oracle/TWAP bound (max slippage e.g. 1%) so a compromised or sloppy keeper can't get sandwiched to zero.
4. **Take perf fee** (optional) — X% of USDC proceeds to treasury.
5. **Zap to pool ratio** — compute amount of USDC to swap into pair token so both sides match pool reserves; swap via router with `stable=true` route.
6. **Add liquidity** — `router.addLiquidity(USDC, pairToken, true, amtA, amtB, minA, minB, vault, deadline)` → LP tokens. Leftover dust stays in vault, picked up next harvest.
7. **Stake** — `gauge.deposit(lpAmount)`.
8. **Emit** `Harvest(aeroClaimed, usdcFromSale, lpAdded, fee)`.

Timing: emissions stream per second across weekly epochs (flip Thursday 00:00 UTC). Harvest every ~12-24h is enough; Base gas is ~cents, the real cost is swap slippage, so bigger/less frequent harvests beat tiny frequent ones.

Deposit/withdraw use same zap in reverse: `gauge.withdraw(lp)` → `router.removeLiquidity` → swap pair token → USDC.

---

## 3. What the position realistically earns

| Source | Earned? | Notes |
|---|---|---|
| Trading fees | **No** (≈0) | Go to veAERO voters while LP is staked. |
| AERO emissions | **Yes — ~all yield** | Set weekly by votes; changes every epoch. |
| Bribes / voting fees | No | Only for veAERO lockers; vault doesn't lock. |
| Compounding | Small | Few tenths of a % at these APRs. |

Emission APR formula (read live from gauge):

```
APR = gauge.rewardRate() * 31_536_000 * AERO_price / (gauge.totalSupply() * LP_price)
```

**Illustrative example** (made-up but plausible numbers, not a quote — check Aero UI / DeFiLlama at deploy):

| Item | Value |
|---|---|
| Staked TVL in gauge | $5,000,000 |
| Emissions to gauge | 10,000 AERO/week |
| AERO price | $0.80 |
| Gross emission APR | $8,000/wk × 52 / $5M ≈ **8.3%** |
| Our deposit dilution (+$500k TVL) | → ≈ **7.6%** |
| AERO sell slippage + swap fees (~0.3-0.5% of rewards) | −0.03% |
| Zap cost on compound (~0.05% of compounded amount) | ≈ 0 |
| Keeper gas (Base, ~$0.01-0.05/harvest, daily) | ≈ 0 at >$100k TVL |
| Perf fee (e.g. 10% of rewards) | −0.76% |
| **Net to depositors** | **≈ 6.5-7%** |

Realistic takeaways:
- Yield is **variable, weekly**. If voters move emissions elsewhere, APR can halve next Thursday. Stable pools usually get less emissions than volatile/bribed pools.
- Yield is paid in AERO. AERO price drop between harvests = lower realized yield. More frequent harvests reduce this exposure (trade-off vs slippage).
- Our own TVL dilutes APR linearly — vault can't scale forever in one pool.
- Downside is not just "lower APR": pair-token depeg, Aero contract risk, bad oracle/valuation in `totalAssets()`.

---

## Risks / guardrails

- **Share price manipulation**: `totalAssets()` must not value LP from spot reserves alone (flash-loan manipulable). Use reserves + fair-value check or oracle prices for both tokens.
- **Sandwiching**: oracle-bounded `minOut` on every swap (harvest, deposit, withdraw).
- **First-depositor/inflation attack**: use OZ ERC4626 virtual shares (`_decimalsOffset`) or seed deposit.
- **Pair depeg**: pause deposits + allow withdraw-in-kind if pair token trades < e.g. $0.98.
- Start with a TVL cap.

## Unresolved questions

1. Which pair token exactly (USDT vs other USD stable)? Need live emissions/TVL check.
2. Perf fee %, treasury address?
3. Keeper: own bot, Gelato, or Chainlink Automation? Permissioned or anyone-can-call with bounds?
4. Oracle source for AERO/USDC and pair token (Chainlink on Base vs pool TWAP)?
5. Withdraw fee to cover exit zap cost, or socialize it?
