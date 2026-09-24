# Toolshed

A lending library for a neighborhood association: members list tools, neighbors borrow them against
a USDC deposit on Base, and late fees come out of the deposit.

**The full documentation — architecture, deployment, and what a developer has to do to get it
running — is in [the README one directory up](../README.md).**

Quick start (Node ≥ 20.18.3, Yarn, [Foundry](https://getfoundry.sh)):

```bash
yarn install
yarn chain      # terminal 1 — local chain
yarn deploy     # terminal 2 — MockUSDC + Toolshed
yarn seed       # terminal 2 — demo tools, members and loans
yarn start      # terminal 3 — http://localhost:3000
```

| Command | What it does |
|---|---|
| `yarn test` | The Foundry test suite (unit + fuzz) |
| `yarn seed` | Populates a local shed with tools, neighbors and loans |
| `yarn member <address>` | Adds an address to the local member roll with test USDC and gas |
| `yarn deploy --network base` | Deploys to Base (needs `STEWARD_ADDRESS` in `packages/foundry/.env`) |
| `yarn verify --network base` | Verifies the source on Basescan |
| `yarn vercel` / `yarn ipfs` | Publishes the frontend |

This project is built on [Scaffold-ETH 2](https://scaffoldeth.io); `AGENTS.md` documents the
framework's own conventions.
