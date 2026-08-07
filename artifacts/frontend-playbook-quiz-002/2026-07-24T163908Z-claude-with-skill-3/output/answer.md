# The Fork Mode Chain ID Trap

## Which network is which

| | Chain the frontend is talking to | Chain the vault actually lives on |
|---|---|---|
| Name | Base mainnet | Local Anvil fork of Base |
| Chain ID | **8453** | **31337** |
| Set by | `targetNetworks: [chains.base]` | `yarn fork` + `yarn deploy` |

`yarn fork --network base` spins up a **local Anvil node** that *copies* Base's
state (Uniswap, Aave, USDC, whale balances) but keeps its own chain ID: **31337**
(`chains.foundry`). It only borrows Base's data — it is not Base. When you run
`yarn deploy`, the vault is deployed to that local node and its address is written
into `deployedContracts.ts` **under chain ID 31337**.

Meanwhile `targetNetworks: [chains.base]` tells the frontend to look at **chain
8453 — the real Base mainnet**. So the app queries mainnet for a vault that only
exists on the local fork.

## Why every symptom follows

- **"Contract not deployed"** — `deployedContracts.ts` has the vault under 31337,
  nothing under 8453. The frontend looks up 8453, finds no entry → not deployed.
- **Reads return nothing** — the read hooks point at the Base mainnet RPC, where
  no such contract exists at that address; calls resolve to empty.
- **A forced write prompts for real gas on Base** — the frontend thinks its target
  chain is 8453, so it asks the wallet to send the transaction to real Base
  mainnet, with real ETH gas, against an address where your vault isn't.

## Why the teammate's line looked logical

"We're forking Base, so the target network is Base" reads as common sense. The
mistake is conflating *the chain being forked* with *the chain the frontend
connects to*. In fork mode those are two different chains: you fork Base's
**state**, but you run it on a **local node with chain ID 31337**. The frontend
must target the node it can actually reach (31337), not the upstream chain whose
data was copied (8453).

## The one-line fix

```typescript
// scaffold.config.ts
targetNetworks: [chains.foundry],   // chain ID 31337 — the local fork, NOT chains.base
```

You keep forking Base for realistic state; the frontend just points at the local
fork where the vault truly lives and where reads/writes are free and instant.

## When `chains.base` becomes the right value

Only when you leave development and **deploy the vault to real Base mainnet for
production** — i.e. `yarn deploy --network base` writes a genuine 8453 entry into
`deployedContracts.ts`. At that moment (and only then) the frontend *should*
target `chains.base`, because that is finally where the contract lives and where
users are meant to transact.
