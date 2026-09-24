# Fork mode: why `chains.base` breaks the app

## Where the frontend is talking vs. where the vault lives

| | Network | Chain ID | RPC |
|---|---|---|---|
| **Frontend (with `chains.base`)** | real Base mainnet | **8453** | public Base RPC / Alchemy Base |
| **Vault (deployed by `yarn deploy`)** | local Anvil fork of Base | **31337** | `http://127.0.0.1:8545` |

`yarn fork --network base` runs Anvil locally. It copies Base state (Uniswap, USDC, whale balances…), but the chain itself is a **local chain with chain ID 31337**, not 8453. `yarn deploy` sends the vault to that local chain, and writes it into `deployedContracts.ts` under key `31337`.

## Why each symptom happens

- **"Contract not deployed"**: SE2 looks up contracts by the target network's chain ID. With `chains.base` it looks for `deployedContracts[8453]`. The vault is only at `deployedContracts[31337]`, so nothing is found.
- **Reads return nothing**: reads go to real Base RPC. The vault address was never deployed there, so there is no code at that address. The call returns empty or reverts.
- **Write asks for real gas on Base mainnet**: wagmi/RainbowKit asks the wallet to switch to chain 8453 and signs a real transaction there. Real ETH, to an address with no contract. Real money at risk, nothing useful happens.

## Why the teammate's line looked logical

"We are forking Base" sounds like "we are on Base". But a fork is a **local copy** of Base's state. It is not Base's network. The state is Base's; the chain ID (31337) and RPC (localhost) are Anvil's. `targetNetworks` picks which chain ID + RPC the frontend uses, not which state the fork was copied from.

## The one-line fix

```ts
// scaffold.config.ts
targetNetworks: [chains.foundry], // chain ID 31337, localhost:8545 (the fork)
```

Then restart `yarn start` and set the wallet to the local network (31337, localhost:8545) — or use SE2's burner wallet.

## When `chains.base` becomes right

Only when the contracts are deployed to **real Base**, e.g. `yarn deploy --network base`. That run writes the vault under key `8453` in `deployedContracts.ts`. Then switch `targetNetworks` to `[chains.base]` and build/ship the production frontend. Before that — during all fork-mode development and testing — keep `chains.foundry`.
