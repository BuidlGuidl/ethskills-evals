# USDC Yield Vault on Base — Design

## TL;DR

- LP into an **Aero (formerly Aerodrome) basic stable pool**: USDC paired with another USD stablecoin, **staked in that pool's gauge** (the contract that pays out rewards to staked LP tokens).
- `harvest()` claims **AERO emissions from the Gauge** (`gauge.getReward(address(this))`). It does **not** claim trading fees. Staked LP positions don't earn trading fees on Aero.
- Nearly all yield comes from AERO emissions, paid in a volatile token and set by weekly votes. Trading fees add nothing, because we stake. Treat the APR as variable and possibly temporary.

---

## 1. Which pool, and why

### Venue: Aero, not Uniswap

Aero (Aerodrome and Velodrome merged under Dromos Labs in Nov 2025, same contracts) is the dominant DEX on Base. Its incentive model is the opposite of Uniswap's, and that shapes the whole vault:

| | Unstaked LP | Staked LP (in gauge) |
|---|---|---|
| Trading fees | yes, to LP | **no**, fees go to veAERO voters |
| AERO emissions | no | **yes** |

On a stablecoin pool, emissions are usually far larger than fees. So the vault stakes and gives up fees.

### Pool type: basic stable pool (sAMM), not Slipstream (concentrated liquidity) and not volatile (vAMM)

- **Stable/stable pair**: the vault's asset is USDC, so pairing with another USD stablecoin keeps impermanent loss (value lost vs. just holding, when prices move apart) near zero, unless one stablecoin depegs.
- **Basic pool, not Slipstream CL**: basic pools use fungible ERC-20 LP tokens and have no price range to manage. That means no rebalancing logic, no NFT handling, and no out-of-range periods with zero yield. Slipstream can earn more per dollar but needs active range management. That's too much for v1.
- **Not a volatile pair (e.g. WETH/USDC)**: impermanent loss on ETH moves would outweigh emissions for a USDC-denominated vault.

### Picking the specific pool (at deploy time, not hardcoded from memory)

Candidates: `sAMM-USDC/USDT`, `sAMM-USDC/USDbC` (USDbC = legacy bridged USDC, being phased out, so avoid if its liquidity is shrinking), or similar USDC/USD-stable pairs. Choose using on-chain checks:

1. `PoolFactory.getPool(USDC, X, true)` returns a pool
2. `Voter.gauges(pool)` returns a gauge, and `Voter.isAlive(gauge) == true`
3. Highest sustainable emission APR (see §3), based on several past epochs, not one
4. Deep TVL, so the vault's deposits don't dilute APR much or cause entry/exit slippage
5. Paired stable has a credible peg and issuer

Make the pool/gauge **immutable per vault**. To migrate, deploy a new vault instead of adding a `setPool` admin function.

### Addresses (Base, must re-verify on basescan before deploy)

| Contract | Address |
|---|---|
| USDC (native) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| AERO | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` |
| Router | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` |
| PoolFactory | `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` |
| Voter | `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5` |
| Pool / Gauge | resolved at deploy via factory + `Voter.gauges(pool)` |

---

## 2. Flows

### deposit (ERC-4626)

1. Pull USDC from the user.
2. Swap part of the USDC into token X, sized to the pool's current ratio (for stable pools this isn't exactly 50/50). Enforce `minOut`.
3. `Router.addLiquidity(USDC, X, true, ...)` → LP tokens.
4. `Gauge.deposit(lpAmount)`.

Deposits can also be batched: keep USDC idle and deploy it in `harvest()` to save gas and slippage for small deposits.

### harvest() — exact flow

Keeper-only (or permissionless with a caller bounty; decide later).

```
1. gauge.getReward(address(this))
     - contract: the pool's Gauge (from Voter.gauges(pool))
     - claims: AERO only (gauge.rewardToken())
     - must be called by the account itself (or the Voter); the vault calls it for itself
     - does NOT claim trading fees; staked LP earns none
2. aero = AERO.balanceOf(this)
   if aero < minHarvest: return            // don't burn gas/slippage on dust
3. take performance fee (in AERO or post-swap USDC) → treasury
4. Router.swapExactTokensForTokens(aero, minOut, [AERO→USDC route], this, deadline)
     - minOut from an oracle/TWAP price minus a slippage cap, NOT from spot
     - route: AERO/USDC volatile pool (deepest AERO liquidity is on Aero itself)
5. swap part of USDC → X, Router.addLiquidity(...)   // same as deposit
6. gauge.deposit(newLp)
7. emit Harvested(aeroClaimed, usdcOut, lpAdded, fee)
```

