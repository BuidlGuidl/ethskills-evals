# Base USDC Tip Jar

A local-only USDC tip jar for Base. The Solidity contract accepts tips in Base USDC at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, records each tip, emits a feed event, and forwards the USDC to the configured beneficiary. The React app connects a browser wallet, approves USDC, sends tips, and reads the feed from the local chain.

This project is not deployed anywhere.

## Requirements

- Node.js 18+
- npm
- MetaMask or another injected browser wallet

## Run Locally

Install dependencies:

```bash
npm install
```

Start everything in one terminal:

```bash
npm run dev
```

The script starts a Hardhat node unless a local JSON-RPC is already listening on `127.0.0.1:8545`. It then deploys the tip jar, installs a mock USDC contract at the real Base USDC address on the local chain, mints local test USDC, and opens the Vite dev server. The default URL is:

```text
http://127.0.0.1:5173
```

If that port is busy, Vite prints the next available local URL.

## Manual Local Setup

You can also run each process yourself.

Terminal 1:

```bash
npm run chain
```

Terminal 2:

```bash
npm run deploy:local
```

Terminal 3:

```bash
npm run dev:web
```

## Wallet Setup

Add or switch to the local Hardhat network:

- RPC URL: `http://127.0.0.1:8545`
- Chain ID: `31337`
- Currency symbol: `ETH`

Import one of the private keys printed by `npm run chain`. The deploy script mints `1000` mock USDC to the first five Hardhat accounts at the Base USDC address, so those accounts can send tips immediately.

## Useful Commands

```bash
npm run compile
npm test
npm run deploy:local
```

Rerun `npm run deploy:local` any time you restart the Hardhat node. It rewrites `frontend/src/contracts/tipJar.json` with the latest local contract address and ABI.

## Contract Notes

- `contracts/TipJar.sol` hardcodes Base USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.
- `tip(amount, message)` pulls USDC with `transferFrom`, forwards it to the beneficiary, stores the tip, and emits `Tipped`.
- `getRecentTips(limit)` returns the newest tips first for the feed.
- `contracts/MockUSDC.sol` is only used locally. `scripts/deploy-local.js` installs it at the Base USDC address when localhost has no code there.
