# Uniswap v4 on Base + Arbitrum: can we reuse mainnet addresses?

## Short answer

**No. The plan is not safe.** Uniswap v4 core contracts are at **different addresses on each chain**. Using the mainnet addresses on Base or Arbitrum means pointing at the wrong contract, or at an empty address.

## Reasoning

1. **The claim "Uniswap uses CREATE2, so every address is the same" is wrong for v4.**
   CREATE2 only gives the same address when the deployer, salt, and bytecode are all identical on every chain. The v4 deployments did not meet that. The mainnet PoolManager `0x000000000004444c5dc75cB358380D2e3dE08A90` is a vanity address (a custom-picked address with lots of leading zeros). It was not reproduced on the L2s.

2. **The claim isn't even fully true for v3.** v3 Factory and SwapRouter02 share an address on mainnet, Arbitrum and Optimism, but **Base is different** (Factory `0x3312…FdfD`, SwapRouter02 `0x2626…e481`). "Uniswap is the same everywhere" has never been a safe rule.

3. **What goes wrong if we ship it:**
   - Best case: the address is empty on the L2. Calls return nothing or revert, and the integration is simply broken.
   - Worst case: some other contract sits at that address on the L2 (anyone can deploy there). Users would approve tokens to it or send funds to it, and could lose them. A wrong address is a security bug, not just a bug.
   - Hardcoded hook addresses, PoolKeys, and pool IDs all depend on the PoolManager. Pool IDs are the same hash on every chain, but the pools only exist on the chain where someone created them, and liquidity is different on each chain.

4. **Per-chain config is required.** Only a few contracts really share an address across chains, for example Permit2.

## Addresses to use

From the verified address list (last checked onchain Mar 2026):

| Contract | Mainnet | Base (8453) | Arbitrum One (42161) |
|---|---|---|---|
| PoolManager | `0x000000000004444c5dc75cB358380D2e3dE08A90` | `0x498581ff718922c3f8e6a244956af099b2652b2b` | `0x360e68faccca8ca495c1b759fd9eee466db9fb32` |
| PositionManager | `0xbd216513d74c8cf14cf4747e6aaa6420ff64ee9e` | `0x7c5f5a4bbd8fd63184577525326123b519429bdc` | `0xd88f38f930b7952f2db2432cb002e7abbf3dd869` |
| Universal Router (v4) | `0x66a9893cc07d91d95644aedd05d03f95e1dba8af` | `0x6ff5693b99212da76ad316178a184ab56d299b43` | `0xa51afafe0263b40edaef0df8781ea9aa03e381a3` |
| Permit2 (same everywhere) | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | same | same |

**Quoter and StateView:** I only have verified mainnet addresses for these (Quoter `0x52f0e24d…1203`, StateView `0x7ffe42c4…7227`). They are also different per chain. Get the Base/Arbitrum ones from the official deployments page (https://docs.uniswap.org/contracts/v4/deployments). Don't guess them.

Token addresses differ too. For example, WETH is `0x4200…0006` on Base and `0x82aF…Bab1` on Arbitrum, and native USDC is `0x8335…2913` on Base and `0xaf88…5831` on Arbitrum.

## What to ship instead

1. Keep a per-chain config map keyed by `chainId` (PoolManager, PositionManager, Universal Router, Quoter, StateView, Permit2, tokens). If a chain isn't in the map, throw an error. Never fall back to mainnet values.
2. Check every address against the official Uniswap v4 deployments page and the block explorer (Basescan, Arbiscan).
3. Add a startup or CI check that runs `cast code <addr> --rpc-url <chain rpc>` on each address and makes sure the result isn't empty. Also run a quick read call to confirm it's the right contract, e.g. `PositionManager.poolManager()` should return that chain's PoolManager.
4. If the app uses custom hooks, deploy them on each chain. v4 encodes hook permissions in the hook's address bits, so you'll need to mine a new salt against each chain's PoolManager.
5. Check which pools and how much liquidity actually exist on each chain. Pools from mainnet are not automatically on Base or Arbitrum, and on Base the deepest liquidity for many pairs is on Aerodrome, not Uniswap.

## Open questions
- Does the app use custom hooks? If yes, they need a deploy on each chain (point 4).
- Do you need Quoter/StateView on the L2s? If yes, pull those addresses from the official docs before launch.
