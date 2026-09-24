# Morpho Blue address for Arbitrum

The teammate is **not right** for Arbitrum. Do not configure Arbitrum to use
`0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb`.

The address I would wire into the Arbitrum integration is:

```text
0x6c247b1F6182318877311737BaC0844bAa518F5e
```

## Reasoning

I checked Morpho's official contract addresses page:

```text
https://docs.morpho.org/developers/contracts/addresses/
```

Under the **Morpho Blue** section, the docs list:

- Ethereum: `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb`
- Base: `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb`
- Arbitrum: `0x6c247b1F6182318877311737BaC0844bAa518F5e`

The Arbitrum entry links to:

```text
https://arbiscan.io/address/0x6c247b1F6182318877311737BaC0844bAa518F5e
```

I also checked Arbitrum directly with `eth_getCode` against the public Arbitrum
RPC:

```text
eth_getCode(0x6c247b1F6182318877311737BaC0844bAa518F5e, latest) -> non-empty bytecode
eth_getCode(0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb, latest) -> 0x
```

So `0xBBBB...` is a real Morpho Blue address on Base, but it is not the Morpho
Blue contract on Arbitrum. On Arbitrum, there is no contract code at that
address. The production config for Arbitrum should point at
`0x6c247b1F6182318877311737BaC0844bAa518F5e`.
