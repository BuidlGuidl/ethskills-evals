# 💸 USDC Tip Jar on Base

A tiny dApp that accepts **USDC tips on Base** and shows a live tip feed.

- **Contract** — `packages/foundry/contracts/TipJar.sol`. Accepts tips in Base USDC
  (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`), records a feed of
  `(from, amount, timestamp, message)`, and lets the owner withdraw collected tips.
- **Frontend** — `packages/nextjs/app/page.tsx`. A tip form (approve → tip) plus the
  live feed, jar totals, and an owner-only withdraw button.

The whole thing is developed and demoed **locally against a fork of real Base state**,
so demo tips move real USDC between test identities with **no real money at risk**.
Production ships as a **static build on IPFS** — see [`DEPLOY.md`](./DEPLOY.md).

---

## Requirements

- [Node (>= v20.18.3)](https://nodejs.org/en/download/) — Node 22+/25 is fine
- Yarn (this repo uses Yarn 4 via corepack)
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`anvil`, `cast`, `forge`)
- [Git](https://git-scm.com/downloads)

Install dependencies once:

```bash
yarn install
```

---

## Local workflow: demo against real Base state

Everything below runs on a **local Anvil fork of Base mainnet**. The fork has the real
Base USDC contract and all of Base's real state, but it is exposed as **chain id 31337**
and every account/balance is local — nothing you do touches mainnet or costs real money.

You need **three terminals** (from the repo root).

### 1. Start a local fork of Base

```bash
yarn fork:base
```

This runs `anvil --fork-url https://mainnet.base.org --chain-id 31337`. Leave it running.

> Using your own Base RPC? Override it:
> `yarn workspace @se-2/foundry fork:base` reads `BASE_RPC_URL`, e.g.
> `BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/<KEY> yarn fork:base`.

### 2. Deploy the TipJar to the fork

```bash
yarn deploy
```

`DeployTipJar.s.sol` deploys `TipJar` pointed at the canonical Base USDC address (the
same address resolves on the fork). The deploy auto-exports the ABI + address to
`packages/nextjs/contracts/deployedContracts.ts`.

The deployer (Anvil account `#9`,
`0xa0Ee7A142d267C1f36714E4a8F75612F20a79720`) becomes the jar **owner**.

### 3. Start the frontend

```bash
yarn start
```

Open http://localhost:3000. The app targets the local fork (chain `31337`) by default and
shows a **Burner Wallet** — that is your first test identity.

### 4. Fund a test identity with USDC

Copy your connected burner address from the top of the page, then fund it:

```bash
# from the repo root — AMOUNT is whole USDC (default 1000)
yarn fund RECIPIENT=0xYourBurnerAddress AMOUNT=500
```

This mints USDC **into the forked USDC contract's balance storage** for that address, so
you get spendable, real-contract USDC with no real money involved. It prints the new
balance to confirm. Refresh the app and your USDC balance appears in the tip form.

### 5. Send a tip (moves real USDC between test identities)

In the tip form, enter an amount + message and click **Send tip**. The app:

1. `approve`s the TipJar to spend that much USDC (only when the current allowance is too
   low), then
2. calls `tip(amount, message)`, which does a real USDC `transferFrom` from you into the
   jar.

The tip appears instantly in the **Tip feed**, and **Collected in jar** updates.

### 6. Demo a second identity

Open the **Burner Wallet** menu (top-right) and generate/switch to a new burner — that is
a second test identity. Fund it (step 4) and tip again. You now have real USDC moving
between distinct test identities, all on the local fork.

### 7. Withdraw (owner only)

The withdraw button only appears for the jar owner. To demo it, point the app at the
owner account, or drive it from the CLI against the fork:

```bash
cast send <TIPJAR_ADDRESS> "withdraw()" \
  --private-key 0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6 \
  --rpc-url http://127.0.0.1:8545
```

(That key is Anvil account `#9`, the default local deployer/owner.) The jar balance goes
to zero and the owner receives the collected USDC.

---

## Reset the demo

Stop `anvil` (Ctrl-C in terminal 1) and restart with `yarn fork:base`. A fresh fork wipes
all local state (deployments, tips, funded balances). Re-run `yarn deploy`.

---

## Tests

```bash
yarn test        # foundry unit tests for TipJar (mock 6-decimal USDC)
```

---

## Project layout

| Path | What |
| --- | --- |
| `packages/foundry/contracts/TipJar.sol` | The tip jar contract |
| `packages/foundry/script/DeployTipJar.s.sol` | Deploy script (USDC address baked in) |
| `packages/foundry/test/TipJar.t.sol` | Unit tests |
| `packages/foundry/Makefile` | `fork-base`, `fund-usdc` targets |
| `packages/nextjs/app/page.tsx` | Tip jar page |
| `packages/nextjs/app/_components/` | `TipForm`, `TipFeed`, `JarSummary` |
| `packages/nextjs/contracts/externalContracts.ts` | USDC token (ABI + address) |
| `packages/nextjs/scaffold.config.ts` | Target network (fork ↔ Base via env) |
| `DEPLOY.md` | Production IPFS build + deploy + verification |

---

## How "real USDC, no real money" works

- The local chain is a **fork** of Base: same USDC contract, same code, same on-chain
  state — but it is a private copy running on your machine (chain id `31337`).
- Funding uses an Anvil cheat (`anvil_setStorageAt`) to set a test account's USDC balance
  on the fork. This is only possible locally and affects nothing on real Base.
- The tip itself is a genuine ERC-20 `transferFrom` on the real USDC contract code, so the
  demo exercises the exact same code path you'd hit on mainnet.
