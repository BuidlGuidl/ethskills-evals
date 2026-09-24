# Is it safe to reuse the Ethereum mainnet Uniswap v4 PoolManager address?

No. Do not ship that plan.

Uniswap v4 deployments are not safe to treat as "same address on every chain".
The official Uniswap v4 deployments page says integrators should no longer assume
the v4 contracts are deployed to the same addresses across chains, and should
confirm the chain-specific mappings:

https://developers.uniswap.org/docs/protocols/v4/deployments

For `PoolManager`, the addresses are:

| Chain | Chain ID | PoolManager |
| --- | ---: | --- |
| Ethereum mainnet | 1 | `0x000000000004444c5dc75cB358380D2e3dE08A90` |
| Base | 8453 | `0x498581ff718922c3f8e6a244956af099b2652b2b` |
| Arbitrum One | 42161 | `0x360e68faccca8ca495c1b759fd9eee466db9fb32` |

I also sanity-checked the specific failure mode with `eth_getCode`:

| Chain / address checked | Result |
| --- | --- |
| Base at the Ethereum mainnet PoolManager address | `0x`, no contract code |
| Arbitrum at the Ethereum mainnet PoolManager address | `0x`, no contract code |
| Base at `0x498581ff718922c3f8e6a244956af099b2652b2b` | contract code present |
| Arbitrum at `0x360e68faccca8ca495c1b759fd9eee466db9fb32` | contract code present |

So the app needs per-chain config keyed by chain ID. Reusing the Ethereum
mainnet `PoolManager` address on Base or Arbitrum would point at an empty address,
not Uniswap v4.

If the integration also uses v4 periphery contracts such as `PositionManager`,
`Quoter`, `StateView`, or `Universal Router`, those should be configured
per-chain too from the same Uniswap deployments source rather than inferred from
mainnet.
