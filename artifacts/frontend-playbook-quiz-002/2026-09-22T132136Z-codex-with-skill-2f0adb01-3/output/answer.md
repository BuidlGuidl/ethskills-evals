The frontend is currently talking to Base mainnet, chain ID `8453`, because `targetNetworks: [chains.base]` tells Scaffold-ETH/RainbowKit that the app's target chain is real Base.

The vault actually lives on the local Anvil fork, chain ID `31337`. `yarn fork --network base` copies Base state into a local Foundry/Anvil chain, but the chain the frontend must connect to during development is still `chains.foundry`, not `chains.base`. `yarn deploy` deployed the vault to that local fork, so the deployment entry is keyed under `31337`.

The teammate's line looked logical because the fork source is Base. But `targetNetworks` does not mean "which network was forked"; it means "which chain should the browser wallet and contract hooks use." Setting it to `chains.base` makes the app look for the vault on chain `8453`, where it has not been deployed, and wallet writes become real Base mainnet transactions with real gas.

One-line fix:

```ts
targetNetworks: [chains.foundry],
```

`chains.base` becomes the right value only when the project is no longer using the local fork for this deployment target: specifically, after the vault has been deployed to real Base mainnet, chain ID `8453`, and the frontend is meant to operate against that live production deployment.
