# Aerodrome USDC/WETH Vault — Design

Status: draft. Chain: Base (8453). All live numbers below were read on **2026-09-21**
at Base block **51603701** (block ts `1789996711`) unless noted. Sources: onchain
`cast call` via `https://mainnet.base.org`, plus GeckoTerminal API for 24h volume
and prices. Recheck them before launch; emissions change every weekly epoch.

## TL;DR

- Vault LP tokens / NFTs get **staked in the Aerodrome gauge**. Staking is what earns rewards.
- A staked position earns **AERO emissions only**. `harvest()` claims AERO from the **gauge**.
- The pool's **swap fees do NOT go to the vault**. While staked, the gauge takes them and
  forwards them to the pool's `FeesVotingReward` contract, i.e. to veAERO voters who
  voted for this pool.
- So "compounding rewards" = sell AERO → USDC/WETH → add liquidity → re-stake.
  There is no fee stream to claim.

## 1. Which pool? ("the USDC/WETH pool" is not one pool)

Aerodrome has several USDC/WETH pools on Base. Live state:

| Pool | Address | Gauge | Alive | Swap fee | TVL (USD) | 24h vol | Staked share |
|---|---|---|---|---|---|---|---|
| Slipstream CL, tickSpacing 100 | `0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59` | `0xF33a96b5932D9E9B9A0eDA447AbD8C9d48d2e0c8` | yes | `fee()=758` → 0.0758% | ~$11.6M | ~$31.6M | ~96% of active liquidity (`stakedLiquidity/liquidity`) |
| Basic vAMM (volatile) | `0xcDAC0d6c6C59727a65F871236188350531885C43` | `0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025` | yes | `getFee=30` → 0.30% | ~$9.1M | ~$0.42M | ~98.7% of LP supply |
| Slipstream CL, ts 1 | `0xdbc6…30f1` | `0x45C6…78e3` | **no (killed)** | — | small | — | — |
| Slipstream CL, ts 10 / 50 / 200 / 2000, new-factory ts 50 | various | various | mixed | — | tiny | — | — |

Contracts used: Voter `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5`, basic PoolFactory
`0x420DD381b31aEf6683db6B902084cB0FFECe40Da`, CL factory
`0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A`, AERO `0x940181a94A35A4569E4529A3CDfB74e38FD98631`,
USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, WETH `0x4200000000000000000000000000000000000006`.

Notes:
- GeckoTerminal labels the CL100 pool "0.05%", but onchain `fee()` returned 758 pips.
  Treat the CL fee as variable (likely a dynamic fee module); don't hardcode it.
- Only the two main pools are real candidates. Everything else is killed or has no depth.

Trade-off:
- **vAMM**: LP is a plain ERC20, no range management → simple vault. Lower yield.
- **CL100**: ~8x the emissions, but the vault holds an NFT with a price range, must
  rebalance when price leaves the range, and earns **nothing** while out of range.
  Much more code and more risk (rebalance losses, keeper MEV).

Recommendation: ship v1 on **vAMM**; consider CL100 as a v2 strategy.

## 2. harvest() flow

### Where the position lives

- vAMM: vault calls `Router.addLiquidity(...)` → receives LP ERC20 → `Gauge.deposit(amount)`.
  The **gauge** now holds the LP tokens, not the vault.
- CL: vault mints a position via Slipstream NonfungiblePositionManager
  (`0x827922686190790b37229fd06084350E74485b72`, read from `gauge.nft()`) →
  `CLGauge.deposit(tokenId)`. The gauge holds the NFT.

### What harvest() claims, and from where

| Step | Call | Contract | Gets |
|---|---|---|---|
| 1 | `getReward(address(this))` (vAMM) / `getReward(tokenId)` (CL) | the pool's **Gauge** (above) | AERO (`gauge.rewardToken()` = AERO, verified) |

That is the whole claim. Nothing is claimed from the pool, the Voter, or any
`FeesVotingReward` / `BribeVotingReward` contract — those pay veAERO voters, and the vault
holds no veNFT.

- `Voter.claimRewards(gauges[])` also works for basic gauges (it just calls
  `gauge.getReward(msg.sender)`); calling the gauge directly is simpler.
- Do **not** call `Pool.claimFees()` in harvest. The vault holds 0 LP tokens once
  staked, so it would return ~0.

### Full harvest() sequence (vAMM version)

```
harvest(minUsdcOut, minWethOut, minLiquidity) onlyKeeper nonReentrant:
  1. gauge.getReward(address(this))                // AERO in
  2. take performance fee in AERO → treasury      // optional
  3. swap ~half AERO → USDC, ~half AERO → WETH     // Aerodrome Router, AERO/USDC + AERO/WETH routes
       - amounts sized to current reserve ratio, slippage bounds from keeper args
  4. router.addLiquidity(USDC, WETH, stable=false, ..., minA, minB)
  5. gauge.deposit(lpReceived)
  6. emit Harvest(aeroClaimed, lpAdded)
```

Rules:
- Slippage mins must come from the keeper (off-chain quote) or a TWAP check, never
  `0`. Base has no public mempool, but back-running/price manipulation around harvest
  is still possible.
- Leftover dust (USDC/WETH not used in addLiquidity) stays in the vault and gets used
  next harvest.
- Share price counts only staked LP + idle tokens. Never count unclaimed AERO in
  `totalAssets()` (it would let depositors front-run harvest to grab rewards).

