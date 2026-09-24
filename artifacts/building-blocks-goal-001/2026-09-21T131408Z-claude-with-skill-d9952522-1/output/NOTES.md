# Volatility-based dynamic fee — Uniswap v4 hook

## Why v4 + a hook

- Uniswap v2/v3 pools have a fixed fee tier picked at creation. Changing it = new pool + move liquidity.
- Uniswap v4 pools can be created as **dynamic-fee** pools, where a **hook** contract (attached at creation) sets the fee. Fee logic runs inside every swap, no liquidity migration.
- Deliverable: `src/VolatilityFeeHook.sol` (the hook) + `src/interfaces/IVolatilitySignal.sol` (stub point for the signal) + `src/mocks/StubVolatilitySignal.sol` (placeholder signal) + `script/Deploy.s.sol`.

Onchain checks, Ethereum mainnet, block 26026113 (2026-09-21), via `cast`:

| Contract | Address | Check |
|---|---|---|
| v4 PoolManager | `0x000000000004444c5dc75cB358380D2e3dE08A90` | has code (24,009 bytes); `owner()` = `0x1a9C…35BC`, `protocolFeeController()` = `0x89A5…051dB` |
| v4 PositionManager | `0xbD216513d74C8cf14cf4747E6AaA6420fF64ee9e` | has code; `poolManager()` = PoolManager above |
| Universal Router (v4) | `0x66a9893cc07d91d95644aedd05d03f95e1dba8af` | has code |
| StateView | `0x7ffe42c4a5deea5b0fec41c94c136cf115597227` | has code |
| CREATE2 deployer | `0x4e59b44847b379578588920cA78FbF26c0B4956C` | has code (used by the deploy script) |

The fork test `VolatilityFeeHookForkTest` deploys the hook and sets up a pool on the **live mainnet PoolManager** (on a fork), then checks the fee charged on swaps. It passed.

## How the fee is picked and applied on each swap

1. Someone swaps. The router calls `PoolManager.swap`.
2. The pool was created with `fee = 0x800000` (`DYNAMIC_FEE_FLAG`) and the hook's `BEFORE_SWAP` flag set, so the PoolManager calls `hook.beforeSwap(...)` first.
3. The hook reads `signal.volatility()` via a `staticcall` (read-only call) with a 50k gas cap.
   - If the call reverts, runs out of gas, has no code, or returns bad data → it uses **`maxFee`**. A broken signal makes swaps more expensive, not free, and never blocks swaps.
   - If the swapper sends too little gas for the signal call to get its full 50k, the hook **reverts**. That stops anyone from forcing the fallback path on purpose.
4. The volatility value becomes a fee (`feeForVolatility`):
   - `vol <= lowVolatility` → `minFee`
   - `vol >= highVolatility` → `maxFee`
   - anything in between → straight-line interpolation
5. The hook returns `fee | OVERRIDE_FEE_FLAG (0x400000)`. The PoolManager charges that LP fee **for this swap only** and reports it in the `Swap` event's `fee` field.

Units: fees are in hundredths of a bip (`3000` = 0.30%, `1_000_000` = 100%). Volatility units are whatever the signal uses; the thresholds just need to use the same units.

Tuning after launch, no redeploy (owner only):
- `setSignal(newSignal)`: swap in the real volatility source.
- `setFeeConfig({minFee, maxFee, lowVolatility, highVolatility})`: change the fee curve. It's checked so that `minFee <= maxFee <= 5%` (`MAX_FEE`, fixed in code) and `low < high`.

What the hook itself cannot change: its address and code. The hook address is part of the pool's identity (`PoolKey`), so a new hook means a new pool. That's why everything you'd want to change later (signal, curve) is a setting, and the logic is kept small.

Guards:
- `beforeInitialize`: only `owner` may create a pool with this hook, and only one. The pool must be dynamic-fee. This blocks front-running the pool creation with a bad starting price, and blocks other pools from using the hook.
- Every callback is `onlyPoolManager`.
- Ownership changes take two steps (`transferOwnership` → `acceptOwnership`).

## The volatility signal (stub)

