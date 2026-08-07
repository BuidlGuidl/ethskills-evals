# Why the probe fails, and how to get real Aave + real USDC locally

## Short version

`yarn chain` gives you an **empty** local blockchain. It contains your
dev accounts and the contracts *you* deploy — nothing else. There is no
Aave, no USDC, no Uniswap, no mainnet state at all. The probe fails and
your integration calls revert because **there is no contract living at
`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` on that chain** — that
address only has USDC on *real* Base, and your local chain is not a copy
of real Base.

The fix is to run a **fork** instead of a bare chain: `yarn fork
--network base`. That boots the same local Anvil node but backs it with
real Base mainnet state, so the exact same addresses and calls now
resolve to the real USDC and real Aave contracts — while every write
still happens only on your local copy.

---

## 1. What `yarn chain` actually contains

`yarn chain` starts **Anvil** (Foundry's local node) as a brand-new
chain with:

- **Chain ID `31337`**, listening on `http://localhost:8545`.
- A **genesis state** with ~10 prefunded developer accounts (10000 ETH
  each). That's it — no application state.
- Whatever **`yarn deploy` puts there**, which is *only your own
  contracts* (the vault) plus any mocks your deploy scripts explicitly
  create. `yarn deploy` does **not** deploy Aave or USDC — those are
  third-party protocols that already live on mainnets, and nobody
  redeploys them onto your fresh chain.

So the chain is effectively: dev accounts + your vault. The Aave Pool
address and the USDC address your vault points at are just empty
accounts — addresses with **no bytecode**.

### Why your forge tests still pass

Your mock-based tests pass because the test `setUp()` deploys a
`MockERC20` and a `MockAavePool` *inside the test's own EVM instance* and
wires the vault to those mock addresses. Those mocks:

- exist only for the duration of the test process, and
- live at whatever addresses Foundry assigns them — **not** at the real
  Base USDC/Aave addresses.

The running Anvil node from `yarn chain` never sees any of that. Tests
green ≠ a live chain that has USDC on it.

---

## 2. Why the probe reverts / fails outright

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" <any address> \
  --rpc-url http://localhost:8545
```

`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` is the **USDC address on
Base mainnet**. On your empty local chain that account has **no code**.

When you `call` a function on an address with no bytecode, the EVM has
nothing to execute — the call returns **empty data (0 bytes)**. `cast`
then tries to ABI-decode a `uint256` return value out of zero bytes and
fails (you'll see an empty/decode error, not a real `balanceOf` result).

Your integration calls revert for the same root cause: the vault does an
external call into the Aave Pool address and the USDC address, both of
which are codeless on this chain, so the calls fail and the transaction
reverts. There's simply no protocol there to talk to.

---

## 3. The setup where the same calls hit real Aave and real USDC

Swap the bare chain for a **mainnet fork**. In a Scaffold-ETH 2 (foundry)
project:

```bash
# Terminal 1 — fork of REAL Base instead of an empty chain
yarn fork --network base

# Terminal 2 — deploy YOUR vault onto the fork
yarn deploy

# Terminal 3 — frontend
yarn start
```

`yarn fork --network base` runs Anvil with `--fork-url <a Base RPC
endpoint>`. Instead of genesis-only state, Anvil now **lazily pulls real
Base mainnet state on demand**: the first time any call touches
`0x8335...2913`, Anvil fetches USDC's real bytecode and storage from the
upstream RPC and caches it locally. After that, the exact probe above
returns a real balance, and your vault's calls into the Aave V3 Pool and
USDC succeed against the genuine contracts.

> If you want to keep using raw `cast` while forking, you can also run
> Anvil directly: `anvil --fork-url <BASE_RPC_URL>` — `yarn fork
> --network base` is just SE-2's wrapper around that.

### What stays local (no real funds at risk)

This is the key property of a fork:

- The node still runs **locally on `http://localhost:8545` with chain ID
  `31337`**. It is a *copy* of Base, not Base itself.
- **Reads** are served from real mainnet state; **writes** (your
  transactions) are applied only to the local copy. Nothing is broadcast
  to real Base.
- You pay **no real gas** and touch **no real funds or real accounts**.
  You can drain "whales", mint yourself money, and roll the chain back —
  none of it exists outside your machine.

Two SE-2 gotchas that bite people in fork mode:

- **Frontend target network must stay `chains.foundry` (31337), not
  `chains.base`.** The fork runs on Anvil's chain ID even though it
  mirrors Base. Only switch `targetNetworks` to `chains.base` when you
  actually deploy to real Base.

  ```typescript
  // scaffold.config.ts during local dev
  targetNetworks: [chains.foundry],  // NOT chains.base
  ```

- **Enable interval mining** or `block.timestamp` is frozen and any
  time-based vault logic (interest accrual, deadlines) breaks silently:

  ```bash
  cast rpc anvil_setIntervalMining 1
  ```

  Make it permanent by adding `--block-time 1` to the fork script in
  `packages/foundry/package.json`.

### How a test account ends up with six figures of USDC

USDC has **6 decimals**, so 100,000 USDC = `100000000000` (i.e.
`100_000 * 10**6`). On a fork you don't need real money — you just
manufacture the balance. Two standard ways:

**A) Impersonate a real USDC whale and transfer to yourself.** Pick an
address that holds a lot of USDC on Base (a large CEX/bridge/treasury
wallet), then have the fork let you act as it:

```bash
WHALE=0x<some_base_usdc_whale>
ME=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266   # a default Anvil dev account
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

# Let Anvil sign as the whale, and give it ETH for gas
cast rpc anvil_impersonateAccount $WHALE
cast rpc anvil_setBalance $WHALE 0xde0b6b3a7640000   # 1 ETH

# Move 100,000 USDC to your test account
cast send $USDC "transfer(address,uint256)" $ME 100000000000 \
  --from $WHALE --unlocked --rpc-url http://localhost:8545
```

**B) Write the balance directly into storage** (no whale needed). USDC's
`balanceOf` is a `mapping(address => uint256)`; compute the slot for your
account and set it with `anvil_setStorageAt`. In a **Foundry test/script**
the one-liner equivalent is `deal`:

```solidity
deal(USDC, ME, 100_000e6);   // forge-std cheatcode: sets balanceOf[ME]
```

Either way the account now shows six figures of USDC on the fork, and
every deposit/withdraw against the real Aave V3 Pool works — with zero
real funds involved.

---

## TL;DR

| | `yarn chain` (what you did) | `yarn fork --network base` (what you want) |
|---|---|---|
| Chain contents | dev accounts + your vault only | full copy of real Base state |
| USDC at `0x8335…2913` | empty account, no code → probe fails | real USDC contract → probe returns a balance |
| Aave V3 | doesn't exist → integration calls revert | real Pool → integration calls succeed |
| Funds at risk | none | none (writes stay on the local fork) |
| Getting test USDC | impossible (no token) | impersonate a whale, or `deal`/`anvil_setStorageAt` |

The one-line takeaway: **don't `yarn chain` an integration against real
protocols — `yarn fork` it.**
