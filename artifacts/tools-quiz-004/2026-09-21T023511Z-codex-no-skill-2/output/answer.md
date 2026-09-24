# Fastest path: Scaffold-ETH 2

Use Scaffold-ETH 2 with the Hardhat Solidity framework. It gives you one starter Solidity contract, a Next/React frontend, RainbowKit wallet connect, Wagmi/Viem contract calls, a local Hardhat chain, deploy scripts, and generated typed contract metadata.

I confirmed on September 21, 2026 that `create-eth@latest` exists on npm and resolves to `create-eth@2.0.23`. I also ran a dry scaffold with `npx create-eth@2.0.23 se2-command-check-0921 --skip-install -s hardhat`, and the generated project contains the root scripts `yarn chain`, `yarn deploy`, and `yarn start`.

## Setup commands

```bash
# Prereqs: Node >= 22.10.0, Git, and Yarn.
node --version
git --version
corepack enable
yarn --version

# Create the app. Replace my-eth-app with your project name.
npx create-eth@2.0.23 my-eth-app -s hardhat
cd my-eth-app
```

Run these in three terminals:

```bash
# Terminal 1: local Ethereum chain at http://127.0.0.1:8545
yarn chain
```

```bash
# Terminal 2: compile, deploy, and regenerate frontend contract typings
yarn deploy
```

```bash
# Terminal 3: React/Next frontend at http://localhost:3000
yarn start
```

## Where to build

Edit the contract here:

```text
packages/hardhat/contracts/YourContract.sol
```

Edit the deploy args here:

```text
packages/hardhat/deploy/00_deploy_your_contract.ts
```

Edit the React app here:

```text
packages/nextjs/app/page.tsx
```

After every contract or deploy-script change, run:

```bash
yarn deploy
```

That deploy task updates:

```text
packages/nextjs/contracts/deployedContracts.ts
```

The Scaffold-ETH hooks derive their TypeScript contract names, function names, args, and return types from that generated file.

## Minimal typed read/write example

Drop this pattern into a client component such as `packages/nextjs/app/page.tsx`:

```tsx
"use client";

import type { NextPage } from "next";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

const Home: NextPage = () => {
  const { data: greeting } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "greeting",
  });

  const { writeContractAsync, isMining } = useScaffoldWriteContract({
    contractName: "YourContract",
  });

  return (
    <main>
      <p>{greeting}</p>
      <button
        disabled={isMining}
        onClick={() =>
          writeContractAsync({
            functionName: "setGreeting",
            args: ["Hello, users"],
          })
        }
      >
        Set greeting
      </button>
    </main>
  );
};

export default Home;
```

## Why this is the fastest

You avoid wiring the boring-but-fragile parts yourself: chain config, deploy artifacts, ABI export, wallet UI, generated contract typing, block explorer/debug pages, and local faucet/burner-wallet development. Start from the generated `YourContract`, replace it with your app contract, rerun `yarn deploy`, then build the user flow in `packages/nextjs/app/page.tsx`.

Sources checked:

- Scaffold-ETH docs: https://docs.scaffoldeth.io
- `create-eth` npm package: https://www.npmjs.com/package/create-eth
- Generated package check: `create-eth@2.0.23`, Hardhat flavor, verified locally with `--skip-install`
