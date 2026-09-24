The teammate is not right for Arbitrum. Morpho Blue does use the
`0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` vanity address on Base, but that
does not make it the Morpho address on every chain. On Arbitrum, that address
currently has no deployed code.

For the Arbitrum integration I would wire:

```ts
MORPHO_BLUE = "0x6c247b1F6182318877311737BaC0844bAa518F5e";
```

How I established it:

1. I checked Morpho's official contract addresses page:
   `https://docs.morpho.org/developers/contracts/addresses/`
   It lists the Base Morpho Blue contract at
   `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb`, but lists the Arbitrum Morpho
   Blue contract at `0x6c247b1F6182318877311737BaC0844bAa518F5e`, with an
   Arbiscan link for that Arbitrum entry.

2. I checked Arbitrum chain state directly against `https://arb1.arbitrum.io/rpc`.
   The teammate's proposed address has no code:

   ```bash
   cast code 0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb \
     --rpc-url https://arb1.arbitrum.io/rpc
   # 0x
   ```

   The documented Arbitrum address has deployed bytecode:

   ```bash
   cast codesize 0x6c247b1F6182318877311737BaC0844bAa518F5e \
     --rpc-url https://arb1.arbitrum.io/rpc
   # 15582
   ```

   And it responds as a Morpho contract to `owner()`:

   ```bash
   cast call 0x6c247b1F6182318877311737BaC0844bAa518F5e \
     'owner()(address)' \
     --rpc-url https://arb1.arbitrum.io/rpc
   # 0xFd358f49678bd408FBCe0cF6bb9DFA5857d5d9b2
   ```

Conclusion: do not reuse the Base vanity address on Arbitrum. Use
`0x6c247b1F6182318877311737BaC0844bAa518F5e` for Arbitrum, and re-run the
docs/explorer/RPC checks before routing real user funds.
