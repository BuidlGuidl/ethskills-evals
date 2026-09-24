# Aerodrome USDC/WETH Yield Vault Design

This vault compounds a staked Aerodrome classic volatile LP position on Base.
Users deposit value into the vault, the vault maintains a USDC/WETH LP position,
stakes the LP token in the Aerodrome gauge, and a keeper periodically calls
`harvest()` to claim AERO emissions and add them back into the LP position.

## Target Pool and Contracts

The design targets the classic Aerodrome volatile WETH/USDC pool, not a
Slipstream concentrated-liquidity NFT position.

| Role | Contract | Address |
| --- | --- | --- |
| WETH | ERC-20 | `0x4200000000000000000000000000000000000006` |
| USDC | ERC-20 | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| AERO | ERC-20 reward token | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` |
| Aerodrome Router | swaps and classic add/remove liquidity | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` |
| Aerodrome Factory | classic pool lookup and fee config | `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` |
| Aerodrome Voter | gauge registry and emission distribution | `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5` |
| WETH/USDC pool | `vAMM-WETH/USDC` LP token | `0xcDAC0d6c6C59727a65F871236188350531885C43` |
| WETH/USDC gauge | staked LP reward contract | `0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025` |
| Pool fee escrow | pool-level fee storage | `0x0cfF5f2f4171db0b187Ad99F05dcCA08b0eEBDd6` |
| Fee voting reward | veAERO voter fee distribution | `0x14df87824a11DC27afF185D3149E05aaa4735f60` |
| Bribe voting reward | veAERO voter incentive distribution | `0x3371753209EA6975be5dF825aeCE63766e374441` |

Onchain checks used for the addresses:

- `Factory.getPool(WETH, USDC, false)` returns the pool above.
- `Voter.gauges(pool)` returns the gauge above.
- `Gauge.stakingToken()` returns the pool address.
- `Gauge.rewardToken()` returns AERO.
- `Gauge.feesVotingReward()` and `Voter.gaugeToFees(gauge)` return the fee voting reward above.
- `Factory.getFee(pool, false)` currently returns `30`, interpreted by the classic pool as `30 / 10000 = 0.30%`.

## Position Lifecycle

On deposit, the vault should normalize the deposit into the two pool assets. If
the vault accepts only USDC, it swaps the necessary amount into WETH; if it
accepts both assets, it uses the user-provided proportions and may perform only
a small balancing swap.

The vault then calls Aerodrome Router `addLiquidity(WETH, USDC, false, ...)`,
receives `vAMM-WETH/USDC` LP tokens, approves the WETH/USDC gauge, and stakes
the LP token with:

```solidity
IGauge(WETH_USDC_GAUGE).deposit(lpAmount);
```

The vault's accounting should value the position as:

```text
idle USDC
+ idle WETH valued in USDC
+ vault share of staked pool reserves valued in USDC
+ unharvested AERO valued in USDC, optionally with a conservative haircut
- outstanding keeper/vault fees
```

## Exact `harvest()` Flow

`harvest()` is callable by the keeper, or permissionlessly with slippage and
deadline controls. It claims only the vault's AERO LP emissions from the
Aerodrome gauge, compounds them into more WETH/USDC LP, and stakes the new LP.

1. Optionally update the gauge's current epoch emissions:

```solidity
address[] memory gauges = new address[](1);
gauges[0] = WETH_USDC_GAUGE;
IVoter(VOTER).distribute(gauges);
```

This does not claim anything to the vault. It pulls any claimable weekly AERO
emissions from the Aerodrome `Voter` into the gauge with
`Gauge.notifyRewardAmount(...)`, if emissions are available and the gauge is
alive.

2. Claim the vault's accrued LP emissions from the WETH/USDC gauge:

```solidity
IGauge(WETH_USDC_GAUGE).getReward(address(this));
```

This is the actual harvest claim. The source contract is
`0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025`, and the claimed token is AERO
(`0x940181a94A35A4569E4529A3CDfB74e38FD98631`). The amount claimed is the
gauge's `earned(address(this))`, subject to gauge state updates.

The vault should not call `Voter.claimFees(...)`, `Voter.claimBribes(...)`, or
`Pool.claimFees()` in this design. Those are veAERO-voter or unstaked-LP paths,
not the staked LP compounding path.

3. Apply any vault-level harvest fee, if the product has one. The fee should be
taken from harvested AERO before compounding, or from the resulting assets after
the swaps. Keep this explicit so user APY is not overstated.

4. Swap the remaining AERO into the desired WETH/USDC proportions. The target is
not necessarily a naive 50/50 split of the harvested AERO; it should account for
existing idle balances so the next add-liquidity call leaves minimal dust.
Typical routes are `AERO -> USDC` and `AERO -> WETH` through Aerodrome Router or
an approved aggregator. Each swap must use keeper-provided `amountOutMin`
values and a deadline.

