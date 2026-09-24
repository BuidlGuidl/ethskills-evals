# USDC Yield Vault on Base — Design

All numbers below were read on 2026-09-21 (Base block ~51,603,700) from on-chain calls
(`cast`, publicnode RPC) and GeckoTerminal for 24h volume / AERO price. They are a
snapshot. Gauge emissions are set by votes and change every weekly epoch (Thu 00:00 UTC).

## 1. Pool choice

**Pick: Aerodrome basic (v2) volatile pool USDC/WETH, staked in its gauge.**

| Item | Address |
|---|---|
| Pool (vAMM-WETH/USDC, `stable=false`) | `0xcDAC0d6c6C59727a65F871236188350531885C43` |
| Gauge (alive: `Voter.isAlive = true`) | `0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025` |
| Gauge fee sink (`feesVotingReward`) | `0x14df87824a11DC27afF185D3149E05aaa4735f60` |
| Router | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` |
| PoolFactory (router `defaultFactory`) | `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` |
| Voter | `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5` |
| AERO (gauge `rewardToken`) | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` |
| AERO/USDC vAMM (harvest swap route) | `0x6cDcb1C4A4D1C3C6d054b27AC5B77e89eAFb971d` |
| USDC / WETH | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` / `0x4200000000000000000000000000000000000006` |

Pool state: reserves 1,661 WETH + 4.54M USDC (~$9.08M TVL, ETH ≈ $2,732),
98.7% of LP supply staked in gauge, swap fee 0.30% (`factory.getFee`), 24h volume ~$416k.

Why this one:
- **Simple accounting.** LP is a fungible ERC-20. Vault shares = pro-rata claim on
  `gauge.balanceOf(vault)`. No NFTs, no ranges, no rebalancing keeper.
- **Live gauge with real emissions.** 17.9k AERO/week, epoch ends `periodFinish = 1790208000`.
- **Deep enough** for the vault's own zaps; AERO→USDC exit route has ~$36M liquidity.

Candidates checked and rejected for v1:

| Pool | Why not |
|---|---|
| Slipstream (CL) USDC/WETH tickSpacing 100 `0xb2cc…59DC59` | Highest emissions (163k AERO/wk, ~60-75% APR on in-range staked liq), but needs active range management; out-of-range earns 0 and concentrated LVR is much worse. Candidate for v2 of the vault, not v1. |
| Slipstream USDC/WETH tickSpacing 1 `0xdbc6…4330f1` | **Gauge killed** (`isAlive = false`), ~$150k TVL. |
| Slipstream USDC/USDT tickSpacing 1 `0xa41B…57fcD1` | Only real "no-ETH-exposure" option. ~$1.04M TVL, ~1,000 AERO/wk → ~3.6% APR. Tiny capacity: $500k of deposits dilutes it to ~2.4%. Below Aave (see §3). |
| Slipstream USDC/EURC tickSpacing 50 | ~10.9% APR but adds EUR/USD FX risk; ~$1.4M TVL. |
| USDC/USDbC, USDC/USDT, USDC/EURC sAMM | Tiny TVL and/or killed gauges. |

## 2. harvest() flow

Key fact: **a gauge-staked Aerodrome LP earns AERO emissions only. It does not earn
trading fees.** Fees on staked LP are claimed by the gauge and forwarded to
`feesVotingReward` for veAERO voters. So harvest claims one token, from one contract.

```
harvest(minUsdcOut)   // onlyKeeper
1. gauge.getReward(address(this))
     - Gauge 0x519B…C025. Must be called by the account itself (or Voter).
     - Pays AERO only. Nothing else to claim; do NOT call pool.claimFees()
       (vault holds no unstaked LP, would return ~0).
2. if aeroBal == 0 → return (gauge killed / nothing accrued is not an error).
3. Swap AERO → USDC
     router.swapExactTokensForTokens(aeroBal, minUsdcOut,
         [Route(AERO, USDC, stable=false, factory)], vault, deadline)
     - minUsdcOut: keeper-supplied, AND checked on-chain against the AERO/USDC
       pool TWAP (pool.quote(AERO, aeroBal, granularity)) with max deviation.
       Never use spot price → sandwich.
4. Take performance fee (in USDC) → treasury; small keeper tip.
5. Zap: swap the balancing share of USDC → WETH on the same pool
     (optimal-swap formula accounting for 0.30% fee), same TWAP-bound minOut.
6. router.addLiquidity(WETH, USDC, false, amtW, amtU, minW, minU, vault, deadline)
7. gauge.deposit(lpBal)
8. Leftover dust stays in vault; rolled into next harvest.
```

Notes:
- Emissions stream per second, so harvest anytime; daily is enough.
  Daily vs weekly compounding on ~7% APR adds ~0.25%/yr. Base gas is negligible.
- Right after epoch flip, `rewardRate` resets from new votes — can drop sharply.
- Gauge can be killed by governance (seen today on the tickSpacing-1 USDC/WETH gauge).
  Needs `emergencyExit()`: `gauge.withdraw(all)`, hold LP unstaked (then earns
  pool fees via `pool.claimFees()`), stop harvesting.
- Deposit/withdraw use the same zap path with user-supplied min amounts.
  Share price from LP balance, not from spot USD valuation (manipulable).
- Approvals: exact-amount approvals to router and gauge per call, not infinite.

## 3. What the position actually earns

Snapshot: AERO $0.69, ETH $2,732, staked TVL $8.97M.

| Component | APR | Goes to vault? |
|---|---|---|
| AERO emissions: 17,895 AERO/wk × $0.69 × 52 ÷ $8.97M | **~7.2%** | Yes — the only income |
| Trading fees: $416k/day × 0.30% ÷ $9.08M | ~5.0% | **No** — goes to veAERO voters while staked |
| LVR / impermanent loss (xy=k ≈ σ²/8; ETH vol 50–70%) | **−3% to −6%** | Cost, borne by vault |
| Harvest swap costs (0.3% on AERO→USDC, zap slippage) | ~−0.05% | Cost |
| Performance fee (e.g. 10% of AERO) | ~−0.7% | Cost |

Realistic net: **~0.5–4% APR in USD terms**, before ETH price moves. On top of that the
vault holds ~50% ETH: a 30% ETH drop is ~−16% on principal (half-exposure plus IL),
which dwarfs the yield.

Sensitivities:
- **Dilution:** vault's own deposits share fixed emissions. +$1M → 6.5%, +$5M → 4.6%.
- **AERO price:** yield is linear in it. Sell every harvest; don't hold AERO.
- **Votes:** emissions can move ±50% week to week.

Benchmark: Aave v3 USDC supply on Base is **3.65% APR** today
(`getReserveData(USDC).currentLiquidityRate`, Pool `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5`),
with no ETH exposure. The vault must be sold as "ETH-exposed LP yield", not as a USDC yield product.

## 4. Before coding

- Fork test (Base, pinned block) full cycle: deposit → warp 1 day → harvest → withdraw.
  Assert AERO received matches `gauge.earned(vault)`, and `pool.claimFees` gives vault 0.
- Fork test: gauge killed mid-epoch, epoch flip, zero rewards, sandwich on harvest swap.
- Re-check all addresses/rates at deploy time; this doc is a snapshot.

## Unresolved questions

1. OK for depositors to carry ~50% ETH exposure? If not → USDC/USDT CL pool (low capacity) or just Aave.
2. Performance fee % and keeper tip?
3. TVL cap? Suggest capping so emission APR stays above Aave.
