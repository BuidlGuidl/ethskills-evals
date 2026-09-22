# Base USDC Tip Jar

A local-first dApp with a Solidity tip jar contract and a React wallet UI. The contract accepts ERC-20 USDC-style tips, emits feed events, and lets the owner withdraw collected funds to a beneficiary.

Base mainnet USDC is:

```text
0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

For local development, the project deploys `MockUSDC` with 6 decimals and points the tip jar at that mock token. No deployment is performed by this repo.

## Requirements

- Node.js 18+
- npm 10+
- A browser wallet such as MetaMask or Rabby

## Install

```bash
npm install
```

## Run Locally

Open three terminals.

Terminal 1: start the local chain.

```bash
npm run chain
```

Terminal 2: deploy the mock USDC and tip jar to the local chain.

```bash
npm run deploy:local
```

The deploy script writes `frontend/src/deployments/local.json`, which the web app uses for addresses and ABIs.

Terminal 3: start the frontend.

```bash
npm run dev
```

Open the Vite URL, usually `http://127.0.0.1:5173`.

## Wallet Setup

Add or switch to the local Hardhat network:

- RPC URL: `http://127.0.0.1:8545`
- Chain ID: `31337`
- Currency symbol: `ETH`

Import one of the private keys printed by `npm run chain` into your wallet. Hardhat accounts are funded with local ETH for gas.

In the app:

1. Connect your wallet.
2. Use the faucet button to mint local mock USDC.
3. Enter a tip amount, name, and message.
4. Submit the form. If needed, the UI first sends an approval transaction, then sends the tip.
5. The feed refreshes from the `TipSent` events emitted by the contract.

## Contract Notes

- `contracts/USDCTipJar.sol` accepts any ERC-20 address in the constructor.
- `contracts/MockUSDC.sol` is local-only and uses 6 decimals like USDC.
- To deploy this contract to Base later, pass Base USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) as the `usdc_` constructor argument.
- The owner can call `withdraw(0)` to withdraw the full token balance to the beneficiary.

## Useful Commands

```bash
npm test
npm run build
```

This project intentionally does not include a deploy command for Base mainnet. It is set up to run and test locally only.
