# Morpho Blue on Arbitrum

The teammate is not right for Arbitrum. Do not reuse the Base vanity address for the Arbitrum integration.

The Arbitrum config should point at:

```txt
0x6c247b1F6182318877311737BaC0844bAa518F5e
```

Reasoning:

1. The current Morpho docs list Morpho Blue per chain. In the Morpho Blue section, the Arbitrum row points to `0x6c247b1F6182318877311737BaC0844bAa518F5e` on Arbiscan, while the Base row points to `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` on Basescan.

2. I checked Arbitrum directly with `eth_getCode`:

   - `eth_getCode(0x6c247b1F6182318877311737BaC0844bAa518F5e, latest)` on Arbitrum returned deployed bytecode, about 15,582 bytes.
   - `eth_getCode(0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb, latest)` on Arbitrum returned `0x`, meaning there is no contract deployed at the Base vanity address on Arbitrum.
   - As a sanity check, `eth_getCode(0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb, latest)` on Base returned deployed bytecode, confirming the address is valid for Base but not for Arbitrum.

Sources/checks used:

- Official Morpho addresses page: https://docs.morpho.org/developers/contracts/addresses/
- Arbitrum JSON-RPC endpoint: `https://arb1.arbitrum.io/rpc`
- Base JSON-RPC endpoint: `https://mainnet.base.org`

Conclusion: wire Arbitrum to `0x6c247b1F6182318877311737BaC0844bAa518F5e`. The `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` address is correct for Base, but on Arbitrum it currently has no bytecode and must not receive user deposits.
