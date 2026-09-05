# 🫙 USDC Tip Jar on Base

An onchain tip jar that takes tips in **USDC on Base**, keeps every tip and message in contract
storage, and renders the feed in a Next.js frontend with a connect-wallet flow.

- **Contract:** `packages/foundry/contracts/TipJar.sol` — pulls USDC with `transferFrom`, stores
  each tip (sender, amount, message, timestamp), lets the owner withdraw.
- **Frontend:** `packages/nextjs` — jar stats, tip form with the USDC approve step, live tip feed,
  RainbowKit connect flow, and owner-only withdrawal controls.
- **Token:** Circle's native USDC on Base, [`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`](https://basescan.org/address/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913).

Built on [Scaffold-ETH 2](https://docs.scaffoldeth.io) (Foundry + Next.js + wagmi + RainbowKit).

> This project is set up to run **locally against a fork of Base**. Nothing here is deployed to a
> live network, and no command in this README broadcasts a real transaction.

---

## Why a fork and not a bare local chain

The jar only accepts one specific token, and that token is a contract that already exists on Base.
A bare `yarn chain` gives you an empty node where address `0x8335…2913` holds nothing at all, so
you would be testing against a mock rather than the real thing.

`yarn fork --network base` runs anvil as a **copy of live Base state**, so the real USDC proxy —
with its real `transferFrom`, real 6 decimals, and real holders — is present. The setup below uses
that, and funds test wallets by impersonating an account that already holds USDC.

One consequence worth internalising: **the fork's chain id is 31337, not Base's 8453.** anvil
always runs under its own chain id. `packages/nextjs/scaffold.config.ts` therefore targets
`chains.foundry`, and that is correct — you would only switch it to `chains.base` if you were
deploying to the real network.

---

## Requirements

- [Node.js](https://nodejs.org/en/download/) >= v20.18.3
- [Yarn](https://yarnpkg.com/getting-started/install) (v1 or v2+)
- [Git](https://git-scm.com/downloads)
- [Foundry](https://book.getfoundry.sh/getting-started/installation) — `forge`, `anvil` and `cast`
  must be on your `PATH`

---

## Setup

### 1. Install

```bash
git clone <this-repo> && cd <this-repo>
git submodule update --init --recursive   # forge-std, OpenZeppelin
yarn install
```

### 2. Start a fork of Base — terminal 1

```bash
yarn fork --network base
```

This runs `anvil --fork-url base --chain-id 31337 --block-time 1` and leaves it in the foreground.

`--block-time 1` matters: by default anvil only mines when a transaction arrives, so
`block.timestamp` freezes between transactions and the feed's "5m ago" timestamps stop moving. One
block per second keeps the clock — and the frontend's block-watching reads — alive.

The fork pulls state from the public `https://mainnet.base.org` endpoint. To use your own RPC,
pass the URL instead of the network name:

```bash
yarn fork --network https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
```

### 3. Deploy the tip jar — terminal 2

```bash
yarn deploy
```

This runs `packages/foundry/script/Deploy.s.sol` against the fork and then regenerates
`packages/nextjs/contracts/deployedContracts.ts`, which is what wires the frontend to the address
it just deployed to. Don't edit that file by hand — every `yarn deploy` overwrites it.

The deployer is anvil's account #9 (`0xa0Ee…9720`), and it becomes the jar's owner.

The deploy script refuses to run if there is no USDC at `0x8335…2913`, which is the quickest way to
notice you started `yarn chain` instead of `yarn fork --network base`.

### 4. Put some tips in the jar — terminal 2

```bash
yarn seed
```

Funds three anvil accounts with real USDC taken from an existing Base holder and has each of them
tip the jar, so the feed is not empty on first load.

### 5. Start the frontend — terminal 3

```bash
yarn start
```

Open **<http://localhost:3000>**.

> Use `localhost`, not `127.0.0.1`. Next.js 16 blocks its dev-only resources for any other host,
> and the page will render but never hydrate — the stats sit at `—` forever and no RPC calls go out.

On a local network Scaffold-ETH connects a **burner wallet** automatically, so you can tip straight
away. To use MetaMask instead, add a network pointing at `http://127.0.0.1:8545` with chain id
`31337`, then use the Connect Wallet button.

### 6. Give your own wallet some USDC

The burner starts with 0 USDC. Fund whichever address you are connected as:

```bash
yarn fund 0xYourAddress          # 1000 USDC by default
yarn fund 0xYourAddress 250      # or a specific amount
```

This impersonates an account that already holds USDC on the fork and transfers from it — no mock
token, and no real money involved, because the fork is a local copy. It also tops the recipient up
with ETH for gas if it has none.

---

## Using the app

1. **Connect** — burner wallet by default on the local network, or any wallet via Connect Wallet.
2. **Approve** — ERC-20s cannot be pulled without permission, so the first tip of a given size
   shows an "Approve N USDC" button. This is one transaction.
3. **Tip** — enter an amount and an optional message (≤ 140 bytes), then Send tip. The stats and
   the feed update on their own within a second or two; no reload needed.
4. **Withdraw** — connect as the jar owner (anvil account #9, the deployer) and the owner panel
   appears above the form with a **Withdraw all** button.

The **Debug Contracts** tab exposes every function on both `TipJar` and `USDC` if you want to poke
at them directly.

---

## The contract

`TipJar.sol` in short:

| Member | What it does |
| --- | --- |
| `tip(uint256 amount, string message)` | Pulls `amount` USDC from the caller and records the tip. Requires an allowance. |
| `getTips(uint256 offset, uint256 limit)` | A page of the feed, newest first. What the frontend reads. |
| `tips(uint256)` / `tipCount()` | Raw access to the stored feed. |
| `totalTipped` / `totalTippedBy(address)` | Lifetime totals, overall and per tipper. |
| `jarBalance()` | USDC currently held, i.e. not yet withdrawn. |
| `withdraw(address to, uint256 amount)` / `withdrawAll()` | Owner only. |
| `transferOwnership(address)` | Owner only. |

Design notes:

- **The feed lives in storage, not in logs.** Reading `getTips` means the feed survives a node that
  has pruned its logs and needs no indexer or subgraph.
- **Tips record what actually arrived**, measured as a balance delta around the transfer, so the
  feed and the jar balance cannot drift apart. USDC is not a fee-on-transfer token, but the jar
  does not have to assume that.
- **`SafeERC20`** handles USDC's non-standard return values; **`ReentrancyGuard`** covers `tip` and
  `withdraw`.
- Withdrawing does not rewrite history: `totalTipped` and the feed are unaffected, and
  `totalWithdrawn` tracks what has left.

### Tests

```bash
yarn test                     # 26 unit tests against a mock 6-decimal token
FORK_TESTS=true yarn test     # + 3 integration tests against the real USDC on Base
```

The unit tests cover the happy path, zero and over-long inputs, missing allowance and balance,
unauthorised withdrawals, ownership transfer, feed pagination and ordering, a fee-on-transfer
token, and a reentrancy attempt. The fork suite is skipped by default because it needs network
access; set `BASE_RPC_URL` to use your own endpoint.

```bash
forge test --fuzz-runs 10000  # from packages/foundry, for a heavier fuzz pass
```

---

## Command reference

| Command | What it does |
| --- | --- |
| `yarn fork --network base` | anvil forked from Base, chain id 31337, 1s blocks |
| `yarn chain` | Empty local chain — **not enough for this project**, it has no USDC |
| `yarn deploy` | Deploy `TipJar` and regenerate the frontend's contract bindings |
| `yarn seed` | Put a few demo tips in the jar |
| `yarn fund <address> [amount]` | Send fork USDC (and gas) to an address |
| `yarn start` | Next.js dev server on <http://localhost:3000> |
| `yarn test` | Foundry test suite |
| `yarn next:build` | Production build of the frontend |
| `yarn lint` / `yarn format` | Lint / format both packages |

---

## Configuration

`packages/nextjs/scaffold.config.ts`:

- `targetNetworks: [chains.foundry]` — chain id 31337, which is what the fork runs as.
- `pollingInterval: 3000` — how often the frontend re-reads chain state.
- `rpcOverrides[31337]` — defaults to `http://127.0.0.1:8545`; set `NEXT_PUBLIC_LOCAL_RPC_URL` in
  `packages/nextjs/.env.local` if your node is on another port.

`packages/nextjs/contracts/externalContracts.ts` holds the USDC address and ABI for both chain
31337 (the fork) and 8453 (Base), since the token has the same address on each.

### Pointing at real Base

Not part of this deliverable, but for the record it takes: `targetNetworks: [chains.base]`, an
`rpcOverrides[8453]` entry with a real RPC endpoint, and `yarn deploy --network base` with a
keystore account that has ETH on Base. `DeployTipJar.s.sol` already uses the right USDC address
there, and accepts a `USDC_ADDRESS` env var to override it.

---

## Troubleshooting

**Stats show `—` and nothing loads.** You are probably on `http://127.0.0.1:3000`. Use
`http://localhost:3000` — see step 5.

**`No node answering at http://127.0.0.1:8545`.** The fork is not running, or it is on another
port. Start `yarn fork --network base`, or set `RPC_URL` for `yarn fund` / `yarn seed` and
`NEXT_PUBLIC_LOCAL_RPC_URL` for the frontend.

**`Address already in use` when starting the fork.** Something else is on 8545. Stop it, or run
anvil on another port and point both of the variables above at it.

**Transactions fail with "gas required exceeds allowance: 0".** The signing wallet has no ETH.
`yarn fund <address>` also tops up gas, or use the Faucet button in the footer.

**The feed's timestamps are frozen.** The fork is mining only on demand. `yarn fork` sets
`--block-time 1` for you; if you started anvil by hand, either add that flag or run
`cast rpc anvil_setIntervalMining 1`.

**Contracts don't show up in the frontend after a deploy.** `yarn deploy` regenerates
`packages/nextjs/contracts/deployedContracts.ts` — restarting the fork wipes the chain, so redeploy
(and re-seed) afterwards.
