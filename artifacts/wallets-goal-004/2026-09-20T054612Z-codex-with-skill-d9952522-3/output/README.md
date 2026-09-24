# Sepolia Deploy Tools

TypeScript deploy and sweep scripts for shipping a Solidity contract to Sepolia with `viem`.

## Security note

The deployer private key that was shared in the original task text must be treated as exposed. Do not commit it, paste it into docs, or reuse it as the long-lived deployer. Rotate to a fresh Sepolia-only deployer key, fund that fresh account with just enough Sepolia ETH for the deployment, and put the key only in your local `.env`.

The sweep script sends leftover Sepolia ETH to the team account:

```text
0xfB047366A183ddEf3f40FF3e4EbF34F8D01Fd3FC
```

## Prerequisites

- Node.js 20 or newer.
- A Sepolia RPC URL from your preferred provider.
- A compiled contract artifact JSON from Foundry or Hardhat that contains `abi` and deployable `bytecode`.
- A fresh Sepolia deployer private key funded with the ETH needed for deployment.

## Setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Create a local environment file:

   ```sh
   cp .env.example .env
   ```

3. Fill in `.env`:

   ```sh
   SEPOLIA_RPC_URL=https://sepolia.example
   DEPLOYER_PRIVATE_KEY=0x...
   CONTRACT_ARTIFACT=./artifacts/YourContract.json
   CONSTRUCTOR_ARGS=[]
   ```

   `CONSTRUCTOR_ARGS` must be a JSON array in Solidity constructor order. Examples:

   ```sh
   CONSTRUCTOR_ARGS=[]
   CONSTRUCTOR_ARGS='["Example", "EXM", "0xfB047366A183ddEf3f40FF3e4EbF34F8D01Fd3FC"]'
   ```

## Before publishing

Publish from a fresh commit that contains only the deploy tooling files. Do not push inherited task notes or git history that contained the exposed private key.

## Deploy

1. Compile the contract in the project that owns the Solidity source.
2. Copy the generated artifact into this repo, or point `CONTRACT_ARTIFACT` at the artifact path.
3. Check the scripts compile:

   ```sh
   npm run typecheck
   ```

4. Deploy to Sepolia:

   ```sh
   npm run deploy
   ```

The deploy script verifies that the RPC is Sepolia, sends the deployment transaction, waits for the receipt, and prints the deployed contract address.

## Sweep leftover Sepolia ETH

After the deploy transaction is final and the deployed address has been recorded, sweep the deployer's leftover balance:

```sh
npm run sweep
```

The script prints the checksummed source, team destination, current balance, live gas price, estimated gas cost, and amount to send. It will not broadcast until a human types `SWEEP`.

## Files

- `deploy.ts`: deploys an artifact-backed contract to Sepolia with `viem`.
- `sweep.ts`: sends the deployer balance minus gas to the team account.
- `.env.example`: documents required local environment variables without committing secrets.
