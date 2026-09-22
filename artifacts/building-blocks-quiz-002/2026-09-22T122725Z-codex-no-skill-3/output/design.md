# Aerodrome USDC/WETH Vault Design

## Scope

This design targets Aerodrome's Basic Volatile WETH/USDC pool on Base, not
Slipstream concentrated liquidity. That choice keeps the vault position as a
fungible ERC20 LP token that can be staked in an Aerodrome gauge.

Base mainnet contracts used by this design:

| Contract | Address |
| --- | --- |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| WETH | `0x4200000000000000000000000000000000000006` |
| AERO | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` |
| Aerodrome Router | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` |
| Aerodrome Voter | `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5` |
| Basic Volatile WETH/USDC pool | `0xcDAC0d6c6C59727a65F871236188350531885C43` |
| Pool gauge | `0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025` |
| Gauge fee voting reward | `0x14df87824a11DC27afF185D3149E05aaa4735f60` |

The pool and gauge were resolved from the deployed Aerodrome contracts:
`PoolFactory.getPool(USDC, WETH, false)`, then `Voter.gauges(pool)`. Deployment
scripts should re-check these values and fail closed if `Gauge.stakingToken()`
is not the configured pool or `Gauge.rewardToken()` is not AERO.

## Position Lifecycle

Deposits are converted into the pool's required WETH/USDC balance, supplied to
Aerodrome through the Router, and the received LP tokens are immediately staked
in the pool gauge.

The vault accounting token represents a pro-rata claim on:

- staked WETH/USDC LP tokens held through the gauge;
- any idle WETH, USDC, AERO, or LP dust left from deposits and harvests;
- the current mark-to-market value of the LP position, including WETH price
  exposure and impermanent loss.

The vault does not hold a veAERO NFT and does not vote. It is an LP emissions
compounder, not a veAERO fee/bribe strategy.

## `harvest()` Flow

`harvest()` is called by an authorized keeper on the vault. The keeper must call
the vault, not the gauge directly: `Gauge.getReward(account)` only allows
`msg.sender == account` or the Aerodrome Voter, so the vault must call
`gauge.getReward(address(this))` itself.

Exact flow:

1. Optionally call `Voter.distribute(gauge)` before claiming.
   This pushes newly claimable epoch emissions into the gauge when they have not
   already been distributed. It is not the vault's reward claim; it funds the
   gauge's AERO reward stream. When Aerodrome notifies a classic pool gauge of
   new rewards, the gauge also pulls accumulated pool fees from the pool and
   forwards them to the fee voting reward contract for voters.

2. Claim AERO emissions from the Aerodrome gauge:

   ```solidity
   IAerodromeGauge(GAUGE).getReward(address(this));
   ```

   This claims only `Gauge.rewardToken()`, which is AERO for this gauge. It pays
   the vault its accrued share of the gauge emission stream based on the vault's
   staked LP balance and time staked.

3. If claimed AERO is below `minHarvestAmount`, stop and leave it idle for the
   next harvest.

4. Take any configured performance fee from the claimed AERO before compounding.
   The fee should be capped and sent to the fee recipient in AERO, avoiding
   extra swaps.

5. Swap the remaining AERO into WETH and USDC through Aerodrome Router routes
   with strict `amountOutMin` values. The split should target the current pool
   ratio, not a blind 50/50 notional split, because the LP deposit must match
   pool reserves.

6. Add liquidity to the Basic Volatile WETH/USDC pool:

   ```solidity
   IRouter(ROUTER).addLiquidity(
       WETH,
       USDC,
       false,
       wethDesired,
       usdcDesired,
       minWeth,
       minUsdc,
       address(this),
       deadline
   );
   ```

7. Stake the new LP tokens back into the same gauge:

   ```solidity
   IERC20(POOL).approve(GAUGE, lpAmount);
   IAerodromeGauge(GAUGE).deposit(lpAmount);
   ```

8. Leave small WETH/USDC/AERO dust in the vault. It is included in total assets
   and can be used by the next deposit or harvest.

`harvest()` must protect all swaps and liquidity adds with keeper-supplied or
oracle-bounded slippage limits. The keeper should be unable to set routes that
send assets through unrelated or illiquid pools.

## What The Position Earns

The realistic return stack is:

1. AERO emissions from the gauge.
   This is the vault's only periodic claimable reward in this design. Aerodrome
   voters direct weekly emissions to gauges, and staked LPs earn the gauge's
   AERO stream pro rata. This APR is variable and depends on veAERO votes,
   total staked liquidity, AERO price, and epoch timing.

2. Autocompounding effect.
   Harvested AERO is sold into WETH/USDC and added back to the LP position, so
   future emissions accrue on a larger staked LP balance. Net compounding yield
   is reduced by swap slippage, pool deposit imbalance, keeper gas, and any
   performance fee.

3. WETH/USDC LP price exposure.
   LP share value changes with the WETH price and AMM inventory. The vault is
   economically long a WETH/USDC LP position, not a stable yield product.
   Impermanent loss versus simply holding WETH and USDC can be larger than
   emissions during volatile periods.

4. No direct swap-fee yield while staked.
   Aerodrome's UI may show both fee APR and emission APR for the pool, but this
   vault should model the staked-LP return as AERO emissions only. The pool's
   swap fees are generated by the position's liquidity, but they are not claimed
   by the vault while its LP tokens are staked in the gauge.

As a concrete sanity check, Aerodrome's liquidity page recently listed the Basic
Volatile WETH/USDC market with separate fee and emission APRs. For this vault,
the emission APR is the relevant LP harvest input; the displayed fee APR is
revenue routed to the voting side of the Aerodrome system, not extra vault
harvestable yield.

## Where Swap Fees Go

For a classic Aerodrome pool, swap fees are not left inside pool reserves. The
pool transfers fee amounts to its `PoolFees` helper and tracks them by LP-token
ownership.

Because this vault stakes its LP tokens, the gauge becomes the LP-token holder
from the pool's perspective. On Aerodrome's epoch distribution path,
`Gauge.notifyRewardAmount()` calls the gauge's internal fee claim flow:

1. The gauge calls `Pool.claimFees()` on the WETH/USDC pool.
2. The pool transfers the gauge's accumulated WETH and USDC fees from
   `PoolFees`.
3. The gauge notifies its `FeesVotingReward` contract with those WETH and USDC
   amounts.
4. `FeesVotingReward` distributes those fees in the following epoch to veAERO
   voters who voted for that pool.

So in this design, swap fees end up with veAERO voters for the WETH/USDC gauge,
not with vault depositors. The vault's LPs relinquish the direct fee claim in
exchange for access to AERO emissions.

If the vault ever chose to hold LP tokens unstaked, then it could claim pool fees
directly from `Pool.claimFees()`, but it would stop earning gauge emissions on
those unstaked LP tokens. That is a different strategy and should not be mixed
into this harvest flow.

## References

- Aerodrome contracts README:
  https://github.com/aerodrome-finance/contracts/blob/main/README.md
- Aerodrome protocol specification:
  https://github.com/aerodrome-finance/contracts/blob/main/SPECIFICATION.md
- Classic gauge implementation:
  https://github.com/aerodrome-finance/contracts/blob/main/contracts/gauges/Gauge.sol
- Classic pool implementation:
  https://github.com/aerodrome-finance/contracts/blob/main/contracts/Pool.sol
- Aerodrome liquidity docs:
  https://github.com/aerodrome-finance/docs/blob/main/content/liquidity.mdx
