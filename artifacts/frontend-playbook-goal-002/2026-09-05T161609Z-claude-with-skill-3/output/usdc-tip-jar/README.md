# USDC Tip Jar (Base)

An onchain tip jar that takes USDC tips with a short message, and a web app with the tip feed, a
tip form and a wallet connect flow.

Everything runs locally against a **fork of Base**, so the tips move the real Circle USDC contract
at [`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`](https://basescan.org/token/0x833589fcd6edb6e08f4c7c32d4f71b54bda02913)
— not a mock. Nothing is deployed to a live network.

![The tip jar running locally](./screenshot.png)

## What's in here

| Path | What it is |
| --- | --- |
| `packages/foundry/contracts/TipJar.sol` | The contract: accepts USDC tips, stores the feed, lets the owner withdraw |
| `packages/foundry/test/TipJar.t.sol` | 21 unit + fuzz tests |
| `packages/foundry/script/DeployTipJar.s.sol` | Deploy script, points the jar at Base USDC |
| `packages/foundry/scripts-js/fundUsdc.js` | Gives local accounts real USDC by impersonating a holder on the fork |
| `packages/nextjs/app/page.tsx` | The page: stats, tip form, tip feed |
| `packages/nextjs/components/tipjar/` | `TipForm`, `TipFeed`, `JarStats`, `OwnerPanel` |
| `packages/nextjs/contracts/externalContracts.ts` | USDC address + ABI, so the frontend can read allowances and approve |

Built on [Scaffold-ETH 2](https://docs.scaffoldeth.io/) (Foundry + Next.js + RainbowKit + wagmi),
which supplies the wallet connect flow, the local faucet and the contract hooks.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20.18.3
- [Yarn](https://yarnpkg.com/) (v1 is enough to bootstrap; the repo pins Yarn 4 via Corepack)
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`anvil`, `forge`, `cast`)
- Git

No API keys are needed. The fork reads from the public `https://mainnet.base.org` endpoint
configured in `packages/foundry/foundry.toml`.

## Setup

```bash
git clone <this repo> && cd usdc-tip-jar
yarn install
```

Then open **three terminals** and leave each running.

### 1. Start a local fork of Base

```bash
yarn fork --network base
```

This runs Anvil as a local copy of Base mainnet at `http://127.0.0.1:8545` with chain ID **31337**.

A plain `yarn chain` gives you an *empty* chain with no USDC on it, so the tip jar has nothing to
pull — use `yarn fork` for this project. The fork also runs with `--block-time 1` (see
`packages/foundry/Makefile`) so the clock keeps moving between transactions and the "2m ago"
timestamps in the feed stay honest.

### 2. Deploy the tip jar

```bash
yarn deploy
```

Deploys `TipJar` pointed at Base USDC, owned by Anvil account #9
(`0xa0Ee7A142d267C1f36714E4a8F75612F20a79720`), and writes the address and ABI into
`packages/nextjs/contracts/deployedContracts.ts`.

The fork starts fresh every time you restart it, so **re-run `yarn deploy` after every restart**.

### 3. Start the frontend

```bash
yarn start
```

Open <http://localhost:3000>.

## Sending your first tip

On a local chain, Scaffold-ETH connects a throwaway **burner wallet** automatically, so you land on
the page already connected. To use a different wallet, open the account dropdown in the header →
**Disconnect** → **Connect Wallet**, and pick MetaMask, WalletConnect, Ledger, Base, Rainbow or the
burner (point your wallet at `http://127.0.0.1:8545`, chain ID `31337`).

A fresh burner has no ETH and no USDC, so:

1. **Get gas.** Click the 💵 button next to your address in the header. It sends you 1 local ETH.
2. **Get USDC.** Copy your address from the header, then in a fourth terminal:

   ```bash
   yarn fund-usdc 0xYourAddress        # 1,000 USDC
   yarn fund-usdc 0xYourAddress 50     # or a specific amount
   yarn fund-usdc                      # or fund Anvil accounts #0 and #9
   ```

   This works because a fork is a local copy of Base: the script impersonates an address that
   already holds USDC and transfers some to you. No mock token, and no real money moves.

3. **Tip.** Enter an amount, optionally a message, then **Approve** and **Send tip**. Two
   transactions: USDC has to be approved before the jar can pull it. The tip shows up in the feed
   immediately.

If you connect as the owner (Anvil account #9), a **Withdraw all** panel appears above the form.
Withdrawing empties the jar but leaves the feed intact — the tip history is a permanent record.

## The contract

`TipJar` is `Ownable` and holds the token address immutably.

| Function | Notes |
| --- | --- |
| `tip(uint256 amount, string message)` | Pulls `amount` USDC from the caller (needs approval first), appends to the feed. Message is capped at `MAX_MESSAGE_LENGTH` (140 bytes) |
| `getLatestTips(uint256 offset, uint256 limit)` | A page of the feed, newest first — what the UI renders |
| `getTip(uint256 index)` / `tipCount()` | Single tip / feed length, oldest-first indexing |
| `totalTipped()` / `totalTippedBy(address)` | Lifetime totals |
| `balance()` | USDC currently sitting in the jar |
| `withdraw(uint256)` / `withdrawAll()` | Owner only, sends to the owner |

The amount recorded in the feed is the balance actually received, not the amount requested, so the
feed stays truthful even against a token that takes a cut on transfer. Emits `NewTip` and
`Withdrawn`.

## Tests

```bash
yarn test                          # 21 tests: tipping, approvals, feed pagination, access control
yarn test --fuzz-runs 10000        # heavier fuzzing
```

The tests use a mock 6-decimal token, which keeps them fast and offline; the fork is what proves
the real USDC integration.

## Project scripts

| Command | What it does |
| --- | --- |
| `yarn fork --network base` | Local Anvil fork of Base (chain ID 31337, 1s blocks) |
| `yarn chain` | Empty local chain — *not* usable for this project, there is no USDC on it |
| `yarn deploy` | Deploy `TipJar` and regenerate the frontend ABIs |
| `yarn start` | Next.js dev server on :3000 |
| `yarn fund-usdc [address] [amount]` | Move real USDC from a holder on the fork to a local account |
| `yarn test` | Foundry tests |
| `yarn format` / `yarn lint` | Prettier + forge fmt / ESLint + forge fmt --check |
| `yarn next:build` | Production build of the frontend (verifies the app compiles) |

## Configuration notes

- **`packages/nextjs/scaffold.config.ts` targets `chains.foundry` (31337).** Keep it that way while
  working against the fork. The fork *is* Base, but it answers on chain ID 31337, so pointing the
  frontend at `chains.base` would make it talk to the real network instead of your local copy.
- **USDC lives in `externalContracts.ts`**, listed under both 31337 (the fork) and 8453 (Base) at
  the same address, with only the ERC20 methods the UI needs.
- **`deployedContracts.ts` is generated** by `yarn deploy` — don't edit it by hand.
- **The fork RPC** is the public `https://mainnet.base.org`. If you hit rate limits, put your own
  endpoint in the `base` entry of `packages/foundry/foundry.toml`.

## Not deployed anywhere

This is a local-only project by design. The contract exists on your fork and nowhere else, and the
frontend is only served by `yarn start`. Going live would mean deploying `TipJar` to Base with a
funded deployer key and switching `targetNetworks` to `chains.base` — neither has been done here.

## Troubleshooting

**`DeployTipJar: no ERC20 code at the USDC address`** — the chain running on :8545 is an empty
`yarn chain`, not a fork. Stop it and run `yarn fork --network base`.

**`Address already in use (os error 98)`** — an Anvil instance is already on :8545. Find it with
`lsof -i :8545` (or `pgrep -a anvil`) and stop it before starting a new fork.

**The page says the contract isn't deployed, or reads come back empty** — you restarted the fork
without redeploying. Run `yarn deploy` again.

**`Not enough USDC` even after funding** — make sure you funded the address currently shown in the
header. Burner wallets are per-browser-profile, so an incognito window gets a different one.

**Transactions fail with an out-of-gas or balance error** — the burner has no ETH. Use the 💵 button
next to your address.
