# Sepolia Deploy Tooling

This repo contains the handoff scripts for deploying a compiled Solidity contract to Sepolia and sweeping the deployer's leftover Sepolia ETH back to the team account.

## Prerequisites

- Node.js 20 or newer
- A Sepolia RPC URL from Alchemy, Infura, QuickNode, or another provider
- The deployer private key, shared through the team's secret manager
- A compiled contract artifact from Forge or Hardhat

Never commit private keys, `.env` files, or funded wallet secrets. The deployer key belongs in `.env` only.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local environment file:

   ```bash
   cp .env.example .env
   ```

3. Edit `.env`:

   ```bash
   SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
   DEPLOYER_PRIVATE_KEY=0x...
   CONTRACT_ARTIFACT=./out/MyContract.sol/MyContract.json
   CONTRACT_CONSTRUCTOR_ARGS=[]
   ```

   `CONTRACT_ARTIFACT` can point at either a Forge artifact such as `out/MyContract.sol/MyContract.json` or a Hardhat artifact such as `artifacts/contracts/MyContract.sol/MyContract.json`.

4. If the contract constructor takes arguments, set `CONTRACT_CONSTRUCTOR_ARGS` to a JSON array:

   ```bash
   CONTRACT_CONSTRUCTOR_ARGS=["Example name",42,"0xfB047366A183ddEf3f40FF3e4EbF34F8D01Fd3FC"]
   ```

## Deploy

Run a typecheck first:

```bash
npm run typecheck
```

Deploy to Sepolia:

```bash
npm run deploy
```

The deploy script prints the deployer address, transaction hash, deployed contract address, and Sepolia Etherscan link.

You can also pass the artifact path directly:

```bash
npm run deploy -- ./out/MyContract.sol/MyContract.json
```

## Sweep Leftover Sepolia ETH

After the deployment is confirmed and no more deployer transactions are needed, dry-run the sweep:

```bash
npm run sweep:dry
```

Then send the remaining deployer balance, minus transaction gas, to the team account:

```bash
npm run sweep
```

By default, `sweep.ts` sends funds to:

```text
0xfB047366A183ddEf3f40FF3e4EbF34F8D01Fd3FC
```

To override the destination for a one-off run, set `SWEEP_TO` in `.env` or the shell.

## Security Checklist Before Pushing

- `.env` is not tracked
- `DEPLOYER_PRIVATE_KEY` is not in any committed file
- The deployer account still has enough Sepolia ETH for deployment gas
- The deployment artifact path points at the exact contract release artifact
- Constructor args are reviewed by another teammate
