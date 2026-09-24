# Volatility Fee Hook

Foundry project for a Uniswap v4 dynamic-fee hook that adjusts the pool LP fee on every swap.

## Contracts

- `VolatilityFeeHook`: `beforeSwap` hook that reads a volatility oracle and returns a Uniswap v4 LP-fee override.
- `IVolatilityOracle`: interface for the future volatility signal.
- `ManualVolatilityOracle`: simple owned stub oracle for rehearsals or early integration.
- `Owned`: minimal ownership helper used by the hook and stub oracle.

## Build

```sh
forge build
```

See `NOTES.md` for fee behavior and deployment requirements.
