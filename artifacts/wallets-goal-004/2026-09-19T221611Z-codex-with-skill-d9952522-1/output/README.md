# Sepolia Deploy Tooling

This repo contains two viem scripts:

- `deploy.ts` deploys a compiled Solidity contract to Sepolia and prints the deployed address.
- `sweep.ts` sends the deployer's remaining Sepolia ETH to the team account: `0xfB047366A183ddEf3f40FF3e4EbF34F8D01Fd3FC`.

## Security Note

Do not commit private keys, `.env` files, keystores, RPC credentials, or filled-in examples. The deployer private key that was shared in the original request should be treated as compromised because it passed through chat. Use a fresh deployer for shared team workflows, and only use the old key long enough to recover testnet funds if the team decides that is acceptable.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

3. Fill in `.env`:

   ```bash
   SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
   DEPLOYER_PRIVATE_KEY=0x...
   CONTRACT_ARTIFACT=artifacts/contracts/MyContract.sol/MyContract.json
   CONSTRUCTOR_ARGS=[]
   TEAM_ACCOUNT=0xfB047366A183ddEf3f40FF3e4EbF34F8D01Fd3FC
   SWEEP_RESERVE_WEI=0
   ```

   `DEPLOYER_PRIVATE_KEY` must be the key for the Sepolia account that will pay deployment gas. `TEAM_ACCOUNT` is optional unless the destination changes.

## Contract Artifact

Compile the contract with your normal Solidity toolchain, then point `CONTRACT_ARTIFACT` at the generated JSON artifact. The artifact must include deployable `bytecode` and should include `abi`.

Common examples:

```bash
# Hardhat
CONTRACT_ARTIFACT=artifacts/contracts/MyContract.sol/MyContract.json

# Foundry
CONTRACT_ARTIFACT=out/MyContract.sol/MyContract.json
```

If no artifact is available, you can instead set:

```bash
CONTRACT_BYTECODE=0x...
CONTRACT_ABI='[]'
```

Constructor arguments go in `CONSTRUCTOR_ARGS` as a JSON array, in Solidity constructor order:

```bash
CONSTRUCTOR_ARGS='["0xfB047366A183ddEf3f40FF3e4EbF34F8D01Fd3FC", 1000]'
```

## Deploy

Run:

```bash
npm run deploy
```

The script prints the network, deployer address, deployer balance, transaction hash, and deployed contract address.

## Sweep Leftover Sepolia ETH

After the deployment is confirmed, run:

```bash
npm run sweep
```

Before sending funds, the script prints the sender, recipient, current balance, gas limit, gas price, gas cost, reserve, and amount to send. It will not broadcast until you type:

```text
SWEEP
```

This sends the deployer's remaining balance, minus gas and `SWEEP_RESERVE_WEI`, to the team account.

## Pre-Push Check

Run:

```bash
npm run typecheck
```

Confirm that `.env` is still ignored:

```bash
git status --short
```
