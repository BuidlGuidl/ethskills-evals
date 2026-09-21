# Aerodrome USDC/WETH Yield Vault — Design

## TL;DR

- The vault **stakes** its LP in the pool's Aerodrome **Gauge**. That's the only way to earn AERO emissions.
- `harvest()` claims **one thing: AERO**, from **the Gauge** (`gauge.getReward(address(this))`). It does not claim swap fees.
- A staked position **does not earn the pool's swap fees**. Aerodrome sends those fees to veAERO voters who voted for this pool, not to LPs.
- So the vault's yield is **AERO emissions only**. Then subtract impermanent loss / LVR (losses to arbitrage traders), the cost of selling AERO, and the performance fee.

This is the core ve(3,3) trade on Aerodrome: **LPs get emissions, voters get fees.** You pick one. Staking means emissions.

---

## 1. Which pool

Aerodrome has two kinds of USDC/WETH pools on Base:

| Type | Pool | LP token | Gauge |
|---|---|---|---|
| Basic (v2, Solidly-style) | `vAMM-WETH/USDC` (volatile, x·y=k) | fungible ERC20 | `Gauge` |
| Slipstream (concentrated liquidity, "CL") | `CL-WETH/USDC` (tick spacings e.g. 100) | NFT from `NonfungiblePositionManager` | `CLGauge` |

**v1 of this vault targets the basic `vAMM` pool**: LP token is fungible, no price ranges to manage, and the share math is simple. Slipstream (where most WETH/USDC liquidity actually sits) is covered in §6 as a later option. The fee/emission rules below apply to both types.

Contracts (Base mainnet, **check against Aerodrome docs before deploying**):

| | Address |
|---|---|
| AERO | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| WETH | `0x4200000000000000000000000000000000000006` |
| Router | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` |
| Voter | `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5` |
| Pool | `PoolFactory.getPool(USDC, WETH, false)` |
| Gauge | `Voter.gauges(pool)` — read on-chain, don't hardcode |

At init, check `Voter.isAlive(gauge) == true`. A gauge can be killed, and a killed gauge gets no emissions.

---

## 2. Deposit / withdraw (context for harvest)

- **deposit**: user sends USDC + WETH (or one token, which gets swapped into the right mix) → `router.addLiquidity(USDC, WETH, false, ...)` → `gauge.deposit(lp)` → mint vault shares.
- **withdraw**: `gauge.withdraw(lp)` → `router.removeLiquidity(...)` → send tokens to user → burn shares.
- `totalAssets()` = LP balance staked in the gauge + any idle LP in the vault.
- Harvest before large deposits/withdrawals (or charge a deposit lock/fee). Otherwise someone can deposit just before a harvest and grab a share of rewards they didn't earn.

---

## 3. `harvest()` flow

Called by the keeper. Each step says **which contract** it touches.

```
harvest(minOutUsdc, minOutWeth)           // onlyKeeper, nonReentrant
 1. gauge.getReward(address(this))          → Gauge: sends earned AERO to the vault
 2. aero = AERO.balanceOf(this)
    if aero < minHarvest: return            // not worth the gas/slippage
 3. fee = aero * perfFeeBps / 1e4
    AERO.transfer(treasury, fee)            // performance fee, taken in AERO
 4. swap AERO → USDC and WETH               → Router (AERO/USDC and/or AERO/WETH pools)
      - split so the result matches the pool's reserve ratio (≈50/50 by value in a vAMM)
      - enforce minOut from an oracle / TWAP, NOT from spot price
 5. router.addLiquidity(USDC, WETH, false, ...)  → Pool: mints new LP
 6. gauge.deposit(newLp)                    → Gauge: new LP starts earning emissions
 7. emit Harvested(aero, fee, newLp)
```

### What it claims

| Reward | Claimed? | From |
|---|---|---|
| AERO emissions | **Yes** | `Gauge.getReward(address(this))` |
| Swap fees (USDC + WETH) | **No** — the vault doesn't own them (see §5) | — |
| Bribes / voting rewards | **No** — those go to veAERO voters, and the vault doesn't vote | — |

Notes:
- `getReward` can only be called by `account` itself or by the Voter. The vault must call it directly for its own address.
- Don't call `pool.claimFees()` in harvest. The vault's LP is held by the gauge, so the vault's fee balance in the pool is ~0. The only exception is dust LP that sits unstaked for a moment between steps 5 and 6.
- Emissions stream to the gauge each **epoch** (1 week, rolls over Thursday 00:00 UTC) and pay out block by block (`rewardRate`). Harvesting once or twice a day is plenty. Compounding more often gains little and pays more in swap fees.
- **Slippage/MEV**: step 4 is the main attack surface. The keeper passes `minOut` values, and the contract also checks them against an oracle bound (Chainlink ETH/USD plus an AERO TWAP). This way a compromised or buggy keeper can't be sandwiched for the whole harvest. Sending the tx through a private RPC is a nice extra.

---

## 4. What the position actually earns

Per unit of vault TVL:

```
net yield ≈ AERO emission APR
          − impermanent loss / LVR
          − AERO sell costs (swap fee + slippage + price drift between harvests)
          − performance fee
          − gas (small on Base)
          + 0 swap fees
