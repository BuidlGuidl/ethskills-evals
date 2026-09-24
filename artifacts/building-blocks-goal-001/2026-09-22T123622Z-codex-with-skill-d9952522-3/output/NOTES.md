# Volatility Dynamic Fee Hook

This project implements the deployable onchain piece as a Uniswap v4 hook:

- `VolatilityDynamicFeeHook` is the hook attached to the token's main v4 pool.
- `ManualVolatilityOracle` is a simple owner-set volatility signal stub. Replace it later with a real onchain signal provider that implements `IVolatilityOracle`.

## How The Fee Is Decided

The pool must be created as a Uniswap v4 dynamic-fee pool by setting `PoolKey.fee` to `0x800000`.

On every swap, Uniswap v4 calls the hook's `beforeSwap` function because the hook address has the `BEFORE_SWAP` permission bit set. The hook then:

1. Computes the `PoolId` from the supplied `PoolKey`.
2. Loads that pool's fee config: `minFee`, `maxFee`, `baseFee`, and `volatilityMultiplier`.
3. Calls `IVolatilityOracle.currentVolatility(...)`, which returns a 1e18-scaled volatility value.
4. Computes:

```text
fee = baseFee + volatilityE18 * volatilityMultiplier / 1e18
```

5. Clamps the result to `[minFee, maxFee]`.
6. Returns `fee | 0x400000` from `beforeSwap`.

Uniswap v4 interprets `0x400000` as the LP fee override flag. Because the pool fee is the dynamic-fee marker, the PoolManager applies this returned LP fee to that swap. The hook returns zero token deltas; it only changes the LP fee.

Uniswap v4 fee units are hundredths of a bip:

- `100` = 1 bp = 0.01%
- `3_000` = 30 bps = 0.30%
- `10_000` = 100 bps = 1.00%
- `1_000_000` = 100%

## Deploying Correctly

The hook contract address is part of Uniswap v4's permission model. The deployed address must have the `BEFORE_SWAP` bit set, which is `1 << 7` in the low 14 bits of the address. The constructor checks this and reverts if the mined address is wrong.

Deployment flow:

1. Deploy or choose the volatility oracle. `ManualVolatilityOracle` is only a stub for launch testing and emergency manual operation.
2. Mine a CREATE2 salt that deploys `VolatilityDynamicFeeHook` to an address where `uint160(hook) & (1 << 7) != 0`.
3. Deploy the hook with the Ethereum mainnet Uniswap v4 `PoolManager`, the owner, and the oracle address. As of September 22, 2026, Uniswap lists Ethereum mainnet `PoolManager` at `0x000000000004444c5dc75cB358380D2e3dE08A90`.
4. Create the main pool with:
   - `hooks = VolatilityDynamicFeeHook`
   - `fee = 0x800000`
   - the intended token pair, ordering, and tick spacing
5. Call `configurePool` with conservative bounds before adding meaningful liquidity.
6. Add liquidity to that exact v4 pool.

Important operational notes:

- This does not migrate liquidity. The hook must be attached when the pool is created.
- Dynamic-fee capability is immutable per pool. A non-dynamic pool cannot later become dynamic.
- If the oracle reverts, swaps revert. Treat the oracle as production-critical infrastructure.
- The owner can update the oracle and fee bounds. Use a multisig or timelocked governance, not an EOA.
- The configured `maxFee` should be low enough that routing remains viable during stress and high enough to compensate LPs during volatility.

## References Checked

- Uniswap v4 dynamic fees documentation, crawled September 22, 2026: dynamic-fee pools can update per swap through `beforeSwap`, and dynamic capability is chosen at pool creation. https://developers.uniswap.org/docs/protocols/v4/concepts/dynamic-fees
- Uniswap v4 core `IHooks` and `LPFeeLibrary`, crawled September 22, 2026: the LP fee override must set `0x400000`, and valid LP fees are capped at `1_000_000`. https://github.com/Uniswap/v4-core/blob/main/src/interfaces/IHooks.sol and https://github.com/Uniswap/v4-core/blob/main/src/libraries/LPFeeLibrary.sol
- Uniswap v4 hook deployment documentation, crawled September 22, 2026: hook permissions are encoded in the low bits of the hook address and should be mined with CREATE2. https://developers.uniswap.org/docs/protocols/v4/guides/hooks/hook-deployment
- Uniswap v4 deployments documentation, crawled September 22, 2026: Ethereum mainnet PoolManager address. https://developers.uniswap.org/docs/protocols/v4/deployments
