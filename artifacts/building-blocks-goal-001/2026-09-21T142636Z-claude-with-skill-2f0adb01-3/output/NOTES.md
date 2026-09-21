# Volatility-based dynamic fee — Uniswap v4 hook

## Why v4 + a hook
Uniswap v2/v3 pools have a fixed fee tier; changing it means a new pool + migrating liquidity.
In v4 a pool can be created as **dynamic-fee** and point at a **hook** contract that picks the fee.
Hook address is part of the pool's identity (`PoolKey`), so it's fixed forever — everything that
must change later (signal source, fee curve, owner) lives as *settable state inside the hook*.

## Files
| File | What |
|---|---|
| `src/VolatilityFeeHook.sol` | the hook (the thing that gets deployed and attached to the pool) |
| `src/interfaces/IVolatilityOracle.sol` | the stub boundary: `volatility(PoolKey) → uint256` |
| `src/oracles/ManualVolatilityOracle.sol` | placeholder signal: an updater pushes values per pool |
| `script/DeployVolatilityFeeHook.s.sol` | mines hook address, deploys, initializes the pool |
| `test/VolatilityFeeHook.t.sol` | end-to-end: real PoolManager, swaps, checks fee in `Swap` event |

## How the fee is decided and applied on each swap
1. Swapper calls PoolManager `swap` (via Universal Router etc.).
2. Pool has `beforeSwap` permission bit → PoolManager calls `hook.beforeSwap`.
3. Hook reads the signal: `STATICCALL oracle.volatility(key)` with a 50k gas cap.
   - read-only call → oracle can't reenter or change state.
   - revert / bad return / no oracle set → `fallbackFee` (recommended = `maxFee`, i.e. fail toward protecting LPs).
   - if the swap tx has too little gas left to give the oracle its full 50k, the swap **reverts** instead of
     silently using the fallback — stops a swapper from starving the oracle on purpose to pick a fee.
4. Map signal → fee (linear ramp):
   ```
   vol <= volLow            → minFee
   vol >= volHigh           → maxFee
   in between               → minFee + (maxFee-minFee)·(vol-volLow)/(volHigh-volLow)
   ```
   Fee units = hundredths of a bip: `500` = 0.05%, `3000` = 0.30%, `10000` = 1%.
5. Hook returns `fee | OVERRIDE_FEE_FLAG (0x400000)`. PoolManager uses that fee **for this swap only**.
   Without the flag the fee is ignored and the pool's stored fee (0 here) would apply — so the flag is essential.
   (Note: `0x800000` is `DYNAMIC_FEE_FLAG`, used in the `PoolKey`, *not* in the return value — easy to mix up.)
6. The fee actually charged is emitted in PoolManager's `Swap` event (`fee` field) — use that for monitoring.

Default config in the script: 0.05% at ≤30% vol → 1.00% at ≥150% vol, fallback 1.00%. Signal units assumed
annualized vol in bps; the only requirement is that oracle units match `volLow`/`volHigh`.

### Post-launch knobs (no redeploy, no migration)
- `setOracle(newOracle)` — wire up the real signal later.
- `setFeeConfig(...)` — retune curve. Hard-capped: no fee can exceed `MAX_FEE_CAP` = 10%; `minFee ≤ maxFee`; `volLow < volHigh`.
- `transferOwnership` / `acceptOwnership` — two-step.

The hook itself is intentionally **not upgradeable**: LPs/traders can read exactly what code runs on each swap.
The trust surface is the owner (can move fee in [0, 10%]) and the oracle (can move fee in [minFee, maxFee]).

## Wiring the real signal
Implement `IVolatilityOracle`. Requirements:
- cheap (< 50k gas), `view`, never reverts in normal operation;
- **not manipulable inside one tx** — don't compute it from this pool's own spot price/tick in the same block
  (flash-loan/sandwich can push it); use TWAP over past blocks, an offchain-computed pushed value, Chainlink, etc.;
- consider staleness: if data is old, return a high value (→ higher fee) or revert (→ fallback fee).

## Deploying correctly
1. **Hook address must encode permissions.** v4 reads permissions from the low 14 bits of the hook address.
   Ours needs exactly `BEFORE_INITIALIZE (1<<13) | BEFORE_SWAP (1<<7)` = low bits `0x2080`, all others 0.
   The script mines a CREATE2 salt (`HookMiner`) against the canonical CREATE2 deployer
   `0x4e59b44847b379578588920cA78FbF26c0B4956C`; the constructor calls `Hooks.validateHookPermissions` and
   reverts if the address is wrong. Any change to bytecode or constructor args → re-mine
   (`bytecode_hash = "none"` in `foundry.toml` keeps builds reproducible).
2. **Owner is an explicit constructor arg**, not `msg.sender` (which is the CREATE2 proxy under `forge script`).
   Use a multisig for production; the broadcaster must be the owner *at initialize time* (see 4), then transfer.
3. **Pool must be created with `fee = 0x800000` (`DYNAMIC_FEE_FLAG`).** A static-fee pool can never become
   dynamic; the hook's `beforeInitialize` rejects static-fee pools.
4. **Only owner can initialize pools on this hook** (`beforeInitialize` checks `sender == owner`), which prevents
   anyone else from spinning up look-alike pools on our hook. `sender` is whoever calls `PoolManager.initialize`
   — the script calls it directly from the owner EOA. (If you initialize via PositionManager multicall instead,
   `sender` would be PositionManager and this check would fail — initialize directly.)
5. **Mainnet PoolManager:** `0x000000000004444c5dc75cB358380D2e3dE08A90` (v4 addresses differ per chain — verify).
6. Pick `TICK_SPACING` (script default 60) and `SQRT_PRICE_X96` for the launch price; currencies are sorted by
   the script; `address(0)` = native ETH (v4 supports ETH directly, no WETH needed).
7. Liquidity is added separately afterwards via v4 **PositionManager**, referencing the same `PoolKey`.
8. Verify source on Etherscan so routers/aggregators/LPs can inspect the hook. Some aggregators route
   only to hooked pools they've reviewed — reach out to them before launch.

```sh
OWNER=0x... TOKEN_A=0x... TOKEN_B=0x0000000000000000000000000000000000000000 \
SQRT_PRICE_X96=79228162514264337593543950336 \
forge script script/DeployVolatilityFeeHook.s.sol --rpc-url mainnet --broadcast --verify \
  --sender $OWNER --account <keystore>
```
Dry-run first on a mainnet fork (`anvil --fork-url $MAINNET_RPC_URL`) and do a swap to confirm the
`Swap` event shows the expected fee.

## Before mainnet
- Audit (hook + oracle). Not audited.
- Real oracle + staleness policy; decide who the updater is.
- Owner = multisig; consider a timelock on `setFeeConfig`/`setOracle` so LPs/traders get notice.
- Gas: every swap pays one extra call + ~50k max for the oracle — keep the oracle lean.
- Known limit: config is global to the hook (fine for one pool; add per-pool config if you attach more pools).

## Commands
```sh
forge build
forge test -vv
```