```

### 4.1 AERO emissions (the only income)

```
emission APR = (gauge rewardRate × 1 year × AERO price) / (USD value of all LP staked in the gauge)
```

- `rewardRate` is set **each week** by how many veAERO votes the pool gets. It is not fixed. If votes (or bribes pulling votes) move to other pools, the APR drops the next epoch with no warning.
- The denominator is **staked** TVL. When more LPs stake, everyone's APR goes down.
- Paid in AERO. AERO's USD price swings a lot, and the vault sells it right away, so the APR it actually gets is whatever AERO is worth at harvest time.
- Total AERO emissions change each week based on protocol rules and veAERO votes, so don't project today's APR into the future.
- Rough scale: blue-chip pairs like WETH/USDC usually show a double-digit headline APR in the Aerodrome UI. **Read the live `rewardRate` and TVL from chain when making forecasts. Don't hardcode an APR.**

### 4.2 Swap fees: 0

The pool charges traders a fee (vAMM default ~0.3%, set per pool by the factory). The vault's staked LP gets **none** of it. See §5.

### 4.3 Costs

- **Impermanent loss / LVR**: a volatile x·y=k position in ETH/USD loses value to arbitrage traders every time ETH moves. Unstaked LPs cover this loss with swap fees. This vault has no swap fees, so **emissions alone have to cover it**. In a big ETH move, IL can wipe out weeks of emissions.
- **AERO → USDC/WETH conversion**: router swap fees (~0.05–0.3% depending on the route) plus price impact. Small per harvest, but you pay it on every harvest.
- **Performance fee**: e.g. 5–10% of harvested AERO.
- **Gas**: cents per harvest on Base. Not a real constraint.

### 4.4 Honest example (numbers are made up, just to show the math)

| Item | APR |
|---|---|
| AERO emissions (headline) | 20% |
| − performance fee (10%) | −2% |
| − conversion cost | −0.3% |
| − IL (strongly depends on ETH volatility) | −3% to −15%+ |
| Swap fees | 0% |
| **Net vs. just holding 50/50 USDC/WETH** | **~0% to ~15%** |

The frontend should show "emission APR" and "net vs. hold" as two separate numbers. Headline APR alone overstates the real return.

---

## 5. Where the swap fees go

Aerodrome (like Velodrome v2) splits it this way:

1. A trader swaps in the USDC/WETH pool and pays the swap fee.
2. The fee builds up for **whoever holds the LP tokens**. While the vault's LP is staked, **the Gauge holds it**, so the fees build up for the Gauge.
3. The Gauge claims them (`pool.claimFees()` inside the gauge) and sends them to the pool's **`FeesVotingReward`** contract (`Voter.gaugeToFees(gauge)`) as rewards for the current epoch.
4. **veAERO holders who voted for this pool** that epoch claim those fees (after the epoch ends), in proportion to their votes. Bribes (`BribeVotingReward`) are paid out to the same people.

So in this design the pool's swap fees go to **veAERO voters, not to the vault or its users.** That's the price of receiving emissions.

Slipstream has the same rule: fees from staked CL positions go to the gauge → voting rewards. Slipstream also takes an extra cut of fees from **unstaked** CL liquidity (`unstakedFee`) and sends that to the gauge too.

### Ways to get fees back (not in v1)

- **Don't stake**: earn swap fees (claim with `pool.claimFees()`), give up AERO. Only worth it if fee APR > emission APR, which for a volatile ETH/USD pool is rarely true after IL. Could be a mode the vault switches between, based on live data.
- **Lock part of the harvested AERO as veAERO and vote for this pool**: the vault then gets back its share of the fees + bribes via `FeesVotingReward`/`BribeVotingReward`. This adds more to manage (4-year lock, weekly votes, handling many different bribe tokens). Consider for v2.

---

## 6. Slipstream (CL) variant — later

If we move to the CL pool (deeper liquidity, more emissions per dollar while price is in range):

- The position is an NFT. Stake it with `CLGauge.deposit(tokenId)`. Harvest with `CLGauge.getReward(tokenId)` (claims AERO for that NFT).
- Compound with `CLGauge.increaseStakedLiquidity(tokenId, ...)`. No need to unstake.
- **Emissions only go to liquidity that is in range.** An out-of-range position earns 0. The vault then needs rebalancing logic (range width, when to rebalance, rebalance swap costs). This is the main extra complexity and the main new risk.
- Concentrated positions have more IL per dollar than a full-range vAMM position.

---

## 7. Risks checklist

- Gauge killed / votes move elsewhere → emissions go to ~0. Watch `isAlive` and `rewardRate`. Deposits stay withdrawable no matter what.
- Sandwich attacks during AERO swaps → oracle-bounded `minOut`.
- Someone deposits right before a harvest to grab rewards they didn't earn → harvest on deposit, or lock/fee.
- Vault-share inflation attack (first depositor manipulates share price) → virtual shares / dead shares at init.
- Keeper key compromise → the keeper can only call `harvest` with bounded params. It can never move funds anywhere else.
- Aerodrome contract upgrades / new gauge per pool → admin can re-point to a new gauge (with a timelock).

---

## Open questions

1. vAMM (simple) or Slipstream CL (higher yield, needs rebalancing) for v1?
2. Performance fee % and treasury address?
3. Deposit format: both tokens, single-sided, or both?
4. Should v2 lock AERO as veAERO and vote to get fees/bribes back, or keep selling all AERO?
5. Harvest cadence/threshold — who runs the keeper (Gelato, Chainlink Automation, in-house)?
