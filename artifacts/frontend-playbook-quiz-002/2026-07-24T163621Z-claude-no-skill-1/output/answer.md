# Why the vault shows "not deployed" while the wallet wants real gas on Base

## Short version

Your contract lives on a **local Foundry/Anvil fork (chain ID `31337`)**, but the
frontend has been told its target network is **Base mainnet (chain ID `8453`)**.
The frontend is honestly reporting the truth: there is no vault at `8453`, and any
write it sends really does go to Base mainnet.

## Which network is which

| | Chain | Chain ID |
|---|---|---|
| Where the frontend is pointed (`targetNetworks`) | Base mainnet | **8453** |
| Where the vault actually got deployed (`yarn deploy` against the fork) | Local Foundry/Anvil fork of Base | **31337** |

`yarn fork --network base` starts a **local Anvil node** that copies Base's state
via `--fork-url`. That node is still a *local* chain — Anvil's default chain ID is
`31337` (the same ID Scaffold-ETH refers to as `chains.hardhat`). It does **not**
inherit Base's `8453`. So when `yarn deploy` succeeds, it writes the vault's address
into `deployedContracts.ts` **keyed under `31337`**, and the vault only exists inside
that local process listening on `http://127.0.0.1:8545`.

## Why the teammate's line looked logical but breaks everything

```ts
// scaffold.config.ts
targetNetworks: [chains.base],
```

The reasoning is intuitive: "we're forking *Base*, so our target network is *Base*."
But "forking Base" describes where the **state** came from, not what **chain ID** the
node advertises or where the contract is addressable from the app's point of view.
`targetNetworks` drives three things in Scaffold-ETH, and this value poisons all of them:

1. **Contract lookup** — `useScaffoldContract` / `useDeployedContractInfo` look up the
   address in `deployedContracts` under the *target* chain ID. It searches `8453`,
   finds nothing (the deploy wrote to `31337`) → **"contract not deployed."**
2. **Reads** — with no contract found, `useScaffoldReadContract` has nothing to call,
   and the RPC in use is Base's public endpoint, not your fork → **reads return nothing.**
3. **Writes** — the wallet is asked to transact on chain `8453`, so it switches to /
   prompts on **real Base mainnet with real ETH gas**, hitting an address where your
   vault doesn't exist.

In other words: you're developing against `31337` but the app is looking at, and
spending money on, `8453`.

## The one-line fix

Point the frontend at the local fork:

```ts
// scaffold.config.ts
targetNetworks: [chains.hardhat],   // chain ID 31337 — the local Anvil/Foundry fork
```

(`chains.hardhat` and `chains.foundry` are both `31337`; Scaffold-ETH's default is
`chains.hardhat`.) Now contract lookup, reads, and writes all resolve to your local
forked node — you get Base's real state to test against, with fake local gas and no
mainnet risk.

## When `chains.base` becomes the right value

`targetNetworks: [chains.base]` is correct only once you **actually deploy the vault to
real Base mainnet** — i.e. the production/launch moment:

```bash
yarn deploy --network base
```

At that point the vault's address is written into `deployedContracts.ts` under `8453`,
and you *want* the frontend and users' wallets to interact with the live contract on
Base with real gas. Until that deploy happens, `chains.base` is pointing the app at a
contract that isn't there.

A common setup is to keep both during the transition:

```ts
targetNetworks: [chains.hardhat, chains.base],
```

so the app works against the local fork in development and against live Base in
production, following whichever network the connected wallet is on.
