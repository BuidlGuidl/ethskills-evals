# Dynamic swap fee for the TOKEN main pool

Uniswap **v4** hook. v4 is the only Uniswap version where a pool's fee can change per swap
without a new pool: v2 fee is fixed, v3 fee tier is part of the pool identity (new tier = new pool = migrate liquidity).

## Files

| File | What |
|---|---|
| `src/DynamicFeeHook.sol` | The hook. Picks + applies the fee on every swap. Deployed once, never replaced. |
| `src/interfaces/IVolatilityOracle.sol` | The volatility signal plug. `volatilityScore(key) -> 0..1e18`. |
| `src/oracles/ManualVolatilityOracle.sol` | Stub signal: a score an updater address sets by hand. Replace later. |
| `script/Deploy.s.sol` | Deploys stub oracle + hook (mined address) + initializes the pool. |
| `test/DynamicFeeHook.t.sol` | Real swaps through a v4 PoolManager, checks fee follows score / fallback. |

`forge build` / `forge test` (6 tests pass).

## How the fee is decided and applied on each swap

1. Pool is created with `fee = LPFeeLibrary.DYNAMIC_FEE_FLAG` (`0x800000`) and `hooks = DynamicFeeHook`.
   That marks it as a dynamic-fee pool. `beforeInitialize` rejects any pool without this flag
   (on a static-fee pool the hook's fee would be silently ignored).
2. Every swap: PoolManager calls `hook.beforeSwap(...)` (only the PoolManager may call it).
3. Hook calls `oracle.volatilityScore(key)`:
   - score clamped to `[0, 1e18]`
   - `fee = minFee + (maxFee - minFee) * score / 1e18`
   - oracle unset, reverts, returns junk, or burns > 100k gas → `fee = fallbackFee`
4. Hook returns `fee | OVERRIDE_FEE_FLAG` (`0x400000`). PoolManager strips the flag, validates
   (≤ 100%), and uses that fee **for this swap only**. Nothing is stored; the next swap asks again.
5. Fee goes to LPs as usual (v4 protocol fee, if ever turned on, is separate).

Units: hundredths of a bip. `500` = 0.05%, `3000` = 0.30%, `10000` = 1%. `1_000_000` = 100%.

Defaults in the deploy script: calm 0.05%, volatile 1.00%, fallback 0.30%. Tune before deploy.

`hook.currentFee(key)` is a view of the exact fee the next swap gets — useful for frontends/monitoring.
Quoters/routers simulate the swap, so they see the right fee automatically.

### What can change after launch (no redeploy, no liquidity migration)

| Change | How | Who |
|---|---|---|
| Volatility source | `setOracle(newOracle)` | hook owner |
| Fee range / fallback | `setFees(min, max, fallback)`; each ≤ 10% hard cap (`MAX_FEE_CAP`) | hook owner |
| Stub score | `ManualVolatilityOracle.setScore(x)` | oracle updater |
| Owner | `transferOwnership` + `acceptOwnership` (2-step) | hook owner |

What **cannot** change: the hook code itself and its callback set. The hook address is part of the
`PoolKey` (= pool id). New hook ⇒ new pool ⇒ liquidity migration. That's why all tunables live in storage
and the signal is behind an interface.

### Safety choices

- Oracle read via bounded `staticcall` (100k gas). Bad oracle can't brick swaps or make them expensive;
  it degrades to `fallbackFee`. Oracle can't write state during the swap.
- Hook reverts if the swapper sends too little gas for the full oracle call, so nobody can starve the
  oracle on purpose to force the fallback fee.
- Admin can't set a fee above 10%, so a compromised owner key can't set 100% fees.
- No liquidity / swap-delta permissions: the hook cannot touch anyone's funds.

## Writing the real oracle

Implement `IVolatilityOracle`. Requirements:
- `view`, under 100k gas, doesn't revert in normal operation.
- Hard to manipulate inside one block. **Don't** use this pool's current spot price / last swap —
  an attacker can move it in the same tx to flip fees. Use something like: a TWAP/realized-vol
  accumulator updated by a keeper or in a separate (non-swap) path, an external feed (Chainlink etc.),
  or a keeper-pushed score with staleness checks (return a safe value, or revert → fallback, if stale).
- `key` is passed in so one oracle can serve several pools.

If the signal must be updated *by swaps* (e.g. per-swap price observations), that needs `afterSwap`
permission — which must be decided **before** deploy, because permissions are baked into the hook address.
Current hook has only `beforeInitialize` + `beforeSwap`.

## Deploying correctly

1. **Hook address must encode its permissions.** v4 reads the callbacks to invoke from the low 14 bits
   of the hook address. This hook needs exactly `BEFORE_INITIALIZE (1<<13) | BEFORE_SWAP (1<<7)`
   → address ends in `...2080` in those bits. `Deploy.s.sol` mines a CREATE2 salt against the standard
   deployer `0x4e59b44847b379578588920cA78FbF26c0B4956C` (what `forge script` uses for `new X{salt:}`).
   Constructor calls `Hooks.validateHookPermissions` → wrong address = deploy reverts, not a silent broken hook.
   Salt depends on the exact creation code + constructor args: re-mine if you change either
   (`bytecode_hash = "none"` in `foundry.toml` keeps bytecode stable across machines).
2. **Correct PoolManager.** Mainnet v4 PoolManager: `0x000000000004444c5dc75cB358380D2e3dE08A90`
   (script default; verify against Uniswap's official deployments page). Immutable in the hook.
3. **Pool fee = `DYNAMIC_FEE_FLAG`.** Otherwise init reverts (by design).
4. **Owner = multisig** (e.g. Safe), not the deployer EOA. Consider a timelock on `setOracle`/`setFees`.
   Oracle updater for the stub = keeper or same multisig.
5. **Initial price.** `SQRT_PRICE_X96` = `sqrt(amount1/amount0) * 2^96` with tokens sorted by address
   (`currency0 < currency1`; native ETH = `address(0)` is always `currency0`). Wrong price at init = instant arb loss
   on first liquidity.
6. **Pick `TICK_SPACING`** (default 60). Part of the pool id, can't change later.
7. **Front-running init:** anyone can call `initialize` for the same key first with a bad price.
   Do init + first liquidity add in one tx/bundle (e.g. PositionManager `multicall` with
   `initializePool` + `modifyLiquidities`), or check the pool is uninitialized right before seeding.
8. **Add liquidity** via v4 `PositionManager` (not in this repo). Point the frontend / aggregators at the
   exact `PoolKey` (currencies, `0x800000`, tick spacing, hook) — that key *is* the pool.
9. Verify both contracts on Etherscan (`--verify`), then check: `hook.owner()`, `oracle()`, `minFee/maxFee/fallbackFee`,
   `currentFee(key)`, and a small test swap on the live pool.
10. Other people can create pools that reuse this hook (different token pairs). Harmless — they get the same
    fee rules; the oracle sees `key` and can return per-pool values.

Run:

```sh
export MAINNET_RPC_URL=... OWNER=<multisig> TOKEN=<token> PAIR_TOKEN=<weth or 0x0 for ETH> SQRT_PRICE_X96=<...>
forge script script/Deploy.s.sol --rpc-url mainnet --account <deployer> --broadcast --verify
```

Dry run on a mainnet fork first (omit `--broadcast`). Tested locally on anvil with a fresh PoolManager.

## Before mainnet

- Audit. Hook sits in the path of every swap.
- Real oracle + manipulation analysis.
- Fork test against real mainnet PoolManager + PositionManager + UniversalRouter.
