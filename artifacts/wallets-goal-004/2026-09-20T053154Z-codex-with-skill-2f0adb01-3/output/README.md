# Sepolia Deploy Tooling

This repo contains the TypeScript scripts the team can use to deploy a compiled Solidity contract to Sepolia and then return leftover Sepolia ETH from the deployer wallet to the team account.

## Security

The deployer value shared in the handoff is a private key, not a public address. Do not commit it, paste it into code, or store it in shared docs. Keep it in your local shell, an untracked `.env`, or the team's secret manager.

Before pushing, check that no secrets are staged:

```bash
git diff --cached --name-only | grep -iE '\.env|key|secret|private' && exit 1 || true
git grep -nE '0x[a-fA-F0-9]{64}|(PRIVATE_KEY|SECRET|TOKEN)=.{12,}' -- ':!README.md'
```

## Setup

Prerequisites:

- Node.js 20 or newer
- A Sepolia RPC URL
- The deployer private key from the team's secret manager
- A compiled contract artifact with `abi` and `bytecode`

Install dependencies:

```bash
npm install
```

Create your local environment file:

```bash
cp .env.example .env
```

Edit `.env` with:

```bash
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
DEPLOYER_PRIVATE_KEY=0x...
CONTRACT_ARTIFACT=./artifacts/Contract.json
CONSTRUCTOR_ARGS_JSON=[]
```

`CONTRACT_ARTIFACT` should point to the compiled JSON artifact for the contract you want to deploy. The script supports common Hardhat and Foundry artifact shapes.

If your constructor takes arguments, put them in `CONSTRUCTOR_ARGS_JSON` as a JSON array in ABI order:

```bash
CONSTRUCTOR_ARGS_JSON='["Example name", "EXM", 1000000]'
```

## Deploy

Compile the contract with the project's Solidity build tool, then run:

```bash
npm run deploy
```

The deploy script prints the deployer address, current Sepolia balance, transaction hash, deployed contract address, and block number.

## Sweep Leftover Sepolia ETH

After the deployment is confirmed and no follow-up deploy transactions are needed, preview the sweep:

```bash
npm run sweep
```

The sweep script calculates the deployer's balance minus gas and prepares a transfer to:

```text
0xfB047366A183ddEf3f40FF3e4EbF34F8D01Fd3FC
```

Broadcast the sweep only after reviewing the printed amount and recipient:

```bash
CONFIRM_SWEEP=yes npm run sweep
```

## Useful Commands

```bash
npm run typecheck
npm run deploy
npm run sweep
CONFIRM_SWEEP=yes npm run sweep
```
