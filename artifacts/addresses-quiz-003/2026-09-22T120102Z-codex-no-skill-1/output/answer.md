# Morpho Blue address for Arbitrum

The teammate is not right. Do not point the Arbitrum integration at the Base
vanity address `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb`.

The Arbitrum config should point at:

```text
0x6c247b1F6182318877311737BaC0844bAa518F5e
```

How I established this:

1. Morpho's official contract address page lists Morpho Blue separately by
   chain. In that table, Arbitrum's `Morpho` entry is
   `0x6c247b1F6182318877311737BaC0844bAa518F5e`, while Base's `Morpho` entry is
   the vanity address `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb`.
   Source: https://docs.morpho.org/developers/contracts/addresses/

2. I checked Arbitrum One directly with `eth_getCode` against the public RPC:

   ```text
   eth_getCode(0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb, latest) -> 0x
   eth_getCode(0x6c247b1F6182318877311737BaC0844bAa518F5e, latest) -> 0x6080604052...
   ```

   So the Base vanity address has no contract bytecode on Arbitrum, while the
   Morpho docs' Arbitrum address does have deployed bytecode.

3. Arbiscan also labels activity/logs at
   `0x6c247b1F6182318877311737BaC0844bAa518F5e` as `Morpho: Morpho`.
   Example source:
   https://arbiscan.io/tx/0x65ca4f852d24998f4c5fcb571cdd93688cb72b3d53b26664117c45f71a2d2abf/advanced

Conclusion: wire Arbitrum to `0x6c247b1F6182318877311737BaC0844bAa518F5e`.
The same-address shortcut is unsafe here; Base and Arbitrum differ.
