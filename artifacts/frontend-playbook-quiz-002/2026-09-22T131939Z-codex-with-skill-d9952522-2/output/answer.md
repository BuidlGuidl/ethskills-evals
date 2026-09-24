The frontend is talking to **Base mainnet**, chain ID **8453**, because
`targetNetworks: [chains.base]` tells Scaffold-ETH 2/wagmi that the app's
active contract network is the real Base chain.

The vault deployed by `yarn deploy` while `yarn fork --network base` is
running lives on the **local Anvil/Foundry fork**, chain ID **31337**. The
fork contains a copy of Base state, but it is still a local development
chain from the frontend's point of view.

The teammate's line looked logical because the forked state comes from
Base, so "we are using Base" sounds like `chains.base`. But that changes
the app from using the local fork RPC/deployment artifacts to using the
real Base network. Scaffold-ETH then looks for the vault under chain ID
8453 instead of 31337, so it appears undeployed; reads find no local
deployment; forced writes ask the wallet to send a real Base transaction
with real gas.

The one-line fix is:

```ts
targetNetworks: [chains.foundry],
```

`chains.base` becomes the right value only when the project is no longer
using a local fork and the vault has actually been deployed to Base
mainnet, with frontend deployment artifacts/config for chain ID 8453.
