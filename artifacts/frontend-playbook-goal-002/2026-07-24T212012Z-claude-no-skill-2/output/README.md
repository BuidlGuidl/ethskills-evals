# USDC Tip Jar (Base)

A small end-to-end dApp: an onchain **tip jar** that accepts **USDC** tips and a
web page with a **live tip feed**, a **send-a-tip form**, and a
**connect-wallet** flow.

- **Contract** (`contracts/`) — Foundry / Solidity. `TipJar` pulls USDC via
  `transferFrom`, records each tip (sender, amount, message, timestamp) onchain,
  and lets the owner withdraw. Targets Base USDC
  `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, but takes the token address as a
  constructor argument so it can run against a mock token locally.
- **Frontend** (`frontend/`) — Vite + React + TypeScript, using
  **wagmi** + **viem** + **RainbowKit** for wallet connection and contract calls.

Everything runs **locally** against an [anvil](https://book.getfoundry.sh/anvil/)
node. Nothing is deployed to a public network. For local testing the setup
deploys a `MockUSDC` (an ERC-20 with 6 decimals and an open faucet) so you can
mint yourself test funds; on Base you would simply point the `TipJar` at the real
USDC address instead.

---

## Prerequisites

| Tool | Version used | Notes |
|------|--------------|-------|
| [Foundry](https://book.getfoundry.sh/getting-started/installation) | `forge`/`anvil` 1.5.x | `curl -L https://foundry.paradigm.xyz \| bash && foundryup` |
| Node.js | **20 or 22 LTS** | The frontend was built and verified on Node 22. (Node 23+ works for the Vite dev server but is best avoided.) |
| A browser wallet | MetaMask | Injected wallets work out of the box; no WalletConnect account needed. |

---

## Quick start

Open **three terminals** (or run the background steps with `&`). All paths are
relative to this repository root.

### 1. Start a local chain

```bash
anvil
```

Leave it running. It prints ten funded test accounts and their private keys, and
listens on `http://127.0.0.1:8545` (chain id **31337**).

> Start from a **fresh** anvil each time you want the default addresses below to
> match. The deploy is deterministic from the deployer's nonce.

### 2. Deploy the contracts

In a second terminal:

```bash
cd contracts
forge install            # first time only — pulls forge-std
forge test               # optional: run the contract test suite (8 tests)
forge script script/Deploy.s.sol:Deploy \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast
```

This deploys `MockUSDC` and `TipJar`, mints test USDC to the first two anvil
accounts, and seeds two example tips so the feed isn't empty. On a fresh anvil it
always produces these deterministic addresses:

| Contract | Address |
|----------|---------|
| `MockUSDC` | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| `TipJar` | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` |

These are the defaults baked into the frontend, so no extra wiring is needed. If
you deploy to different addresses, override them with a `frontend/.env.local`
(see [Configuration](#configuration)).

### 3. Run the frontend

In a third terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints — **http://localhost:5173** (if 5173 is taken it will
pick the next free port, e.g. 5174; watch the terminal output).

### 4. Connect a wallet to the local chain

In MetaMask:

1. **Add the network** — Networks → Add network manually:
   - Network name: `Anvil Localhost`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency symbol: `ETH`
2. **Import a test account** — use anvil's first account (it's also the tip-jar
   owner and already holds test USDC):
   - Address: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
   - Private key: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`

   > These are anvil's well-known, publicly documented test keys. Never use them
   > on a real network or fund them with real assets.

### 5. Send a tip

1. Click **Connect Wallet** and pick MetaMask.
2. (Optional) Click **Get test USDC** to mint yourself 1,000 test USDC via the
   MockUSDC faucet.
3. Enter an amount and an optional message.
4. Click **Approve USDC** (first tip only — an ERC-20 `approve`), confirm, then
   **Send tip** and confirm.
5. Your tip appears in the **Tip feed**, and the running totals update.

---

## Configuration

The frontend reads a few optional env vars. Copy `frontend/.env.example` to
`frontend/.env.local` to set them:

| Variable | Purpose |
|----------|---------|
| `VITE_TIP_JAR_ADDRESS` | Override the deployed `TipJar` address. |
| `VITE_USDC_ADDRESS` | Override the USDC token address. |
| `VITE_WC_PROJECT_ID` | WalletConnect projectId — only needed for WalletConnect-based wallets. MetaMask/injected works without it. |

### Pointing at Base mainnet

This project is intentionally **not deployed**. To run against Base you would:

1. In `frontend/src/wagmi.ts`, set `ACTIVE_CHAIN = base`.
2. Deploy `TipJar` with the real USDC address
   `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (do **not** deploy `MockUSDC`).
3. Set `VITE_TIP_JAR_ADDRESS` and
   `VITE_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` in
   `frontend/.env.local`.

---

## Contract overview (`TipJar`)

| Function | Description |
|----------|-------------|
| `tip(uint256 amount, string message)` | Pull `amount` USDC from the caller (requires prior `approve`) and record the tip. Reverts on zero amount or failed transfer. Emits `NewTip`. |
| `getRecentTips(uint256 count)` | Most recent `count` tips, newest first (used by the feed). |
| `getAllTips()` | The full tip history, oldest first. |
| `tipCount()` / `totalTipped()` / `jarBalance()` | Feed/stat helpers. |
| `withdraw()` | Owner-only; sends the entire USDC balance to the owner. |
| `transferOwnership(address)` | Owner-only. |

Run the tests any time with:

```bash
cd contracts && forge test -vv
```

---

## Project structure

```
.
├── README.md
├── contracts/                 # Foundry project
│   ├── foundry.toml
│   ├── src/
│   │   ├── TipJar.sol          # the tip jar
│   │   └── MockUSDC.sol        # local-only test USDC (6 decimals + faucet)
│   ├── script/Deploy.s.sol     # local deploy + seed script
│   └── test/TipJar.t.sol       # 8 unit tests
└── frontend/                   # Vite + React + wagmi/RainbowKit
    ├── index.html
    └── src/
        ├── main.tsx            # providers (wagmi, react-query, RainbowKit)
        ├── App.tsx             # layout + stats
        ├── wagmi.ts            # chain + wallet config
        ├── contracts.ts        # addresses + ABIs
        └── components/
            ├── TipForm.tsx     # approve + tip flow, faucet
            └── TipFeed.tsx     # live feed of recent tips
```

---

## Notes

- `MockUSDC` is for **local development only** — it has an open `faucet()`/`mint()`
  and must never be used on a public network.
- The frontend polls the chain for new tips, so the feed updates a few seconds
  after any tip lands (from you or anyone else on the local chain).
- Nothing here is deployed to a public network; the deliverable is this working
  local project.
