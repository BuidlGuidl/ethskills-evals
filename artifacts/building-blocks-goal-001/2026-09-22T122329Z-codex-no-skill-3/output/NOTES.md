# Volatility Fee Hook Notes

This project implements a Uniswap v4 dynamic-fee hook for the token's primary mainnet pool.

## How The Fee Is Chosen

- `VolatilityFeeHook` runs in `beforeSwap`.
- It checks that the pool was created with `LPFeeLibrary.DYNAMIC_FEE_FLAG`.
- It computes the pool id from the full `PoolKey`.
- It requires that the owner has enabled that exact pool id.
- It reads `IVolatilityOracle.volatilityBips(poolId)`.
- It maps that signal to three fee tiers:
  - below `normalThresholdBips`: `calmFee`
  - from `normalThresholdBips` up to `volatileThresholdBips`: `normalFee`
  - at or above `volatileThresholdBips`: `volatileFee`

Uniswap v4 LP fees are in hundredths of a bip. Examples:

- `500` = 0.05%
- `3000` = 0.30%
- `10000` = 1.00%

`beforeSwap` returns `chosenFee | LPFeeLibrary.OVERRIDE_FEE_FLAG`, which tells PoolManager to use that LP fee for the current swap. The hook does not move liquidity and does not require creating a replacement pool when the fee changes.

## Volatility Stub

`IVolatilityOracle` is the integration boundary. `ManualVolatilityOracle` is included only as a simple deployable stub so tests, rehearsals, or a guarded initial launch can set `volatilityBips` manually. The production signal can be another contract as long as it implements the same interface, and the hook owner can update `volatilityOracle`.

## Deployment Checklist

1. Choose the production fee config. Ensure `calmFee <= normalFee <= volatileFee`, each fee is at most `1_000_000`, and thresholds are ordered.
2. Deploy or choose the volatility oracle.
3. Mine/deploy `VolatilityFeeHook` to an address whose low bits include Uniswap v4's `BEFORE_SWAP_FLAG`. The constructor validates this permission pattern and will revert at an ordinary address. Use the v4 periphery `HookMiner`/CREATE2 flow or an equivalent deterministic deployer.
4. Create the pool with:
   - the deployed hook address in `PoolKey.hooks`
   - `PoolKey.fee = LPFeeLibrary.DYNAMIC_FEE_FLAG`
   - the intended token pair and tick spacing
5. Call `setPoolEnabled(poolKey, true)` on the hook before public trading. This binds swaps to the exact pool key.
6. Initialize the pool and add liquidity through the normal v4 PoolManager/periphery flow.
7. Wire the real volatility oracle with `setVolatilityOracle` when ready. This does not redeploy the hook or migrate liquidity.

Admin control over the oracle and fee config is powerful. Before mainnet launch, decide whether ownership stays with a timelock/multisig, is constrained by governance, or is renounced after the signal and bounds are final.
