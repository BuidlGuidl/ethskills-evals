# Why your integration calls revert locally — and how to make them hit real Aave + USDC

## Short version

`yarn chain` starts a **fresh, empty Anvil chain**. It has your deployed
contracts and 10 prefunded dev accounts — and *nothing else*. There is no
Aave, no USDC, no Uniswap, no Chainlink. The address in your probe
(`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) is **Circle's native USDC on
Base mainnet**, but on your local chain that address holds **no code**, so the
call has nothing to execute and fails. Your forge tests pass because they
deploy their *own* mock USDC/Aave — they never touch that address.

The fix is to run Anvil as a **fork of Base mainnet**. A fork lazily copies
real Base state on demand, so the real USDC and real Aave contracts appear at
their real addresses and behave exactly like mainnet — but every write lands
only on your local copy. Nothing is broadcast to Base, no real funds move, and
you fund a test account with six figures of USDC using a cheatcode or by
impersonating a whale.

---

## 1. What `yarn chain` actually gives you

`yarn chain` runs `anvil` with no fork flag. That produces a brand-new EVM
chain whose world state starts essentially empty:

- **Chain id `31337`**, block 0, a clean state trie.
- **10 deterministic dev accounts**, each prefunded with 10,000 test ETH
  (from the standard `test test test … junk` mnemonic). This test ETH is
  fake — it exists only on this chain.
- **Only the contracts `yarn deploy` puts there.** Your `Vault` deploys fine
  because Solidity + the deployer are all it needs.

What is **not** there: every contract you didn't deploy yourself. Aave's
`Pool`, the aToken/aUSDC, the `PoolAddressesProvider`, the USDC token — none of
those addresses have any bytecode. They're just empty accounts.

So when your vault does something like:

```solidity
IPool(AAVE_POOL).supply(USDC, amount, address(this), 0);
```

`AAVE_POOL` and `USDC` are Base mainnet addresses that, on your local chain,
point at empty accounts. A call to an address with no code returns success with
empty data at the EVM level, and any decode of a return value (or any
`transferFrom` that must actually move tokens) reverts. Net effect: **every
integration call reverts.**

### Why the `cast call` probe fails outright

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" <any address> \
  --rpc-url http://localhost:8545
```

That address is USDC **on Base**. On your fresh local chain it has no code, so
there is no `balanceOf` to run. `cast` calls it, gets back empty data, tries to
ABI-decode a `uint256` from zero bytes, and errors out. It's not a balance of
zero — it's "there's no contract here at all."

### Why the mock tests pass anyway

Your forge tests don't depend on that address existing. A mock-based test does
one of:

```solidity
MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
MockAavePool pool = new MockAavePool();
// ... wire the vault to these freshly-deployed mocks ...
```

The mocks are deployed *inside the test*, at addresses chosen by the test VM,
with simplified logic that always behaves. They prove your vault's Solidity
logic against a **stand-in**, not against Aave's real accounting, real interest
accrual, or USDC's real (proxied, blacklist-checked) implementation. That's why
"tests green, local app red" is not a contradiction — the two run against
completely different worlds.

---

## 2. The local setup that hits **real** Aave and **real** USDC

The tool for this is **forking**. Instead of an empty chain, you tell Anvil to
back its state with a real Base RPC endpoint:

> Fork = a local Anvil node that, whenever it's asked for state it doesn't have
> (an account's code, a storage slot, a balance), fetches that slice from a real
> Base archive/RPC node and caches it. Real contracts appear at their real
> addresses with their real state. All **writes** go into Anvil's local overlay
> and are **never** sent to Base.

### 2a. Get a Base RPC URL

You need an endpoint that serves Base mainnet state — Alchemy, Infura,
QuickNode, or the public `https://mainnet.base.org` (fine for light use, rate
limited). Put it in `packages/foundry/.env`:

```bash
# packages/foundry/.env
FORK_URL=https://base-mainnet.g.alchemy.com/v2/<YOUR_KEY>
```

Scaffold-ETH's foundry package already ships a `fork` script:

```jsonc
// packages/foundry/package.json
"fork": "anvil --fork-url ${FORK_URL:-mainnet} --chain-id 31337 --config-out localhost.json"
```

### 2b. Run the forked chain

```bash
# instead of `yarn chain`
yarn fork
```

or explicitly, if you want the local node to *report Base's chain id* so
external-contract lookups and block explorers line up:

```bash
anvil \
  --fork-url $FORK_URL \
  --chain-id 8453 \
  --fork-block-number <recent Base block> \
  --config-out localhost.json
```

Notes:
- **Pin `--fork-block-number`** to a recent Base block. This makes runs
  reproducible and lets Anvil cache aggressively instead of re-fetching a
  moving chain tip.
- **Chain id choice.** SE-2's default `fork` keeps `31337` so the rest of the
  toolchain treats it like the usual local chain. If your vault or frontend
  hardcodes Base's `8453` (address books, `IPoolAddressesProvider`, etc.), run
  with `--chain-id 8453` so those lookups resolve. Whichever you pick, make
  `scaffold.config.ts` `targetNetworks` match, and point your wallet at
  `http://localhost:8545` with that chain id.

### 2c. Deploy against the fork

Now `yarn deploy` puts your `Vault` onto a chain where USDC and Aave already
exist at their canonical Base addresses:

- USDC (native): `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Aave V3 `PoolAddressesProvider` (Base): `0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D`
- Aave V3 `Pool` (Base): `0xA238Dd80C259a72e81d7e4664a9801593F98d1c5`

(Always confirm current addresses against the Aave address book / Circle docs
before wiring them in.)

### 2d. The same probe now succeeds

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" 0x... \
  --rpc-url http://localhost:8545
# -> a real uint256, because the real USDC contract's code and storage
#    are now served through the fork
```

And your vault's `supply`/`withdraw` into Aave execute against Aave's real
`Pool` logic.

---

## 3. What stays local — nothing at real risk

This is the whole point of forking, so it's worth being explicit:

- **Reads** come from Base (through your RPC provider) and are cached locally.
- **Writes** — every transaction you send, every balance you fake, every Aave
  deposit — are applied **only to Anvil's local state overlay**. They are
  *never signed for or broadcast to* the real Base network.
- **No real funds, no real gas.** You transact with Anvil's fake-ETH dev
  accounts. Mainnet balances are untouched; you cannot move anyone's real USDC.
- **It's disposable.** Kill Anvil and the entire local overlay evaporates.
  Next `yarn fork` starts clean from the pinned block again.

The only thing that leaves your machine is **RPC read traffic** to your
provider (which is why a pinned fork block + local cache keeps you well under
rate limits).

---

## 4. Giving a test account six figures of USDC

On a fork, USDC is the real contract, so you can't just `mint` — it's
access-controlled. Two standard ways to get, say, **500,000 USDC** (remember
USDC has **6 decimals**, so that's `500000 * 1e6 = 500000000000`):

### Option A — Impersonate a whale (most realistic)

Find an address that already holds a lot of USDC on Base (an exchange hot
wallet, a large Aave/DEX pool — check Basescan's USDC holders). Then have Anvil
*become* that address and transfer to your test account:

```bash
WHALE=0x<address_that_holds_lots_of_USDC>
ME=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266   # anvil account #0
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

# let Anvil sign as the whale without its private key
cast rpc anvil_impersonateAccount $WHALE --rpc-url http://localhost:8545

# make sure the whale has ETH for gas on the fork
cast rpc anvil_setBalance $WHALE 0xde0b6b3a7640000 --rpc-url http://localhost:8545  # 1 ETH

# move 500,000 USDC to your test account
cast send $USDC "transfer(address,uint256)(bool)" $ME 500000000000 \
  --from $WHALE --unlocked --rpc-url http://localhost:8545

cast rpc anvil_stopImpersonatingAccount $WHALE --rpc-url http://localhost:8545
```

`anvil_impersonateAccount` is the cheat that lets a fork send transactions
*as* any address, no private key needed. Real balances are only being moved
inside your local overlay.

### Option B — Write the balance directly (no whale needed)

Overwrite USDC's balance storage slot for your account with Anvil's
`anvil_setStorageAt`. USDC's `balances` mapping lives at storage slot `9` in
the FiatToken implementation; the per-account slot is
`keccak256(abi.encode(account, 9))`, which `cast index` computes:

```bash
ME=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

SLOT=$(cast index address $ME 9)   # slot for balances[ME]
VAL=$(cast to-uint256 500000000000) # 500,000 USDC (6 decimals)

cast rpc anvil_setStorageAt $USDC $SLOT $VAL --rpc-url http://localhost:8545

# verify — the probe from part 1, now meaningful
cast call $USDC "balanceOf(address)(uint256)" $ME --rpc-url http://localhost:8545
# -> 500000000000
```

Caveat: slot `9` is USDC's balances slot today, but storage layouts can differ
by token/version — verify with `forge inspect` or `cast storage` if a token
doesn't behave. (Setting a raw balance skips `totalSupply` bookkeeping, which is
fine for testing but not "correct" accounting — impersonation avoids that.)

### Option C — In forge fork tests, use `deal`

If you're writing tests against the fork rather than driving the running node,
Foundry's `deal` cheatcode does Option B for you, auto-detecting the slot:

```solidity
function setUp() public {
    vm.createSelectFork(vm.envString("FORK_URL")); // or ("base") with an alias
    deal(USDC, user, 500_000e6);                    // 500,000 USDC to `user`
}
```

This is the fork-test analogue of your current mock setup — same test, but now
against the real USDC and real Aave `Pool`.

---

## TL;DR checklist

1. `yarn chain` = empty local chain; those Base addresses have no code → probe
   and integration calls fail. Mock tests pass because they deploy their own
   fakes.
2. Swap to `yarn fork` (Anvil `--fork-url <Base RPC>`, pinned block) so real
   USDC + Aave appear at their real Base addresses.
3. All writes stay in the local overlay — no real funds, no real gas, fully
   disposable.
4. Fund a test account with `anvil_impersonateAccount` + `transfer` (realistic),
   `anvil_setStorageAt` (no whale), or `deal` (in fork tests). Remember 6
   decimals: 500,000 USDC = `500000000000`.
