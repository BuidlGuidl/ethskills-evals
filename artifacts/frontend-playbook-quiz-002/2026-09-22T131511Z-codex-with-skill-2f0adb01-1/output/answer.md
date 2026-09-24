The frontend is talking to Base mainnet, chain ID `8453`, because `targetNetworks: [chains.base]` tells Scaffold-ETH 2/RainbowKit/wagmi that the app's active contract network is real Base.

The vault deployed by `yarn deploy` during `yarn fork --network base` lives on the local Foundry/Anvil fork, chain ID `31337`. The fork contains Base state, but it is still a local chain from the frontend's point of view.

The teammate's line looked logical because the fork is a fork *of Base*, so `chains.base` sounds like the right target. It breaks the app because Scaffold-ETH indexes deployed contracts and wallet connections by `chain.id`: the deployment exists under `31337`, but the frontend is looking under `8453`. That is why the app says the contract is not deployed, reads return nothing, and forced writes ask the wallet to spend real gas on Base mainnet.

One-line fix while developing against the Base fork:

```ts
targetNetworks: [chains.foundry],
```

`chains.base` becomes the right value only when the vault has been deployed to real Base mainnet, chain ID `8453`, and the frontend is meant to run against that production deployment instead of the local fork.
