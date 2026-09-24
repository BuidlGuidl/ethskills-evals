# Volatility Dynamic Fee Hook

Foundry project for a Uniswap v4 hook that adjusts a pool's dynamic LP fee from a pluggable volatility signal on every swap.

## Build

```sh
forge build
```

## Contracts

- `src/VolatilityFeeHook.sol`
  - `VolatilityFeeHook`: dynamic-fee hook for a Uniswap v4 pool.
  - `IVolatilitySignal`: interface for the volatility source.
  - `ManualVolatilitySignal`: owner-set stub signal.

See `NOTES.md` for the fee flow and deployment requirements.
