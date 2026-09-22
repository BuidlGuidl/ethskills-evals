# Aerodrome USDC/WETH Yield Vault Design

Last verified: 2026-09-22.

This design assumes the vault uses Aerodrome's classic Basic Volatile USDC/WETH pool on Base, not a Slipstream concentrated-liquidity NFT position. The vault owns and stakes the ERC-20 LP token, so the harvest path is the standard Aerodrome gauge path.

## Verified Base Contracts

| Component | Address | Verification |
| --- | --- | --- |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | Base canonical USDC |
| WETH | `0x4200000000000000000000000000000000000006` | Base canonical WETH |
| AERO | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` | Aerodrome deployment table lists AERO at this address |
| Aerodrome PoolFactory | `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` | Aerodrome deployment table |
| Aerodrome Voter | `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5` | Aerodrome deployment table |
| Basic Volatile WETH/USDC pool / LP token | `0xcDAC0d6c6C59727a65F871236188350531885C43` | `PoolFactory.getPool(USDC, WETH, false)` |
| Gauge for this pool | `0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025` | `Voter.gauges(pool)` |
| FeeVotingReward for this gauge | `0x14df87824a11DC27afF185D3149E05aaa4735f60` | `Gauge.feesVotingReward()` |

On-chain checks used:

```text
PoolFactory.getPool(USDC, WETH, false)
  -> 0xcDAC0d6c6C59727a65F871236188350531885C43

Pool.symbol()
  -> "vAMM-WETH/USDC"

Pool.tokens()
  -> WETH, USDC

Voter.gauges(pool)
  -> 0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025

Gauge.stakingToken()
  -> 0xcDAC0d6c6C59727a65F871236188350531885C43

Gauge.rewardToken()
  -> 0x940181a94A35A4569E4529A3CDfB74e38FD98631

Gauge.feesVotingReward()
  -> 0x14df87824a11DC27afF185D3149E05aaa4735f60
