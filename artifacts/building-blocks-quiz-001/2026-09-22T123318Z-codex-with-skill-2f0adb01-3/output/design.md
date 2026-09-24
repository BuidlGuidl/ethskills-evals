# USDC Yield Vault Design

## Strategy Choice

The vault deposits native Base USDC into Aerodrome's basic volatile USDC/AERO pool and stakes the resulting LP token in the pool gauge.

Target position:

| Item | Address |
| --- | --- |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| AERO | `0x940181a94A35A4569E4529A3CDfB74e38FD98631` |
| Aerodrome router | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43` |
| Aerodrome pool factory | `0x420DD381b31aEf6683db6B902084cB0FFECe40Da` |
| USDC/AERO volatile pool LP | `0x6cDcb1C4A4D1C3C6d054b27AC5B77e89eAFb971d` |
| USDC/AERO gauge | `0x4F09bAb2f0E15e2A078A227FE1537665F55b8360` |
| Aerodrome voter | `0x16613524e02ad97eDfeF371bC883F2F5d6C480A5` |

Why this pool:

- Aerodrome is the primary liquidity venue on Base, and its gauge system is built for exactly this strategy: LP tokens are staked in a gauge and earn AERO emissions.
- The USDC/AERO volatile pool is one of the most direct AERO-compounding pools because the reward token is also one side of the LP. Harvesting only needs to swap part of the claimed AERO into USDC, then add both sides back to the same pool.
- The basic vAMM LP is simpler than Slipstream concentrated liquidity. We avoid ERC-721 position accounting, range selection, tick rebalancing, and the additional keeper logic that concentrated liquidity would require.
- The tradeoff is real AERO exposure. User deposits are denominated in USDC, but the deployed position becomes roughly 50% USDC and 50% AERO by value. This is not a stablecoin-only vault.

## Deposit Flow

When a user deposits USDC:

1. Pull USDC from the user into the vault.
2. Swap the amount of USDC needed to acquire the target amount of AERO for a balanced LP deposit.
   - Use `AerodromeRouter.swapExactTokensForTokens`.
   - Route: `USDC -> AERO`, `stable = false`, `factory = 0x420DD381b31aEf6683db6B902084cB0FFECe40Da`.
3. Add liquidity through `AerodromeRouter.addLiquidity`.
   - `tokenA = USDC`
   - `tokenB = AERO`
   - `stable = false`
   - `to = address(this)`
4. Approve the received LP token to the gauge.
5. Stake the LP token in `0x4F09bAb2f0E15e2A078A227FE1537665F55b8360` by calling `deposit(uint256 amount)`.

The implementation should quote the swap and liquidity amounts immediately before execution and enforce slippage bounds. Any dust left after add-liquidity should remain in the vault and be included in `totalAssets()`.

## Harvest Flow

`harvest()` claims AERO emissions from the USDC/AERO gauge, compounds them into more USDC/AERO LP, and stakes the new LP.

Exact flow:

1. Claim AERO rewards from the gauge:
   - Contract: USDC/AERO gauge `0x4F09bAb2f0E15e2A078A227FE1537665F55b8360`
   - Call: `getReward(address(this))`
   - Claimed token: AERO `0x940181a94A35A4569E4529A3CDfB74e38FD98631`
2. Read the vault's new AERO balance.
3. Swap enough claimed AERO into USDC to match the pool's current reserve ratio.
   - Contract: Aerodrome router `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43`
   - Call: `swapExactTokensForTokens`
   - Route: `AERO -> USDC`, `stable = false`, `factory = 0x420DD381b31aEf6683db6B902084cB0FFECe40Da`
4. Add liquidity back into the same pool:
   - Contract: Aerodrome router
   - Call: `addLiquidity(USDC, AERO, false, amountUSDC, amountAERO, minUSDC, minAERO, address(this), deadline)`
   - Received token: USDC/AERO volatile pool LP `0x6cDcb1C4A4D1C3C6d054b27AC5B77e89eAFb971d`
5. Stake the newly received LP:
   - Contract: USDC/AERO gauge
   - Call: `deposit(newLpAmount)`
6. Emit a `Harvest` event with at least:
   - claimed AERO
   - AERO swapped to USDC
   - USDC added
   - AERO added
   - LP tokens minted and staked

Important non-flow:

- Do not call `claimFees()` for this staked position. In Aerodrome's model, staked LP earns AERO emissions instead of direct swap fees; the fees from staked liquidity are distributed to veAERO voters.
- Do not rely on a hard-coded 50/50 token split. For a volatile pool, the correct add-liquidity ratio should be derived from current reserves or router quotes at harvest time.

## What The Position Earns

This vault has three economic components.

### 1. AERO gauge emissions

This is the main explicit yield source. The staked LP position earns AERO from the gauge pro rata with its share of the gauge's staked LP supply.

As of September 22, 2026, direct Base mainnet reads for the selected gauge/pool showed:

| Metric | Value |
| --- | ---: |
| Gauge reward token | AERO |
| Gauge `rewardRate()` | `0.478387830168805517` AERO/sec |
| Implied annual emissions | about `15,086,439` AERO/year |
| Pool reserves | about `18.19M` USDC and `26.30M` AERO |
| Implied AERO price from pool reserves | about `$0.6915` |
| Pool TVL from reserves | about `$36.37M` |
| Staked LP share of pool supply | about `99.35%` |
| Staked TVL estimate | about `$36.13M` |
| Implied gross emissions APR | about `28.9%` before slippage, gas, fees, and price movement |

This APR is not fixed. Aerodrome gauges are controlled by weekly veAERO voting, so the gauge's reward rate can change every epoch. The current `periodFinish()` for the observed stream is September 24, 2026 at 00:00 UTC.

### 2. Compounding effect

Each harvest converts claimed AERO into additional LP and stakes it, increasing the vault's future share of emissions. The compounding benefit depends on:

- harvest frequency
- Base gas costs
- swap price impact
- slippage settings
- the vault's size relative to the pool and gauge

For this pool, harvesting weekly or a few times per week is reasonable for a small vault. Harvesting too frequently can leak value through swaps even when gas is cheap.

### 3. Price and LP exposure

The vault does not earn direct swap fees while its LP is staked in the gauge. The user's return is the value of:

`USDC reserves owned + AERO reserves owned + unharvested AERO rewards + idle dust`

minus:

`impermanent loss + swap slippage + gas + keeper fee/performance fee`

Because the pool is USDC/AERO, the vault is long AERO. If AERO falls against USDC, the vault can lose USDC-denominated value even while receiving emissions. If AERO rises, the vault benefits from AERO exposure but still experiences AMM rebalancing versus simply holding the initial token mix.

## Accounting Notes

- Use ERC-4626 shares with USDC as `asset()`.
- `totalAssets()` should value all vault holdings in USDC terms:
  - idle USDC
  - idle AERO marked through a conservative onchain quote
  - staked LP share of pool reserves
  - accrued but unclaimed AERO from `gauge.earned(address(this))`
- For deposits and withdrawals, apply slippage checks and consider a small withdrawal buffer in idle USDC to avoid forcing LP exits for tiny redemptions.
- Keeper permissions should be open or role-gated, but harvest profitability should be protected by minimum-output parameters so a malicious or stale keeper cannot compound at a bad price.

## References

- Aerodrome docs: AERO is distributed as LP rewards, epochs run weekly, and staked liquidity earns emissions while fees route to voters.
- Aerodrome router interface: `Route`, `swapExactTokensForTokens`, and `addLiquidity`.
- Aerodrome gauge interface: `stakingToken()`, `rewardToken()`, `earned(address)`, `getReward(address)`, and `deposit(uint256)`.
- Base mainnet contract reads performed September 22, 2026 against `https://mainnet.base.org`.
