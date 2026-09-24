# USDC Tip Jar for Base

A local Scaffold-ETH 2 dapp with a Foundry contract and Next.js frontend. The `TipJar` contract accepts tips in native Base USDC:

```text
0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

This project is intended to run against a local Anvil fork of Base. Nothing here deploys to Base mainnet.

## What Is Included

- `packages/foundry/contracts/TipJar.sol`: USDC tip jar contract.
- `packages/foundry/script/DeployTipJar.s.sol`: local deployment script using the Base USDC address.
- `packages/foundry/scripts-js/fundUsdc.js`: helper that impersonates a USDC holder on the local fork and funds a test wallet.
- `packages/nextjs/app/page.tsx`: connect-wallet flow, tip form, totals, and live tip feed.

## Requirements

- Node.js `>=20.18.3`
- Yarn
- Foundry (`forge`, `cast`, `anvil`)

## Setup

Install dependencies:

```bash
yarn install
```

Start a local Base fork in terminal 1:

```bash
cd packages/foundry
anvil --fork-url https://mainnet.base.org --chain-id 31337 --block-time 1
```

Deploy the local `TipJar` contract in terminal 2:

```bash
cd packages/foundry
forge script script/Deploy.s.sol \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast \
  --ffi \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
node scripts-js/generateTsAbis.js
```

Start the frontend in terminal 3:

```bash
yarn start
```

Open `http://localhost:3000`.

## Sending a Local Tip

1. Connect a wallet in the app.
2. Make sure the wallet is on the local Foundry network, chain ID `31337`.
3. Fund the connected address with forked Base USDC:

```bash
yarn fund:usdc <connected-wallet-address> 100
```

4. Use the form to approve and send a USDC tip.

The tip feed reads `TipReceived` events from the local contract. A fresh Anvil fork has no persistent history; restart the fork and redeploy if you want a clean slate.

## Checks

```bash
yarn foundry:test
yarn foundry:compile
yarn next:check-types
yarn next:build
```

`yarn next:build` may show formatting warnings from untouched Scaffold-ETH template files, but the build should complete successfully.
