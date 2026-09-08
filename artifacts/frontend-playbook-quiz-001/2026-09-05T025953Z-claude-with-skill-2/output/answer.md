# Why the probe fails, and the fork setup that fixes it

## 1. What `yarn chain` actually gives you

`yarn chain` starts **Anvil with empty state** — a brand-new chain, chain ID
`31337`, genesis block 0. It contains exactly two things:

1. The ten prefunded dev accounts (ETH only).
2. Whatever `yarn deploy` just put there — your `Vault` and nothing else.

There is no Aave V3, no USDC, no WETH, no Chainlink feed, no pool, no
liquidity. Mainnet addresses on this chain are empty accounts: no code, no
storage, no balances.

## 2. Why the `cast call` probe fails

```
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" <addr> --rpc-url http://localhost:8545
```

`0x8335…2913` is **native USDC on Base mainnet**. On your local chain that
address holds nothing. Confirm it in one line:

```bash
cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://localhost:8545
# → 0x        (empty — there is no contract there)
```

The EVM does not revert when you call an address with no code. It succeeds and
returns **zero bytes**. `cast` is then asked to decode `0x` as a `uint256`,
finds nothing to decode, and errors out. The probe isn't failing because of a
bad ABI, a bad address, or an RPC problem — it's failing because the token
does not exist on that chain.

Your vault's integration calls fail for the same root cause, one step later.
A typed call like `IERC20(USDC).balanceOf(...)` or
`IPool(AAVE_POOL).supply(...)` compiles a returndata-size check into the
call site, so an empty return from a codeless address becomes a revert. If you
route through `SafeERC20`, you get the same outcome via its
`address.code.length == 0` guard. Either way: **you are calling into a void.**

## 3. Why the forge tests don't catch it

Mock-based tests deploy `MockERC20` and `MockPool` *inside the test*, then
hand those addresses to the vault. The mainnet addresses are never touched, so
the "does this address have code" question never gets asked.

More importantly, a mock only encodes **your belief** about how Aave behaves.
It won't reproduce aToken rebasing, the liquidity index, health-factor math,
supply caps, a frozen or paused reserve, USDC's blocklist, or USDC's
proxy/upgrade layout. Green mock tests are a statement about your vault's
internal logic, not about the integration. Keep them — they're fast and they
belong in CI — but they cannot be the thing that tells you the integration
works.

## 4. The setup where the same calls hit real Aave and real USDC

Replace `yarn chain` with **fork mode**. Same Anvil, same port, same chain ID
— but seeded from a real Base mainnet block.

### One-time config

Put an archival-quality Base RPC in `packages/foundry/.env` (Alchemy, Infura,
QuickNode — **not** `mainnet.base.org`; public endpoints rate-limit and a fork
issues one upstream request per cold storage slot):

```bash
# packages/foundry/.env
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/<key>
```

Mirror it for the frontend in `packages/nextjs/.env.local` and set
`rpcOverrides` in `scaffold.config.ts`.

### The three terminals

```bash
# Terminal 1 — fork of real Base
yarn fork --network base

# Terminal 2 — deploy YOUR contracts onto the fork
yarn deploy

# Terminal 3 — frontend
yarn start
```

### Chain ID gotcha — the one that bites everyone

The fork runs on Anvil at **chain ID 31337**, even though it is a copy of
Base. The frontend must target Foundry, not Base:

```typescript
// packages/nextjs/scaffold.config.ts
targetNetworks: [chains.foundry],   // ✅ NOT chains.base
pollingInterval: 3000,
```

Set `chains.base` only when you deploy to the real network. Getting this wrong
makes the wallet prompt "switch to Base" and every read silently hit real
mainnet instead of your fork.

### Verify the fork before anything else

```bash
cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --rpc-url http://localhost:8545 | head -c 20
# → 0x60806040...   (real code, not 0x)

cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "symbol()(string)" --rpc-url http://localhost:8545
# → "USDC"
```

The **identical** `cast call` from your probe now returns a real balance,
because the address now has real code and real storage.

### Addresses

| What | Address (Base mainnet) |
|---|---|
| USDC (native) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Aave V3 Pool | `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5` |

Confirm each one against the live fork rather than trusting a table — a
`cast code` that returns `0x`, or a `symbol()` that doesn't say `USDC`, means
the address is wrong:

```bash
cast call 0xA238Dd80C259a72e81d7e4664a9801593F98d1c5 \
  "getReserveData(address)" 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  --rpc-url http://localhost:8545
```

## 5. What stays local — why no real funds are at risk

A fork is a **local copy-on-read, copy-on-write shadow** of mainnet:

- **Reads** you haven't touched are lazily fetched from the upstream RPC and
  cached. That is the *only* network traffic, and it is read-only `eth_call` /
  `eth_getStorageAt`.
- **Writes** — every transaction you send, every state change — land in
  Anvil's local overlay. **Nothing is ever broadcast to Base.** There is no
  signed mainnet transaction anywhere in this flow.
