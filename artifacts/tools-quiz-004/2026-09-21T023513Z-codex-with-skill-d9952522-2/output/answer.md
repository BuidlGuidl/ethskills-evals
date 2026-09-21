# Fastest Full-Stack Ethereum App Setup

Use Scaffold-ETH 2. It gives you a Solidity contract, Hardhat local chain, React/Next frontend, RainbowKit wallet connect, wagmi/viem, and typed Scaffold contract hooks out of the box.

I verified today, 2026-09-21, that `create-eth` exists on npm and that `latest` resolves to `2.0.23`. I also checked `npx create-eth@latest --help` and the published `create-eth@2.0.23` template; the generated root scripts include `yarn chain`, `yarn deploy`, and `yarn start`.

```bash
# Prereqs: Node >= 22.10.0 and Git.
node --version
git --version
corepack enable

# Create the app. This is the current verified create-eth version.
npx create-eth@2.0.23 my-eth-app --solidity-framework hardhat

cd my-eth-app
```

Run these in three terminals:

```bash
# Terminal 1: local Ethereum chain
cd my-eth-app
yarn chain
```

```bash
# Terminal 2: compile and deploy the starter Solidity contract
cd my-eth-app
yarn deploy
```

```bash
# Terminal 3: React/Next frontend
cd my-eth-app
yarn start
```

Open `http://localhost:3000`. The starter contract is at `packages/hardhat/contracts/YourContract.sol`, the frontend starts at `packages/nextjs/app/page.tsx`, and the generated debug UI is at `http://localhost:3000/debug`.

Typed contract reads/writes are already wired through Scaffold hooks. After editing and redeploying `YourContract.sol`, use the generated hooks from `~~/hooks/scaffold-eth`:

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
  args: ["gm"],
});
```

For the fastest loop: edit `YourContract.sol`, keep `yarn chain` running, run `yarn deploy` again, then build the actual UI in `packages/nextjs/app/page.tsx`.
