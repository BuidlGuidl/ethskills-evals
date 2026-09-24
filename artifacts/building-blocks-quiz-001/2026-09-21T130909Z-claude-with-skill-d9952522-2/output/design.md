# USDC Yield Vault on Base — Design

All numbers are a snapshot from **2026-09-21 13:11 UTC** (Base block 51,603,473).
Sources: onchain reads via `cast` (public Base RPC) + GeckoTerminal API.
Re-check before deploy. Emissions change every weekly epoch.

## 1. Pool

**Aerodrome v2 volatile pool USDC/WETH (vAMM)** + its gauge.

| Item | Value | Source |
|---|---|---|
| Pool | `0xcDAC0d6c6C59727a65F871236188350531885C43` | GeckoTerminal, `Voter.gauges()` |
| token0 / token1 | WETH `0x4200…0006` / USDC `0x8335…2913` | `pool.token0/1()` |
| Type / fee | volatile (`stable()=false`), 30 bps | `PoolFactory.getFee(pool,false)` = 30 |
| Reserves | 1,661 WETH + 4.545M USDC ≈ **$9.10M TVL** | `getReserves()` |
| 24h volume | ≈ $416k | GeckoTerminal |
| Gauge | `0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025` | `Voter.gauges(pool)` |
| Gauge alive | true | `Voter.isAlive(gauge)` |
| Reward token | AERO `0x9401…8631` | `gauge.rewardToken()` |
| Emission rate | 0.02959 AERO/s ≈ 17,895 AERO/week | `gauge.rewardRate()` |
| LP staked in gauge | 98.7% of LP supply | `gauge.totalSupply() / pool.totalSupply()` |
| Share of votes | ~0.44% of total veAERO weight | `Voter.weights(pool) / totalWeight()` |