- The fork state is disposable. Kill Anvil and it's gone; restart and you're
  back at the pinned block.

The keys involved are the standard Anvil dev keys (publicly known, worthless).
No private key with real funds is loaded, and the RPC URL is used only to
*read*. Pin a block with `--fork-block-number <n>` for reproducible runs and a
warm cache.

**The one real-world footgun:** if you later point `scaffold.config.ts` at
`chains.base` and connect a funded wallet, you're on mainnet for real. That's
the transition to guard, not the fork itself.

## 6. Getting a test account six figures of USDC

You cannot mint USDC — but on a fork you don't need to. You take it from an
address that already holds it. **Do not deploy a mock token here**; that would
put you right back to testing your assumptions instead of Aave.

USDC has **6 decimals**, so 100,000 USDC = `100000000000`.

### Recommended: impersonate a real holder

```bash
RPC=http://localhost:8545
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
ME=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266   # Anvil account #0
WHALE=<a large USDC holder on Base>
AMOUNT=100000000000                              # 100,000 USDC

# 1. Confirm the whale actually has it (at your fork block)
cast call $USDC "balanceOf(address)(uint256)" $WHALE --rpc-url $RPC

# 2. Unlock it — no private key needed, this is a fork superpower
cast rpc anvil_impersonateAccount $WHALE --rpc-url $RPC

# 3. Give it gas (impersonated accounts may have no ETH)
cast rpc anvil_setBalance $WHALE 0xde0b6b3a7640000 --rpc-url $RPC   # 1 ETH

# 4. Take the USDC
cast send $USDC "transfer(address,uint256)" $ME $AMOUNT \
  --from $WHALE --unlocked --rpc-url $RPC

# 5. Verify
cast call $USDC "balanceOf(address)(uint256)" $ME --rpc-url $RPC
# → 100000000000

cast rpc anvil_stopImpersonatingAccount $WHALE --rpc-url $RPC
```

**Picking the whale.** Pull a current holder from the Basescan token-holders
page for USDC on Base (an exchange hot wallet or the Base bridge are good
picks) and verify with step 1 at your fork block — holder lists go stale.
Prefer a plain custodial holder over a *protocol* contract: draining USDC out
of Aave's own aUSDC reserve does give you tokens, but it also skews the
reserve's utilization and liquidity, which is exactly the state your vault is
being tested against.

### Equivalent: write the balance slot directly

When no convenient holder exists, forge the storage instead. USDC on Base is a
proxy, so find the balances slot empirically rather than assuming it:

```bash
SLOT=$(cast index address $ME 9)     # 9 = balances mapping slot; verify, don't assume
cast rpc anvil_setStorageAt $USDC $SLOT \
  $(cast to-uint256 100000000000) --rpc-url $RPC
cast call $USDC "balanceOf(address)(uint256)" $ME --rpc-url $RPC
```

If the read-back doesn't match, the slot index is wrong — sweep candidate
slots with `cast storage` until `balanceOf` reflects your write. Impersonation
is the more robust default because it needs no layout knowledge and preserves
`totalSupply`.

### In Solidity tests

The same fork works in `forge test`, which is where this belongs long term:

```bash
forge test --fork-url $BASE_RPC_URL --fork-block-number <n>
```

```solidity
vm.createSelectFork(vm.envString("BASE_RPC_URL"), BLOCK);
deal(USDC, alice, 100_000e6);        // cheatcode equivalent of the above
vm.prank(alice);
```

Keep the mock suite for unit-level logic; add fork tests for the integration.

## 7. Turn on interval mining

Anvil only mines when a transaction arrives, so between transactions
`block.timestamp` is **frozen**. Aave accrues interest as a function of time —
with a stalled clock your aToken balance never grows, APY reads as zero, and
any deadline or vesting display in the UI is silently wrong, even though
`vm.warp` unit tests pass.

```bash
cast rpc anvil_setIntervalMining 1 --rpc-url http://localhost:8545
```

Make it permanent by adding `--block-time 1` to the fork script in
`packages/foundry/package.json`.

`evm_mine` (restamp once) and `evm_increaseTime` (jump the clock) remain the
right tools for controlled single-step tests — they're a different instrument,
not a weaker one, and neither replaces interval mining under a live demo.

## Summary

| | `yarn chain` | `yarn fork --network base` |
|---|---|---|
| State at genesis | Empty | Copy of real Base |
| USDC at `0x8335…` | No code → probe returns `0x` | Real USDC, real balances |
| Aave V3 Pool | Absent → calls revert | Real pool, real liquidity, real rates |
| Chain ID | 31337 | 31337 (**still** — use `chains.foundry`) |
| Funding a test account | Mint a mock | Impersonate a holder, or `deal` |
| Real funds at risk | None | None — nothing is broadcast |
| Right for | Isolated logic, unit tests | Integration against deployed protocols |

Your setup was correct for a self-contained contract. The moment the vault
depended on deployed Aave and deployed USDC, `yarn chain` stopped being able
to show you the truth.
