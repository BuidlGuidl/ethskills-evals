# Base USDC Yield Vault

First version of an onchain USDC vault for Base. Depositors receive vault shares, deposits are paired into WETH/USDC liquidity, and an authorized keeper calls `harvest()` to claim rewards and compound them back into the LP position.

## Contracts

- `BaseUsdcYieldVault`: ERC-4626-style share vault. It accepts USDC, mints shares, delegates capital to the strategy, and restricts `harvest()` to approved keepers.
- `BaseAerodromeStrategy`: pairs USDC with WETH through an Aerodrome-style router, stakes LP tokens in a gauge, values the LP position in USDC, withdraws liquidity for redemptions, and compounds gauge rewards.
- `src/interfaces`: small interfaces for ERC-20, Aerodrome router, pair, gauge, and the vault strategy boundary.
- `src/mocks` and `test/BaseYieldVault.t.sol`: deterministic mocks for local tests.

## Build And Test

```sh
forge build
forge test
```

## Deployment

Deploy on Base with verified token and Aerodrome addresses. The strategy keeps these as constructor arguments so deployment can select a specific WETH/USDC pool and gauge.

Typical Base mainnet inputs:

- USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- WETH: `0x4200000000000000000000000000000000000006`
- AERO reward token: `0x940181a94A35A4569E4529A3CDfB74e38FD98631`
- Aerodrome router: `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43`
- Aerodrome pool factory: `0x420DD381b31aEf6683db6B902084cB0FFECe40Da`

Deployment order:

1. Deploy `BaseUsdcYieldVault(asset, name, symbol, owner)`.
2. Deploy `BaseAerodromeStrategy(vault, asset, weth, reward, router, pool, gauge, factory, poolStable, rewardRouteStable, owner)`.
3. Call `vault.setStrategy(strategy)` from the owner.
4. Call `vault.setKeeper(keeper, true)` from the owner.
5. Verify both contracts on BaseScan and publish the selected pool/gauge addresses.

Use `poolStable = false` for the classic volatile WETH/USDC pair. If deploying against a concentrated-liquidity Aerodrome/Slipstream position, use a separate strategy because those gauges are NFT-position based and not the ERC-20 LP gauge modeled here.

## Keeper Operation

The keeper calls:

```solidity
vault.harvest(minRewardAssets, minPairedWeth, minLiquidity);
```

`harvest()` claims gauge rewards, swaps rewards to USDC, swaps half of the available USDC to WETH, adds WETH/USDC liquidity, and stakes the new LP tokens. The three minimum parameters are slippage guards:

- `minRewardAssets`: minimum USDC received from selling rewards.
- `minPairedWeth`: minimum WETH received when pairing USDC.
- `minLiquidity`: minimum LP tokens minted by `addLiquidity`.

The keeper should compute these values immediately before submitting the transaction using an offchain quote and a conservative slippage tolerance. Do not run harvest with all minimums set to zero in production.

## Integration Choice

Aerodrome was selected because it is the native liquidity hub on Base and exposes simple router, volatile-pair, and gauge primitives for a first vault version. That keeps the initial implementation focused on the requested USDC to WETH/USDC LP loop while still supporting reward compounding through the gauge.

Address references should be checked before mainnet deployment. Aerodrome publishes its Base contract table on its security page, including AERO, router, pool factory, and gauge factory addresses: https://aerodrome-finance.app/security/

## Risk Notes

This is an unaudited v1. Main risks are smart-contract bugs, Aerodrome dependency risk, volatile LP impermanent loss, keeper slippage settings, and stale or incorrect pool/gauge selection. The owner can update keeper permissions and set the strategy; the strategy owner can emergency-withdraw LP and idle USDC.

