# 💸 USDC Tip Jar on Base

A [Scaffold-ETH 2](https://scaffoldeth.io) (Foundry) dApp that accepts **USDC tips on Base**.
It ships two things:

- **`TipJar` contract** — pulls USDC via `approve` + `transferFrom`, records every tip
  (sender, amount, message, timestamp) in an on-chain feed, and lets the owner withdraw.
- **Tip page** — jar stats, a live tip feed, and a form to approve + send a tip.

Base USDC: [`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`](https://basescan.org/address/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)

The team develops and demos **locally against real Base state**: a Base mainnet fork served
on a local anvil chain. Tips move the **real USDC contract's** balances between test
identities, but nothing touches mainnet and **no real money is at risk**.

> Shipping the site? See **[DEPLOY.md](./DEPLOY.md)** for the static IPFS build, upload, and
> post-deploy verification commands.

---

## Requirements

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge`, `anvil`, `cast`)
- **Node 20 or 22** and Yarn v3+. Use one of these for both `yarn start` and the IPFS build —
  Node ≥ 23 crashes Next's server rendering with `localStorage.getItem is not a function`.
- `git`

Install dependencies once:

```bash
yarn install
```

---

## Local workflow (real Base state, no real money)

Run each numbered step in its own terminal. Everything targets a Base **fork** at
`http://127.0.0.1:8545` with chain id `31337`.

### 1. Start a Base mainnet fork

```bash
yarn fork:base
```

This runs `anvil --fork-url https://mainnet.base.org --chain-id 31337`. The fork has the
real Base USDC contract and all of its balances/logic — it just runs on your machine.

> Prefer your own RPC (the public endpoint is rate-limited)? Pass one in:
> `yarn workspace @se-2/foundry fork:base` with `BASE_RPC_URL` set, e.g.
> `BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/<key> yarn fork:base`.

### 2. Deploy the TipJar to the fork

```bash
yarn deploy:fork
```

Deploys `TipJar(USDC, deployer)` and regenerates the frontend ABIs into
`packages/nextjs/contracts/deployedContracts.ts`.

> Why `deploy:fork` instead of `yarn deploy`? On a Base fork the default deployer account
> already has a transaction history on real Base, so `forge` needs an explicit `--sender`
> to read the right nonce. `yarn deploy:fork` passes it for you. (`yarn deploy` is still the
> command for a fresh anvil chain or a live network.)

### 3. Fund test identities with real USDC

```bash
# Fund the default anvil accounts (100 USDC each)
yarn fund

# Also fund a specific address — e.g. copy your in-app burner wallet address:
yarn fund 0xYourBurnerAddress

# Custom amount:
AMOUNT=250 yarn fund 0xYourBurnerAddress
```

`yarn fund` impersonates USDC's on-chain `masterMinter` on the fork, registers a local
minter, and mints real USDC to each recipient. No mainnet transaction is sent.

### 4. Start the frontend

```bash
yarn start
```

Open **http://localhost:3000**.

### 5. Demo a tip

1. Connect the **Burner Wallet** (shown automatically on the local network). Copy its
   address and fund it: `yarn fund <burnerAddress>`.
2. Enter an amount and a message, then **Send tip**. The first tip asks for two wallet
   confirmations: one to `approve` USDC, one to `tip`.
3. The tip appears in the feed and the jar stats update — real USDC just moved from your
   test identity into the jar.
4. To withdraw, connect the **owner** account (the deployer,
   `0xa0Ee7A142d267C1f36714E4a8F75612F20a79720`) and call `withdraw()` from the
   `Debug Contracts` page.

---

## Contract tests

```bash
yarn foundry:test
```

Unit tests use a 6-decimal mock USDC (no fork needed) and cover the tip/approve flow, the
feed ordering, event emission, access control, and withdrawal.

---

## Project layout

| Path | What |
| --- | --- |
| `packages/foundry/contracts/TipJar.sol` | The tip jar contract |
| `packages/foundry/script/DeployTipJar.s.sol` | Deploy script (uses Base USDC, override with `USDC_ADDRESS`) |
| `packages/foundry/scripts-js/fund-usdc.sh` | Mints real USDC to test identities on the fork |
| `packages/foundry/test/TipJar.t.sol` | Contract tests |
| `packages/nextjs/app/page.tsx` | Tip page (stats + feed + form) |
| `packages/nextjs/components/tipjar/` | `JarStats`, `TipFeed`, `TipForm` |
| `packages/nextjs/contracts/externalContracts.ts` | USDC ABI (+ Base TipJar for production) |
| `packages/nextjs/scaffold.config.ts` | Targets Base fork locally, Base mainnet for the IPFS build |

---

Built with [Scaffold-ETH 2](https://scaffoldeth.io).
