# Base USDC Yield Vault Design

## Pool Selection

Use the Aerodrome basic volatile `USDC/AERO` pool on Base:

| Item | Address / value |
| --- | --- |
| Chain | Base mainnet, chain id `8453` |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| AERO | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` |
| Aerodrome PoolFactory | `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` |
| Aerodrome Router | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` |
| Aerodrome Voter | `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5` |
| LP pool | `0x6cDcb1C4A4D1C3C6d054b27AC5B77e89eAFb971d` |
| Pool symbol | `vAMM-USDC/AERO` |
| Pool type | Basic volatile, `stable = false` |
| Swap fee | `30` from `PoolFactory.getFee(pool, false)`, shown by Aerodrome as `0.3%` |
| Gauge | `0x4F09bAb2f0E15e2A078A227FE1537665F55b8360` |
| Gauge reward token | AERO |
| Gauge status | Alive |
| FeesVotingReward | `0xa2EdEd6EE17aF8dEbF70a1E93ac66E60dbfaaf33` |

Why this pool:

- It is the simplest production-shaped strategy for a small vault: ERC-20 LP tokens in a basic pool, then ERC-20 LP staking in a gauge. We avoid concentrated-liquidity range management, NFT custody, tick math, and active rebalancing.
- AERO is both the paired asset and the reward token. Harvesting produces AERO, so compounding only needs to swap part of the harvested AERO to USDC and add more `USDC/AERO` liquidity.
- Aerodrome is the native liquidity hub for Base. Its own liquidity page describes LP deposits as earning AERO emissions and currently lists `USDC/AERO 0.3% Basic Volatile` among the largest pools by TVL, with material volume, fee generation, and emissions.
- The pool and gauge were verified on Base RPC on 2026-09-22 at block `51645314`: `PoolFactory.getPool(USDC, AERO, false)` returned the LP pool above, `Voter.gauges(pool)` returned the gauge above, and `Voter.isAlive(gauge)` returned `true`.

Rejected alternatives:

- `WETH/USDC` concentrated pools can show higher APRs, but require range selection and keeper rebalancing. That is a different product and a larger surface area.
- Stablecoin pools such as `msUSD/USDC` reduce directional risk but introduce third-party stablecoin risk and may require concentrated or migration-aware handling.
- Leaving Aerodrome LP unstaked would allow fee claiming, but it would not match this vault's keeper-harvest-and-compound reward design.

## Deposit And Position Shape

User deposits are in USDC. The vault converts deposits into a staked Aerodrome LP position:

1. Keep a small USDC buffer for withdrawals if desired.
2. Swap the required amount of USDC to AERO through Aerodrome Router using route `{ from: USDC, to: AERO, stable: false, factory: PoolFactory }`.
3. Add liquidity with `Router.addLiquidity(USDC, AERO, false, amountUSDC, amountAERO, minUSDC, minAERO, address(this), deadline)`.
4. Stake the received `vAMM-USDC/AERO` LP tokens into `Gauge.deposit(lpAmount)`.

The vault share price is denominated in USDC, but the strategy is not a stablecoin strategy after deposit. Principal becomes roughly 50% USDC and 50% AERO by pool value, plus accrued AERO emissions.

## `harvest()` Flow

The keeper-triggered `harvest()` compounds AERO emissions from the Aerodrome gauge.

1. Update gauge emissions:
   - Call `Voter.distribute([gauge])` on `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5`.
   - This calls `Minter.updatePeriod()` and, if the gauge has claimable emissions, sends AERO into the gauge through `Gauge.notifyRewardAmount`.
   - During `notifyRewardAmount`, the gauge also calls the LP pool's `claimFees()` for fees accrued to the gauge-owned LP tokens and forwards those fees to `FeesVotingReward`. Those fee rewards are for veAERO voters, not for this vault.

