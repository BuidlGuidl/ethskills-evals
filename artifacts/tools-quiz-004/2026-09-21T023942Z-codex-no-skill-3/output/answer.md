# Fastest Full-Stack Ethereum App Setup

Use Scaffold-ETH 2. It is the shortest path to a working full-stack Ethereum app because it already includes:

- a Solidity contract and deploy script
- a React/Next.js frontend
- RainbowKit wallet connect
- Wagmi/Viem typed contract reads and writes
- a local Hardhat chain
- a debug UI for calling the contract immediately

I verified the commands below today against the current npm package. `create-eth@latest` resolves to `2.0.23`, exposes a real `create-eth` binary, and its current Hardhat template includes the `yarn chain`, `yarn deploy`, and `yarn start` scripts.

Sources checked:

- Scaffold-ETH 2 docs: https://docs.scaffoldeth.io/
- Scaffold-ETH 2 site: https://scaffoldeth.io/
- `create-eth` package: https://www.npmjs.com/package/create-eth
- `create-eth` repo: https://github.com/scaffold-eth/create-eth

## Prerequisites

Scaffold-ETH 2 currently requires Node `>=22.10.0`, Yarn, and Git. Check those first:

```bash
node --version
git --version
corepack --version
corepack enable
```

If `node --version` is below `v22.10.0`, install a current Node 22+ release first.

## Create the App

Hardhat is the fastest default choice for a one-contract app:

```bash
npx create-eth@latest my-eth-app -s hardhat
cd my-eth-app
```

## Run Local Development

Open three terminals from `my-eth-app`.

Terminal 1, start the local Ethereum chain:

```bash
yarn chain
```

Terminal 2, deploy the starter Solidity contract:

```bash
yarn deploy
```

Terminal 3, start the React/Next.js app:

```bash
yarn start
```

Then open:

```text
http://localhost:3000
```

The generated app also has a debug contracts page where you can read and write the deployed contract without building UI first:

```text
http://localhost:3000/debug
```

## Where to Edit

- Contract: `packages/hardhat/contracts/YourContract.sol`
- Deploy script: `packages/hardhat/deploy/00_deploy_your_contract.ts`
- Frontend home page: `packages/nextjs/app/page.tsx`
- App/network config: `packages/nextjs/scaffold.config.ts`
- Generated deployed contract ABI/address data: `packages/nextjs/contracts/deployedContracts.ts`

After editing the contract, redeploy:

```bash
yarn deploy
```

The frontend contract data updates from the deployment output, so the typed hooks know about the new ABI.

## Typed Contract Calls in React

The starter contract is named `YourContract` and includes a public `greeting` value plus a `setGreeting(string)` write function.

Use Scaffold-ETH's typed hooks in a client component:

```tsx
"use client";

import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

export function GreetingEditor() {
  const { data: greeting } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "greeting",
  });

  const { writeContractAsync, isMining } = useScaffoldWriteContract({
    contractName: "YourContract",
  });

  return (
    <button
      disabled={isMining}
      onClick={() =>
        writeContractAsync({
          functionName: "setGreeting",
          args: ["Hello users"],
        })
      }
    >
      Current greeting: {greeting ?? "loading"}
    </button>
  );
}
```

## Short Recommendation

Run:

```bash
npx create-eth@latest my-eth-app -s hardhat
cd my-eth-app
yarn chain
```

Then, in separate terminals:

```bash
yarn deploy
```

```bash
yarn start
```

That gets the full stack running locally with a wallet-connect UI and typed contract calls. Replace `YourContract.sol`, redeploy, then build the user-facing React flow.
