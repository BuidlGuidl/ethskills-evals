# Local chain vs. real Aave/USDC — what's going on and how to fix it

## TL;DR

`yarn chain` starts a **blank Anvil node**. It contains none of Base
mainnet's contracts — only the 10 pre-funded dev accounts and whatever
your `yarn deploy` script puts there (your vault + mocks). The USDC
address you probed has **no bytecode on that chain**, so the `cast call`
has nothing to execute and fails. Your forge tests pass because they
talk to *mock* contracts, not the real Base addresses.

To make the *exact same* calls hit real Aave V3 and real USDC, run
Anvil as a **fork of Base mainnet** (`anvil --fork-url <BASE_RPC>`).
Forking lazily copies real Base state by address, so
`0x8335…02913` now resolves to the actual USDC contract and the Aave
Pool exists at its canonical address. Everything still runs locally —
transactions execute only against your local fork, nothing is broadcast
to Base, and no real funds are at risk. You give a test account six
figures of USDC by **impersonating a known USDC whale and transferring**
(or by writing the balance storage slot directly).

---

## Part 1 — What the local chain actually contains, and why the probe fails

### `yarn chain` = a fresh Anvil node, genesis state

In Scaffold-ETH 2 (foundry flavor), `yarn chain` runs Foundry's
**`anvil`** — a brand-new, in-memory Ethereum node created from an empty
genesis:

- **Chain ID `31337`**, block 0, nothing in state history.
- **10 deterministic dev accounts**, each pre-funded with 10,000 ETH.
  Account 0 is the well-known
  `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
  (mnemonic *"test test test … junk"*).
- **No mainnet or Base contracts of any kind.** There is no USDC, no
  Aave Pool, no WETH — none of the addresses you know from Base exist
  here. The chain has never heard of them.

The only code that ends up on this chain is whatever your **`yarn deploy`**
script deploys: your vault, plus any helper/mock contracts the script
creates. If the script wired the vault to mocks, that's all that's on
the node.

### Why `cast call` on the USDC address fails

`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` is the address of **real USDC
on Base mainnet**. On your local Anvil that address is just an empty slot
— **zero bytecode**. When you do:

```bash
cast call 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \
  "balanceOf(address)(uint256)" <any address> \
  --rpc-url http://localhost:8545
```

the EVM is asked to run `balanceOf` on an account that contains no code.
A call to a code-less address doesn't run anything and returns **empty
data (`0x`)**. `cast` then tries to ABI-decode that empty return as
`(uint256)`, which it can't, so the command errors out (you'll see an
"execution reverted" / decode failure). The probe isn't failing because
of a bad ABI or address — it's failing because **USDC simply isn't on
this chain**. The same is true for every real Aave address, which is why
*every integration call reverts*.

### Why your forge tests still pass

Your `forge test` suite is green because it never touches the real Base
addresses. Unit tests either:

- deploy **mock contracts** (`MockERC20`, a mock Aave pool) and point the
  vault at those mock addresses, and/or
- use Foundry **cheatcodes** (`deal`, `vm.mockCall`, `vm.store`) to
  fabricate balances and canned responses in the test EVM.

So the tests validate your vault's logic against stand-ins. They tell you
nothing about whether the real USDC/Aave contracts behave as you expect,
because those contracts are never present in the test environment. That's
the gap between "tests pass" and "every integration call reverts on the
local chain."

---

## Part 2 — The setup where the same calls hit real Aave and real USDC

The fix is to stop running a blank chain and instead run Anvil as a
**mainnet fork of Base**.

### Fork Base with Anvil

```bash
anvil --fork-url $BASE_RPC_URL
# optionally pin a block for reproducibility:
# anvil --fork-url $BASE_RPC_URL --fork-block-number <N>
```

where `$BASE_RPC_URL` is any Base mainnet RPC endpoint (Alchemy, Infura,
BlastAPI, a public Base RPC, etc.).

**In Scaffold-ETH 2**, wire this into the `chain` script instead of
running Anvil bare so `yarn chain` does it for you. In
`packages/foundry/package.json`:

```jsonc
// before
"chain": "anvil --config-out localhost.json",

