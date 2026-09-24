# USDC Tip Jar for Base

A local Scaffold-ETH 2 project with:

- `TipJar.sol`, an onchain contract that accepts Base USDC tips through `transferFrom`.
- A Next.js page with wallet connection, USDC balance, approve-and-tip flow, total tipped, and a `TipSent` event feed.
- A Base mainnet fork workflow. Nothing is deployed to a live network.

Base USDC address used by the contract and frontend:

```text
0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

## Requirements

- Node `>=20.18.3` (`fnm use 22` works in this repo)
- Yarn 4, managed by the repo's `.yarn/releases/yarn-4.13.0.cjs`
- Foundry (`forge`, `anvil`, and `cast`)

## Install

```bash
yarn install
```

## Run Locally

Use three terminals.

Terminal 1: start a local Base fork.

```bash
yarn fork:base
```

Terminal 2: deploy the local TipJar contract to the fork and regenerate the frontend ABI/address file.

```bash
yarn deploy --keystore scaffold-eth-default
```

Terminal 3: start the web app.

```bash
yarn start
```

Open http://localhost:3000.

## Fund a Local Wallet With Forked USDC

Connect a wallet in the app, copy its address, then run:

```bash
yarn fund:usdc <wallet-address> 1000
```

The helper only talks to local Anvil. It detects Base USDC's balance storage slot on the fork and sets a demo balance for the address.

You can also import Anvil account 0 into a wallet:

```text
Address:     0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Private key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

## Verify

```bash
yarn foundry:test
yarn next:lint
yarn next:check-types
yarn next:build
```

## Project Notes

- Contract: `packages/foundry/contracts/TipJar.sol`
- Deploy script: `packages/foundry/script/DeployTipJar.s.sol`
- Frontend: `packages/nextjs/app/page.tsx`
- USDC funding helper: `packages/foundry/scripts-js/fundUsdc.js`
- Local deployment map: `packages/nextjs/contracts/deployedContracts.ts`

Restarting Anvil resets local chain state. After restarting `yarn fork:base`, run `yarn deploy --keystore scaffold-eth-default` again.
