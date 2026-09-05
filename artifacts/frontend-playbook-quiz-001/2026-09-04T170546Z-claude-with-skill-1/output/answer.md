# Why the probe fails, and how to run the same calls against real Aave + real USDC

## 1. What `yarn chain` actually gives you

`yarn chain` starts a **bare Anvil node**: a brand-new chain, genesis block 0, chain
ID 31337. Its entire world state is:

- 10 prefunded dev accounts (10000 ETH each, from the well-known `test test ... junk` mnemonic)
- whatever **your** `yarn deploy` script just put there

That is all. It is not a copy of Base, it never talks to Base, and it has no idea
that Base exists. Every mainnet/L2 address you know — USDC, the Aave V3 `Pool`,
the `PoolAddressesProvider`, the aToken — is, on this chain, an address with **no
code and no storage**: an empty account, indistinguishable from a random EOA.

## 2. Why the `cast call` fails outright

```
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "balanceOf(address)(uint256)" <addr> \
  --rpc-url http://localhost:8545
```

`0x8335…2913` is USDC **on Base**. On your local chain that account has no
bytecode, so the EVM has nothing to execute. A call to a codeless account is not
an error at the EVM level — it "succeeds" and returns **zero bytes**. `cast` is
then asked to decode `0x` as a `uint256`, has 0 bytes where it needs 32, and
errors out. That is the "fails outright" you are seeing; the failure is in the
decode step, and it is telling you the truth: there is no token there.

## 3. Why every integration call reverts

Same root cause, one layer up. When Solidity makes a high-level call through an
interface (`IERC20(usdc).balanceOf(...)`, `IPool(pool).supply(...)`), the compiler
emits an `extcodesize` check on the target before the call. Target has no code →
the check fails → your vault reverts, typically with **no revert reason**, which is
why the errors look so uninformative. Nothing in your vault is wrong; it is
calling addresses that are empty on this chain.

## 4. Why the forge tests pass anyway

Your unit tests deploy `MockERC20` / a mock pool *inside the test*, so the
addresses under test do have code and behave the way the mock says they do. Mocks
prove your vault's own logic; they prove nothing about Aave's actual interface,
its return values, its revert conditions, its `Pool` upgrade state, USDC's 6
decimals, blacklisting, or approval semantics. A green mock suite plus a reverting
local integration is exactly the expected outcome of the setup you described — not
a contradiction.

## 5. The setup you want: fork mode

Rule of thumb: **`yarn chain` for isolated contracts, mocks and unit tests; `yarn fork`
whenever behavior depends on already-deployed protocols, tokens or balances.**
Your vault is in the second category, so run a Base fork.

### 5.1 Configure an upstream RPC

Anvil needs a real Base RPC to read state from. In `packages/foundry/.env`:

```bash
ALCHEMY_API_KEY=<your key>       # SE-2's default provider
# or point foundry.toml's rpc_endpoints at any Base RPC you trust
```

`packages/foundry/foundry.toml` already carries an `[rpc_endpoints]` table; make
sure it has a `base` entry, e.g.

```toml
[rpc_endpoints]
base = "https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}"
```

### 5.2 Start the fork instead of the plain chain

Terminal 1 — replaces `yarn chain`:

```bash
yarn fork --network base
```

You now have a local Anvil that **lazily copies Base's state**: the first time
anything touches `0x8335…2913`, Anvil fetches that account's code and the storage
slots it reads from the upstream RPC and caches them locally. It still listens on
`http://localhost:8545` and still reports **chain ID 31337**.

Terminal 2 — deploy your vault onto the fork exactly as before:

```bash
yarn deploy            # targets localhost / 31337, i.e. the fork
```

Terminal 3:

```bash
yarn start
```

### 5.3 Point the frontend at the fork, not at Base

In `packages/nextjs/scaffold.config.ts`:

```typescript
targetNetworks: [chains.foundry],   // 31337 — the local fork
```

Do **not** set `chains.base` here. Setting it would send the app's reads and
writes to real Base, where your vault does not exist, and would prompt users to
sign real transactions. `chains.base` is for an actual production deployment only.
The point of the fork is that the addresses are Base's while the node is yours.

### 5.4 Re-run the probe

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" 0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB \
  --rpc-url http://localhost:8545
