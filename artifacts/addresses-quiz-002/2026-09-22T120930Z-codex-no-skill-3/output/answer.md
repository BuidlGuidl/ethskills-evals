# Uniswap v4 PoolManager addresses for Base and Arbitrum

The proposed plan is not safe.

`CREATE2` makes an address deterministic for a specific deployer address, salt,
and init code. It does not mean every Uniswap v4 contract is automatically at
the same address on every chain. Uniswap's own deployment docs explicitly warn:
integrators should not assume deployments share addresses across chains and
should confirm the per-chain mapping.

For the v4 `PoolManager`, the current official deployments are:

| Chain | Chain ID | PoolManager |
| --- | ---: | --- |
| Ethereum mainnet | 1 | `0x000000000004444c5dc75cB358380D2e3dE08A90` |
| Base | 8453 | `0x498581fF718922c3f8e6A244956aF099B2652b2b` |
| Arbitrum One | 42161 | `0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32` |

So the app should use per-chain configuration keyed by `chainId`, not reuse the
Ethereum mainnet PoolManager on Base or Arbitrum. The Base and Arbitrum
addresses above are the ones to use for their respective networks.

Sources checked on 2026-09-22:

- Uniswap v4 Deployments: https://developers.uniswap.org/docs/protocols/v4/deployments
- Uniswap deployment feed: https://developers.uniswap.org/deployments.json
- Uniswap support warning about cross-chain address assumptions: https://support.uniswap.org/hc/en-us/articles/25236173303053-Uniswap-Protocol-deployment-addresses
