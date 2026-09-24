# Base USDC Yield Vault Design

Last reviewed: 2026-09-22.

## Strategy Summary

The vault accepts native Base USDC, converts part of each deposit into WETH, supplies WETH/USDC liquidity on Aerodrome, stakes the LP token in the pool gauge, and compounds harvested AERO emissions back into more LP.

Target pool:

| Item | Address |
| --- | --- |
| Chain | Base mainnet, `8453` |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| WETH | `0x4200000000000000000000000000000000000006` |
| AERO | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` |
| Aerodrome PoolFactory | `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` |
| Aerodrome Router | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` |
| Aerodrome Voter | `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5` |
| WETH/USDC volatile pool | `0xcDAC0d6c6C59727a65F871236188350531885C43` |
| WETH/USDC gauge | `0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025` |
| FeeVotingReward | `0x14df87824a11DC27afF185D3149E05aaa4735f60` |
| BribeVotingReward | `0x3371753209EA6975be5dF825aeCE63766e374441` |

Onchain checks used for this design:

- `PoolFactory.getPool(WETH, USDC, false)` returns `0xcDAC0d6c6C59727a65F871236188350531885C43`.
- `Voter.gauges(pool)` returns `0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025`.
- `Gauge.stakingToken()` returns the pool address.
- `Gauge.rewardToken()` returns AERO.
- `Voter.isAlive(gauge)` is `true`.

## Why This Pool

Use the Aerodrome WETH/USDC volatile basic pool, not a concentrated liquidity pool for v1.

Reasons:

- It uses native Base USDC and canonical WETH, avoiding bridged stablecoin risk such as USDbC and avoiding long-tail token risk.
- The pool has a live Aerodrome gauge and currently receives AERO emissions.
- The LP token is a normal ERC-20. That keeps vault accounting, deposits, withdrawals, share pricing, and compounding much simpler than an Aerodrome Slipstream NFT position.
- The strategy is easy for a keeper to operate: claim one reward token, swap into the two pool assets, add liquidity, stake the new LP.
- It is a reasonable small-vault starting point. It will not be the highest-fee WETH/USDC venue on Base, but it is a clean first implementation with less range-management and NFT custody risk.

Tradeoffs:

- Depositors get WETH price exposure. A USDC depositor is no longer in a stable-only strategy after deposit.
- The non-concentrated pool is less capital efficient than Slipstream/Uniswap-style concentrated liquidity.
- Staking this Aerodrome basic LP means the vault earns AERO emissions. The WETH/USDC swap fees are redirected to veAERO voters through the FeeVotingReward contract, so they are not part of the vault's direct harvest unless the design later adds a veAERO voting module.

## Deposit Flow

1. User deposits USDC into the vault.
2. Vault keeps only minimal idle USDC for rounding or withdrawals.
3. Vault swaps enough USDC to WETH through Aerodrome so the remaining USDC and acquired WETH match the pool's current deposit ratio.
4. Vault calls Aerodrome Router `addLiquidity(WETH, USDC, false, amountWeth, amountUsdc, minWeth, minUsdc, address(this), deadline)`.
5. Vault stakes all newly received pool LP tokens by calling `Gauge.deposit(lpAmount)` on `0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025`.
6. Vault mints shares based on total assets, valuing staked LP plus idle balances.

All swaps and liquidity adds must use keeper/user supplied slippage bounds. Do not allow a public caller to choose unbounded routes or zero minimum outputs.

## Exact `harvest()` Flow

`harvest()` compounds only AERO emissions earned by the staked LP position.

1. Check `Voter.isAlive(GAUGE)`. If false, skip compounding and leave funds withdrawable.
2. Optionally call `Voter.distribute([GAUGE])` if `Voter.claimable(GAUGE) > 0`, so any undistributed current-epoch emissions are pushed into the gauge. This is a maintenance step, not the vault's reward claim.
3. Claim vault emissions from the gauge. Preferred call from the vault is `Voter.claimRewards([GAUGE])`, which claims the vault's gauge emissions. Equivalent direct call is `Gauge.getReward(address(this))`.
4. Measure the AERO balance received. The reward token is `Gauge.rewardToken() == AERO`.
5. Swap harvested AERO into WETH and USDC in the proportions needed for the WETH/USDC volatile pool. Use min-out values from an offchain quote and reject stale deadlines.
6. Add the new WETH and USDC to the same Aerodrome pool through the Router.
7. Stake the newly minted LP tokens back into the same gauge with `Gauge.deposit(newLpAmount)`.
8. Emit `Harvest(aeroClaimed, wethAdded, usdcAdded, lpStaked)`.

