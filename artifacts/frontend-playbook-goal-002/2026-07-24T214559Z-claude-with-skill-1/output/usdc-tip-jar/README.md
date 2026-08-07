# 💸 USDC Tip Jar (Base)

A tiny full-stack dApp: an onchain **tip jar** that accepts **USDC tips** on Base,
plus a web page with a **live tip feed**, a **send-a-tip form**, and a
**connect-wallet** flow.

Everything runs **locally against a fork of Base mainnet**, so tips move real
Base USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) — no testnet faucets and
nothing deployed to a live network.

Built with [Scaffold-ETH 2](https://scaffoldeth.io) (Foundry + Next.js + RainbowKit + wagmi).

---

## What's in here

| Piece | Location |
| --- | --- |
| `TipJar` smart contract | `packages/foundry/contracts/TipJar.sol` |
| Contract tests (unit + fuzz) | `packages/foundry/test/TipJar.t.sol` |
| Deploy script | `packages/foundry/script/DeployTipJar.s.sol` |
| USDC-funding helper | `packages/foundry/scripts-js/fundUsdc.js` |
| Web app (feed + form + wallet) | `packages/nextjs/app/page.tsx`, `packages/nextjs/components/tipjar/` |
| USDC token registration for the UI | `packages/nextjs/contracts/externalContracts.ts` |

### How the contract works

USDC is an ERC-20, so tipping is a **two-step** flow for the tipper:

1. `approve(tipJar, amount)` on the USDC token.
2. `tip(amount, message)` on the `TipJar`, which pulls the USDC via `transferFrom`
   and appends the tip to an onchain feed.

`TipJar` records every tip (`from`, `amount`, `message`, `timestamp`), exposes the
feed via `getTips()` / `getRecentTips(n)`, and lets the **owner** (the deployer)
`withdraw()` the collected USDC.

---

## Prerequisites

- **Node.js** — use an LTS that `create-eth` / this toolchain supports:
  `>= 20.17`, or `>= 22.13` (this project was built and tested on **Node 22.23**).
  > Note: very new Node (25+) ships a partial global `localStorage` that breaks
  > Next static prerendering, so stick with Node 22 LTS for a smooth ride.
  > With `nvm`: `nvm install 22 && nvm use 22`.
- **Yarn** (v1 classic works; the repo uses Yarn workspaces).
- **Foundry** (`forge`, `anvil`, `cast`) — https://book.getfoundry.sh/getting-started/installation
- **git**

---

## Setup & run (local, 3 terminals)

From the project root (`usdc-tip-jar/`):

```bash
# 0. Install dependencies (first time only)
yarn install
```

### Terminal 1 — fork Base mainnet

```bash
yarn fork
```

This starts a local Anvil node **forked from Base mainnet** on
`http://127.0.0.1:8545` with **chain id 31337**. Because it's a fork, the real
USDC contract already exists at its Base address, so approvals and transfers work
against real token code. (`--block-time 1` is enabled so `block.timestamp` — and
your tip timestamps — keep advancing like a live chain.)

### Terminal 2 — deploy the TipJar

```bash
yarn deploy
```

Deploys `TipJar` to the fork, pointing it at Base USDC, and writes the address +
ABI into `packages/nextjs/contracts/deployedContracts.ts` for the frontend.

### Terminal 3 — start the web app

```bash
yarn start
```

Open **http://localhost:3000**.

> Uses the webpack bundler (`next dev --webpack`) on purpose — see
> [Troubleshooting](#troubleshooting).

---

## Sending a tip

1. **Connect a wallet** on the site (top-right button):
   - The **built-in burner wallet** is the fastest — it's created for you on the
     local network. Click the connect button and pick it.
   - Or connect **MetaMask** to a custom network: RPC `http://127.0.0.1:8545`,
     chain id `31337`. You can import an Anvil dev account, e.g. account #0
     private key `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`.

2. **Get some test USDC** for your connected address. Real USDC can't be minted
   normally, but on the fork this helper impersonates USDC's minter and mints to
   any address:

   ```bash
   # in a spare terminal, from the project root
   yarn fund-usdc <your-address>        # defaults to 1000 USDC
   yarn fund-usdc <your-address> 250    # or a specific amount
   ```

   (Need ETH for gas too? The burner wallet has a faucet button in the header;
   imported Anvil accounts already start with plenty of ETH.)

3. On the site, enter an **amount** and an optional **message**, then:
   - Click **Approve USDC** (step 1 of 2 — lets the jar move your USDC).
   - Click **Send tip** (step 2 — sends the tip).

Your tip appears in the **Tip feed** immediately, and the stats (total tipped,
in the jar, tip count) update.

### Withdrawing (owner only)

The deployer account (Anvil account #9,
`0xa0Ee7A142d267C1f36714E4a8F75612F20a79720`) owns the jar and can withdraw:

```bash
cast send <TIPJAR_ADDRESS> "withdraw()" \
  --private-key 0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6 \
  --rpc-url http://127.0.0.1:8545
# TIPJAR_ADDRESS is printed by `yarn deploy` and stored in deployedContracts.ts
```

---

## Tests

```bash
yarn foundry:test            # runs forge test (unit + fuzz)
# or, with more fuzzing:
cd packages/foundry && forge test --fuzz-runs 10000
```

The suite covers: config wiring, tip accounting + feed, the `NewTip` event,
recent-tips ordering, and reverts for zero amount, over-long messages, missing
approval, non-owner withdraw, and empty withdraw.

---

## Troubleshooting

- **`Module not found: Can't resolve '@x402/...'`** — RainbowKit → wagmi pulls in
  Coinbase/Base account packages that lazily `import()` optional `@x402/*`
  payment modules this app never installs. The bundler tries to resolve them
  statically and fails. Fixed in `packages/nextjs/next.config.ts` with a webpack
  `IgnorePlugin` for `^@x402/`, which is why the dev script runs on webpack
  (`next dev --webpack`) rather than Turbopack (Turbopack doesn't apply that
  webpack config).
- **Frontend shows no data / wrong chain** — make sure Terminal 1 (`yarn fork`)
  is running and you deployed (Terminal 2). The frontend targets `chains.foundry`
  (31337) for local development — see `packages/nextjs/scaffold.config.ts`.
- **"Not enough USDC"** — run `yarn fund-usdc <your-address>`.
- **Restarting the fork** wipes chain state (tips, balances). Re-run `yarn deploy`
  and `yarn fund-usdc` afterward.

---

## Notes

- **Nothing is deployed to a live network.** This is a local project run against a
  Base fork; the deliverable is the working project and this README.
- Base USDC address (mainnet and on the fork): `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.
- The frontend deliberately targets the local fork (`chains.foundry`, id 31337).
  To point at real Base later you'd switch `targetNetworks` in
  `packages/nextjs/scaffold.config.ts` and deploy the contract to Base.
