# Sepolia deploy tooling

Small viem-based scripts for deploying a compiled Solidity contract to Sepolia and sweeping the deployer wallet's remaining Sepolia ETH back to the team account.

## Prerequisites

- Node.js 20 or newer
- A Sepolia RPC URL from Alchemy, Infura, QuickNode, or another provider
- The deployer private key stored locally, never committed
- A compiled contract artifact JSON that includes `abi` and `bytecode`

The sweep destination is hardcoded to the team account:

```text
0xfB047366A183ddEf3f40FF3e4EbF34F8D01Fd3FC
```

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local environment file:

   ```bash
   cp .env.example .env
   ```

3. Fill in `.env`:

   ```bash
   SEPOLIA_RPC_URL=https://sepolia-rpc.example
   DEPLOYER_PRIVATE_KEY=0x...
   CONTRACT_ARTIFACT=./out/MyContract.sol/MyContract.json
   CONSTRUCTOR_ARGS=[]
   ```

   Do not commit `.env` or paste the private key into source files, docs, pull requests, issues, or chat logs. If the key is ever committed, treat it as compromised and move the funds to a new wallet.

4. Compile the contract with your normal Solidity toolchain.

   For Foundry, the artifact path usually looks like:

   ```bash
   forge build
   CONTRACT_ARTIFACT=./out/MyContract.sol/MyContract.json
   ```

   For Hardhat, the artifact path usually looks like:

   ```bash
   npx hardhat compile
   CONTRACT_ARTIFACT=./artifacts/contracts/MyContract.sol/MyContract.json
   ```

5. Type-check the scripts:

   ```bash
   npm run typecheck
   ```

## Deploy

Deploy using the artifact and constructor args from `.env`:

```bash
npm run deploy
```

You can also pass the artifact path and constructor args directly:

```bash
npm run deploy -- ./out/MyContract.sol/MyContract.json '["arg1",123,"0x0000000000000000000000000000000000000000"]'
```

The script prints the deployer address, transaction hash, deployed contract address, and block number.

## Sweep leftover Sepolia ETH

Preview the sweep first:

```bash
npm run sweep -- --dry-run
```

Send the sweep transaction:

```bash
npm run sweep
```

The script prints the amount, source, destination, and estimated fee reserve, then asks you to type `sweep` before broadcasting. For non-interactive use:

```bash
npm run sweep -- --yes
```

Because EIP-1559 fees are reserved using `maxFeePerGas`, a tiny amount of Sepolia ETH may remain after confirmation if the actual fee is lower than the max fee.

## Git safety checklist

Before pushing:

```bash
git status --short
git diff --cached --name-only | grep -iE '\.env|key|secret|private' && exit 1 || true
rg -n --hidden -g '!node_modules/**' -g '!.git/**' -g '!.agents/**' -g '!package-lock.json' -e '0x[a-fA-F0-9]{64}|g\.alchemy\.com/v2/[A-Za-z0-9]|infura\.io/v3/[A-Za-z0-9]' .
git log --all -p -- . ':!.agents/**' | rg -n '0x[a-fA-F0-9]{64}|g\.alchemy\.com/v2/[A-Za-z0-9]|infura\.io/v3/[A-Za-z0-9]'
```

No private key, RPC URL with an embedded API key, or local `.env` file should appear in Git. If the history scan returns a match, do not push that history; rewrite it or create a fresh repository from the clean working tree.
