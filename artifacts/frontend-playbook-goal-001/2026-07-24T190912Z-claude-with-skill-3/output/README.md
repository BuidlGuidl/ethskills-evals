# USDC Tip Jar (Base)

A tiny dApp where anyone can leave a **USDC tip** with a short message, and the owner can
withdraw the collected balance. Built on [Scaffold-ETH 2](https://scaffoldeth.io) (Foundry
flavor) for **Base**.

- **Contract:** `packages/foundry/contracts/TipJar.sol` — pulls USDC via `transferFrom`
  (SafeERC20), records each tip + message, lets the owner withdraw.
- **Frontend:** `packages/nextjs/app/page.tsx` — a live tip feed plus an approve → tip form.
- **USDC on Base:** `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (6 decimals).

The whole thing is developed and demoed **locally against a fork of real Base**, so tips move
real USDC between test identities without any real money at risk. It ships as a **static build
on IPFS** — see [`DEPLOY.md`](./DEPLOY.md).

---

## Requirements

- [Node >= v20.18.3](https://nodejs.org/en/download/) (Node 23+ works too — see the note below)
- [Yarn](https://yarnpkg.com/)
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`anvil` + `cast` on your PATH)
- [Git](https://git-scm.com/downloads)

> **Node 23+ note:** newer Node ships a broken global `localStorage`. This repo already
> compensates (a polyfill is `--require`d by the `dev`, `start`, and IPFS build scripts), so
> `yarn start` and the production build work on Node 20–25 alike. Nothing extra to do.

```bash
yarn install
```

---

## Local demo workflow (against real Base state)

Everything below runs on a **local Anvil fork of Base** (chain id `31337`). The fork copies
Base's real state — including the real USDC contract — but every transaction stays on your
machine. **No transaction ever touches Base mainnet, so no real money is at risk.** We mint
USDC to throwaway "test identities" using USDC's own minter (impersonated on the fork), then
send tips between them.

Use three terminals.

### Terminal 1 — fork Base

```bash
yarn fork
```

This runs `anvil --fork-url base --chain-id 31337 --block-time 1`, forking Base from
`foundry.toml`'s `base` RPC. `--block-time 1` mines a block per second so tip timestamps
advance. Leave it running.

### Terminal 2 — deploy the TipJar to the fork

```bash
yarn deploy
```

Deploys `TipJar` pointing at the real Base USDC address and writes its ABI/address to
`packages/nextjs/contracts/deployedContracts.ts`.

### Seed test identities with real USDC

With the fork running, give your test wallets USDC (and some ETH for gas):

```bash
# Default: seeds Anvil accounts #0 and #1 with 1,000 USDC each
bash packages/foundry/scripts-js/seed-usdc.sh

# Or seed a specific wallet (e.g. the burner address the app shows you)
bash packages/foundry/scripts-js/seed-usdc.sh 0xYourWalletAddress

# Custom amount (base units, 6 decimals). 5,000 USDC:
AMOUNT=5000000000 bash packages/foundry/scripts-js/seed-usdc.sh 0xAlice 0xBob
```

The script impersonates USDC's `masterMinter` on the fork, authorizes a minter, and mints
fresh USDC to each address — so it never depends on any whale's balance.

**Test identities.** The two defaults are Anvil's deterministic accounts, whose private keys
are public and perfect as throwaways:

| Account | Address | Private key |
| ------- | ------- | ----------- |
| #0 | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| #1 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |

Import a key into MetaMask/Rainbow (add a custom network: RPC `http://127.0.0.1:8545`,
chain id `31337`), or just use the built-in **burner wallet** the app shows on the local
network and seed that address.

### Terminal 3 — run the frontend

```bash
yarn start
```

Open http://localhost:3000. The app targets the local fork (`chains.foundry`, id `31337`) —
see `packages/nextjs/scaffold.config.ts`.

### Demo a tip

1. Connect wallet (or use the burner). Make sure that address was seeded above.
2. Enter an amount (e.g. `2.5`) and a message.
3. First tip needs a one-time **Approve** (USDC allowance), then **Send tip**.
4. Watch the **Tip feed** and the **Total tipped / In the jar** stats update — that's real
   USDC moving on the fork.
5. As the owner (the deployer, Anvil account #9), call `withdraw()` from the **Debug
   Contracts** page to pull the balance out.

You can also drive it entirely from the CLI:

```bash
JAR=$(grep -o '0x[a-fA-F0-9]\{40\}' packages/nextjs/contracts/deployedContracts.ts | head -1)
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
PK=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80  # Anvil #0
cast send $USDC "approve(address,uint256)" $JAR 2500000 --private-key $PK --rpc-url http://127.0.0.1:8545
cast send $JAR "tip(uint256,string)" 2500000 "gm from the cli" --private-key $PK --rpc-url http://127.0.0.1:8545
cast call $JAR "getRecentTips(uint256)((address,uint256,uint256,string)[])" 5 --rpc-url http://127.0.0.1:8545
```

---

## Tests

```bash
yarn foundry:test          # unit + fuzz tests for TipJar
```

---

## Deploying

- **Frontend → IPFS static build:** [`DEPLOY.md`](./DEPLOY.md).
- **Contract → real Base:** `yarn deploy --file DeployTipJar.s.sol --network base` (requires a
  funded keystore account; see `yarn account`).

---

## Built with Scaffold-ETH 2

This project is scaffolded with [Scaffold-ETH 2](https://scaffoldeth.io) — NextJS, RainbowKit,
Foundry, Wagmi, Viem, and TypeScript. See the [docs](https://docs.scaffoldeth.io).
