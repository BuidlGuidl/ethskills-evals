# Why your local chain can't see USDC or Aave — and how to make it

**TL;DR:** `yarn chain` starts a *bare* anvil — an empty chain whose entire state is
10 dev accounts, a CREATE2 deployer, and whatever `yarn deploy` just put there. Base
mainnet's USDC is not in it. `0x8335…2913` on that chain is an address with no code,
so the probe fails at the ABI-decode step and your vault's integration calls revert on
Solidity's `extcodesize` check. The fix is to run anvil as a **fork of Base**: same
port, same `yarn deploy`, same addresses — but now backed by real Base state. Below is
the exact setup, plus three ways to give a test account six figures of USDC.

Every command, address and output in this document was executed against a live Base
fork (anvil 1.5.1, fork block 50875600) while writing it. Values marked *verified* are
real outputs, not recollection.

---

## 1. What `yarn chain` actually contains

In the foundry flavor, `yarn chain` runs `anvil --config-out localhost.json`. With no
`--fork-url`, anvil builds a **genesis state from scratch**. That state is:

| What's there | Detail |
|---|---|
| 10 dev accounts | mnemonic `test test test test test test test test test test test junk`, 10000 ETH each. Account #0 is `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` — the same address as SE-2's `scaffold-eth-default` keystore deployer. |
| CREATE2 deployer | `0x4e59b44847b379578588920cA78FbF26c0B4956C`, 69 bytes (*verified*). |
| Multicall3 | **Not predeployed** on anvil 1.5.1 — `cast code 0xcA11…CA11` returns `0x` (*verified*). |
| Your contracts | Whatever `yarn deploy` broadcast a moment ago. |
| Chain id | `31337` |

That's the whole world. There is no USDC, no Aave `Pool`, no Uniswap, no Chainlink
feed, no Permit2. Anvil is not "Base running locally" — it's a blank EVM that happens
to speak the same JSON-RPC. Nothing about deploying *your* contracts to it imports
anyone else's.

So the address `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` — which is real, and is
Circle's native USDC **on Base mainnet** — is, on your local chain, just a 20-byte
number nobody has ever touched.

## 2. Why the probe fails outright

Run the diagnostic that settles it in one line:

```bash
cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://localhost:8545
# 0x        <-- no code. Case closed.
```

Now the probe itself. *Verified* output:

```
$ cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
    "balanceOf(address)(uint256)" 0xf39Fd6…2266 --rpc-url http://localhost:8545

Error: contract 0x833589fcd6edb6e08f4c7c32d4f71b54bda02913 does not have any code
```

Note the shape of that failure — it is *not* a revert:

- `eth_call` to a codeless address **succeeds**. The EVM has nothing to execute, so it
  halts immediately and returns zero bytes.
- The empty return is the problem. Ask for the raw bytes and it goes through happily:
  `cast call … "balanceOf(address)"` (no return type) prints `Warning: Contract code is
  empty` and `0x`, exit code 0 (*verified*).
- Because you declared a return type `(uint256)`, cast has to decode 32 bytes out of
  0 bytes. Newer casts front-run that with the explicit "does not have any code"
  message; older ones surface it as a raw ABI-decode/buffer-overrun error. Same cause.

**Why your vault reverts, though.** Different mechanism, same root cause. When Solidity
makes a high-level call through an interface with a non-empty return type —
`IERC20(usdc).balanceOf(x)`, `IPool(pool).supply(...)` — the compiler emits an
`extcodesize` check on the target *before* the call and reverts with **no reason
string** if the target is empty. That's your "every integration call reverts": an
empty-data revert with no custom error, on the first line that touches Aave or USDC.

(The nastier sibling: a *low-level* `.call()` to a codeless address returns
`success = true` with empty returndata. If any of your code does that without a
codesize check, it will silently "succeed" at doing nothing. Worth grepping for.)

**Why the mock tests pass.** Your forge tests deploy a `MockERC20` and a `MockPool`
and hand those addresses to the vault. Those addresses *do* have code, so the codesize
check passes and the mock returns whatever you programmed. The tests prove your vault
talks correctly to *your idea of* Aave. They cannot fail on the one thing that is
actually broken, because they never load the real address, the real bytecode, the real
proxy indirection, or the real reserve configuration. Green mocks and a broken
integration are perfectly consistent — that's the gap fork testing closes.

---

## 3. The fix: run the local chain as a fork of Base

Same RPC endpoint, same deploy flow, same hardcoded addresses in your contracts — but
anvil now lazily pulls real Base state over RPC on every `SLOAD`/`EXTCODECOPY` miss and
caches it.

