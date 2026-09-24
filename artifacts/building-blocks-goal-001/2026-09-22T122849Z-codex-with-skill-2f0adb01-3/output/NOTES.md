# Dynamic Volatility Fee Hook

This project implements the onchain piece as a Uniswap v4 hook. The deployed pool must be a v4 dynamic-fee pool, because Uniswap v2/v3 pools cannot change their fee tier without moving liquidity to another pool.

## How The Fee Is Decided

`DynamicVolatilityFeeHook.beforeSwap` runs before each swap for the pool.

1. The v4 `PoolManager` calls `beforeSwap` because the hook address has the `BEFORE_SWAP_FLAG` permission bit.
2. The hook asks `IVolatilityOracle.volatilityBps(...)` for the current volatility signal. The included `ManualVolatilityOracle` is only a stub so the signal can be wired in later.
3. The hook maps that signal to one of three configured LP fees:
   - below `normalVolatilityBps`: `calmFee`
   - at or above `normalVolatilityBps`: `normalFee`
   - at or above `volatileVolatilityBps`: `volatileFee`
4. The hook returns that fee with Uniswap v4's `LPFeeLibrary.OVERRIDE_FEE_FLAG`.
5. The `PoolManager` strips the override flag, validates the fee, and applies it to that swap.

Uniswap v4 fees are measured in hundredths of a basis point. Examples:

- `500` = 0.05%
- `3000` = 0.30%
- `10000` = 1.00%

## Deployment Requirements

Mainnet v4 `PoolManager`: `0x000000000004444c5dc75cB358380D2e3dE08A90`.

Deploying correctly is the important part:

1. Deploy or select an oracle that implements `IVolatilityOracle`.
2. Mine a `CREATE2` salt for `DynamicVolatilityFeeHook` so the deployed hook address has exactly the `BEFORE_SWAP_FLAG` permission bits in its low 14 bits. The constructor arguments, including `initialOwner`, are part of the init code hash, so mine the salt against the exact launch parameters. The hook constructor validates the final address and will revert if it is wrong.
3. Initialize the Uniswap v4 pool with:
   - `hooks = DynamicVolatilityFeeHook`
   - `fee = LPFeeLibrary.DYNAMIC_FEE_FLAG` (`0x800000`)
   - token currencies sorted as v4 requires
   - your chosen tick spacing and initial price
4. Add liquidity to that initialized pool.
5. Route launch liquidity and swaps to this v4 pool.

Once the pool is live, liquidity does not need to migrate for the fee to change. Every swap calls the hook and receives a fresh fee override. The owner can update fee thresholds, fee tiers, or the oracle address, so production ownership should be a multisig/timelock with clear launch parameters.