```

This now returns a real number, because real USDC bytecode and real storage were
pulled in. Same command, same address, same URL — only the node changed.

## 6. What stays local (why no real funds are at risk)

- The fork is **read-only upstream**. Anvil issues `eth_getCode` / `eth_getStorageAt` /
  `eth_getBlockByNumber` against the Base RPC and nothing else. Your transactions
  are executed and stored **in Anvil's local memory only**; they are never
  broadcast, never enter a Base mempool, and never appear on Basescan.
- You sign with Anvil's well-known dev keys, which control nothing on real Base.
  Never put a real funded private key in `packages/foundry/.env` — SE-2's
  `yarn account:import` / encrypted keystore flow exists for the deploy case, and
  fork mode does not need it at all.
- Impersonation and state overrides (below) are Anvil RPC methods. They exist only
  on your node; there is no counterpart on Base.
- The upstream copy is a snapshot pinned at the fork block. Restart the fork and
  every local change is gone.

## 7. Getting six figures of USDC into a test account

Do **not** deploy a mock USDC — that reintroduces the exact problem you are trying
to escape (Aave would not recognize it). Instead, take the real token from an
address that already holds it on Base.

```bash
RPC=http://localhost:8545
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913          # USDC on Base (6 decimals)
WHALE=0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB          # aBasUSDC — holds the Aave pool's USDC
ME=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266             # Anvil account #0
AMT=250000000000                                          # 250,000 USDC (6 decimals)

# 0. sanity-check the whale really holds enough on this fork
cast call $USDC "balanceOf(address)(uint256)" $WHALE --rpc-url $RPC

# 1. the whale is a contract with no ETH; give it gas money
cast rpc anvil_setBalance $WHALE 0xde0b6b3a7640000 --rpc-url $RPC   # 1 ETH

# 2. impersonate it and move the tokens
cast rpc anvil_impersonateAccount $WHALE --rpc-url $RPC
cast send $USDC "transfer(address,uint256)" $ME $AMT \
  --from $WHALE --unlocked --rpc-url $RPC
cast rpc anvil_stopImpersonatingAccount $WHALE --rpc-url $RPC

# 3. verify
cast call $USDC "balanceOf(address)(uint256)" $ME --rpc-url $RPC     # 250000000000

# 4. gas for your own test account, if needed
cast rpc anvil_setBalance $ME 0x21e19e0c9bab2400000 --rpc-url $RPC   # 10,000 ETH
```

Any address with a large USDC balance works as `$WHALE`; the aToken is convenient
because the Aave pool's entire USDC reserve sits there. Confirm the balance in
step 0 rather than trusting a hardcoded holder — holdings drift as you move the
fork block.

**Fallback when no suitable holder exists:** write the balance slot directly.
Base USDC is a `FiatTokenProxy`; `balanceAndBlacklistStates` lives at slot 9, with
the blacklist flag in the top bit, so a plain balance value is a valid word:

```bash
SLOT=$(cast index address $ME 9)
cast rpc anvil_setStorageAt $USDC $SLOT \
  $(cast to-uint256 $AMT) --rpc-url $RPC
```

Prefer the transfer: it goes through the token's real logic, so it also validates
that your account is not blacklisted and that total supply accounting stays sane.

## 8. Two things that will bite you next

**The clock is frozen.** Anvil mines only when a transaction arrives, so between
transactions `block.timestamp` and the latest block stand still, then jump in one
step on the next tx. Aave accrues interest off `block.timestamp` via the liquidity
index — so your vault's yield, share price and any deadline/expiry UI will sit
motionless during a demo even though `vm.warp` unit tests pass. Turn on interval
mining:

```bash
cast rpc anvil_setIntervalMining 1 --rpc-url $RPC
```

Or make it permanent by adding `--block-time 1` to the fork script. Note that
`evm_mine` restamps the timestamp exactly once and then it freezes again, and
`evm_increaseTime` is for controlled single-step tests — neither is a substitute
for interval mining in a running demo.

**Move your tests onto the fork too.** Keep the mock suite for unit logic, but add
integration tests that run against real Aave, so interface drift shows up in CI
rather than in the browser:

```solidity
uint256 fork = vm.createSelectFork(vm.rpcUrl("base"), 12345678);  // pin the block
```

```bash
forge test --match-contract VaultIntegration --fork-url base
```

## 9. Address checklist (Base mainnet)

| What | Address |
| --- | --- |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Aave V3 `PoolAddressesProvider` | `0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D` |
| Aave V3 `Pool` | `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5` |
| aBasUSDC (aToken) | `0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB` |

Resolve the `Pool` from the provider rather than hardcoding it — it is upgradeable
and the fork will tell you the truth for your fork block:

```bash
cast call 0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D "getPool()(address)" --rpc-url $RPC
```

## TL;DR

`yarn chain` is an empty chain containing only your own deployment, so the Base
USDC address holds no code; the call returns `0x`, `cast` cannot decode 32 bytes
from nothing, and your vault's high-level calls revert on the compiler's
`extcodesize` check. Swap terminal 1 to `yarn fork --network base`, keep
`targetNetworks: [chains.foundry]` (still 31337), redeploy, and the identical
calls hit real Aave and real USDC. Everything executes locally against a lazily
copied snapshot — nothing is broadcast and no real key is used — and you fund a
test account by impersonating an existing USDC holder and transferring 250,000
USDC (`250000000000`, 6 decimals) to it.
