# Volatility Fee Hook Notes

## What gets deployed

This project contains the onchain pieces for a Uniswap v4 dynamic-fee pool:

- `VolatilityFeeHook`: the pool hook that sets the pool's dynamic LP fee.
- `IVolatilitySignal`: the interface hiding the volatility source.
- `ManualVolatilitySignal`: a simple owner-set stub signal for rehearsals or temporary operation.

The intended Ethereum mainnet PoolManager is:

```text
0x000000000004444c5dc75cB358380D2e3dE08A90
```

## How the fee is decided

`VolatilityFeeHook` stores a `FeePolicy`:

- `calmFee`: used below `normalVolatilityBps`
- `normalFee`: used from `normalVolatilityBps` up to `volatileVolatilityBps`
- `volatileFee`: used at or above `volatileVolatilityBps`

Uniswap v4 LP fees are pips, where `1_000_000` is 100%. Common examples:

- `500` = 0.05%
- `3_000` = 0.30%
- `10_000` = 1.00%

On every swap, Uniswap v4 calls the hook's `beforeSwap`. The hook queries:

```solidity
volatilitySignal.volatilityBps(key, params, hookData)
```

Then it maps that returned volatility value to one of the configured fee tiers with
`feeForVolatilityBps`.

## How the fee is applied on each swap

The pool must be created as a Uniswap v4 dynamic-fee pool:

```solidity
key.fee = LPFeeLibrary.DYNAMIC_FEE_FLAG; // 0x800000
key.hooks = IHooks(address(volatilityFeeHook));
```

When `beforeSwap` runs, the hook calls:

```solidity
POOL_MANAGER.updateDynamicLPFee(key, fee);
```

`PoolManager.swap` executes the hook before computing the swap, so the newly stored dynamic LP fee is used for that same swap. The hook returns no balance delta and no one-swap fee override; it updates the pool's stored dynamic fee instead.

`afterInitialize` sets an initial nonzero fee to `normalFee`. Without that, a v4 dynamic-fee pool initializes with LP fee `0` until the first update.

## Deployment requirements

Uniswap v4 decides which hook callbacks to call by inspecting the low bits of the hook address. This hook enables:

- `afterInitialize`: `1 << 12`
- `beforeSwap`: `1 << 7`

So the hook address must have low 14 bits exactly:

```text
0x1080
```

Deploy the hook with CREATE2 salt mining, or another deterministic deployment flow, so the constructor passes `Hooks.validateHookPermissions`. A normal deployment to an arbitrary address will usually revert.

Deployment order:

1. Deploy the volatility signal contract or final oracle adapter.
2. Mine a CREATE2 salt that deploys `VolatilityFeeHook` to an address ending in hook flags `0x1080`.
3. Deploy `VolatilityFeeHook` with the mainnet PoolManager, signal address, owner, and fee policy.
4. Create/initialize the Uniswap v4 pool using `LPFeeLibrary.DYNAMIC_FEE_FLAG` and the hook address.
5. Add liquidity to that pool.

After launch, liquidity stays in the same pool. Fee changes happen through the hook on each swap, so there is no need to migrate liquidity or redeploy the pool to change between calm and volatile pricing.

## Operational notes

- The volatility signal is deliberately stubbed behind `IVolatilitySignal`; replace `ManualVolatilitySignal` with a production oracle/model adapter before launch, or update `volatilitySignal` through governance.
- The owner can update the fee policy and signal address. For a real launch, owner should be a multisig or timelock.
- Fee values are validated against Uniswap's max LP fee of `1_000_000`.
- The pool must use the dynamic fee flag. A static-fee pool will not authorize `updateDynamicLPFee`.
