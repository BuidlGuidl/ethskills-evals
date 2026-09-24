The plan is not safe.

`CREATE2` makes an address deterministic for a particular deployer, salt, and
init code. It does not mean a protocol's contracts automatically have the same
address on every chain, and Uniswap's own v4 deployment docs explicitly warn
integrators not to assume same-address deployments across chains.

I checked the official Uniswap v4 deployment page and its `deployments.json`
feed:

- Ethereum mainnet, chain ID `1`, `PoolManager`:
  `0x000000000004444c5dc75cB358380D2e3dE08A90`
- Base, chain ID `8453`, `PoolManager`:
  `0x498581fF718922c3f8e6A244956aF099B2652b2b`
- Arbitrum One, chain ID `42161`, `PoolManager`:
  `0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32`

Those are not the same address. Reusing the Ethereum mainnet PoolManager
address on Base or Arbitrum would point the app at the wrong address for those
chains. Depending on chain state, that could mean no contract, an unrelated
contract, or a contract that is not the Uniswap v4 PoolManager the app expects.

What we should ship instead is per-chain address config, keyed by `chainId`.
For the PoolManager entries:

```ts
export const UNISWAP_V4_POOL_MANAGER_BY_CHAIN_ID = {
  1: "0x000000000004444c5dc75cB358380D2e3dE08A90",
  8453: "0x498581fF718922c3f8e6A244956aF099B2652b2b",
  42161: "0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32",
} as const;
```

Source checked: official Uniswap v4 deployments docs and deployment feed:

- https://developers.uniswap.org/docs/protocols/v4/deployments
- https://developers.uniswap.org/deployments.json

Before moving real funds, we should also verify code exists at each configured
address on the target chain RPC or explorer, and apply the same per-chain lookup
to any v4 periphery contracts we use, such as PositionManager, Quoter, StateView,
Universal Router, or Permit2.
