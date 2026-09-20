# Sepolia Deployment Tools

This repo contains the TypeScript scripts the team can use to deploy a compiled Solidity contract to Sepolia and return leftover Sepolia ETH to the team account.

The deployer private key is intentionally not committed. Put it in `.env` locally when you deploy.

## Prerequisites

- Node.js 20 or newer
- A Sepolia RPC URL from your provider
- The compiled contract artifact from Foundry or Hardhat
- The funded deployer private key from the team secret store

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your local environment file:

   ```bash
   cp .env.example .env
   ```

3. Fill in `.env`:

   ```bash
   SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
   DEPLOYER_PRIVATE_KEY=0x...
   CONTRACT_ARTIFACT_PATH=out/MyContract.sol/MyContract.json
   CONSTRUCTOR_ARGS=[]
   TEAM_ACCOUNT=0xfB047366A183ddEf3f40FF3e4EbF34F8D01Fd3FC
   ```

   `CONSTRUCTOR_ARGS` must be a JSON array. For a constructor like `constructor(address owner, uint256 cap)`, use:

   ```bash
   CONSTRUCTOR_ARGS='["0x1234567890123456789012345678901234567890","1000000000000000000"]'
   ```

## Deploy

Compile the Solidity project first so the artifact exists, then run:

```bash
npm run deploy
```

You can also pass the artifact path directly:

```bash
npm run deploy -- out/MyContract.sol/MyContract.json
```

The script prints:

- the deployer address derived from `DEPLOYER_PRIVATE_KEY`
- the artifact path
- the predicted contract address
- the deployment transaction hash
- the confirmed deployed contract address

Save the deployed contract address in the project docs or release notes after confirmation.

## Sweep Leftover Sepolia ETH

After the deploy is confirmed and no further deployer transactions are needed, sweep the remaining Sepolia ETH back to the team account:

```bash
npm run sweep
```

By default, `sweep.ts` sends funds to:

```text
0xfB047366A183ddEf3f40FF3e4EbF34F8D01Fd3FC
```

Override `TEAM_ACCOUNT` in `.env` only if the team changes the destination.

## Checks

Run the TypeScript checker before pushing changes:

```bash
npm run typecheck
```

## Security Notes

- Never commit `.env` or a real private key.
- Keep the deployer private key in the team secret store.
- Treat the deployer as a temporary funded account and sweep it after deployment.
- This tooling targets Sepolia only. Update the chain and RPC settings deliberately before using it anywhere else.
