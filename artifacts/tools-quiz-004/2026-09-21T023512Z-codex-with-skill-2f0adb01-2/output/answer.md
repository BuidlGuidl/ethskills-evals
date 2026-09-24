# Fastest path: Scaffold-ETH 2 with Foundry

Use Scaffold-ETH 2. It gives you one Solidity contract, a Next.js/React frontend, RainbowKit wallet connect, wagmi/viem-based typed contract hooks, and an anvil local chain with one scaffold command.

I confirmed during this run on September 21, 2026 that `create-eth@latest` exists on npm as `2.0.23`, exposes `--solidity-framework`, and generates the `yarn chain`, `yarn deploy`, `yarn start`, `yarn ipfs`, and `yarn vercel:yolo` scripts.

## Setup commands

These commands are for macOS, Linux, or WSL2.

```bash
# Check prerequisites. Scaffold-ETH 2 currently requires Node >= 22.10.0 and Git.
node --version
git --version

# Enable Yarn through Corepack. The generated app currently pins Yarn 4.13.0.
corepack enable
corepack prepare yarn@4.13.0 --activate
yarn --version

# Install Foundry if you do not already have forge/anvil.
curl -L https://foundry.paradigm.xyz | bash
export PATH="$PATH:$HOME/.foundry/bin"
foundryup
forge --version
anvil --version

# Confirm the scaffold CLI exists before using it.
npm view create-eth@latest version

# Create the app. When prompted for a project name, enter: eth-week-app
npx create-eth@latest --solidity-framework foundry
cd eth-week-app
```

If the scaffold command was interrupted or you used `--skip-install`, run:

```bash
yarn install
yarn format
```

## Run locally

Terminal 1:

```bash
cd eth-week-app
yarn chain
```

Terminal 2:

```bash
cd eth-week-app
yarn deploy
```

Terminal 3:

```bash
cd eth-week-app
yarn start
```

Open `http://localhost:3000`. The generated `Debug Contracts` page will already read/write the starter contract on the local chain.

## Where to edit

The starter Solidity contract is here:

```text
packages/foundry/contracts/YourContract.sol
```

The deploy script is here:

```text
packages/foundry/script/DeployYourContract.s.sol
```

After changing the contract, run this again:

```bash
yarn deploy
```

That deploy step also regenerates the frontend contract metadata in `packages/nextjs/contracts/deployedContracts.ts`, which is what makes the frontend contract calls typed.

In React, use the generated Scaffold hooks:

```tsx
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
  args: ["hello users"],
});
```

## Put it in front of users

For the fastest public test deployment, use Base Sepolia or Sepolia. Base Sepolia is cheap and already configured in the generated Foundry config.

```bash
cd eth-week-app

# Create a deployer account, then fund the printed address with testnet ETH.
yarn account:generate
```

Edit `packages/nextjs/scaffold.config.ts` and change `targetNetworks` from the local chain to the public testnet you want, for example:

```ts
targetNetworks: [chains.baseSepolia],
```

Then deploy the contract:

```bash
yarn deploy --network baseSepolia
```

For wallet connect in a public app, add your own keys:

```bash
cd packages/nextjs
cp .env.example .env.local
```

Set these in `packages/nextjs/.env.local`:

```bash
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_walletconnect_project_id
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_key_optional_but_recommended
```

Ship the frontend:

```bash
cd ../..
yarn vercel:login
yarn vercel:yolo --prod
```

Alternative IPFS deploy:

```bash
yarn ipfs
```

## What I verified

- `npm view create-eth@latest version` returned `2.0.23`.
- `npx create-eth@latest --help` lists `--solidity-framework`.
- A dry scaffold with `--solidity-framework foundry` generated the expected monorepo and scripts.
- The generated frontend includes RainbowKit, wagmi, viem, and typed Scaffold hooks.
- Foundry's official install path is still `curl -L https://foundry.paradigm.xyz | bash` followed by `foundryup`.

Sources checked:

- Scaffold-ETH 2 docs: https://docs.scaffoldeth.io/
- Scaffold-ETH 2 site: https://scaffoldeth.io/
- npm package: https://www.npmjs.com/package/create-eth
- Foundry install docs: https://getfoundry.sh/getting-started/installation