5. Add the compounded assets back into the same volatile pool:

```solidity
IRouter(ROUTER).addLiquidity(
    WETH,
    USDC,
    false,
    wethDesired,
    usdcDesired,
    wethMin,
    usdcMin,
    address(this),
    deadline
);
```

6. Stake the newly minted LP tokens back into the same gauge:

```solidity
IGauge(WETH_USDC_GAUGE).deposit(newLpAmount);
```

7. Leave small WETH/USDC/AERO dust balances in the vault for the next harvest,
or sweep only through tightly controlled logic. Emit a harvest event with AERO
claimed, fees taken, swap outputs, LP minted, and LP staked.

## What the Position Earns

The staked vault earns AERO emissions. Emissions are allocated weekly by veAERO
votes to each pool's gauge. The vault receives a pro rata share of the gauge's
streamed AERO based on:

```text
vault staked LP / total LP staked in the gauge
```

A practical gross emission APR estimate is:

```text
Gauge.rewardRate * secondsPerYear * AERO_USD / stakedGaugeTVL_USD
```

That number changes with the weekly vote, AERO price, total LP staked in the
gauge, and whether someone has called `Voter.distribute(...)` for the gauge.

Compounding converts harvested AERO into more WETH/USDC LP, so user returns show
up as a higher amount of LP backing each vault share. The compounding benefit is
real but modestly reduced by swap price impact, Aerodrome swap fees paid during
the compound, add-liquidity imbalance dust, keeper gas reimbursement, and any
vault performance/management fee.

The position also has market-making exposure. It is economically long a
volatile 50/50 WETH/USDC AMM position, so returns include:

- AERO emissions from the gauge.
- Change in the value of the underlying WETH/USDC LP position.
- Impermanent loss versus simply holding the same starting WETH and USDC.
- Execution costs from deposit, withdrawal, and harvest rebalancing swaps.

For this specific staked design, pool swap fees should not be counted as vault
yield. Public dashboards sometimes show pool-level fee APR and reward APR
together; for vault accounting, include only the reward/emission side unless the
vault intentionally leaves LP tokens unstaked.

## Where Swap Fees Go

Trades against the WETH/USDC pool pay the pool's configured swap fee. For the
classic volatile pool above, the current onchain fee is `0.30%`.

Those fees are transferred out of the pool reserves into the pool's `PoolFees`
contract (`0x0cfF5f2f4171db0b187Ad99F05dcCA08b0eEBDd6`) and tracked by LP-token
ownership. Because this vault stakes its LP tokens in the gauge, it gives up the
direct LP fee claim in exchange for AERO emissions. Aerodrome's gauge/fee system
syncs the fees attributable to staked LP into the pool's `FeesVotingReward`
contract (`0x14df87824a11DC27afF185D3149E05aaa4735f60`).

Those fees are then distributed to veAERO voters who voted for the WETH/USDC
gauge, generally on the following epoch's voting-reward schedule. The vault only
receives those fees if it separately owns a veAERO NFT, votes for this pool, and
claims voter rewards through `Voter.claimFees(...)`. That is a different
strategy leg and is not part of this LP-compounding vault.

If the vault leaves some LP tokens unstaked, that unstaked portion can claim
swap fees directly through `Pool.claimFees()`, but it will not earn AERO
emissions while unstaked. A single LP balance should not be modeled as earning
both swap fees and AERO at the same time.

## Implementation Notes

- Check `Voter.isAlive(WETH_USDC_GAUGE)` before new deposits and harvest
compounding. If the gauge is killed, allow withdrawals and disable new staking.
- Use oracle/TWAP bounds or keeper-supplied price checks so harvest cannot be
sandwiched into bad AERO, WETH, or USDC execution.
- Use conservative `amountOutMin`, `amountAMin`, and `amountBMin` values. A
profitable-looking harvest can become value-destructive if min-outs are loose.
- Treat AERO price volatility as part of strategy risk. Emissions are paid in
AERO, but users likely account in USDC.
- Avoid claiming voter fees or bribes unless the product explicitly adds a
veAERO voting module; mixing the two paths makes APR reporting easy to overstate.

## Sources

- Aerodrome documentation: https://aerodrome-finance.app/docs/
- Aerodrome contracts specification: https://github.com/aerodrome-finance/contracts/blob/main/SPECIFICATION.md
- Aerodrome contract README: https://github.com/aerodrome-finance/contracts/blob/main/README.md
- Aerodrome `IGauge` interface: https://github.com/aerodrome-finance/contracts/blob/main/contracts/interfaces/IGauge.sol
- Aerodrome `IVoter` interface: https://github.com/aerodrome-finance/contracts/blob/main/contracts/interfaces/IVoter.sol
- Aerodrome classic `Pool` implementation: https://github.com/aerodrome-finance/contracts/blob/main/contracts/Pool.sol
