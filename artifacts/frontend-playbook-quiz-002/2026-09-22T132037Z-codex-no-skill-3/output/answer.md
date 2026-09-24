The frontend is talking to Base mainnet, chain ID `8453`, because
`targetNetworks: [chains.base]` tells Scaffold-ETH/wagmi to use the real
Base chain.

The vault deployed by `yarn deploy` lives on the local fork/dev chain,
chain ID `31337`. That local chain is an Anvil/Hardhat-style fork that copied
Base state, but it is still the local development network for newly deployed
contracts.

The teammate's line looked logical because the fork was created from Base:

```ts
targetNetworks: [chains.base],
```

But `targetNetworks` does not mean "the upstream network my fork copied." It
means "the chain the frontend should connect to and look up deployments for."
So the app searches for the vault on chain `8453`, does not find the local
`31337` deployment, and forced writes become real Base mainnet transactions
with real gas.

The one-line fix while developing against the fork is:

```ts
targetNetworks: [chains.hardhat],
```

`chains.base` becomes the right value only when the vault has actually been
deployed to Base mainnet, the app is meant to use Base mainnet, and you want
wallet transactions to spend real gas on chain ID `8453`.
