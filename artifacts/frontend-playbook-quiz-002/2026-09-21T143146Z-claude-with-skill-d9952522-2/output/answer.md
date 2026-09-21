# Why `targetNetworks: [chains.base]` breaks a Base fork

## Where each side is actually talking
- **Frontend**: Base mainnet, **chain ID 8453**. `chains.base` makes wagmi/viem use Base's public RPC, and the wallet asks for Base.
- **Vault**: lives only on the local Anvil fork at `http://127.0.0.1:8545`, **chain ID 31337** (`chains.foundry`). `yarn deploy` wrote its address to `deployedContracts.ts` under key `31337`.

So the frontend looks for the vault under key `8453` in `deployedContracts.ts`. Nothing is there, so the app shows "contract not deployed". Reads go to real Base, where no vault exists at that address, so they return nothing. A forced write is signed for chain 8453 and sent to the real network: real gas, real mainnet, wrong place.

## Why the line looked logical
"We fork Base, so target Base" sounds right. But a fork is a **local copy** of Base state, served by Anvil under its own chain ID (31337) and RPC. It is not Base. The upstream chain is only where the *starting state* came from. `targetNetworks` means "where do my contracts live and where do txs go", and the answer is the local node.

## One-line fix
```ts
// packages/nextjs/scaffold.config.ts
targetNetworks: [chains.foundry],
```
Then the frontend reads `deployedContracts[31337]`, talks to `127.0.0.1:8545`, and the wallet uses the local chain (31337). Forked protocols, tokens and balances are still there, and nothing touches real Base.

## When `chains.base` becomes correct
When you do a **real deployment to Base mainnet**: `yarn deploy --network base` (real deployer key, real gas). That writes the vault address under key `8453` in `deployedContracts.ts`. From that point, set `targetNetworks: [chains.base]` for the production frontend build (e.g. the IPFS/Vercel release). Until then, during all fork development and demos, keep `chains.foundry`.
