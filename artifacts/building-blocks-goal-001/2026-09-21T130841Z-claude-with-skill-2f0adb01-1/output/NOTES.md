# Dynamic-fee pool: notes

## What this is

A **Uniswap v4 hook** (`src/DynamicFeeHook.sol`). A hook is a contract attached to a pool when the pool is created. The v4 PoolManager calls it at fixed points (here: before pool creation and before each swap).

We need v4 for this. In v2/v3 the fee is fixed per pool, so changing it means a new pool and moving liquidity. In v4 a pool can be created with a **dynamic fee**, and its hook picks the fee for each swap.

Files:
- `src/DynamicFeeHook.sol`: the hook. This is what we deploy.
- `src/interfaces/IVolatilityOracle.sol`: the volatility signal, behind one function: `volatility(PoolKey) -> uint256`.
- `src/mocks/StubVolatilityOracle.sol`: placeholder signal. The owner sets the number by hand.
- `script/DeployDynamicFeeHook.s.sol`: deploys the oracle and hook, then creates the pool.
- `test/DynamicFeeHook.t.sol`: runs against a real local PoolManager (fee mapping, higher vol gives less output, oracle failure, static-fee pool rejected, access control).

`forge build` and `forge test` both pass (5/5).

## How the fee is decided and applied on each swap

1. A user swaps through any router (Universal Router, an aggregator, etc.). The router calls `PoolManager.swap`.
2. The hook address has the `BEFORE_SWAP` bit set, so the PoolManager calls `hook.beforeSwap(...)`.
3. `beforeSwap` calls `currentFee(key)`:
   - It reads `oracle.volatility(key)` with a fixed gas budget (`ORACLE_GAS_LIMIT` = 50k).
   - It maps the value to a fee (`feeForVolatility`):
     - `vol <= lowVol` → `minFee`
     - `vol >= highVol` → `maxFee`
     - in between → a straight line from `minFee` to `maxFee`
   - If the oracle is not set, reverts, or returns bad data, it uses `fallbackFee`. Swaps never fail because of the oracle.
4. The hook returns `fee | OVERRIDE_FEE_FLAG` (`0x400000`). The flag tells the PoolManager to use this fee **for this swap only**. Without the flag, the PoolManager ignores the returned value and uses the pool's stored fee. That stored fee is 0 for a new dynamic pool, so the swap would be free.
5. The fee goes to LPs in the usual way. Nothing is stored and there is no keeper, so the fee is always recomputed at swap time.

Units: fees are in hundredths of a basis point. `500` = 0.05%, `3000` = 0.30%, `10_000` = 1%. `MAX_FEE_CAP` = 10%. The admin cannot go above it.

Changing things after launch (no redeploy, no moving liquidity):
- `setOracle(newOracle)`: swap in the real signal. Any contract that implements `IVolatilityOracle` works.
- `setFeeConfig(cfg)`: retune the fees and thresholds. Bad configs are rejected: `min <= max <= cap`, `min <= fallback <= cap`, `lowVol < highVol`.
- Ownership changes in two steps: `transferOwnership`, then `acceptOwnership`.

The hook's own code cannot be changed. The pool's `PoolKey` includes the hook address, so a different hook means a different pool. That is why the fee logic is kept simple and all the changeable parts (signal source, parameters) are settings.

## Requirements for the real volatility signal

- **It must be hard to push around within one transaction.** An attacker could make vol look low, swap cheaply, then undo it. Do **not** read this pool's current price or tick. Good sources: a time-weighted value, a Chainlink-style feed, or a value pushed by a keeper and smoothed over time.
- **It must be cheap.** It runs on every swap, and it gets 50k gas. If it runs out, the fallback fee is used.
- It must be a `view`, because the hook calls it with `staticcall`.
- Its units must match `lowVol`/`highVol`. Set both together.
- If the signal needs per-swap state (for example, realized vol from swap prices), put it in a separate contract. Or add an `afterSwap` permission, but that is a **new hook address and a new pool**. So decide this before launch.

## Deploying correctly (Ethereum mainnet)

1. **The hook address encodes its permissions.** v4 reads the hook's permissions from the lowest 14 bits of its address. This hook needs exactly `BEFORE_INITIALIZE` (bit 13) and `BEFORE_SWAP` (bit 7). Everything else must be 0. The script finds a CREATE2 salt (a number that fixes the deploy address) with `HookMiner`, using forge's standard CREATE2 deployer `0x4e59b44847b379578588920cA78FbF26c0B4956C`. The constructor also checks the address (`Hooks.validateHookPermissions`), so a wrong address fails at deploy time.
   - The salt depends on the bytecode **and** on the constructor args (owner, oracle, config). If any of them change, find the salt again.
2. **Create the pool with `fee = LPFeeLibrary.DYNAMIC_FEE_FLAG` (`0x800000`)** and `hooks = hook`. `beforeInitialize` rejects any other fee value.
3. **PoolManager (mainnet): `0x000000000004444c5dc75cB358380D2e3dE08A90`.** It is set at deploy time and cannot be changed. Check it again before deploying. v4 addresses differ per chain.
4. **currency0 < currency1.** Sort the tokens. Native ETH is `address(0)`, so it is always currency0. Pick `tickSpacing` now (the script uses 60). It is part of the pool key and cannot be changed later.
5. `SQRT_PRICE_X96` sets the starting price. Compute it carefully. A wrong starting price gets arbitraged away at the first LP's expense.
6. **Add liquidity** through the v4 PositionManager after the pool is created. The script does not do this.
7. **Owner**: use a multisig, ideally behind a timelock. The owner can raise fees up to 10% at any time, and can swap the oracle for anything that implements the interface. Since `pendingOwner` must accept, a typo in the new address does not lose ownership.
8. **Before launch**:
   - Set `fallbackFee` to a sensible default. The script uses 0.30% with a 0.05–1% range.
   - Wire up the real oracle, or keep the stub and set it by hand.
   - Run a mainnet fork test: deploy, create the pool, add liquidity, and swap through the Universal Router (`0x66a9893cc07d91d95644aedd05d03f95e1dba8af`).
   - Verify the source on Etherscan.
   - Get an audit.
9. **Tell routers and aggregators.** Some cache fees or skip hooked pools. Quotes stay correct because the v4 Quoter simulates the hook, but people watching for the pool may expect a fixed fee.

Run:
```sh
export OWNER=0x... TOKEN=0x... PAIR_TOKEN=0x0000000000000000000000000000000000000000 SQRT_PRICE_X96=...
forge script script/DeployDynamicFeeHook.s.sol --rpc-url mainnet --broadcast --verify
```

## Open questions
- Where does the volatility signal come from (Chainlink, our own keeper, a TWAP-based contract)? This decides its units and thresholds.
- Fee range and fallback: are 0.05% / 1% / 0.30% OK?
- Should the owner be a timelock, and with what delay?
- Pair with ETH or with USDC?
