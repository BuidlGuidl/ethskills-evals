# Can we reuse the mainnet Uniswap v4 addresses on Base and Arbitrum?

**No. The plan is not safe.** Uniswap v4 is deployed at a **different address on each chain**. The mainnet PoolManager has no code at all on Base or Arbitrum. Worse, some mainnet *periphery* addresses do have code on the L2s, and that code is wired to the missing PoolManager. So parts of the app would look like they work until real funds move.

You need per-chain config (chainId → addresses).

## Why the "CREATE2 = same address everywhere" idea is wrong

CREATE2 gives the same address only when the deployer, salt **and** init code are all identical. Constructor arguments are part of the init code: each chain's owner, its PoolManager address, its WETH, and so on. Uniswap also deployed v4 separately on each chain. So "uses CREATE2" does not mean "same address on every chain". Permit2 really is at the same address everywhere, but that is true because it was deployed that way, not because the brand guarantees it. It is not true for v4.

## What I checked on-chain (2026-09-21, public RPCs)

I confirmed the chain ids (1 / 8453 / 42161). Base was at block ~51.6M and Arbitrum at block ~507.4M.

### 1. PoolManager code size at each address, on each chain

| Address | Mainnet | Base | Arbitrum |
|---|---|---|---|
| `0x000000000004444c5dc75cB358380D2e3dE08A90` (mainnet PM) | 24009 | **0** | **0** |
| `0x498581fF718922c3f8e6A244956aF099B2652b2b` (Base PM) | 0 | 24009 | 0 |
| `0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32` (Arbitrum PM) | 0 | 0 | 24009 |

Each chain has the same bytecode at its own address. The mainnet address is empty on both L2s.

### 2. Identity, not just presence

- Each chain's PositionManager, StateView, V4Quoter and UniversalRouter return that chain's own PoolManager from `poolManager()` (full table below).
- `PoolManager.owner()`:
  - Mainnet: `0x1a9C8182C09F50C8318d769245beA52c32BE35BC` (Uniswap governance timelock)
  - Arbitrum: `0x2BAD8182C09F50c8318d769245beA52C32Be46CD`. This is exactly the timelock plus Arbitrum's standard L1→L2 alias offset `0x1111…1111`, so Uniswap governance controls it from L1.
  - Base: `0x31FAfd4889FA1269F7a13A66eE0fB458f27D72A9`. This is a different, Base-specific owner. That is expected for a separate deployment. Confirm it against Uniswap's docs.

### 3. The trap: mainnet periphery addresses that *do* have code on L2s

| Mainnet address | Base | Arbitrum | What its `poolManager()` returns there |
|---|---|---|---|
| UniversalRouter `0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af` | code (19499 B) | code (19499 B) | `0x0000…4444…8A90`, the mainnet PM, which is **empty** on that chain |
| PositionManager `0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e` | none | code, `name()` = "Uniswap v4 Positions NFT" | `0x0000…4444…8A90`, **empty** on Arbitrum |
| StateView `0x7fFE…7227`, Quoter `0x52F0…1203` | none | none | — |

Someone replayed the mainnet init code on the L2s. The bytecode hash matches mainnet, so the same constructor arguments were used. The result is contracts that look authentic: right bytecode, right NFT name. But they point at a PoolManager address that has no contract behind it on that chain.

A check like "is there code at this address?" or "does `name()` look right?" would **pass**. Only asking which PoolManager the contract is wired to, and then checking that PoolManager, catches it.

If the app reused mainnet addresses, it would get:

- empty reads from StateView and Quoter,
- successful approvals and Permit2 signatures granted to non-canonical contracts, and
- swaps and liquidity actions routed to contracts attached to nothing.

These are not the failure modes you want to find in production.

## What to use instead

Every address below was verified on-chain as described above. Each chain's periphery contracts point to that chain's own PoolManager.

| Contract | Ethereum (1) | Base (8453) | Arbitrum One (42161) |
|---|---|---|---|
| PoolManager | `0x000000000004444c5dc75cB358380D2e3dE08A90` | `0x498581fF718922c3f8e6A244956aF099B2652b2b` | `0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32` |
| PositionManager | `0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e` | `0x7C5f5A4bBd8fD63184577525326123B519429bDc` | `0xd88F38F930b7952f2DB2432Cb002E7abbF3dD869` |
| StateView | `0x7fFE42C4a5DEeA5b0feC41C94C136Cf115597227` | `0xA3c0c9b65baD0b08107Aa264b0f3dB444b867A71` | `0x76Fd297e2D437cd7f76d50F01AfE6160f86e9990` |
| V4Quoter | `0x52F0E24D1c21C8A0cB1e5a5dD6198556BD9E1203` | `0x0d5e0F971ED27FBfF6c2837bf31316121532048D` | `0x3972C00f7ed4885e145823eb7C655375d275A1C5` |
| UniversalRouter | `0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af` | `0x6fF5693b99212Da76ad316178A184AB56D299b43` | `0xA51afAFe0263b40EdaEf0Df8781eA9aa03E381a3` |
| Permit2 (same on all three, verified) | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | same | same |

## Recommended change

1. Keep a per-chain address map keyed by `chainId`. Fail loudly if the chain is unknown; never fall back to the mainnet addresses.
2. Add a startup or CI check for each chain:
   - `codesize(PoolManager) > 0`
   - every periphery contract's `poolManager()` equals the configured PoolManager
   - `eth_chainId` matches the key
3. Pool state is per chain too. PoolKeys and PoolIds, token addresses (use native USDC on Base and Arbitrum, not USDbC or USDC.e), hooks, fee tiers, tick spacings and liquidity all differ. Do not copy mainnet pool configs. Look up the pools on each chain, and quote at your real trade size before assuming v4 is the best venue there. On Base (Aerodrome) and Arbitrum (Camelot) there are other strong venues.

## Re-check before real funds move

I checked the table above directly on-chain today. Before shipping, a human should still check it against Uniswap's official deployment list (docs.uniswap.org → Contracts → v4 → Deployments) and each chain's block explorer (basescan.org, arbiscan.io). Pay particular attention to:

- the Base PoolManager owner, and
- that the UniversalRouter version matches the one your app encodes commands for.
