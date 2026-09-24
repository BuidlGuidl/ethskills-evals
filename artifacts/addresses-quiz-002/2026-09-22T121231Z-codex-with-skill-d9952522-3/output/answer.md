The plan is not safe.

CREATE2 can make an address deterministic for a given deployer, salt, and
init code, but it does not mean a protocol's production deployment is the same
address on every chain. Uniswap's own v4 deployment page explicitly says
integrators should no longer assume the contracts are deployed to the same
addresses across chains, and the current PoolManager entries for Ethereum,
Base, and Arbitrum are different.

Use per-chain config keyed by `chainId`, at least for `PoolManager`:

| Chain | chainId | Uniswap v4 PoolManager |
| --- | ---: | --- |
| Ethereum mainnet | 1 | `0x000000000004444c5dc75cB358380D2e3dE08A90` |
| Base | 8453 | `0x498581fF718922c3f8e6A244956aF099B2652b2b` |
| Arbitrum One | 42161 | `0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32` |

So the Base config should point to
`0x498581fF718922c3f8e6A244956aF099B2652b2b`, and the Arbitrum One config
should point to `0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32`, not the Ethereum
mainnet PoolManager.

If the app also wires any v4 periphery contracts, do the same thing for those:
`PositionManager`, `Quoter`, `StateView`, `UniversalRouter`, and related
contracts also have per-chain deployment entries. `Permit2` is a notable
example that currently has the same address on those chains, but that should be
treated as an entry in the chain config, not as a general rule.

Sources checked on 2026-09-22:

- Uniswap v4 deployments:
  https://developers.uniswap.org/docs/protocols/v4/deployments
- Uniswap deployments JSON feed:
  https://developers.uniswap.org/deployments.json

Before routing real funds, I would still do a final release-time verification
against the target RPCs and explorers, for example:

```bash
cast code 0x498581fF718922c3f8e6A244956aF099B2652b2b --rpc-url $BASE_RPC_URL
cast code 0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32 --rpc-url $ARBITRUM_RPC_URL
```
