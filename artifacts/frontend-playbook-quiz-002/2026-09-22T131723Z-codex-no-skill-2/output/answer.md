The frontend is currently configured to talk to real Base mainnet:

- `chains.base` is Base mainnet, chain ID `8453`.
- The vault deployed by `yarn deploy` while `yarn fork --network base` is running lives on the local Anvil/Foundry fork, chain ID `31337`.

That is the mismatch. A Base fork has Base state, but it is still a local development chain. The local vault deployment is written to the fork and recorded under chain ID `31337` in the frontend deployment artifacts. Setting:

```ts
targetNetworks: [chains.base],
```

looked logical because the fork source is Base, but it tells Wagmi/RainbowKit/Scaffold-ETH to use Base mainnet itself. The app then searches for a vault deployment on chain ID `8453`, does not find the local `31337` deployment, returns no reads, and any forced write is prepared for real Base mainnet with real gas.

The one-line fix during forked local development is:

```ts
targetNetworks: [chains.foundry],
```

`chains.base` becomes the right value when the project stops targeting the local fork and the vault is actually deployed to Base mainnet, for example with a real Base deployment such as `yarn deploy --network base`. At that point the contract lives on chain ID `8453`, so the frontend should target chain ID `8453`.
