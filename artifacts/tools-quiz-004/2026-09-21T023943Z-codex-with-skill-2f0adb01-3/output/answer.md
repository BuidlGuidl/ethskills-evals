# Fastest Path: Scaffold-ETH 2

Use Scaffold-ETH 2 with the Foundry flavor. It gives you one Solidity contract, a Next.js/React frontend, RainbowKit wallet connection, wagmi/viem typed contract calls, and a local Anvil chain behind `yarn chain`.

## Exact Setup Commands

Run these from the directory where you want the app folder created:

```bash
node -v
git --version
corepack enable
npx create-eth@latest fullstack-eth-app --solidity-framework foundry
cd fullstack-eth-app
```

Then run these in three terminals:

```bash
# Terminal 1: local Ethereum chain
yarn chain
```

```bash
# Terminal 2: compile and deploy the starter Solidity contract to the local chain
cd fullstack-eth-app
yarn deploy
```

```bash
# Terminal 3: React frontend at http://localhost:3000
cd fullstack-eth-app
yarn start
```

Edit the starter contract here:

```text
packages/foundry/contracts/YourContract.sol
```

Edit the app UI here:

```text
packages/nextjs/app/page.tsx
```

Use the typed Scaffold hooks in the React app:

```ts
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

const { data: greeting } = useScaffoldReadContract({
  contractName: "YourContract",
  functionName: "greeting",
});

const { writeContractAsync } = useScaffoldWriteContract({
  contractName: "YourContract",
});

await writeContractAsync({
  functionName: "setGreeting",
  args: ["gm users"],
});
```

After each Solidity change, run `yarn deploy` again. Scaffold-ETH updates `packages/nextjs/contracts/deployedContracts.ts`, which is what gives the frontend typed contract names, function names, and args.

## What I Confirmed Exists Today

Verified on September 21, 2026:

- `create-eth` exists on npm as version `2.0.23`; its binary is `create-eth`.
- `npx create-eth@latest --help` works and shows `--solidity-framework`.
- `npx create-eth@latest fullstack-eth-app --skip-install --solidity-framework foundry` successfully scaffolds a project non-interactively.
- The generated root `package.json` contains `yarn chain`, `yarn deploy`, `yarn start`, `yarn compile`, `yarn test`, `yarn lint`, and `yarn next:build`.
- The generated Foundry app contains `packages/foundry/contracts/YourContract.sol`.
- The generated frontend contains typed hooks named `useScaffoldReadContract` and `useScaffoldWriteContract`.
- The generated frontend dependency stack includes RainbowKit, wagmi, viem, React, Next.js, and TypeScript.
- `@scaffold-eth/create-eth` does not exist on npm; use the unscoped `create-eth` command above.

Sources checked:

- https://www.npmjs.com/package/create-eth
- https://scaffoldeth.io/
- https://github.com/scaffold-eth/scaffold-eth-2/blob/main/AGENTS.md
