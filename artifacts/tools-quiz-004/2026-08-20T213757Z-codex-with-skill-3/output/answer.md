# Fastest setup: Scaffold-ETH 2

Use Scaffold-ETH 2. It supplies the full stack in one scaffold: Solidity with Hardhat or Foundry, a React/Next.js frontend, typed Wagmi/Viem contract hooks, RainbowKit wallet connection, generated contract metadata, hot reload, and a local development chain.

## Prerequisites

Install Git and Node.js **22.10.0 or newer**, then check them:

```bash
git --version
node --version
npm --version
```

Install Yarn if `yarn --version` does not already work:

```bash
npm install --global yarn@1.22.22
yarn --version
```

## Create the app

Run:

```bash
npx create-eth@2.0.23
```

In the prompts:

1. Name the project (for example, `my-dapp`).
2. Choose **Hardhat** for the Solidity framework; it is the shortest path if there is no existing Foundry preference.
3. Do not skip dependency installation.

Then enter the generated directory:

```bash
cd my-dapp
```

`create-eth` is interactive; a project-name positional argument is deliberately not shown because the current CLI help does not document one.

## Run it locally

Keep these three commands running in three terminals, all from `my-dapp`.

Terminal 1 — local Ethereum chain:

```bash
yarn chain
```

Terminal 2 — compile and deploy the included example contract:

```bash
yarn deploy
```

Terminal 3 — frontend:

```bash
yarn start
```

Open <http://localhost:3000>. The generated app is already usable end to end; the **Debug Contracts** page can read and write the deployed example contract immediately.

## Where to make the one-contract app

- Contract: `packages/hardhat/contracts/YourContract.sol`
- Deployment script: `packages/hardhat/deploy/00_deploy_your_contract.ts`
- React pages/components: `packages/nextjs/app/`
- Scaffold configuration: `packages/nextjs/scaffold.config.ts`

After changing the contract, run `yarn deploy` again. Scaffold-ETH 2 regenerates the deployed contract metadata consumed by the frontend. For typed application code, use the generated `useScaffoldReadContract` and `useScaffoldWriteContract` hooks; the contract name and function names are inferred from that metadata, so TypeScript checks the calls. RainbowKit's connect-wallet UI is already wired into the generated frontend.

## Live verification (2026-08-20)

I checked the npm registry and executed the CLI help today:

```text
npm view create-eth@latest version  -> 2.0.23
npx create-eth@latest --help        -> exits successfully; lists --solidity-framework
npm view yarn@latest version        -> 1.22.22
```

The current [`create-eth` npm package](https://www.npmjs.com/package/create-eth) also documents Node >=22.10.0, Git, Yarn, and the same `yarn chain`, `yarn deploy`, and `yarn start` quickstart. Avoid the similarly named `create-eth-app` and `create-scaffold-eth`; they are not the current Scaffold-ETH 2 generator.
