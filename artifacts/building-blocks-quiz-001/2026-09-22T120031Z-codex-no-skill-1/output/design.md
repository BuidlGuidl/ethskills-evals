# Base USDC Yield Vault Design

## Pool choice

The vault LPs into Aerodrome's basic volatile `vAMM-WETH/USDC` pool on Base.

| Item | Address |
| --- | --- |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| WETH | `0x4200000000000000000000000000000000000006` |
| Aerodrome PoolFactory | `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` |
| Aerodrome Router | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` |
| Pool / LP token | `0xcDAC0d6c6C59727a65F871236188350531885C43` |
| Gauge | `0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025` |
| Reward token, AERO | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` |
| Gauge `feesVotingReward` | `0x14df87824a11DC27afF185D3149E05aaa4735f60` |

Why this pool:

- It is the canonical ETH/stable pair for a USDC-denominated vault on Base: broad routing demand, recognizable risk, and much less idiosyncratic token exposure than `USDC/AERO`.
- It uses Aerodrome's basic volatile AMM rather than Slipstream concentrated liquidity. That keeps the first version simple: ERC-20 LP token, no NFT position management, no active range upkeep, and no out-of-range liquidity state.
- It is deep enough for a small vault. Aerodrome's pool screen showed about `$7.39M` TVL for the basic `WETH/USDC` pool at this design snapshot.
- It still has gauge emissions, so the keeper has a real harvest target: accrued AERO from the gauge.

Rejected alternatives:

- `USDC/AERO` basic volatile had higher displayed emission APR, but the vault would hold roughly half its principal in AERO. That turns a USDC yield product into a large AERO directional bet.
- `WETH/USDC` Slipstream concentrated pools showed much higher displayed APRs, but require range selection, rebalancing policy, NFT staking, and more complex accounting. That is a better v2 strategy after the basic vault is proven.

## Deposit and position shape

Users deposit USDC. The vault keeps only minimal idle USDC for dust and rounding. For each net deposit or compound:

1. Swap the needed portion of USDC to WETH.
2. Add liquidity through the Aerodrome Router into `vAMM-WETH/USDC` with `stable = false`.
3. Receive the pool ERC-20 LP token.
4. Stake the LP token into the Aerodrome gauge at `0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025`.

The accounting asset is USDC, but the economic position is a 50/50 WETH/USDC AMM position plus accrued AERO rewards.

## `harvest()` flow

`harvest()` is keeper-gated and should take slippage limits, a deadline, and optionally route data as parameters. It compounds only rewards already earned by the vault; it must not mint shares or change user ownership percentages.

Exact flow:

1. Read the vault's staked LP balance from the gauge with `balanceOf(address(this))`.
2. Claim AERO emissions by calling:

   ```solidity
   IGauge(0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025).getReward(address(this));
   ```

   This claims `rewardToken()` from the gauge, which resolves to AERO at `0x940181a94A35A4569E4529A3CDfB74e38FD98631`.

3. Do not claim pool trading fees. In Aerodrome's staked LP model, LPs that stake in a gauge receive emissions and relinquish fee rewards; those fees are routed to the gauge's `FeesVotingReward` contract for veAERO voters. The vault does not own a veAERO NFT and should not call `Voter.claimFees` or interact with `feesVotingReward` for revenue.
4. Convert claimed AERO into the target LP ratio:
   - Quote AERO to USDC/WETH through Aerodrome or an approved aggregator.
   - Swap enough AERO to WETH and USDC to match the pool reserve ratio, normally close to 50/50 by value for this basic volatile pool.
   - Enforce minimum outputs supplied by the keeper.
5. Add liquidity through the Aerodrome Router:

   ```solidity
   addLiquidity(
     WETH,
     USDC,
     false,
     amountWETHDesired,
     amountUSDCDesired,
     amountWETHMin,
     amountUSDCMin,
     address(this),
     deadline
   )
   ```

6. Stake any newly minted LP tokens back into the same gauge with `deposit(lpAmount)`.
7. Leave only unavoidable WETH/USDC/AERO dust in the vault, update accounting, and emit a `Harvest(aeroClaimed, wethAdded, usdcAdded, lpStaked)` event.

## What the position realistically earns

At the design snapshot on September 22, 2026, Aerodrome displayed the basic `WETH/USDC` pool with about `$826.5K` recent volume, `$2.48K` fees, `$7.39M` TVL, `8.55%` fee APR, and `7.69%` emission APR.

For this staked vault, the realistic revenue breakdown is:

- **AERO emissions:** this is the actual harvestable yield. At the snapshot, the displayed emission APR was roughly `7-8%` gross before compounding friction, swap slippage, keeper incentives, and gas.
- **Trading fees:** not earned by this staked strategy. The displayed fee APR is useful context for pool activity and veAERO voter economics, but it should not be added to the vault's expected APY.
- **Compounding effect:** periodic harvests sell AERO into WETH/USDC and increase the LP balance. On Base, gas is small enough that weekly or twice-weekly harvests are plausible; very frequent harvests are still wasteful unless TVL is large.
- **Market exposure:** users are no longer purely in USDC. Roughly half the position is WETH, so share price moves with ETH/USD and suffers normal constant-product impermanent loss versus simply holding 50% WETH and 50% USDC.
- **AERO price risk before harvest:** emissions accrue in AERO. If AERO falls before the keeper compounds, realized USDC value is lower; if it rises, realized value is higher.

The honest headline for v1 is therefore: a USDC-entry vault that takes WETH/USDC LP risk and compounds Aerodrome AERO emissions. It should not be marketed as earning both Aerodrome fee APR and emission APR unless the strategy changes to unstaked LPing or adds a separate veAERO voting position.

## Sources checked

- Aerodrome contracts README for Base deployment addresses: PoolFactory, Router, Voter, and AERO.
- Aerodrome `IGauge` interface: `stakingToken()`, `rewardToken()`, `feesVotingReward()`, `earned(address)`, and `getReward(address)`.
- Aerodrome protocol specification: staked LP gauges distribute emissions; staked LP fee rewards are routed to `FeesVotingReward` for voters.
- Aerodrome liquidity page snapshot for displayed `WETH/USDC` basic volatile TVL, fee APR, and emission APR.
- On-chain Base reads against `https://mainnet.base.org`:
  - `PoolFactory.getPool(WETH, USDC, false) -> 0xcDAC0d6c6C59727a65F871236188350531885C43`
  - `Voter.gauges(pool) -> 0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025`
  - `Gauge.stakingToken() -> pool`
  - `Gauge.rewardToken() -> AERO`
  - `Gauge.feesVotingReward() -> 0x14df87824a11DC27afF185D3149E05aaa4735f60`
