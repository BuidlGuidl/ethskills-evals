# Why the probe fails, and how to get a local chain that has real Aave + real USDC

## 1. What `yarn chain` actually gives you

`yarn chain` starts **anvil with an empty genesis state**. Its entire contents are:

- 10 prefunded dev accounts (10000 fake ETH each, from the well-known
  `test test test ... junk` mnemonic),
- chain id `31337`,
- **nothing else**.

Then `yarn deploy` adds exactly one thing: the bytecode of *your* contracts, at
freshly-computed CREATE addresses. That is the whole world.

It is not a copy of Base. It shares no state, no code, and no history with
mainnet. Mainnet addresses are just 20-byte numbers that happen to mean
something *on chain 8453* — on chain 31337 they are unallocated empty accounts.

`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` is the canonical Circle USDC proxy
**on Base mainnet**. On your local chain it is an address with no code, no
storage, and no balance.

Confirm it in one line:

```bash
cast code 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 --rpc-url http://localhost:8545
# 0x        <- no code. Same for the Aave Pool address.
```

## 2. Why the probe *fails* instead of returning 0

This is worth being precise about, because the failure mode is diagnostic.

The EVM does not error when you `CALL` an account with no code. It succeeds
immediately and returns **zero bytes** of return data. So the node happily
answers your `eth_call` with `0x`.

The failure happens client-side in `cast`: you asked it to decode a `uint256`
out of a 0-byte return buffer, and there is nothing there to decode. You get a
decode/"empty return data" error, **not** a revert. That distinction is the tell:

- **Revert with reason** → the contract exists and rejected you.
- **Empty return data / decode error** → *there is no contract at that address.*

Drop the return-type annotation and you'll see the raw truth:

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
  --rpc-url http://localhost:8545
# error: no data / could not decode

cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)" 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
  --rpc-url http://localhost:8545
# 0x        <- the call "succeeded" and returned nothing
```

### And why your vault calls *revert* rather than silently no-op

Same root cause, different symptom. Solidity's high-level external calls
through an interface (`IERC20(usdc).balanceOf(...)`, `IPool(pool).supply(...)`)
emit an `EXTCODESIZE` check before/around the call — if the target has no code,
the compiler-generated check reverts. OpenZeppelin's `SafeERC20` does the same
thing explicitly (`Address.functionCall` requires a contract at the target).

So: every call into "USDC" or "the Aave Pool" reverts, because you are calling
into the void. The vault code is probably fine. The chain is empty.

### Why the mock tests didn't catch it

Your forge tests deploy `MockERC20` / `MockPool` at fresh addresses and inject
them into the vault constructor. They prove your vault talks correctly **to
your mocks**, i.e. to your *assumptions* about Aave and USDC. They never touch
the real addresses, so they cannot detect "the address is empty."

They also can't detect the things that actually bite in integration:

- USDC on Base is `FiatTokenV2_2` behind a proxy — 6 decimals, blacklist
  checks, and (per Circle's implementation) an `approve` that is fine but whose
  semantics people often mock wrong.
- Aave's `aToken` balance **rebases**; a mock that mints a fixed 1:1 receipt
  hides every accounting bug you have.
- Real Aave reverts on supply caps, frozen/paused reserves, and zero amounts,
  with numeric string error codes (see Aave's `Errors.sol`) that your mock
  never produces.
- Real reserve config (liquidity index, decimals, e-mode) vs. your mock's
  defaults.

Keep the mock tests — they're fast unit tests. But they are not integration
tests. The setup below is.

## 3. The fix: run a *fork* of Base locally

A forked anvil is still a local, throwaway chain — but instead of an empty
genesis, every state read it can't answer locally is lazily fetched from a real
Base RPC at a pinned block and cached. The result is that the mainnet addresses
have their real code and real storage, so **the exact same `cast call` works
unchanged**.

### 3.1 Start the fork

Scaffold-ETH 2 ships a `yarn fork` script (check
`packages/foundry/package.json` and set the fork URL / `.env` it reads — the
default in a fresh scaffold points at Ethereum mainnet, not Base). You can also
just run anvil directly, which is clearer while you're debugging:

```bash
anvil \
  --fork-url https://base-mainnet.g.alchemy.com/v2/$ALCHEMY_KEY \
  --fork-block-number 21000000 \
  --chain-id 31337 \
  --port 8545
```

Notes on each flag:

- **`--fork-url`** — any Base mainnet RPC. `https://mainnet.base.org` works for
  recent blocks but will rate-limit you hard under a forge test suite; use
  Alchemy / QuickNode / Infura. You need archive access if you pin an old block.
- **`--fork-block-number`** — pin it. Two reasons: (a) reproducibility — your
  tests stop drifting as Base advances; (b) Foundry caches fetched state under
  `~/.foundry/cache/rpc/base/<block>/`, so the second run is fast and mostly
  offline. Without a pin you re-fetch a new block's state on every restart.
