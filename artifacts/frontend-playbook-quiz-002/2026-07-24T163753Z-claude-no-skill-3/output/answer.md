# Fork vs. mainnet: where the vault actually lives

## Two different networks, two different chain IDs

- **Where the vault actually lives:** the local Anvil fork, **chain ID `31337`.**
  `yarn fork --network base` runs `anvil --fork-url <base-rpc> --chain-id 31337`.
  Anvil copies Base's *state* (balances, deployed contracts, etc.) into a node
  running on `http://127.0.0.1:8545`, but that node keeps Foundry's default chain
  ID `31337`. When you `yarn deploy`, the vault is deployed to *that* local node,
  and its address is recorded in `deployedContracts.ts` under key `31337`.

- **Where the frontend is now talking:** **Base mainnet, chain ID `8453`.**
  `targetNetworks` is what wagmi/RainbowKit use to pick the RPC and the chain the
  wallet transacts on. `chains.base` = `8453`, so the app connects to the real
  Base public RPC.

So the two never meet: the frontend reads/writes on `8453`, the vault only exists
on the local fork at `31337`.

## Why the results look the way they do

- **"Contract not deployed":** Scaffold-ETH looks up the vault in
  `deployedContracts` under the *target* chain. There's an entry for `31337`, none
  for `8453`, so the app reports it as not deployed.
- **Reads return nothing:** `useScaffoldReadContract` now queries Base mainnet,
  where nothing lives at that address — empty/failed reads.
- **A forced write prompts for real gas on Base mainnet:** the wallet is being
  asked to send a transaction on `8453`, which is the *real* chain, so it wants
  real ETH for gas.

## Why the teammate's line looked logical but breaks everything

"We're forking Base, so the target network should be Base" *sounds* right, but it
conflates two independent things:

- **Forking Base** copies Base's state into a **local** node. That node's identity
  is `31337`, not `8453`. The fork is not Base; it's a private copy that happens to
  start from Base's state.
- **`targetNetworks`** doesn't describe "what we forked" — it describes **which
  chain the browser should connect to and transact on.** Setting it to
  `chains.base` sends the app past the local fork straight to live Base mainnet,
  where the freshly-deployed vault does not exist.

The deploy went to `31337`; the frontend was told to look at `8453`. The mismatch
is the whole bug.

## The one-line fix

Point the frontend back at the local fork:

```ts
// scaffold.config.ts
targetNetworks: [chains.foundry], // chain ID 31337 — matches the local fork
```

(`chains.hardhat` is equivalent; both resolve to `31337`.) Reconnect the wallet to
the `31337` / `localhost:8545` network and reads, "deployed" status, and gas-free
writes all come back.

## When `chains.base` becomes the right value

When you stop developing against the local fork and **actually deploy the vault to
real Base mainnet** — i.e. `yarn deploy --network base` (not the fork). At that
point `deployedContracts.ts` gets a real `8453` entry with a real address, and the
app *should* target `chains.base` so users transact on live Base. Until that
production deploy, `chains.base` is pointing at a chain where your contract doesn't
exist.
