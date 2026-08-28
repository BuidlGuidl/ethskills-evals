# Fastest path: Scaffold-ETH 2

Use Scaffold-ETH 2. It already combines a Solidity/Hardhat workspace, a React frontend (Next.js), TypeScript, Wagmi/Viem typed contract hooks, RainbowKit wallet connection, ABI/address generation, and a local Hardhat chain. That is substantially faster than wiring these pieces together yourself.

## 1. Prerequisites and scaffold

You need Git, Node.js **22.10.0 or newer**, and Yarn. With a current Node installation:

```bash
node --version
git --version
corepack enable
yarn --version

npx create-eth@latest -s hardhat
```

At the prompt, enter a project name such as `my-dapp` and choose **Yes** when asked to install packages. Then:

```bash
cd my-dapp
```

I verified on 2026-08-20 that `create-eth` exists on npm, that `latest` is version **2.0.23**, and that its CLI currently accepts `-s, --solidity-framework`. The project name remains an interactive prompt; do not append it as an undocumented positional argument.

## 2. Run the local stack

Keep each long-running command in its own terminal, all from `my-dapp`.

Terminal 1 — local Ethereum chain:

```bash
yarn chain
```

Terminal 2 — compile and deploy the sample contract, and export its ABI/address to the frontend:

```bash
yarn deploy
```

Terminal 3 — React/Next.js development server:

```bash
yarn start
```

Open <http://localhost:3000>. The generated app includes RainbowKit wallet connection, a funded local burner wallet/faucet, and a **Debug Contracts** page where the deployed sample contract can immediately be read and written.

These exact commands and requirements are present today in the [official Scaffold-ETH 2 README](https://github.com/scaffold-eth/scaffold-eth-2/blob/main/README.md); the current root scripts are also visible in the [official package.json](https://github.com/scaffold-eth/scaffold-eth-2/blob/main/package.json).

## 3. Replace the sample with your app

- Contract: `packages/hardhat/contracts/YourContract.sol`
- Deployment script: `packages/hardhat/deploy/00_deploy_your_contract.ts`
- Frontend pages/components: `packages/nextjs/app/`
- Frontend/network configuration: `packages/nextjs/scaffold.config.ts`

After changing the contract, leave the chain and frontend running and rerun:

```bash
yarn deploy
```

The deploy process refreshes the frontend's generated contract metadata. In a client component, use Scaffold-ETH's typed wrappers (replace function names and arguments with those in your ABI):

```tsx
"use client";

import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

export const ContractPanel = () => {
  const { data: greeting } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "greeting",
  });

  const { writeContractAsync } = useScaffoldWriteContract("YourContract");

  return (
    <button
      onClick={() =>
        writeContractAsync({
          functionName: "setGreeting",
          args: ["Hello users"],
        })
      }
    >
      {greeting ?? "Set greeting"}
    </button>
  );
};
```

`contractName`, `functionName`, and `args` are inferred from the generated ABI, so TypeScript catches mismatched calls. The generated header already supplies wallet connect; reuse it instead of building connector state from scratch. Scaffold-ETH 2's current stack and typed-hook design are documented in its [official repository guidance](https://github.com/scaffold-eth/scaffold-eth-2/blob/main/AGENTS.md).

Before putting it in front of users, run:

```bash
yarn compile
yarn test
yarn lint
yarn next:check-types
yarn next:build
```

This gets the complete local app running immediately. A public release still requires deploying the contract to a public network and the frontend to a host; do not expose the local Hardhat chain as production infrastructure.