// after (fork Base)
"chain": "anvil --fork-url $BASE_RPC_URL --config-out localhost.json"
```

Keep the **chain ID at 31337** (Anvil's default, even when forking). That
matters because the rest of Scaffold-ETH — the deploy pipeline and the
frontend's `targetNetworks` — is already configured for `foundry`/31337.
Forking copies contracts **by address**, not by chain ID, so the real
Base contracts are present regardless of what chain ID the node reports.
(If you'd rather have the node advertise Base's real chain ID, add
`--chain-id 8453`, but then update `scaffold.config.ts` and the deploy
network accordingly.)

### How forking works (and why the same calls now succeed)

A forked Anvil starts with **no local state copied up front**. When a call
or transaction touches an account for the first time, Anvil **lazily
fetches that account's code and storage** from `$BASE_RPC_URL` at the fork
block, caches it locally, and proceeds. So the moment you call
`balanceOf` on `0x8335…02913`:

- Anvil pulls the **real USDC (FiatTokenV2) bytecode and storage** from
  Base and installs it at that exact address on your local node.
- The call executes against genuine USDC logic and returns real balances.

The identical thing happens for the **Aave V3 Pool** and the aToken
(`aBasUSDC`) at their canonical Base addresses — your vault's
supply/withdraw calls now run against the actual Aave contracts. The
`cast call` probe that failed before now returns a real `uint256`, and
your integration calls stop reverting.

### Point the vault at the *real* addresses (not mocks)

One deployment detail: if your `Deploy` script currently deploys mocks
and passes those mock addresses into the vault's constructor, do the
opposite when running against the fork. Deploy **only your vault** and
pass it the **canonical Base addresses**:

- USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Aave V3 Pool (Base): use the current address from the Aave Address Book
  / `PoolAddressesProvider` (`getPool()`), e.g. via
  `aave-address-book`'s `AaveV3Base.POOL`.

Gate this with the network in the deploy script (deploy mocks for a plain
local run, use real addresses when the node is a Base fork) so
`yarn deploy` does the right thing in both modes.

### What stays local — no real funds at risk

This is the key reassurance: a fork is still a **local, private node**.

- **Nothing is broadcast to Base.** Every transaction executes against
  your local fork's copy of state. Writes mutate *your* cached state, not
  mainnet. Base's real ledger never sees any of it.
- **No mainnet gas, no mainnet keys.** You transact with the same 10
  pre-funded 10,000-ETH dev accounts. Nothing you do can move real money
  or touch a real user's balance.
- **Read-only dependency on the RPC.** The fork URL is used only to *read*
  historical state on demand. Your fork is a sandboxed snapshot you can
  mine, `evm_snapshot`/`evm_revert`, and time-travel freely.
- If you pin `--fork-block-number`, runs are fully reproducible and don't
  drift as Base advances.

So you get real USDC and real Aave behavior with **zero real-funds
exposure** — it's a throwaway copy of Base living in your laptop's RAM.

### How a test account ends up with six figures of USDC

Your dev accounts have 10k ETH but **0 USDC** on the fork (forking copies
existing state; it doesn't gift you tokens). USDC has **6 decimals**, so
"six figures" — say $250,000 — is `250000 * 1e6 = 250000000000`. Two
standard ways to fund an account:

**Option A — Impersonate a USDC whale and transfer (most robust).**
Find an address that already holds lots of USDC on Base (Basescan → USDC
token → *Holders*; a large holder, an exchange hot wallet, or the Aave
aToken/pool contract). Then use Anvil's impersonation RPCs:

```bash
USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
WHALE=0x<address_holding_lots_of_USDC_on_Base>
ME=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266   # Anvil account 0
RPC=http://localhost:8545

# let Anvil sign as the whale without its private key
cast rpc anvil_impersonateAccount $WHALE --rpc-url $RPC
# make sure the whale has ETH for gas
cast rpc anvil_setBalance $WHALE 0xde0b6b3a7640000 --rpc-url $RPC   # 1 ETH

# move 250,000 USDC (6 decimals) to your test account
cast send $USDC "transfer(address,uint256)(bool)" $ME 250000000000 \
  --from $WHALE --unlocked --rpc-url $RPC

cast rpc anvil_stopImpersonatingAccount $WHALE --rpc-url $RPC

# verify — this now returns a real number instead of failing
cast call $USDC "balanceOf(address)(uint256)" $ME --rpc-url $RPC
```

Because it's a fork, "taking" the whale's USDC only affects your local
copy — the real holder is untouched.

**Option B — Write the balance directly (no whale needed).**
Overwrite the account's slot in USDC's `balanceOf` mapping. In a Foundry
test or script this is just the `deal` cheatcode:

```solidity
deal(USDC, ME, 250_000e6);   // sets ME's USDC balance to 250,000
```

Against the running node you can do the equivalent with
`anvil_setStorageAt`, computing the slot as
`keccak256(abi.encode(ME, uint256(balancesSlot)))`. This is deterministic
and needs no external holder, but you have to know the mapping's slot
index for the USDC proxy — which is why Option A (impersonation) is
usually the quicker, less error-prone choice for ad-hoc funding.

Either way, the test account now holds six figures of USDC that it can
`approve` and supply into the **real** Aave V3 Pool on your local fork —
same calls, real contracts, no real funds at stake.

---

## Summary table

| | `yarn chain` (blank Anvil) | `anvil --fork-url $BASE_RPC` (Base fork) |
|---|---|---|
| Contracts present | Only your deploy output (vault + mocks) | Your vault **+ all real Base state, on demand** |
| USDC at `0x8335…02913` | No code → `cast call` fails | Real USDC contract → call succeeds |
| Aave V3 Pool | Absent → integration calls revert | Real Pool at canonical address → calls work |
| Chain ID | 31337 | 31337 (default; forks copy by address) |
| Funds at risk | None (isolated) | None — writes stay local, never broadcast to Base |
| USDC for testing | Mint from your own mock | Impersonate a whale & `transfer`, or `deal`/`setStorageAt` |
