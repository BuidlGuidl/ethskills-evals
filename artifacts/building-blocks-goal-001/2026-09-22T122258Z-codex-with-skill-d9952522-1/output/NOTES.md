# Volatility Dynamic Fee Hook

This project implements the deployable onchain piece as a Uniswap v4 hook.

The pool must be created as a v4 dynamic-fee pool, using `LPFeeLibrary.DYNAMIC_FEE_FLAG` (`0x800000`) as the pool fee and this hook as `PoolKey.hooks`. On each swap, the v4 `PoolManager` calls `beforeSwap`. The hook reads a volatility score from `IVolatilityOracle.currentVolatilityBps`, maps that score into one of three configured LP fees, and returns:

```solidity
lpFee | LPFeeLibrary.OVERRIDE_FEE_FLAG
```

Uniswap v4 treats that returned value as the LP fee for the current swap when the pool is dynamic. The hook does not move liquidity and does not need to redeploy the pool. It also does not write the fee into pool storage on every swap; it returns a per-swap override, so the decision is made freshly for each swap.

## Fee Decision

`VolatilityDynamicFeeHook.FeeConfig` contains:

- `calmFee`: fee used below `elevatedVolatilityBps`
- `normalFee`: fee used from `elevatedVolatilityBps` up to `highVolatilityBps`
- `volatileFee`: fee used at or above `highVolatilityBps`

Fees use Uniswap v4 LP fee units: hundredths of a basis point. Examples:

- `500` = 0.05%
- `3000` = 0.30%
- `10000` = 1.00%

The included `ManualVolatilityOracle` is intentionally only a stub. It lets the owner set a manual `volatilityBps` value for testing and launch rehearsal. A production oracle can replace it through `setVolatilityOracle` without changing the pool or hook address.

## Deployment Checklist

1. Choose sorted pool currencies, tick spacing, and fee bands.
2. Deploy the volatility oracle or the temporary `ManualVolatilityOracle`.
3. Deploy `VolatilityDynamicFeeHook` to an address whose low permission bits equal Uniswap v4's `BEFORE_SWAP_FLAG` and no other hook flags. In practice this means using `CREATE2` salt mining. The constructor calls `Hooks.validateHookPermissions`, so deployment reverts if the address bits are wrong.
4. Initialize the pool with:
   - the sorted currencies used in the hook constructor
   - `fee = LPFeeLibrary.DYNAMIC_FEE_FLAG`
   - the same tick spacing
   - `hooks = address(VolatilityDynamicFeeHook)`
5. Add liquidity to that v4 pool.
6. Transfer hook and oracle ownership to the launch multisig or governance owner.
7. Before mainnet launch, fork-test swaps through the intended router path and confirm emitted `Swap` events show the selected fee.

The hook is intentionally scoped to one pool. If it is called for any other pool key, a static-fee pool, or by anyone other than the canonical v4 `PoolManager`, it reverts.

## Primary References Checked

Checked on 2026-09-22:

- Uniswap v4 dynamic fees docs: https://developers.uniswap.org/docs/protocols/v4/concepts/dynamic-fees
- Uniswap v4 hook deployment docs: https://developers.uniswap.org/docs/protocols/v4/guides/hooks/hook-deployment
- Uniswap v4 `LPFeeLibrary`: https://github.com/Uniswap/v4-core/blob/main/src/libraries/LPFeeLibrary.sol
- Uniswap v4 `Hooks` library: https://github.com/Uniswap/v4-core/blob/main/src/libraries/Hooks.sol
