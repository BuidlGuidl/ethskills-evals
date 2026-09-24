# Fastest path to a full-stack Ethereum app

**Use Scaffold-ETH 2.** It is the only option that gives you all four of your
requirements — Solidity contract, React frontend, typed contract calls, wallet
connect, local chain — from a single command, with the typed-contract-call
plumbing already wired. Assembling Foundry + Next.js + wagmi by hand gets you to
the same place, but you'd spend a day of your week writing the ABI-to-TypeScript
codegen that SE-2 ships with.

Everything below was actually run end-to-end on 2026-09-20 before being written
down. Verified versions are listed at the bottom.

## Setup

Prerequisite: Node.js >= 20 and Git. Foundry is installed by the scaffold's
submodules, but if you want `forge`/`cast`/`anvil` on your PATH:

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

Scaffold the app:

```bash
npx create-eth@latest my-app -s foundry
cd my-app
```

`-s foundry` picks the Solidity framework non-interactively. Omit it and you get
an interactive prompt. (`-s hardhat` is the alternative; Hardhat 3 is a
legitimate choice in 2026, but Foundry is faster and is the SE-2 default path.)

Then, in **three separate terminals**:

```bash
# Terminal 1 — local chain (anvil, chain ID 31337)
yarn chain

# Terminal 2 — compile + deploy + regenerate TypeScript ABIs
yarn deploy

# Terminal 3 — frontend on http://localhost:3000
yarn start
```

That's the whole loop. `yarn install` is run for you by the scaffold; if you
passed `--skip-install`, run `yarn install && yarn format` first.

## What you get, mapped to your requirements

| You asked for | What ships |
|---|---|
| One Solidity contract | `packages/foundry/contracts/YourContract.sol` |
| React frontend | `packages/nextjs` — Next.js 16 + React, App Router |
| Typed contract calls | `useScaffoldReadContract` / `useScaffoldWriteContract` |
| Wallet connect | RainbowKit, pre-wired; "Connect Wallet" in the header |
| Local chain | `yarn chain` → anvil on `127.0.0.1:8545` |

**The typed-calls part is the reason to use this.** `yarn deploy` runs a codegen
step that writes `packages/nextjs/contracts/deployedContracts.ts` containing the
deployed address and a full `as const` ABI. The hooks read from that file, so
contract names, function names, argument types, and return types are all
autocompleted and type-checked against the contract you just deployed. Change
the Solidity, re-run `yarn deploy`, and the frontend types update. No manual ABI
copying.

Read:

```tsx
const { data: greeting } = useScaffoldReadContract({
  contractName: "YourContract",
  functionName: "greeting",
});
```

Write:

```tsx
const { writeContractAsync } = useScaffoldWriteContract({
  contractName: "YourContract",
});

await writeContractAsync({
  functionName: "setGreeting",
  args: ["hello"],
});
```

Note both hooks take an **object**. You may find older tutorials passing the
contract name as a bare string — `useScaffoldWriteContract("YourContract")`.
That overload still works but is marked `@deprecated` in the current source; use
the object form so you don't have to migrate later.

Also useful for getting in front of users fast: the scaffold ships a `/debug`
page that auto-generates a form UI for every function on your deployed
contract. You can exercise reads and writes there before building any real UI.

## Shipping this week

- Point at a testnet by editing `targetNetworks` in
  `packages/nextjs/scaffold.config.ts`. Use **Sepolia** (chain ID 11155111) —
  Goerli and Rinkeby are long dead.
- Get Sepolia ETH from https://sepolia-faucet.pk910.de/ or
  https://www.alchemy.com/faucets.
- `yarn deploy --network sepolia`, then `yarn verify --network sepolia`.
- Frontend hosting: `yarn vercel`. There's also `yarn ipfs` for IPFS.
- Your `yarn start` dev server is fine for development, but deploy the built
  output, not the dev server.

## Verification notes

I ran the full sequence rather than quoting docs. What I confirmed directly:

- `npx create-eth@latest -s foundry` scaffolds successfully.
- `yarn install` completes.
- `yarn deploy` compiles, deploys to chain ID 31337, and regenerates
  `deployedContracts.ts` with the typed ABI and live address.
- `yarn build` produces all routes, including `/debug` and `/blockexplorer`.
- The served app returns HTTP 200 and renders "Connect Wallet".

Two caveats, both environment-specific rather than problems with the stack:

- In my sandbox `yarn chain` hit "Address already in use" because a chain was
  already bound to 8545. On a clean machine this is not an issue; if you hit it,
  something else is on 8545.
- `yarn start` (dev mode) failed in my sandbox with `Too many open files
  (os error 24)` from Turbopack's file watcher. This is an inotify limit in the
  container (`max_user_instances` = 128), not a defect — the production build
  and server both worked fine. If you ever see it on Linux, raise
  `fs.inotify.max_user_instances`.

Versions verified today (2026-09-20):

| Package | Version |
|---|---|
| create-eth | 2.0.23 (published 2026-07-30) |
| Next.js | 16.2.4 |
| wagmi | 2.19.5 |
| viem | 2.53.1 |
| RainbowKit | 2.2.11 |
| Foundry (forge/anvil) | 1.5.1-stable |

## Two things worth knowing

- **abi.ninja** (https://abi.ninja) — paste any verified contract address and
  get a working UI for every function, zero setup. Good for poking at contracts
  you didn't write.
- **`cast`** — `cast call` / `cast send` for CLI contract interaction, and
  `anvil --fork-url <RPC>` to fork mainnet locally and test against real
  deployed contracts with fake ETH.
