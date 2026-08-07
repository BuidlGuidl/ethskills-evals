# 💸 USDC Tip Jar (Base)

A tip jar dApp for **Base**: a `TipJar` contract that accepts **USDC** tips
(Base USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) with an optional public
message, plus a frontend with a live tip feed and a send form (approve → tip).

Built on Scaffold-ETH 2 (Foundry flavor). The SE-2 reference docs are further down.

- **Contract:** `packages/foundry/contracts/TipJar.sol`
- **Deploy script:** `packages/foundry/script/DeployTipJar.s.sol`
- **Tests:** `packages/foundry/test/TipJar.t.sol`
- **Frontend:** `packages/nextjs/app/page.tsx` + `packages/nextjs/components/tipjar/`
- **Production / IPFS deploy:** see [`DEPLOY.md`](./DEPLOY.md)

---

## Local development & demo — against **real Base state**, no real money at risk

We develop and demo everything on a **local fork of Base mainnet**. The fork is a
throwaway copy of real Base running on Anvil (chain id `31337`). The **real** USDC
contract lives at its real address on the fork, so demo tips are genuine USDC
transfers between real ERC-20 balances — but nothing touches mainnet and no real
funds are ever spent. When you kill the fork, all state disappears.

The `TipJar` is deployed with the real Base USDC address, and the frontend registers
the same USDC address for both the fork (`31337`) and Base (`8453`), so the app
behaves identically locally and in production.

### Prerequisites

