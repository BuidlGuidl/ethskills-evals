# Base USDC Tip Jar

A local-only dApp that accepts USDC tips through an onchain contract and shows an onchain tip feed in the browser. The contract is configured to use Base USDC:

```text
0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

For local development, the deploy script installs a mock ERC-20 at that exact address on the Hardhat chain. Nothing is deployed to Base or any public network.

## What is included

- `contracts/USDCTipJar.sol` accepts USDC tips with a short message, transfers USDC to the recipient, stores feed entries, and emits `TipReceived`.
- `contracts/MockUSDC.sol` is used only on the local Hardhat network so the real Base USDC address has ERC-20 behavior.
- `src/main.tsx` provides wallet connection, local network switching, test USDC minting, approval, tipping, and feed refresh.
- `scripts/deploy-local.ts` deploys the tip jar and writes `src/deployments/localhost.json` for the web app.

## Prerequisites

- Node.js 18 or newer
- npm
- A browser wallet such as MetaMask

## Setup

Install dependencies:

```bash
npm install
```

Compile the contracts:

```bash
npm run compile
```

Run the test suite:

```bash
npm test
```

## Run locally

Start the local Hardhat chain in one terminal:

```bash
npm run dev:chain
```

In a second terminal, deploy the local tip jar and install mock USDC at the Base USDC address:

```bash
npm run deploy:local
```

In a third terminal, start the web app:

```bash
npm run dev:web
```

Open the Vite URL shown in the terminal, usually:

```text
http://127.0.0.1:5173/
```

## Wallet setup

1. Connect your wallet from the web app.
2. Switch to the `Hardhat Local` network when prompted.
3. Import one of Hardhat's local test accounts into your wallet if you need local ETH for gas. Hardhat prints the funded accounts and private keys when `npm run dev:chain` starts.
4. Click `Mint test USDC` in the app to mint local-only mock USDC to the connected wallet.
5. Enter an amount and message, then click `Tip`. The app approves USDC first if needed, sends the tip, and refreshes the feed.

## Important local behavior

- The app uses chain ID `31337` and RPC URL `http://127.0.0.1:8545`.
- The USDC address remains `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` even locally.
- Restarting the Hardhat node resets local chain state. Run `npm run deploy:local` again after every restart.
- This project intentionally does not include a public deployment script or production deployment configuration.
