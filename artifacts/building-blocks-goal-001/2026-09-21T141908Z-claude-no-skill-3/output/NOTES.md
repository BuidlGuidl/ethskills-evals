# Dynamic-fee pool: how it works

Built on **Uniswap v4** hooks. v3/v2 pools have a fixed fee tier baked in; changing it means a new pool
and moving liquidity. A v4 pool created with the *dynamic fee* flag lets a hook contract set the fee
on every swap, which is exactly what we want.

## Pieces

| File | What |
|---|---|
| `src/DynamicFeeHook.sol` | The hook. Picks the fee on every swap. |
| `src/interfaces/IVolatilityOracle.sol` | Stub for the volatility signal: `volatility(poolId) -> uint256` (bps). |
| `src/oracles/ManualVolatilityOracle.sol` | Placeholder oracle: a keeper pushes the number. Replace later. |
| `script/DeployDynamicFeeHook.s.sol` | Deploys oracle + hook (at a mined address) and initializes the pool. |
| `test/DynamicFeeHook.t.sol` | Local tests against a real v4 PoolManager. |

## How the fee is decided and applied on each swap

1. Someone swaps. The v4 `PoolManager` sees the pool's hook has the `beforeSwap` permission and calls
   `hook.beforeSwap(...)`.
2. The hook reads `oracle.volatility(poolId)` (a read-only call capped at 50k gas).
3. It maps volatility to a fee, piecewise-linear:
   - `vol <= volLow`  → `minFee`
   - `vol >= volHigh` → `maxFee`
   - in between → linear interpolation
   - oracle unset, reverts, runs out of gas, or returns junk → `fallbackFee`
4. The hook returns `fee | OVERRIDE_FEE_FLAG (0x400000)`. The PoolManager uses that fee **for this swap
   only** (it doesn't write it to pool storage). Fee goes to LPs as usual.

Fee units are hundredths of a bip: `500` = 0.05%, `3000` = 0.30%, `10000` = 1%. Script defaults:
min 0.05%, max 1%, fallback 1%, volLow 1%, volHigh 10%. Owner can never set more than `FEE_CAP` = 10%.

`fallbackFee` defaults to the **max** fee on purpose: a swapper can make the oracle call fail
(e.g. by giving the tx just enough gas), so a failing oracle must never be *cheaper* for them.

Read the fee a swap would pay right now: `hook.currentFee()`.

## What can change after launch (no migration, no redeploy)

- `setOracle(newOracle)` — plug in the real volatility source.
- `setFeeConfig(...)` — tune min/max/fallback/thresholds.
- `transferOwnership` / `acceptOwnership` (two-step), `renounceOwnership` to freeze everything.

What can **not** change: the hook's code, which callbacks it uses, and the pool key
(tokens, tick spacing, dynamic-fee flag, hook address). That's why the oracle is pluggable.

## Wiring up a real volatility signal (later)

Implement `IVolatilityOracle` and call `setOracle`. Requirements:
- `view`, cheap (well under 50k gas), never reverts in normal operation.
- **Not manipulable within one tx/block.** Don't compute it from this pool's current spot price —
  an attacker could push the price, get a low fee, and swap back. Use time-weighted data
  (e.g. a TWAP / realized-vol over past blocks, Chainlink, or a keeper-pushed value).
- Return the same units as `volLow`/`volHigh` (bps in the defaults).

If you want the signal computed from this pool's own swaps, that needs an `afterSwap` callback,
which changes the hook's permission bits → **a new hook and a new pool**. Decide before launch.

## Deploying correctly

1. **Hook address must encode its permissions.** v4 reads permissions from the low 14 bits of the hook
   address. This hook needs exactly `BEFORE_INITIALIZE | BEFORE_SWAP` (`0x2080`). The script mines a
   CREATE2 salt (`HookMiner`) and deploys via the canonical CREATE2 factory
   `0x4e59b44847b379578588920cA78FbF26c0B4956C`. The constructor reverts if the address is wrong.
2. **Pool must be created with `fee = 0x800000` (`DYNAMIC_FEE_FLAG`).** A pool with a static fee
   can never become dynamic. The hook rejects anything else.
3. **One pool only.** The hook stores the exact pool id at deploy and rejects any other pool.
4. **Only the `initializer` (the deploy EOA) can initialize it** — `PoolManager.initialize` must be
   called directly by that address (not via PositionManager multicall, which would make the
   PositionManager the sender). This blocks someone initializing our pool first at a bad price.
   Still: check `slot0` price before adding liquidity.
5. **Owner = multisig (ideally behind a timelock).** The owner controls the fee within 0–10%.
6. Mainnet v4 PoolManager: `0x000000000004444c5dc75cB358380D2e3dE08A90` (script default; verify
   against Uniswap's docs before running).
7. Currency order: `currency0 < currency1` by address; native ETH is `address(0)` and always
   currency0. The script sorts for you. `SQRT_PRICE_X96` = sqrt(currency1 amount per 1 currency0, raw units) * 2^96,
   computed for the sorted order.
8. After init, add liquidity through the v4 `PositionManager` as usual — the hook doesn't touch
   liquidity.
9. Verify the hook on Etherscan, then set the real oracle when ready.

```sh
TOKEN=0x... OWNER=0xSafe... SQRT_PRICE_X96=... \
forge script script/DeployDynamicFeeHook.s.sol --rpc-url mainnet --broadcast --verify \
  --account deployer    # MAINNET_RPC_URL must be set
```

Dry-run first on a mainnet fork (`anvil --fork-url $MAINNET_RPC_URL`) without `--broadcast`.

## Known caveats

- Routers / aggregators quote v4 pools by simulating swaps, so they see the dynamic fee. Anything that
  reads `slot0.lpFee` directly will see `0` (we override per swap and never store it).
- `ManualVolatilityOracle` is a stub for dev/testing; its updater is trusted.
- Not audited. Get a review before real liquidity goes in.

## Build / test

```sh
forge build
forge test
```
