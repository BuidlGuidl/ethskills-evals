# Fastest setup: Scaffold-ETH 2

Use Scaffold-ETH 2. It already bundles a Solidity contract workspace, a Next.js/React frontend, TypeScript, typed Wagmi/Viem-based contract hooks, RainbowKit wallet connection, and a local Hardhat or Anvil chain. The project currently requires Node `>=22.10.0`, Yarn, and Git. The official repository documents all of these features and the same three-command development workflow below: [Scaffold-ETH 2 README](https://github.com/scaffold-eth/scaffold-eth-2#readme).

I verified on **2026-08-20** that the npm package exists, `create-eth@latest` resolves to **2.0.23**, and its live `--help` accepts the `--solidity-framework` option. Check prerequisites, enable Yarn through Node's Corepack, and launch the interactive generator:

```bash
node --version   # must be v22.10.0 or newer
git --version
corepack enable
yarn --version

npx create-eth@latest --solidity-framework hardhat
```

At the prompts, enter `my-dapp` as the project name and answer **Yes** to installing packages. Then:

```bash
cd my-dapp
```

Open three terminals in that directory and leave the first and third commands running:

```bash
# terminal 1: local Ethereum JSON-RPC chain
yarn chain
```

```bash
# terminal 2: compile/deploy, and generate frontend contract metadata/types
yarn deploy
```

```bash
# terminal 3: React development server
yarn start
```

Open <http://localhost:3000>. The generated app includes a wallet UI (and a burner wallet/faucet for local development) plus a **Debug Contracts** page that can immediately read and write the sample contract.

## Where to make the app yours

- Contract: `packages/hardhat/contracts/YourContract.sol`
- Deployment script: `packages/hardhat/deploy/00_deploy_your_contract.ts`
- Frontend route: `packages/nextjs/app/page.tsx`
- Generated ABI/address/type data: `packages/nextjs/contracts/deployedContracts.ts`

After changing the Solidity contract, rerun:

```bash
yarn deploy
```

That refreshes `deployedContracts.ts`, which is what gives the frontend contract name, function name, and argument autocomplete/type checking. In a client component, use the current hook names shown in the repository's guidance ([official AGENTS.md](https://github.com/scaffold-eth/scaffold-eth-2/blob/main/AGENTS.md#frontend-contract-interaction)):

```tsx
import {
  useScaffoldReadContract,
  useScaffoldWriteContract,
} from "~~/hooks/scaffold-eth";

const { data: greeting } = useScaffoldReadContract({
  contractName: "YourContract",
  functionName: "greeting",
});

const { writeContractAsync } = useScaffoldWriteContract("YourContract");

await writeContractAsync({
  functionName: "setGreeting",
  args: ["Hello users"],
});
```

The exact generated sample functions can change, so use the names in your contract; TypeScript will flag mismatches after `yarn deploy`. For the quickest route this week, keep the default **Hardhat** choice: it avoids requiring a separate Foundry installation while still providing the local chain, deployment, tests, and automatic frontend ABI/type generation.
