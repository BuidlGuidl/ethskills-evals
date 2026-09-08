# USDC Tip Jar

A tip jar for [Base](https://base.org): an onchain contract that accepts tips in USDC
with a short public message, and a web app showing the tip feed, a form to send one,
and a connect-wallet flow.

Everything runs against a **local anvil node that forks Base**, so the jar talks to the
real USDC contract at
[`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`](https://basescan.org/address/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
— real code, real 6-decimal semantics — without touching a public network.

Nothing here is deployed anywhere. This is a local-only project.

![The tip jar running locally](docs/screenshot.png)

---

## Requirements

| Tool | Version used | Install |
| --- | --- | --- |
| [Foundry](https://book.getfoundry.sh/) (`forge`, `cast`, `anvil`) | 1.5.1 | `curl -L https://foundry.paradigm.xyz \| bash && foundryup` |
| Node.js | 25.9 (any ≥ 20) | [nodejs.org](https://nodejs.org) |
| `jq` | any | `apt install jq` / `brew install jq` |

You also need outbound access to a Base RPC to seed the fork. The default is the public
`https://mainnet.base.org`; override it with `FORK_URL` if you have your own.

---

## Quick start

Three terminals, from the project root.

```bash
# 0. one-time: install frontend dependencies
npm run install:web
```

```bash
# terminal 1 — local chain forking Base (leave running)
npm run chain
```

```bash
# terminal 2 — fund dev accounts, deploy the jar, seed a few tips
npm run setup
```

```bash
# terminal 3 — the web app
npm run web
```

Open <http://localhost:5173>. You should see the seeded tips in the feed.

`npm run setup` writes `web/.env.local`. If the dev server was already running when you
ran it, restart it so Vite picks up the new address.

---

## Sending a tip

The app offers two ways to connect, whichever you prefer:

**Local dev wallet (no extension needed).** Click **Connect local dev wallet**. This is
anvil's second dev account exposed through wagmi's mock connector. anvil keeps its dev
accounts unlocked and signs for it, so no private key ever reaches the browser. It exists
only because `web/.env.local` sets `VITE_DEV_WALLET_ADDRESS`; delete that line to force a
real wallet.

**A browser wallet (MetaMask or similar).** Click **Connect Injected**, then add the local
network:

| Field | Value |
| --- | --- |
| Network name | Base Local Fork |
| RPC URL | `http://127.0.0.1:8545` |
| Chain ID | `31337` |
| Currency symbol | `ETH` |

Import an anvil dev account with its private key — for example account #1,
`0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d`. These keys are
public and well known; never use them for real funds.

> The fork deliberately keeps chain ID **31337** rather than Base's 8453. That way your
> wallet can never confuse it with the real network, and real Base funds can never be sent
> to a local address by accident.

Then enter an amount, optionally a message, and send. USDC is pull-based, so the app runs
`approve` first when the current allowance is too low and then `tip` — you will see two
wallet prompts on the first tip and one after that.

`npm run setup` mints 10,000 USDC to each of the first three anvil accounts. To top up
again later: `npm run fund`.

---

## How it works

```
contracts/         Foundry project
  src/TipJar.sol       the jar
  test/                35 tests (31 unit + 4 against forked Base)
  script/Deploy.s.sol  deployment
scripts/           local workflow (chain, fund, deploy, seed, sync-abi)
web/               Vite + React + TypeScript + wagmi/viem frontend
```

### The contract

`TipJar` holds a fixed ERC-20 (USDC) chosen at deployment and an `owner` who can withdraw.

```solidity
function tip(uint256 amount, string calldata message) external returns (uint256 index);
function getRecentTips(uint256 limit) external view returns (Tip[] memory);
function getTips(uint256 offset, uint256 limit) external view returns (Tip[] memory);
function withdraw(address to, uint256 amount) external;   // owner only
function withdrawAll(address to) external;                // owner only
```

A few decisions worth calling out:

- **The feed lives in contract storage**, not just in events. A fresh page load renders the
  full history from one `eth_call`, with no log indexer and no archive-node dependency.
  Events are still emitted, and the app watches them for live updates.
- **The recorded amount is the balance actually received**, measured across the transfer,
  so the stored history can never overstate what the jar holds.
- **Transfers tolerate non-standard ERC-20s** that return no data instead of `true`.
- **`tip` is `nonReentrant`**, so a callback-capable token cannot append phantom entries.
- **Messages are capped at 200 bytes**, checked as bytes because that is what storage costs.

Withdrawals move funds but never rewrite history: `totalTipped` and the feed are permanent.

### The frontend

`wagmi` v3 + `viem`, with the injected connector for real wallets. Contract reads are
batched into a single multicall; the ABI in `web/src/abi/tipJar.ts` is generated from the
compiled artifact by `npm run sync-abi`, so it cannot drift from the contract.

---

## Tests

```bash
npm test          # 31 unit tests, no network needed
npm run test:fork # adds 4 tests against real USDC on a Base fork
```

The unit tests cover the tip and withdrawal paths, access control, feed pagination
boundaries, fee-on-transfer and no-return-value tokens, a reentrancy attempt, and two fuzz
properties. The fork tests run the same flows against the deployed Circle USDC contract;
they skip themselves unless `BASE_RPC_URL` is set, which `npm run test:fork` does for you.

Both suites, plus the browser flow above (connect → approve → tip → feed updates), were run
against the local fork while building this.

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run chain` | anvil forking Base on `127.0.0.1:8545`, chain ID 31337 |
| `npm run setup` | `fund` + `deploy` + `seed` in one go |
| `npm run fund` | Mints 10,000 USDC to the first three anvil accounts |
| `npm run deploy` | Deploys `TipJar`, writes `deployments/local.json` and `web/.env.local` |
| `npm run seed` | Sends three sample tips so the feed is not empty |
| `npm run sync-abi` | Regenerates the frontend ABI from the compiled contract |
| `npm run web` | Vite dev server on port 5173 |
| `npm run build:web` | Typechecks and builds the production bundle |
| `npm test` / `npm run test:fork` | Contract tests |

Most settings are environment variables with local defaults: `RPC_URL`, `CHAIN_ID`,
`FORK_URL`, `USDC_ADDRESS`, `TIPJAR_OWNER`, `AMOUNT_USDC`, `SEED=0`.

### How funding works

USDC cannot be minted freely, so `scripts/fund.sh` asks the token itself. It impersonates
USDC's `masterMinter` (something only anvil permits), calls `configureMinter` to authorise
a dev account, and mints from there. This works at any fork block, unlike draining a whale
address whose balance changes from day to day.

---

## Troubleshooting

**`No chain at http://127.0.0.1:8545`** — `npm run chain` is not running, or is on another
port. Set `RPC_URL` if you moved it.

**`Address already in use (os error 98)`** — something already holds port 8545. Either use
it as-is (if it is an anvil forking Base with chain ID 31337, everything works) or start on
another port: `PORT=8546 npm run chain`, then `RPC_URL=http://127.0.0.1:8546 npm run setup`.

**`No USDC at 0x8335…`** — the local chain is not forking Base. Restart with `npm run chain`
and check `FORK_URL` is reachable.

**The page says "Almost there"** — `web/.env.local` has no jar address yet. Run
`npm run setup`, then restart the dev server.

**The feed is empty after redeploying** — a fresh deploy is a fresh jar. Run `npm run seed`.

**`Failed to find yarn pnp manifest`** on `npm run web` or `build:web` — your shell has
`NODE_OPTIONS` pointing at some other project's Yarn PnP runtime, which hijacks module
resolution. Run `unset NODE_OPTIONS` in that terminal.

**Wallet says "wrong network"** — the app shows a *Switch to Base Local Fork* button; click
it, or add the network manually with the values in the table above.

---

## Going to a real network

Out of scope here, but the shape is: point `USDC_ADDRESS` at the target chain's USDC, set
`TIPJAR_OWNER` to an address you actually control (not an anvil key), deploy with
`forge script script/Deploy.s.sol:Deploy --rpc-url <rpc> --broadcast`, and remove
`VITE_DEV_WALLET_ADDRESS` from the frontend environment. The contract has not been audited.