### 3.1 Get an RPC endpoint

```bash
# packages/foundry/.env
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/<key>
```

`https://mainnet.base.org` works for a quick try (it's what produced every *verified*
output here) but it rate-limits hard and won't serve older archive state. Use Alchemy /
QuickNode / Infura for anything sustained, and make sure the plan includes archive
access if you pin an old block.

### 3.2 Start the fork

```bash
anvil \
  --fork-url "$BASE_RPC_URL" \
  --fork-block-number 50875600 \
  --chain-id 8453 \
  --auto-impersonate \
  --config-out localhost.json
```

Flag by flag:

- `--fork-block-number` — **pin it.** Unpinned, you re-fork at a new head on every
  restart and your tests drift with mainnet: rates move, whale balances vanish, results
  stop reproducing. Pinning also makes anvil's disk cache (`~/.foundry/cache/rpc`) hit,
  so the second start is dramatically faster than the first.
- `--chain-id 8453` — keep Base's real chain id. Not strictly required, but it keeps
  the frontend, `deployedContracts.ts`, wallets and any `block.chainid` logic coherent,
  and it means signatures produced locally are shaped like the ones you'll use in prod.
  (A pedantic note, since this myth is common: Base USDC is FiatTokenV2.2, which
  computes `DOMAIN_SEPARATOR` *dynamically* per call — *verified*, it differs between a
  8453 fork and a 31337 fork of the same block. So `permit` would not actually break
  under 31337. Prefer 8453 for the config coherence, not out of fear of EIP-712.)
- `--auto-impersonate` — lets you `--from` any address without an explicit
  `anvil_impersonateAccount` call first. Convenient for whale/minter tricks below.

Wire it into SE-2 so the team gets it with one command — `packages/foundry/package.json`:

```json
"chain": "anvil --config-out localhost.json",
"fork":  "dotenvx run -- anvil --fork-url $BASE_RPC_URL --fork-block-number 50875600 --chain-id 8453 --auto-impersonate --config-out localhost.json"
```

Then `yarn fork` replaces `yarn chain`. Everything else in your loop is unchanged.

### 3.3 foundry.toml

```toml
[rpc_endpoints]
base      = "${BASE_RPC_URL}"        # real Base — for forking and fork tests
localhost = "http://127.0.0.1:8545"  # your fork — for deploys
```

Keeping these as two separate aliases is the important bit: **`yarn deploy` still
targets `localhost` and needs no change at all.** It broadcasts into the fork. Since
anvil reports chain id 8453, SE-2's `generateTsAbis` writes your addresses into
`deployedContracts.ts` under key `8453`, which is exactly where the frontend will look
once you point it at Base.

Anvil funds its 10 dev accounts on a fork too, so the `scaffold-eth-default` deployer
has gas out of the box (*verified*: 9999.99 ETH at `0xf39Fd6…2266`). A custom deployer
just needs `cast rpc anvil_setBalance <addr> 0xde0b6b3a7640000`.

### 3.4 Frontend

`packages/nextjs/scaffold.config.ts`:

```ts
targetNetworks: [chains.base],
rpcOverrides: {
  [chains.base.id]: "http://127.0.0.1:8545",   // Base by id, your fork by transport
},
onlyLocalBurnerWallet: false,   // burner wallet is local-only by default; chain 8453
                                // no longer counts as "local", so opt in explicitly
pollingInterval: 3000,
```

If your SE-2 version predates `rpcOverrides`, define a custom chain object that spreads
`chains.base` and swaps `rpcUrls.default.http` to `http://127.0.0.1:8545`.

Two cosmetic consequences: block-explorer links point at Basescan and won't resolve
your local txs, and MetaMask will want a network entry with chain id 8453 → `127.0.0.1:8545`
that collides with real Base. Use a separate browser profile, and reset the account's
nonce in MetaMask whenever you restart anvil.

### 3.5 Verify in ten seconds

```bash
cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://localhost:8545 | wc -c
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "symbol()(string)" --rpc-url http://localhost:8545
```

*Verified* on the fork: 3707 chars of bytecode, and `"USDC"`. The original probe now
returns `0` instead of erroring — a real balance of zero, from real code.

---

## 4. What stays local (and why no real funds are at risk)

This is the part worth being precise about, because "it's connected to mainnet" sounds
alarming and isn't.

- **Traffic to the upstream RPC is read-only.** Anvil only ever issues `eth_getProof`,
  `eth_getCode`, `eth_getStorageAt`, `eth_getBlockBy*` against your provider. It has no
  key for any mainnet account and never calls `eth_sendRawTransaction` upstream.
