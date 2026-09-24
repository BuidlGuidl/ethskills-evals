# Can we reuse the mainnet Uniswap v4 addresses on Base and Arbitrum?

## Short answer

**No. Don't ship this plan.** Uniswap v4 was **not** deployed with CREATE2 at the same address on every chain. Each chain has its own PoolManager, PositionManager and Universal Router address. You need a separate config for each chain.

## Why the plan is wrong

1. **The idea behind it is a mix-up.** Some Uniswap-related contracts do use CREATE2 (a way to deploy a contract to a predictable address). **Permit2** is one of them: `0x000000000022D473030F116dDEE9F6B43aC78BA3` on every chain. Uniswap v3's Factory is at the same address on mainnet, Arbitrum and Optimism. **v4 is different.** Its core contracts have different addresses on each chain.

   Even v3 doesn't fully fit the "same everywhere" rule. On Base, the v3 Factory is `0x33128a8fC17869897dcE68Ed026d694621f6FDfD`, not the mainnet `0x1F98431c…F984`. So "Uniswap uses CREATE2, so every address is the same" isn't true even for v3.

2. **Using the wrong address can fail without an error.** On Base or Arbitrum, the mainnet PoolManager address (`0x000000000004444c5dc75cB358380D2e3dE08A90`) is not the real Uniswap PoolManager. If nothing is deployed there, a raw call to it still "succeeds" and returns empty data. Depending on how your code and libraries handle that, you can get:
   - a confusing revert when the empty data is decoded, or
   - worse, low-level calls or token transfers that "succeed" while doing nothing.

   And if someone ever deploys a contract at that address on those chains, your app would be talking to a contract you don't control.

3. **Tokens are different too.** Pool keys are built from token addresses, and those also change per chain. For example, native USDC and WETH have different addresses on each chain (see the table below). Reusing mainnet pool keys or token addresses would point at the wrong assets or at pools that don't exist.

## What to use instead

Uniswap v4 addresses per chain. These come from a verified address reference (checked on-chain with `eth_getCode`). Still confirm them against Uniswap's official deployments page before you ship: https://docs.uniswap.org/contracts/v4/deployments

| Contract | Ethereum (1) | Arbitrum One (42161) | Base (8453) |
|---|---|---|---|
| PoolManager | `0x000000000004444c5dc75cB358380D2e3dE08A90` | `0x360e68faccca8ca495c1b759fd9eee466db9fb32` | `0x498581ff718922c3f8e6a244956af099b2652b2b` |
| PositionManager | `0xbd216513d74c8cf14cf4747e6aaa6420ff64ee9e` | `0xd88f38f930b7952f2db2432cb002e7abbf3dd869` | `0x7c5f5a4bbd8fd63184577525326123b519429bdc` |
| Universal Router (v4) | `0x66a9893cc07d91d95644aedd05d03f95e1dba8af` | `0xa51afafe0263b40edaef0df8781ea9aa03e381a3` | `0x6ff5693b99212da76ad316178a184ab56d299b43` |
| Permit2 (same everywhere) | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | same | same |

On mainnet you probably also use **Quoter** (`0x52f0e24d…1203`) and **StateView** (`0x7ffe42c4…7227`). Their Base and Arbitrum addresses are **not in my verified list**, so I won't guess them. Get them from the official Uniswap v4 deployments page and check them as described below.

Common tokens also change per chain:

| Token | Ethereum | Arbitrum | Base |
|---|---|---|---|
| USDC (native) | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| WETH | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1` | `0x4200000000000000000000000000000000000006` |

## Recommended approach

1. **Keep a config for each chain, keyed by chainId.** Include PoolManager, PositionManager, Universal Router, Quoter, StateView, Permit2 and your token list. If an address is missing for the current chain, stop with an error. Never fall back to the mainnet address.
2. **Check at startup, or in CI, that each address has code:**
   ```bash
   cast code 0x498581ff718922c3f8e6a244956af099b2652b2b --rpc-url https://mainnet.base.org
   cast code 0x360e68faccca8ca495c1b759fd9eee466db9fb32 --rpc-url https://arb1.arbitrum.io/rpc
   # empty "0x" means nothing is deployed there → config is wrong
   ```
   Also compare each address against Uniswap's official deployments page and the block explorer (Basescan, Arbiscan).
3. **Rebuild pool keys for each chain.** Pool keys contain the token addresses, fee, tick spacing and hooks, so they must use that chain's token addresses. Check that the pools you want actually exist and have enough liquidity on Base and Arbitrum. Liquidity there can be much lower than on mainnet, and on Base, Aerodrome often has deeper liquidity than Uniswap.
4. **Test on a fork of each chain** (`anvil --fork-url <base/arb rpc>`) and run a real swap and quote before launch.

## Unresolved questions
- Which other v4 contracts does the app call (Quoter, StateView, custom hooks)? Their Base and Arbitrum addresses must come from Uniswap's official deployments page.
- Do you use custom hooks on mainnet? Hook contracts have to be deployed again on each chain, and the hook address itself encodes which permissions the hook has, so it can't just be copied.
