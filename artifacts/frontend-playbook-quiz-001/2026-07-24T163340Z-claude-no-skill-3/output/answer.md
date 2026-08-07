# Why the probe fails, and how to make the same calls hit real Aave + USDC locally

## TL;DR

`yarn chain` starts a **fresh, empty Anvil chain**. It has funded dev
accounts and *your* deployed vault — but nothing else. The real USDC and
Aave V3 contracts live on Base mainnet; on a blank local chain those
addresses hold **no code**, so `balanceOf` has nothing to call and every
integration call reverts. Your mock-based `forge` tests pass because they
deploy their own fakes and never touch those addresses.

The fix is to run Anvil as a **fork of Base** instead of a blank chain.
That gives you a local copy of Base's entire state — real USDC, real Aave
V3 — that you can read and transact against, while every write stays in
your local node. You mint yourself six figures of USDC either by
impersonating a whale or by writing the balance slot directly.

---

## 1. What the local chain actually contains

`yarn chain` in the Foundry flavor of Scaffold-ETH 2 runs `anvil`
(see `packages/foundry/package.json`). By default `anvil`:

- Spins up a **brand-new, genesis-state EVM chain**, chain id `31337`.
- Pre-funds **10 deterministic dev accounts** with 10,000 test ETH each
  (from the well-known mnemonic `test test ... junk`).
- Contains **zero deployed application contracts** at genesis.

`yarn deploy` then runs your Foundry deploy script (`Deploy.s.sol` /
`yarn deploy`), which deploys **your Vault** (and whatever else your
script deploys) onto that blank chain and writes the addresses into
`packages/nextjs/contracts/deployedContracts.ts` so the app can find them.

So after `yarn chain` + `yarn deploy`, the local chain contains exactly:

- funded dev accounts,
- your Vault contract,
- and **nothing else**.

It does **not** contain:

