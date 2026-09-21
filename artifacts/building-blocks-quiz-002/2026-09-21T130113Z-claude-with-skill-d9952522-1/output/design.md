# Aerodrome USDC/WETH Auto-Compounding Vault (Base)

Data snapshot: **2026-09-21 13:02 UTC, Base block 51603212**. Onchain reads via `cast` against
`https://mainnet.base.org`; TVL/volume/price from DexScreener API the same day. All numbers change
every epoch (weekly) and must be re-checked before launch.

## TL;DR

- The vault stakes its LP in the Aerodrome **Gauge**. `harvest()` claims **only AERO** via
  `Gauge.getReward(address(this))`. There are no swap fees to claim.
- **Swap fees do not reach the vault.** While LP is staked, the pool pays its fees to the gauge, and
  the gauge forwards them to `FeesVotingReward` → **veAERO voters**. The vault gets none of them.
- Realistic earnings today: **~7.2% APR in AERO emissions** (lower once the vault's own TVL dilutes it),
  paid in a token the vault must sell. On the other side is impermanent loss (IL) on a 50/50 xy=k
  ETH/USD position, and **no fee income to offset it**.

## 1. Which "USDC/WETH pool"?

Aerodrome has several gauged WETH/USDC pools on Base. They are not interchangeable:

| Pool | Type | Swap fee | Liquidity | 24h volume | Gauge | AERO emission rate |
|---|---|---|---|---|---|---|
| `0xcDAC0d6c6C59727a65F871236188350531885C43` | v2 basic, volatile (vAMM) | 0.30% | $9.09M | $0.42M | `0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025` | 0.0296 AERO/s |
| `0x3FE04A59Ebd38cF06080a6F60a98D124eb59392A` | Slipstream CL, tick 50 | 0.060% | $6.88M | $51.7M | `0xA0B61fdB9f1FB9b917Fe38b49427Fd4D87472D28` | 0.464 AERO/s |
| `0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59` | Slipstream CL, tick 100 | 0.0684% | $8.14M | $31.6M | `0xF33a96b5932D9E9B9A0eDA447AbD8C9d48d2e0c8` | 0.270 AERO/s |
| `0x4e392fBfE4D0557C82D2F97F02ec39daA31516dd` | Slipstream CL, tick 1 | 0.008% | $0.10M | $2.66M | `0x6BFdC817fd78c72A0E330e3D958108fAc96201f4` | 0.0044 AERO/s |

All gauges are `Voter.isAlive == true` and all pay `rewardToken = AERO (0x940181a94A35A4569E4529A3CDfB74e38FD98631)`.

**This design targets the v2 vAMM pool (`0xcDAC…`).** Its LP token is fungible ERC-20, so vault
accounting is simple and no range management is needed. The trade-off: most volume and emissions
sit in the Slipstream CL pools. Slipstream needs an NFT position, active range management, and a
different harvest (`CLGauge.getReward(tokenId)`). That would be a separate design (see §6).

Contracts (verified onchain):

| Contract | Address |
|---|---|
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| WETH (token0 of pool) | `0x4200000000000000000000000000000000000006` |
| AERO | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` |
| Pool vAMM-WETH/USDC | `0xcDAC0d6c6C59727a65F871236188350531885C43` |
| Gauge | `0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025` |
| FeesVotingReward (fee sink) | `0x14df87824a11DC27afF185D3149E05aaa4735f60` |
| Voter | `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5` |
| PoolFactory | `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` |
| Router | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` |
| AERO/USDC vAMM (sell route, $36M liq.) | `0x6cDcb1C4A4D1C3C6d054b27AC5B77e89eAFb971d` |

## 2. Position lifecycle

```
deposit(USDC and/or WETH)
  → Router.addLiquidity(WETH, USDC, stable=false, …)   → vAMM LP tokens
  → Gauge.deposit(lpAmount)                             → LP held by the gauge
withdraw(shares)
  → Gauge.withdraw(lpAmount) → Router.removeLiquidity(…) → WETH + USDC to user
```

The vault keeps ~all LP staked. Unstaked LP would earn fees but no AERO (see §4).

## 3. `harvest()` flow (exact)

Keeper-only. Arguments: `minAeroToUsdc`, `minUsdcToWeth`, `minLp` (or have the contract derive the mins
from an oracle; never from spot price alone).

1. **Claim:** `IGauge(0x519B…C025).getReward(address(this))`.
   - Source: `Gauge.getReward(address _account)` sends accrued `rewards[_account]` in **AERO** to the vault.
     It reverts unless `msg.sender == _account` or the Voter calls it (so the vault must call it itself).
   - This is the **only** claim. The vault never calls `pool.claimFees()`: the pool counts the LP as
     the gauge's, so it credits the fees to the gauge.
   - No other reward tokens exist on this gauge. (Bribes and fees go to voters, not stakers.)
2. **Performance fee:** move `perfFeeBps` of the claimed AERO to the treasury.
3. **Sell AERO:** swap AERO → USDC through the Router using the AERO/USDC vAMM (`0x6cDc…971d`), with `amountOutMin`.
4. **Balance:** swap the right share of USDC → WETH so both amounts match the reserve ratio
   (use the closed-form "optimal swap" amount that accounts for the 0.30% fee, not a naive 50%).
5. **Add liquidity:** `Router.addLiquidity(WETH, USDC, false, amtWETH, amtUSDC, min0, min1, vault, deadline)`.
6. **Stake:** `Gauge.deposit(newLp)`.
7. Leftover dust stays in the vault and gets rolled into the next harvest.
8. **Profit unlock:** credit the new LP to share price **linearly over ~harvest interval** (not instantly),
   so nobody can deposit right before `harvest()` and withdraw right after to grab the yield.

Timing notes:
- The gauge streams rewards per second. `periodFinish = 1790208000` (Thu 2026-09-24 00:00 UTC, the
  epoch boundary). Each Thursday the Voter pays in new emissions based on that week's votes, so the rate
  can change a lot from week to week.
- Base gas is cheap, so a daily harvest is fine. The real cost is slippage on the AERO sale. Size
  harvests so each sale is a small fraction of AERO/USDC pool depth.

## 4. Where the swap fees go

In Aerodrome, **staked LP earns emissions, not fees.** Fees go to veAERO voters.

Flow (from `Gauge.sol`, aerodrome-finance/contracts):
1. A trader swaps in the pool and pays a 0.30% fee (`PoolFactory.getFee(pool,false) = 30` bps). The pool
   credits fees pro-rata to LP holders. For staked LP, the holder is the **Gauge**.
2. Each epoch the Voter calls `Gauge.notifyRewardAmount()`, which calls `_claimFees()` →
   `pool.claimFees()` → `IReward(feesVotingReward).notifyRewardAmount(token, amount)`.
3. `FeesVotingReward (0x14df…5f60)` pays those WETH/USDC fees to the veAERO holders who voted
   for this gauge.

For this design: **the vault's share of swap fees goes to veAERO voters, not to depositors.**
The only fees the vault could keep are on LP it leaves unstaked (e.g. a withdrawal buffer). Those are
claimable via `pool.claimFees()`, but they're immaterial. Today 98.7% of the pool's LP supply is staked
(gauge `totalSupply` 8.3949e16 of pool `totalSupply` 8.5022e16).

## 5. What the position earns (realistic)

Inputs (2026-09-21): pool TVL $9.086M (1,661.7 WETH + 4.543M USDC, ETH ≈ $2,734). Staked TVL ≈ $8.97M.
24h volume $418k. AERO = $0.697. Gauge `rewardRate` = 0.029588 AERO/s.

| Item | Pool-level | APR on staked TVL | Goes to vault? |
|---|---|---|---|
| AERO emissions | 17,895 AERO/wk ≈ 933k AERO/yr ≈ **$651k/yr** | **~7.2%** | **Yes** (only source) |
| Swap fees (0.30% × $418k/day) | ≈ $1,254/day ≈ $458k/yr | ~5.0% | **No**, goes to veAERO voters |
| Impermanent loss (xy=k 50/50) | — | ETH ±20% → −0.4% to −0.6%; ±50% → −2.0% / −5.7% | Cost borne by vault |

Net for depositors ≈ **7.2% gross AERO APR**, minus:
- **Dilution by the vault itself.** The APR is a fixed weekly emission shared by all staked LP.
  A $1M vault → ~6.5%; a $5M vault → ~4.6%.
- **AERO price risk and sale slippage.** Rewards are only worth what AERO sells for at harvest time.
- **Performance fee** (e.g. 10% → ~6.5% net at small size).
- **IL and arbitrage losses.** Normally swap fees partly offset these. Here they do not, because the fees
  go to voters. A sharp ETH move in either direction can wipe out months of emissions.
- **Emission volatility.** The rate is re-set by votes every Thursday and can drop to ~0 if voters
  move elsewhere.

Unstaked alternative (for comparison): the ~5.0% fee APR is paid in WETH/USDC, with no AERO and no
selling. Right now staking (7.2%) beats it, but only by ~2 points, and that gap depends on AERO price
and votes. The strategy should track both and could support an "unstaked" mode.

## 6. Slipstream (CL) alternative, briefly

The CL pools have ~100× the volume and much larger emissions. Staked CL positions follow the same rule:
fees from staked liquidity go to the gauge → `FeesVotingReward`. Unstaked positions keep their fees
minus `unstakedFee` (currently 5%, `unstakedFee() = 50000`), which is paid to the gauge. Harvest would be
`CLGauge.getReward(tokenId)` per NFT. The vault would also need rebalancing logic when price leaves the
range (no AERO accrues out of range). APR depends on range width and cannot be compared to §5
without a range model. Out of scope for v1.

## 7. Risks / checks

- **Sandwiching of harvest swaps:** enforce `amountOutMin` from an oracle (Chainlink ETH/USD on Base, a TWAP
  for AERO via `pool.quote(...)`) and keep harvest access restricted to the keeper.
- **Share inflation / first-depositor attack:** use virtual shares/offset (ERC-4626 style) or seed deposit.
- **Gauge killed** (`Voter.isAlive == false`): emissions stop. Withdrawing from the gauge must still work,
  so add a strategy `panic()` to unstake and hold LP.
- **Approvals:** exact-amount approvals to the Router/Gauge per call, not infinite to arbitrary addresses.
- **Deposit ratio:** single-sided deposits need the same optimal-swap math and slippage checks as harvest.

## 8. Validation plan (not yet done)

On a Base fork pinned to a recent block:
1. Deposit → stake → warp 1 day → `harvest()`: assert AERO received ≈ `rewardRate × dt × share`,
   and that the vault's `pool.claimable0/1` stays ~0.
2. Warp past the epoch boundary, prank the Voter to `distribute`, and confirm the fees land in `FeesVotingReward`, not the vault.
3. Harvest with a manipulated AERO/USDC price → must revert on minOut.
4. Deposit-before / withdraw-after harvest → profit unlock blocks the capture.
5. Kill the gauge (prank the Voter's emergency council) → withdraw still succeeds.

## Open questions

- Is v2 vAMM (simple, low fee volume) the intended pool, or a Slipstream CL pool?
- Performance fee size and treasury address?
- Should an "unstaked / fee mode" switch exist for weeks when fee APR > emission APR?