What `harvest()` must not claim in this v1 design:

- Do not call `Pool.claimFees()`. A gauge-staked Aerodrome basic LP relinquishes pool fee rewards; those fees are routed to `FeeVotingReward`.
- Do not call `Voter.claimFees(...)` or `Voter.claimBribes(...)`. Those are for veAERO NFT voters, not plain LP stakers. The listed `FeeVotingReward` and `BribeVotingReward` addresses are relevant protocol contracts, but this vault should not expect rewards from them unless it later owns and votes a veAERO NFT.

## Earnings Breakdown

Current snapshot from onchain reads and GeckoTerminal on 2026-09-22:

- Pool reserves: about `1,636.04 WETH` and `4.49M USDC`.
- Pool TVL: about `$8.97M`.
- Gauge staked LP: about `98.8%` of total LP supply.
- Gauge reward rate: `0.029588 AERO/sec`, about `2,556 AERO/day`.
- AERO price observed around `$0.69`.
- Gross AERO emissions at the current rate: about `$644k/year`.
- Estimated gross AERO APR on staked LP TVL: about `7.3%` before compounding, slippage, gas, keeper fees, and AERO price movement.

The realistic return stack is:

| Component | Direction | Notes |
| --- | --- | --- |
| AERO emissions | Positive, harvestable | Main vault yield. Paid by the Aerodrome gauge to staked LPs. Highly variable because veAERO votes and emissions update weekly. |
| Trading fees | Not direct vault yield | The factory currently reports fee `30`, meaning `0.30%` per swap, but gauge-staked basic LP fees flow to `FeeVotingReward` for voters. They explain why voters may direct emissions here, but they are not claimed by this vault. |
| WETH/USDC market exposure | Positive or negative | Depositors are effectively in a 50/50 WETH/USDC LP. ETH moves can dominate the AERO APR. |
| Impermanent loss | Negative versus holding the two assets | If WETH doubles or halves versus USDC, a constant-product LP underperforms a passive 50/50 hold by about `5.7%`, before rewards. |
| Compounding costs | Negative | AERO swaps, liquidity adds, and staking cost gas and slippage. On Base this is usually small, but it matters for tiny harvests. |

Using the latest 24h GeckoTerminal volume snapshot of about `$338.7k`, the pool would generate roughly `$1.0k/day` of swap fees at a `0.30%` fee, or about `4.1%` annualized on total pool TVL if fees were retained by LPs. In this staked-gauge design, that fee stream is not the vault's direct cashflow; the practical vault APR should be modeled primarily from AERO emissions minus costs, plus or minus WETH/USDC LP price effects.

## Implementation Notes

- Keep a hardcoded allowlist for token addresses, pool, gauge, router, and voter. This vault should not be a generic router.
- Use TWAP or offchain quotes with strict min-outs for USDC->WETH and AERO->pair-asset swaps.
- Put a minimum profitable harvest threshold on AERO rewards so keepers do not churn dust.
- Share price should include staked LP value, unstaked LP, idle USDC, idle WETH, and unharvested AERO if the accounting implementation can price it safely.
- Emergency withdrawal should call `Gauge.withdraw(lpAmount)` and allow withdrawal in underlying LP or unwind through the router with slippage bounds.
- If the strategy later moves to Aerodrome Slipstream, redesign around NFT custody, range selection, fee collection, and CL gauge integration rather than trying to patch this ERC-20 LP design.

## Sources

- Aerodrome contracts and deployment addresses: https://github.com/aerodrome-finance/contracts
- Aerodrome protocol specification: https://github.com/aerodrome-finance/contracts/blob/main/SPECIFICATION.md
- Aerodrome `IGauge` interface: https://github.com/aerodrome-finance/contracts/blob/main/contracts/interfaces/IGauge.sol
- Aerodrome `IVoter` interface: https://github.com/aerodrome-finance/contracts/blob/main/contracts/interfaces/IVoter.sol
- Pool data snapshot: https://www.geckoterminal.com/base/pools/0xcdac0d6c6c59727a65f871236188350531885c43