Notes:
- `gauge.earned(address(this))` is a view function the keeper uses to decide when harvesting is worth it.
- Do **not** call `pool.claimFees()`. The gauge holds the LP, so the vault accrues no fees. Calling it just wastes gas.
- Emissions stream continuously, with a new rate each weekly epoch (starting Thursday 00:00 UTC). Harvesting more than once a day or so brings no benefit on a small vault. Pick the harvest interval so that gas + slippage stay under ~1% of the harvested value.

### withdraw / redeem

`Gauge.withdraw(lp)` → `Router.removeLiquidity` → swap X → USDC (with `minOut`) → send to user. Unclaimed AERO stays in the vault for everyone. It is not paid to the withdrawer.

### totalAssets()

Value LP in USDC **without using spot reserves or a spot swap quote**, because both can be moved within one transaction (flash-loan share-price manipulation). For a stable/stable pool: `lpBalance * (reserveUSDC + reserveX) / lpSupply`, pricing X at 1:1, plus a depeg circuit breaker from a Chainlink feed that pauses deposits if X drifts beyond a threshold. Unharvested AERO is excluded, which is conservative.

---

## 3. What the position actually earns

### Sources

| Source | Vault gets it? | Notes |
|---|---|---|
| Trading fees | **No** | Go to veAERO voters because we stake. Stable-pool fees are only a few bps anyway. |
| AERO emissions | **Yes** | Essentially 100% of gross yield |
| Bribes / voting fees | No | Only for veAERO lockers. The vault holds no veAERO. |
| Base-token yield | No | USDC is not yield-bearing |

### Computing emission APR (on-chain, no guessing)

```
grossAPR = gauge.rewardRate() * 31_536_000 * priceAERO
           / (gauge.totalSupply() * lpPriceUSD)
```

`rewardRate` resets every epoch based on votes for this gauge. `totalSupply` counts only **staked** LP, not the whole pool.

### Illustrative breakdown (example numbers, not a forecast)

Suppose the dashboard shows 10% APR on the chosen stable pool:

| Item | Effect on APR |
|---|---|
| Shown emission APR | +10.0% |
| AERO→USDC sale slippage + swap fees | −0.1 to −0.3% |
| Zap (USDC→X split) and exit swaps | −0.05 to −0.1% (one-off per deposit/withdraw) |
| Keeper gas on Base | negligible at scale (cents per tx); matters for vaults under ~$50k |
| Performance fee (e.g. 10% of harvest) | −1.0% |
| **Net to depositors** | **≈ 8.5–8.8%**, *if* the rate holds |

What makes this move, roughly in order of size:

1. **AERO price.** Rewards are counted in AERO. If AERO drops 30% between harvests, that period's yield drops 30%. Frequent harvests limit this exposure.
2. **Votes.** veAERO voters can move emissions away from our gauge in any epoch. Stable pools usually get fewer votes than high-fee volatile pools, so the rate can fall sharply week to week.
3. **Dilution.** Our own deposits (and other LPs') increase gauge `totalSupply` and lower the APR.
4. **Emission schedule.** Total AERO emissions change over time under protocol rules/governance, not something we control.
5. **Depeg** of the paired stable is the main principal risk. Impermanent loss is otherwise ~0.

Headline dashboard APRs on stable pools often run above what's sustainable. Size expectations from **trailing multi-epoch realized APR**, and describe the product to users as variable, emission-driven yield, never as "fees" or "fixed".

---

## Risks / guardrails

- Dependencies: Aero pool, gauge, router, Voter, USDC, paired stable. A bug in any of them affects the vault.
- Every swap has a `minOut` based on an oracle, not spot. Add a `deadline` to all router calls.
- Pausable deposits. Withdrawals always open (emergency path: `gauge.withdraw` → return LP or tokens pro rata).
- Start with a deposit cap. Raise it after the vault has run for a while.
- Handle the gauge being killed (`Voter.isAlive == false`): stop harvesting, allow exits.

## Open questions

1. Keeper-only `harvest()` or permissionless with a caller bounty?
2. Performance fee %, and whether to take it in AERO or USDC?
3. Which paired stable (USDT vs other), decided from live gauge data at deploy?
4. Accept the extra complexity of Slipstream CL for higher APR in a v2?
5. Batch deposits (idle USDC until harvest) or zap on every deposit?
