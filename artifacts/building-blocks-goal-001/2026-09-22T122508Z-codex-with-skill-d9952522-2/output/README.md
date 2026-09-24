# Volatility Dynamic Fee Hook

Foundry project for a Uniswap v4 dynamic-fee hook. The hook reads a pluggable volatility signal on every swap and returns a Uniswap v4 LP fee override so the pool charges a lower fee in calm periods and a higher fee in volatile periods.

## Build

```shell
forge build
```

## Test

```shell
forge test
```

## Contracts

- `src/VolatilityDynamicFeeHook.sol`: deployable Uniswap v4 `beforeSwap` hook.
- `src/interfaces/IVolatilityOracle.sol`: interface for the replaceable volatility signal.
- `src/StubVolatilityOracle.sol`: mutable stub oracle for rehearsals and tests.

See `NOTES.md` for deployment requirements, including v4 dynamic-fee pool setup and hook address mining.
