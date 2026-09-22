# Base USDC Tip Jar

A local-only USDC tip jar for Base. The Solidity contract accepts tips using the Base USDC token address:

```text
0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

For local development, the deploy script installs a mock USDC implementation at that exact address on a Hardhat chain, mints test balances, deploys the tip jar, seeds a few tips, and writes the frontend deployment config, including the block where the feed should start reading events.

## Requirements

- Node.js 18+
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

Start the local Hardhat chain in one terminal:

```bash
npm run chain
```

In a second terminal, deploy the local tip jar and mock USDC wiring:

```bash
npm run deploy:local
```

Start the web app:

```bash
npm run dev
```

Open the Vite URL, usually:

```text
http://127.0.0.1:5173
```

## Using The App Locally

1. Connect MetaMask or another injected wallet.
2. Let the app switch to the `Hardhat Local` chain, or add it when prompted.
3. Import one of the Hardhat test accounts into the wallet if you want an account that already has mock USDC.
4. Send a tip. The app approves USDC first when needed, then calls `TipJar.tip`.
5. The feed refreshes automatically and can also be refreshed manually.

Hardhat prints funded private keys when `npm run chain` starts. The deploy script mints `1,000` mock USDC to the first four Hardhat accounts.

## Useful Commands

```bash
npm run compile       # Compile Solidity contracts
npm run chain         # Start local Hardhat JSON-RPC at 127.0.0.1:8545
npm run deploy:local  # Deploy TipJar and configure mock USDC on the local chain
npm run dev           # Start the frontend
npm run build         # Type-check and build the frontend
```

## Contract Notes

- `TipJar` is pinned to Base USDC via `BASE_USDC`.
- Tips emit `Tip(address tipper, uint256 amount, string message, uint256 timestamp)`.
- Messages are capped at `280` bytes.
- The owner can withdraw USDC with `withdraw(address recipient, uint256 amount)`.
- No contract or frontend deployment is performed by this project.
