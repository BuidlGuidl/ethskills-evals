# Fork Mode: which chain is the frontend really talking to?

## The two networks (name the chain IDs)

- **Where the vault actually lives: chain ID `31337` (Foundry / Anvil local fork).**
  `yarn fork --network base` does *not* run your contracts on Base. It spins up a
  **local Anvil node** that *copies* Base's state (Uniswap, Aave, USDC, whale balances)
  but serves it on `http://localhost:8545` under Anvil's default chain ID **31337**.
  `yarn deploy` then deploys the vault to *that* local fork (31337) and writes the
  address into `deployedContracts.ts` keyed by 31337.

- **Where the frontend is looking: chain ID `8453` (Base mainnet).**
  Because the teammate set `targetNetworks: [chains.base]`, Scaffold-ETH's hooks
  read/write against the network with chain ID **8453** — the real Base — using its
  public RPC and prompting the wallet for real Base mainnet gas.

So the app and the contract are on two different chains: the UI is pointed at
**8453** while the vault only exists on **31337**.

## Why nothing works

- **"Contract not deployed":** SE2 looks up the vault address in `deployedContracts.ts`
  under the *target* chain ID. There's an entry under `31337`, but nothing under
  `8453`, so the UI concludes the contract isn't deployed on the network it's watching.
- **Reads return nothing:** the read hooks query Base mainnet (8453) at an address that
  either holds no such contract or a different one — there's no vault there, so calls
  revert / return empty.
- **Writes prompt real mainnet gas:** a forced write is routed to 8453, so the wallet
  asks you to sign a real Base transaction paying real ETH — exactly what you saw.

## Why the teammate's line *looked* logical but breaks everything

The reasoning was: "We're forking **Base**, so the target network should be
`chains.base`." That conflates the *source* of the fork with the *runtime* of the fork.
Forking Base means "load Base's state into a local sandbox," but that sandbox is still a
**local Anvil chain (31337)**, not Base itself. The frontend must point at the chain the
node is actually serving — 31337 — not the chain it was cloned from. `chains.base` tells
the app to skip the local node entirely and talk to production, where your freshly
deployed vault doesn't exist.

## The one-line fix

```typescript
// scaffold.config.ts
targetNetworks: [chains.foundry],  // 31337 — the local fork, NOT chains.base
```

## When `chains.base` becomes the right value

Only once you actually deploy the vault to **real Base mainnet** —
i.e. `yarn deploy --network base` (going to production), so that `deployedContracts.ts`
has a real 8453 address and users are meant to transact on Base for real. During
fork-mode development you stay on `chains.foundry` (31337); you flip to `chains.base`
(8453) at production launch.
