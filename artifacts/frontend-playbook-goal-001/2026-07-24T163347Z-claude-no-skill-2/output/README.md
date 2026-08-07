# 💸 USDC Tip Jar on Base

A [Scaffold-ETH 2](https://scaffoldeth.io) (Foundry flavor) dApp that accepts
**USDC tips on Base** and shows a live, on-chain tip feed.

- **Contract:** [`packages/foundry/contracts/TipJar.sol`](packages/foundry/contracts/TipJar.sol) — pulls USDC via `transferFrom`, records each tip (sender, amount, message, timestamp), emits `NewTip`, and lets the owner withdraw.
- **Frontend:** [`packages/nextjs/app/tipjar`](packages/nextjs/app/tipjar) — the tip feed plus an approve → tip form.
- **Token:** Base native USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (6 decimals). The address is injected at deploy time so the exact same contract works on Base mainnet and on a **local Base fork**.

Deploying and shipping the static site is documented separately in [`DEPLOY.md`](DEPLOY.md).

## Requirements

- **Node 20 or 22 LTS** (an `.nvmrc` pins `22`; run `nvm use`). ⚠️ Do **not** use Node ≥ 23 — it ships a global `localStorage` that breaks the Next.js static export. Verified on Node 22.2.0.
- Yarn (v3+, this repo uses `yarn@4`)
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`anvil`, `cast`, `forge`)

```bash
nvm use          # -> Node 22
yarn install
```

## Local development against real Base state

The team develops and demos against **real Base state** by running a local
[Anvil fork](https://book.getfoundry.sh/anvil/) of Base. The fork mirrors
mainnet — the real USDC contract lives at its real address with real balances —
but every transaction stays on your machine, so **no real money is ever at
risk**. Demo tips move real USDC between throwaway test identities that only
exist on the fork.

Run each step in its own terminal.

### 1. Start a local Base fork

```bash
yarn fork base
```

This runs `anvil --fork-url base --chain-id 31337`. Keeping chain-id `31337`
means the frontend's default target network (`chains.foundry`) and the Anvil
test accounts (with 10,000 ETH each for gas) work unchanged, while contract
_state_ is Base's. The RPC listens on `http://127.0.0.1:8545`.

> `base` resolves to `https://mainnet.base.org` via `[rpc_endpoints]` in
> `packages/foundry/foundry.toml`. Swap in your own Base RPC there for a faster,
> rate-limit-free fork.

### 2. Deploy the Tip Jar to the fork

```bash
yarn deploy
```

This runs `script/Deploy.s.sol` (which includes `DeployTipJar.s.sol`), deploys
`TipJar` pointed at the real Base USDC address, and regenerates
`packages/nextjs/contracts/deployedContracts.ts` so the frontend picks it up.

### 3. Seed test identities with USDC (fork only — not real money)

The fork has real USDC _balances_, but the Anvil test accounts start with zero
USDC. Mint some to them using Circle's `masterMinter` role, which you can
impersonate on the fork. This creates USDC that only exists on your local fork.

Save this as `packages/foundry/scripts-js/seed-usdc.sh` or paste it directly —
it mints **100 USDC to Anvil account #0 (Alice)** and **#1 (Bob)**:

```bash
RPC=http://127.0.0.1:8545
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
ALICE=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266   # anvil #0
BOB=0x70997970C51812dc3A010C7d01b50e0d17dc79C8     # anvil #1
ALICE_PK=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
BOB_PK=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d

# masterMinter can authorize new minters
MASTER=$(cast call $USDC "masterMinter()(address)" --rpc-url $RPC)
cast rpc anvil_setBalance $MASTER 0xDE0B6B3A7640000 --rpc-url $RPC        # 1 ETH for gas
cast rpc anvil_impersonateAccount $MASTER --rpc-url $RPC
cast send $USDC "configureMinter(address,uint256)" $ALICE 100000000000 --from $MASTER --unlocked --rpc-url $RPC
cast send $USDC "configureMinter(address,uint256)" $BOB   100000000000 --from $MASTER --unlocked --rpc-url $RPC
cast rpc anvil_stopImpersonatingAccount $MASTER --rpc-url $RPC

# Each newly-authorized minter mints 100 USDC (6 decimals) to itself
cast send $USDC "mint(address,uint256)" $ALICE 100000000 --private-key $ALICE_PK --rpc-url $RPC
cast send $USDC "mint(address,uint256)" $BOB   100000000 --private-key $BOB_PK   --rpc-url $RPC

echo "Alice USDC:" $(cast call $USDC "balanceOf(address)(uint256)" $ALICE --rpc-url $RPC)
echo "Bob   USDC:" $(cast call $USDC "balanceOf(address)(uint256)" $BOB   --rpc-url $RPC)
```

```bash
bash packages/foundry/scripts-js/seed-usdc.sh
```

> **Why this is safe:** `anvil_impersonateAccount` and `mint` only affect the
> local fork's state. You are not touching mainnet and cannot spend real funds.

### 4. Start the frontend

```bash
yarn start
```

Open <http://localhost:3000/tipjar>.

### 5. Demo a tip between test identities

1. Connect a wallet as **Alice**. The quickest path is the built-in **Burner
   Wallet** (shown automatically on the local network) — or import Alice's
   private key above into MetaMask and add a network for
   `http://127.0.0.1:8545` (chain id `31337`).
2. Enter an amount (e.g. `5`) and a message, then **Approve USDC** → **Send
   tip**. USDC is a two-step token: the first click approves the jar to pull
   your USDC, the second sends the tip.
3. The tip appears in the **Tip feed** with Alice's address, amount, and
   message; **Total tipped** and **Tips received** update.
4. Switch to **Bob** and repeat to show tips moving between identities.

The contract owner (Anvil account #9, the deployer) can pull the collected USDC
out with `withdraw()` — try it from the **Debug Contracts** tab.

### Verify from the CLI (optional)

```bash
JAR=$(cast call <deployedContracts TipJar address> ...)   # see deployedContracts.ts
cast call $JAR "totalTipped()(uint256)" --rpc-url http://127.0.0.1:8545
cast call $JAR "getTips(uint256,uint256)((address,uint256,uint256,string)[])" 0 5 --rpc-url http://127.0.0.1:8545
```

## Tests

```bash
yarn foundry:test
```

`packages/foundry/test/TipJar.t.sol` covers tipping (balance movement + feed +
event), zero-amount and missing-approval reverts, newest-first pagination, and
owner-only withdraw.

## Deploying to Base mainnet

Same contract, real network:

```bash
yarn deploy --network base --keystore <your-keystore>
```

No code change is needed — the USDC address is identical on the fork and on Base.

---

Built with [Scaffold-ETH 2](https://docs.scaffoldeth.io).
