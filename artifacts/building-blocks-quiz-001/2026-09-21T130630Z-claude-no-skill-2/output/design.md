# USDC Yield Vault on Base — Design

Status: draft, pre-code. Addresses below are the known Aerodrome/Base deployments — **re-check each one on Basescan before deploying**.

## 1. Pool choice

**Venue: Aerodrome, v2 "basic" pools (not Slipstream CL).**

Why Aerodrome:
- Biggest DEX on Base by TVL and volume; gauges pay AERO emissions, which is the main yield source (see §3).
- Mature, audited Velodrome-v2 fork; simple, well-known interfaces (`Router`, `Pool`, `Gauge`, `Voter`).

Why a v2 pool, not Slipstream (concentrated liquidity):
- v2 LP is a plain ERC20 → vault accounting = share of one token balance. No NFT positions, no range rebalancing, no out-of-range periods.
- CL gets more emissions per $ when in range, but needs an active rebalancer. Too complex for a "small" vault. Revisit later.

**Pool: a stable (`sAMM`) pool of USDC paired with another USD stablecoin.**

Why stable/stable:
- Users deposit USDC and expect a USD-denominated result. A volatile pair (e.g. `vAMM-WETH/USDC`) adds real impermanent loss (loss from price moves between the two tokens) that can easily exceed the yield.
- Zap-in (swap half of USDC to the other token) is near-free on a stable curve.

Picking the exact counterpart token — must pass all of:
1. Gauge exists and is alive: `Voter.gauges(pool) != 0` and `Voter.isAlive(gauge) == true`.
2. Counterpart is a stablecoin we're willing to hold 50% of (depeg = direct loss to depositors). Prefer USDT-class / widely held; avoid small, new, or yield-bearing synthetic stables unless we accept that risk explicitly.
3. Enough TVL that our deposits don't swamp the pool, and sustained votes → emissions over several past epochs (not a one-week bribe spike).
4. USDbC (old bridged USDC) pairs: avoid — being phased out, emissions trending to zero.

Resolve pool address on-chain via `PoolFactory.getPool(USDC, token, true)`; don't hardcode from UIs.

Known addresses (verify):
| Contract | Address |
|---|---|
| USDC (native) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| AERO | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` |
| Aerodrome Router | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` |
| Aerodrome Voter | `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5` |
| Aerodrome PoolFactory | `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` |

## 2. Deposit flow (context for harvest)

1. User deposits USDC → vault mints shares (ERC-4626).
2. Vault swaps part of USDC to the counterpart. Amount from `Router.quoteAddLiquidity` so both sides match the pool ratio (stable pool is not always exactly 50/50).
3. `Router.addLiquidity(USDC, token, true, ...)` → LP tokens.
4. `Gauge.deposit(lpAmount)` → LP staked in gauge. **All LP sits in the gauge**; that's what earns AERO.

## 3. harvest() flow

Key fact driving the design: **on Aerodrome, staked LP earns AERO emissions only. Trading fees from staked liquidity go to veAERO voters, not to LPs.** Unstaked LP earns fees but no AERO. So harvest claims **AERO, from the Gauge** — not fees from the pool.

- `Pool.claimFees()` would return ~nothing for us (our LP is in the gauge, the gauge holds it).
- `Gauge.claimFees()` exists but sends fees to the voting-reward contract (voters), not to us. Don't call it expecting income.

`harvest()` (keeper-only), exact steps:
1. `Gauge.getReward(address(this))` — gauge sends accrued AERO to the vault. Only `account` itself (or Voter) can call this for `account`, so the vault must call it.
2. Take performance fee in AERO (e.g. 10%) → treasury. Skip if below dust.
3. Swap remaining AERO → USDC via Router (`AERO/USDC` or `AERO/WETH → WETH/USDC`, whichever route is deeper). **`minOut` from an independent price** (TWAP from the pool's built-in observations, or Chainlink if a feed exists), not from a same-block quote — otherwise the harvest can be sandwiched (front-run + back-run to steal value).
4. Zap USDC into LP (same as deposit steps 2–3).
5. `Gauge.deposit(newLp)`.
6. Emit `Harvest(aeroClaimed, fee, lpAdded)`. Share price rises; no new shares minted.

Guards:
- Revert/skip if `Voter.isAlive(gauge) == false` (gauge killed → no emissions; switch to withdraw-only mode).
- Skip if claimable (`Gauge.earned(vault)`) is below a threshold where swap + gas eat the gain.
- Profit-unlock: spread harvested value over a few hours/days, so someone can't deposit right before harvest and withdraw right after to grab the jump.

Cadence: gauge emissions stream continuously within each weekly epoch (flips Thursday 00:00 UTC). Base gas is cheap, so daily harvest is fine; tune by `earned()` size vs slippage.

## 4. What the position actually earns

Income sources for staked LP:
| Source | Goes to vault? | Notes |
|---|---|---|
| AERO gauge emissions | **Yes — the only real income** | Paid in AERO, sold for USDC |
| Swap fees on our liquidity | **No** | Go to veAERO voters |
| Bribes / voting incentives | **No** | Go to voters, we don't hold veAERO |
| Stable pool price drift | ~0 | Small ± from stable curve ratio moves |

Emission APR formula (what to compute, not a promise):
```
aprEmissions = gauge.rewardRate() * 365 days * AERO_price_USD / (gauge.totalSupply() * LP_price_USD)
```
- `rewardRate` resets every epoch based on how many votes the gauge gets → can change a lot week to week.
- Priced in AERO → yield in USD moves with AERO's price.
- **Our own deposits dilute it**: adding $X to `totalSupply` lowers APR for everyone, including us. Model APR at our target TVL, not at today's TVL.

Realistic net yield:
```
net = aprEmissions
    - performance fee (e.g. 10% of emissions)
    - AERO→USDC swap slippage (~0.1–0.5% of harvested value, depends on size)
    - zap costs (small on stable curve)
    - keeper gas (cents per harvest on Base; matters only at tiny TVL)
    - depeg risk of the counterpart stable (tail risk, not a steady cost)
```

Expectations:
- Stable/stable gauge APRs on Aerodrome swing widely; a displayed high APR is usually a short-lived vote/bribe spike. Size expectations off a multi-epoch average of `rewardRate`, after our own dilution.
- Net yield should be framed to users as "variable, AERO-emission-driven, can drop to ~0 if votes leave the gauge," not a fixed rate.
- Before launch: script that reads `rewardRate`, `totalSupply`, pool reserves, and AERO price for the last ~8 epochs for each candidate pool → pick pool + publish a realistic range.

## 5. Risks (short)
- Emissions decline / votes move → yield collapses; vault still holds principal.
- Gauge killed → withdraw-only mode.
- Counterpart depeg → direct principal loss on ~50% of position.
- AERO price drop → lower USD yield.
- Harvest sandwich → mitigated by TWAP-based `minOut`.
- Smart-contract risk: our vault + Aerodrome.

## Open questions
- Which counterpart stable (needs the multi-epoch data script)?
- Performance fee %, treasury address?
- Price source for AERO `minOut`: pool TWAP vs Chainlink?
- Deposit cap for v1?
- Later: Slipstream CL version, or locking some AERO to veAERO to vote for our own gauge?
