# USDC Tip Jar (Base)

A tip jar for [Base](https://base.org): send a **USDC** tip with a public message, watch a
live feed of tips, and let the jar owner withdraw the collected balance.

- **Contract:** `packages/foundry/contracts/TipJar.sol` — accepts USDC
  (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) via `approve` + `tip`, emits a `NewTip`
  event per tip, and lets the owner `withdraw`.
- **Frontend:** `packages/nextjs/app/page.tsx` — jar stats, a tip form (approve → tip), and
  the live tip feed. Ships as a static site for IPFS (see [`DEPLOY.md`](./DEPLOY.md)).

Everything is developed and demoed **locally against real Base state** using an Anvil
fork, so demo tips move real USDC between test identities with **no real money at risk**.

---

## Prerequisites

- Node.js (any recent version for local dev). The IPFS production build is verified on
  Node 25 thanks to `packages/nextjs/polyfill-localstorage.cjs`.
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`anvil`, `cast`, `forge`).
- `yarn install` at the repo root.

## Contract tests

```bash
yarn foundry:test        # or: cd packages/foundry && forge test
```

Tests run against an in-memory 6-decimal mock USDC, so no network/fork is required.

---

## Local workflow — demo against real Base state

The team demos everything on a local **fork of Base**. The fork is a full copy of Base at
the current block, including the real USDC contract and every holder's balance — but it runs
on Anvil (chain id `31337`), so nothing touches mainnet and no real money is spent. We fund a
couple of throwaway test identities with real forked USDC and tip between them.

Open three terminals from the repo root.

### 1. Fork Base

```bash
yarn fork
```

This starts Anvil forking `https://mainnet.base.org` at chain id `31337` with `--block-time 1`
(so `block.timestamp` keeps advancing and the feed timestamps are live). Leave it running.

> To fork a different endpoint (e.g. a faster Alchemy URL), edit the `fork` script default in
> `packages/foundry/package.json`.

### 2. Deploy the tip jar to the fork

```bash
yarn deploy
```

`DeployTipJar.s.sol` deploys `TipJar` pointed at the canonical Base USDC address (the same
address works on the fork and on Base mainnet). The deploy exports the address + ABI to
`packages/nextjs/contracts/deployedContracts.ts`. The deployer (Anvil account
`0xa0Ee7A142d267C1f36714E4a8F75612F20a79720`) is the jar **owner**.

### 3. Fund test identities with real (forked) USDC

Test identities are Anvil's deterministic accounts (already funded with ETH for gas). We give
them USDC by **impersonating a real Base USDC whale** on the fork and transferring from it.

```bash
export RPC=http://127.0.0.1:8545
export USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

# A large USDC holder on Base (any USDC-rich address works; find a current one on the
# Basescan USDC "Holders" tab if this balance ever runs low):
export WHALE=0xcDAC0d6c6C59727a65F871236188350531885C43

# Two throwaway test identities = Anvil accounts #0 and #1:
export ALICE=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
export BOB=0x70997970C51812dc3A010C7d01b50e0d17dc79C8

# Impersonate the whale and send each identity 100 USDC (USDC has 6 decimals):
cast rpc anvil_impersonateAccount $WHALE --rpc-url $RPC
cast rpc anvil_setBalance $WHALE 0xDE0B6B3A7640000 --rpc-url $RPC        # 1 ETH for gas
cast send $USDC "transfer(address,uint256)" $ALICE 100000000 --from $WHALE --unlocked --rpc-url $RPC
cast send $USDC "transfer(address,uint256)" $BOB   100000000 --from $WHALE --unlocked --rpc-url $RPC
cast rpc anvil_stopImpersonatingAccount $WHALE --rpc-url $RPC

# Verify:
cast call $USDC "balanceOf(address)(uint256)" $ALICE --rpc-url $RPC      # -> 100000000
```

### 4. Start the frontend

```bash
yarn start        # http://localhost:3000
```

### 5. Tip in the browser

1. Open http://localhost:3000 and **connect** the built-in **Burner Wallet** (shown on the
   local network), or import an Anvil test key (e.g. Alice's
   `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`) into your wallet.
2. Make sure the **address you connect with holds USDC** — fund it in step 3 (for a burner,
   copy its address from the UI and send USDC to that address instead of Alice/Bob).
3. Enter an amount + message. Because USDC is an ERC-20 the flow is two steps:
   **Approve USDC** → **Send tip**. The button shows whichever step is next.
4. The tip appears in the **Tip feed** and the stats update. Switch to another identity to
   tip again; connect as the owner to **Withdraw** the collected balance.

You can also drive the whole flow headlessly with `cast` — see the commands in `DEPLOY.md`
and the contract functions `tip(uint256,string)` / `withdraw()`.

---

## Deploying to production (static IPFS site)

See [`DEPLOY.md`](./DEPLOY.md) for the exact build, upload, and post-deploy verification
commands. In short: `polyfill-localstorage.cjs` + `NEXT_PUBLIC_IPFS_BUILD=true` produce a
static `out/` directory that you pin to IPFS.

## Project layout

| Path | What |
| --- | --- |
| `packages/foundry/contracts/TipJar.sol` | The tip jar contract |
| `packages/foundry/script/DeployTipJar.s.sol` | Deploy script (Base USDC address) |
| `packages/foundry/test/TipJar.t.sol` | Foundry tests (mock USDC) |
| `packages/nextjs/app/page.tsx` | Tip jar page |
| `packages/nextjs/components/tipjar/*` | `JarStats`, `TipForm`, `TipFeed` |
| `packages/nextjs/contracts/externalContracts.ts` | USDC ABI/address for chains 31337 + 8453 |
