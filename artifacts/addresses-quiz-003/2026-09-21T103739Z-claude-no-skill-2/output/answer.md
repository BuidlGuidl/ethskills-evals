# Morpho Blue on Arbitrum: which address?

## Short answer

**The teammate is wrong.** `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` is the Morpho Blue address on Ethereum mainnet and Base, but **not** on Arbitrum. On Arbitrum One (chain id 42161) that address has **no contract code at all**.

**Arbitrum config value:**

```
MORPHO_BLUE (Arbitrum One, chainId 42161) = 0x6c247b1F6182318877311737BaC0844bAa518F5e
```

## Why the teammate's reasoning fails

- A CREATE2 address comes from three things: the deployer address, the salt, and the init-code hash. You only get the same address on another chain if all three are the same **and** someone actually deployed there. A vanity address on one chain says nothing about other chains.
- Morpho only used the vanity `0xBBBB…` deployment on Ethereum and Base. Later chains (Arbitrum, Polygon, OP, Unichain, etc.) each got their own normal, chain-specific address.
- Pointing at an address with no code is dangerous, not just broken. A plain ETH transfer or a low-level call to an address with no code **succeeds silently** (no revert). Some ERC20 `approve`/`transfer` flows would also "work" and leave funds or approvals aimed at an empty address. If anyone ever deploys code there later (even through a different CREATE2 path), user funds would go to a contract you never checked.

## How I checked (on-chain and from the official source, not from memory)

1. **Arbitrum RPC (`https://arb1.arbitrum.io/rpc`, `cast chain-id` → 42161):**
   - `eth_getCode(0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb)` → `0x` (empty, no contract). Its nonce is also 0.
   - `eth_getCode(0x6c247b1F6182318877311737BaC0844bAa518F5e)` → about 15.5 KB of bytecode.
2. **Is it really Morpho Blue?** I compared it with the Base deployment:
   - Its runtime bytecode is almost identical to the Base `0xBBBB…` bytecode (31166 vs 31248 hex chars, differing in only about 139 characters, which fits immutables and compiler metadata).
   - It responds to Morpho Blue's own calls: `owner()` → `0xFd358f49678bd408FBCe0cF6bb9DFA5857d5d9b2`, `DOMAIN_SEPARATOR()` → `0xb6174fc6…e0d8`, `feeRecipient()` → `0x0`.
   - Note: the owner differs from Base (`0xcBa28b38…9AFa`). That is expected, since each chain has its own governance multisig. Check this owner against Morpho's docs if governance trust matters to you.
3. **Official Morpho source:** the `morpho-org/sdks` repo (`packages/morpho-ts/src/addresses.ts`), under `ChainId.ArbitrumMainnet`, lists `blue` / `morpho: "0x6c247b1F6182318877311737BaC0844bAa518F5e"`. The same file lists `0xBBBB…` only for mainnet and Base, and a different address for every other chain. The Morpho API (`blue-api.morpho.org`) also lists Arbitrum One (42161) as a supported chain.

All three sources agree.

## Recommendations before routing user funds

- Store the Morpho address **per chain** in config (keyed by chainId). Never hardcode one address for every chain.
- Add a deploy/startup check: `extcodesize(morpho) > 0`, and ideally compare the code hash with a known value. If either check fails, stop.
- Also re-check every related address on Arbitrum: market IDs, IRM (AdaptiveCurveIrm), oracles, Bundler3/adapters, and vaults. These also differ per chain, and the Base market IDs/params will not match Arbitrum ones. For example, Arbitrum Bundler3 is `0x1FA4431bC113D308beE1d46B0e98Cb805FB48C13` per the same SDK file.
- Do a small test deposit and withdraw on Arbitrum before opening it to users.
