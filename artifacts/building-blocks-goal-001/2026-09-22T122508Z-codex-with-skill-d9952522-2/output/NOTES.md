# Volatility Dynamic Fee Hook

This project implements the onchain piece as a Uniswap v4 hook. Uniswap's current v4 docs say dynamic fees are chosen at pool creation, can change per swap, and can be applied either by calling `PoolManager.updateDynamicLPFee` or by returning a fee override from `beforeSwap`. This hook uses the `beforeSwap` fee override path so each swap reads the latest volatility signal and applies the selected LP fee immediately.

## How the Fee Is Decided

- `VolatilityDynamicFeeHook` owns a simple `FeeConfig`:
  - `calmFee`: fee used below the threshold.
  - `volatileFee`: fee used at or above the threshold.
  - `volatilityThresholdBps`: volatility cutoff, expressed in basis points by the oracle.
- On every `beforeSwap`, the hook calls `volatilityOracle.volatilityBps(key, params, hookData)`.
- If the returned volatility is below `volatilityThresholdBps`, the hook selects `calmFee`; otherwise it selects `volatileFee`.
- Fees are Uniswap v4 LP fees denominated in hundredths of a bip. Examples: `500` is 0.05%, `3000` is 0.30%, `10000` is 1%.
- The signal is deliberately replaceable. `StubVolatilityOracle` is a mutable placeholder for tests and launch rehearsals; production should replace it with a manipulation-resistant signal contract.

## How the Fee Is Applied on Each Swap

- The target pool must be a Uniswap v4 dynamic-fee pool: its `PoolKey.fee` must be `LPFeeLibrary.DYNAMIC_FEE_FLAG` (`0x800000`) when initialized.
- The pool must use this hook as `PoolKey.hooks`.
- During a swap, the v4 `PoolManager` calls this hook's `beforeSwap`.
- The hook returns `(IHooks.beforeSwap.selector, ZERO_DELTA, selectedFee | LPFeeLibrary.OVERRIDE_FEE_FLAG)`.
- The override flag tells v4 to use `selectedFee` for that swap. No liquidity migration, pool migration, or hook redeployment is needed for normal fee changes.

## Correct Deployment Checklist

1. Confirm the current Ethereum mainnet v4 deployment addresses before broadcasting. As of the Uniswap docs crawled on 2026-09-22, Ethereum mainnet `PoolManager` is `0x000000000004444c5dc75cB358380D2e3dE08A90`.
2. Deploy the volatility oracle or the temporary `StubVolatilityOracle`.
3. Mine the hook deployment salt so the deployed hook address has the `Hooks.BEFORE_SWAP_FLAG` bit set. v4 hook permissions are encoded in the hook address, so a normal unmined deployment will revert in the hook constructor.
4. You can use `script/DeployVolatilityDynamicFeeHook.s.sol` to mine and deploy the hook. Set `OWNER`, optionally set `VOLATILITY_ORACLE`, and review `CALM_FEE`, `VOLATILE_FEE`, `VOLATILITY_THRESHOLD_BPS`, and `POOL_MANAGER` before broadcasting.
5. Deploy `VolatilityDynamicFeeHook` with:
   - the Ethereum mainnet `PoolManager`;
   - the launch governance/multisig owner;
   - the oracle address;
   - conservative initial `FeeConfig` values.
6. Initialize the token's main v4 pool with:
   - sorted `currency0` and `currency1`;
   - `fee = LPFeeLibrary.DYNAMIC_FEE_FLAG`;
   - chosen `tickSpacing`;
   - `hooks = deployed VolatilityDynamicFeeHook`.
7. Add liquidity to that exact pool. The dynamic-fee setting and hook address are immutable for the pool, so a pool initialized without them cannot be converted later.
8. Before meaningful liquidity goes live, fork-test swaps against the intended token pair, oracle behavior, owner handoff, fee bounds, and router/indexer support.

## Operational Notes

- `setVolatilityOracle` can point the hook at the production signal later without changing the pool.
- `setFeeConfig` can adjust the two fee bands and threshold. Ownership should be transferred to a timelock or multisig before launch.
- The current policy is intentionally simple. A production oracle can encode richer logic and return a single volatility number, or this hook can be extended to use more fee bands.
- The hook emits `DynamicFeeSelected` on every swap for monitoring.
