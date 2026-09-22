# Dynamic Volatility Fee Hook

This project implements the onchain piece as a Uniswap v4 hook:

- `DynamicVolatilityFeeHook` is the contract to deploy for the live pool.
- `IVolatilityOracle` is the volatility-signal boundary. The hook only asks for a normalized volatility score in basis points.
- `MockVolatilityOracle` is a test/staging stub and should be replaced by the production signal before mainnet launch.

## How The Fee Is Decided

The hook keeps three fee-policy values:

- `calmFee`: LP fee used when the volatility score is below the threshold.
- `volatileFee`: LP fee used when the volatility score is at or above the threshold.
- `volatilityThresholdBps`: the cutoff returned by `IVolatilityOracle.volatilityBps`.

Uniswap v4 LP fees are `uint24` values measured in hundredths of a bip, so:

- `500` = 0.05%
- `3_000` = 0.30%
- `10_000` = 1.00%
- `1_000_000` = 100%, the maximum accepted by v4

On every swap, Uniswap v4 calls `beforeSwap` because the hook address is deployed with the `BEFORE_SWAP_FLAG` address bit. The hook verifies the caller is the configured PoolManager, verifies the pool key matches the one configured with `setTargetPool`, reads volatility through `IVolatilityOracle`, chooses `calmFee` or `volatileFee`, and returns:

```solidity
fee | LPFeeLibrary.OVERRIDE_FEE_FLAG
```

That override flag tells PoolManager to use this returned LP fee for the current swap. The hook returns `BeforeSwapDeltaLibrary.ZERO_DELTA`, so it does not take custom hook fees and does not alter swap amounts.

## Deployment Requirements

This must be launched as a Uniswap v4 dynamic-fee pool from day one:

1. Deploy or select the production volatility oracle.
2. Deploy `DynamicVolatilityFeeHook` with the canonical Ethereum mainnet v4 PoolManager address, the oracle address, and the initial calm/volatile fee policy.
3. The hook must be deployed to an address whose low 14 bits exactly match its enabled permissions. This hook only enables `BEFORE_SWAP_FLAG`, so the required low-bit mask is `1 << 7` (`0x0080`). Use CREATE2 address mining/deployment tooling for the final salt, then confirm `hasExpectedHookAddress()` returns true.
4. Create the pool with:
   - `fee = LPFeeLibrary.DYNAMIC_FEE_FLAG` (`0x800000`)
   - `hooks = <deployed hook address>`
   - the intended token pair and tick spacing
5. Call `setTargetPool(poolKey)` on the hook before the pool is opened for trading. This is a one-time lock to that exact pool id.
6. Initialize the pool and seed liquidity.

Dynamic-fee capability is immutable at pool creation. If the pool is created as a static-fee v4 pool, or with a different hook address, this contract cannot retrofit dynamic fees later. The benefit of the v4 hook design is that once the correct dynamic-fee pool exists, liquidity stays in that pool while the hook automatically updates the effective fee per swap.

The owner can update the oracle and fee policy after deployment. In production, that owner should be a timelock or governance-controlled multisig, because these settings directly affect every swap in the token's primary pool.
