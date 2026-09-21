# Fork mode: why `targetNetworks: [chains.base]` breaks the app

## Where things actually are

| | Network | Chain ID | RPC |
|---|---|---|---|
| Vault (where `yarn deploy` put it) | local Anvil fork of Base | **31337** (`chains.foundry`) | `http://127.0.0.1:8545` |
| Frontend (with `chains.base`) | real Base mainnet | **8453** (`chains.base`) | public Base RPC |

`yarn fork --network base` starts Anvil on your machine. It copies Base's state (the blocks, tokens, balances) at the moment the fork starts, but it runs as a **separate local chain with chain ID 31337**. `yarn deploy` sent the vault there, so `deployedContracts.ts` records the vault under key `31337`.

With `targetNetworks: [chains.base]`, the frontend:
- looks up `deployedContracts[8453]`, finds nothing → "contract not deployed";
- sends reads to the real Base RPC, where the vault address has no code (or doesn't exist) → reads return empty;
- tells the wallet to use chain 8453 → a forced write goes to **real Base mainnet with real ETH gas**, not the fork. That's the dangerous part: the transaction is real and the target contract isn't even there.

## Why the line looked logical

"We fork Base, so the target is Base" mixes up *whose state we copy* with *which chain we talk to*. The fork has Base's **data** but is its own **network**: different RPC (localhost), different chain ID (31337), and nothing sent to it ever reaches Base. SE-2 picks contracts, RPC and wallet chain all from `targetNetworks`, so pointing it at Base skips the fork completely.

## One-line fix

```ts
// packages/nextjs/scaffold.config.ts
targetNetworks: [chains.foundry],
```

(`chains.foundry` = chain ID 31337, RPC `http://127.0.0.1:8545`.) After this change, reload the app and switch the wallet to the local network (31337 / localhost:8545). The contract will show up, reads will work, and writes will go to the fork, which costs nothing real.

## When `chains.base` becomes right

Only when you **deploy the vault to real Base mainnet**, e.g. `yarn deploy --network base` with a real funded deployer key. That writes a `8453` entry into `deployedContracts.ts`. Change `targetNetworks` to `[chains.base]` at that point, for the production/IPFS build that real users will use. Before that, during all fork development and demos, keep it `chains.foundry`.
