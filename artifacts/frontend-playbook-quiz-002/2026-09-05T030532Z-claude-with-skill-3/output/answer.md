# Fork mode: the frontend is on Base mainnet, the vault is on Anvil

## The split, in chain IDs

| | Chain ID | What is there |
|---|---|---|
| Where the frontend is talking | **8453** — Base mainnet (`chains.base`) | The real Base chain. No vault of yours at that address. |
| Where the vault actually lives | **31337** — local Anvil fork (`chains.foundry`) | Your deployed vault, plus a copy of all of Base's state. |

`yarn fork --network base` does **not** run Base. It runs **Anvil locally**, seeded from Base mainnet state via an archive RPC. The forked state (Uniswap, Aave, USDC, whale balances) is real and readable — but the node itself is a local chain, and it reports **chain ID 31337**, not 8453. `yarn deploy` broadcast to `http://127.0.0.1:8545`, so the vault address written into `deployedContracts.ts` is keyed under **31337**.

Meanwhile `targetNetworks: [chains.base]` tells the frontend: use the Base mainnet RPC, and look up contracts under chain ID 8453.

That single mismatch explains all three symptoms:

- **"Contract not deployed"** — `useDeployedContractInfo` looks up the vault under chain 8453 in `deployedContracts.ts`. There is only a 31337 entry. Nothing found.
- **Reads return nothing** — `useScaffoldReadContract` is calling real Base mainnet at your vault's address, where there is no code. No revert, just empty.
- **Forced write prompts real gas on Base mainnet** — the wallet is on chain 8453 because the app asked it to be. This is the dangerous one: the transaction is real, the gas is real ETH, and it is aimed at an address that holds no contract on Base.

## Why the teammate's line looked right

The reasoning was "we are forking Base, so the target network is Base." That conflates two different things:

- **What state you are forking** — Base. Chosen by the `--network base` flag on `yarn fork`. This is a Foundry/Anvil concern.
- **What chain the frontend connects to** — the local node. Chosen by `targetNetworks` in `scaffold.config.ts`. This is a wagmi/viem concern.

`targetNetworks` is not a label describing which chain's data you are working with. It is the actual RPC endpoint and chain ID the browser and the wallet will use. A fork of Base is not Base; it is a local chain that happens to have Base's state in it, and it identifies itself as 31337.

## The one-line fix

```typescript
// packages/nextjs/scaffold.config.ts
targetNetworks: [chains.foundry],   // 31337 — the local fork, NOT chains.base
```

Restart `yarn start` and reconnect the wallet (switch MetaMask to Localhost 8545 / chain 31337; if the wallet has a stale nonce from the mainnet prompt, use "Clear activity tab data"). Reads resolve, the debug page finds the vault, writes cost fake ETH — and you still see real Base state, because the fork carries it.

## When `chains.base` becomes correct

The moment the vault is deployed to **real Base**, and only then:

```bash
yarn deploy --network base   # broadcasts to Base mainnet, writes an 8453 entry
```

That run adds a chain-8453 record to `deployedContracts.ts`. Flipping `targetNetworks` to `[chains.base]` *after* that point is correct, because now the address exists on the chain the frontend is pointed at. Flipping it *before* is the bug you just hit — you changed the sign on the door without moving the contract.

The rule: `targetNetworks` follows where the contract **is**, never where the fork came **from**. During fork development that is always `chains.foundry`.

At the same time you switch to `chains.base` for production, set an `rpcOverrides` entry for Base with a real provider (Alchemy or similar) — do not ship on the public `mainnet.base.org`.
