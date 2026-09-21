# Base fork + `targetNetworks: [chains.base]` — what broke

## Where things actually are

| | Chain | Chain ID | RPC |
|---|---|---|---|
| **Vault lives on** | local Anvil fork of Base | **31337** | `http://127.0.0.1:8545` |
| **Frontend talks to** | real Base mainnet | **8453** | public/Alchemy Base RPC |

- `yarn fork --network base` (foundry flavor) runs Anvil roughly as
  `anvil --fork-url <base rpc> --chain-id 31337`. It copies Base's state, but
  the local chain **reports chain ID 31337**, not 8453.
- `yarn deploy` sends the vault to that local node and `generateTsAbis` writes it
  into `packages/nextjs/contracts/deployedContracts.ts` under key **`31337`**.
- With `targetNetworks: [chains.base]`, SE-2 hooks (`useScaffoldReadContract`,
  `useScaffoldWriteContract`, `useDeployedContractInfo`) look up
  `deployedContracts[8453]` and use the Base mainnet RPC.

## Why each symptom happens

- **"Contract not deployed"**: `deployedContracts[8453]` has no vault. Only
  `deployedContracts[31337]` has it.
- **Reads return nothing**: no address/ABI for 8453, and the vault address does
  not exist on real Base anyway (it only exists on your local fork).
- **Wallet asks for a real Base tx with real gas**: the app switches the wallet to
  chain 8453 and sends the tx to real Base mainnet, not to `localhost:8545`. The
  local burner wallet is also off, because it only works on local chains.

## Why the teammate's line looked logical

"We fork Base, so the target network is Base." But a fork is a **copy of Base
running on your machine**. It has Base's contracts and balances, but it is a
separate chain with its own RPC (`127.0.0.1:8545`) and its own ID (31337).
`targetNetworks` doesn't mean "which chain's state am I using". It means
"which chain ID + RPC does the frontend connect to, and which
`deployedContracts` entry does it read". Setting it to `chains.base` sent the
app to the real network, away from the fork.

## One-line fix

```ts
// packages/nextjs/scaffold.config.ts
targetNetworks: [chains.foundry],   // chain ID 31337, RPC http://127.0.0.1:8545
```

(`chains.hardhat` also works because it is also 31337, but `chains.foundry` fits
the foundry flavor.) Make sure the wallet is on the local 31337 network, or use
the burner wallet.

## When `chains.base` becomes the right value

When the vault is **actually deployed to real Base mainnet**, meaning
`yarn deploy --network base` (with a funded deployer key) has run and
`deployedContracts.ts` now has an **`8453`** entry. That is the move from local
development to production: switch `targetNetworks` to `[chains.base]` at that
point, before shipping the frontend (`yarn vercel` / `yarn ipfs`). The same
applies to Base Sepolia (`chains.baseSepolia`, 84532) if you deploy there first
for a public testnet. Until then, as long as you're on the fork, keep
`chains.foundry`.
