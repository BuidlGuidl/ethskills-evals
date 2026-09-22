# Base USDC Yield Vault

First-version Foundry implementation of a USDC vault for Base. Users deposit native USDC, the strategy swaps half into WETH, adds Aerodrome WETH/USDC volatile liquidity, stakes the LP in the pool gauge, and lets an authorized keeper call `harvest()` to claim AERO rewards and compound them back into the LP.

This is not audited production code. The current `totalAssets()` values the LP from pool reserves, which is simple and testable but can be manipulated by short-lived pool price movement. Before handling meaningful capital, add TWAP/oracle checks, deposit caps, fork tests at pinned Base blocks, monitoring, and an external audit.

## Verified Base integrations

Checked on September 22, 2026.

| Item | Address / evidence |
| --- | --- |
| Native USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`; Circle lists this as native USDC on Base, distinct from bridged USDbC. https://www.circle.com/blog/usdc-now-available-natively-on-base |
| WETH | `0x4200000000000000000000000000000000000006`; Uniswap's Base deployment docs list this as Base WETH. https://developers.uniswap.org/docs/protocols/v3/deployments/v3-base-deployments |
| Aerodrome router | `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43`; Aerodrome security page contract table. https://aerodrome-finance.app/security/ |
| Aerodrome pool factory | `0x420DD381b31aEf6683db6B902084cB0FFECe40Da`; Aerodrome security page contract table. https://aerodrome-finance.app/security/ |
| AERO reward token | `0x940181a94A35A4569E4529A3CDfB74e38FD98631`; Aerodrome security page contract table. https://aerodrome-finance.app/security/ |
| WETH/USDC volatile pool | `0xcDAC0d6c6C59727a65F871236188350531885C43`; `PoolFactory.getPool(USDC, WETH, false)` on Base block `51645276`. |
| WETH/USDC gauge | `0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025`; `Voter.gauges(pool)` on Base block `51645276`; `Voter.isAlive(gauge)` returned true. |
| Pool liquidity/activity | Aerodrome's liquidity page showed the WETH/USDC basic volatile pool with about `$7.39M` TVL, `$826k` volume, and active emissions when checked. https://aerodrome-finance.app/liquidity/ |

The strategy uses Aerodrome's basic volatile pool rather than concentrated liquidity for v1 because ERC20 LP tokens plus a gauge give a compact, transparent deposit, withdrawal, and reward-compounding lifecycle. Aerodrome is also Base-native and exposes live AERO emissions for this pool. Concentrated liquidity can be added later behind the same vault shape once position accounting, ranges, and rebalancing are fully designed.

## Contracts

- `BaseUsdcVault`: share token, user deposits/redeems, owner-managed keepers, and the public `harvest()` entrypoint.
- `AerodromeUsdcWethStrategy`: swaps USDC/WETH through Aerodrome, adds/removes volatile liquidity, stakes LP, claims AERO, and compounds rewards.
- `test/mocks/*`: deterministic local Aerodrome-like mocks used by the test suite.

## Build and test

```bash
forge build
forge test
```

## Deployment

Deploy on Base mainnet with the verified addresses above:

```bash
forge create src/AerodromeUsdcWethStrategy.sol:AerodromeUsdcWethStrategy \
  --rpc-url $BASE_RPC_URL \
  --private-key $DEPLOYER_KEY \
  --constructor-args \
  0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  0x4200000000000000000000000000000000000006 \
  0x940181a94A35A4569E4529A3CDfB74e38FD98631 \
  0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43 \
  0xcDAC0d6c6C59727a65F871236188350531885C43 \
  0x519BBD1Dd8C6A94C46080E24f316c14Ee758C025 \
  0x420DD381b31aEf6683db6B902084cB0FFECe40Da \
  false \
  $OWNER

forge create src/BaseUsdcVault.sol:BaseUsdcVault \
  --rpc-url $BASE_RPC_URL \
  --private-key $DEPLOYER_KEY \
  --constructor-args \
  0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  $STRATEGY \
  $OWNER \
  "Base USDC Yield Vault" \
  "byvUSDC"
```

After both deployments:

```bash
cast send $STRATEGY "setVault(address)" $VAULT --rpc-url $BASE_RPC_URL --private-key $OWNER_KEY
cast send $VAULT "setKeeper(address,bool)" $KEEPER true --rpc-url $BASE_RPC_URL --private-key $OWNER_KEY
```

## Keeper operation

Keepers call `BaseUsdcVault.harvest(HarvestParams)` when pending AERO rewards justify gas and slippage. The keeper should quote Aerodrome offchain immediately before sending the transaction and set conservative `minUsdcFromReward`, `minWethOut`, `minWethToLp`, `minUsdcToLp`, `minLpOut`, and a short `deadline`.

`harvest()` performs this flow:

1. Claim AERO from the WETH/USDC gauge.
2. Swap AERO to USDC through Aerodrome.
3. Swap half of idle USDC to WETH.
4. Add WETH/USDC volatile liquidity.
5. Stake the new LP tokens back into the gauge.

Deposits and withdrawals also carry explicit slippage params. Frontends should quote Aerodrome immediately before prompting users to sign.
