# USDC Tip Jar (Base)

A tip jar that accepts **USDC on Base** and shows every tip in an onchain feed.

- `TipJar.sol` — pulls USDC with `transferFrom`, stores each tip (sender, amount, message, timestamp) onchain, and lets the owner withdraw.
- Next.js frontend — connect-wallet flow, a tip form (approve + tip in one click), and a live tip feed.

Everything runs locally against a **fork of Base**, so the app talks to the real
USDC contract at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` rather than a mock
token. Nothing is deployed to a public network.

Built with [Scaffold-ETH 2](https://scaffoldeth.io) (Foundry + Next.js).

---

## Requirements

- [Node.js](https://nodejs.org) >= 20.18.3
- [Yarn](https://yarnpkg.com) (v1 is enough to bootstrap; the repo pins Yarn 4 via corepack)
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`anvil`, `forge`, `cast`)
- Git, and outbound internet access — the fork streams Base state from `https://mainnet.base.org`

## Setup

```bash
yarn install
```

Then run these three commands, each in its own terminal.

### 1. Start the Base fork

```bash
yarn fork
```

Runs `anvil` as a local copy of Base on `http://127.0.0.1:8545` with **chain ID 31337**.
It mines a block every second (`--block-time 1`) so `block.timestamp` keeps moving
and the "just now / 3m ago" labels in the feed stay accurate.

The frontend targets this local chain (`chains.foundry` in
`packages/nextjs/scaffold.config.ts`) — not Base itself.

### 2. Deploy the contract to the fork

```bash
yarn deploy
```

Deploys `TipJar` pointed at the real Base USDC address and writes its address and ABI
to `packages/nextjs/contracts/deployedContracts.ts`. The deployer (Anvil account #9,
`0xa0Ee7A142d267C1f36714E4a8F75612F20a79720`) becomes the jar owner.

The deploy script refuses to run if there is no USDC code at that address, which is
the quick way to notice you started a plain `yarn chain` instead of `yarn fork`.

### 3. Start the frontend

```bash
yarn start
```

Open <http://localhost:3000>.

### 4. Give yourself some USDC

A fresh wallet has no USDC. The fork lets us take some from an account that already
holds it on Base:

```bash
yarn fund <your-address> [amount]   # default 1000 USDC
```

This impersonates a USDC whale, transfers to your address, and tops it up with ETH
for gas. Nothing is broadcast to Base.

Your address is shown in the top-right of the app. On the local chain
Scaffold-ETH auto-connects a **burner wallet**, so the fastest path is: open the app,
copy the address from the header, run `yarn fund <address>`, and the balance under the
tip form updates on the next block.

To use MetaMask instead, add a network with RPC `http://127.0.0.1:8545` and chain ID
`31337`, connect it with **Connect Wallet**, then fund that address.

## Using the app

1. **Connect a wallet** — the header button (or the one inside the tip form) opens the
   wallet picker: MetaMask, WalletConnect, Ledger, Base, Rainbow, or the local Burner Wallet.
2. **Send a tip** — enter an amount (or hit `$1` / `$5` / `$25`), optionally add a message,
   and press *Approve & tip*. USDC is an ERC20, so the first tip needs an `approve`
   transaction; the app sends it only when the current allowance is too small and then
   sends the tip in the same click.
3. **Watch the feed** — the tip appears immediately, newest first, with the sender,
   message, and relative time. The feed is read straight from the contract on each new
   block, so no indexer is involved.
4. **Withdraw** — connect as the jar owner and a *Withdraw $X* button appears under the
   stats. Withdrawing empties the jar but keeps the tip history.

## Tests

```bash
yarn test
```

- `packages/foundry/test/TipJar.t.sol` — unit tests against a mock 6-decimal ERC20
  (tipping, allowance failures, message limit, feed ordering, owner-only withdrawal).
- `packages/foundry/test/TipJarFork.t.sol` — the same flow against the **real USDC
  contract** on a Base fork. It needs network access; skip it with
  `yarn test --no-match-contract TipJarForkTest`.

## The contract

`packages/foundry/contracts/TipJar.sol`

| Member | Purpose |
| --- | --- |
| `tip(uint256 amount, string message)` | Pulls `amount` USDC (6 decimals) from the caller, records it, emits `NewTip`. Requires an allowance. |
| `recentTips(uint256 limit)` | Most recent tips, newest first — what the feed renders. |
| `tips(uint256)` / `tipCount()` | Full history, oldest first. |
| `totalTipped()` / `tippedBy(address)` | Lifetime totals, unaffected by withdrawals. |
| `balance()` | USDC currently in the jar. |
| `withdraw()` | Owner-only; sends the whole balance to the owner. |
| `MAX_MESSAGE_LENGTH` | 200 bytes; longer messages revert with `MessageTooLong`. |

Amounts are USDC base units: `1 USDC == 1_000_000`.

## Layout

```
packages/foundry/
  contracts/TipJar.sol            the tip jar
  script/DeployTipJar.s.sol       deploy, wired to Base USDC
  test/TipJar.t.sol               unit tests (mock ERC20)
  test/TipJarFork.t.sol           fork test (real USDC on Base)
  scripts-js/fundUsdc.js          `yarn fund` — USDC + ETH for a local address
packages/nextjs/
  app/page.tsx                    the tip jar page
  components/tipjar/              TipForm, TipFeed, JarSummary, OwnerWithdraw
  contracts/externalContracts.ts  USDC address + ABI (31337 and 8453)
  utils/usdc.ts                   amount parsing/formatting, relative time
```

Scaffold-ETH's **Debug Contracts** tab (<http://localhost:3000/debug>) is handy for
calling `TipJar` and `USDC` directly.

## Troubleshooting

- **"No USDC contract at the Base USDC address"** — the chain running on port 8545 is not
  a Base fork. Stop it and run `yarn fork`.
- **Tip button disabled / "Not enough USDC"** — fund the connected address with
  `yarn fund <address>`.
- **Frontend shows stale or zero values after restarting the fork** — the fork starts from
  scratch, so re-run `yarn deploy` (and `yarn fund`), then reload the page.
- **Fork fails to start with "Address already in use"** — an `anvil` is still running:
  `pkill anvil`.

## Not deployed

This project is local-only by design: no contracts are deployed to Base or any testnet,
and the frontend is not hosted anywhere. `packages/nextjs/scaffold.config.ts` targets the
local fork; pointing it at Base would mean a real deployment and a real USDC jar.
