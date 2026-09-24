# Volatility-based dynamic fee: Uniswap v4 hook

## Why v4 + a hook
In Uniswap v2 and v3, a pool's fee is fixed when the pool is created. To charge a different fee you have to move liquidity to a new pool.
Uniswap v4 allows a **dynamic fee pool**: a pool created with `fee = LPFeeLibrary.DYNAMIC_FEE_FLAG` (`0x800000`).
The fee for that pool is then decided by its **hook**, a contract that the PoolManager calls at fixed points in the pool's lifecycle.
The hook address is part of the pool's identity (`PoolKey`), so it can never be replaced.
To avoid redeploying anything, the hook itself is immutable, but the settings it reads can be changed:
- the volatility source (`setSignal`)
- the fee curve (`setFeeParams`)

## Files
| file | what it is |
|---|---|
| `src/DynamicFeeHook.sol` | the hook we deploy (one per pool) |
| `src/interfaces/IVolatilitySignal.sol` | `volatility(PoolId) → uint256`, the stub interface to wire up later |
| `src/StubVolatilitySignal.sol` | placeholder signal: an updater pushes a number |
| `script/DeployDynamicFeeHook.s.sol` | mines the hook address, deploys it, creates the pool, hands off ownership |
| `test/DynamicFeeHook.t.sol` | tests against a local PoolManager |
| `test/DynamicFeeHook.fork.t.sol` | test against the live mainnet PoolManager (runs only when `MAINNET_RPC_URL` is set) |

## How the fee is decided and applied on each swap
1. A swap on the pool reaches `PoolManager.swap`. The pool has the `BEFORE_SWAP` permission, so the PoolManager calls `hook.beforeSwap`. Only the PoolManager is allowed to call it.
2. `beforeSwap` calls `currentFee()`:
   - It reads `signal.volatility(poolId)` with a low-level `staticcall` limited to 50k gas.
   - If the signal reverts, runs out of gas, returns malformed data, or has no code, the hook uses `fallbackFee`. This way a broken signal cannot block trading.
   - Otherwise `feeForVolatility` maps the reading to a fee:
     - `vol <= lowVol` → `minFee`
     - `vol >= highVol` → `maxFee`
     - in between, the fee is interpolated in a straight line
3. The hook returns `fee | OVERRIDE_FEE_FLAG` (`0x400000`). The PoolManager removes the flag, checks `fee <= 1_000_000`, and charges that LP fee **for this swap only**. Nothing is written to storage and no separate `updateDynamicLPFee` call is needed. The fee always reflects the signal at the moment of the swap.
4. The hook emits `FeeApplied(poolId, vol, fee, signalOk)` for monitoring.

Fee units are hundredths of a basis point (`3000` = 0.30%, `1e6` = 100%).
`setFeeParams` enforces:
- `minFee <= fallbackFee <= maxFee <= MAX_FEE_CAP` (10%)
- `lowVol < highVol`

The script uses placeholder numbers: 0.05% when calm, 1% when volatile, 0.30% on fallback. Tune them.

If the protocol fee switch is ever turned on, the protocol fee is taken on top of the LP fee. The hook only controls the LP fee.

## Requirements for the real volatility signal
- **It must not be movable within the swap's own transaction.** A signal based on this pool's spot price, or on a short TWAP of it, can be pushed in one transaction to lower the fee right before a large swap. Use a time-averaged or external source, or values pushed by a keeper.
- **It must be cheap.** It runs on every swap and has a 50k gas limit. If it goes over, every swap silently pays `fallbackFee`. Watch `FeeApplied.signalOk`.
- **It must not go stale.** If a keeper pushes values, the signal contract should detect stale data and revert when data is stale, so the hook falls back instead of using an old value.
- Its units must match `lowVol` / `highVol`.

## Deploying correctly
1. **The pool must be a new v4 pool created with the dynamic fee flag.** An existing v2/v3 pool, or a static-fee v4 pool, cannot be converted. Create this pool at launch, before any liquidity goes elsewhere. That is the only way to get "no migration later".
2. **The hook address must encode its permissions.** v4 reads permissions from the lowest 14 bits of the hook address. This hook needs exactly `BEFORE_INITIALIZE | BEFORE_SWAP` (`0x2080`) and no other bits.
   - The script mines a CREATE2 salt with `HookMiner`, using the standard CREATE2 deployer `0x4e59b448…956C`.
   - The constructor calls `Hooks.validateHookPermissions`, so a deploy at the wrong address reverts instead of producing an unusable hook.
   - Constructor args are part of the address. If any argument changes, you must mine a new salt.
3. **Only the owner can initialize the pool, and only once.** `beforeInitialize` checks:
   - `sender == owner`
   - the pool uses the dynamic fee flag
   - no pool has been bound yet

   This blocks two problems: someone front-running pool creation at a bad starting price, and someone attaching other pools to this hook. `sender` is whoever called `PoolManager.initialize` directly. So the owner must call it directly, not through `PositionManager.multicall`, where the sender would be the PositionManager. The script does this.
4. **Check the pool key:**
   - `currency0 < currency1` (the script sorts them; `address(0)` means native ETH)
   - `tickSpacing` (e.g. 60)
   - initial `sqrtPriceX96` matches your intended launch price. A wrong price is permanent until someone trades it back.
5. **Hand off ownership.** The script deploys with the deployer EOA as owner (needed for step 3), then calls `transferOwnership(FINAL_OWNER)`. `FINAL_OWNER` must call `acceptOwnership()`. Use a multisig behind a timelock: the owner can swap the signal and move fees up to 10%. The stub signal's `updater` is also set to `FINAL_OWNER`. Replace it with the real signal via `setSignal`.
6. **Add liquidity after initialization.** Use the v4 PositionManager, or any router that supports v4.
7. Run:
   ```sh
   forge build
   MAINNET_RPC_URL=... forge test          # includes live-PoolManager fork test
   POOL_MANAGER=0x000000000004444c5dc75cB358380D2e3dE08A90 TOKEN=... PAIR_TOKEN=0x0000000000000000000000000000000000000000 \
   SQRT_PRICE_X96=... TICK_SPACING=60 FINAL_OWNER=<multisig> \
   forge script script/DeployDynamicFeeHook.s.sol --rpc-url $MAINNET_RPC_URL --broadcast --verify
   ```
   Do a dry run without `--broadcast` first.

## Verified (2026-09-21, via ethereum-rpc.publicnode.com)
- v4 PoolManager `0x000000000004444c5dc75cB358380D2e3dE08A90` has code on mainnet (block ~26026405). Its `owner()` is `0x1a9C8182C09F50C8318d769245beA52c32BE35BC`.
- The CREATE2 deployer `0x4e59b44847b379578588920cA78FbF26c0B4956C` has code on mainnet.
- Fork test at block ~26026423:
  - mined the hook address, deployed it against the live PoolManager
  - initialized a dynamic-fee pool and added liquidity
  - confirmed a swap under a high volatility reading returns less output than the same swap under a calm reading
- Local tests cover:
  - the fee curve
  - fallback when the signal reverts
  - owner-only, single-pool initialization
  - admin checks

## Not verified / open
- **Routing and aggregator support for hooked pools.** Whether the Uniswap interface, UniversalRouter routing, and aggregators will route to a pool with a custom hook is outside this code. Check current Uniswap routing policy before launch, since it decides whether this pool actually gets order flow.
- **No audit.** The hook is small, but it runs on every swap of your main pool.
- The fee curve numbers and the signal design are placeholders.
