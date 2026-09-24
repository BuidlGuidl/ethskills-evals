The frontend is talking to Base mainnet because `targetNetworks: [chains.base]`
selects chain ID `8453`.

The vault deployed by `yarn deploy` while `yarn fork --network base` is running
lives on the local Anvil/Foundry fork, chain ID `31337`. That fork copies Base
state, but it is still a local chain with its own chain ID and local RPC.

The teammate's change looked logical because the fork is a fork *of Base*.
The subtle breakage is that Scaffold-ETH's `targetNetworks` describes the
network the frontend and wallet should connect to, not the upstream chain whose
state Anvil copied. By setting `chains.base`, the app looks for deployed
contracts under chain ID `8453`, while the deploy artifacts and live contract are
on chain ID `31337`. So the app reports "not deployed", reads have no local
contract to read from, and forced writes become real Base mainnet transactions
with real gas.

The one-line fix for the Foundry flavor is:

```ts
targetNetworks: [chains.foundry],
```

`chains.base` becomes the right value only when the vault has been deployed for
real to Base mainnet and the frontend is meant to connect users to Base chain ID
`8453`, not to the local fork.
