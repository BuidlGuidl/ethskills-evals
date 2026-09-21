# Can we reuse the mainnet Uniswap v4 addresses on Base and Arbitrum?

**No. The plan is not safe.** Uniswap v4 is deployed at a **different address on each chain**. The mainnet PoolManager has no code at all on Base or Arbitrum. Worse, some mainnet *periphery* addresses do have code on the L2s. Those are copies wired to a PoolManager that doesn't exist there, so a quick "is there code at this address?" check would wrongly say they're fine.

We need per-chain config.

## Why the CREATE2 argument fails

CREATE2 gives the same address on two chains only if the **same deployer** uses the **same salt** with **byte-identical init code** on both. (Init code = the contract's creation bytecode plus its constructor arguments.) Uniswap didn't deploy v4 that way:

- The mainnet PoolManager `0x000000000004444c…` is a vanity address (hand-picked, mined for its leading zeros) that was only mined for mainnet.
- Every periphery contract takes the PoolManager address as a constructor argument. Different PoolManager means different init code, so a different address, even with an identical deployer and salt.

"Uniswap uses CREATE2" says how an address was produced. It doesn't mean the address is the same on every chain. Permit2 is a real same-everywhere contract. v4 is not.

## What I checked on-chain (2026-09-21, public RPCs, chain IDs 1 / 8453 / 42161)

### 1. PoolManager: bytecode size at each candidate address on each chain

| Address | Ethereum | Base | Arbitrum |
|---|---|---|---|
| `0x000000000004444c5dc75cB358380D2e3dE08A90` (mainnet PM) | **24009** | 0 | 0 |
| `0x498581fF718922c3f8e6A244956aF099B2652b2b` | 0 | **24009** | 0 |
| `0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32` | 0 | 0 | **24009** |

Each chain has exactly one PoolManager, and each is at a different address. The bytecode size is the same on all three, so it's the same contract, just deployed at different addresses.

### 2. Periphery: identity check via `poolManager()`

I called `poolManager()` on each periphery contract. On all three chains, every contract returned that chain's own PoolManager from the table above.

| Contract | Ethereum | Base | Arbitrum |
|---|---|---|---|
| PoolManager | `0x000000000004444c5dc75cB358380D2e3dE08A90` | `0x498581fF718922c3f8e6A244956aF099B2652b2b` | `0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32` |
| PositionManager | `0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e` | `0x7C5f5A4bBd8fD63184577525326123B519429bDc` | `0xd88F38F930b7952f2DB2432Cb002E7abbF3dD869` |
| UniversalRouter | `0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af` | `0x6fF5693b99212Da76ad316178A184AB56D299b43` | `0xA51afAFe0263b40EdaEf0Df8781eA9aa03E381a3` |
| V4Quoter | `0x52F0E24D1c21C8A0cB1e5a5dD6198556BD9E1203` | `0x0d5e0F971ED27FBfF6c2837bf31316121532048D` | `0x3972C00f7ed4885e145823eb7C655375d275A1C5` |
| StateView | `0x7fFE42C4a5DEeA5b0feC41C94C136Cf115597227` | `0xA3c0c9b65baD0b08107Aa264b0f3dB444b867A71` | `0x76Fd297e2D437cd7f76d50F01AfE6160f86e9990` |
| Permit2 (the real same-everywhere one) | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | same | same |

### 3. The trap: what's at the mainnet periphery addresses on the L2s

| Mainnet address | Base | Arbitrum |
|---|---|---|
| UniversalRouter `0x66a9…A8Af` | code present, `poolManager()` = **`0x…4444` (mainnet PM, no code on Base)** | code present, `poolManager()` = **`0x…4444` (no code on Arbitrum)** |
| PositionManager `0xbD21…ee9e` | no code | code present, `name()` = "Uniswap v4 Positions NFT", `poolManager()` = **`0x…4444`** |
| Quoter / StateView | no code | no code |

Someone redeployed the mainnet init code byte for byte at these addresses (CREATE2 makes that possible). The contracts look like real Uniswap contracts, but they point at an empty PoolManager address. So on Arbitrum, the reused mainnet config would:

- pass a "code exists" check
- pass a `name()` check
- then fail, or behave in unexpected ways, once it actually touches pools

This is why checking identity (`poolManager()`) matters, and checking presence alone isn't enough. There's also a longer-term risk: if anyone ever deploys something at `0x…4444` on an L2, these orphan contracts would start talking to it.

## What to do

1. **Per-chain config keyed by chain ID.** Use the addresses from table 2. No fallback to mainnet values: an unknown chain ID should throw.
2. **Check at startup/deploy time.** For each chain, assert:
   - `chainId` matches
   - there is code at each address
   - `PositionManager.poolManager()`, `UniversalRouter.poolManager()`, `Quoter.poolManager()` and `StateView.poolManager()` all equal that chain's PoolManager

   That single identity assertion would have caught the trap above.
3. **Re-derive pool IDs per chain.** A v4 PoolKey is currency0, currency1, fee, tickSpacing and hooks. Token addresses differ per chain: use native USDC on Base/Arbitrum, not bridged USDbC / USDC.e. Any hook addresses also have to exist on that chain. Mainnet pool IDs won't carry over.
4. **Check liquidity per chain.** The deepest pool for your pairs on Base or Arbitrum may not be a v4 pool at all. Other venues like Aerodrome on Base or Camelot on Arbitrum, or v3 pools, could be deeper. Quote at real trade sizes before assuming v4 routing is best.

## Before real funds move

Before launch, re-check every address above against Uniswap's official deployments page (docs.uniswap.org → Contracts → v4 → Deployments) and the Basescan / Arbiscan pages. My on-chain checks show these contracts are consistent with each other and live today. They don't replace checking against Uniswap's own list, and a later redeployment could change the answer.

Commands to re-run:

```bash
cast codesize <addr> --rpc-url <chain rpc>
cast call <periphery> "poolManager()(address)" --rpc-url <chain rpc>
```
