# Volatility-based dynamic fee: Uniswap v4 hook

## Why v4 and a hook

- v2/v3 fees are fixed per pool. Changing the fee means creating a new pool and **moving liquidity**.
- v4 pools can be created as **dynamic-fee** pools (`key.fee = 0x800000`). A **hook** is a contract attached to the pool that runs on every swap and can set that swap's fee.
- The hook address is part of the pool's identity (`PoolKey`) and **can never change**. So everything we might want to change later has to be adjustable *inside* the hook: the signal source (`setOracle`) and the fee curve (`setFeeConfig`). That is how we avoid redeploying or migrating anything.

## Files

| File | Role |
|---|---|
| `src/DynamicFeeHook.sol` | The hook. Decides and applies the fee on every swap. |
| `src/interfaces/IVolatilityOracle.sol` | Interface for the volatility signal: `getVolatility(poolId) → (volatility, updatedAt)` |
| `src/StubVolatilityOracle.sol` | Placeholder signal: one trusted updater pushes a number. Replace later. |
| `script/DeployHook.s.sol` | Deploys the stub oracle, then the hook at a correctly mined address |
| `script/InitPool.s.sol` | Creates the dynamic-fee pool (must be sent by the hook owner) |
| `script/HookMiner.sol` | Searches for a CREATE2 salt that gives a valid hook address |
| `test/DynamicFeeHook.t.sol` | End-to-end tests on a real `PoolManager` |

## How the fee is decided and applied on each swap

1. A user swaps. `PoolManager.swap` sees the pool's hook has the `beforeSwap` permission bit and calls `hook.beforeSwap`.
2. The hook calls `oracle.getVolatility(poolId)` using a `staticcall` (read-only) limited to 50k gas.
3. It turns volatility into a fee with `feeForVolatility`, using the settings in `FeeConfig`:
   - `vol <= volLow` → `minFee`
   - `vol >= volHigh` → `maxFee`
   - in between → a straight line from `minFee` to `maxFee`
4. It uses `fallbackFee` instead if the oracle is unset, reverts, returns malformed data, or is stale (`updatedAt` is older than `maxStaleness`). A broken oracle **never blocks swaps**.
5. It returns `fee | 0x400000` (`OVERRIDE_FEE_FLAG`). PoolManager uses that fee for **this swap only**. Nothing is written to storage, so there's no extra state and the fee is freshly computed on every swap.
   - Common mistake: returning `fee | 0x800000`. That is the flag that marks a pool as dynamic-fee, not the override flag, and PoolManager would ignore the returned fee.
6. The fee goes to LPs as a normal LP fee. The fee each swap actually paid appears in PoolManager's `Swap` event (`fee` field). The tests check that event.

Units: fees are in hundredths of a bip (`500` = 0.05%, `10_000` = 1%). The hook caps every fee at `MAX_FEE_CAP` = 10%. The unit for volatility is whatever the oracle uses; the default config assumes annualized volatility in bps.

Default config in `DeployHook.s.sol` (placeholder values, tune before launch): 0.05% up to 30% vol, rising to 1% at 150% vol. If the oracle fails, the fee is 1%.

### Safety choices baked in
- **Only PoolManager** can call the hook callbacks.
- **Only the hook owner can create pools on this hook.** `beforeInitialize` checks `sender == owner`. This stops strangers from attaching their pools to our hook, and from creating our exact pool first with a bad starting price. The hook also rejects static-fee pools.
- **Gas check before the oracle call.** If there's too little gas for the oracle's full 50k budget, the hook reverts instead of falling back. Otherwise a swapper could send just enough gas to make the oracle run out and force the fallback fee.
- **Keep `fallbackFee` ≥ what a normal reading would give** (default: `maxFee`). If fallback is cheaper, anyone able to break or delay the oracle gets cheaper swaps.
- Two-step ownership transfer. The config is checked (`minFee ≤ maxFee ≤ cap`, `volLow < volHigh`).

## Wiring the real volatility signal later

Deploy any contract that implements `IVolatilityOracle`, then call `hook.setOracle(newOracle)` from the owner. The pool, its liquidity and LP positions stay untouched. Requirements for the real oracle:
- **Must not be based on this pool's current price within the same block.** A flash loan can move the spot price and pick the fee. Use a TWAP (time-weighted average price), realized volatility over past blocks, Chainlink or other external feeds, or a keeper pushing offchain-computed values.
- Must be cheap (< 50k gas) and a pure read (`staticcall`, so it can't write state).
- Return a truthful `updatedAt` so the staleness check works.

## Deploying correctly (Ethereum mainnet)

1. **Hook address must encode its permissions.** v4 reads which callbacks to run from the lowest 14 bits of the hook address. This hook needs exactly `BEFORE_INITIALIZE` (bit 13) and `BEFORE_SWAP` (bit 7), and no other bits. `DeployHook.s.sol` searches for a CREATE2 salt (via the standard factory `0x4e59b44847b379578588920cA78FbF26c0B4956C`) that yields such an address. The hook's constructor also calls `Hooks.validateHookPermissions`, so a wrong address fails at deploy time.
   - Constructor arguments are part of the address calculation. Change the owner/oracle/config and you must search for a new salt; the script already handles this.
2. **Use the right PoolManager**: mainnet `0x000000000004444c5dc75cB358380D2e3dE08A90`. v4 PoolManager addresses differ per chain. Verify against Uniswap's official deployments page before launch.
3. **Owner = multisig (ideally behind a timelock).** The owner can change fees up to 10% and swap the oracle. That's the main trust assumption for LPs and traders, so say so publicly.
4. **Deploy:**
   ```bash
   OWNER=<safe> ORACLE_UPDATER=<keeper> forge script script/DeployHook.s.sol \
     --rpc-url $MAINNET_RPC --broadcast --verify
   ```
5. **Create the pool from the owner account**, calling `PoolManager.initialize` directly. If the owner goes through PositionManager's `initializePool` multicall, `sender` becomes PositionManager and the hook rejects it. Pool settings: `fee = 0x800000` (dynamic), `hooks = <hook>`, sorted currencies (`address(0)` = native ETH), your chosen `tickSpacing`, and the correct starting `sqrtPriceX96`.
   ```bash
   HOOK=<hook> TOKEN=<token> PAIR=<weth-or-0x0> SQRT_PRICE_X96=<p> TICK_SPACING=60 \
     forge script script/InitPool.s.sol --rpc-url $MAINNET_RPC --broadcast   # signer = owner
   ```
   With a Safe as owner, build the same `initialize` call as a Safe transaction.
6. **Add liquidity** through Uniswap's v4 PositionManager (UI or SDK) using the same PoolKey. The hook doesn't touch liquidity.
7. **Routing**: Universal Router and aggregators discover v4 pools with hooks. Check that your pool shows up and quotes correctly after launch.
8. **Before mainnet:** run a fork test against real mainnet PoolManager (`forge test --fork-url $MAINNET_RPC`), verify source on Etherscan, get an audit of the hook and real oracle, and do a dry run on Sepolia/Unichain Sepolia.

## Gas

Each swap costs roughly: one hook call, one `SLOAD` of the packed config (all six settings fit in one storage slot), one `SLOAD` of the oracle address, plus the oracle read. Nothing is written to storage.

## Build / test

```bash
forge build
forge test
```
Dependencies: `lib/v4-core` (plus its `solmate` submodule, used only when tests compile PoolManager) and `lib/forge-std`. Periphery is not needed: the hook implements `IHooks` directly. `BaseHook` no longer lives in v4-periphery; it moved to OpenZeppelin's `uniswap-hooks`.
