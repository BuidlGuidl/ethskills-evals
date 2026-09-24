# Dynamic-fee Uniswap v4 pool

The pool is a **Uniswap v4 pool with a hook** (a hook is a contract the pool calls at set moments, e.g. before each swap).
Only v4 lets a pool's fee change per swap; v2/v3 fees are fixed when the pool is created.

## Files

| File | Role |
|---|---|
| `src/DynamicFeeHook.sol` | The hook. Decides the fee on every swap. **Deploy this.** |
| `src/interfaces/IVolatilityOracle.sol` | Interface for the volatility signal: `volatility(PoolKey) -> uint256`. |
| `src/ManualVolatilityOracle.sol` | Placeholder signal: a trusted updater sets the value by hand. Replace later. |
| `script/Deploy.s.sol` | Deploys oracle + hook (at a mined address) and creates the pool. |
| `test/DynamicFeeHook.t.sol` | Local tests against a real v4 `PoolManager`. |

`forge build` / `forge test` (5 tests pass). Dependencies: `lib/v4-core`, `lib/forge-std`
(installed with `forge install uniswap/v4-core foundry-rs/forge-std`).

## How the fee is decided and applied on each swap

1. Someone swaps. The v4 `PoolManager` sees the hook address has the `BEFORE_SWAP` bit and calls `hook.beforeSwap`.
2. The hook reads the signal: `oracle.volatility(key)`, via a `staticcall` capped at 50k gas.
3. It turns volatility into a fee (fee units are "pips": 1_000_000 = 100%, so 3000 = 0.30%):
   - `vol <= lowVol`  → `minFee`
   - `vol >= highVol` → `maxFee`
   - in between       → straight line from `minFee` to `maxFee`
   - oracle unset / reverts / has no code / bad return → `fallbackFee`
     (the pool never gets stuck because of the oracle).
4. The hook returns `fee | OVERRIDE_FEE_FLAG` (0x400000). Because the pool was created with
   `fee = DYNAMIC_FEE_FLAG` (0x800000), the PoolManager uses that fee **for this swap only**.
   Nothing is written to storage, so there's no stale fee and no extra keeper transaction.
5. The fee goes to LPs as normal. (Uniswap protocol fee, if ever turned on, is separate.)

Default curve in the deploy script: 0.05% below 30% annualized vol, 1% above 150%, fallback 0.30%.
The owner can change it with `setFeeConfig`; it can never exceed `MAX_FEE_CAP` = 5% (hardcoded).

### Changing things later without migrating liquidity

A v4 pool's identity (`PoolKey`) includes the hook address, so **the hook itself can never be
swapped out** — a new hook means a new pool and moving liquidity. Everything that may change lives
behind the hook instead:
- new signal → `setOracle(newOracle)` (any contract implementing `IVolatilityOracle`)
- new curve  → `setFeeConfig(...)`
- new admin  → `transferOwnership` + `acceptOwnership`

The fee logic itself (linear curve, fallback rule) is fixed. If you think you'll want a different
shape, put that logic in the oracle (e.g. have it return a value that maps 1:1 onto fees).

## Deploying correctly

1. **Hook address must encode its permissions.** v4 reads which callbacks to call from the lowest
   14 bits of the hook address. This hook needs exactly `BEFORE_INITIALIZE | BEFORE_SWAP`
   (`0x2080`). The script searches for a CREATE2 salt that gives such an address and deploys via
   the standard CREATE2 proxy `0x4e59b44847b379578588920cA78FbF26c0B4956C`. The constructor
   reverts if the bits are wrong, so a bad deploy fails loudly instead of silently never charging.
   Changing any constructor arg or compiler setting changes the address → re-mine (the script does it).
2. **Pool must be created with `fee = 0x800000` (`DYNAMIC_FEE_FLAG`).** With a fixed fee the override
   is ignored. `beforeInitialize` rejects such pools, and pools that don't contain `TOKEN`.
3. **Correct PoolManager.** Mainnet: `0x000000000004444c5dc75cB358380D2e3dE08A90` (verify against
   Uniswap's official deployment docs before sending). It is an immutable in the hook.
4. **Currency order.** `currency0 < currency1` by address; native ETH is `address(0)` and is always
   `currency0`. The script sorts them. `SQRT_PRICE_X96` must be the price of currency1 in currency0
   for *that* order.
5. **Initialization front-running.** Anyone can initialize the same `PoolKey` first with a silly
   price. Create the pool and add first liquidity in one transaction (v4 `PositionManager`
   `multicall`: `initializePool` + `modifyLiquidities`), or check `slot0` price before adding.
   The script only initializes; add liquidity via PositionManager / Uniswap UI afterwards.
6. **Owner = multisig, ideally behind a timelock.** The owner can move fees up to 5% and point the
   oracle anywhere. Don't leave it on the deployer EOA.
7. **Verify** hook + oracle on Etherscan and check once live: `hook.currentFee(key)`, a small test swap,
   and that the pool is picked up by the routers/aggregators you care about (hook pools may need
   to be allow-listed or indexed before they get routed).

Run:
```
TOKEN=0x... PAIR=0x0000000000000000000000000000000000000000 OWNER=0xSafe... \
SQRT_PRICE_X96=... forge script script/Deploy.s.sol --rpc-url $MAINNET_RPC --broadcast --verify
```
Try it first on a mainnet fork (`--fork-url`, no `--broadcast`) or Sepolia (change `POOL_MANAGER`).

## Requirements for the real volatility signal

- **Cheap `view`**, under 50k gas, never reverting in normal use (else every swap pays `fallbackFee`).
- **Not manipulable inside one block.** Don't compute it from this pool's own current price: an
  attacker could push "volatility" down, swap cheaply, and push it back. Use something like a
  time-weighted history, an offchain feed (Chainlink-style) pushed by a keeper, or a
  signal that only updates once per block.
- **Staleness:** if it's pushed by a keeper, decide what happens when updates stop
  (e.g. oracle returns a high value when data is older than N minutes).
- Units must match `lowVol` / `highVol` (suggested: annualized vol in bps, 10_000 = 100%).

## Not covered / open

- No audit. Hook bugs can't be patched (hook address is permanent), only reconfigured.
- Deploy script not run against mainnet/fork here (no RPC in this environment).
- `ManualVolatilityOracle` is a trusted, manual stand-in — not for production.
