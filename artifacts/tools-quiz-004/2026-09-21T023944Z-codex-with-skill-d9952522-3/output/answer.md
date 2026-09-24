# Fastest Full-Stack Ethereum Setup

Use Scaffold-ETH 2 with Hardhat. It gives you one Solidity contract, a Next.js/React frontend, typed contract read/write hooks, RainbowKit wallet connect, generated ABIs/types, and a local Hardhat chain with one scaffold command.

I verified on September 21, 2026 that `create-eth@latest` exists on npm and currently resolves to `2.0.23`. I would pin that verified version for this sprint:

```bash
# Prereqs: Node >= 22.10.0, Git, and Yarn.
node --version
git --version
corepack enable
corepack install -g yarn@1.22.22

# Create the app. Pick any directory name you want instead of my-eth-app.
npx create-eth@2.0.23 my-eth-app -s hardhat
cd my-eth-app
```

Run the local dev loop in three terminals:

```bash
# Terminal 1: local Ethereum chain at http://127.0.0.1:8545
yarn chain
```

```bash
# Terminal 2: compile + deploy the starter Solidity contract to the local chain
yarn deploy
```

```bash
# Terminal 3: React/Next.js frontend
yarn start
```

Open:

```text
http://localhost:3000
```

Where to work:

- Solidity contract: `packages/hardhat/contracts/YourContract.sol`
- Deploy script: `packages/hardhat/deploy/00_deploy_your_contract.ts`
- Frontend page/components: `packages/nextjs/app/page.tsx` and `packages/nextjs/components`
- Generated deployed contract data: `packages/nextjs/contracts/deployedContracts.ts`

For typed contract calls in React, use the Scaffold-ETH hooks:

```ts
const { data } = useScaffoldReadContract({
  contractName: "YourContract",
  functionName: "userGreetingCounter",
  args: [address],
});

const { writeContractAsync, isPending } = useScaffoldWriteContract({
  contractName: "YourContract",
});

await writeContractAsync({
  functionName: "setGreeting",
  args: [newGreeting],
});
```

Before sharing with real users, create a WalletConnect project ID and put it in the frontend env file:

```bash
cp packages/nextjs/.env.example packages/nextjs/.env.local
# then set NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID in packages/nextjs/.env.local
```

Verification I performed today:

- `npm view create-eth version bin dist-tags --json` confirmed `create-eth@latest` is `2.0.23` and exposes the `create-eth` binary.
- `npx --yes create-eth@latest --help` confirmed the CLI supports `npx create-eth<@version> ... -s <solidity-framework>`.
- The published `create-eth@2.0.23` package includes the Hardhat template scripts `yarn chain`, `yarn deploy`, and `yarn start`.
- The scaffold template includes RainbowKit wallet connect and typed hooks named `useScaffoldReadContract` and `useScaffoldWriteContract`.
