# Forking Base ≠ targeting Base

## Short version

| | chain | chain ID |
|---|---|---|
| Where the vault actually lives | local Anvil fork node on `http://127.0.0.1:8545` | **31337** |
| Where the frontend is pointed | real Base mainnet (public/Alchemy RPC) | **8453** |

One line fixes it:

```ts
// packages/nextjs/scaffold.config.ts
targetNetworks: [chains.foundry],   // 31337 — not chains.base
```

## Which network is which

`yarn fork --network base` does **not** start Base. It starts **Anvil** on
`127.0.0.1:8545` with `--fork-url <base rpc>`, which copies Base's *state* —
balances, code, storage of every deployed contract — into a brand-new local
chain. Scaffold‑ETH 2's fork script pins that local chain's ID to **31337**, so
the node answers `eth_chainId` with `0x7a69`. It is a Base-shaped sandbox, not
Base.

`yarn deploy` with no `--network` flag defaults to the `localhost` profile, so
the vault was broadcast to that Anvil node. The deploy succeeded exactly as
reported — and SE‑2's post-deploy step wrote the address and ABI into
`packages/nextjs/contracts/deployedContracts.ts` under the key **`31337`**:

```ts
const deployedContracts = {
  31337: { Vault: { address: "0x...", abi: [...] } },
} as const;
```

There is no `8453` key in that file, because nothing was ever deployed to real
Base.

Meanwhile `targetNetworks: [chains.base]` tells the frontend its target chain is
8453. SE‑2 uses `targetNetworks[0]` to build the wagmi config, so:

- the transport for 8453 is the **public/Alchemy Base RPC**, i.e. the real
  network — your Anvil node is never contacted;
- `useDeployedContractInfo` looks up `deployedContracts[8453].Vault`, finds
  nothing, and reports **"not deployed"**;
- every `useScaffoldReadContract` therefore has no address to call and returns
  `undefined`;
- a forced write is built against **real Base**, so the wallet quotes **real ETH
  gas** — and at that address on real Base there is either nothing or some
  unrelated contract, so the transaction is at best wasted gas and at worst
  money sent into a stranger's code.

## Why the teammate's reasoning looked right

The inference — "we're forking Base, so the target network is Base" — conflates
two different things that a fork deliberately separates:

- **State**: the fork *does* contain Base. Every Aave pool, Uniswap router,
  USDC contract and whale balance is there at the forked block. That's the whole
  point, and it's why the reasoning feels correct.
- **Identity / routing**: the fork is a *different chain* with its own chain ID,
  its own RPC endpoint, and its own post-fork history (your vault deployment
  exists only here). `targetNetworks` controls identity and routing, not state.

So the teammate configured the frontend to talk to the chain the fork was
*copied from*, rather than the chain the fork *is*. Forking gives you Base's
contents at a local address; it does not make localhost into Base.

The chain ID is also load-bearing beyond routing in SE‑2: `31337` is what
switches on the burner wallet, the local faucet, the "Local" network badge, and
local-only block-explorer links. Declaring 8453 turns all of that off too, which
is why the app suddenly behaves like a production deployment.

(Tempting alternative: run Anvil with `--chain-id 8453` so the fork "is" Base.
Don't. wagmi would still resolve chain 8453 to the public Base RPC rather than
your node, so you'd be in the same broken state — with the added hazard that
your wallet can no longer tell the sandbox from the real thing.)

## The one-line fix

```ts
// packages/nextjs/scaffold.config.ts
targetNetworks: [chains.foundry],
```

`chains.foundry` is viem's chain ID **31337** at `http://127.0.0.1:8545` — the
Anvil fork. (In the hardhat flavor of SE‑2 the equivalent is `chains.hardhat`,
same ID; this project is foundry flavor, so use `chains.foundry`.)

After the change: `deployedContracts[31337].Vault` resolves, the Debug page
finds the vault, reads return data read out of forked Base state, and writes go
to Anvil with free fake ETH. Point your wallet at the localhost 31337 network
(or just use SE‑2's burner wallet, which comes back automatically) and confirm
the wallet's network badge says Localhost — not Base — before signing anything.

## When `chains.base` becomes the right value

At **production launch** — specifically, the moment you have actually deployed
the vault to Base mainnet:

```bash
yarn deploy --network base     # writes an 8453 entry into deployedContracts.ts
yarn verify --network base
```

Once `deployedContracts.ts` contains a real `8453: { Vault: ... }` entry and
you're ready for real users spending real gas, `targetNetworks: [chains.base]`
is correct and necessary. The ordering is the rule: **`targetNetworks` follows
the deployment, it never leads it.** Set it to the chain where the contract
address in `deployedContracts.ts` is actually live.

Two practical notes for that transition:

- You can keep both — `targetNetworks: [chains.foundry, chains.base]` — during
  the overlap. Entry `[0]` is the default the app boots into, so keep
  `chains.foundry` first while developing and promote `chains.base` to first (or
  drive it from an env var, e.g. `NEXT_PUBLIC_TARGET_NETWORK`) at release, so
  nobody has to remember to edit this file.
- A Base-mainnet deploy needs a funded deployer key and `yarn account` set up;
  the local fork lets you rehearse the entire deploy against real Base state
  first, which is exactly what the fork is for.
