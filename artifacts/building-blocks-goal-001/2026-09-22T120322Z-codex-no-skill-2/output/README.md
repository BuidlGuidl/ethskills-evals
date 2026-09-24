# Volatility Dynamic Fee Hook

Foundry project for a Uniswap v4 hook that adjusts a dynamic-fee pool's LP fee on every swap using a pluggable volatility signal.

## Contracts

- `src/VolatilityDynamicFeeHook.sol`: deployable before-swap hook.
- `src/interfaces/IVolatilityOracle.sol`: volatility signal interface.
- `src/ManualVolatilityOracle.sol`: owner-controlled oracle stub.

See `NOTES.md` for fee behavior and deployment requirements.

## Build

```shell
forge build
```

## Format

```shell
forge fmt
```
