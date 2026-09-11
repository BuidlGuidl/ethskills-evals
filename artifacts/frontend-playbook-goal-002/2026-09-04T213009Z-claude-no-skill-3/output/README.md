# USDC Tip Jar (Base)

An on-chain tip jar that collects **USDC on Base** (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
together with the tipper's name and message, plus a web front end with the tip feed, a tip form
and a connect-wallet flow.

Everything runs locally against an Anvil chain forked from Base, so the real USDC contract is the
one being used. **Nothing here is deployed to a public network.**

## What's in the box

| Path | What it is |
| --- | --- |
| `contracts/src/TipJar.sol` | The tip jar: pulls USDC via `transferFrom`, stores each tip, owner can withdraw |
| `contracts/src/mocks/MockUSDC.sol` | 6-decimal USDC stand-in, used by tests and by a non-forked local chain |
| `contracts/test/` | Foundry unit tests + a fork test against real Base USDC |
| `contracts/script/Deploy.s.sol` | Deployment script; writes `contracts/deployments/<chainId>.json` |
| `web/` | Vite + React + TypeScript front end (wagmi + viem) |
| `scripts/` | Local-chain helpers: start the fork, deploy, hand out test USDC, seed tips |

## Prerequisites

- **Node.js 20+** and npm
- **Foundry** (`forge`, `cast`, `anvil`) — <https://getfoundry.sh>: `curl -L https://foundry.paradigm.xyz | bash && foundryup`
- **jq** — `brew install jq` / `apt install jq`
- A Base RPC URL for forking. The public `https://mainnet.base.org` is the default and works fine
  for local development.

## Setup

```bash
# 1. Contract dependencies (forge-std, OpenZeppelin) - they are git submodules
git submodule update --init --recursive   # or: cd contracts && forge install

# 2. Front-end dependencies
npm install

# 3. Compile + run the contract tests
npm run test:contracts
```

## Run it locally

Three terminals. Terminal 1 — the chain:

```bash
npm run chain
```

This starts Anvil forked from Base on `http://127.0.0.1:8545` with **chain id 31337**, so wallets
treat it as a separate local network rather than clashing with real Base. Set `BASE_RPC_URL` to use
your own RPC endpoint:

```bash
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/<key> npm run chain
```

Terminal 2 — deploy and seed:

```bash
npm run deploy:local   # deploys TipJar, funds the first 3 Anvil accounts with 10,000 USDC each,
                       # and writes web/.env.local with the new address
npm run seed           # optional: three example tips so the feed isn't empty
```

Terminal 3 — the web app:

```bash
npm run dev            # http://localhost:5173
```

## Connecting a wallet

Two options.

### A browser wallet (MetaMask, Rabby, …)

1. Add a network: RPC `http://127.0.0.1:8545`, chain id `31337`, currency `ETH`.
2. Import an Anvil account, e.g. private key
   `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
   (address `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`) — `npm run deploy:local` gives it 10,000
   test USDC.
3. Click **Connect wallet** in the app and pick your wallet.
4. Optional: add USDC (`0x8335…2913`, 6 decimals) as a token in the wallet to see the balance there.
   The app reads it either way.

> Anvil accounts are publicly known test keys. Never use them on a real network.

### No browser wallet

Uncomment the last line of `web/.env.local` and restart `npm run dev`:

```ini
VITE_DEV_WALLET=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
```

That adds a connector which transacts as that unlocked Anvil account, so the whole flow can be
exercised without installing anything. It only makes sense against a local chain.

WalletConnect is also wired up, but it needs a project id from <https://cloud.reown.com>. Set
`VITE_WALLETCONNECT_PROJECT_ID` in `web/.env.local` to enable it; the app works without it.

## Sending a tip

Fill in an amount, an optional name and an optional message, then hit **Tip**. USDC is a
pull-payment token, so the first transaction approves exactly the amount being tipped and the second
one calls `tip()`. The feed, totals and your balance update as soon as the tip is mined, and the page
also watches `TipReceived` events, so tips from other people appear without a reload.

Need more test USDC?

```bash
npm run fund -- 0xYourAddress 500     # 500 USDC on the local fork
```

## Withdrawing

The jar owner (the deployer by default) can withdraw. There is no UI for it — it's a one-liner:

```bash
JAR=$(jq -r .tipJar contracts/deployments/31337.json)
cast send "$JAR" "withdraw(address,uint256)" 0xYourAddress 0 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --rpc-url http://127.0.0.1:8545
```

`amount = 0` means "everything in the jar".

## The contract

```solidity
function tip(uint256 amount, string calldata name, string calldata message) returns (uint256 id);
function getTips(uint256 offset, uint256 limit) view returns (Tip[]);  // newest first
function getTip(uint256 id) view returns (Tip);
function tipCount() view returns (uint256);
function totalTipped() view returns (uint256);
function totalTippedBy(address) view returns (uint256);
function balance() view returns (uint256);          // USDC held by the jar
function withdraw(address to, uint256 amount);      // owner only; amount 0 = full balance
function transferOwnership(address newOwner);       // owner only
event TipReceived(uint256 indexed id, address indexed from, uint256 amount, string name, string message, uint256 timestamp);
```

Notes:

- Amounts are in USDC units — 6 decimals, so `1 USDC = 1_000_000`.
- The jar records the balance delta it actually received rather than the requested amount, so a
  fee-charging token can never inflate the feed.
- `name` is capped at 32 bytes and `message` at 280 bytes; both may be empty.
- Withdrawals move funds out but never erase history: `tipCount` and `totalTipped` keep counting.
- The token address is immutable, fixed at deployment.

## Tests

```bash
npm run test:contracts    # 22 unit tests, no network needed
npm run test:fork         # extra test against the real USDC contract on Base (needs an RPC)
npm run lint              # front-end lint
npm run build             # type-check + production build of the front end
```

`npm run test:fork` defaults to `https://mainnet.base.org`; override with `BASE_RPC_URL`.

## Configuration

`scripts/deploy-local.sh` writes `web/.env.local`. Every variable the front end understands is
documented in [`web/.env.example`](web/.env.example):

| Variable | Meaning |
| --- | --- |
| `VITE_TIPJAR_ADDRESS` | TipJar on the local chain |
| `VITE_USDC_ADDRESS` | Token the local jar collects (real Base USDC on a fork) |
| `VITE_LOCAL_RPC_URL` / `VITE_LOCAL_CHAIN_ID` | Where the local chain lives |
| `VITE_TIPJAR_ADDRESS_BASE` | A jar on Base mainnet, if one ever exists |
| `VITE_WALLETCONNECT_PROJECT_ID` | Optional, enables WalletConnect |
| `VITE_DEV_WALLET` | Local only: transact as an unlocked Anvil account |

The front-end ABIs in `web/src/abi/` are generated from the compiled contracts. After changing
`TipJar.sol`, run `npm run abi` (and redeploy) so the UI stays in sync.

## How the local USDC works

The fork has the real USDC contract, but nobody hands out test USDC on it. `scripts/fund-usdc.sh`
writes a balance straight into the token's storage over `anvil_setStorageAt`. It finds the balances
mapping by probing candidate slots — write a marker, read `balanceOf` back, keep the slot that
moved — so it does not depend on a hard-coded storage layout, and it restores any slot it touched
by mistake.

If you point the app at a plain, non-forked Anvil instead, the deploy script notices there is no
contract at the USDC address and deploys `MockUSDC` in its place. Everything else works the same.

## Troubleshooting

- **"No tip jar on …"** — the app is on a chain with no deployment. Start the chain, run
  `npm run deploy:local`, restart `npm run dev` (Vite only reads `.env.local` at startup).
- **Wallet shows a stale balance or nonce** — restarting Anvil resets the chain; in MetaMask use
  *Settings → Advanced → Clear activity tab data* for that account.
- **`Could not locate the USDC balances slot`** — the chain at `RPC_URL` isn't a Base fork.
- **The tip button stays disabled** — check the inline message under it: usually an invalid amount,
  a too-long name/message, or not enough USDC.
- **Fork RPC rate limits** — the public Base endpoint throttles under load; use your own
  `BASE_RPC_URL`.

## Deploying to Base (not done here)

Deliberately out of scope. The pieces that would be needed: a funded deployer key,
`forge script script/Deploy.s.sol --rpc-url <base> --broadcast --verify`, and setting
`VITE_TIPJAR_ADDRESS_BASE` in the front end. The contract has not been audited — treat it as
example code.
