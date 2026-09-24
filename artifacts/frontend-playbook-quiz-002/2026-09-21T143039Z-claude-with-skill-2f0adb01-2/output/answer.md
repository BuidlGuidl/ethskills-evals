# Fork mode: why `chains.base` breaks the app

## Where things actually are

| | Chain | Chain ID | RPC |
|---|---|---|---|
| **Vault lives on** | local Anvil fork (`chains.foundry`) | **31337** | `http://127.0.0.1:8545` |
| **Frontend talks to** (with `chains.base`) | real Base mainnet | **8453** | public Base RPC / Alchemy |

- `yarn fork --network base` starts Anvil on your machine. It copies Base's state (Uniswap, USDC, whale balances) but runs as its own chain with chain ID **31337**.
- `yarn deploy` sends the vault to that local Anvil. `deployedContracts.ts` gets written under key **31337**.
- With `targetNetworks: [chains.base]`, the scaffold hooks look up contracts under key **8453** and send reads/writes to real Base.

## Why each symptom happens

- **"Contract not deployed"** — `deployedContracts[8453]` has no vault entry. The only entry is under `31337`.
- **Reads return nothing** — the calls go to real Base, where no vault exists at that address (it was deployed only on the local fork).
- **Wallet asks for real gas on Base mainnet** — the app tells the wallet to use chain 8453, so the transaction goes to the real network with real ETH. Dangerous: real money, sent to an address with no vault on it.

## Why the teammate's line seemed right

"We're forking Base, so the target is Base" sounds reasonable. But a fork is a **local copy**, not Base itself. It has Base's *state* but its own *chain ID* (31337) and its own *RPC* (localhost). The frontend picks a network by chain ID and RPC, not by where the state was copied from. So `chains.base` points the app at the real network, not at your fork.

## The one-line fix

```ts
// scaffold.config.ts
targetNetworks: [chains.foundry],
```

Then refresh. If the wallet is still on Base, switch it to the local network (Localhost 8545, chain ID 31337). The app will show "switch network" if needed.

(Also for fork dev: run `cast rpc anvil_setIntervalMining 1`, or add `--block-time 1` to the fork script, so `block.timestamp` keeps moving.)

## When `chains.base` becomes correct

Only when the vault is **deployed to real Base mainnet**, e.g. `yarn deploy --network base`. Then `deployedContracts.ts` gets an entry under **8453**. At that point, and before building/shipping the production frontend, switch `targetNetworks` to `[chains.base]`. Rule: the target network must match the chain ID the contract was deployed to. Fork dev = 31337 = `chains.foundry`. Real deploy = 8453 = `chains.base`.
