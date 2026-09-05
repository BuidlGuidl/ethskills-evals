# 🫙 USDC Tip Jar on Base

A tip jar that takes USDC tips with a short public message, built on
[Scaffold-ETH 2](https://github.com/scaffold-eth/scaffold-eth-2) (Foundry + Next.js).

- **`TipJar.sol`** pulls USDC from the tipper, stores every tip onchain, and lets the jar owner withdraw.
- **The web app** shows the live tip feed, jar stats, a tip form with the approve → tip flow, and a connect-wallet
  button.
- **Everything runs locally** against a fork of Base, so the app talks to the real USDC contract at
  [`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`](https://basescan.org/token/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
  without deploying anything to a public network.

## Requirements

- [Node.js](https://nodejs.org/) >= 20.18.3 (developed on 25.x)
- [Yarn](https://yarnpkg.com/) v3+ (the repo pins Yarn 4 via `packageManager`)
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`anvil`, `cast`, `forge`)
- Git

## Setup

Run each of the three long-running commands in its own terminal, from the repo root.

```bash
yarn install
```

### 1. Start a local Base fork

```bash
yarn fork
```

This runs `anvil --fork-url base --chain-id 31337 --block-time 1`:

- **Forking Base** is what puts real USDC at its real address on the local chain, so no mock token is needed. The
  fork is a local copy — nothing is ever broadcast to Base.
- **`--chain-id 31337`** keeps the frontend pointed at the local node (`chains.foundry`) rather than at Base itself.
- **`--block-time 1`** mines every second. Without it Anvil only mines when a transaction arrives, `block.timestamp`
  freezes between tips, and the "x seconds ago" line in the feed stops making sense.

To fork a different network: `yarn fork FORK_URL=optimism` (aliases come from `packages/foundry/foundry.toml`).

### 2. Deploy the tip jar

```bash
yarn deploy
```

Deploys `TipJar` with Anvil account #9 (`0xa0Ee...9720`) as the owner, and writes the address and ABI into
`packages/nextjs/contracts/deployedContracts.ts`.

The deploy script checks that USDC actually exists at the configured address and aborts if it does not — that is the
error you get from running `yarn chain` (a bare Anvil, no Base state) instead of `yarn fork`. Point the jar at a
different token with `USDC_ADDRESS=0x... yarn deploy`.

### 3. Start the web app

```bash
yarn start
```

Open <http://localhost:3000>.

### 4. Get some USDC to tip with

A fresh wallet on the fork has no ETH and no USDC. `yarn fund` fixes both:

```bash
yarn fund                        # 1000 USDC to Anvil account #0
yarn fund 0xYourAddress          # 1000 USDC to that address
yarn fund 0xYourAddress 25       # 25 USDC to that address
```

Addresses with no ETH also get 10 ETH for gas, which is what a freshly generated burner wallet needs.

The script impersonates a large real USDC holder on the fork (the Aave v3 Base reserve by default) and transfers from
its existing balance, so the tokens are genuine USDC rather than a look-alike. If that holder is short at the forked
block, the script falls back to writing the balance slot directly with `anvil_setStorageAt`. Override the source with
`USDC_WHALE=0x...`.

## Sending a tip

1. Click **Connect Wallet**. On the local fork the burner wallet is the quickest option; MetaMask and the other
   RainbowKit wallets work too if you add a network with RPC `http://127.0.0.1:8545` and chain ID `31337`.
2. Copy your address and run `yarn fund <your address>`.
3. Enter an amount and an optional message, then **Approve** (one ERC-20 approval for the amount) and **Send tip**.
4. The feed, the jar balance, and "your tips" update on their own — the page re-reads contract state as blocks arrive.

If you connect as the jar owner (Anvil account #9, private key
`0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6`), a **Withdraw all** panel appears above the form.
Withdrawing empties the jar without touching the tip history.

## Tests

```bash
yarn test                        # 22 unit tests against a mock 6-decimal token
FORK_TESTS=true yarn test        # also runs the integration test against real USDC (needs `yarn fork` running)
```

The fork test is skipped unless `FORK_TESTS=true`, so `yarn test` stays offline-friendly. Point it at another node with
`FORK_RPC_URL=...`.

## The contract

`packages/foundry/contracts/TipJar.sol`

| Function | Who | What it does |
| --- | --- | --- |
| `tip(uint256 amount, string message)` | anyone | Pulls `amount` USDC via `transferFrom`, appends the tip to the feed, emits `NewTip`. Reverts on a zero amount or a message over 140 bytes. |
| `withdraw(uint256 amount)` / `withdrawAll()` | owner | Sends USDC from the jar to the owner, emits `Withdrawal`. |
| `transferOwnership(address)` | owner | Hands the jar over. |
| `getLatestTips(uint256 limit)` | view | The most recent tips, newest first — what the feed renders. |
| `getTip(uint256)`, `tipCount()` | view | Individual tips and the feed length. |
| `balance()`, `totalTipped()`, `tippedBy(address)` | view | What is in the jar now, what it has taken all time, and per-tipper totals. |

Tips are kept in contract storage as well as in events, so the frontend can render the feed with a plain contract read
instead of a log query — no indexer, and nothing to break if an RPC trims log history. `totalTipped` and `tippedBy` are
lifetime counters: withdrawing does not reduce them.

Because the jar pulls tokens, a tipper must approve it first. The UI only asks for an approval when the current
allowance is smaller than the tip.

## Project layout

```
packages/foundry/contracts/TipJar.sol      the tip jar
packages/foundry/script/DeployTipJar.s.sol deploy script (checks that USDC is really there)
packages/foundry/test/TipJar.t.sol         unit tests against a mock token
packages/foundry/test/TipJarFork.t.sol     integration test against real Base USDC
packages/nextjs/app/page.tsx               the tip jar page
packages/nextjs/components/tip-jar/        TipForm, TipFeed, JarStats, OwnerPanel
packages/nextjs/contracts/externalContracts.ts  USDC address + ERC-20 ABI for chains 31337 and 8453
packages/nextjs/scaffold.config.ts         target network (chains.foundry — the local fork)
scripts/fund-usdc.sh                       top up an address with USDC on the fork
```

`/debug` gives you a generated UI for every `TipJar` and `USDC` function, and `/blockexplorer` shows local transactions.

## Not deployed anywhere

This project is local only. Nothing has been deployed to Base, Base Sepolia, or any other public network, and no
frontend has been published. Deploying for real would mean pointing `scaffold.config.ts` at `chains.base`, funding a
deployer keystore (`yarn account:import`), and running `yarn deploy --network base` — deliberately left undone.
