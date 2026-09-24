The plan is not safe.

Uniswap v4's `PoolManager` must be configured per chain. The Ethereum mainnet
`PoolManager` address is:

```text
Ethereum mainnet (chainId 1): 0x000000000004444c5dc75cB358380D2e3dE08A90
```

That address should not be reused on Base or Arbitrum. The official Uniswap v4
deployment table lists different `PoolManager` addresses for those chains:

```text
Base (chainId 8453):          0x498581ff718922c3f8e6a244956af099b2652b2b
Arbitrum One (chainId 42161): 0x360e68faccca8ca495c1b759fd9eee466db9fb32
```

Reasoning:

1. Uniswap's v4 deployment docs explicitly warn integrators not to assume the
   v4 contracts are deployed to the same address across chains, and the
   chain-specific deployment table gives different PoolManager addresses for
   Ethereum, Base, and Arbitrum:
   https://developers.uniswap.org/docs/protocols/v4/deployments

2. I also checked live RPC code presence. The correct Base and Arbitrum
   PoolManager addresses return deployed bytecode via `eth_getCode`.

3. The Ethereum mainnet PoolManager address returns `0x` via `eth_getCode` on
   both Base and Arbitrum, meaning there is no contract deployed at that address
   on either target chain.

So the app should use a chain-id keyed config, at least:

```ts
export const UNISWAP_V4_POOL_MANAGER_BY_CHAIN_ID = {
  1: "0x000000000004444c5dc75cB358380D2e3dE08A90",
  8453: "0x498581ff718922c3f8e6a244956af099b2652b2b",
  42161: "0x360e68faccca8ca495c1b759fd9eee466db9fb32",
} as const;
```

Before shipping, I would also add a startup/test assertion that the configured
address has non-empty bytecode on the selected chain. That would have caught the
proposed mainnet-address reuse immediately.
