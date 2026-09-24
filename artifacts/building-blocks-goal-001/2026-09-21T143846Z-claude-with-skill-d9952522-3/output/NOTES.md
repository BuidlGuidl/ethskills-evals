# Dynamic-fee pool: notes

## Why Uniswap v4 + a hook

- v2/v3 fees are fixed per pool. Changing the fee = new pool = migrate liquidity.
- v4 pools can be created as **dynamic-fee pools**: fee is not fixed, a **hook** (a contract the pool calls at set points) decides it.
- Hook is bound to the pool forever (part of the pool's ID). So the hook itself must be **configurable**: volatility source and fee curve are changeable by owner, no redeploy, no liquidity move.

Mainnet v4 PoolManager `0x000000000004444c5dc75cB358380D2e3dE08A90` — checked onchain 2026-09-21 (block 26026557): has code; PositionManager `0xbD21…ee9e` reports it as its `poolManager()`.

## Files

| File | What |
|---|---|
| `src/DynamicFeeHook.sol` | the hook. Deploy this. |
| `src/interfaces/IVolatilityOracle.sol` | volatility signal interface — `getVolatility(PoolId) → uint256` |
| `src/oracles/ManualVolatilityOracle.sol` | stub signal, value set by an updater address. Replace later. |
| `script/DeployDynamicFeeHook.s.sol` | deploys oracle + hook (mined address), creates the pool |
| `test/DynamicFeeHook.t.sol` | local tests against a real PoolManager |

## How the fee is decided and applied on each swap

1. Swapper calls PoolManager `swap`.
2. PoolManager sees the hook's address has the `beforeSwap` bit set → calls `hook.beforeSwap`.
3. Hook calls `oracle.getVolatility(poolId)`:
   - gas-capped (50k), static (read-only) call;
   - revert / out of gas / bad return / no oracle set → uses `fallbackFee`. A broken oracle **never** blocks trading.
4. Signal → fee, linear ramp:
   ```
   vol <= volLow   → minFee
   vol >= volHigh  → maxFee
   between         → minFee + (maxFee-minFee) * (vol-volLow)/(volHigh-volLow)
   ```
   Fee units: hundredths of a basis point (`3000` = 0.30%, `10000` = 1%).
5. Hook returns `fee | OVERRIDE_FEE_FLAG`. PoolManager uses that fee **for this swap only**; the fee goes to LPs like any normal fee. Nothing is stored in the pool, so no extra storage write per swap.

Guards:
- `beforeInitialize` only lets **one** pool be created with this hook: the exact pair + tickSpacing set in the constructor, and only with the dynamic-fee flag (`fee = 0x800000`). A normal static-fee pool would silently ignore the hook's fee, so it's rejected.
- Only PoolManager can call the callbacks.
- Owner can change the oracle (`setOracle`) and curve (`setFeeConfig`), but `maxFee` can never exceed `MAX_FEE_CAP` = 10%, and `minFee <= fallbackFee <= maxFee` is enforced.

Note: the pool's stored fee (`slot0.lpFee`) stays 0; the real fee lives only in the per-swap override. Frontends/quoters that simulate the swap (v4 Quoter) get the right fee; anything that reads the stored fee directly will show 0. Use `hook.currentFee(poolId)` for display.

## Deploying correctly

1. **Hook address must encode its permissions.** v4 reads which callbacks to call from the low 14 bits of the hook address. Need exactly `BEFORE_INITIALIZE (0x2000) | BEFORE_SWAP (0x0080)` → address ends in `…2080` (upper bits of those 14 zero). Script mines a CREATE2 salt with `HookMiner` against the standard CREATE2 deployer `0x4e59b448…956C`; constructor also re-checks via `Hooks.validateHookPermissions` and reverts on mismatch.
   - Salt depends on exact bytecode + constructor args. `bytecode_hash = "none"` in `foundry.toml` keeps bytecode stable; don't change compiler settings between mining and deploying (script does both in one run, so fine).
2. **Pool key must be:** sorted currencies (`currency0 < currency1`, native ETH = `address(0)`, always currency0), `fee = 0x800000` (`LPFeeLibrary.DYNAMIC_FEE_FLAG`), same `tickSpacing` as the hook's constructor, `hooks = hook`. Any other combo reverts in `beforeInitialize`.
3. **Set the owner to a multisig, ideally behind a timelock.** Owner can switch the oracle — a malicious oracle can push fee to `maxFee` (≤10%) or to `minFee`. Ownership is 2-step (`transferOwnership` + `acceptOwnership`).
4. **Set a sensible curve before launch.** Script example: 0.05% calm (vol ≤ 2000) → 1% volatile (vol ≥ 15000), fallback 0.30%. `volLow/volHigh` must use the same scale as the oracle.
5. **Initialize + add first liquidity together** (e.g. PositionManager `multicall` with `initializePool` + `modifyLiquidities`), or at least right after. With no liquidity, anyone can move the price, so a bad initial price is a problem only until arbitraged, but adding liquidity at a skewed price loses money. Since only one pool key is allowed, a griefer who initializes first can only pick the starting price, not squat a different pool.
6. **Dry run on a fork first:**
   ```sh
   export TOKEN=<your token> PAIR_TOKEN=0x0000000000000000000000000000000000000000 \
          OWNER=<multisig> ORACLE_UPDATER=<keeper> TICK_SPACING=60 SQRT_PRICE_X96=<price>
   forge script script/DeployDynamicFeeHook.s.sol --fork-url $MAINNET_RPC_URL --sender <deployer>
   ```
   Done on 2026-09-21 with dummy token: hook mined to `0x1707…2080`, pool initialized, ~2.38M gas total. Then `--rpc-url mainnet --broadcast --verify`.
7. **Verify** hook + oracle on Etherscan; confirm `hook.getHookPermissions()` and address suffix; confirm PoolManager `Initialize` event shows `fee = 8388608` (0x800000) and your hook.

## Wiring in the real volatility signal later

Deploy any contract implementing `IVolatilityOracle`, then owner calls `setOracle(newOracle)`. Requirements:
- view, cheap (< 50k gas, runs inside every swap), returns 32 bytes.
- hard to manipulate inside one block/tx: if it reads this pool's own price, use a time-weighted value, not spot, or a swapper can pump "volatility" in one tx to raise fees on others (or dampen it to pay less).
- same units as `volLow/volHigh`, or update `setFeeConfig` in the same timelock batch.

Options: keeper pushing realized vol (like the stub), Chainlink/other feed, TWAP-deviation computed from an observation hook (would need `afterSwap` → a new hook, since permissions are fixed in the address — so decide now if you'll need it).

## Not done / open

- No audit. Tests are local only (5 passing: fee ramp, interpolation, oracle-down fallback, static-fee pool rejected, owner-only).
- Oracle returning huge data could waste gas (return-data copy); oracle is owner-chosen, so accepted.
- Libs are `v4-core` / `v4-periphery` main branches as of install; pin to commits/tags before production.
- Liquidity provisioning not scripted — do via PositionManager.
