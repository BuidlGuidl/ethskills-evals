# USDC Tip Jar for Base

A local Scaffold-ETH 2 project with a Foundry contract and Next.js frontend for sending USDC tips on a Base mainnet fork.

The contract uses Base USDC at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, stores every tip onchain, and keeps the tipped USDC in the jar until the owner withdraws it.

## Prerequisites

- Node.js `>=20.18.3`
- Yarn via Corepack
- Foundry (`forge`, `anvil`, `cast`)

## Setup

```bash
cd usdc-tip-jar
corepack enable
yarn install
```

## Run Locally

Use three terminals.

Terminal 1: start a local Base fork on chain ID `31337`.

```bash
yarn fork:base
```

Terminal 2: deploy the tip jar to the local fork and generate the frontend contract ABI/address.

```bash
yarn deploy
```

Seed a wallet with forked Base USDC. By default this funds Anvil account #0:

```bash
yarn seed:usdc
```

To fund a wallet shown in the app instead:

```bash
yarn seed:usdc <wallet-address> 1000
```

Terminal 3: start the web app.

```bash
yarn start
```

Open `http://localhost:3000`.

## Wallet Notes

The frontend targets the local Anvil fork, not live Base.

- RPC URL: `http://127.0.0.1:8545`
- Chain ID: `31337`
- Currency symbol: `ETH`

You can use the burner wallet shown by the app, or import Anvil account #0 into a browser wallet:

```text
Address:     0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266
Private key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

If you use a burner wallet, copy its address from the app and run `yarn seed:usdc <that-address> 1000`.

## Contracts

- `packages/foundry/contracts/USDCTipJar.sol`
- `packages/foundry/script/DeployUSDCTipJar.s.sol`
- `packages/foundry/test/USDCTipJar.t.sol`

Run tests:

```bash
yarn test
```

## Useful Commands

```bash
yarn compile
yarn test
yarn deploy
yarn seed:usdc <wallet-address> 1000
yarn start
```

No live deployment is required or performed by this project.