`IVolatilitySignal.volatility() returns (uint256)`. Right now it's `StubVolatilitySignal`, a number the owner sets by hand. What a real one needs:
- **Can't be moved within one block by trading this pool.** Don't compute it from this pool's spot price. Otherwise an attacker pushes the price, gets a low fee (or makes others pay a high one), and pushes it back. Use a TWAP (time-weighted average price) or realized volatility over past blocks, an external oracle, or a value a keeper pushes.
- **Handle stale data yourself.** The hook doesn't know how old a value is. If the data is too old, the signal should revert, which makes the hook charge `maxFee`.
- **Stay under 50k gas.** Every swap pays for this call.

## Deploying correctly

Things you can't fix after launch without a new pool and moving liquidity:
1. **`PoolKey.fee` must be `0x800000`** (`DYNAMIC_FEE_FLAG`). A normal fee tier means the hook can never change the fee (the hook's `beforeInitialize` refuses this anyway).
2. **Hook address flags.** The low 14 bits of the hook address must be exactly `BEFORE_INITIALIZE | BEFORE_SWAP`. The script searches for a CREATE2 salt that produces such an address, and the constructor reverts if the flags don't match.
3. **Pair and tick spacing.** Native ETH (`PAIR=0x0`, v4 supports it) vs WETH gives two different pools. Pick one. Tick spacing defaults to 60.
4. **The hook code.** Test and audit before launch. It can't be upgraded (on purpose: LPs can trust the 5% cap).

Steps:
```sh
forge install   # or: git clone v4-core into lib/ at commit 59d3ecf5 (v4.0.0+12), init its solmate/forge-std/oz submodules
forge build && forge test
MAINNET_RPC_URL=... forge test --mc Fork   # run against the live PoolManager

# dry run, then add --broadcast plus wallet flags
TOKEN=0xYourToken PAIR=0x0000000000000000000000000000000000000000 \
SQRT_PRICE_X96=<launch price> FINAL_OWNER=0xYourSafe \
MIN_FEE=500 MAX_FEE=10000 LOW_VOL=... HIGH_VOL=... [SIGNAL=0x...] \
forge script script/Deploy.s.sol --rpc-url mainnet --sender 0xDeployer
```
The script:
1. Deploys the stub signal (unless `SIGNAL` is set)
2. Finds the salt and deploys the hook via CREATE2, with the deployer as temporary owner
3. Calls `PoolManager.initialize` directly (it has to be a direct call: the hook checks that `sender == owner`, so going through the PositionManager multicall would fail)
4. Calls `transferOwnership(FINAL_OWNER)`

After that:
- The Safe (multisig) calls `hook.acceptOwnership()`. Until it does, the deployer EOA controls the fee settings.
- `SQRT_PRICE_X96 = sqrt(price1/price0) * 2^96` using the sorted token order (`currency0` = lower address) and raw token units. A wrong value means the pool opens at the wrong price.
- Add liquidity through the PositionManager (`0xbD21…ee9e`) with slippage limits, right after initializing. With no liquidity, swaps do nothing, but the first LP deposit is exposed to a bad price if step 3 used the wrong one.
- The stub signal's owner is `FINAL_OWNER`. Replace it with the real signal (`setSignal`) before relying on the fee behavior. With the stub at 0, the pool charges `minFee`.
- Verify the hook and signal source on Etherscan. Check `hook.poolInitialized()`, `hook.feeConfig()`, `hook.currentFee()`.
- Monitoring and UIs: the pool's stored `slot0.lpFee` stays 0, because the fee is set per swap. Read `hook.currentFee()`, or the `fee` field in `PoolManager`'s `Swap` events.
- The Uniswap protocol fee (set by Uniswap governance through the PoolManager's fee controller) is separate from, and on top of, this LP fee.

## Unresolved questions
- Real signal source: oracle, TWAP-derived, or keeper-pushed? That decides its units and the thresholds.
- Final fee curve (`minFee`/`maxFee`/thresholds), and whether the 5% hard cap fits.
- Pair with native ETH or WETH?
- Owner = which Safe? Should fee changes go through a timelock (delay before they take effect)?
- Routing: not verified whether major aggregators route through hooked dynamic-fee v4 pools. Check before launch.
