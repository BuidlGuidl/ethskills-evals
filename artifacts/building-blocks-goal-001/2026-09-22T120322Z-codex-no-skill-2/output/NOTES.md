# Volatility Dynamic Fee Hook

This project implements the onchain piece as a Uniswap v4 dynamic-fee hook.

## Contracts

- `VolatilityDynamicFeeHook`: the deployable hook for the token's main pool.
- `IVolatilityOracle`: a small interface for the volatility signal we can replace later.
- `ManualVolatilityOracle`: an owner-controlled stub for rehearsals, testnets, or a temporary launch configuration.

## How The Fee Is Decided

Uniswap v4 LP fees are denominated in hundredths of a bip:

- `500` = 0.05%
- `3000` = 0.30%
- `10000` = 1.00%
- `1_000_000` = 100%

The hook stores a `FeeConfig`:

- `calmFee`: fee used when volatility is at or below `calmThresholdE18`
- `normalFee`: fee used between the calm and volatile thresholds
- `volatileFee`: fee used when volatility is at or above `volatileThresholdE18`

The volatility score is a normalized `1e18` value returned by `IVolatilityOracle.currentVolatility`.
The oracle can use any signal later: realized volatility, TWAP movement, offchain-posted risk scores, keeper-updated state, or a composite model. The hook only needs the final score.

If no oracle is configured, the hook treats the score as `calmThresholdE18`, which selects the calm fee. For production, configure a real oracle or a deliberate fallback before launch.

## How The Fee Is Applied On Each Swap

The pool must be created as a Uniswap v4 dynamic-fee pool by setting `PoolKey.fee` to:

```solidity
LPFeeLibrary.DYNAMIC_FEE_FLAG // 0x800000
```

On every swap, the v4 `PoolManager` calls `beforeSwap` because the hook address has the `BEFORE_SWAP_FLAG` permission bit. The hook:

1. Verifies the caller is the configured `PoolManager`.
2. Verifies the `PoolKey` is the exact target pool and uses the dynamic fee flag.
3. Reads the current volatility score from the configured oracle.
4. Maps that score to `calmFee`, `normalFee`, or `volatileFee`.
5. Returns `fee | LPFeeLibrary.OVERRIDE_FEE_FLAG`.

That returned override fee is used for the current swap. Liquidity stays in the same pool; there is no migration and no need to redeploy the pool to change fee bands or oracle logic.

## Correct Deployment Checklist

1. Decide the exact pool:
   - sorted `currency0` and `currency1`
   - tick spacing
   - canonical Uniswap v4 `PoolManager` for Ethereum mainnet
   - dynamic fee flag, not a static fee tier

2. Mine the hook deployment address:
   - v4 hook permissions are encoded in the low 14 bits of the hook address.
   - this contract expects exactly `BEFORE_SWAP_FLAG` and no other hook flags.
   - the low 14 bits therefore need to be `0x0080`.
   - deploy with `CREATE2` using the mined salt; the constructor reverts if the address is wrong.

3. Deploy or choose an oracle:
   - `ManualVolatilityOracle` is only a stub.
   - the production oracle should be hard to manipulate, bounded, observable, and cheap enough to call during swaps.
   - oracle reverts will revert swaps, so decide whether the production adapter should fail closed or expose a safe fallback.

4. Deploy `VolatilityDynamicFeeHook` with:
   - PoolManager address
   - sorted currencies
   - tick spacing
   - initial `FeeConfig`
   - oracle address, or zero only if calm-fee fallback is intentional

5. Initialize the v4 pool with:
   - the same sorted currencies
   - `fee = 0x800000`
   - the same tick spacing
   - `hooks = VolatilityDynamicFeeHook`

6. Add liquidity to that initialized pool.

7. Secure ownership:
   - transfer hook ownership to a multisig or timelock.
   - use ownership to update fee bands or swap in a production oracle.
   - transferring ownership to `address(0)` effectively burns admin control, so do that only if intentional.

## Operational Notes

- Fee changes are automatic because `beforeSwap` computes an override for each swap.
- `quoteFee` lets frontends, keepers, and monitoring systems preview the fee for a given `PoolKey` and `hookData`.
- The hook is intentionally scoped to one target pool ID. A different pool needs a separately deployed hook.
- This code does not mint the token or initialize/add liquidity for the pool; it is the hook/oracle piece those deployment scripts would use.
