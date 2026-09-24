# Can we reuse the mainnet Uniswap v4 addresses on Base and Arbitrum?

## Short answer

**No, the plan isn't safe.** Uniswap v4's core contracts are **not** at the same address on every chain. The mainnet PoolManager address points to a different contract on Base and Arbitrum, or to no contract at all. Each chain needs its own config.

## Reasoning

1. **"Uniswap uses CREATE2, so every chain gets the same address" is wrong for v4.**
   CREATE2 (a way to deploy a contract at a predictable address) only gives the same address on two chains if the deployer, salt and bytecode are all the same on both. Uniswap didn't deploy v4 that way across chains. PoolManager, PositionManager and Universal Router each have a different address on each chain.

2. **Even v3 wasn't fully the same on every chain.** The v3 Factory `0x1F98…F984` is the same on mainnet, Arbitrum and Optimism. But on Base it's `0x3312…6fDfD`. The idea that "Uniswap is the same everywhere" was never reliable.

3. **What happens if we reuse the mainnet addresses:**
   - **No contract at that address:** calls to an address with no code "succeed" and return empty data. Reads may decode as zeros or revert in odd ways. Token approvals or transfers sent there can be lost.
   - **Some other contract at that address:** the app talks to code we never checked. That's a path to losing funds.
   - Either way, pool IDs, quotes and positions from mainnet mean nothing on the other chain.

4. **Some things really are the same on every chain.** For example, Permit2 is at `0x000000000022D473030F116dDEE9F6B43aC78BA3` everywhere. This is probably where the idea came from. But it doesn't apply to v4 core.

## Addresses to use

| Contract | Ethereum mainnet | Arbitrum One (42161) | Base (8453) |
|---|---|---|---|
| PoolManager | `0x000000000004444c5dc75cB358380D2e3dE08A90` | `0x360e68faccca8ca495c1b759fd9eee466db9fb32` | `0x498581ff718922c3f8e6a244956af099b2652b2b` |
| PositionManager | `0xbd216513d74c8cf14cf4747e6aaa6420ff64ee9e` | `0xd88f38f930b7952f2db2432cb002e7abbf3dd869` | `0x7c5f5a4bbd8fd63184577525326123b519429bdc` |
| Universal Router (v4) | `0x66a9893cc07d91d95644aedd05d03f95e1dba8af` | `0xa51afafe0263b40edaef0df8781ea9aa03e381a3` | `0x6ff5693b99212da76ad316178a184ab56d299b43` |
| Permit2 (same everywhere) | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | same | same |

Mainnet also has Quoter `0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203` and StateView `0x7ffe42c4a5deea5b0fec41c94c136cf115597227`. **Their Base and Arbitrum addresses are also different.** Get them from the official Uniswap v4 deployments page: https://docs.uniswap.org/contracts/v4/deployments. Don't copy the mainnet values.

Tokens also differ by chain. For example, WETH is `0x8…Bab1` on Arbitrum and `0x4200…0006` on Base. USDC is `0xaf88…5831` on Arbitrum and `0x8335…2913` on Base. Pool keys and routing configs must use each chain's token addresses.

## What to do instead

1. **Keep one config per chain**, keyed by chainId:
   ```ts
   const UNISWAP_V4 = {
     1:     { poolManager: "0x000000000004444c5dc75cB358380D2e3dE08A90", positionManager: "0xbd21…", universalRouter: "0x66a9…", quoter: "0x52f0…", stateView: "0x7ffe…" },
     42161: { poolManager: "0x360e68faccca8ca495c1b759fd9eee466db9fb32", positionManager: "0xd88f…", universalRouter: "0xa51a…", quoter: /* from docs */, stateView: /* from docs */ },
     8453:  { poolManager: "0x498581ff718922c3f8e6a244956af099b2652b2b", positionManager: "0x7c5f…", universalRouter: "0x6ff5…", quoter: /* from docs */, stateView: /* from docs */ },
   } as const;
   ```
   If a chainId is missing, fail loudly. Never fall back to the mainnet addresses.
2. **Check the addresses before shipping.** Confirm them against the Uniswap deployments page and the block explorers (Arbiscan, Basescan). Also check each address has code on its chain:
   ```bash
   cast code 0x498581ff718922c3f8e6a244956af099b2652b2b --rpc-url https://mainnet.base.org
   cast code 0x360e68faccca8ca495c1b759fd9eee466db9fb32 --rpc-url https://arb1.arbitrum.io/rpc
   ```
   An empty `0x` result means the address is wrong for that chain.
3. **Add a startup check** that runs `eth_getCode` on each configured address for the connected chain, and refuses to run if any comes back empty.
4. **If "the PoolManager we deployed against" means your own PoolManager** (not Uniswap's canonical one), the same rule applies even more strongly. You'd need to deploy it yourself on Base and Arbitrum and record the new addresses. Nothing will be at those addresses by default.

## Open questions
- Are you using Uniswap's canonical PoolManager or your own deployment? The table above assumes the canonical one.
- Do you use hooks? Hook contracts are deployed per chain too, and a v4 hook's address encodes its permissions. Each one has to be redeployed (address mined again) on each chain, and pool keys updated to match.
