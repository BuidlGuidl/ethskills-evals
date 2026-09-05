# Fork mode: `targetNetworks` must be `chains.foundry`, not `chains.base`

## The two networks, by chain ID

| | Chain ID | What's there |
|---|---|---|
| Where the frontend is pointed | **8453** (Base mainnet) | Real Base. Your vault is **not** here. Real ETH, real gas. |
| Where the vault actually lives | **31337** (Anvil / `chains.foundry`) | The local fork process started by `yarn fork --network base`. Vault deployed here by `yarn deploy`. |

`yarn fork --network base` does **not** put you on Base. It starts a local Anvil node that *lazily copies state from* Base — every account, contract and balance from Base is readable through it, but the node itself is a local chain and it reports **chain ID 31337**, the standard Anvil/Foundry ID. The fork is a copy of Base's state, not a connection to Base's network.

So `yarn deploy` broadcast the vault to `http://127.0.0.1:8545` (chain 31337), and wrote its address into `packages/nextjs/contracts/deployedContracts.ts` under the key `31337`. Meanwhile `targetNetworks: [chains.base]` told the frontend to read `deployedContracts[8453]` and to talk to a Base mainnet RPC.

## Why each symptom follows

- **"Contract not deployed."** Scaffold-ETH's `useDeployedContractInfo` looks up the ABI/address by `targetNetwork.id`. It looks under `8453`, finds no `YourVault` entry (only `31337` has one), and renders the not-deployed state.
- **Reads return nothing.** `useScaffoldReadContract` has no address to call, so wagmi never issues the request. Even if it had one, it would be sending `eth_call` to a Base mainnet RPC, where nothing lives at that address — the deployment only ever existed in your local Anvil state.
- **Forced write prompts on Base mainnet with real gas.** RainbowKit/wagmi build the transaction for the active chain — 8453. The wallet is being asked, correctly, to sign a real Base mainnet transaction spending real ETH. That prompt is the dangerous symptom: the config didn't just fail to find your contract, it aimed a live-network transaction at an address that holds nothing on Base. **Reject it.** Nothing about the fork protects you here — the fork is local, but this transaction was never routed through it.

## Why the teammate's reasoning looked right

The logic is intuitive and almost correct: "we're developing against Base, so the target network is Base." The gap is that `targetNetworks` doesn't describe *which chain's state you're developing against* — it describes **which RPC endpoint and which chain ID the frontend transacts on and looks contracts up by**. In fork mode those two things diverge for the only time in the project's life: the *state* is Base's, but the *network* is Anvil's. `chains.base` correctly names the state you're forking and incorrectly names the network you're on, and only the latter is what the field means.

The confusion is reinforced by `--network base` appearing in the command you just ran. That flag tells Foundry which chain to *fork from* (i.e. which upstream RPC to pull state from); it says nothing about the local node's identity.

## The one-line fix

```typescript
// packages/nextjs/scaffold.config.ts
targetNetworks: [chains.foundry],   // 31337 — the local fork, even though we forked Base
```

That's the whole fix. Restart `yarn start` (or let Next.js hot-reload), and switch the wallet's network back to Localhost 8545 / chain 31337 if it moved to Base. The vault reads will resolve immediately — `deployedContracts.ts` already has the `31337` entry from the successful `yarn deploy`. You keep every bit of real Base state (real USDC, Uniswap, Aave, whale balances) because the fork serves it; you just stop broadcasting to the real network.

Consider leaving a comment on the line — this exact mistake is worth inoculating the next person against, since `chains.foundry` under a Base fork reads as wrong at a glance.

## When `chains.base` becomes the right value

**When the vault is actually deployed to real Base mainnet** — i.e. at production deploy time, when you run `yarn deploy --network base` against the live chain (with a funded deployer key), `deployedContracts.ts` gains a real `8453` entry, and you're building the frontend that users will load.

That flip belongs with the production build, not before it. Concretely, it happens at the top of the ship sequence, alongside setting `NEXT_PUBLIC_PRODUCTION_URL` and configuring `rpcOverrides` (do not ship pointing at `mainnet.base.org` — use Alchemy or similar) — and before the clean `rm -rf .next out` IPFS build, so the exported static bundle carries the mainnet target baked in.

The rule to carry forward:

> `targetNetworks` names the chain your contracts are **deployed to**, not the chain you're **forking from**. While a fork is running, that's always `chains.foundry` (31337).
