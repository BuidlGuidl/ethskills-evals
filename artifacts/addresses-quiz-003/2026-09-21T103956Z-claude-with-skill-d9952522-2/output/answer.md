# Morpho Blue on Arbitrum: which address?

## Short answer

**Your teammate is wrong.** There is no contract at `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` on Arbitrum One. Morpho Blue does run on Arbitrum, but at a different, ordinary address:

```
Arbitrum One (chainId 42161) Morpho Blue: 0x6c247b1F6182318877311737BaC0844bAa518F5e
```

Put that address in the Arbitrum config. Do not reuse the Base address.

## Why "vanity CREATE2 means same address everywhere" is wrong

- CREATE2 (a way to deploy to a predictable address) only gives the same address on two chains if the same deployer is used with the same salt and the same bytecode on both. The Morpho brand doesn't guarantee that. Whether it happened is something you check on each chain.
- Morpho used the `0xBBBB…EEFFCb` vanity address on Ethereum mainnet and Base. On newer chains, Arbitrum included, it deployed at normal addresses.
- An empty address is dangerous. A call to an address with no code does not revert. An ERC20 `transfer`/`transferFrom` to it succeeds and the tokens are gone. Some low-level calls also "succeed" and return nothing. Sending user deposits to `0xBBBB…` on Arbitrum could lose the funds with no error at all.

## How I established it (checked 2026-09-21)

1. **The vanity address has no code on Arbitrum.**
   `eth_getCode(0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb)` via `https://arb1.arbitrum.io/rpc` (chainId 42161 confirmed with `cast chain-id`) returns `0x`, which means empty.
   The same call on Base (`https://mainnet.base.org`) returns about 15.6 KB of bytecode, so your Base setup is fine.

2. **Morpho's own address list names the Arbitrum deployment.**
   The official page https://docs.morpho.org/get-started/resources/addresses/ lists `Morpho 0x6c247b1F6182318877311737BaC0844bAa518F5e` (source: `morpho-blue`), linked to `arbiscan.io`. The Adaptive Curve IRM for that chain is listed next to it: `0x66F30587FB8D4206918deb78ecA7d5eBbafD06DA`.

3. **The contract at that address behaves like Morpho Blue on Arbitrum.**
   - `cast code 0x6c24…8F5e --rpc-url <arb>`: code is present, about 15.6 KB. The start of the bytecode (the function dispatcher, including `setOwner` `0x13af4035`) matches the Base Morpho Blue exactly.
   - `owner()` returns `0xFd358f49678bd408FBCe0cF6bb9DFA5857d5d9b2`, and `feeRecipient()` returns `0x0`. Both calls answer with Morpho Blue's interface.
   - `isIrmEnabled(0x66F3…06DA)` returns `true`, so the IRM from the docs is enabled on this exact contract. That ties the on-chain state to the docs list.
   - `DOMAIN_SEPARATOR()` differs from Base (`0xb617…` vs `0xc602…`). That is expected because it includes the chain ID and the contract address. It is also a reason not to reuse Base-signed authorizations or any hardcoded Base values on Arbitrum.
   - The full bytecode hash differs from Base. That is expected too, since immutables (values fixed at deploy time) and compiler metadata differ per deployment. This is why step 2, the docs, is what settles the question, not a bytecode match.
   - The contract at `0x6c24…` on Base has no code. The two deployments really are separate.

## Before real funds move

- Re-run the checks above against your production Arbitrum RPC (`cast code`, `owner()`, `isIrmEnabled`). Check the address on Arbiscan too.
- Everything else in the integration is also per-chain and needs its own lookup: market IDs / `MarketParams` (loan token, collateral token, oracle, IRM, LLTV), oracles, the Bundler/adapter, and any MetaMorpho vaults. None of your Base values carry over.
- For the tokens: on Arbitrum use native USDC `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`, not bridged `USDC.e` `0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8`. Both return `symbol()` = `"USDC"` on-chain, so the symbol cannot tell them apart; compare by address. Pick markets whose `loanToken` is the one you intend to use.
- Add a startup check in the config/deploy script: assert `chainId == 42161` and `extcodesize(morpho) > 0`. Then a wrong or empty address fails loudly instead of quietly swallowing deposits.