Other contracts: Router `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43`, PoolFactory
`0x420DD381b31aEf6683db6B902084cB0FFECe40Da`, Voter `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5`
(Router's `defaultFactory()`/`voter()` checked, they match).

### Why this one
- **Full range, no range management.** v2 pool = no ticks, no rebalancing, no out-of-range state.
  Slipstream (Aerodrome's concentrated-liquidity pools) and Uniswap v3/v4 have more volume but need
  an active range manager. That's too much keeper logic and risk for a small vault.
- **Live gauge with real emissions.** Checked onchain: gauge is alive and streaming AERO.
- **Blue-chip pair.** USDC + WETH, $9M depth. We can enter/exit without big price impact.
- Uniswap v3 WETH/USDC has more TVL ($130M) but no emissions and needs range management.

### What depositors are exposed to (must be in user docs)
The vault holds **~50% WETH**. Share value in USDC moves with ETH price, roughly at half the rate,
plus impermanent loss (IL = the loss vs just holding both tokens). IL vs holding the 50/50 mix:
ETH ±30% → ~0.9%, ±50% → ~2.0%, 2× → ~5.7%.
This is not a stable-USDC product. The alternative is an Aerodrome stable pool, e.g. msUSD/USDC sAMM
`0xcefc…4aaf7`, $1.45M TVL, gauge `0xDBF8…922a`. It has higher emission APR but carries the risk of
msUSD losing its $1 peg and has much less depth. See open questions.

## 2. harvest() flow

**Key fact:** once LP tokens are staked in an Aerodrome gauge, **the gauge earns the trading
fees, not us.** The gauge collects them and sends them to `FeesVotingReward`
(`0x14df87824a11DC27afF185D3149E05aaa4735f60`) for veAERO voters. Staked LPs get **only AERO
emissions**. So harvest claims **AERO from the gauge**, nothing else. `pool.claimFees()` would
return ~0 for the vault because the vault doesn't hold the LP tokens (the gauge does).

Steady state: the vault holds zero unstaked LP; all LP sits in the gauge under the vault's address.

```
harvest(minOut...)  // onlyKeeper
1. gauge.getReward(address(this))        // gauge 0x519B…C025 → AERO sent to vault
                                          // (only callable by account itself or Voter)
2. aero = AERO.balanceOf(this); if (aero < minHarvest) return;
3. take performance fee in AERO (if any) → treasury
4. Router.swapExactTokensForTokens: AERO → USDC
      route: AERO/USDC vAMM 0x6cdc…971d ($36.5M TVL), amountOutMin from keeper (off-chain quote)
5. Swap the right part of USDC → WETH so both sides match the pool ratio
      (route via the deepest WETH/USDC pool, amountOutMin enforced)
6. Router.addLiquidity(WETH, USDC, stable=false, ..., amountAMin, amountBMin, this, deadline)
7. gauge.deposit(lpBalance)               // restake; returns leftover dust to the idle balance
8. emit Harvested(aero, usdcOut, lpAdded)
```

Notes:
- Emissions flow per second throughout the epoch. `getReward` can be called anytime; nothing to
  claim at epoch boundaries. The epoch rolls every Thursday 00:00 UTC (current `periodFinish` =
  1790208000 = 2026-09-24 00:00 UTC). After that, the rate is reset from votes.
- Do all slippage checks with keeper-supplied mins. No onchain spot price as oracle (sandwich risk).
- If `Voter.isAlive(gauge)` goes false (gauge killed), emissions stop. Harvest must not revert.
  Keep an admin path to unstake and exit.
- Deposit path: USDC → swap part to WETH → `addLiquidity` → `gauge.deposit`.
  Withdraw path: `gauge.withdraw` → `removeLiquidity` → swap WETH → USDC.
  Both with user-supplied min-outs.

## 3. What the position earns (realistic)

### Gross, to staked LPs (the vault)
- Emissions: 0.029588 AERO/s × 31.536M s ≈ **933k AERO/yr**.
- AERO price ≈ $0.696 (from AERO/USDC vAMM reserves: 18.16M USDC / 26.09M AERO).
- ≈ $649k/yr over ≈ $8.99M staked TVL → **≈ 7.2% APR, paid in AERO**.
- Weekly compounding → ≈ 7.5% APY. Compounding adds little; don't over-harvest.

### Not earned by the vault
- Trading fees: $416k/day × 0.30% ≈ $1.25k/day ≈ $455k/yr ≈ 5.0% of TVL.
  **Goes to veAERO voters**, not to staked LPs. Do not add it to our APR.

### Costs / drags
| Drag | Size |
|---|---|
| Entry swap (~half of deposit USDC→WETH) | ~0.15% of deposit in pool fees if routed via this 30 bps pool; ~0.03% via 5 bps pool; + price impact |
| Exit swap (WETH→USDC) | same again |
| AERO sale at harvest | 0.3% fee + small impact (~$12k/week of AERO into a $36M pool, if we were the whole gauge; far less for us) |
| AERO price | APR is in AERO; if AERO drops 30%, APR drops 30% |
| Emissions | change weekly with votes (pool has only ~0.44% of votes); can go to ~0 |
| Dilution | our deposit grows staked TVL → lowers APR for everyone incl. us |
| IL + 50% ETH exposure | see §1; in a big ETH move this dominates the 7% |
| Keeper gas | small on Base (cents per harvest) |

### Example: $10k deposit, one year, ETH flat, AERO flat
- AERO earned ≈ $720 (~$14/week to harvest).
- Minus entry+exit swaps ≈ $10–35, AERO sell cost ≈ $2–3, performance fee (if any).
- **Net ≈ 6.5–7%**. Real result = mostly ETH price move ± that.

## Open questions
1. OK with 50% ETH exposure, or do we want a stable-pair vault (lower depth, depeg risk)?
2. Performance fee: yes/no, what %?
3. Harvest cadence: weekly, or when claimable AERO > threshold?
4. Deposit/withdraw swaps: route via the 30 bps pool itself (simple) or the 5 bps Slipstream pool (cheaper, more code)?
5. Before code: fork test the full deposit → harvest → withdraw flow, plus killed-gauge and
   high-slippage failure cases.
