# Fastest Path: Scaffold-ETH 2

Use Scaffold-ETH 2 with its Hardhat template. It gives you one Solidity contract, a Next/React frontend, RainbowKit wallet connect, wagmi/viem contract calls with TypeScript autocomplete, deployment artifacts wired into the frontend, and a local chain.

I verified these commands and packages on 2026-09-20: `create-eth@latest` exists on npm as `2.0.23`, exposes a `create-eth` binary, accepts a project name plus `-s hardhat`, and the generated template contains the `yarn chain`, `yarn deploy`, and `yarn start` scripts. The official Scaffold-ETH docs also list the same quickstart flow: https://docs.scaffoldeth.io/ and https://github.com/scaffold-eth/scaffold-eth-2

## Setup

Prereqs: Node `>=22.10.0` and Git.

```bash
node --version
git --version
corepack enable

npx create-eth@latest my-dapp -s hardhat
cd my-dapp
```

Then run these in three terminals:

```bash
# Terminal 1: local Ethereum chain
yarn chain
```

```bash
# Terminal 2: deploy the starter contract to the local chain
yarn deploy
```

```bash
# Terminal 3: React/Next frontend
yarn start
```

Open http://localhost:3000.

## Where To Edit

The starter Solidity contract is here:

```text
packages/hardhat/contracts/YourContract.sol
```

The local deploy script is here:

```text
packages/hardhat/deploy/00_deploy_your_contract.ts
```

The generated frontend contract data lands here after `yarn deploy`:

```text
packages/nextjs/contracts/deployedContracts.ts
```

Use Scaffold-ETH hooks for typed frontend calls:

```tsx
const { data: greeting } = useScaffoldReadContract({
  contractName: "YourContract",
  functionName: "greeting",
});

const { writeContractAsync } = useScaffoldWriteContract({
  contractName: "YourContract",
});

await writeContractAsync({
  functionName: "setGreeting",
  args: ["Hello users"],
});
```

After changing Solidity, rerun:

```bash
yarn deploy
```

The frontend will use the regenerated ABI/address data.
