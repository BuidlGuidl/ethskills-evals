# Fastest path: Scaffold-ETH 2

Use Scaffold-ETH 2. It already combines a Solidity/Hardhat workspace, a local Hardhat chain, a Next.js React/TypeScript frontend, RainbowKit wallet connection, wagmi/viem, and generated contract metadata used for type-safe reads and writes.

## 1. Prerequisites and scaffold

Install Node.js **22.10 or newer** and Git, then run:

```bash
node --version
git --version
corepack enable
npx create-eth@latest -s hardhat
```

At the project-name prompt enter `my-dapp`. The generator installs dependencies. Then:

```bash
cd my-dapp
```

Hardhat is the quickest choice here because it needs no separate Foundry installation. Do not use the old `scaffold-eth/scaffold-eth` repository or the similarly named `create-eth-app`; the maintained generator is `create-eth` for Scaffold-ETH 2.

## 2. Run the full local stack

Keep each of these running in its own terminal, all from `my-dapp`.

Terminal 1 — local Ethereum chain:

```bash
yarn chain
```

Terminal 2 — compile and deploy the included contract, then generate the frontend contract definition:

```bash
yarn deploy
```

Terminal 3 — React/Next.js development server:

```bash
yarn start
```

Open <http://localhost:3000>. The header includes the RainbowKit wallet-connect UI. For zero-configuration local testing, use the included burner wallet and local faucet; a browser wallet can also connect to the local network.

## 3. Replace the example with the one contract

The starter contract is:

```text
packages/hardhat/contracts/YourContract.sol
```

Its deployment script is under:

```text
packages/hardhat/deploy/
```

Keep the Solidity contract name and the name passed to the deployment script in sync. After editing either file, rerun this while `yarn chain` remains active:

```bash
yarn deploy
```

That deployment regenerates `packages/nextjs/contracts/deployedContracts.ts`, which supplies the address and ABI as TypeScript literals. This is what lets the frontend infer valid contract names, function names, arguments, and return values.

## 4. Add typed reads and writes in React

In a client component under `packages/nextjs/app/`, import the current Scaffold-ETH hooks:

```tsx
"use client";

import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

export const ContractControls = () => {
  const { data: greeting } = useScaffoldReadContract({
    contractName: "YourContract",
    functionName: "greeting",
  });

  const { writeContractAsync, isPending } = useScaffoldWriteContract({
    contractName: "YourContract",
  });

  return (
    <div>
      <p>{greeting}</p>
      <button
        disabled={isPending}
        onClick={() =>
          writeContractAsync({
            functionName: "setGreeting",
            args: ["Hello users"],
          })
        }
      >
        Set greeting
      </button>
    </div>
  );
};
```

The sample assumes the contract exposes `greeting()` and `setGreeting(string)`. TypeScript will flag those names or arguments if they do not match the generated ABI. The current hook names are `useScaffoldReadContract` and `useScaffoldWriteContract` (not the older reversed-name APIs found in stale tutorials).

Before shipping, run:

```bash
yarn compile
yarn test
yarn lint
yarn next:check-types
yarn next:build
```

## Verification

Checked on **2026-08-20**:

- The npm registry reports `create-eth@latest` as **2.0.23**, and its live CLI help confirms `-s, --solidity-framework`.
- The maintained repository currently requires Node `>=22.10.0` and defines the root scripts `chain`, `deploy`, `start`, `compile`, `test`, `next:check-types`, and `next:build` in its package manifest.
- Its current documentation confirms that deployment generates `packages/nextjs/contracts/deployedContracts.ts`, and documents the two hook names used above.

Primary sources: [Scaffold-ETH 2 README](https://github.com/scaffold-eth/scaffold-eth-2/blob/main/README.md), [current package manifest](https://github.com/scaffold-eth/scaffold-eth-2/blob/main/package.json), and [current project guidance and typed-hook examples](https://github.com/scaffold-eth/scaffold-eth-2/blob/main/AGENTS.md).
