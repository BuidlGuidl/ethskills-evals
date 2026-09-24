# Base USDC/WETH Aerodrome Vault Design

## Scope

This design targets the basic volatile Aerodrome `vAMM-WETH/USDC` pool on Base, not a Slipstream concentrated-liquidity pool. That keeps the vault position as an ERC20 LP token staked into a gauge, which is the cleanest fit for a keeper-driven `harvest()` flow.

Relevant Base contracts:

| Contract | Address | Role |
| --- | --- | --- |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | Pool token |
| WETH | `0x4200000000000000000000000000000000000006` | Pool token |
| AERO | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` | Gauge emission token |
| Aerodrome Router | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` | Add liquidity and route reward swaps |
| Aerodrome PoolFactory | `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` | Returns the pool address |
| Aerodrome Voter | `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5` | Maps pool to gauge and distributes emissions |
| `vAMM-WETH/USDC` pool | `0xcDAC0d6c6C59727a65F871236188350531885C43` | ERC20 LP token and swap pool |
| `vAMM-WETH/USDC` gauge | `0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025` | Staking contract that pays AERO emissions |
| Pool fee voting reward | `0x14df87824a11DC27afF185D3149E05aaa4735f60` | Receives fees for veAERO voters |

The pool address is the result of:

```solidity
PoolFactory.getPool(USDC, WETH, false)
```

The gauge address is the result of:

```solidity
Voter.gauges(pool)
```

## Deposit Position

Users deposit the vault asset, assumed here to be USDC. The vault swaps the portion needed for WETH, adds both tokens to the Aerodrome volatile pool through the Router, receives `vAMM-WETH/USDC` LP tokens, then stakes those LP tokens into the gauge.

At rest, the strategy holds:

1. Staked `vAMM-WETH/USDC` LP balance in `0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025`.
2. Small residual balances of USDC, WETH, or AERO caused by slippage and rounding.
3. No veAERO position and no direct claim on the pool's swap-fee stream.

## Exact `harvest()` Flow

`harvest()` claims only gauge emissions. It does not claim pool swap fees.

1. Read pending emissions:

```solidity
uint256 pendingAero = IGauge(GAUGE).earned(address(this));
```

2. Claim AERO from the USDC/WETH gauge:

```solidity
IGauge(GAUGE).getReward(address(this));
```

The claimed token is `AERO`, because `IGauge(GAUGE).rewardToken()` returns `0x940181a94A35A4569E4529A3CDfB74e38FD98631`.

3. Optionally pay a keeper incentive from the claimed AERO or from the compounded assets. This should be capped, for example `min(maxKeeperFee, claimedAero * keeperFeeBps / 10_000)`.

4. Swap claimed AERO into the two pool assets. A simple version swaps about half of net AERO to USDC and half to WETH through the Aerodrome Router. A better version computes the current pool reserve ratio and swaps into the exact USDC/WETH amounts needed for a balanced add-liquidity call.

5. Add liquidity through the Aerodrome Router:

```solidity
IRouter(ROUTER).addLiquidity(
    WETH,
    USDC,
    false,
    wethAmountDesired,
    usdcAmountDesired,
    wethAmountMin,
    usdcAmountMin,
    address(this),
    deadline
);
```

The call returns additional `vAMM-WETH/USDC` LP tokens.

6. Stake the new LP tokens into the gauge:

```solidity
IERC20(POOL).approve(GAUGE, newLpAmount);
IGauge(GAUGE).deposit(newLpAmount);
```

7. Emit `Harvest(claimedAero, compoundedUsdcValue, newLpAmount)` and leave any dust in the vault for the next harvest.

## What The Position Earns

The realistic return stack is:

| Source | Earned by this vault? | Notes |
| --- | --- | --- |
| AERO gauge emissions | Yes | Main harvestable yield. Emissions are directed weekly by veAERO votes to the pool gauge and accrue to staked LPs pro rata. |
| Reinvested compounding | Yes | Harvested AERO is swapped into WETH/USDC, added as more LP, and staked, increasing the vault's share of future emissions. |
| Pool inventory exposure | Yes, positive or negative | The vault owns a volatile WETH/USDC AMM position, so share value moves with WETH price and pool rebalancing. |
| Impermanent loss | Yes, as a cost | LP performance can lag simply holding the same starting mix of WETH and USDC when WETH trends strongly. |
| Swap fees from traders | No, in this staked design | The pool generates fees, but staked LPs give up direct fee claims in exchange for gauge emissions. |
| Bribes / voting incentives | No | Bribes go to veAERO voters, not ordinary gauge-staked LPs. The vault would need its own veAERO voting module to earn these. |

For the vault, the practical APY is therefore:

```text
net APY ~= AERO emission APR
         + compounding effect
         +/- LP mark-to-market and impermanent-loss effects
         - swap slippage
         - keeper incentives
         - gas
         - protocol/performance fees, if any
```

The important modeling point is that the visible pool trading volume does not automatically become vault revenue. Trading volume matters indirectly because high-fee pools can attract veAERO votes, which can increase future AERO emissions to the gauge.

## Where Swap Fees Go

In this design, swap fees do not end up in the vault's `harvest()`.

The `vAMM-WETH/USDC` pool accrues fees in the pool fee accounting. Because the vault stakes its LP tokens in the gauge, fee claims are relinquished to the gauge. The gauge is linked to `feesVotingReward()` at `0x14df87824a11DC27afF185D3149E05aaa4735f60`, where the fees are distributed to veAERO voters who voted for this pool/gauge in the relevant epoch.

So the fee path is:

```text
trader swap
  -> vAMM-WETH/USDC pool fee accounting
  -> gauge-linked fee collection
  -> FeesVotingReward contract
  -> veAERO voters for this pool
```

The vault's path is separate:

```text
staked LP tokens
  -> USDC/WETH gauge AERO emissions
  -> harvest() claims AERO
  -> swaps AERO to USDC/WETH
  -> adds more LP
  -> stakes more LP in the gauge
```

If the product goal is to capture swap fees too, this design must change. The vault would either leave LP tokens unstaked and call `pool.claimFees()`, sacrificing AERO emissions, or add a veAERO voting strategy that owns/borrows voting power and receives the fee/bribe side of Aerodrome's flywheel.

## Implementation Notes

- Use slippage limits for every reward swap and `addLiquidity()` call.
- Route AERO swaps through a quote system rather than hard-coding a path forever.
- Keep harvest permissionless but enforce `minProfit` or `minClaimedAero` so keepers cannot churn dust.
- Account for USDC's 6 decimals, WETH's 18 decimals, and AERO's 18 decimals.
- Include emergency withdrawal paths for unstaking LP from the gauge and removing liquidity from the pool.
- Report `totalAssets()` from the current value of staked LP plus idle token balances, not from raw deposited USDC alone.

## References

- Aerodrome contracts README: gauges distribute emissions to staked LPs; staked LP fee claims are relinquished to the gauge.
- Aerodrome SDK docs: basic-pool staking uses gauge `deposit()` / `withdraw()`, and emissions are claimed with gauge `getReward(address)`.
- Aerodrome liquidity docs: WETH/USDC is an uncorrelated volatile pair; concentrated pools are a separate design with ERC721 positions and different harvest mechanics.
