The plan is not safe.

`CREATE2` only gives the same address when the full deployment inputs are the
same: deployer address, salt, and init code, including constructor arguments.
It is not a blanket promise that every Uniswap v4 contract has the same address
on every chain. Uniswap's own v4 deployments page says integrators should no
longer assume same-address deployments across chains and should confirm the
per-network mappings.

For the `PoolManager`, Ethereum mainnet is:

- Ethereum mainnet (chain id 1): `0x000000000004444c5dc75cB358380D2e3dE08A90`

But Base and Arbitrum use different `PoolManager` addresses:

- Base (chain id 8453): `0x498581fF718922c3f8e6A244956aF099B2652b2b`
- Arbitrum One (chain id 42161): `0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32`

So we should keep per-chain config keyed by `chainId` and use those addresses
for Base and Arbitrum instead of reusing the Ethereum mainnet address. The same
rule should be applied to other v4 periphery contracts too, such as
`PositionManager`, `Quoter`, `StateView`, and `UniversalRouter`, because several
of those addresses are also chain-specific.

Sources checked:

- Uniswap v4 deployments: https://developers.uniswap.org/docs/protocols/v4/deployments
- Machine-readable deployments feed: https://developers.uniswap.org/deployments.json
