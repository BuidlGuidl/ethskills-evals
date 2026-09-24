# Volatility Dynamic Fee Hook

This project implements the onchain piece as a Uniswap v4 hook. The main pool must be initialized as a dynamic-fee pool, then `VolatilityDynamicFeeHook.beforeSwap` chooses the LP fee for each swap.

## Fee Decision Flow

1. A swap hits the Uniswap v4 `PoolManager`.
2. Because the pool key uses this hook address and that address has the `beforeSwap` permission bit, `PoolManager` calls `beforeSwap`.
3. The hook asks `feeOracle.getFee(key, params, hookData)` for the current fee. The oracle is deliberately abstracted behind `IVolatilityFeeOracle` so the volatility model can be replaced later.
4. If the oracle call succeeds and returns a fee no greater than `maxFee`, the hook uses it. Otherwise it falls back to `defaultFee`.
5. The hook returns `fee | LPFeeLibrary.OVERRIDE_FEE_FLAG`. For a v4 dynamic-fee pool, `PoolManager` uses that fee for this swap and emits it in the normal `Swap` event.

Fees are denominated in hundredths of a basis point:

- `500` = 0.05%
- `3000` = 0.30%
- `10000` = 1.00%

`StubVolatilityFeeOracle` is only a stub. Its owner sets a `volatilityScore`; scores at or above `volatileThreshold` return `volatileFee`, otherwise `calmFee`. A production oracle should replace this with a manipulation-resistant signal.

## Correct Deployment

- Use Ethereum mainnet Uniswap v4 `PoolManager`: `0x000000000004444c5dc75cB358380D2e3dE08A90`.
- Deploy the hook with CREATE2 at an address whose low permission bits exactly match `beforeSwap = true` and every other hook permission false. The constructor calls `Hooks.validateHookPermissions`, so deployment reverts if the mined address is wrong.
- Initialize the pool with:
  - `key.fee = LPFeeLibrary.DYNAMIC_FEE_FLAG` (`0x800000`)
  - `key.hooks = VolatilityDynamicFeeHook`
  - sorted token currencies, the chosen tick spacing, and initial price
- Add liquidity to that exact pool key through the v4 position manager.
- Do not initialize a static-fee pool. v4 fee mode is immutable at pool creation, and a static-fee pool ignores per-swap fee overrides.

Once the pool is live, liquidity does not need to migrate when volatility changes. Every swap re-queries the oracle and returns a fresh fee override. The hook owner can also update the oracle address, fallback fee, max fee, or oracle gas limit without changing the pool key.

## Operational Notes

- Keep `maxFee` below any governance or market-policy ceiling you want to commit to publicly.
- The oracle call is a bounded `staticcall`; malformed output, reverts, or fees above `maxFee` fall back to `defaultFee`.
- Swapper-provided `hookData` reaches the oracle. A production oracle should treat it as untrusted input.
- The launch checklist should include an address-mining script, testnet rehearsal, source verification, ownership transfer to the intended multisig/timelock, and monitoring of the v4 `Swap` event's `fee` field.
