The frontend is talking to Base mainnet, chain ID `8453`, because
`targetNetworks: [chains.base]` tells RainbowKit/wagmi and the Scaffold-ETH
hooks that the app's target chain is real Base.

The vault deployed by `yarn deploy` lives on the local Foundry/Anvil fork,
chain ID `31337`. `yarn fork --network base` uses Base as the upstream state
source, but it still starts a local forked chain. New contracts deployed during
development are written to that local fork, not to Base mainnet.

The teammate's line looked logical because the fork is forked from Base, so it
feels like "the network is Base." The important distinction is that the
frontend target must be the chain it is actually sending reads and writes to,
and where the deployment artifacts are keyed. In this setup that chain is the
local Foundry chain, not the upstream Base chain. Setting `chains.base` makes
the app look for deployments under chain ID `8453`, so it cannot find the vault
deployed under `31337`; forced writes then become real Base transactions with
real gas.

The one-line fix in `scaffold.config.ts` is:

```ts
targetNetworks: [chains.foundry],
```

`chains.base` becomes the right value later, when the project is ready to use
the real Base network: deploy the vault to Base mainnet, for example with
`yarn deploy --network base`, and intentionally point the production frontend
at chain ID `8453`.
