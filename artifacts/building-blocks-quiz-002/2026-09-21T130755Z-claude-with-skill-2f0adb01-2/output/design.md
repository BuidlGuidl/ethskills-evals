# Aerodrome USDC/WETH Auto-Compounding Vault — Design

## TL;DR

- Vault stakes its LP tokens in the pool's **Gauge**. Staked LP earns **AERO emissions only**.
- `harvest()` claims **AERO from the Gauge** (`gauge.getReward`). Nothing is claimed from the pool.
- The pool's **swap fees do not go to the vault**. When LP is staked in the gauge, the gauge collects the fees and forwards them to **veAERO voters** (via the gauge's `FeesVotingReward` contract).
- This is the opposite of Uniswap: on Aerodrome, LPs earn emissions, voters earn fees.

## Context: how Aerodrome pays LPs

Aerodrome (now branded **Aero** after the Nov 2025 Aerodrome/Velodrome merge — same contracts, same ve(3,3) model) splits value like this:

| Who | Earns |
|---|---|
| LPs who **stake** LP tokens in the gauge | AERO emissions |
| LPs who **don't stake** | Their share of swap fees (via `pool.claimFees()`), no AERO |
| veAERO voters (locked AERO) | 100% of fees from staked liquidity + bribes, for the pools they vote for |

Emissions per pool are set weekly (epochs flip Thursday 00:00 UTC) by veAERO votes through the `Voter` contract. More votes → more AERO to that pool's gauge.

