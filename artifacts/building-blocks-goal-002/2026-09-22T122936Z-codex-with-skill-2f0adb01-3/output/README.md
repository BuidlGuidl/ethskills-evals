# Base USDC Aerodrome Yield Vault

This is a first Foundry implementation of an onchain USDC vault for Base. Users deposit USDC into `BaseUsdcYieldVault` and receive vault shares. The strategy swaps half the USDC to WETH, adds USDC/WETH volatile liquidity through Aerodrome, stakes the LP tokens in the pool gauge, and lets a keeper call `harvest()` to claim AERO rewards, swap them back through WETH to USDC, and compound into more LP.

## Build and Test

```sh
forge build
forge test
```

## Deployment

Deploy on Base mainnet with the canonical Base assets and Aerodrome contracts:

- USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- WETH: `0x4200000000000000000000000000000000000006`
- AERO: `0x940181a94A35A4569E4529A3CDfB74e38FD98631`
- Aerodrome Router: `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43`
- Aerodrome PoolFactory: `0x420DD381b31aEf6683db6B902084cB0FFECe40Da`
- Use the live USDC/WETH volatile pool and its matching gauge.

Order:

1. Deploy `BaseUsdcYieldVault` with USDC and the owner address.
2. Deploy `AerodromeUsdcWethStrategy` with the vault, USDC, WETH, AERO, router, gauge, pool, factory, owner, and keeper.
3. Call `vault.setStrategy(strategy)` before accepting deposits.
4. Verify the contracts on Basescan and run a small deposit/withdrawal canary before opening deposits.

## Keeper Operation

The keeper calls `strategy.harvest()`. The keeper-only overload `harvest(uint256 minUsdcFromReward, uint256 minWethFromUsdc)` is available for production jobs that want slippage limits on reward and rebalance swaps. Harvest claims gauge rewards, swaps AERO to USDC through WETH, adds fresh USDC/WETH liquidity, and stakes the new LP tokens back into the gauge.

## Integration Choices

Aerodrome is the native liquidity venue on Base and its contracts expose the exact building blocks this strategy needs: router swaps, router liquidity management, and gauge staking for emissions. The vault uses native Base USDC as its accounting asset and WETH as the paired asset because USDC/WETH is a core Base liquidity route.

This v1 intentionally keeps valuation simple: LP value is read from the pool reserves and WETH spot quote. That is fine for local tests and an initial implementation, but production deployment should add stronger oracle/TWAP checks, tighter harvest slippage policy, emergency controls, and an audit before holding meaningful funds.
