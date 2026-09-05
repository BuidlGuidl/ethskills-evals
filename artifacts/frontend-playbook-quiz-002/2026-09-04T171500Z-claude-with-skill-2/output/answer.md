# Fork mode: the frontend is on Base, the vault is on Anvil

## The two networks, by chain ID

| | Chain ID | What is actually there |
|---|---|---|
| Where the frontend points | **8453** (Base mainnet, `chains.base`) | Real Base. No vault at your deployed address. |
| Where the vault lives | **31337** (local Anvil fork, `chains.foundry`) | The vault `yarn deploy` just created. |

`yarn fork --network base` does not put you *on* Base. It starts a **local Anvil node
on `http://127.0.0.1:8545`, chain ID 31337**, whose state is lazily copied from Base at
the fork block. It is a private local copy: forked *from* Base, not *connected to* Base.
`yarn deploy` therefore broadcast the vault to that local node, and `deployedContracts.ts`
records it under chain ID **31337**.

Meanwhile `targetNetworks: [chains.base]` told the frontend its target chain is **8453**,
so wagmi/viem builds its clients against a public Base RPC and the contract hooks look up
deployments under key `8453`.

## Why every symptom follows from that one mismatch

- **"Contract not deployed"** — `useScaffoldContract` / `useDeployedContractInfo` index
  `deployedContracts` by the *target* chain ID. There is a `31337` entry; there is no
  `8453` entry. Lookup misses, and the UI reports the contract as not deployed.
- **Reads return nothing** — reads go to a public Base RPC at 8453. Even with the address
  hardcoded, that address holds no code on real Base, so calls revert or return empty.
- **Write prompts real gas on Base mainnet** — this is the dangerous one. Forcing a write
  makes the app request chain 8453 from the wallet, and the wallet obliges with a genuine
  Base mainnet transaction paid in real ETH. Nothing is sandboxed: the fork protects your
  contracts, not your wallet, and the frontend never touched the fork at all.

## Why the teammate's reasoning looked right

The line reads as a perfectly sensible inference: "we are forking Base, so our target
network is Base." The error is conflating **the chain being forked from** with **the chain
the app talks to**. A fork's *state* comes from Base; its *identity* — chain ID, RPC
endpoint, and the address book your deployment writes into — is purely local Anvil.
`targetNetworks` answers the identity question, not the provenance question. Nothing in
the tooling complains, because 8453 is a completely valid config; it is just pointed at a
different machine than the one holding your vault.

## The one-line fix

```typescript
// packages/nextjs/scaffold.config.ts
targetNetworks: [chains.foundry],   // 31337 — the local fork, not chains.base
```

Restart the Next.js dev server so the config is picked up, and connect your wallet to
Localhost 8545 / chain 31337. Reads, writes, and the deployment lookup then all agree on
31337. You still get real Base state — the forked token balances, Aave/Uniswap pools, and
whatever else your vault integrates with — because that state was copied into Anvil. Fork
mode gives you Base's data with local safety; that is the whole point, and it only works
when the frontend is aimed at the fork.

## When `chains.base` becomes correct

At **real deployment**: when you stop running a local fork and actually deploy the vault
to Base mainnet (`yarn deploy --network base`), so a genuine 8453 entry exists in
`deployedContracts.ts` and you intend users to sign real Base transactions with real gas.

That is the only moment. During development, integration testing, and demos against forked
state, the target stays `chains.foundry`. A useful rule: **`targetNetworks` must name the
chain your contract address was actually written to** — set it to whatever `yarn deploy`
last broadcast to, never to the chain you forked from.

Concretely, the lifecycle is:

1. `yarn chain` (isolated unit work) → `chains.foundry`, 31337
2. `yarn fork --network base` (test against real Base state) → still `chains.foundry`, 31337
3. `yarn deploy --network base` (production release) → `chains.base`, 8453

Steps 1 and 2 differ in the *data* Anvil serves, not in the chain the frontend targets.
Only step 3 changes `targetNetworks`.

## Guardrail worth adding

Because the failure mode is a real-money transaction, make the mismatch loud rather than
silent. Before a fork demo, sanity-check that the running node and the config agree:

```bash
cast chain-id --rpc-url http://127.0.0.1:8545   # expect 31337
```

If that prints 31337 while `scaffold.config.ts` says `chains.base`, you are one confirmed
wallet prompt away from spending real ETH.
