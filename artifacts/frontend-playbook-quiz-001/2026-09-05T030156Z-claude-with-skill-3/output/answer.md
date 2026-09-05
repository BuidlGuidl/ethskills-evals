# Why the probe fails, and the fork setup that fixes it

## 1. What `yarn chain` actually gives you

`yarn chain` starts a **fresh, empty Anvil instance** — chain ID `31337`, genesis block,
nothing in it. Concretely, the entire world state is:

- 10 prefunded dev accounts (10000 ETH each, from the standard test mnemonic)
- whatever **your** `yarn deploy` script just put there

That's it. There is no Aave V3 Pool, no USDC, no Uniswap, no oracles, no whale balances,
no price feeds. Mainnet contract addresses are just 20-byte numbers on this chain, and
every one of them is an empty EOA-shaped hole with no code.

So `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` — the real Base USDC — is, on your local
chain, an address with zero code and zero storage.

## 2. Why the `cast call` probe fails

It isn't a revert. A call to an address with **no code** succeeds trivially and returns
empty calldata (`0x`). `cast` is then told to ABI-decode that `0x` as a `uint256`, and
*that* is what errors out. The failure is at the decode step, not in the EVM.

Prove it in one line:

```bash
cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://localhost:8545
# -> 0x        (nothing there)

cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
  --rpc-url http://localhost:8545
# -> error decoding: expected 32 bytes, got 0
```

Same root cause for the vault: your integration calls do a `staticcall`/`call` into an
address with no code. Depending on how the interface is written you either get a bogus
empty-return decode or an outright revert (Solidity's `extcodesize` check on high-level
interface calls reverts when the target has no code). Either way — **the counterparty
does not exist.**

## 3. Why the forge tests pass anyway

Your mock-based tests deploy `MockERC20` / `MockPool` *inside the test* and hand those
addresses to the vault. They never touch `0x8335…`. Mocks test that your vault calls the
interface you *believe* Aave has — they cannot test whether that belief is correct, nor
anything about real reserve state, aToken index accrual, supply caps, paused reserves, or
USDC's blacklist/permit quirks. Green mock tests plus reverting integration calls is
exactly the signature of "the code is fine, the environment is empty."

## 4. The setup where the same calls hit real Aave and real USDC

Swap the empty chain for a **fork of Base mainnet**:

```bash
yarn fork --network base    # Terminal 1: local Anvil, seeded from real Base state
yarn deploy                 # Terminal 2: deploy your vault onto the fork
yarn start                  # Terminal 3: Next.js frontend
```

Anvil now serves every read from real Base state (lazily fetched from the upstream RPC and
cached), so `0x8335…` has USDC's real bytecode and real balances, and the Aave V3 Pool has
its real reserves. The identical `cast call` now returns a number:

```bash
cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://localhost:8545 | head -c 20
# -> 0x60806040...   (real proxy bytecode)
```

Use a proper archive-capable RPC for the fork (Alchemy or similar) in
`packages/foundry/.env` — not `mainnet.base.org`. Public RPCs rate-limit hard and a fork
makes a *lot* of state requests.

### Chain ID gotcha — this one bites everyone

The fork runs locally on Anvil, so it is **still chain ID 31337**, even though it contains
Base state. Your frontend must target `foundry`, not `base`:

```typescript
// packages/nextjs/scaffold.config.ts
targetNetworks: [chains.foundry],   // ✅ correct while forking Base
// targetNetworks: [chains.base],   // ❌ frontend will talk to real Base
```

Only switch to `chains.base` when you actually deploy the vault to real Base.

### Block mining — a vault will need this

Anvil mines only when a transaction arrives. Between transactions `block.timestamp` is
frozen, then jumps in one step. For a vault that accrues Aave interest, or shows an APY /
deadline / accrued-yield figure, the UI will silently look broken while `vm.warp` unit
tests pass:

```bash
cast rpc anvil_setIntervalMining 1 --rpc-url http://localhost:8545
```

Make it permanent by adding `--block-time 1` to the fork script in
`packages/foundry/package.json`. (`evm_mine` / `evm_increaseTime` are still the right tools
for controlled single-step tests — they're just not a substitute for a running clock under
a live demo.)

