# USDC Tip Jar (Base)

An onchain tip jar that accepts **USDC on Base**, plus a web page with a public tip feed,
a form for sending a tip, and a wallet connect flow.

Tips are stored onchain with the sender, the amount, an optional message and a timestamp,
so the feed is readable by anyone without an indexer. The jar's owner can withdraw the balance.

> **Nothing here is deployed.** This repository runs entirely on a local fork of Base.
> See [Pointing at real Base](#pointing-at-real-base) for what would change if you ever did deploy.

---

## Table of contents

- [How it works](#how-it-works)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Running it locally](#running-it-locally)
- [Getting USDC to spend](#getting-usdc-to-spend)
- [Using the app](#using-the-app)
- [Withdrawing](#withdrawing)
- [Tests](#tests)
- [Why a fork instead of a bare local chain](#why-a-fork-instead-of-a-bare-local-chain)
- [Contract reference](#contract-reference)
- [Project layout](#project-layout)
- [Troubleshooting](#troubleshooting)
- [Pointing at real Base](#pointing-at-real-base)

---

## How it works

| Piece | What it does |
| --- | --- |
| `TipJar.sol` | Holds the tips. `tip(amount, message)` pulls USDC from the sender and appends to an onchain feed. |
| `MockUSDC.sol` | A 6-decimal stand-in, used **only** on an empty local chain where real USDC does not exist. |
| Next.js frontend | Tip feed, tip form, connect-wallet flow. Reads the feed straight from the contract. |

USDC is an ERC-20, so sending a tip is the usual **two-step flow**: approve the jar for the
amount, then call `tip`. The form shows whichever step is next and tracks the two
transactions separately, so one never blocks the other.

The frontend reads the token address from `TipJar.token()` rather than hardcoding it, so the
page can never disagree with the contract about which token it accepts.

Base USDC is [`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`](https://basescan.org/token/0x833589fcd6edb6e08f4c7c32d4f71b54bda02913) (6 decimals).

---

## Prerequisites

| Tool | Version | Check |
| --- | --- | --- |
| [Node.js](https://nodejs.org) | >= 20.18.3 | `node -v` |
| [Yarn](https://yarnpkg.com) | 4.x (bundled via Corepack) | `yarn -v` |
| [Foundry](https://book.getfoundry.sh/getting-started/installation) | any recent | `forge --version` |
| Git | any | `git --version` |

Install Foundry with:

```bash
curl -L https://foundry.paradigm.xyz | bash && foundryup
```

You also need **outbound internet access**, because the local chain is a fork of real Base.

---

## Setup

```bash
git clone <this-repo> tipjar
cd tipjar

# Solidity dependencies (forge-std, OpenZeppelin) are git submodules
git submodule update --init --recursive

yarn install
```

`yarn install` copies `packages/foundry/.env.example` to `packages/foundry/.env` for you. The
defaults are fine for local work — no API keys are needed to fork Base.

---

## Running it locally

Three terminals, in this order.

### Terminal 1 — fork Base

```bash
yarn fork --network base
```

This runs Anvil as a local copy of Base mainnet on `http://127.0.0.1:8545` with chain ID
`31337`. Real USDC, and every other deployed contract, exists on it. Nothing you do here
touches the real network.

It is started with `--block-time 1` so the chain keeps mining once a second. Without that,
Anvil only mines when a transaction arrives, `block.timestamp` freezes, and the "5m ago"
labels in the feed silently stop moving.

Wait for the block number to start climbing before moving on.

### Terminal 2 — deploy the contract

```bash
yarn deploy
```

Deploys `TipJar` pointed at Base USDC, and writes the address and ABI to
`packages/nextjs/contracts/deployedContracts.ts` for the frontend. That file is generated —
do not edit it by hand.

The owner (who can withdraw) is the deployer, Anvil account #9
`0xa0Ee7A142d267C1f36714E4a8F75612F20a79720`.

### Terminal 3 — start the frontend

```bash
yarn start
```

Open **<http://localhost:3000>**.

> Use `localhost`, not `127.0.0.1`. Next.js blocks cross-origin dev resources by default, and
> on `127.0.0.1:3000` the page renders but its onchain reads never fire, so the feed looks
> permanently empty.

---

## Getting USDC to spend

A fresh wallet on the fork has no USDC. Because the fork is a local copy of Base, you can take
some from an address that already holds it instead of deploying a fake token:

```bash
yarn fund-usdc
```

That funds the ten default Anvil accounts with 10,000 USDC each, moved from a real USDC holder
on Base (Morpho Blue). To fund a specific address as well — your burner wallet, or your
MetaMask account:

```bash
yarn fund-usdc 0xYourAddress

# custom amount, in whole USDC
AMOUNT=500 yarn fund-usdc 0xYourAddress
```

The app's burner wallet address is shown in the top right; click it to copy.

To use a funded Anvil account in MetaMask instead, add a network for
`http://127.0.0.1:8545` with chain ID `31337`, then import one of Anvil's private keys (they
are printed by `yarn fork` on startup).

---

## Using the app

1. **Connect** — the burner wallet connects automatically on a local chain. Use the
   *Connect Wallet* button to pick MetaMask or another wallet instead.
2. **Enter an amount** — the form validates against your balance and USDC's 6 decimal places.
   *Balance: …* is clickable to fill the maximum.
3. **Add a message** (optional, up to 280 characters). It is stored onchain and shown publicly.
4. **Approve** — the first transaction lets the jar move exactly that amount of USDC.
5. **Send tip** — the second transaction sends it. The feed and the totals update as soon as it
   confirms, including tips sent by other people.

The feed is readable without connecting a wallet; only sending requires one.

---

## Withdrawing

`withdraw()` sends the full balance to the owner and is owner-only. There is no button for it
on the page — use the built-in contract UI at **<http://localhost:3000/debug>**, connected as
the owner account, or call it directly:

```bash
cast send <TIPJAR_ADDRESS> "withdraw()" \
  --from 0xa0Ee7A142d267C1f36714E4a8F75612F20a79720 --unlocked \
  --rpc-url http://127.0.0.1:8545
```

`withdrawTo(address)` sends it somewhere else. Withdrawing does not erase the feed — the tip
history and `totalTipped` are permanent.

---

## Tests

```bash
yarn test                 # 25 unit tests, no network needed
```

There is also an integration suite that runs against the **real** USDC contract on Base. It
skips itself when no fork is available, so `yarn test` stays green offline. Run it explicitly:

```bash
cd packages/foundry
forge test --match-contract TipJarForkTest --fork-url base -vv
```

Fuzzing, if you want more:

```bash
cd packages/foundry && forge test --fuzz-runs 10000
```

---

## Why a fork instead of a bare local chain

`yarn chain` gives you an empty chain: no USDC, no protocols, no balances. Since this project's
whole behavior depends on a token that is already deployed to Base, testing against a mock
would prove very little.

`yarn fork --network base` gives you a local copy of real Base, so the app talks to the actual
USDC contract at its real address, with its real decimals and real transfer semantics.

`yarn chain` still works if you want an isolated chain — the deploy script notices there is no
USDC at the Base address and deploys `MockUSDC` instead, printing a note that it did so. The
app then works exactly the same against the mock. Mint yourself some with `mint(address,uint256)`
from the `/debug` page.

---

## Contract reference

`TipJar` — `packages/foundry/contracts/TipJar.sol`

| Function | Notes |
| --- | --- |
| `tip(uint256 amount, string message)` | Sends a tip. Requires prior `approve`. Reverts on zero, or a message over 280 bytes. |
| `getRecentTips(uint256 limit)` | Newest first. Returns fewer than `limit` if the feed is shorter. |
| `getTips(uint256 offset, uint256 limit)` | Paging through a long feed, newest first. |
| `getTip(uint256 index)` | A single tip by feed index. |
| `tipCount()` / `totalTipped()` | Feed length, and lifetime total in token units. |
| `tippedBy(address)` | Lifetime total for one address. |
| `balance()` | What is currently in the jar and withdrawable. |
| `withdraw()` / `withdrawTo(address)` | Owner only. |
| `token()` | The accepted token. Base USDC on a fork. |

Events: `TipReceived(index, sender, amount, message, timestamp)` and `Withdrawn(to, amount)`.

Amounts are in token units — USDC has 6 decimals, so `1 USDC == 1_000_000`.

A few deliberate choices:

- The recorded amount is the **balance actually received**, not the requested amount, so the
  feed can never disagree with the jar's real balance.
- `withdraw` is guarded by `ReentrancyGuard` and emits before transferring.
- The feed survives withdrawal — tip history is permanent.

---

## Project layout

```
packages/
  foundry/
    contracts/TipJar.sol            the tip jar
    contracts/test/MockUSDC.sol     stand-in token for an empty local chain
    script/DeployTipJar.s.sol       picks real USDC, or the mock if it is absent
    test/TipJar.t.sol               unit tests
    test/TipJarFork.t.sol           integration tests against real Base USDC
    scripts-js/fundUsdc.js          moves real USDC to local accounts on a fork
  nextjs/
    app/page.tsx                    the tip jar page
    app/_components/TipForm.tsx     amount + message, approve then tip
    app/_components/TipFeed.tsx     the feed
    app/_components/JarStats.tsx    totals
    hooks/tip-jar/                  token + allowance hooks
    utils/tip-jar/format.ts         amount and relative-time formatting
```

---

## Troubleshooting

**The feed is empty and the totals show `—`.**
You are probably on `http://127.0.0.1:3000`. Use `http://localhost:3000` — see the note in
[Running it locally](#running-it-locally). Otherwise check that `yarn fork` is still running
and that `yarn deploy` has been run against it.

**`Address already in use (os error 98)` from `yarn fork`.**
Something is already on port 8545, often an Anvil left over from a previous session.
`lsof -i :8545` (or `ss -lptn 'sport = :8545'`) will name it.

**Timestamps in the feed are frozen.**
The chain is not mining. `yarn fork` sets `--block-time 1`; if you started Anvil by hand, add it,
or run `cast rpc anvil_setIntervalMining 1`.

**"No USDC contract at 0x8335…" from `fund-usdc`.**
You are on an empty chain from `yarn chain`. Use `yarn fork --network base`.

**The frontend points at an old contract.**
`deployedContracts.ts` is regenerated by `yarn deploy`. Restarting the fork wipes chain state,
so redeploy afterwards.

**Wallet says wrong network.**
The fork is chain ID `31337`, not Base's `8453` — the fork runs locally under Anvil's own chain
ID. `scaffold.config.ts` targets `chains.foundry` to match. Switch your wallet to the local
network; the header offers a switch button.

---

## Pointing at real Base

Not done here, and not recommended without an audit. For the record, it would mean:

1. `scaffold.config.ts`: `targetNetworks: [chains.base]`.
2. Set `rpcOverrides` for Base to a real provider — do not ship with a public RPC.
3. Deploy with a funded keystore account: `yarn deploy --network base`.
4. Whoever you set as owner is the only address that can withdraw. Choose deliberately.

The contract already hardcodes nothing chain-specific: the token address is a constructor
argument, and the deploy script only defaults it to Base USDC.