CL version differs only in steps 3–5: compute the token split for the current range,
`CLGauge.increaseStakedLiquidity(...)` (or withdraw → `nft.increaseLiquidity` →
re-deposit), and a separate `rebalance()` for when the range goes out of bounds.

### Timing

- Emissions stream per second during the epoch; `periodFinish` = `1790208000`
  (Thu 2026-09-24 00:00 UTC) for both gauges — weekly epochs.
- Harvest frequency: when claimable AERO value > ~several × gas + swap cost. On Base
  gas is cheap, so daily is reasonable for vAMM.

## 3. What the position earns (realistic)

Live inputs: AERO ≈ **$0.691**, WETH ≈ **$2,734**.

### vAMM pool

- Gauge `rewardRate` = `0.029588` AERO/s → **~2,556 AERO/day ≈ $1,767/day ≈ $645k/yr**.
- Staked TVL ≈ 98.7% × $9.08M ≈ $8.96M.
- **Emission APR ≈ 7.2%**, paid in AERO. This is what the vault earns.
- Swap fees: $416k vol × 0.30% ≈ $1,250/day ≈ 5% APR on TVL — **goes to voters, not us**.

### CL100 pool (for comparison)

- `rewardRate` = `0.26984` AERO/s → **~23,314 AERO/day ≈ $16.1k/day ≈ $5.9M/yr**.
  (Check: `left()` = 56,934 AERO ≈ rate × time to `periodFinish`. Matches.)
- Staked ≈ $11.1M → **~53% average emission APR** across staked liquidity.
  Real per-position APR depends on range width: emissions are split by in-range
  liquidity per second. Wide range → below average; out of range → 0.
- Swap fees: ~$31.6M × 0.0758% ≈ $24k/day — **to voters, not us**.

### What "realistic" means here

- Net yield = AERO APR × (AERO price when sold / AERO price today) − perf fee − swap
  slippage − (vAMM) impermanent loss vs holding ETH/USDC − (CL) rebalance losses.
- AERO emissions per gauge change weekly with votes. The 7%/53% figures are a snapshot
  of this epoch, not a forecast.
- IL on a 50/50 ETH/USDC position is large in trending markets and can exceed the
  emission APR. Show users a realistic range, not the peak APR.

## 4. Where the swap fees end up

Staked LP ⇒ fees go to voters. Path:

**vAMM**
1. Each swap sends the fee to the pool's `PoolFees` contract (`0x0cfF…BDd6`) and indexes
   it to LP holders by balance.
2. The biggest LP holder is the **gauge** (holds 83.95e15 of 85.02e15 LP, 98.7%).
   Onchain: `pool.claimable0(gauge)` = 1.02 WETH, `claimable1(gauge)` = 3,310 USDC
   already accrued.
3. At epoch flip, `Voter.distribute()` → `Gauge.notifyRewardAmount()` → gauge calls
   `pool.claimFees()` and sends the tokens to `FeesVotingReward`
   (`0x14df87824a11DC27afF185D3149E05aaa4735f60` = `voter.gaugeToFees(gauge)`, verified).
4. veAERO holders who voted for this pool claim those fees next epoch.

**CL100**
1. On each swap, the staked-liquidity share of the fee goes straight to
   `pool.gaugeFees` (live: 9.996 WETH + 27,519 USDC pending), not into
   `feeGrowthGlobal`. Staked NFTs accrue 0 fees.
2. Unstaked liquidity keeps its fees minus `unstakedFee` (50000 = 5%), which also goes
   to the gauge.
3. On `notifyRewardAmount` the gauge collects `gaugeFees` and sends them to
   `FeesVotingReward` `0x765d935C2F47a06EdA55D07a9b9aE4108F4BBF85` (verified via
   `gauge.feesVotingReward()`).

**Design consequence:** the vault's only income is AERO. Stake vs not-stake is a
real choice: unstaked LP keeps fees (vAMM ~5% APR fee-only, no AERO); staked LP
gets ~7% AERO, no fees. Staked wins today, but by a small margin on vAMM — the
vault could expose a governance switch, or just stay staked (v1).

## 5. Verification still needed (before code freeze)

Done this session: onchain reads above (pools, gauges, alive status, fees, reward
token, fee-reward contracts, reward rates, fee accrual on gauge).

Not done yet — required:
- [ ] Read verified source of both gauges and the CL pool on Basescan; confirm the
      `_claimFees` → `FeesVotingReward` path and `getReward` access control
      (`msg.sender == account || msg.sender == voter`) match what's described here.
- [ ] Fork test (Foundry, `--fork-url` Base at a pinned block):
  - deposit → stake → warp 1 day → `harvest()`; assert AERO claimed ≈ rate × share × t.
  - assert vault received **0** USDC/WETH fees; assert `FeesVotingReward` balance grew
    after `Voter.distribute` at epoch flip.
  - failure paths: gauge killed (`Voter.killGauge`) → `getReward`/`deposit` behavior,
    emergency withdraw path; swap reverts on slippage; harvest with 0 rewards;
    withdraw while harvest pending; AERO route liquidity too thin.
- [ ] Check the CL dynamic fee source (why `fee()` = 758 vs 0.05% label).
- [ ] Confirm AERO/USDC and AERO/WETH routes have enough depth for harvest size.

## Open questions

1. vAMM (simple, ~7%) or CL100 (~53% avg, needs range management)?
2. Performance fee % and recipient?
3. Keeper: own bot, Gelato, or Chainlink Automation? Who sets slippage mins?
4. Is a governance switch to unstake (collect fees instead of AERO) wanted, or always staked?
