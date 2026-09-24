# Sepolia deploy tooling

Compile a Solidity contract, deploy it to Sepolia with [viem](https://viem.sh), and sweep
leftover Sepolia ETH back to the team account.

| Script | What it does |
| --- | --- |
| `npm run new-deployer` | Generates a fresh deployer key into `.env` (gitignored) and prints only its address |
| `npm run deploy -- <file.sol> [Name] [args]` | Compiles with solc, shows estimated cost, deploys after you type `yes`, prints the address |
| `npm run sweep` | Sends the deployer's whole remaining balance to the team account after you type `yes` |

## Key rules

- **Every developer uses their own throwaway deployer key.** Nobody shares one. Anything
  pasted into Slack, a ticket, a chat or a commit counts as public.
- **The key lives only in `.env` on your machine.** `.env` is gitignored. Never commit it,
  and never put a real value in `.env.example`.
- **Fund the deployer with only what the deploy needs.** For a normal contract that's about
  0.01–0.05 SepoliaETH (the deploy script prints the real estimate). When you're done,
  sweep the rest back.
- **Nothing sends without a human.** `deploy` and `sweep` print the amount, the destination
  and the live gas cost, then wait for you to type `yes`. They won't run without a terminal.
- **Both scripts refuse to run on the wrong network.** If `SEPOLIA_RPC_URL` reports any chain
  id other than Sepolia (11155111), they stop before signing.
- These scripts are for **Sepolia only**. A mainnet deploy needs a hardware wallet or a
  multisig, not a key in a `.env` file.

## From zero to a deployed contract

### 1. Prerequisites

- Node.js 22 or newer (`node -v`)
- An RPC URL for Sepolia from Alchemy, Infura, QuickNode or similar. Without one, the scripts
  fall back to viem's public RPC, which is rate-limited.

### 2. Install

```sh
git clone <this repo>
cd <this repo>
npm install
```

### 3. Create your deployer

```sh
npm run new-deployer
```

This writes `DEPLOYER_PRIVATE_KEY` to `.env` with `chmod 600` and prints your deployer
**address**. It never prints the key. Next, open `.env` and fill in `SEPOLIA_RPC_URL`.

If you'd rather use a key you already have, run `cp .env.example .env` and fill in both
values. Only do this with a key that has never been shared.

### 4. Fund the deployer

Send a small amount of SepoliaETH to the address from step 3. Ask whoever holds the team
account, or use a faucet such as the Google Cloud Web3 faucet, Alchemy or Infura.

### 5. Deploy

Put the contract in `contracts/`. `contracts/Greeter.sol` is an example you can try the flow
with.

```sh
npm run deploy -- contracts/Greeter.sol Greeter '["hello"]'
```

- Argument 1: path to the `.sol` file.
- Argument 2: the contract name. Defaults to the file name.
- Argument 3: constructor arguments as a JSON array. Pass `uint`/`int` values as numbers or
  decimal strings (for example `"1000000000000000000"`). Pass addresses as strings.

Imports resolve relative to the contract file and then from `node_modules`. So
`npm install @openzeppelin/contracts` is enough for `import "@openzeppelin/contracts/...";`
to work.

The script shows the network, deployer, balance, estimated gas and max cost. Type `yes` to
send. On success it prints:

```
✔ Greeter deployed
  Address:  0x…
  Explorer: https://sepolia.etherscan.io/address/0x…
```

It also writes `deployments/sepolia-<Name>.json` with the address, tx hash, block and ABI.
Commit that file so the rest of the team can find the deployment.

### 6. Sweep the leftovers back

```sh
npm run sweep
```

This sends the deployer's entire balance, minus the exact gas cost, to the team account set
in `sweep.ts`. It shows the amount, the checksummed destination and the gas cost first, then
waits for `yes`. It won't run while the deployer has a pending transaction.

## Troubleshooting

| Message | Fix |
| --- | --- |
| `DEPLOYER_PRIVATE_KEY is not set` | Run `npm run new-deployer`, or create `.env` from `.env.example` |
| `RPC reports chain id …` | `SEPOLIA_RPC_URL` points at the wrong network |
| `Deployer balance is too low` | Fund the deployer address (step 4) |
| `is a leaked key` | That account's key is public. Create your own deployer (step 3) |
| `TEAM_ACCOUNT … is not a valid checksummed address` | Copy the team address again from the wallet itself and update `sweep.ts` |
| `Refusing to send without an interactive confirmation` | Run it in a real terminal, not piped or in CI |
