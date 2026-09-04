# Fastest setup: Scaffold-ETH 2

Use Scaffold-ETH 2 with Hardhat. It already combines a Solidity workspace and local Hardhat chain with a Next.js/React TypeScript frontend, RainbowKit wallet connection, wagmi/viem, typed contract hooks, ABI export, and contract hot reload.

Prerequisites: Git, Node.js **22.10.0 or newer**, and Yarn. Check them first:

```bash
git --version
node --version
corepack enable
yarn --version
```

Create the app:

```bash
npx create-eth@latest -s hardhat
```

When prompted, enter a project name such as `my-dapp`. The generator installs dependencies. Then run the three services in separate terminals.

Terminal 1 — local Ethereum chain:

```bash
cd my-dapp
yarn chain
```

Terminal 2 — compile and deploy the included example contract:

```bash
cd my-dapp
yarn deploy
```

Terminal 3 — frontend:

```bash
cd my-dapp
yarn start
```

Open <http://localhost:3000>. The scaffold includes wallet connect; on localhost it also provides a burner wallet/faucet workflow for immediate development.

Replace the example with the one contract and UI you need:

- Contract: `packages/hardhat/contracts/YourContract.sol`
- Deployment: `packages/hardhat/deploy/00_deploy_your_contract.ts`
- Frontend pages/components: `packages/nextjs/app/`
- App/network configuration: `packages/nextjs/scaffold.config.ts`

After changing the contract, keep the chain running and rerun:

```bash
yarn deploy
```

That deployment regenerates `packages/nextjs/contracts/deployedContracts.ts`; the ABI is inferred with `as const`, which drives typed contract names, function names, arguments, and return values in the frontend. Use the current hooks:

```tsx
const { data } = useScaffoldReadContract({
  contractName: "YourContract",
  functionName: "purpose",
});

const { writeContractAsync } = useScaffoldWriteContract("YourContract");

await writeContractAsync({
  functionName: "setPurpose",
  args: [newPurpose],
});
```

Import those hooks from `~~/hooks/scaffold-eth`. Do not use the obsolete names `useScaffoldContractRead` or `useScaffoldContractWrite`.

## Verification (2026-08-20)

I checked the live npm registry: `create-eth@latest` resolves to **2.0.23**, publishes the `create-eth` executable, and its live `--help` accepts `-s, --solidity-framework`. I also checked the current official repository: its root scripts include `chain`, `deploy`, and `start`, and it requires Node `>=22.10.0`. The official quickstart documents the same three-terminal workflow: [Scaffold-ETH 2 repository and quickstart](https://github.com/scaffold-eth/scaffold-eth-2), [current root package scripts](https://github.com/scaffold-eth/scaffold-eth-2/blob/main/package.json).

The current package name is **`create-eth`**. Avoid stale commands such as `create-eth-app` or `create-scaffold-eth`.
