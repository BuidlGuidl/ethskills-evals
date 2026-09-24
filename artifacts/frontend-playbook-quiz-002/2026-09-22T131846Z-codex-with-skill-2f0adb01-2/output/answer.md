The frontend is talking to **Base mainnet**, chain ID **8453**, because `scaffold.config.ts` has:

```ts
targetNetworks: [chains.base]
```

But the vault was deployed by `yarn deploy` onto the running local Foundry/Anvil fork, chain ID **31337**. A Base fork has Base's state, contracts, token balances, and protocols, but it is still a local Anvil chain from the wallet/frontend point of view. Its chain ID is `31337`, not `8453`.

That is why the app says the vault is not deployed: it is looking for a deployment on chain `8453`, while the generated local deployment lives under chain `31337`. It also explains the dangerous write behavior: by setting `chains.base`, the app asks the wallet to use real Base mainnet, so a forced write becomes a real Base transaction with real gas.

The teammate's line looked logical because the fork is "of Base", so Base feels like the target network. The subtle distinction is that `targetNetworks` must describe the chain the frontend connects to, not the upstream chain whose state Anvil copied.

The one-line development fix is:

```ts
targetNetworks: [chains.foundry]
```

`chains.base` becomes the right value later, when the vault is deployed to the real Base mainnet and the frontend is intentionally being configured for production/mainnet Base usage.