- USDC at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (that is Base
  mainnet's native USDC), or
- the Aave V3 `Pool`, `PoolAddressesProvider`, aTokens, oracle, etc.

Those are Base mainnet deployments. Their **addresses** are just 20-byte
numbers; on your blank chain there is no bytecode sitting at them.

## 2. Why the `cast call` probe fails

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" <any address> \
  --rpc-url http://localhost:8545
```

On the blank local chain, address `0x8335…2913` has **no code**. In the
EVM, calling a codeless address is not itself an error — the call
"succeeds" and returns **empty** returndata (`0x`). But you asked `cast`
to decode the result as `(uint256)`, and there are zero bytes to decode,
so `cast` errors out ("execution reverted" / no data returned). Same root
cause for your integration calls: your Vault calls
`IERC20(USDC).transferFrom(...)` or `IPool(pool).supply(...)`, the target
has no code, the low-level call returns no data, and the wrappers
(`SafeERC20`, Aave interface) treat the empty/short return as a failure
and revert.

**Why the mock tests pass anyway:** your `forge` tests don't use the live
chain at all. In `setUp()` they deploy a `MockERC20`/`MockUSDC` and a mock
Aave pool (or use `deployCodeTo` / `vm.etch` to put bytecode at an
address, and `deal` to set balances). Everything the Vault calls has real
code *in the test EVM*, so the tests are green — but they prove nothing
about the actual Base contracts.

## 3. The setup where the exact same calls hit real Aave + real USDC

Run Anvil as a **fork of Base mainnet**. Forking copies Base's state into
a local node: every mainnet contract (USDC, Aave V3, everything) is
present at its real address with its real code and storage. Your reads and
writes go to this local fork; **Base itself is never touched**.

### 3a. Get a Base RPC endpoint

Public `https://mainnet.base.org` works for light use but is rate-limited;
an archive-capable provider (Alchemy / QuickNode / Infura Base) is
smoother. Put it in `packages/foundry/.env`:

```bash
# packages/foundry/.env
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/<YOUR_KEY>
```

### 3b. Make `yarn chain` fork Base

Point Anvil at that URL and **keep chain id 31337** so the rest of
Scaffold-ETH (the localhost network config, the burner wallet, the deploy
scripts) keeps working unchanged. Two options:

**Option A — one-off command:**

```bash
anvil \
  --fork-url $BASE_RPC_URL \
  --chain-id 31337 \
  --fork-block-number 18000000   # optional: pin a block for reproducibility
```

**Option B — bake it into the script** (`packages/foundry/package.json`),
so `yarn chain` always forks:

```jsonc
{
  "scripts": {
    // was: "chain": "anvil --config-out localhost.json"
    "chain": "source .env && anvil --fork-url $BASE_RPC_URL --chain-id 31337 --config-out localhost.json"
  }
}
```

Pinning `--fork-block-number` is recommended: it makes runs deterministic
and lets Anvil cache fetched state, so restarts are fast.

Now the probe works, because `0x8335…2913` has USDC's real code on your
fork:

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" 0x… --rpc-url http://localhost:8545
# → a real uint256, no revert
```

### 3c. Deploy your Vault onto the fork

`yarn deploy` as usual. Your Vault lands on the fork alongside the real
USDC and Aave contracts, so `supply`/`withdraw` calls now execute against
genuine Aave V3 logic. Make sure your deploy script / constructor uses the
**Base mainnet addresses**:

- USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Aave V3 `PoolAddressesProvider` (Base): `0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D`
  (derive the `Pool` from it, or use the known `Pool` address)

### 3d. Frontend

Your `targetNetworks` in `scaffold.config.ts` already includes
`chains.foundry` (chain id 31337) pointing at `http://localhost:8545`.
Because you kept `--chain-id 31337`, no frontend change is needed — the
app talks to the fork exactly as it talked to the blank chain.

## 4. What stays local — no real funds at risk

Forking is **copy-on-read, write-locally**:

- Anvil lazily pulls mainnet state from your RPC **only when a call reads
  an account/slot it hasn't seen**, and caches it.
- **Every transaction you send is applied only to your local overlay.**
  Nothing is signed for or broadcast to Base.
- You spend **test ETH** from Anvil's dev accounts for gas, not real ETH.
- The real USDC, real Aave pool, and real Base chain are **completely
  unaffected** by anything you do. You can `supply`, `borrow`, liquidate,
  or nuke balances freely — it only exists in your node's memory and
  disappears when you restart (unless you pinned a block + cache).

The RPC provider only ever serves you **read** requests; your writes never
leave localhost.

## 5. Giving a test account six figures of USDC

USDC has no faucet, and on a fork you can't "mint" it through the real
contract (you're not its minter). Instead you cheat locally. Pick one:

### Option A — Impersonate a USDC whale (simplest, most realistic)

Find an address holding a lot of USDC on Base (a CEX hot wallet, a large
DeFi contract, or Aave's own aUSDC/pool). Then impersonate it and just
`transfer`:

```bash
WHALE=0x…            # a known large USDC holder on Base
ME=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266   # Anvil account #0
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

# unlock the whale
cast rpc anvil_impersonateAccount $WHALE --rpc-url http://localhost:8545

# give the whale some gas ETH (it may not have any test ETH)
cast rpc anvil_setBalance $WHALE 0xDE0B6B3A7640000 --rpc-url http://localhost:8545

# send 150,000 USDC (6 decimals) to your test account
cast send $USDC "transfer(address,uint256)" $ME 150000000000 \
  --from $WHALE --unlocked --rpc-url http://localhost:8545
```

This moves real (forked) USDC through the real contract's `transfer`, so
allowances/hooks behave exactly as on mainnet.

### Option B — Write the balance storage slot directly (no whale needed)

Overwrite the whale-independent `balances` mapping slot for your account.
USDC's balance mapping is at a known storage slot; the per-account slot is
`keccak256(abi.encode(account, balanceSlot))`:

```bash
ME=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

# Base native USDC (FiatToken proxy) keeps balances at slot 9.
# Verify with:  cast storage $USDC <slot> --rpc-url http://localhost:8545
SLOT=$(cast index address uint256 $ME 9)

# 150,000e6 = 0x22ECB25C00
cast rpc anvil_setStorageAt $USDC $SLOT \
  0x00000000000000000000000000000000000000000000000000000022ecb25c00 \
  --rpc-url http://localhost:8545

cast call $USDC "balanceOf(address)(uint256)" $ME --rpc-url http://localhost:8545
# → 150000000000
```

> Note: Base USDC is a proxy (`FiatTokenV2`); its balance slot is `9`.
> If a version bump ever changes it, confirm the slot empirically by
> reading storage or by bumping a known holder and diffing.

### Option C — `deal` inside forge tests

If you want this in your Foundry tests (run against the fork with
`forge test --fork-url $BASE_RPC_URL`), the cheatcode does the slot math
for you:

```solidity
deal(USDC, testUser, 150_000e6);   // sets USDC balance directly
```

`deal` is test-EVM only; for the **running** `yarn chain` node use Option
A or B.

---

## Checklist

1. Add `BASE_RPC_URL` to `packages/foundry/.env`.
2. Change `yarn chain` to `anvil --fork-url $BASE_RPC_URL --chain-id 31337`
   (optionally `--fork-block-number <n>`).
3. `yarn deploy` — Vault now sits next to real USDC + Aave V3.
4. Seed your test account with USDC (impersonate-whale or storage-slot).
5. Re-run the `cast call` probe — it returns a real balance instead of
   reverting, and your integration calls hit genuine Aave logic, all with
   zero real funds at risk.