- **`--chain-id 31337`** — keeps Scaffold-ETH's default `chains.foundry` target
  network, the burner wallet, and `deployedContracts.ts` wiring working with no
  frontend changes. Trade-off: contracts that branch on `block.chainid` (some
  permit/EIP-712 domains) will see 31337. Neither Aave V3 nor USDC's core paths
  care, but if you hit an EIP-712 signature mismatch, that's the reason — drop
  the flag to keep the fork's native `8453` and add a matching chain entry to
  `scaffold.config.ts` instead.

Now the original probe works:

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
  --rpc-url http://localhost:8545
# 0        <- a real answer from real USDC code, not a decode error

cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "decimals()(uint8)" \
  --rpc-url http://localhost:8545
# 6
```

### 3.2 Base mainnet addresses your deploy script needs

Do **not** hardcode these from memory or from a blog post — resolve the Aave
ones from the `PoolAddressesProvider` against your fork, which is the only
source that can't go stale:

```bash
PROVIDER=0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D   # Aave V3 Base PoolAddressesProvider
cast call $PROVIDER "getPool()(address)" --rpc-url http://localhost:8545
# -> 0xA238Dd80C259a72e81d7e4664a9801593F98d1c5  (Aave V3 Base Pool)

POOL=$(cast call $PROVIDER "getPool()(address)" --rpc-url http://localhost:8545)
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
cast call $POOL "getReserveData(address)" $USDC --rpc-url http://localhost:8545
# the aToken address (aBasUSDC) is one of the fields; decode it rather than
# trusting a copy-pasted constant
```

Sanity-check that the reserve is active and not frozen/paused before you blame
your vault for a revert — on a fork you can read the real config.

### 3.3 Make the deploy script use them

Your mock tests pass mock addresses into the constructor; the deploy script
must pass the real ones when it targets the fork. Branch on chain id or read
from `.env`:

```solidity
// packages/foundry/script/Deploy.s.sol (sketch)
address usdc = vm.envOr("USDC", 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913);
address provider = vm.envOr("AAVE_PROVIDER", 0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D);
require(usdc.code.length > 0, "no USDC code: are you on a fork?");
require(provider.code.length > 0, "no Aave code: are you on a fork?");
new Vault(usdc, IPoolAddressesProvider(provider).getPool());
```

That `code.length` assertion is worth keeping permanently — it turns exactly the
failure you just spent time on into a one-line deploy-time error.

Then `yarn deploy` as usual (it points at `localhost:8545`, which is now the
fork), and `yarn start`. The frontend needs no changes if you kept
`--chain-id 31337`.

### 3.4 Fork-mode forge tests (the real integration tests)

Add to `foundry.toml`:

```toml
[rpc_endpoints]
base = "${BASE_RPC_URL}"
```

```solidity
contract VaultForkTest is Test {
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant PROVIDER = 0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D;
    address alice = makeAddr("alice");

    function setUp() public {
        vm.createSelectFork(vm.rpcUrl("base"), 21_000_000);  // pin the block
        vault = new Vault(USDC, IPoolAddressesProvider(PROVIDER).getPool());
        deal(USDC, alice, 250_000e6, true);   // 250,000 USDC, 6 decimals
    }
}
```

Run with `forge test --fork-url base` or just `forge test` (the
`createSelectFork` handles it). Mark them `--match-path` separately from the
mock suite so CI can run mocks on every push and fork tests on a schedule.

## 4. What stays local — why no real funds are at risk

This is the part worth being unambiguous about, because "connects to Base
mainnet" sounds alarming and isn't:

- **The fork is read-only against the remote chain.** Anvil issues
  `eth_getCode` / `eth_getStorageAt` / `eth_getBalance` at the pinned block and
  caches the answers. It never calls `eth_sendRawTransaction` upstream.
- **Your transactions exist only in anvil's in-memory overlay.** Deposits,
  Aave `supply()` calls, storage writes — all of it lands in a local diff on
  top of the cached snapshot. Base has no idea any of it happened.
- **You never use a real private key.** You sign with anvil's dev accounts,
  whose keys are public and hold only fake ETH. Nothing you sign is valid
  anywhere that matters, because it's never broadcast. Do **not** put a real
  funded key in `.env` for this; you don't need one.
- **Nothing leaves your machine except read requests** to your RPC provider
  (and after the first run, most are served from `~/.foundry/cache`).
- **It's disposable.** Restart anvil and you're back to the pinned block. For
  finer control, snapshot mid-test:

  ```bash
  ID=$(cast rpc evm_snapshot --rpc-url http://localhost:8545)
  # ... do destructive things ...
  cast rpc evm_revert $ID --rpc-url http://localhost:8545
  ```

The "real" in "real Aave" means *real bytecode and real reserve state*, not
real money.

## 5. Getting a test account six figures of USDC

You can't mint USDC — only Circle can. On a fork you don't have to: you forge
the balance directly. Two approaches, pick by context.

### In forge tests: `deal`

```solidity
deal(USDC, alice, 250_000e6, true);   // 4th arg also adjusts totalSupply
```

`deal` uses `stdstore` to locate the `balanceOf` storage slot by probing, then
writes it. Note `250_000e6` — USDC is **6 decimals**; `250_000e18` is a classic
bug that makes tests pass for the wrong reason. If `deal` ever fails to find
the slot on a proxy, fall back to the explicit `anvil_setStorageAt` below.

### Against the running anvil (for the frontend and `cast`): impersonate a whale

This is the most robust option because it exercises a real `transfer` through
real USDC code, including its blacklist checks.

```bash
RPC=http://localhost:8545
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
ME=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266     # anvil account #0
WHALE=<pick one, see below>

# 1. Verify the whale is actually rich at your pinned block
cast call $USDC "balanceOf(address)(uint256)" $WHALE --rpc-url $RPC

# 2. Unlock it and give it gas money (anvil mints ETH from nothing)
cast rpc anvil_impersonateAccount $WHALE --rpc-url $RPC
cast rpc anvil_setBalance $WHALE 0xde0b6b3a7640000 --rpc-url $RPC   # 1 ETH

# 3. Move 250,000 USDC (6 decimals -> 250000000000)
cast send $USDC "transfer(address,uint256)" $ME 250000000000 \
  --from $WHALE --unlocked --rpc-url $RPC

cast rpc anvil_stopImpersonatingAccount $WHALE --rpc-url $RPC

# 4. Confirm
cast call $USDC "balanceOf(address)(uint256)" $ME --rpc-url $RPC
# 250000000000
```

**Picking the whale:** open the USDC token holders list on Basescan and take a
large contract — the Aave V3 aUSDC reserve itself, the Base bridge, or a major
DEX pool are all good candidates. The only requirements are that it holds ≥ your
amount **at the block you pinned** (step 1 checks this) and isn't blacklisted.
Whale balances change, so re-check whenever you move the pinned block; a stale
hardcoded whale is the #1 cause of "the fork setup broke and nobody touched it."

### Deterministic alternative: write the storage slot

No whale needed, doesn't depend on anyone's balance:

```bash
# USDC on Base is FiatTokenV2_2; its balance mapping lives at slot 9
SLOT=$(cast index address $ME 9)
cast rpc anvil_setStorageAt $USDC $SLOT \
  $(cast to-uint256 250000000000) --rpc-url $RPC
cast call $USDC "balanceOf(address)(uint256)" $ME --rpc-url $RPC
```

Verify rather than trust the slot number: if `balanceOf` doesn't read back
`250000000000`, loop slots 0–20 with `cast index address $ME <n>` until one
does. (In `FiatTokenV2_2` that slot is `balanceAndBlacklistStates`, packing the
blacklist flag into the high bit — writing a plain balance leaves the flag
clear, which is what you want.) This bypasses `totalSupply`, which is
harmless for testing but means supply-based invariants will look off.

### Then approve and deposit

```bash
cast send $USDC "approve(address,uint256)" $VAULT 250000000000 \
  --private-key $ANVIL_KEY0 --rpc-url $RPC
cast send $VAULT "deposit(uint256)" 250000000000 \
  --private-key $ANVIL_KEY0 --rpc-url $RPC
```

For the frontend, the burner wallet address is what needs the USDC — grab it
from the app and use it as `$ME`.

## 6. Gotchas once the fork is up

- **Time doesn't pass.** Aave interest accrues per second of `block.timestamp`.
  To see yield, advance time explicitly:
  `cast rpc evm_increaseTime 2592000 && cast rpc evm_mine` (30 days), or
  `vm.warp(block.timestamp + 30 days)` in tests.
- **aToken balances rebase.** `aUSDC.balanceOf()` grows on its own; don't cache
  it as a share count. If your vault stores a raw aToken amount as user shares,
  the fork will expose that bug and the mocks never will.
- **Reverts are now real and decodable.** Aave reverts with numeric string
  codes (see Aave V3 `Errors.sol` — supply cap exceeded, reserve frozen,
  reserve paused, etc.). Run failing calls with `cast call --trace` or
  `forge test -vvvv` to see which one.
- **RPC cost and rate limits.** A fork test suite can issue thousands of state
  reads. Pin the block so the Foundry cache absorbs repeat runs, and use a
  paid endpoint if CI runs these.
- **Keep both suites.** Mocks for fast unit coverage of your own logic; fork
  tests for every assumption about someone else's contract. The bug you hit is
  the canonical example of what only the second kind catches.

## 7. TL;DR checklist

1. `cast code <addr>` on your current chain returns `0x` — that's the whole bug.
   Empty return data ≠ revert; it means nothing is deployed there.
2. Restart the chain as a pinned Base fork:
   `anvil --fork-url <base-rpc> --fork-block-number <N> --chain-id 31337`.
3. Resolve the Aave Pool from the `PoolAddressesProvider` on the fork; assert
   `code.length > 0` for USDC and the Pool in the deploy script.
4. `yarn deploy`, `yarn start` — unchanged.
5. Fund the test account: `deal(USDC, alice, 250_000e6, true)` in tests;
   whale impersonation (or `anvil_setStorageAt`) against the running node.
6. Everything stays local: reads are fetched and cached, writes never leave
   anvil, keys are anvil's throwaway dev keys, and a restart resets it all.