**Choice for this vault: stake.** On the main USDC/WETH pool the emissions APR is normally well above the fee APR (that's the whole point of the flywheel — votes chase fees, emissions follow votes). Unstaked LP gives up emissions to keep fees; not worth it for this pair. Revisit if that ever flips.

## Contracts

Resolve on-chain at deploy time rather than hardcoding pool/gauge — verify on Basescan before mainnet.

| What | How to get it / address (Base) |
|---|---|
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| WETH | `0x4200000000000000000000000000000000000006` |
| AERO | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` |
| Router | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` |
| PoolFactory | `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` |
| Voter | `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5` |
| Pool | `PoolFactory.getPool(USDC, WETH, false)` (volatile vAMM pool) |
| Gauge | `Voter.gauges(pool)` — also check `Voter.isAlive(gauge)` |

Note: Base also has **Slipstream** (concentrated liquidity) USDC/WETH pools, which carry much of the volume. They use NFT positions, a different gauge (`CLGauge`) and need range management. This design targets the **vAMM (v2-style) pool** for simplicity. Same fee/emission split applies to Slipstream.

## Deposit / withdraw

ERC-4626 vault. Asset choice: the **LP token** (simplest, no swaps on deposit) with an optional zap for USDC/ETH.

- `deposit`: take LP → `gauge.deposit(amount)`.
- `withdraw`: `gauge.withdraw(amount)` → send LP to user.
- `totalAssets()` = `gauge.balanceOf(address(this))` + idle LP. Denominated in LP, so no price oracle needed for share accounting. (If you later denominate in USDC, value LP with fair-reserve pricing from an oracle, never spot reserves — flash-loan manipulable.)

## `harvest()` flow

Keeper-only (or permissionless with a caller bounty and oracle-bounded `minOut`s).

1. **Claim AERO from the Gauge**
   `gauge.getReward(address(this))` → vault receives AERO.
   This is the only claim. There is no fee claim: the vault's LP is held by the gauge, so the pool's fee accounting credits the gauge, not the vault.
2. **Take protocol fee** (e.g. X% of AERO to treasury) — optional.
3. **Swap AERO → USDC and WETH**
   `Router.swapExactTokensForTokens` with routes like `AERO→USDC (volatile)` and `AERO→WETH (volatile)`, or AERO→USDC then half USDC→WETH through the target pool. Split so the ratio matches pool reserves (`pool.getReserves()`), to avoid leftover dust.
   `amountOutMin` from a TWAP/Chainlink check, **not** a router quote in the same tx (sandwichable).
4. **Add liquidity**
   `Router.addLiquidity(USDC, WETH, false, amtUSDC, amtWETH, minUSDC, minWETH, address(this), deadline)` → LP tokens.
5. **Re-stake**
   `gauge.deposit(lpAmount)`.
6. Emit `Harvest(aeroClaimed, lpAdded)`. Share price rises since `totalAssets` grew with no new shares.

Harvest cadence: gauge streams rewards linearly across the epoch (`rewardRate`), so claim anytime. Gas on Base is cents, so daily harvest is fine; the real cost is swap slippage/price impact on AERO, not gas. Skip harvest if `gauge.earned(address(this))` is below a threshold.

## What the position actually earns

```
gross yield = AERO emissions to the gauge × (vault stake / total gauge stake) × AERO price
```

Components:

| Source | Goes to vault? | Notes |
|---|---|---|
| AERO emissions | **Yes** | Only income. Varies weekly with votes and with AERO price. |
| Swap fees (vAMM fee, e.g. ~0.3% volatile tier; set per pool in factory) | **No** | Go to veAERO voters. |
| Bribes | **No** | Go to voters. |
| Price moves of USDC/WETH | Exposure | Vault holds ~50/50 USDC/WETH, so it's half-long ETH. |

Costs that reduce the headline APR shown in the Aerodrome UI:

- **Impermanent loss** (value lost vs just holding, when ETH price moves). For a 50/50 constant-product pool: ~0.6% at ±25% ETH move, ~2% at ±50%, ~5.7% at 2x. Often eats a large share of emissions in volatile months.
- **AERO sell pressure / price decay.** Emissions are inflationary; every farm sells AERO. The UI APR assumes today's AERO price.
- **Swap slippage** selling AERO each harvest (small if harvests are frequent and routes are deep).
- **Dilution**: more LPs staking in the gauge shrink the vault's share of fixed weekly emissions. Big TVL in the vault itself also dilutes its own APR.
- **Vault performance fee.**
- Keeper gas — negligible on Base.

Illustrative (not a quote — pull live numbers from the Aerodrome UI / DefiLlama before publishing):

```
Headline emissions APR (UI)         20%
- AERO slippage / sell timing       -1%
- performance fee (10%)             -2%
- IL (moderate ETH vol year)        -3% to -8%
≈ net vs holding 50/50               ~9%–16%, highly variable week to week
```

Don't market the UI APR as the vault's yield. Show trailing realized share-price growth instead.

## Where the swap fees end up

Path of a swap fee on this pool, with the vault's LP staked:

1. Trader swaps on the pool → fee is taken in the input token and accrued in the pool's fee accounting (held separately in a `PoolFees` contract, not added to reserves).
2. Fees are credited per LP token holder. The **Gauge** holds the staked LP, so the Gauge is credited.
3. Gauge calls `pool.claimFees()` (triggered on `notifyRewardAmount` when the Voter distributes emissions each epoch, or via `gauge.claimFees()`).
4. Gauge forwards them to its **`FeesVotingReward`** contract.
5. **veAERO voters** who voted for this pool claim them the following epoch, pro rata to votes.

So the vault earns **zero** of the fees its liquidity generates. That's by design in ve(3,3): fees pay voters, voters direct emissions, emissions pay LPs.

**Optional upgrade (out of scope for v1):** have the vault lock part of its AERO as veAERO and vote for the USDC/WETH gauge. It then recaptures a share of fees + bribes and boosts emissions to its own pool. Costs: 4-year max lock, illiquid, governance/vote-management overhead each epoch.

## Risks / guardrails

- Gauge can be killed (`Voter.killGauge`) → emissions stop. Check `isAlive` in harvest; allow emergency `gauge.withdraw` to idle LP.
- Sandwiching of AERO swaps and `addLiquidity` → oracle-bounded mins, keeper via private mempool if needed.
- First-depositor share inflation (ERC-4626) → virtual shares/offset (OZ default) or seed deposit.
- Composability risk: Aerodrome contract or AERO token issues flow straight to the vault.

## Unresolved questions

- Vault asset: LP token (simple) or USDC with zap (better UX, needs oracle pricing)?
- vAMM pool vs Slipstream CL pool? CL earns more per $ but needs range rebalancing.
- Performance fee %, harvest permissionless vs keeper-only?
- veAERO voting (fee recapture) in v1 or later?
