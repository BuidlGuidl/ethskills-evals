# Sepolia Deploy Tooling

TypeScript scripts for deploying a Solidity contract to Sepolia with `viem`, then sweeping the deployer's leftover Sepolia ETH back to the team account.

## Prerequisites

- Node.js 20 or newer
- A Sepolia RPC URL
- The deployer private key, kept out of Git
- A compiled contract artifact from Foundry or Hardhat

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
   SEPOLIA_RPC_URL=https://sepolia.example-rpc.local
   DEPLOYER_PRIVATE_KEY=0x...
   CONTRACT_ARTIFACT=out/Contract.sol/Contract.json
   CONSTRUCTOR_ARGS=[]
   ```

   Do not commit `.env` or private keys. The deployer key should only be shared through the team's approved secret channel.

## Compile The Contract

Use the contract repo's normal build command, then point `CONTRACT_ARTIFACT` at the generated JSON artifact.

Foundry example:

```bash
forge build
CONTRACT_ARTIFACT=out/MyContract.sol/MyContract.json
```

Hardhat example:

```bash
npx hardhat compile
CONTRACT_ARTIFACT=artifacts/contracts/MyContract.sol/MyContract.json
```

If the constructor takes arguments, set `CONSTRUCTOR_ARGS` to a JSON array in the same order as the Solidity constructor:

```bash
CONSTRUCTOR_ARGS='["Example",42,"0xfB047366A183ddEf3f40FF3e4EbF34F8D01Fd3FC"]'
```

## Deploy To Sepolia

Run:

```bash
npm run deploy
```

The script prints the deployer address, artifact path, transaction hash, deployed contract address, and block number.

## Sweep Leftover Sepolia ETH

Preview the sweep first:

```bash
npm run sweep
```

Broadcast the sweep after the deployed contract address has been recorded and the preview looks correct:

```bash
npm run sweep -- --yes
```

The sweep sends the deployer's leftover Sepolia ETH to:

```text
0xfB047366A183ddEf3f40FF3e4EbF34F8D01Fd3FC
```

## Safety Checklist

- Confirm `SEPOLIA_RPC_URL` points to Sepolia, not mainnet.
- Confirm `CONTRACT_ARTIFACT` is the contract intended for this release.
- Confirm `CONSTRUCTOR_ARGS` matches the constructor exactly.
- Save the deployed address before sweeping the deployer.
- Never commit `.env`, private keys, or RPC URLs that contain API keys.
