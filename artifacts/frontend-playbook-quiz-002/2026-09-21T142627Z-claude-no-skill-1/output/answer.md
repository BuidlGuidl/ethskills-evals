# Fork of Base vs `targetNetworks: [chains.base]`

## Where the frontend talks vs where the vault lives

| | Chain | Chain ID | RPC |
|---|---|---|---|
| **Vault actually lives** | local Anvil fork of Base (`chains.foundry`) | **31337** | `http://127.0.0.1:8545` |
| **Frontend actually talks to** | real Base mainnet (`chains.base`) | **8453** | public / Alchemy Base RPC |

- `yarn fork --network base` starts **Anvil** with `--fork-url <base rpc> --chain-id 31337`. It copies Base's state (tokens, protocols, balances) into a local chain, but that chain identifies as **31337**, not 8453. It is a local copy — nothing sent to it reaches Base.
- `yarn deploy` sends the vault to that local chain at 127.0.0.1:8545 and writes the address into `packages/nextjs/contracts/deployedContracts.ts` under key **`31337`**.
- The frontend, with `targetNetworks: [chains.base]`, uses chain **8453**:
  - `useScaffoldContract` / `useDeployedContractInfo` look up `deployedContracts[8453]` → nothing there → **"contract not deployed"**.
  - Reads go to the real Base RPC. The vault was never deployed there, so there's no code at that address → **reads return nothing**.
  - Writes: wagmi asks the wallet to switch to / sign on chain 8453 → **real Base mainnet tx, real ETH for gas** (and it would call an address with no vault code on it).

## Why the teammate's line looked logical

"We're forking Base, so target Base" mixes up *whose state* with *which chain*. A fork has **Base's state** but is **its own chain**: separate RPC (localhost), separate chain ID (31337), separate deploy record. `targetNetworks` doesn't mean "which ecosystem's data do I want"; it means "which chain ID + RPC does the app connect to, and which `deployedContracts` key does it read". `chains.base` points at real Base, so the app skips your fork completely. Worse, it swaps a free local sandbox for real money without anyone noticing.

## One-line fix

```ts
// scaffold.config.ts
targetNetworks: [chains.foundry],   // 31337, the local Anvil fork
```

(Restore the default. The burner wallet / local faucet work again too, since they're only active on the local chain.)

## When `chains.base` becomes right

When the vault is **deployed to real Base mainnet**, i.e. after running
`yarn deploy --network base` (with a funded, real deployer key). That run adds a `8453` entry to `deployedContracts.ts`. From then on, `targetNetworks: [chains.base]` is correct: the frontend is meant to talk to the real vault on real Base with real gas. Usually that's the production/launch build (it's common to test on Base Sepolia, 84532, first with `chains.baseSepolia`). Until then, while developing on the fork, keep `chains.foundry`.
