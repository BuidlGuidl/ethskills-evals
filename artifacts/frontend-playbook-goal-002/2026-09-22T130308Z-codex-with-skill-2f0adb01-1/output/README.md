# Base USDC Tip Jar

A local-only USDC tip jar for Base. The Solidity contract stores the USDC token address it accepts, emits every tip into an onchain feed, and lets the owner withdraw collected tips. The local development flow deploys a mock USDC token so you can run the whole app without sending real funds or deploying anywhere.

Base USDC mainnet address: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

## What is included

- `contracts/TipJar.sol`: accepts USDC via `transferFrom`, records total tips, emits `Tip` events, and supports owner withdrawals.
- `contracts/MockUSDC.sol`: local ERC-20 with 6 decimals and a mint helper for testing.
- `scripts/deploy.js`: deploys mock USDC plus the tip jar on localhost, and writes addresses to `src/deployments/localhost.json`.
- `src/main.jsx`: wallet connection, local network switching, USDC approval, tip submission, mock USDC minting, and live event feed.

## Local setup

Install dependencies:

```bash
npm install
```

If your machine has a locked global npm cache, use a project-local cache instead:

```bash
npm install --cache .npm-cache
```

Compile and test the contracts:

```bash
npm run compile
npm test
```

Start a local Hardhat chain in one terminal:

```bash
npm run node
```

Deploy the local contracts in a second terminal:

```bash
npm run deploy:local
```

Start the web app:

```bash
npm run dev
```

Open the Vite URL, usually `http://127.0.0.1:5173`.

## Wallet setup

Use an injected browser wallet such as MetaMask or Rabby.

The app will try to add or switch to the local Hardhat network:

- Network name: `Hardhat Localhost`
- RPC URL: `http://127.0.0.1:8545`
- Chain ID: `31337`
- Currency symbol: `ETH`

Import one of the private keys printed by `npm run node` into your wallet so you have local ETH for gas. After connecting, click **Get test USDC** in the app to mint local USDC to your connected account.

## Sending a tip locally

1. Keep `npm run node` running.
2. Run `npm run deploy:local` after starting the node, or any time you restart the node.
3. Run `npm run dev`.
4. Connect your wallet.
5. Click **Get test USDC**.
6. Enter an amount and message.
7. Submit the form and confirm both transactions: USDC approval, then the tip.

The feed is built from `Tip` events emitted by the local contract.

## Notes

The deploy script uses the real Base USDC address when run against chain ID `8453`, but this project intentionally does not deploy to Base. For the requested local deliverable, localhost uses `MockUSDC` and writes those addresses into `src/deployments/localhost.json`.
