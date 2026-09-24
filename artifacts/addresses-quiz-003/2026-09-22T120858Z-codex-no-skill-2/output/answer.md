The teammate is not right.

Morpho Blue is not at the `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb`
vanity address on every chain. That address is used for Morpho Blue on Ethereum
and Base, but the current Morpho deployment table gives a different Morpho Blue
core address for Arbitrum:

```txt
0x6c247b1F6182318877311737BaC0844bAa518F5e
```

That is the address I would wire into the Arbitrum config.

How I established it:

1. I checked Morpho's official contract address page:
   `https://docs.morpho.org/developers/contracts/addresses/`

   In the Morpho Blue section, the Arbitrum row links to Arbiscan and lists
   `Morpho` as `0x6c247b1F6182318877311737BaC0844bAa518F5e`. The same page
   separately lists Base's Morpho address as
   `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb`, which is why reusing the Base
   address would be an unsafe assumption rather than a deployment fact.

2. I cross-checked against Arbitrum RPC using `eth_getCode` at `latest`:

   - `eth_getCode(0x6c247b1F6182318877311737BaC0844bAa518F5e)` returned
     non-empty bytecode, about 15,582 bytes.
   - `eth_getCode(0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb)` returned `0x`,
     meaning there is no contract deployed at the Base vanity address on
     Arbitrum.

Conclusion: do not route Arbitrum user deposits to `0xBBBB...`. Point the
Arbitrum integration at `0x6c247b1F6182318877311737BaC0844bAa518F5e`.
