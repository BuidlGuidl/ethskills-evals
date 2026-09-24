# Fork mode: why `targetNetworks: [chains.base]` breaks the app

## Where things actually are

| | Chain | Chain ID | RPC |
|---|---|---|---|
| **Vault lives on** | Local Anvil fork (`chains.foundry`) | **31337** | `http://127.0.0.1:8545` |
| **Frontend talks to** | Real Base mainnet (`chains.base`) | **8453** | public/Alchemy Base RPC |

`yarn fork --network base` starts **Anvil on your machine**. Anvil copies Base's state (Uniswap, USDC, whale balances…), but it runs as its own local chain with chain ID **31337**. `yarn deploy` sent the vault to that local chain. So `deployedContracts.ts` stores the vault under key `31337`.

With `targetNetworks: [chains.base]`, the frontend does three things:
- It looks up contracts under chain ID **8453**. There's no entry there, so it shows **"contract not deployed"**.
- It sends reads to the real Base RPC. The vault address has no code on real Base, so **reads return nothing**.
- It asks the wallet to switch to chain 8453, so writes become **real Base mainnet transactions with real gas**. That's dangerous: you'd pay real ETH to call an address with no contract on it.

## Why the teammate's line looked logical

"We're forking Base, so the target is Base" sounds right. A fork has Base's state and addresses, and the CLI flag literally says `--network base`. But a fork **copies the state, not the network**. The copy runs locally and has its own chain ID (31337). Real Base knows nothing about what you deploy to it. The frontend picks contracts and RPCs by chain ID, not by "which chain's state is this copied from".

## One-line fix

```ts
// scaffold.config.ts
targetNetworks: [chains.foundry],
```

Then reload the app and switch the wallet to the local network (31337, localhost:8545). The vault shows up, reads work, and writes go to the fork with fake ETH.

(Separate tip: run `cast rpc anvil_setIntervalMining 1`, or add `--block-time 1` to the fork script. Otherwise `block.timestamp` stays frozen on the fork.)

## When `chains.base` becomes the right value

When you deploy the vault to **real Base mainnet**, e.g. `yarn deploy --network base`. At that point `deployedContracts.ts` gets an entry under chain ID **8453**, and the frontend should point there. That's the production step, just before you build and ship the frontend (IPFS/Vercel). Until the contract really exists on chain 8453, keep `chains.foundry`.
