# Can we reuse mainnet Uniswap v4 addresses on Base and Arbitrum?

**No. The plan is not safe.** Uniswap v4 core and most of its helper contracts sit at **different addresses on each chain**. On Base and Arbitrum there is no contract at all at the mainnet PoolManager address. Worse, a few other mainnet addresses *do* have contracts on the L2s, but they are dead copies wired to mainnet addresses. They look fine at first and then break. We need per-chain config.

## Why "CREATE2 means same address everywhere" is wrong

A CREATE2 address depends on three things: `keccak256(0xff ++ deployer ++ salt ++ keccak256(initCode))`. The address matches across chains only if **all three match**:

1. **Same deployer.** Uniswap did not use one shared factory for v4 on every chain.
2. **Same salt.** The mainnet PoolManager `0x000000000004444c…` is a "vanity" address, found by searching for a salt that gives lots of leading zeros. That salt was not reused elsewhere.
3. **Same init code.** Init code includes the constructor arguments. v4 contracts take chain-specific arguments (owner, the PoolManager address, WETH, and so on). So the address changes even when the deployer and salt stay the same.

A few contracts really are at the same address everywhere (see Permit2 below), and that's likely where the idea came from. It's true for them, not for v4 as a whole.

## Checked onchain (`eth_getCode` / `eth_call` against public RPCs, 2026-09-21)

### 1. The mainnet PoolManager address is empty on both L2s

| Address | Ethereum | Base (8453) | Arbitrum (42161) |
|---|---|---|---|
| `0x000000000004444c5dc75cB358380D2e3dE08A90` (mainnet PoolManager) | code (24,009 B) | **empty (`0x`)** | **empty (`0x`)** |
| `0x498581fF718922c3f8e6A244956aF099B2652b2b` | – | code (the Base PoolManager) | empty |
| `0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32` | – | empty | code (the Arbitrum PoolManager) |

Calling an address with no code does **not** revert in the EVM. It "succeeds" and returns nothing. Depending on how our code decodes the result, we'd get a confusing revert or, worse, silently wrong values. Tokens sent to that address are lost.

### 2. Some mainnet helper addresses have trap contracts on the L2s

- **Mainnet PositionManager `0xbd21…ee9e` on Arbitrum:** there is code at this address (same bytecode size as the real one). But `poolManager()` returns the **mainnet** PoolManager address `0x…4444c5dc…`, which is empty on Arbitrum. `nextTokenId()` returns 1, so nobody has ever used it. The real Arbitrum PositionManager (`0xd88f…d869`) returns the Arbitrum PoolManager and has about 209k positions.
- **Mainnet Universal Router `0x66a9…a8af` on Base and Arbitrum:** the bytecode is byte-for-byte identical on all three chains. Its baked-in settings (set once at deploy time and stored in the bytecode) include **mainnet WETH `0xC02a…6Cc2`** and the **mainnet PoolManager**. On Base and Arbitrum both of those point at the wrong things. Swaps through it won't work.
- The mainnet StateView and V4Quoter addresses are empty on both L2s.

A simple "is there code at this address?" check would **pass** for the router and (on Arbitrum) the PositionManager. That's why reusing mainnet addresses is dangerous, not just broken.

### 3. What does match across chains

- **Permit2 `0x000000000022D473030F116dDEE9F6B43aC78BA3`** has code on all three chains and is the real Permit2 everywhere. It was deployed deterministically on purpose. We can reuse it.

## What to use (verified: each contract's `poolManager()` returns that chain's PoolManager)

| Contract | Ethereum (1) | Base (8453) | Arbitrum One (42161) |
|---|---|---|---|
| PoolManager | `0x000000000004444c5dc75cB358380D2e3dE08A90` | `0x498581fF718922c3f8e6A244956aF099B2652b2b` | `0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32` |
| PositionManager | `0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e` | `0x7C5f5A4bBd8fD63184577525326123B519429bDc` | `0xd88F38F930b7952f2DB2432Cb002E7abbF3dD869` |
| Universal Router | `0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af` | `0x6fF5693b99212Da76ad316178A184AB56D299b43` | `0xA51afAFe0263b40EdaEf0Df8781eA9aa03E381a3` |
| StateView | `0x7fFE42C4a5DEeA5b0feC41C94C136Cf115597227` | `0xA3c0c9b65baD0b08107Aa264b0f3dB444b867A71` | `0x76Fd297e2D437cd7f76d50F01AfE6160f86e9990` |
| V4Quoter | `0x52F0E24D1c21C8A0cB1e5a5dD6198556BD9E1203` | `0x0d5e0F971ED27FBfF6c2837bf31316121532048D` | `0x3972C00f7ed4885e145823eb7C655375d275A1C5` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | same | same |

Double-check these against Uniswap's official deployments page (docs.uniswap.org → Contracts → v4 → Deployments) before shipping. Don't copy them blindly from here.

## Recommended change (keep it small)

1. **Per-chain config keyed by `chainId`**, for example `{ 1: {...}, 8453: {...}, 42161: {...} }`. If a chain is missing from the config, **fail loudly**. Never fall back to mainnet values.
2. **Startup check per chain:**
   - `eth_chainId` matches the config key.
   - `eth_getCode(poolManager) != 0x`.
   - Each helper contract's `poolManager()` equals the configured PoolManager. This catches the trap copies above.
3. **Pool IDs and pools are per chain too.** A pool's ID is built from its token addresses, fee, tick spacing and hooks contract. Token addresses differ per chain (WETH is `0x4200…0006` on Base and `0x82aF…Bab1` on Arbitrum; USDC differs on each). Any hooks contract we use must also be deployed on each chain, at an address with the right permission bits. So hardcoded mainnet pool keys won't work either.
4. Add a fork test (e.g. Foundry/Anvil fork of Base and Arbitrum) that runs one quote and one small swap, so these mistakes show up in CI.

## Unresolved questions
- Do we use a custom hooks contract? If yes, it needs its own deployment per chain, and the address must be mined so its permission bits come out right.
- Which token list or pools are we launching with on each L2? That drives the per-chain pool keys.
