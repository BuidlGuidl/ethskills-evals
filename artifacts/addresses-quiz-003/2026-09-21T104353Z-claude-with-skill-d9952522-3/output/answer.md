# Morpho Blue on Arbitrum — which address?

## Short answer
**Teammate is wrong.** `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` only holds Morpho Blue on some chains (Ethereum, Base). On Arbitrum One there is **no code at that address**. Morpho Blue on Arbitrum lives at a normal (non-vanity) address.

**Wire into Arbitrum config:**

```
MORPHO_BLUE (chainId 42161) = 0x6c247b1F6182318877311737BaC0844bAa518F5e
```

Pointing at `0xBBBB...` on Arbitrum = sending calls to an empty account. Plain ETH/token transfers or low-level calls to an address with no code don't revert — funds could just sit there, unrecoverable. Vanity/CREATE2 address says nothing about other chains; each chain must be checked.

## How I established it (checked 2026-09-21)

1. **Code present? (`cast code`)**

   | Address | Base | Arbitrum One |
   |---|---|---|
   | `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` | code (Morpho Blue) | **`0x` — empty** |
   | `0x6c247b1F6182318877311737BaC0844bAa518F5e` | `0x` — empty | code (Morpho Blue) |

   RPC `https://arb1.arbitrum.io/rpc`, `cast chain-id` = 42161.

2. **Identity, not just presence.** On Arbitrum `0x6c24...` answers Morpho Blue's interface:
   - `owner()` → `0xFd358f49678bd408FBCe0cF6bb9DFA5857d5d9b2` (Base instance owner: `0xcBa28b38...9AFa` — different owner per chain, another sign these are separate deployments)
   - `feeRecipient()`, `isLltvEnabled(0.86e18)` → true, `isIrmEnabled(0x66F3...06DA)` (AdaptiveCurveIrm) → true
   - `DOMAIN_SEPARATOR()` = `0xb6174fc6...e0d8`, which exactly equals
     `keccak256(abi.encode(keccak256("EIP712Domain(uint256 chainId,address verifyingContract)"), 42161, 0x6c24...5e))`
     — i.e. contract built itself as Morpho for chain 42161 at this address.

3. **Protocol's own deployment list.** Morpho's official SDK registry
   (`morpho-org/sdks`, `packages/morpho-ts/src/addresses.ts`) lists:
   `[ChainId.ArbitrumMainnet]: { morpho: "0x6c247b1F6182318877311737BaC0844bAa518F5e" }`.
   Same file shows `0xBBBB...` only for mainnet/Base; most other chains (Polygon, Unichain, OP, etc.) each have their own distinct address.

4. **Morpho's API** (`blue-api.morpho.org/graphql`) reports every Arbitrum (chainId 42161) market under `morphoBlue.address = 0x6c247b1F6182318877311737BaC0844bAa518F5e`.

Four independent sources agree.

## Before real funds move — still to check
- **Re-run the checks above** with your own production RPC before deploy; also look at the address on arbiscan.io (verified source + label + activity).
- **Market IDs are per chain.** Your Base market IDs (loan/collateral/oracle/IRM/LLTV tuple) don't exist on Arbitrum. Token addresses differ too (e.g. native Arbitrum USDC `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` vs bridged `USDC.e` `0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8` — pick native deliberately). Oracle and IRM addresses must be the Arbitrum ones.
- **Markets are permissionless** — anyone can create one. API top-market list includes odd entries (e.g. a USDC/"K" market with implausible ~$10B "supply"). Pick markets by explicit params you've vetted, not by what's biggest in a list.
- Any periphery you use (bundler, vaults, adapters) also has different per-chain addresses — look each up the same way.
