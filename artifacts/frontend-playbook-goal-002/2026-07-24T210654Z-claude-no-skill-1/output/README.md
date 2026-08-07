# USDC Tip Jar (Base)

A small full-stack dApp: an onchain **TipJar** contract that accepts **USDC**
tips with a message, and a web app with a live tip feed, a send-a-tip form, and
a connect-wallet flow.

On Base mainnet the jar is meant to point at the canonical USDC token
`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. This repository runs the whole
thing **locally** against a [Foundry](https://book.getfoundry.sh/) `anvil`
chain — nothing is deployed to a live network. Because a fresh local chain has
no real USDC, local setup deploys a small `MockUSDC` (6 decimals) with an open
faucet so you can mint yourself test USDC.

```
workspace/
├── contracts/                 # Foundry project (Solidity)
│   ├── src/TipJar.sol         # the tip jar
│   ├── src/MockUSDC.sol       # local-only test USDC with a mint() faucet
│   ├── script/Deploy.s.sol    # deploy + write frontend config
│   └── test/TipJar.t.sol      # contract tests
├── frontend/                  # Next.js + wagmi + RainbowKit + viem
│   └── lib/deployedContracts.json  # addresses (written by the deploy script)
├── Makefile                   # convenience targets
└── README.md
```

## Prerequisites

- **Foundry** (`forge`, `anvil`, `cast`) — install:
  `curl -L https://foundry.paradigm.xyz | bash && foundryup`
- **Node.js 20+** and **npm**
- **MetaMask** (or another injected browser wallet) to send tips from the UI

## Setup — run it locally

You'll use **three terminals**: one for the chain, one to deploy, and one for
the web app. Run all commands from the `workspace/` root.

### 1. Start the local chain (terminal 1)

```bash
anvil
```

Leave this running. It prints 10 prefunded test accounts and their private keys.
It listens on `http://127.0.0.1:8545` with **chain id 31337**.

### 2. Deploy the contracts (terminal 2)

```bash
cd contracts
forge install            # first time only: pulls forge-std
forge test               # optional: run the contract tests
forge script script/Deploy.s.sol:Deploy \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

That private key is anvil's first prefunded account (a well-known local test
key — never use it on a real network). The script:

1. deploys `MockUSDC`,
2. deploys `TipJar` pointing at it, and
3. writes the addresses to `frontend/lib/deployedContracts.json`.

On a freshly started anvil chain the addresses are deterministic, so the
values checked into `deployedContracts.json` already match a clean deploy:

| Contract | Address |
| --- | --- |
| MockUSDC | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| TipJar   | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` |

### 3. Start the web app (terminal 3)

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**. The tip feed and stats read straight from the
chain and will render even before you connect a wallet.

### 4. Connect a wallet and configure MetaMask

1. **Add the local network** in MetaMask → *Add network manually*:
   - Network name: `Anvil Local`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency symbol: `ETH`
2. **Import a test account**: MetaMask → *Import account* → paste one of the
   private keys anvil printed (e.g. account 0's key above). Each account starts
   with 10,000 test ETH for gas.
3. Back in the app, click **Connect Wallet** and select MetaMask.

### 5. Send a tip

1. Click **Mint 100 test USDC** (the faucet button, shown only in local/mock
   mode) to give your account some USDC.
2. Enter an amount and an optional message.
3. USDC uses a two-step flow, so the button first shows **Approve USDC** — click
   it and confirm. Once the approval confirms it becomes **Send tip** — click
   and confirm.
4. Your tip appears at the top of the feed within a few seconds (the feed
   polls the chain), and the totals update.

> **Tip:** import a second anvil account into MetaMask to tip from a different
> address and watch the shared feed update for both.

## Contract overview (`TipJar.sol`)

- `tip(uint256 amount, string message)` — pulls `amount` of USDC from the caller
  (requires prior `approve`), records the tip, and emits `NewTip`.
- `getRecentTips(uint256 count)` — the feed, newest first.
- `tipCount()`, `totalTipped()`, `tippedBy(address)`, `balance()` — read helpers.
- `withdraw()` — owner-only; sends the jar's full USDC balance to the owner.
- `transferOwnership(address)` — owner-only.

USDC transfers are checked for both a `false` return and a revert; a failed
transfer leaves the tip unrecorded.

## Handy Make targets

```bash
make chain      # anvil
make test       # forge test
make deploy     # deploy + write frontend config
make frontend   # next dev
```

## Using real Base USDC (optional, still local)

To exercise the real USDC contract, run anvil as a **fork** of Base and tell
the deploy script to use the canonical address instead of the mock:

```bash
# terminal 1 — fork Base mainnet
anvil --fork-url https://mainnet.base.org

# terminal 2 — deploy against real USDC
cd contracts
USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
forge script script/Deploy.s.sol:Deploy \
  --rpc-url http://127.0.0.1:8545 --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

The deploy script skips `MockUSDC` when `USDC_ADDRESS` is set, and the app
hides the faucet button (you'd fund yourself by impersonating a USDC holder on
the fork with `cast`). This project intentionally does **not** deploy to any
live network.

## Troubleshooting

- **Feed shows a read error** — make sure `anvil` is running, you've run the
  deploy step, and MetaMask is on the `Anvil Local` (31337) network.
- **"Nonce too high" / stale state in MetaMask** — you restarted anvil. In
  MetaMask: *Settings → Advanced → Clear activity tab data* for the imported
  account, and re-deploy (fresh anvil ⇒ same deterministic addresses).
- **WalletConnect warning in the console** — harmless locally. Set
  `NEXT_PUBLIC_WC_PROJECT_ID` in `frontend/.env.local` (see `.env.example`) if
  you want the WalletConnect option to work.

## Notes / limitations

- `MockUSDC` is a minimal ERC-20 for local testing only and has an open `mint`.
- The frontend targets only the local chain (31337); swap `localAnvil` in
  `frontend/lib/contracts.ts` and redeploy to point elsewhere.
