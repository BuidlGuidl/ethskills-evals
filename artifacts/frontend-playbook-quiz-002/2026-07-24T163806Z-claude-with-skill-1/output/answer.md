# Fork mode: where the frontend is talking vs. where the vault lives

## Short answer

| Question | Answer |
|----------|--------|
| Where the frontend is actually talking | **Real Base mainnet — chain ID `8453`** |
| Where the vault actually lives | **The local Anvil fork — chain ID `31337`** |
| The fix | `targetNetworks: [chains.foundry]` |
| When `chains.base` becomes correct | Only when you deploy the vault to **real Base mainnet** (production) |

## What's actually happening

`yarn fork --network base` does **not** put a chain called "Base" on your
machine. It boots a local **Anvil** node that *copies Base's state* (balances,
Uniswap, USDC, etc.) but runs under Anvil's own identity: **chain ID `31337`**,
the `chains.foundry` chain, at `http://127.0.0.1:8545`.

So when `yarn deploy` "succeeds," it deploys the vault to that local fork and
writes the address into `deployedContracts.ts` **under key `31337`**. That is
the only place the vault exists. Nothing was deployed to the real Base network.

Meanwhile the teammate set:

```typescript
targetNetworks: [chains.base],   // chain ID 8453
```

`targetNetworks[0]` is the chain the whole frontend points at. With `chains.base`
the app connects to **real Base mainnet (8453)** via its public RPC and looks up
the vault under key `8453` in `deployedContracts.ts`. There's no entry there, so:

- **"contract not deployed"** — no address exists for chain 8453.
- **reads return nothing** — the hooks have no address/RPC target on that chain.
- **a forced write prompts a real Base mainnet tx with real gas** — the wallet is
  pointed at 8453, so it tries to spend actual ETH against an address that holds
  no such contract.

The frontend and the deployment are simply looking at two different chain IDs:
**8453 vs. 31337.**

## Why the teammate's line looked logical but breaks everything

"We're forking Base, so target Base" is the intuitive read — but it confuses the
network being *forked* with the network the app *runs on*. In fork mode the app
runs on the **local Anvil fork (31337)**, not on Base. Anvil keeps its own chain
ID (31337) regardless of what upstream state it mirrors. `chains.base` tells
wagmi/RainbowKit to use the real Base RPC and real chain ID, which points every
read and write away from the local fork where the vault was actually deployed.

## The one-line fix

```typescript
// scaffold.config.ts
targetNetworks: [chains.foundry],   // chain ID 31337 — the local fork
```

Point the frontend at `chains.foundry` (31337). Now the app hits the local Anvil
RPC and resolves the vault from the `31337` entry in `deployedContracts.ts` —
reads work, and writes go to the free local fork instead of costing real gas.

## When `chains.base` becomes the right value

At **production / real deployment** — when you actually deploy the vault to Base
mainnet (`yarn deploy --network base`), which writes the real address into
`deployedContracts.ts` under key `8453`. At that moment, and only then, the
frontend should switch to `targetNetworks: [chains.base]` so it talks to the live
contract on real Base. During all local fork development, it stays `chains.foundry`.
