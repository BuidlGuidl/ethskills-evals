# Aerodrome USDC/WETH Yield Vault — Design

## TL;DR

- Vault stakes its LP tokens in the pool's **Gauge** to earn **AERO emissions**.
- `harvest()` claims **only AERO**, from the **Gauge** (`gauge.getReward(address(this))`).
- **Staked LPs give up swap fees.** On Aerodrome, fees earned by gauge-staked
  liquidity go to **veAERO voters** who voted for this pool, not to the vault.
  So the vault earns emissions, not fees.

## Assumptions

- Pool: Aerodrome **basic volatile pool** `vAMM-WETH/USDC` (`stable = false`).
  (A Slipstream concentrated-liquidity version works the same way re: fees/emissions,
  but uses NFT positions and `CLGauge.getReward(tokenId)`; out of scope here.)
- Chain: Base.

| Contract | How to get the address |
|---|---|
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| WETH | `0x4200000000000000000000000000000000000006` |
| AERO | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` |
| PoolFactory | `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` |
| Router | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` |
| Voter | `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5` |
| Pool | `PoolFactory.getPool(USDC, WETH, false)` |
| Gauge | `Voter.gauges(pool)` — check `Voter.isAlive(gauge)` |

Verify all addresses against Aerodrome's official docs/repo before deploy.
Resolve pool and gauge on-chain in the constructor, don't hardcode.

## Deposit / withdraw (context)

1. `deposit`: user sends USDC + WETH (or single asset, vault zaps) → vault calls
   `Router.addLiquidity(USDC, WETH, false, ...)` → gets LP → `gauge.deposit(lp)`.
   Mint shares pro rata to LP owned.
2. `withdraw`: burn shares → `gauge.withdraw(lp)` → `Router.removeLiquidity(...)`
   → send USDC + WETH to user.

Accounting unit = LP tokens staked in gauge (`gauge.balanceOf(vault)`).

## harvest() flow

Called by keeper. Per-step:

1. **Claim AERO from the Gauge**
   `gauge.getReward(address(this))`
   - Gauge only lets `msg.sender == account` (or the Voter) claim, so the vault
     itself must call it.
   - Returns AERO only. No USDC/WETH comes back here.
   - Do **not** call `pool.claimFees()`: the vault holds no LP directly (gauge
     holds it), so there is nothing to claim. The gauge claims those fees
     itself — see "Where swap fees go".
2. **Take performance fee** in AERO (e.g. X% to treasury). Keep optional keeper tip.
3. **Swap AERO → USDC and WETH** via Router, split so the proceeds match the
   pool's current reserve ratio (`pool.getReserves()`).
   - Routes: `AERO → USDC` (volatile), then part `USDC → WETH` via the vault pool
     itself or a direct `AERO → WETH` route — pick deepest liquidity.
   - **`amountOutMin` from an oracle** (Chainlink ETH/USD on Base + AERO price
     source / TWAP), not from `getAmountsOut` at execution time — otherwise a
     sandwich can drain the harvest. Keeper may also pass `minOut` params, checked
     against the oracle bound.
4. **Add liquidity**: `Router.addLiquidity(USDC, WETH, false, amtA, amtB, minA, minB, vault, deadline)`.
   Leftover dust stays in vault and gets used next harvest.
5. **Stake new LP**: `gauge.deposit(newLp)`.
6. Emit `Harvest(aeroClaimed, feeTaken, lpAdded)`. Share price rises since
   shares unchanged and LP increased.

Guards: `nonReentrant`, keeper allowlist (or permissionless + oracle-bounded
slippage), skip swaps if AERO balance below a min threshold (gas vs. value).

### Harvest frequency

Emissions stream continuously during the weekly epoch (`gauge.rewardRate`,
epoch flips Thursday 00:00 UTC). Gas on Base is cheap, so the limit is swap
cost/slippage, not gas. Daily is a sensible default; tune by TVL.

## What the position actually earns

| Source | Vault gets it? | Notes |
|---|---|---|
| AERO emissions | **Yes** | Only real income. Via `gauge.getReward`. |
| Pool swap fees (USDC/WETH) | **No** | Go to veAERO voters (FeesVotingReward). |
| Bribes / incentives | **No** | Go to veAERO voters (BribeVotingReward). |
| Price exposure (ETH) | Yes (risk) | ~50% ETH, 50% USDC by value. |
| Impermanent loss | Yes (cost) | Volatile x·y=k pair. |

### Emissions APR (the income side)

```
emissionsAPR ≈ (gauge.rewardRate × 365 days × AERO price) / (gauge.totalSupply × LP price)
```

Vault's share scales with `vaultStake / gauge.totalSupply`. Drivers:
- **Votes**: each epoch, veAERO voters decide how much AERO the gauge gets.
  Vote share can shift a lot week to week → APR is not stable.
- **AERO price**: income is paid in AERO; value realized only at swap time.
- **Dilution**: more LP staked in the same gauge → lower APR for everyone.

### Realistic net yield

```
net ≈ emissionsAPR
      − performance fee (on harvest)
      − swap costs selling AERO (pool fees + slippage + MEV leakage)
      − impermanent loss (vs. holding 50/50)
      − gas (small on Base)
```

Key point: because staked LPs **don't get swap fees**, nothing offsets IL
except AERO. In a big ETH move IL can exceed several weeks of emissions.
Quote APR on the dashboard as "emissions APR, before IL", and track realized
performance vs. a 50/50 hold benchmark.

Pull live numbers (`rewardRate`, `totalSupply`, reserves, AERO price) for the
estimate; don't hardcode an APR figure in docs or UI.

## Where the pool's swap fees end up

1. Traders pay a fee on every swap in the pool (fee rate set per-pool in
   PoolFactory; read `PoolFactory.getFee(pool, false)`).
2. Fees accrue to LP token holders. The biggest holder is the **Gauge** (it
   custodies every staked LP, including ours).
3. When the Voter distributes emissions each epoch, the gauge calls
   `pool.claimFees()` for its LP position and forwards the USDC/WETH to the
   pool's **FeesVotingReward** contract.
4. veAERO holders who **voted for this pool** that epoch claim those fees
   (pro rata to their votes).

So in this design **the vault's share of swap fees goes to veAERO voters**, not
to vault depositors. That is Aerodrome's trade: LPs swap fees for emissions;
voters direct emissions to earn fees + bribes.

### Options if we want fees back (not in v1)

- **Don't stake**: hold LP in the vault, call `pool.claimFees()` in harvest →
  earn USDC + WETH fees but **zero AERO**. Usually worse, since emissions on
  major pools are normally set well above fee APR (that's why voters vote for them).
- **Lock part of the AERO as veAERO** and vote for this pool → recapture some
  fees + bribes. Adds lock-up (up to 4 years), governance ops, and a less liquid
  asset in the vault. Possible v2.

## Risks

- Emissions/vote share drops → APR drops fast.
- AERO price drawdown between harvests.
- Sandwich/MEV on harvest swaps (mitigated by oracle `minOut`).
- Gauge killed (`Voter.isAlive == false`) → emissions stop; vault should allow
  unstake + hold LP (and then claim fees directly).
- IL on ETH moves, not offset by fees.

## Open questions

- Keeper permissioned or permissionless with oracle bounds?
- Performance fee %?
- Accept single-asset deposits (zap) or require both tokens?
- AERO price source for `minOut` (TWAP on AERO/USDC pool vs. external feed)?
