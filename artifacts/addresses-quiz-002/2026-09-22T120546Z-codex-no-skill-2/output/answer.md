No, that plan is not safe.

The reasoning shortcut is wrong: CREATE2 only gives a deterministic address for a
specific `(deployer, salt, init_code)` tuple. It does not mean every Uniswap v4
deployment lands at the same address on every chain. Uniswap's current v4
deployment docs explicitly warn integrators not to assume the v4 contracts are
deployed to the same addresses across chains, and to confirm the mappings per
network.

For the PoolManager specifically, the current official v4 deployment addresses
are:

| Chain | Chain ID | PoolManager |
| --- | ---: | --- |
| Ethereum mainnet | 1 | `0x000000000004444c5dc75cB358380D2e3dE08A90` |
| Base | 8453 | `0x498581ff718922c3f8e6a244956af099b2652b2b` |
| Arbitrum One | 42161 | `0x360e68faccca8ca495c1b759fd9eee466db9fb32` |

So the app should use per-chain configuration keyed by `chainId`. Reusing the
Ethereum mainnet PoolManager address on Base or Arbitrum would point at the
wrong address for Uniswap v4 on those networks.

Source checked on 2026-09-22: Uniswap v4 deployments,
https://developers.uniswap.org/docs/protocols/v4/deployments
