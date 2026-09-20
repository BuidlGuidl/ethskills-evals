# Fastest path: Scaffold-ETH 2 via `create-eth`

Everything below was verified against npm and by actually running the scaffold
on 2026-09-20, not from memory.

## Why this and not a hand-rolled stack

You need four things — Solidity contract, typed React contract calls, wallet
connect, local chain. Scaffold-ETH 2 ships all four wired together. Assembling
Hardhat + wagmi + `@wagmi/cli` codegen + RainbowKit + a local node by hand is
about a day of plumbing (ABI codegen wiring, deploy-artifact-to-frontend sync,
chain config in three places). With a Friday deadline, don't.

## Prerequisites

Verified on this machine: Node v22.22.2, npm 10.9.7, Yarn 1.22.22, git 2.43.0.

The generated project declares `"engines": { "node": ">=22.10.0" }` and
`packageManager: yarn@4.13.0`. Node 22.10+ is a hard requirement. You do not
need to install Yarn 4 yourself — Corepack in the project resolves it.

## The commands

```bash
# 1. Scaffold (interactive prompts: project name, Solidity framework)
npx create-eth@latest

# Or fully non-interactive:
npx create-eth@latest my-app --solidity-framework hardhat

cd my-app

# 2. Install + format
yarn install && yarn format

# 3. Terminal 1 — local chain
yarn chain

# 4. Terminal 2 — deploy contracts to that chain
yarn deploy

# 5. Terminal 3 — frontend at http://localhost:3000
yarn start
```

Those four script names (`chain`, `deploy`, `start`, plus `compile` and `test`)
are real — confirmed present in the generated root `package.json`.

Useful flags, confirmed present in the shipped CLI: `--solidity-framework`
(`hardhat` or `foundry`), `--extension`, `--skip-install`, `--skip`, `--dev`,
`--branch`.

## Package name — get this right

`create-eth` is the live scaffold, currently **2.0.23** (published
2026-07-30).

Two similar names resolve on npm but are **dead**, not older spellings of the
same thing. Installing them gives you a stale, unmaintained project:

| Package | Last published | Status |
|---|---|---|
| `create-eth` | 2026-07-30 (v2.0.23) | Use this |
| `create-eth-app` | 2024-01-10 (v1.8.3) | Dead — do not use |
| `create-scaffold-eth` | 2023-01-16 (v1.0.1) | Dead — do not use |

Because they install without erroring, this is an easy mistake to make and a
painful one to unwind mid-week.

## What you actually get

Verified in the generated tree:

**`packages/hardhat`** — `contracts/YourContract.sol`, `deploy/00_deploy_your_contract.ts`,
Hardhat 3 (`hardhat@^3.4.5`) with `hardhat-deploy@^2.0.6`, `ethers@^6.13.2`,
`@openzeppelin/contracts@^5.0.2`, and `@nomicfoundation/hardhat-typechain@^3`.
`yarn chain` runs `hardhat node`.

**`packages/nextjs`** — Next.js ~16.2.4, React ~19.2.5, wagmi 2.19.5,
viem 2.53.1, `@rainbow-me/rainbowkit` 2.2.11 (that's your wallet connect),
`@tanstack/react-query` ~5.100.5.

**Typed contract calls** come from the generated hooks in
`packages/nextjs/hooks/scaffold-eth/` — confirmed to exist:

- `useScaffoldReadContract` — typed reads
- `useScaffoldWriteContract` — typed writes
- `useScaffoldContract`, `useScaffoldEventHistory`,
  `useScaffoldWatchContractEvent`, `useDeployedContractInfo`, `useTransactor`

These are typed off the deployed ABIs, which `yarn deploy` writes into
`packages/nextjs/contracts/`. The loop is: edit `.sol` → `yarn deploy` →
frontend types update. Contract name, function names, and argument types are
all autocompleted and type-checked. That's the payoff over hand-wiring
`@wagmi/cli`.

## One version trap

The scaffold **pins** `wagmi` at 2.19.5 and `viem` at 2.53.1 (exact, no caret).
npm currently has wagmi 3.7.7 and viem 2.56.8. Do not bump wagmi to 3 to
"get current" — wagmi 3 is a breaking major, and the scaffold-eth hooks and
RainbowKit 2.2.11 are built against the wagmi 2 API. Leave the pins alone this
week. Same for Hardhat: the scaffold is on Hardhat 3, which is a different
config format from Hardhat 2 — any Hardhat 2 snippet you find will not drop in.

## Getting it in front of users

`yarn vercel` is in the generated scripts for deploying the frontend. For the
contract, deploy to a testnet by setting the target network in
`packages/nextjs/scaffold.config.ts` and the Hardhat network config, then
`yarn deploy --network <name>`. Use `yarn account:generate` /
`yarn account:import` for the deployer key rather than pasting a private key
into `.env` — Hardhat 3's keystore handles it.

## If an agent needs onchain data later

Don't scrape explorer HTML or hand-decode logs. Point the agent at the
Blockscout MCP server (`https://mcp.blockscout.com/mcp`) for ready-to-consume
transactions, transfers, and balances; use a documented Blockscout/explorer
REST API when application code rather than the agent is the consumer.
