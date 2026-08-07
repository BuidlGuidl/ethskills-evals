# 🫙 USDC Tip Jar (Base)

A small dApp for accepting **USDC tips on Base**. It has:

- **`TipJar.sol`** — an on-chain contract that pulls USDC from a tipper (with an optional
  message), keeps a queryable feed of every tip, and lets the owner withdraw.
- **A web frontend** — connect a wallet, see the live tip feed and totals, and send a tip
  through an approve → tip flow.

Everything runs **locally against a fork of Base mainnet**, so the contract talks to the
_real_ Base USDC token (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`). Nothing is deployed
to a public network.

Built with [Scaffold-ETH 2](https://docs.scaffoldeth.io) (Foundry + Next.js + RainbowKit + wagmi/viem).

---

## How it works

| Piece | Location |
| --- | --- |
| Tip jar contract | `packages/foundry/contracts/TipJar.sol` |
| Deploy script | `packages/foundry/script/DeployTipJar.s.sol` |
| Contract tests | `packages/foundry/test/TipJar.t.sol` |
| Frontend page | `packages/nextjs/app/page.tsx` |
| Tip form / feed / stats | `packages/nextjs/components/tipjar/` |
| USDC (external contract) ABI | `packages/nextjs/contracts/externalContracts.ts` |
| Local funding helper | `fund.sh` |

`TipJar` takes the USDC address at deploy time. On a Base fork this is the real USDC
contract, so tips move real (forked) USDC. Tippers must `approve` the jar for the amount
first (standard ERC-20 flow), then call `tip(amount, message)`.

### Why a fork instead of a bare local chain?

USDC only exists on real networks. Forking Base gives us a local chain (Anvil, chain id
`31337`) that has the actual USDC contract and its state, so the tip flow behaves exactly
like production without deploying anything.

---

## Prerequisites

- **Node.js 20 or 22** (LTS). Tested on 22. Newer majors (23+) have a static-export
  quirk that doesn't affect local dev but is worth avoiding.
- **Yarn** (v3/v4 — the repo is set up for it)
- **Foundry** (`forge`, `cast`, `anvil`) — https://book.getfoundry.sh/getting-started/installation

Check:

```bash
node --version   # v20.x or v22.x
yarn --version
forge --version
```

---

## Run it locally

Open **three terminals** in the project root. Keep terminals 1 and 3 running.

### 0. Install

```bash
yarn install
```

### 1. Start a Base fork (Terminal 1)

```bash
yarn fork base
```

This runs Anvil as a fork of Base mainnet on `http://127.0.0.1:8545` (chain id `31337`,
mining a block every second so timestamps advance). Leave it running. The `base` RPC alias
is defined in `packages/foundry/foundry.toml`.

### 2. Deploy the TipJar (Terminal 2)

```bash
yarn deploy
```

Deploys `TipJar` wired to real Base USDC and writes the address + ABI to
`packages/nextjs/contracts/deployedContracts.ts`. The deploying account becomes the jar
owner. (This terminal is now free.)

### 3. Start the frontend (Terminal 3)

```bash
yarn start
```

Open **http://localhost:3000**.

> The frontend is configured for the local fork: `scaffold.config.ts` targets
> `chains.foundry` (chain id `31337`) — the fork's chain id, **not** Base's `8453`.

---

## Send a tip

1. **Connect a wallet.** In local mode Scaffold-ETH gives you a built-in **burner wallet**
   (top-right), or you can connect MetaMask pointed at `http://127.0.0.1:8545` (chain id
   `31337`). The burner is easiest.

2. **Fund your address with test USDC.** A fresh wallet has no USDC. Copy your connected
   address, then run the helper against the fork:

   ```bash
   ./fund.sh <your-address> 1000
   ```

   This writes a 1,000 USDC balance into the fork's state and tops up ETH for gas. Example:

   ```bash
   ./fund.sh 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 1000
   ```

   Refresh the page — your balance appears in the form.

3. **Tip.** Enter an amount (or tap a preset), add an optional message, then:
   - Click **Approve USDC** (one-time ERC-20 approval for that amount), confirm the tx.
   - Click **Send tip**, confirm the tx.

   The stats and **Recent tips** feed update within a second or two.

---

## Run the contract tests

```bash
cd packages/foundry
forge test                      # unit tests
forge test --fuzz-runs 10000    # with heavier fuzzing
```

Covers tipping, message limits, zero-amount rejection, missing approval, the newest-first
feed, and owner-only withdrawal.

---

## Contract API (quick reference)

```solidity
function tip(uint256 amount, string calldata message) external;   // approve USDC first
function withdraw() external;                                     // owner only
function getRecentTips(uint256 count) external view returns (Tip[]); // newest first
function getTips() external view returns (Tip[]);                 // all, oldest first
function tipCount() external view returns (uint256);
function totalTipped() external view returns (uint256);           // lifetime, raw 6-dec units
function tippedBy(address) external view returns (uint256);
IERC20  public immutable usdc;
```

You can also poke the contract directly from the **Debug Contracts** page in the running app.

---

## Notes

- **Nothing is deployed to a public network.** The contract lives only on your local fork.
- **Restarting the fork resets state** (tips, balances, deployment). Re-run `yarn deploy`
  and `./fund.sh` after restarting `yarn fork base`.
- `fund.sh` writes USDC balances by setting the token's balance storage slot on the fork —
  a local-only trick that has no effect on real Base.
- The frontend forces webpack in dev (`next dev --webpack`) so an optional, unused
  `@x402/*` transitive dependency (pulled in via RainbowKit → Coinbase connector) doesn't
  break the build under Turbopack.
