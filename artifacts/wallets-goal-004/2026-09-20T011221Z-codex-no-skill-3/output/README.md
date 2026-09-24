# Sepolia deploy tooling

This repo contains the team deploy scripts for shipping a Solidity contract to Sepolia with viem.

The deployer private key is intentionally not committed. Store it in a local `.env` file or your team secret manager only.

## Prerequisites

- Node.js 20 or newer
- A Sepolia RPC URL from Alchemy, Infura, QuickNode, or another provider
- The deployer private key funded with Sepolia ETH

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env`:

```bash
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
DEPLOYER_PRIVATE_KEY=0x...
CONTRACT_PATH=contracts/TeamContract.sol
CONTRACT_NAME=TeamContract
CONSTRUCTOR_ARGS=["Sepolia Team Contract"]
TEAM_ACCOUNT=0xfB047366A183ddEf3f40FF3e4EbF34F8D01Fd3FC
```

`contracts/TeamContract.sol` is a runnable sample so the deploy flow can be tested from a fresh clone. Replace it with the production contract or update `CONTRACT_PATH`, `CONTRACT_NAME`, and `CONSTRUCTOR_ARGS` before the real deploy.

## Deploy

Run a TypeScript check first:

```bash
npm run typecheck
```

Deploy to Sepolia:

```bash
npm run deploy
```

The deploy script will:

- compile `CONTRACT_PATH` with `solc`
- deploy `CONTRACT_NAME` to Sepolia using viem
- print the transaction hash and deployed address
- write deployment metadata to `deployments/sepolia.json`

Commit `deployments/sepolia.json` after the production deploy so the team has the deployed address in repo history.

## Sweep leftover Sepolia ETH

After the contract deploy is confirmed and any verification work is complete, return the deployer's leftover Sepolia ETH to the team account:

```bash
npm run sweep
```

By default this sends to:

```text
0xfB047366A183ddEf3f40FF3e4EbF34F8D01Fd3FC
```

Override `TEAM_ACCOUNT` in `.env` only if the team account changes.

## Safety checklist

- Never commit `.env` or a private key.
- Confirm the RPC URL is for Sepolia, not mainnet.
- Confirm `CONSTRUCTOR_ARGS` is valid JSON and matches the production constructor exactly.
- Confirm the deployed address printed by `npm run deploy` matches `deployments/sepolia.json`.
- Sweep only after no more deployer-funded Sepolia transactions are needed.
