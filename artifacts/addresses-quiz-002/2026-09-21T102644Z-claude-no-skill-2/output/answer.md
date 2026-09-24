# Can we reuse mainnet Uniswap v4 addresses on Base and Arbitrum?

**Short answer: No. The plan is not safe.** Uniswap v4 core contracts are at **different addresses on each chain**. You need a config for each chain.

## Why the "CREATE2 = same address everywhere" idea is wrong

1. **CREATE2 only gives the same address if *everything* matches.** The address comes from three things: the deployer address, a salt (a chosen number), and the contract's bytecode. The bytecode includes its constructor arguments. If any one of these is different on another chain, the address is different too.
2. **Uniswap did not deploy v4 that way.** On mainnet the PoolManager is at a "vanity" address (`0x000000000004444c...`). That address was mined with a salt and a specific deployer, and it was only used on mainnet. On Base, Arbitrum and other chains, the PoolManager and the helper contracts (PositionManager, Quoter, StateView, UniversalRouter) are all at **different addresses**. The constructor arguments also differ per chain (for example the owner address and the WETH address).
3. **Only a few contracts really are at the same address everywhere**, for example **Permit2** (`0x000000000022D473030F116dDEE9F6B43aC78BA3`). Because of these, people often assume all Uniswap contracts work that way. For v4 core and periphery, they don't.

## What goes wrong if you ship it

- **Best case:** there is no code at the mainnet address on Base or Arbitrum. Calls fail or return empty data, and swaps and liquidity actions break.
- **Worst case:** someone else has deployed a contract at that address on the L2, or does so later. Your app then sends user approvals and tokens to a contract you don't control. That can mean **lost funds**. Low-level calls to an address with no code also "succeed" in the EVM, so errors can go unnoticed.

## What to use instead (official Uniswap v4 deployments)

| Contract | Ethereum (1) | Base (8453) | Arbitrum One (42161) |
|---|---|---|---|
| PoolManager | `0x000000000004444c5dc75cB358380D2e3dE08A90` | `0x498581ff718922c3f8e6a244956af099b2652b2b` | `0x360e68faccca8ca495c1b759fd9eee466db9fb32` |
| PositionManager | `0xbd216513d74c8cf14cf4747e6aaa6420ff64ee9e` | `0x7c5f5a4bbd8fd63184577525326123b519429bdc` | `0xd88f38f930b7952f2db2432cb002e7abbf3dd869` |
| Quoter (V4Quoter) | `0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203` | `0x0d5e0f971ed27fbff6c2837bf31316121532048d` | `0x3972c00f7ed4885e145823eb7c655375d275a1c5` |
| StateView | `0x7ffe42c4a5deea5b0fec41c94c136cf115597227` | `0xa3c0c9b65bad0b08107aa264b0f3db444b867a71` | `0x76fd297e2d437cd7f76d50f01afe6160f86e9990` |
| UniversalRouter | `0x66a9893cc07d91d95644aedd05d03f95e1dba8af` | `0x6ff5693b99212da76ad316178a184ab56d299b43` | `0xa51afafe0263b40edaef0df8781ea9aa03e381a3` |
| Permit2 (same everywhere) | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | same | same |

I wrote these from memory. **Check each one against the official source before you ship:**
- Uniswap docs → "Contracts → v4 → Deployments" (docs.uniswap.org/contracts/v4/deployments)
- The explorer for each chain (etherscan.io, basescan.org, arbiscan.io): make sure the contract is verified and is really the Uniswap v4 contract

## Recommended changes

1. **Store addresses per chain**, keyed by chainId:
   ```ts
   export const UNISWAP_V4: Record<number, V4Addresses> = {
     1:     { poolManager: "0x0000...8A90", positionManager: "...", quoter: "...", stateView: "...", universalRouter: "..." },
     8453:  { poolManager: "0x4985...2b2b", ... },
     42161: { poolManager: "0x360e...fb32", ... },
   };
   ```
   If the chainId is not in the map, throw an error. Never fall back to the mainnet addresses.
2. **Check at startup or in CI** that each configured address has code (`eth_getCode` is not `0x`). Also do a quick sanity call, for example read a pool through StateView.
3. **Pool IDs and liquidity differ per chain too.** A PoolKey (currency0/1, fee, tickSpacing, hooks) is built from token addresses. USDC and WETH are at different addresses on each chain, and so are any hook contracts. A pool that exists on mainnet may not exist, or may have little liquidity, on Base or Arbitrum. Look up pool IDs for each chain; don't copy them from mainnet.
4. **If you use your own hooks**, deploy them separately on each chain. Their addresses must be mined again so the permission-flag bits in the address come out right. Add those addresses to the per-chain config too.
5. **Test on a fork first** (Base and Arbitrum forks with anvil/foundry) before going live.

## Summary

The CREATE2 idea sounds right, but it doesn't apply here: Uniswap v4 addresses are different on Base and Arbitrum. Reusing the mainnet addresses would at best break the app and at worst send user funds to an unknown contract. Use the per-chain addresses above (after checking them against the Uniswap docs), keep them in a config keyed by chainId, and check at startup that each address has code.