```

Aerodrome's contracts README describes `Gauge.sol` as the contract that receives pool LP tokens and distributes protocol emissions, and says LP fee claims are relinquished to the gauge when staking for emissions. The protocol specification also states that fee rewards forgone by LP depositors are transferred to `FeeVotingReward`, where they are distributed to voters in the next epoch.

Sources:

- Aerodrome contracts deployment table and contract descriptions: https://github.com/aerodrome-finance/contracts/blob/main/README.md
- Aerodrome protocol specification: https://github.com/aerodrome-finance/contracts/blob/main/SPECIFICATION.md
- Aerodrome gauge interface: https://github.com/aerodrome-finance/contracts/blob/main/contracts/interfaces/IGauge.sol
- Aerodrome liquidity page snapshot on 2026-09-22: https://aerodrome.finance/liquidity

## Deposit / Position Lifecycle

The vault accepts one or both underlying assets depending on the product surface. Internally, the target position is always:

1. Hold WETH and USDC in the ratio required by the Aerodrome volatile pool.
2. Add liquidity to pool `0xcDAC0d6c6C59727a65F871236188350531885C43` through the Aerodrome Router or an equivalent integration.
3. Receive `vAMM-WETH/USDC` ERC-20 LP tokens.
4. Stake those LP tokens into gauge `0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025`.
5. Track user vault shares against the vault's total staked LP tokens plus any idle assets.

The vault should not hold a veAERO NFT in this design, should not vote, and should not claim voter rewards. If we later add a veAERO strategy, that is a separate strategy layer with different accounting and lockup assumptions.

## Exact `harvest()` Flow

`harvest()` is called by a keeper, but the vault contract itself performs the Aerodrome claim. This matters because Aerodrome's `IGauge.getReward(address _account)` is documented as reverting unless called by the same account or by the Voter.

Recommended flow:

1. Check pending AERO:
   - Optional read: `Gauge.earned(address(this))` on `0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025`.
   - If below a configured minimum, return early to avoid wasting gas.
2. Claim emissions:
   - Call `Gauge.getReward(address(this))` on `0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025`.
   - This transfers AERO from the gauge to the vault.
   - This is the only reward claim in the base design.
3. Apply vault-level fees, if any:
   - Performance fee should be taken from harvested AERO before compounding, or from the compounded LP value with explicit accounting.
   - Do not take a fee from pool swap fees unless the strategy actually controls them. In this design it does not.
4. Compound AERO:
   - Swap harvested AERO into the desired WETH/USDC proportions.
   - Use conservative slippage limits, TWAP/oracle checks, and minimum output guards.
   - The simplest implementation swaps roughly half of net AERO to WETH and half to USDC, then adjusts any leftover imbalance after quoting the add-liquidity amounts.
5. Add liquidity:
   - Approve WETH and USDC to the Aerodrome Router.
   - Add liquidity to the volatile WETH/USDC pool.
   - Receive more `vAMM-WETH/USDC` LP tokens.
6. Restake:
   - Approve the new LP tokens to the gauge.
   - Call `Gauge.deposit(newLpAmount)` on `0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025`.
7. Update accounting:
   - Recompute total assets from staked LP balance, idle LP tokens, idle WETH/USDC, and any dust AERO.
   - Emit `Harvest(aeroClaimed, wethAdded, usdcAdded, lpMinted, feesTaken)` or equivalent.

`harvest()` does not call `FeeVotingReward.getReward(...)`, does not claim bribes, and does not claim WETH/USDC trading fees. Those belong to veAERO voters for this staked LP design.

## Realistic Earnings Breakdown

The position has three economic components:

| Component | Earned by this vault? | Notes |
| --- | --- | --- |
| AERO emissions | Yes | The gauge distributes AERO to staked LPs according to the pool's vote-directed emission allocation and the vault's share of gauge deposits. This is the harvestable, compoundable yield source. |
| Pool swap fees | No, if LP tokens are staked in the gauge | Staked LPs forgo direct fee claims in exchange for emissions. The fees are routed into `FeeVotingReward` for veAERO voters. |
| Inventory exposure / impermanent loss | Yes | The vault is long a volatile WETH/USDC AMM LP position. LP value changes with WETH price, pool inventory, swap activity, and divergence loss versus simply holding the two assets. |

As a live snapshot on 2026-09-22, Aerodrome's liquidity page indexed the WETH/USDC `0.3% Basic Volatile` pool with about `$7.39M` TVL, about `$826k` recent volume, about `$2.48k` recent fees, around `8.55%` displayed Fee APR, and around `7.69%` displayed Emission APR. For this vault, the realistic recurring harvestable APR is the emission side, less:

- AERO price impact while swapping rewards.
- Keeper gas and any keeper incentive.
- Vault performance/management fees.
- Add-liquidity slippage and idle dust.
- Impermanent loss from WETH/USDC price movement.
- Emission variability from weekly veAERO voting and gauge liveness.

The displayed fee APR is still useful as a measure of pool trading activity and the value flowing to voters, but it should not be counted as vault depositor yield while the vault stakes LP tokens in the gauge.

## Where Swap Fees End Up

Aerodrome separates pool trading fees from pool reserves in `PoolFees`. For emissions-eligible, staked LP positions, the LP depositor gives up the direct fee claim when staking in the gauge. The gauge records and transfers the forgone WETH/USDC fees to the linked `FeeVotingReward` contract:

```text
WETH/USDC swaps
  -> pool fee accounting / PoolFees
  -> gauge fee collection for staked liquidity
  -> FeeVotingReward 0x14df87824a11DC27afF185D3149E05aaa4735f60
  -> veAERO voters who voted for the WETH/USDC gauge
```

That means depositors in this vault receive compounded AERO emissions and LP market exposure, not the pool's WETH/USDC swap fees. The vault should not advertise "fee APR + emission APR" as user APY unless it also holds and votes a veAERO position and deliberately routes those voter rewards back to vault depositors.

## Implementation Notes

- Hardcode or immutably set the pool and gauge only after checking `Gauge.stakingToken() == pool` and `Gauge.rewardToken() == AERO`.
- Add a `minHarvest` threshold in AERO or USD terms so keepers cannot grief small claims.
- Protect all reward swaps and liquidity adds with minimum outputs and deadlines.
- Treat AERO, WETH, USDC, and LP-token dust as vault assets, but keep dust thresholds explicit.
- Do not use the stable USDC/WETH pool returned by `PoolFactory.getPool(USDC, WETH, true)`; on 2026-09-22 it returned `0x3548029694fbB241D45FB24Ba0cd9c9d4E745f16`, which is a different position.
- If the strategy migrates to Aerodrome Slipstream concentrated liquidity, this document must be rewritten because the position token, gauge interface, fee accounting, and compounding flow are different.
