# Can we reuse the mainnet Uniswap v4 addresses on Base and Arbitrum?

**No. The plan is not safe.** Uniswap v4 core (`PoolManager`) and its helper contracts are at **different addresses on each chain**. "Uniswap uses CREATE2" does not mean "same address everywhere". A CREATE2 address depends on the deployer, the salt, and the exact bytecode, and v4 was deployed per chain with different results. We need per-chain config.

Worse, some mainnet addresses **do have code on the L2s**, so the mistake would not show up as a clean "no contract here" error (details below).

## What I checked (on-chain, 2026-09-21)

Tools: `cast code` / `cast call` against public RPCs (publicnode). Block heights at the time: Ethereum 26,025,282 · Base 51,598,508 · Arbitrum 507,412,371.

### 1. PoolManager: one address per chain, no code at the others

| Address | Ethereum | Base | Arbitrum |
|---|---|---|---|
| `0x000000000004444c5dc75cB358380D2e3dE08A90` (mainnet) | **code** | empty | empty |
| `0x498581fF718922c3f8e6A244956aF099B2652b2b` (Base) | empty | **code** | empty |
| `0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32` (Arbitrum) | empty | empty | **code** |

All three have identical runtime bytecode (same length and same prefix). It is the same contract, just deployed at a different address on each chain. Each one has its own `owner()` (`0x1a9C…35BC` on Ethereum, `0x31FA…72A9` on Base, `0x2BAD…46CD` on Arbitrum).

So the mainnet PoolManager address is **empty** on Base and Arbitrum.

### 2. Periphery: I confirmed identity, not just that code exists

For each chain I called `poolManager()` on the periphery contract and checked that it returns **that chain's** PoolManager:

| Contract | Ethereum | Base | Arbitrum |
|---|---|---|---|
| PoolManager | `0x000000000004444c5dc75cB358380D2e3dE08A90` | `0x498581fF718922c3f8e6A244956aF099B2652b2b` | `0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32` |
| PositionManager | `0xbD216513d74C8cf14cf4747E6AaA6420FF64ee9e` | `0x7C5f5A4bBd8fD63184577525326123B519429bDc` | `0xd88F38F930b7952f2DB2432Cb002E7abbF3dD869` |
| V4Quoter | `0x52F0E24D1c21C8A0cB1e5a5dD6198556BD9E1203` | `0x0d5e0F971ED27FBfF6c2837bf31316121532048D` | `0x3972C00f7ed4885e145823eb7C655375d275A1C5` |
| StateView | `0x7fFE42C4a5DEeA5b0feC41C94C136Cf115597227` | `0xA3c0c9b65baD0b08107Aa264b0f3dB444b867A71` | `0x76Fd297e2D437cd7f76d50F01AfE6160f86e9990` |
| UniversalRouter | `0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af` | `0x6fF5693b99212Da76ad316178A184AB56D299b43` | `0xA51afAFe0263b40EdaEf0Df8781eA9aa03E381a3` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | same | same |

Every row returned `poolManager() == <that chain's PoolManager>`. Real use on Arbitrum confirms it: the PositionManager there has `nextTokenId() = 209,296`.

Permit2 is the only contract in this table that really does sit at the same address on all three chains (code confirmed on each). That may be where the "same address everywhere" belief came from.

### 3. The trap: mainnet addresses that *look* fine on the L2s

| Mainnet address used on L2 | Base | Arbitrum |
|---|---|---|
| UniversalRouter `0x66a9…A8Af` | **has code**, `poolManager()` = mainnet PM (empty on Base) | **has code**, `poolManager()` = mainnet PM (empty on Arbitrum) |
| PositionManager `0xbD21…ee9e` | empty | **has code** ("Uniswap v4 Positions NFT"), `poolManager()` = mainnet PM (empty on Arbitrum), `nextTokenId() = 1` (never used) |
| V4Quoter, StateView | empty | empty |

If we copied the mainnet config, a simple "is there a contract at this address?" check would **pass** for the router on both L2s and for the PositionManager on Arbitrum. But those contracts point at a PoolManager address with no code on that chain, so they are dead ends. The failures would vary: some calls revert, and some reads return zeros instead of reverting. On top of that, the mainnet PoolManager address itself is empty on both L2s, so direct PoolManager calls would hit nothing. This is exactly the kind of bug that passes a quick smoke test.

## What to do instead

1. **Per-chain config, keyed by chainId** (1, 8453, 42161), holding PoolManager, PositionManager, V4Quoter, StateView, UniversalRouter, and Permit2. Use the addresses in the table above.
2. **Startup / CI guard.** For each chain, check that:
   - `extcodesize(addr) > 0` for each address, and
   - `poolManager()` on each periphery contract equals the configured PoolManager for that chain.

   This catches both empty addresses and the "has code but wired to the wrong PoolManager" trap from section 3.
3. **Pools are per chain too.** A PoolId is derived from the currencies, fee, tickSpacing, and hooks, and token addresses differ per chain. On Base, native USDC is `0x8335…2913` (not USDbC). On Arbitrum, native USDC is `0xaf88…5831` (not USDC.e). Any hook addresses we use on mainnet also have to be deployed separately on each L2 (and hook permission bits live in the address). Check that the pools we plan to route through exist and have liquidity on each L2 by using that chain's StateView/Quoter, and don't carry over mainnet pool keys.
4. **Venue check (optional but worth it).** On Base and Arbitrum, v4 may not be the deepest venue for our pairs (Aerodrome/Slipstream on Base, Camelot or Uniswap v3 on Arbitrum). Quote at realistic trade sizes before assuming v4 is best.

## Re-check before real funds move

The addresses above were checked on-chain on 2026-09-21 and match each other (every periphery contract points to its own chain's PoolManager). Before launch, still cross-check them against Uniswap's official list (docs.uniswap.org → Contracts → v4 → Deployments, or the `deployments/` directory in the `Uniswap/v4-periphery` repo). Also confirm them on basescan.org / arbiscan.io. That official list is the only source that settles which deployment is *current*. Pay particular attention to UniversalRouter, since Uniswap has shipped new router versions before.