2. Claim vault emissions:
   - Call `Gauge.getReward(address(this))` on `0x4F09bAb2f0E15e2A078A227FE1537665F55b8360`.
   - This transfers accrued AERO from the gauge to the vault.
   - Equivalent wrapper: `Voter.claimRewards([gauge])`, which calls `Gauge.getReward(msg.sender)`. Direct `Gauge.getReward(address(this))` is clearer inside the vault.

3. Compound rewards:
   - Let `aeroClaimed = AERO.balanceOf(address(this)) - preClaimBalance`.
   - If `aeroClaimed` is below a configured minimum, return to avoid dust and gas-inefficient harvests.
   - Swap the portion of claimed AERO needed to balance the pool ratio into USDC using `Router.swapExactTokensForTokens`.
   - The route is `{ from: AERO, to: USDC, stable: false, factory: PoolFactory }`.
   - Use router quotes and keeper-provided slippage bounds; do not blindly swap 50% if the vault already has idle USDC.
   - Add the resulting USDC and remaining AERO with `Router.addLiquidity(...)`.
   - Stake new LP tokens back into `Gauge.deposit(lpAmount)`.

4. Accounting:
   - Increase total assets by the value of the newly staked LP tokens.
   - Charge any performance fee only on harvested AERO after slippage, if the vault has fees.
   - Emit `Harvest(aeroClaimed, aeroCompounded, usdcAdded, aeroAdded, lpStaked)`.

What `harvest()` does not claim:

- It does not claim `FeesVotingReward` or `BribeVotingReward`; those require a veAERO NFT vote position and are not LP-staker rewards.
- It does not claim swap fees directly from `Pool.claimFees()` because the vault's LP tokens are staked in the gauge. The gauge owns the LP tokens while staked, and fee rewards are redirected to the pool's fee voting reward contract.

## Realistic Earnings Breakdown

Observed on 2026-09-22:

- Onchain pool reserves at Base block `51645314`: about `18.13M USDC` and `26.38M AERO`.
- With AERO around `$0.69`, pool TVL is roughly `$36.3M`.
- The gauge `rewardRate` was about `0.4784 AERO/sec`, or about `289k AERO/week`.
- At `$0.69/AERO`, that is about `$200k/week` of emissions. Annualized against the approximate pool TVL, this is about `28% APR` before compounding, slippage, keeper costs, and AERO price movement.

Revenue components for this vault:

| Component | Directly earned by vault? | Notes |
| --- | --- | --- |
| AERO emissions | Yes | Claimed from the gauge with `getReward(address(this))`; this is the main harvestable yield. |
| LP trading fees while staked | No | Aerodrome basic-gauge staking redirects the fees on staked LP tokens to `FeesVotingReward` for veAERO voters. |
| Bribes / voting incentives | No | These accrue to veAERO voters that vote for the pool, not to LP stakers. |
| AERO price exposure | Yes | The vault is long AERO through both the LP inventory and claimed emissions until compounded. |
| Impermanent loss | Yes | The position should be compared to holding 50% USDC and 50% AERO, not to holding 100% USDC. |
| Compounding edge | Maybe | Frequent compounding can improve realized return when emissions are large enough, but small harvests can be eaten by swap slippage and keeper gas. |

Practical expected yield:

- The gross harvestable yield is the gauge AERO emission stream.
- A reasonable base-case range for realized vault APR is lower than the headline emission APR after slippage, price impact, keeper incentives, idle cash, and time between harvests.
- The biggest risk is not smart-contract gas cost; it is AERO inventory risk. A 50% fall in AERO can overwhelm weeks of emissions, while a rising AERO price can make the strategy look much better than the emission APR alone.

## Sources Checked

- Aerodrome docs: https://aerodrome.finance/docs
- Aerodrome liquidity page: https://aerodrome-finance.app/liquidity/
- Aerodrome contracts repository: https://github.com/aerodrome-finance/contracts
- Base RPC reads on 2026-09-22 via `https://mainnet.base.org`
- AERO price context: https://www.coingecko.com/en/coins/aerodrome-finance
