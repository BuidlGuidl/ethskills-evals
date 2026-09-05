# The vault is on 31337, the frontend is on 8453

## Short version

| | chain ID | RPC the code actually uses |
|---|---|---|
| Where the vault actually lives | **31337** (local Anvil fork) | `http://127.0.0.1:8545` |
| Where the frontend is talking | **8453** (Base mainnet, the real one) | Base's public RPC |

`targetNetworks: [chains.base]` points the app at chain 8453. Your vault was
deployed to chain 31337. Nothing about those two overlaps, so the app reports
"not deployed," every read comes back empty, and a forced write is a genuine
Base mainnet transaction paid for in real ETH.

**One-line fix** (`packages/nextjs/scaffold.config.ts`):

```ts
targetNetworks: [chains.foundry],
```

(`chains.foundry` is chain 31337 at `http://127.0.0.1:8545` — this is the
Scaffold-ETH 2 default for the foundry flavor. The hardhat flavor uses
`chains.hardhat`, same chain ID.)

---

## What `yarn fork --network base` actually gives you

It starts **Anvil on your machine**, seeded with a copy of Base's state pulled
over RPC. Two things are true at once, and the confusion lives in the gap
between them:

1. The *state* is Base's. USDC, Aerodrome, whatever your vault integrates with
   — all present at their real Base addresses. That is the entire point of
   forking.
2. The *network* is local and brand new. Scaffold-ETH's fork script launches
   Anvil with `--chain-id 31337`, listening on `127.0.0.1:8545`. It has its own
   block production, its own ten prefunded accounts with the well-known
   mnemonic, and its own chain ID.

A fork is a *snapshot copy*, not a connection to Base. Nothing you do on it
reaches Base, and nothing that happens on Base reaches it.

So when `yarn deploy` succeeded, it broadcast to `127.0.0.1:8545`, and the
post-deploy step wrote the address into
`packages/nextjs/contracts/deployedContracts.ts` under the top-level key
`31337`. Open that file — the key is right there, and it is not `8453`.

## Why the teammate's line looked so reasonable

The reasoning was: *"we're developing against Base, so the target network is
Base."* Which is a perfectly sane English sentence and a completely wrong
config value, because `targetNetworks` doesn't mean "which chain's state are we
working with." It means "which network should wagmi/viem connect to," and it
drives three things at once:

- **The RPC endpoint.** `chains.base` carries Base's public RPC URL. So every
  `useScaffoldReadContract` call goes out over the internet to real Base — not
  to your Anvil node, which is where all your work is.
- **The contract address lookup.** Scaffold's hooks index
  `deployedContracts` by the target chain ID. Look up `8453`, find no vault
  entry, render "not deployed," and reads resolve to nothing.
- **The chain the wallet is asked to switch to and sign on.** Hence the MetaMask
  prompt for Base mainnet with real gas.

The word "Base" appears in both `yarn fork --network base` and
`chains.base`, but it plays a different role in each. In the fork command it
names the chain you're *copying state from* — a one-time read at startup. In
`scaffold.config.ts` it names the chain you're *transacting on*. Forking Base
is precisely what lets you keep developing on 31337 while Base's contracts
behave normally; it is not a reason to leave 31337.

### One hazard worth naming explicitly

That forced write was not a harmless error dialog. Your fork-deployed vault
address has no code on real Base. In the EVM, a call to a codeless address
**succeeds** — no revert, no warning. So the transaction confirms on Base
mainnet, does absolutely nothing, and you pay for it. Check whether anything
actually got signed and broadcast before moving on. Any funds you sent along
with such a call are gone.

## Verify the fix in two commands

```bash
cast chain-id --rpc-url http://127.0.0.1:8545   # → 31337
grep -o '"[0-9]*"' packages/nextjs/contracts/deployedContracts.ts | head -1
```

The second should print `"31337"` — the same number your `targetNetworks` now
resolves to. When those two agree, the frontend finds the vault. After editing
`scaffold.config.ts`, hard-refresh the browser and reconnect the wallet so it
picks up the new chain; if you'd previously switched MetaMask to Base, switch
it back to Localhost 8545.

## When `chains.base` becomes the right value

**The moment you actually deploy the vault to real Base** — i.e. when you run
`yarn deploy --network base` with a funded deployer, and that run writes a
`8453` entry into `deployedContracts.ts`. At that point 8453 is a chain where
your vault genuinely exists, the address lookup resolves, and asking users'
wallets for real Base transactions is the intended behavior rather than a bug.

That's the production/launch step, not the development step. The natural
progression:

```ts
targetNetworks: [chains.foundry],      // local dev against a Base fork  → 31337
targetNetworks: [chains.baseSepolia],  // public testnet staging          → 84532
targetNetworks: [chains.base],         // live, after deploying to Base   → 8453
```

The rule underneath all three: **`targetNetworks` must name a chain where your
contract has actually been deployed and recorded in `deployedContracts.ts`.**
It follows your deployments; it never leads them.

### Footnote: forks that keep the original chain ID

You *can* run Anvil with `--chain-id 8453` to preserve Base's chain ID — useful
when a dependency validates chain ID or replays signed data. That does **not**
make the teammate's line correct on its own. `deployedContracts` would then be
keyed `8453` and the lookup would succeed, but `chains.base` still carries
Base's public RPC URL, so reads and writes would go to real Base while your
vault sits on localhost. Same failure, better disguised. If you go that route
you must also redirect the RPC — recent Scaffold-ETH versions expose
`rpcOverrides` in `scaffold.config.ts` for exactly this:

```ts
rpcOverrides: { [chains.base.id]: "http://127.0.0.1:8545" },
```

Unless something specifically requires the chain ID to match, stay on the
default 31337 setup. It's the configuration the rest of Scaffold-ETH — burner
wallet, faucet, block explorer tab — is built around.