- Node `>= v20` (Node 25 works; the IPFS build handles its `localStorage` quirk — see `DEPLOY.md`)
- Yarn, Git, and [Foundry](https://book.getfoundry.sh/getting-started/installation) (`anvil`, `cast`, `forge`)

```bash
yarn install
```

### 1. Start a Base fork (Terminal 1)

```bash
yarn fork base
```

This runs `anvil --fork-url base --chain-id 31337 --block-time 1` (the `base` RPC alias
is defined in `packages/foundry/foundry.toml`). `--block-time 1` mines a block every
second so `block.timestamp` advances and the feed shows real times. The fork exposes
the RPC at `http://127.0.0.1:8545`.

### 2. Deploy the TipJar to the fork (Terminal 2)

```bash
yarn deploy
```

Deploys `TipJar(USDC, deployer)` and regenerates
`packages/nextjs/contracts/deployedContracts.ts` (the frontend picks it up automatically).

### 3. Start the frontend (Terminal 3)

```bash
yarn start
```

Open `http://localhost:3000`. `scaffold.config.ts` targets `chains.foundry` (`31337`) —
the **fork's** chain id, not `chains.base`. Keep it on `foundry` for all local work.

### 4. Seed test identities with real USDC, then demo

The demo moves **real USDC between two test identities**. We use the standard Anvil dev
accounts as the identities (they're pre-funded with ETH for gas), and seed them with USDC
by impersonating a Base USDC whale on the fork — a real USDC transfer that only exists on
your local fork.

| Identity | Address | Private key (well-known Anvil dev key) |
| --- | --- | --- |
| **Alice** | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| **Bob** | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |

**Seed both identities with USDC** (copy-paste; runs against the running fork):

```bash
export ETH_RPC_URL=http://127.0.0.1:8545
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
# A Base account that currently holds a large USDC balance (verify with the balanceOf line below).
WHALE=0x20FE51A9229EEf2cF8Ad9E89d91CAb9312cF3b7A
ALICE=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
BOB=0x70997970C51812dc3A010C7d01b50e0d17dc79C8

# Sanity-check the whale still holds USDC (should print a large number):
cast call $USDC "balanceOf(address)(uint256)" $WHALE

# Give the whale gas, impersonate it, transfer real USDC to the test identities:
cast rpc anvil_setBalance $WHALE 0xDE0B6B3A7640000          # 1 ETH for gas
cast rpc anvil_impersonateAccount $WHALE
cast send $USDC "transfer(address,uint256)" $ALICE 100000000 --from $WHALE --unlocked  # 100 USDC
cast send $USDC "transfer(address,uint256)" $BOB    50000000 --from $WHALE --unlocked  #  50 USDC
cast rpc anvil_stopImpersonatingAccount $WHALE

# Confirm balances (USDC has 6 decimals, so 100 USDC == 100000000):
cast call $USDC "balanceOf(address)(uint256)" $ALICE
cast call $USDC "balanceOf(address)(uint256)" $BOB
```

> **If the whale no longer holds USDC** (balances shift over time), pick any current holder
> from [BaseScan USDC holders](https://basescan.org/token/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913#balances)
> and set `WHALE` to it. Anyone with a USDC balance works — you're only moving fork funds.

**Drive the UI as each identity:** import Alice's / Bob's private key into MetaMask (or another
wallet), add a network for `http://127.0.0.1:8545` with chain id `31337`, connect, and use the
form: enter an amount + message → **Approve USDC** → **Send tip**. The tip appears in the feed
for everyone. (SE-2's burner wallet also works, but it generates a fresh empty account — seed it
with the whale step above using its address if you go that route.)

**Or run the whole tip flow headless with `cast`** (no browser needed):

```bash
# TipJar address — copy it from packages/nextjs/contracts/deployedContracts.ts (TipJar.address):
JAR=<paste-TipJar-address>
ALICE_PK=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

cast send $USDC "approve(address,uint256)" $JAR 10000000 --private-key $ALICE_PK   # approve 10 USDC
cast send $JAR  "tip(uint256,string)" 10000000 "gm from Alice" --private-key $ALICE_PK

cast call $JAR "totalTipped()(uint256)"
cast call $JAR "getRecentTips(uint256)((address,uint256,uint256,string)[])" 5
```

### 5. Run the contract tests

```bash
yarn foundry:test          # unit + fuzz tests for TipJar
```

---

## How the contract works

`TipJar` holds a fixed USDC token (set at deploy time) and an owner.

- `tip(uint256 amount, string message)` — pulls `amount` USDC from the caller via
  `safeTransferFrom` (caller must `approve` first), appends a `Tip` to the on-chain feed,
  updates totals, and emits `NewTip`. Reverts on a zero amount.
- `getRecentTips(uint256 count)` — newest-first, bounded read used by the UI feed.
- `totalTipped`, `totalTippedBy(address)`, `tipsCount()` — running totals.
- `withdraw()` — owner-only; sends the jar's full USDC balance to the owner.

---

<details>
<summary><h2 style="display:inline">🏗 Scaffold-ETH 2 reference</h2></summary>

⚙️ Built using NextJS, RainbowKit, Foundry, Wagmi, Viem, and Typescript.

- ✅ **Contract Hot Reload**: Your frontend auto-adapts to your smart contract as you edit it.
- 🪝 **[Custom hooks](https://docs.scaffoldeth.io/hooks/)**: React hooks around [wagmi](https://wagmi.sh/) for typed contract interactions.
- 🧱 [**Components**](https://docs.scaffoldeth.io/components/): Common web3 components to quickly build your frontend.
- 🔥 **Burner Wallet & Local Faucet**: Quickly test with a burner wallet and local faucet.
- 🔐 **Wallet Providers**: Connect to different wallet providers.

### Requirements

- [Node (>= v20.18.3)](https://nodejs.org/en/download/)
- Yarn ([v1](https://classic.yarnpkg.com/en/docs/install/) or [v2+](https://yarnpkg.com/getting-started/install))
- [Git](https://git-scm.com/downloads)

> Note: this project uses `yarn fork base` (a Base mainnet fork) rather than the empty
> `yarn chain`, because the tip jar needs the real USDC contract to exist. Use `yarn chain`
> only if you specifically want an empty local chain with no tokens.

### Documentation

Visit the [SE-2 docs](https://docs.scaffoldeth.io) to learn more. To know more about its
features, check out the [website](https://scaffoldeth.io).

### Contributing

We welcome contributions to Scaffold-ETH 2! See
[CONTRIBUTING.MD](https://github.com/scaffold-eth/scaffold-eth-2/blob/main/CONTRIBUTING.md).

</details>
