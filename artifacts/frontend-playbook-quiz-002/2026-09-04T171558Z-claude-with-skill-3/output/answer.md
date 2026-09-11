# Fork mode: the frontend is on the wrong chain

## 1. Where each side actually is

| | Network | Chain ID |
|---|---|---|
| Where the vault actually lives | local Anvil fork (`http://127.0.0.1:8545`), seeded with a copy of Base state | **31337** |
| Where the frontend is talking | Base mainnet, via its public RPC | **8453** |

`yarn fork --network base` does **not** start a node "on Base". It starts a local
Anvil node that *copies* Base state at the fork block. Anvil keeps its own chain
ID — 31337 — unless explicitly told otherwise. `yarn deploy` with no `--network`
flag defaults to `localhost`, so the vault was broadcast to that Anvil node and
its address was written into `deployedContracts.ts` under key `31337`.

Meanwhile `targetNetworks: [chains.base]` tells the frontend: connect to chain
8453, use Base's public RPC, and look up contracts under key `8453`.

That explains all three symptoms at once:

- **"Contract not deployed"** — `deployedContracts[8453]` has no `Vault` entry;
  the only entry is under `31337`.
- **Reads return nothing** — `useScaffoldReadContract` is querying real Base
  mainnet, where nothing was ever deployed at that address.
- **Write prompts for real gas** — the wallet is being asked to sign on chain
  8453. That is the real Base network with real ETH. Nothing about running a
  fork locally makes those transactions fake; the fork is a separate node the
  wallet was never pointed at.

## 2. Why the teammate's line looked logical

The reasoning was "we are forking Base, so the target network is Base." It
conflates two different things:

- **The source of the forked state** — that *is* Base, and it is why the fork is
  useful: real Aerodrome pools, real USDC balances, real token contracts.
- **The network the frontend connects to** — that is the local Anvil node.

`targetNetworks` is the second thing. It is a connection setting (RPC endpoint +
chain ID + the key used for deployment lookups), not a label describing where
the data came from. The fork is a private, throwaway copy that only exists on
`localhost:8545`; the vault deployed into it is invisible to the outside world.
Naming `chains.base` makes the app skip the copy entirely and talk to the
original — which has the Base state (so the mental model *feels* confirmed) but
none of your contracts, and charges real money for writes.

## 3. The one-line fix

```typescript
// packages/nextjs/scaffold.config.ts
targetNetworks: [chains.foundry],   // chain 31337 — the local fork, not chains.base
```

The frontend then connects to `http://127.0.0.1:8545`, resolves the vault from
`deployedContracts[31337]`, reads succeed against forked Base state, and writes
are signed on the local node with worthless gas. Make sure the browser wallet is
also switched to the Localhost / 31337 network — the config change alone does
not move an already-connected wallet.

(An alternative that is *not* recommended: launching Anvil with
`--chain-id 8453` so the fork impersonates Base. It makes `chains.base` "work",
but then a misconfigured RPC or a wallet that silently falls back to the public
endpoint sends real mainnet transactions with no visible difference in the UI.
Keeping the fork at 31337 preserves that safety boundary.)

## 4. When `chains.base` becomes correct

Only at real deployment — the moment the vault stops living in a local copy and
starts living on Base itself. Concretely, when you:

1. Run `yarn deploy --network base` with a funded deployer key, broadcasting for
   real and (typically) verifying on Basescan;
2. See `deployedContracts.ts` gain a `8453` entry with the live vault address;
3. Build the production/IPFS release for users who have no local node at all.

At that point `targetNetworks: [chains.base]` is exactly right, and every symptom
above disappears because the deployment finally exists on the chain the frontend
is pointed at. Until that deploy has actually happened, fork development stays on
`chains.foundry`.