## 5. What stays local — no real funds at risk

A fork is a **local copy of state, not a connection to the chain**:

- Reads are fetched from the upstream RPC and cached locally.
- **Writes never leave your machine.** Transactions execute against Anvil's in-memory
  overlay of that state. Nothing is broadcast to Base, nothing is mined by real validators.
- You sign with Anvil's well-known dev keys, not with any real private key.
- The fork is thrown away when you `Ctrl-C`. Restarting re-seeds from real state.

So you can drain a whale, mint yourself tokens, or nuke a protocol's storage — it all
evaporates on restart. The only thing that touches the real world is read traffic against
your RPC provider's quota.

## 6. Getting a test account six figures of USDC

Because writes are local, you can just *take* tokens from an address that already holds
them. Don't deploy a mock token on a fork — the whole point is real USDC.

**Option A — impersonate a real holder (preferred).** This exercises real USDC transfer
logic, real decimals, real blacklist checks.

```bash
RPC=http://localhost:8545
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
ME=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266    # anvil account #0
WHALE=<address with >100k USDC on Base>

# confirm the whale is actually fat, at the fork block
cast call $USDC "balanceOf(address)(uint256)" $WHALE --rpc-url $RPC

cast rpc anvil_impersonateAccount $WHALE --rpc-url $RPC
cast rpc anvil_setBalance $WHALE 0xde0b6b3a7640000 --rpc-url $RPC   # 1 ETH for gas

# 250,000 USDC — USDC has 6 decimals
cast send $USDC "transfer(address,uint256)" $ME 250000000000 \
  --from $WHALE --unlocked --rpc-url $RPC

cast rpc anvil_stopImpersonatingAccount $WHALE --rpc-url $RPC
cast call $USDC "balanceOf(address)(uint256)" $ME --rpc-url $RPC
# -> 250000000000
```

Pick the whale empirically rather than from memory — holder sets change. The Aave V3
aUSDC reserve on Base is a reliable one (it holds the pool's idle USDC); Base's Circle
bridge/treasury addresses and the top holders list on Basescan work too. Verify with the
`balanceOf` line above **before** you build a script around an address. Note this repo does
not ship the playbook's `addresses/` reference, so treat any address here as needing a
`cast code` / `balanceOf` check against your fork.

**Option B — write the balance directly (no holder needed).** USDC on Base is a Circle
FiatToken proxy whose `balances` mapping lives at storage slot 9:

```bash
SLOT=$(cast index address $ME 9)
cast rpc anvil_setStorageAt $USDC $SLOT \
  $(cast to-uint256 250000000000) --rpc-url $RPC
cast call $USDC "balanceOf(address)(uint256)" $ME --rpc-url $RPC
```

Confirm the read comes back as 250000000000 — if it doesn't, the slot is wrong for this
implementation and you should fall back to Option A. This bypasses transfer logic entirely,
so it's the tool for when no suitable holder exists, not the default. `anvil_setBalance`
is the equivalent for native ETH.

## 7. Then re-verify

```bash
cast call $USDC "balanceOf(address)(uint256)" $ME --rpc-url $RPC     # six figures
cast code <AAVE_V3_POOL_BASE> --rpc-url $RPC | head -c 20            # real bytecode
# then run the vault's supply/withdraw path from /debug and watch it succeed
```

Keep the mock tests — they're fast and good for edge cases (zero amounts, unauthorized
callers, reentrancy). Add fork tests (`forge test --fork-url $BASE_RPC`) for the
integration assumptions the mocks can't check.

## TL;DR

| | `yarn chain` | `yarn fork --network base` |
|---|---|---|
| State | empty genesis + your contracts | full copy of real Base |
| USDC at `0x8335…` | no code → decode error | real USDC |
| Aave V3 | absent → reverts | real pool, real reserves |
| Chain ID | 31337 | **still 31337** |
| Writes | local | local (nothing broadcast) |
| Good for | isolated contracts, unit tests | integration against deployed protocols |

You built a vault whose behavior *is* Aave and USDC, then tested it in a room with neither.
Fork Base, point the frontend at `chains.foundry`, impersonate a whale for funding, and
turn on interval mining.
