# Fork ≠ Base: the chain-ID mismatch

## Short version

| Thing | Chain | Chain ID |
|---|---|---|
| Where the frontend is actually talking | **Base mainnet** (the real one) | **8453** |
| Where the vault actually lives | **The local fork node** (Anvil/Foundry, running on `localhost:8545`) | **31337** |

The frontend and the contract are on two different chains, so the app can't find the vault.

## What's really happening

`yarn fork --network base` does **not** point you at Base. It starts a
**local Anvil node on your machine** (`http://localhost:8545`) that *copies Base's
state* as its starting point. Crucially, that local node keeps the default
Foundry chain ID — **31337** — not Base's **8453**. It's a private, local chain
that merely happens to be pre-loaded with Base's data.

`yarn deploy` then deploys the vault to that local node and records the address in
`deployedContracts.ts` **under chain ID 31337**.

Scaffold-ETH's `useScaffoldContract` / `useScaffoldReadContract` hooks look up the
contract address by the **currently targeted chain ID**. They ask: "what's the
vault address on chain `targetNetworks[0]`?"

Because the teammate set `targetNetworks: [chains.base]` (8453):

- The frontend looks for the vault under chain **8453** in `deployedContracts.ts`
  → nothing is there → **"contract not deployed."**
- Reads are routed to a **real Base mainnet RPC** and query the real Base, where
  this vault was never deployed → **reads return nothing.**
- A forced write asks the wallet to sign a transaction **on Base mainnet (8453)**,
  which costs **real ETH gas** — because that's literally the chain you told the
  app to use.

Meanwhile the actual vault is sitting on `localhost:8545` (31337), untouched.

## Why the teammate's line looked logical but breaks everything

The reasoning was: *"We're forking Base, so our target network is Base — set it to
`chains.base`."* That conflates two different things:

- **What the fork is a copy *of*** → Base (its state, balances, deployed protocols).
- **What chain the fork actually *is*** → a local node with ID **31337**.

`targetNetworks` cares about the second, not the first. It selects **which chain ID
the frontend connects to and looks up addresses under** — and the fork's identity is
31337, not 8453. Naming it `chains.base` sends every RPC call and every wallet
transaction to the genuine Base mainnet instead of your local fork.

## The one-line fix

```ts
// scaffold.config.ts
targetNetworks: [chains.foundry],
```

`chains.foundry` is chain ID **31337** — the local fork node where the vault was
actually deployed and where `deployedContracts.ts` recorded it. Now lookups,
reads, and writes all hit `localhost:8545`, and forced writes spend fake local ETH,
not real gas.

(If you want the app to work against both, you can list both:
`targetNetworks: [chains.foundry, chains.base]` — but for local fork development,
`chains.foundry` is what you're on.)

## When `chains.base` becomes the correct value

When you stop forking and **actually deploy to real Base mainnet** for production —
i.e. you run a real `yarn deploy --network base` against the live Base RPC, the
vault gets an address on chain **8453**, and `deployedContracts.ts` records it under
8453. At that point users connect wallets to real Base and spend real funds *on
purpose*, so `targetNetworks: [chains.base]` is exactly right.

In other words: `chains.foundry` while you're developing against a local fork;
`chains.base` once the contract genuinely lives on Base mainnet.
