# Fastest full-stack Ethereum app setup

Use Scaffold-ETH 2 with Hardhat. It gives you one starter Solidity contract, a Next/React frontend, RainbowKit wallet connect, Wagmi/Viem typed contract hooks, generated deployed contract metadata, and a local chain workflow.

## Commands

Check prerequisites first:

```bash
node --version   # must be >= 22.10.0 for the Hardhat template
git --version
corepack enable
```

Create the app non-interactively:

```bash
npx create-eth@latest my-eth-app --solidity-framework hardhat
cd my-eth-app
```

Terminal 1, local chain:

```bash
yarn chain
```

Terminal 2, deploy the starter contract:

```bash
cd my-eth-app
yarn deploy
```

Terminal 3, run the frontend:

```bash
cd my-eth-app
yarn start
```

Open:

```text
http://localhost:3000
```

The generated debug UI is at:

```text
http://localhost:3000/debug
```

## Where to work

Edit the starter Solidity contract here:

```text
packages/hardhat/contracts/YourContract.sol
```

Edit the React app here:

```text
packages/nextjs/app/page.tsx
```

After contract changes, rerun:

```bash
yarn deploy
```

The frontend contract metadata is regenerated into:

```text
packages/nextjs/contracts/deployedContracts.ts
```

For typed reads and writes, use the current Scaffold-ETH hooks:

```ts
import {
  useScaffoldReadContract,
  useScaffoldWriteContract,
} from "~~/hooks/scaffold-eth";

const { data } = useScaffoldReadContract({
  contractName: "YourContract",
  functionName: "yourViewFunction",
  args: [],
});

const { writeContractAsync } = useScaffoldWriteContract({
  contractName: "YourContract",
});

await writeContractAsync({
  functionName: "yourWriteFunction",
  args: [],
});
```

## Verification done today

I verified this on 2026-09-20:

- Official Scaffold-ETH docs say the stack is NextJS, RainbowKit, Hardhat or Foundry, Wagmi, Viem, and TypeScript: https://docs.scaffoldeth.io/
- The official `create-eth` README lists `npx create-eth@latest`, `yarn chain`, `yarn deploy`, and `yarn start`: https://github.com/scaffold-eth/create-eth
- `npm view create-eth dist-tags --json` reports `latest` as `2.0.23`.
- `npm view create-eth bin --json` shows the package exposes the `create-eth` binary.
- `npx create-eth@latest --help` succeeds and shows `--solidity-framework`.
- A dry scaffold in `/tmp` with `npx create-eth@latest se2-command-check-20260920-1326 --solidity-framework hardhat --skip-install` completed and printed the same next steps: `yarn chain`, `yarn deploy`, `yarn start`.
- The generated Hardhat template includes root scripts named `chain`, `deploy`, `start`, `compile`, `test`, and `lint`.