- **All writes stay in anvil's in-memory overlay.** Your supply, your minted USDC, your
  storage pokes — every one of them exists only in that process. Base mainnet is
  untouched and unaware. Kill anvil and the entire alternate history disappears.
- **The only keys in play are public ones.** The `test…junk` mnemonic accounts are known
  to everyone on earth. That's exactly why they're safe here and catastrophic anywhere
  else.
- **The USDC you'll create is not real USDC.** You are rewriting a storage slot in your
  own sandbox. It has no bridge, no redemption, no value, and cannot leave.

The genuine risks are operational, not financial, and there are three:

1. **Never put a funded private key in `packages/foundry/.env`.** Fork work needs no
   real key. Keep the SE-2 keystore (`yarn account:import` / `--account`) rather than
   raw `DEPLOYER_PRIVATE_KEY`, so a stray `--broadcast` can't sign with something real.
2. **`--rpc-url base` vs `--rpc-url localhost` is one word apart.** A `forge script
   --broadcast` pointed at the `base` alias with a funded signer is a mainnet deploy.
   Consider dropping a `[profile.default] eth_rpc_url = "http://127.0.0.1:8545"` default
   so the un-flagged case is always local.
3. **Your RPC provider sees which contracts and slots you read.** Metadata only, but
   it's not nothing if the strategy is confidential.

---

## 5. Getting a test account six figures of USDC

Three routes, in the order I'd reach for them. All *verified* against the fork; all
give the account real USDC as far as the real USDC contract is concerned.

USDC on Base is a `FiatTokenProxy` fronting `FiatTokenV2_2`. Balances live in
`balanceAndBlacklistStates` at **storage slot 9** of the *proxy* (*verified* below), 6
decimals. In v2.2 the top bit of that word is the blacklist flag, so any value below
2^255 reads as a plain, non-blacklisted balance — 250,000e6 is nowhere near it.

### Route A — write the storage slot (fastest, deterministic)

```bash
R=http://localhost:8545
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
ME=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

SLOT=$(cast index address $ME 9)            # 0xcb8911fb82c2d10f6cf1d31d1e521ad3f4e3f42615f6ba67c454a9a2fdb9b6a7
AMT=$(cast to-uint256 250000000000)         # 250,000 USDC (6 decimals)
cast rpc anvil_setStorageAt $USDC $SLOT $AMT --rpc-url $R

cast call $USDC "balanceOf(address)(uint256)" $ME --rpc-url $R
# 250000000000    <-- verified
```

No dependency on any third party's balance, so it can't rot when you re-pin the block.
Caveat: it doesn't touch `totalSupply`, leaving the two very slightly inconsistent.
Irrelevant for Aave; relevant if your vault ever reasons about USDC's total supply.

### Route B — impersonate the master minter (highest fidelity)

Goes through real minting code, so `totalSupply` stays correct.

```bash
MM=$(cast call $USDC "masterMinter()(address)" --rpc-url $R)   # 0x2230393EDAD0299b7E7B59F20AA856cD1bEd52e1 — verified
cast rpc anvil_setBalance $MM 0xde0b6b3a7640000 --rpc-url $R

cast send $USDC "configureMinter(address,uint256)" $ME 1000000000000 --from $MM --unlocked --rpc-url $R
cast send $USDC "mint(address,uint256)" $ME 100000000000 --from $ME --unlocked --rpc-url $R
```

*Verified*: balance rose by 100,000e6 **and** `totalSupply` rose by exactly the same
amount (4239783565803246 → 4239883565803246). Read `masterMinter()` off the fork rather
than hardcoding it — Circle rotates it.

### Route C — impersonate a whale (most realistic provenance)

```bash
WHALE=<address holding USDC at your pinned block>
cast rpc anvil_setBalance $WHALE 0xde0b6b3a7640000 --rpc-url $R
cast send $USDC "transfer(address,uint256)" $ME 250000000000 --from $WHALE --unlocked --rpc-url $R
```

Exercises the real `transfer` path including blacklist checks, but it's the brittlest —
whales move, so a whale valid at one pinned block may be empty at another. Aave's own
aToken (`0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB`) holds a large USDC float and makes
a stable-ish source.

### In forge tests, just use `deal`

```solidity
deal(USDC, alice, 250_000e6);          // stdStorage finds slot 9 for you
deal(USDC, alice, 250_000e6, true);    // ...and adjusts totalSupply too
```

---

## 6. The real Base addresses — derive, don't hardcode

