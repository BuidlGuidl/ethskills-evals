# Morpho Blue on Arbitrum: which address to use

## Short answer

**The teammate is wrong.** Morpho Blue on Arbitrum One is **not** at `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb`. There is no contract code at that address on Arbitrum.

**Address for the Arbitrum config: `0x6c247b1F6182318877311737BaC0844bAa518F5e`**

## Why the teammate's reasoning fails

A vanity or CREATE2 address only comes out the same on another chain if the same deployer uses the same salt and bytecode there. Nothing forces a protocol to do that. Morpho used the `0xBBBB…` address on Ethereum and Base, but it deployed on Arbitrum (and on several other chains) at a normal address. "Same address everywhere" has to be checked on each chain. It is not something a brand guarantees.

This mistake would not fail loudly. An empty address has no code, so a low-level call or a token `transfer`/`approve` to it can "succeed" while doing nothing, or send funds to an address nobody controls. Also, someone could deploy something at `0xBBBB…` on Arbitrum later. That contract would not be Morpho.

## How I established it (2026-09-21)

1. **Code at the claimed address, on each chain** (`cast code`):
   - Base (`https://mainnet.base.org`), `0xBBBB…EFFCb`: has bytecode. This is your existing deployment.
   - Arbitrum (`https://arb1.arbitrum.io/rpc`, chain id 42161 confirmed), `0xBBBB…EFFCb`: **`0x`, meaning no code.**
2. **Protocol's own deployment list**: docs.morpho.org → Resources → Addresses lists, under Arbitrum, `Morpho` (source: `morpho-blue`) = `0x6c247b1F6182318877311737BaC0844bAa518F5e`, linking to arbiscan. The same table lists Adaptive Curve IRM `0x66F30587FB8D4206918deb78ecA7d5eBbafD06DA` for Arbitrum.
3. **Checked on Arbitrum that `0x6c24…8F5e` is actually Morpho Blue**, not just any contract:
   - It has bytecode. The bytecode starts the same way as the Base Morpho Blue contract and is about the same size. The small difference is expected, because some values are fixed into the code per chain.
   - `DOMAIN_SEPARATOR()` = `0xb6174fc6…e0d8`. This equals `keccak256(abi.encode(DOMAIN_TYPEHASH, 42161, 0x6c24…8F5e))`, which is what Morpho Blue computes for itself. So the contract says it is the Morpho Blue instance for chain 42161 at this exact address.
   - `owner()` = `0xFd358f49678bd408FBCe0cF6bb9DFA5857d5d9b2`, `feeRecipient()` = zero address.
   - `isLltvEnabled(0.86e18)` = true. `isIrmEnabled(0x66F3…06DA)` = true, which matches the IRM in the docs.
   - It holds about 1.17M native USDC (`0xaf88…5831`), so it is a live deployment in real use.

## Before real user funds move

- Morpho is only the core contract. The per-chain address change also applies to everything around it: market IDs, oracles, IRMs, MetaMorpho vaults, bundlers, and token addresses. Market IDs depend on the loan token, collateral, oracle and IRM addresses, so your Base market IDs will not exist on Arbitrum. Look up each of these from the Arbitrum section of Morpho's address list, and confirm the market with `idToMarketParams(id)`.
- Use native USDC on Arbitrum (`0xaf88d065e77c8cC2239327C5EDb3A432268e5831`), not bridged `USDC.e`, unless you choose otherwise on purpose.
- Keep addresses per chain in the config. Add a startup or deploy check that fails if `extcodesize(morpho) == 0` or if `DOMAIN_SEPARATOR()` does not match the value computed for the current chain.
- Re-run the checks above against your production RPC right before launch. This answer is a snapshot from 2026-09-21.
