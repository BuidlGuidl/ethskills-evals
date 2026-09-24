# Base USDC Tip Jar

A local-first USDC tip jar dApp for Base. It includes:

- `UsdcTipJar`, a Solidity contract that accepts ERC-20 USDC tips, emits a tip feed event, stores tip metadata, and lets the owner withdraw funds.
- `MockUSDC`, a local test token with 6 decimals so the app can run against Hardhat without deploying to Base.
- A Vite + React page with wallet connect, network switching, local USDC minting, tip submission, and a live-readable tip feed.

The Base USDC token address is:

```text
0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

No public deployment is required or performed by this project. The only deployment step below targets a local dev chain.

## Requirements

- Node.js 18+
- npm
- MetaMask or another injected browser wallet

## Local Setup

Install dependencies:

```bash
npm install
```

Compile and test the contracts:

```bash
npm run compile
npm test
```

Start a local Hardhat chain:

```bash
npm run node
```

In a second terminal, deploy the local mock USDC and tip jar:

```bash
npm run deploy:local
```

The deploy script writes `frontend/src/deployed.json` with the local token address, tip jar address, and ABIs used by the web app.

Start the web app:

```bash
npm run dev
```

Open the Vite URL shown in the terminal, usually:

```text
http://127.0.0.1:5173
```

## Using The App Locally

1. Connect your wallet.
2. Switch to the Hardhat Localhost network when prompted.
3. Import one of the private keys printed by `npm run node` into your wallet, or use a wallet account funded on your local chain.
4. Click **Mint Test USDC** to mint 100 local USDC to your connected account.
5. Enter a tip amount and message.
6. Submit the tip. The app approves USDC if needed, sends the tip transaction, and refreshes the feed.

## Contract Notes

`UsdcTipJar` accepts any ERC-20 compatible token address in its constructor. For a real Base deployment, the constructor argument should be the Base USDC address:

```text
0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

This repository intentionally does not include a deployment command for production. The configured `base` network in `hardhat.config.js` exists only to make the intended chain and token address explicit.

## Useful Scripts

```bash
npm run compile      # Compile Solidity contracts
npm test             # Run contract tests
npm run node         # Start local Hardhat JSON-RPC chain
npm run deploy:local # Deploy MockUSDC + UsdcTipJar to localhost
npm run dev          # Run the web app locally
npm run build        # Build the frontend
```
