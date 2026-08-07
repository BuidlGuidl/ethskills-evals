# Why the probe fails, and how to make the same calls hit real Aave + USDC

## 1. What `yarn chain` actually gives you

`yarn chain` starts a **fresh, empty Anvil node** (chain ID `31337`) on
`http://localhost:8545`. "Empty" is literal. It contains:

- **~10 prebuilt dev accounts**, each preloaded with 10,000 *fake* ETH
  (the well-known Anvil mnemonic — same keys everyone has).
- **Whatever `yarn deploy` puts there** — i.e. *your* vault contract and
  nothing else.
- A genesis state with **no other contract code at any address**.

That last point is the whole problem. Base mainnet contracts —
USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`), the Aave V3 Pool
(`0xA238Dd80C259a72e81d7e4664a9801593F98d1c5`), the aUSDC aToken,
Uniswap, everything — **do not exist on this chain**. Those addresses are
just empty accounts. Your local chain has never heard of Base.

## 2. Why the probe fails

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" <any address> \
  --rpc-url http://localhost:8545
```

On this local chain there is **no bytecode** at the USDC address. An
`eth_call` to a codeless account doesn't run any function — it just
returns empty data (`0x`). `cast` then tries to ABI-decode a `uint256`
out of zero bytes and fails with something like *"not enough data to
decode"* / *"empty response"*. It's not a revert from USDC's logic;
there's simply no contract to answer.

Your **integration calls revert** for the same reason: the vault calls
into the Aave Pool / USDC addresses, hits empty accounts, gets no code
to execute, and the call fails. Any interaction that assumes those
protocols are present will break.

## 3. Why the forge tests still pass

The mock-based `forge test` suite **never touches this network**. Forge
spins up its own in-memory EVM per test and you populate it yourself —
deploying `MockERC20` / a mock Aave pool, or `vm.etch`-ing bytecode to an
address, and wiring the vault to *those*. The tests pass because you
built a self-contained world where the dependencies exist by
construction. They prove your vault logic against your assumptions about
Aave — not against Aave itself. The empty local chain is exactly the gap
those mocks were papering over.

## 4. The fix: run a local **fork** of Base instead of an empty chain

Swap `yarn chain` for fork mode. Anvil forks a real archive RPC and
serves it locally:

```bash
yarn fork --network base   # Terminal 1: local Anvil, forked from Base mainnet
yarn deploy                # Terminal 2: deploy your vault onto the fork
yarn start                 # Terminal 3: Next.js frontend
```

(Under the hood this is `anvil --fork-url <BASE_ARCHIVE_RPC>`. If your
scaffold's `yarn fork` script needs an RPC, put a Base archive URL —
e.g. an Alchemy Base endpoint — in `packages/foundry/.env`.)

A forked node **lazily copies mainnet state on demand**: the first time
anything reads USDC or the Aave Pool, Anvil pulls that account's code and
storage from the upstream RPC and caches it locally. So **real USDC and
real Aave V3 now live at their real addresses**, and the exact probe
above returns a real balance. Your vault's integration calls hit the
genuine protocols.

### Chain-ID gotcha (frontend)

The fork still runs locally with chain ID **`31337`**, not Base's `8453`.
During development keep the frontend pointed at the local chain:

```typescript
// packages/nextjs/scaffold.config.ts
targetNetworks: [chains.foundry],   // 31337 — the fork. NOT chains.base
```

Only switch to `chains.base` when you deploy to the real network.

### Keep the clock moving

An idle fork can leave `block.timestamp` frozen, which silently breaks
anything time-dependent (Aave interest accrual, deadlines, vesting).
Enable interval mining:

```bash
cast rpc anvil_setIntervalMining 1
```

Make it permanent by adding `--block-time 1` to the fork script in
`packages/foundry/package.json`.

## 5. What stays local — no real funds at risk

This is the key reassurance: **a fork is a private, throwaway copy.**

- The fork only ever **reads** from the upstream RPC to hydrate state.
  Your transactions are mined **on the local Anvil node** — they are
  **never broadcast to Base mainnet**.
- You sign with the **fake Anvil dev keys** holding fake ETH. No real
  private key, no real gas, no real money.
- You can drain pools, mint yourself money, warp time, and blow things
  up. Kill the node and it's all gone — mainnet never saw any of it.

So you get mainnet's *contracts and state* with a local sandbox's
*consequences*.

## 6. Handing a test account six figures of USDC

Real USDC can't be freely minted, but on a fork you cheat locally. Two
standard approaches — both operate only on your local node.

### Option A — impersonate a whale and transfer (most realistic)

Pick an address that already holds a lot of USDC on Base (the Aave aUSDC
aToken `0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB` holds the pool's
underlying USDC and is a convenient source), impersonate it, and send
USDC to your dev account:

```bash
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
WHALE=0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB     # holds lots of USDC on Base
ME=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266         # Anvil account #0

# let the whale spend without its key
cast rpc anvil_impersonateAccount $WHALE
# (optional) give the whale gas money
cast rpc anvil_setBalance $WHALE 0xde0b6b3a7640000

# 250,000 USDC (6 decimals)
cast send $USDC "transfer(address,uint256)" $ME 250000000000 \
  --from $WHALE --unlocked --rpc-url http://localhost:8545

cast rpc anvil_stopImpersonatingAccount $WHALE
```

### Option B — overwrite the balance storage slot directly (no whale needed)

USDC (FiatTokenV2) stores balances in a mapping at **storage slot 9**.
Compute the mapping key for your address and write the balance:

```bash
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
ME=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

SLOT=$(cast index address $ME 9)                      # keccak256(me, 9)
cast rpc anvil_setStorageAt $USDC $SLOT \
  $(cast to-uint256 250000000000)                     # 250,000 USDC

# verify — this now returns a real number
cast call $USDC "balanceOf(address)(uint256)" $ME --rpc-url http://localhost:8545
```

(Option B is the running-node equivalent of Foundry's `deal()` cheatcode
you'd use inside tests. It doesn't touch total supply, which is fine for
a local sandbox.)

Either way your dev account now shows a six-figure USDC balance, the
`balanceOf` probe succeeds, and your vault's `approve` → `supply` →
`withdraw` flow runs against the **real** Aave V3 Pool and **real** USDC —
entirely on your machine, with zero real funds at stake.

## TL;DR

| | `yarn chain` (empty) | `yarn fork --network base` |
|---|---|---|
| Contents | only your deployed contracts | lazy copy of all Base state |
| USDC / Aave present? | ❌ empty addresses | ✅ real, at real addresses |
| `balanceOf` probe | fails (no code → empty return) | returns a real balance |
| Integration calls | revert | hit real protocols |
| Chain ID | 31337 | 31337 (still local) |
| Real funds at risk | n/a | none — txs never leave your box |

Stop using `yarn chain` for this project. Use `yarn fork --network base`,
keep the frontend on `chains.foundry` (31337), enable interval mining,
and fund a dev account via whale impersonation or a storage write.
