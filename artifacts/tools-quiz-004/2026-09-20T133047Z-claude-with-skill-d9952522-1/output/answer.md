# Fastest path: Scaffold-ETH 2 via `create-eth`

One command gives you all four requirements — Solidity contract, React (Next.js)
frontend with **typed** contract reads/writes, wallet connect, and a local chain —
already wired together. Don't assemble Hardhat + wagmi + RainbowKit by hand this
week; the typed-ABI plumbing between them is the part that eats the days.

## Prerequisites

```bash
node -v      # need >= 22.10.0
corepack enable   # project pins yarn@4.13.0 via packageManager
```

## Setup commands

```bash
npx create-eth@latest my-app -s hardhat
cd my-app
yarn install && yarn format
```

Then three terminals:

```bash
yarn chain     # terminal 1 — local Hardhat node on :8545, prefunded accounts
yarn deploy    # terminal 2 — deploys contracts, regenerates frontend types
yarn start     # terminal 3 — Next.js frontend on :3000
```

`-s hardhat` picks the Solidity framework non-interactively (`-s foundry` is the
alternative). Drop the flag to get the interactive picker. Add `--skip-install`
if you want to inspect the tree before installing.

## What you get

- `packages/hardhat/contracts/YourContract.sol` — edit this, it's your one contract.
- `packages/hardhat/deploy/00_deploy_your_contract.ts` — deploy script.
- `packages/nextjs/` — Next.js app, RainbowKit wallet connect already mounted.
- `packages/nextjs/hooks/scaffold-eth/` — the typed call layer:
  `useScaffoldReadContract`, `useScaffoldWriteContract`, `useScaffoldContract`,
  `useScaffoldEventHistory`, `useScaffoldWatchContractEvent`.
  Contract name, function name, and args are all type-checked off the generated ABI.
- A `/debug` page that auto-renders a UI for every contract function — useful for
  demoing before the real frontend is finished.

The loop is: edit the `.sol`, re-run `yarn deploy`, and the frontend types
regenerate. No manual ABI copying.

## Verified today (2026-09-20)

Checked against the live npm registry and by actually scaffolding a project:

- `create-eth` — **2.0.23** (`latest`, published 2026-07-30). CLI flags `-s`,
  `-e`, `--skip-install`, `--help` confirmed by running it.
- Scaffold pins: `next` ~16.2.4, `viem` 2.53.1, `wagmi` 2.19.5,
  `@rainbow-me/rainbowkit` 2.2.11, `hardhat` ^3.4.5.

Pinning `npx create-eth@2.0.23` instead of `@latest` is fine and gives you a
reproducible scaffold for the week.

## Don't use these

- `create-eth-app` — not an older spelling of the same thing, it's a dead
  package. Last published 2024-01-10.
- `create-scaffold-eth` — also dead. Last published 2023-01-16.

Both still resolve on npm, so a typo won't error — it'll just quietly scaffold
you a stale project. The live package name is `create-eth`.

## One caveat before you ship

The scaffold pins `wagmi` 2.19.5 while npm `latest` is 3.7.7 (`viem` 2.53.1 vs
2.56.8). That's intentional — the scaffold-eth hooks are written against those
majors. Do **not** bump wagmi to 3.x this week to "be current"; it's a major
bump and the typed hooks are what you'd be breaking. Ship on the pinned versions.
