# 💸 USDC Tip Jar (Base)

A minimal onchain tip jar for **Base USDC**. Anyone can send a USDC tip with a
short message; every tip is recorded onchain and shown in a public feed. The jar
owner can withdraw the collected USDC.

Built with [Scaffold-ETH 2](https://scaffoldeth.io) (Foundry + Next.js + wagmi +
RainbowKit). It runs entirely against a **local Anvil fork of Base**, so the real
Base USDC contract (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) is used as the
tip token — nothing is deployed to a live network.

---

## What's in here

| Piece | Location |
| --- | --- |
| `TipJar` contract | `packages/foundry/contracts/TipJar.sol` |
| Deploy script | `packages/foundry/script/DeployTipJar.s.sol` |
| Contract tests | `packages/foundry/test/TipJar.t.sol` |
| Frontend page | `packages/nextjs/app/page.tsx` |
| Tip form / feed / stats | `packages/nextjs/components/tipjar/` |
| Test-USDC funding helper | `packages/foundry/scripts-js/fund-usdc.sh` |

### How the contract works

- `tip(uint256 amount, string message)` pulls `amount` of USDC from the caller
  (via `transferFrom`, so an ERC-20 `approve` is required first), appends a `Tip`
  to the onchain feed, and emits `NewTip`.
- `getAllTips()` / `getRecentTips(n)` / `tipCount()` expose the feed.
- `totalTipped`, `jarBalance()`, and `tippedBy(address)` expose running totals.
- `withdraw()` (owner-only) sends the full jar balance to the owner.

USDC has **6 decimals**, so `1 USDC = 1_000_000` in the smallest unit.

---

## Prerequisites

- **Node.js** (works on Node 20+; tested on Node 25 — see notes below)
- **Yarn** (v3+, comes with the repo via Corepack)
- **Foundry** (`forge`, `cast`, `anvil`) — install: https://getfoundry.sh
- An Ethereum wallet browser extension (e.g. MetaMask) if you want to connect a
  real wallet. Otherwise the app auto-connects a local **burner wallet**.

---

## Run it locally

You'll use **three terminals**. Run every command from the project root.

### 1. Install dependencies

```bash
yarn install
```

### 2. Terminal 1 — start a fork of Base

```bash
yarn fork
```

This starts Anvil as a fork of Base mainnet on `http://127.0.0.1:8545` with chain
id `31337` and 1-second block mining. Because it's a real fork, Base USDC already
exists on it. (Override the RPC with `FORK_URL=<url> yarn fork` if you have your
own Base endpoint — the default public RPC works but can be slow.)

### 3. Terminal 2 — deploy the TipJar

```bash
yarn deploy
```

Deploys `TipJar` pointed at Base USDC and regenerates
`packages/nextjs/contracts/deployedContracts.ts` for the frontend.

### 4. Terminal 3 — start the frontend

```bash
yarn start
```

Open **http://localhost:3000**. You'll see the jar stats, a tip form, and the
(initially empty) tip feed.

---

## Sending a tip locally

A freshly-connected wallet on the fork has **no USDC**, so fund it first with the
included helper (uses Anvil's `setStorageAt` to write a test balance — it does not
touch total supply and only affects your local fork):

```bash
# From the project root, in a spare terminal:
cd packages/foundry
./scripts-js/fund-usdc.sh <your-wallet-address> 1000   # gives 1000 test USDC
```

Get `<your-wallet-address>` from the top-right of the app (click the address to
copy it). If you're using the built-in burner wallet, that's the address shown in
the header.

Then in the UI:

1. **Connect** your wallet (top-right). The burner wallet connects automatically;
   for MetaMask, add a network with RPC `http://127.0.0.1:8545` and chain id
   `31337`, and switch to it.
2. Enter an **amount** (in USDC) and an optional **message**.
3. Click **Approve USDC** (first time only — this sets the ERC-20 allowance).
4. Click **Send tip**. The stats and feed update automatically.

---

## Testing the contract

```bash
yarn foundry:test          # run the test suite
# or, for fuzzing:
cd packages/foundry && forge test --fuzz-runs 10000
```

The suite (`packages/foundry/test/TipJar.t.sol`) covers the tip flow, the feed
ordering, message-length and zero-amount guards, owner-only withdrawal, and a
fuzz test — all against a mock 6-decimal USDC.

---

## Notes / gotchas baked into this project

These are pre-configured so `yarn start` "just works"; documented here so you know
why the config differs from a stock Scaffold-ETH 2 app:

- **Local network = `chains.foundry` (31337), not `chains.base`.** The fork runs
  on Anvil with chain id 31337, so `packages/nextjs/scaffold.config.ts` targets
  `chains.foundry`. You'd only switch to `chains.base` to deploy to the real
  network (which this project intentionally does not do).
- **Base USDC as an external contract.** `packages/nextjs/contracts/externalContracts.ts`
  registers USDC (same address on chain 31337 and 8453) so the app can read
  balances/allowance and call `approve`.
- **Next.js forced onto webpack.** The `dev`/`start` scripts use `next dev
  --webpack`. The RainbowKit → wagmi → Base Account connector transitively imports
  optional `@x402/*` modules that aren't installed; a webpack `IgnorePlugin` in
  `next.config.ts` ignores them (Turbopack ignores that config, hence `--webpack`).
- **Node 25 `localStorage` polyfill.** Node 25 ships a built-in `localStorage`
  missing `getItem`/`setItem`, which crashes SSR. The `dev`/`start` scripts
  `--require ./polyfill-localstorage.cjs` to shim it.

---

## Not included (by design)

This deliverable is the **working local project**. It is **not** deployed to any
network, IPFS, or hosting provider.
