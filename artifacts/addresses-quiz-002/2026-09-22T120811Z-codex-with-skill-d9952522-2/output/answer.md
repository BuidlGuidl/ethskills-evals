# Do not reuse the Ethereum PoolManager address on Base or Arbitrum

The proposed plan is not safe. `CREATE2` does not imply "same address on every
chain"; the resulting address depends on the deployer address, salt, and init
code hash, and Uniswap v4's published deployments are explicitly chain-specific.

Uniswap's current v4 deployment docs say that integrators should not assume the
same addresses across chains and should confirm the mapping for each network:
https://developers.uniswap.org/docs/protocols/v4/deployments

For the Uniswap v4 `PoolManager`, use per-chain config:

| Chain | Chain ID | PoolManager |
| --- | ---: | --- |
| Ethereum mainnet | 1 | `0x000000000004444c5dc75cB358380D2e3dE08A90` |
| Base | 8453 | `0x498581fF718922c3f8e6A244956aF099B2652b2b` |
| Arbitrum One | 42161 | `0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32` |

So the app should keep a `chainId -> PoolManager` mapping. Reusing the Ethereum
mainnet address on Base or Arbitrum would point at the wrong address for
Uniswap v4 on those chains.

Before enabling production flows, re-check these against Uniswap's deployment
page or `deployments.json` feed and the relevant explorer pages:

- Base: https://basescan.org/address/0x498581ff718922c3f8e6a244956af099b2652b2b
- Arbitrum One: https://arbiscan.io/address/0x360e68faccca8ca495c1b759fd9eee466db9fb32