Only two of these are worth hardcoding. Everything else should be read from the
`PoolAddressesProvider`, which is the pattern Aave intends and which survives their
upgrades:

```bash
PROV=0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D
cast call $PROV "getMarketId()(string)"          --rpc-url $R   # "Aave V3 BASE Market"
cast call $PROV "getPool()(address)"             --rpc-url $R
cast call $PROV "getPoolDataProvider()(address)" --rpc-url $R
cast call $PROV "getPriceOracle()(address)"      --rpc-url $R
```

*Verified* at fork block 50875600:

| Role | Address | How to get it |
|---|---|---|
| USDC (native, Circle) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | hardcode |
| PoolAddressesProvider | `0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D` | hardcode |
| Pool | `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5` | `getPool()` |
| PoolDataProvider | `0x0F43731EB8d45A581f4a36DD74F5f358bc90C73A` | `getPoolDataProvider()` |
| Price oracle | `0x2Cc0Fc26eD4563A5ce5e8bdcfe1A2878676Ae156` | `getPriceOracle()` |
| aBasUSDC (aToken) | `0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB` | `getReserveData(USDC).aTokenAddress` |
| variableDebtUSDC | `0x59dca05b6c26dbd64b5381374aAaC5CD05644C28` | `getReserveData(USDC).variableDebtTokenAddress` |

Deriving matters: I had a stale value for the data provider from an earlier Aave
release, and the fork corrected it. `getPoolDataProvider()` can't go stale.

Also make sure you're on **native USDC**, not bridged USDbC
(`0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA`) — different token, different Aave
reserve, and a classic source of "it reverts and I don't know why".

## 7. Proof the whole thing works

Full supply flow against **real Aave V3**, run on the fork (*verified*):

```bash
POOL=0xA238Dd80C259a72e81d7e4664a9801593F98d1c5
ATOKEN=0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB
K=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80  # anvil acct #0

cast send $USDC "approve(address,uint256)" $POOL 350000000000 --private-key $K --rpc-url $R
cast send $POOL "supply(address,uint256,address,uint16)" $USDC 300000000000 $ME 0 --private-key $K --rpc-url $R

cast call $ATOKEN "balanceOf(address)(uint256)" $ME --rpc-url $R
# 299999999999      <-- 300k aUSDC (note: 1 wei of rounding)

cast rpc evm_increaseTime 2592000 && cast rpc evm_mine    # +30 days
cast call $ATOKEN "balanceOf(address)(uint256)" $ME --rpc-url $R
# 300923798420      <-- ~924 USDC of real interest accrued, ≈3.7% APY
```

That last pair of lines is the thing mocks can never give you: real rate math, over
real time, from the real reserve.

## 8. Add fork tests alongside the mocks

Keep the mock tests — they're fast and good for edge cases. Add a fork suite for
integration truth:

```solidity
contract VaultForkTest is Test {
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant POOL = 0xA238Dd80C259a72e81d7e4664a9801593F98d1c5;

    function setUp() public {
        vm.createSelectFork(vm.rpcUrl("base"), 50_875_600);   // pin it
        vault = new Vault(USDC, POOL);
        deal(USDC, alice, 250_000e6);
    }
}
```

`forge test --match-contract Fork` hits the `base` alias directly and caches, so it
doesn't even need anvil running.

## 9. Gotchas that will bite you next

- **`evm_increaseTime` is required for yield.** Anvil doesn't advance time on its own;
  without a warp + `evm_mine`, aToken balances look frozen and you'll think the
  integration is broken.
- **aToken balances round down.** `299999999999`, not `300000000000` (*verified*).
  Assert with a tolerance (`assertApproxEqAbs`), never `assertEq`.
- **Aave reverts are numeric strings.** `'51'` = supply cap exceeded, `'26'` = invalid
  amount, `'23'` = reserve frozen. Check `getReserveCaps` before supplying large
  amounts — six figures is fine for USDC on Base today, but caps change.
- **Restarting anvil resets everything**, including your minted USDC and your deployed
  vault. Re-run `yarn deploy` and the funding script each time; a `make fund` target
  pays for itself.
- **First fork start is slow, later ones aren't** — that's the RPC cache warming.
  `--no-storage-caching` disables it if you ever need genuinely fresh state.
- **The bare-anvil failure mode is now a lint you can run.** `cast code <addr>`
  returning `0x` is the single fastest check for "am I on a fork or not", and worth a
  `require(addr.code.length > 0)` in your deploy script's constructor so this class of
  bug fails loudly at deploy time instead of silently at call time.
