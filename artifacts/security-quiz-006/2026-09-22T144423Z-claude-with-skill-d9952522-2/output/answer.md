# Post-mortem: V1 → V2 UUPS upgrade, storage layout collision

## TL;DR

Nothing was corrupted by the upgrade itself, and no data was deleted. You inserted
`rewardIndex` at the **front** of the state declaration, which renamed every storage
slot in the contract. The proxy's slots still hold exactly the bytes V1 wrote; V2 just
reads each of them under the wrong name, off by one slot. Your 2,000,000 USDC figure is
intact — it is currently being returned by `rewardIndex()`.

The real danger is not the reads. It is that **any V2 write since the upgrade has been
landing in the wrong slot**, and `treasury()` now returns
`0x00000000000000000000000000000000000001F4`, an address nobody controls. Pause fee
transfers now.

## Why the values are shifted

A proxy holds all state. `delegatecall` executes the implementation's code against the
*proxy's* storage. The implementation contributes no storage of its own — only the
*mapping* from variable names to slot numbers, which the compiler assigns by walking the
declarations in source order (after base contracts), slot 0, 1, 2, ….

That mapping is pure compile-time metadata. It is not written on chain, it is not
versioned, and an upgrade does not migrate anything. Change the declaration order and
you have silently re-pointed every name at a different slot, while the bytes sit
untouched.

### The slots before and after

| Slot | Bytes actually stored (written by V1, never rewritten) | V1 name | V2 name |
|---|---|---|---|
| 0 | `0x...01D1A94A2000` = 2\_000\_000\_000000 | `totalDeposited` | `rewardIndex` |
| 1 | `0x...C0FFEE0000000000000000000000000000000000` | `treasury` | `totalDeposited` |
| 2 | `0x...01F4` = 500 | `feeBps` | `treasury` |
| 3 | never written → `0x00…00` | *(none)* | `feeBps` |

Now read your four symptoms straight off that table:

- `rewardIndex() -> 2000000000000`. Slot 0. That is your deposit total, 2,000,000 USDC
  in 6-decimal base units. You "never set" `rewardIndex` and that is precisely the point:
  V1 set it, under a different name.
- `totalDeposited() -> a huge number whose hex is your old treasury address`. Slot 1, the
  20-byte address zero-extended to 32 bytes and reinterpreted as `uint256`. Same bytes,
  different type — no conversion, no revert.
- `treasury() -> 0x…01F4`. Slot 2 holds `500`, and `0x1F4 == 500`. An `address` getter
  takes the low 20 bytes of the word, so `feeBps` is now your treasury address.
- `feeBps() -> 0`. Slot 3 was never touched by V1, so it reads as zero. There is no
  "uninitialized" marker in the EVM; unwritten storage is indistinguishable from a
  deliberately stored zero.

### Why nothing reverted and the admin looks fine

Two separate reasons, worth stating because "the upgrade succeeded" is what made this
look safe:

1. **Solidity does not type-check storage across upgrades.** `SLOAD` returns 32 raw
   bytes; the getter casts them. There is no tag, checksum, or layout hash in storage to
   compare against. A layout collision is by construction a silent failure — the only
   signal is wrong values, which is exactly what you observed.
2. **The proxy's own state lives outside slot 0,1,2,…** ERC-1967 puts the implementation
   pointer at `keccak256("eip1967.proxy.implementation") - 1` and the admin at the
   analogous `…proxy.admin` slot. Those pseudorandom slots are unreachable from
   sequentially-allocated variables, so your admin and implementation pointer were never
   at risk. That is also why the upgrade transaction itself succeeded normally: UUPS
   `upgradeToAndCall` only touches that one pseudorandom slot plus whatever the
   (absent) re-initializer would have done.

So the absence of a re-initializer is not the bug and adding one would not have fixed
it. A re-initializer sets values; your problem is that the *addresses of the values*
moved. Had you added one that did `rewardIndex = 0`, it would have written zero over
slot 0 and destroyed the deposit total for real.

## Is the deposit data gone?

**Not from the upgrade — no.** All three V1 values are still on chain in slots 0, 1, 2,
byte-identical. Fixing the layout restores every one of them with no migration.

**But it may have been damaged since.** Every V2 write has used the shifted mapping. The
ones that matter:

- A deposit doing `totalDeposited += amount` has been writing to **slot 1**, i.e. adding
  to your treasury address. If that happened, the original `0xC0FFEE…` is gone
  (recoverable arithmetically from an archive node, but gone from state), and slot 0
  still holds the pre-upgrade 2,000,000 rather than the true current total.
- Anything touching `rewardIndex` writes to **slot 0**, your deposit total.
- A `setTreasury` or `setFeeBps` writes to slots 2 and 3.

Before you fix anything, establish ground truth:

```bash
# raw slots as they stand right now
cast storage $PROXY 0 --rpc-url $RPC   # V1 totalDeposited
cast storage $PROXY 1 --rpc-url $RPC   # V1 treasury
cast storage $PROXY 2 --rpc-url $RPC   # V1 feeBps
cast storage $PROXY 3 --rpc-url $RPC

# same slots at the block immediately before the upgrade
cast storage $PROXY 0 --block $((UPGRADE_BLOCK - 1)) --rpc-url $RPC
```

Diff the two sets. If they are identical, no V2 write landed and this is a pure read
problem. If they differ, reconcile against `Deposit`/`Withdraw` events and the USDC
`balanceOf(proxy)` to reconstruct the correct `totalDeposited`, then repair it in the
same upgrade that fixes the layout.

Also, immediately: pause or otherwise block any path that pays fees to `treasury()`.
It currently resolves to `0x…01F4`, an address with no known private key. Sending USDC
there burns it. Check whether any fee sweep has already run since the upgrade.

## The fix

### 1. Append, never prepend

```solidity
contract StakingV3 {
    // ---- V1 layout, frozen forever, order and types unchanged ----
    uint256 public totalDeposited;  // slot 0
    address public treasury;        // slot 1
    uint256 public feeBps;          // slot 2

    // ---- added in V2/V3: append only ----
    uint256 public rewardIndex;     // slot 3
}
```

This maps every name back onto the bytes it was written with. `totalDeposited` reads
2,000,000 USDC again, `treasury` is `0xC0FFEE…`, `feeBps` is 500. `rewardIndex` lands on
slot 3, which is zero — the correct initial value for a fresh index, and it needs no
re-initializer to be zero. If you want it to start at `1e18` (typical for an index),
*that* is what a `reinitializer(3)` is for, and now it is safe because it writes slot 3
and nothing else.

Note that you deployed V2 publicly, so V3's layout must be compatible with whichever
layout actually holds the live bytes. Since V1's bytes are the ones in storage, V1's
layout is the one to extend. Do not try to stay compatible with the broken V2.

The rule generalizes: never insert, reorder, remove, or retype an existing variable.
Removing is as bad as inserting, and changing `uint256` to `uint128` repacks the tail of
the struct. Inheritance order counts too — base contracts are laid out before derived
ones, so adding a parent to the inheritance list shifts everything below it exactly like
prepending a variable did here.

### 2. Make the check mechanical, not a review item

Ordering is invisible in a diff that looks like "one added line." Enforce it in CI:

```bash
# OpenZeppelin Upgrades, Foundry
forge clean && forge build --build-info
npx @openzeppelin/upgrades-core validate out/build-info \
    --requireReference --reference StakingV1
```

or via `Upgrades.upgradeProxy(...)` in a Foundry script, or
`upgrades.validateUpgrade(V1, V2)` in Hardhat. These compare the compiled layouts and
fail on exactly this class of change. Run it as a required job — the upgrade transaction
cannot tell you anything, so the pipeline must.

A cheap independent cross-check: dump layouts and diff them.

```bash
forge inspect StakingV1 storageLayout > v1.json
forge inspect StakingV3 storageLayout > v3.json
diff <(jq -S '.storage|map({label,slot,offset,type})' v1.json) \
     <(jq -S '.storage|map({label,slot,offset,type})' v3.json)
```

Every V1 entry must appear with an unchanged `slot`, `offset`, and `type`. New entries
append only.

### 3. Remove the foot-gun for future versions

Append-only discipline works but stays fragile. Two structural options:

**Storage gaps** (classic, works with your current code):

```solidity
uint256 public totalDeposited;
address public treasury;
uint256 public feeBps;
uint256 public rewardIndex;
uint256[46] private __gap;   // shrink by exactly the slots you consume
```

Each new variable is paid for by decrementing the gap. It reserves room but still
depends on people getting the bookkeeping right.

**ERC-7201 namespaced storage** (preferred for new work; what OZ v5 uses):

```solidity
/// @custom:storage-location erc7201:staking.main
struct MainStorage {
    uint256 totalDeposited;
    address treasury;
    uint256 feeBps;
    uint256 rewardIndex;   // appending here is safe by construction
}

// keccak256(abi.encode(uint256(keccak256("staking.main")) - 1)) & ~bytes32(uint256(0xff))
bytes32 private constant MAIN_STORAGE_LOCATION = 0x...;

function _s() private pure returns (MainStorage storage $) {
    assembly { $.slot := MAIN_STORAGE_LOCATION }
}
```

The struct is anchored at a pseudorandom base slot, so a module's fields can never
collide with another module's or with ERC-1967. Adding a field to the struct extends it
into space that was already reserved and unreachable. This does require migrating the
existing values out of slots 0–2, so if you adopt it, do it as a deliberate migration
upgrade with the reads verified on a fork — not bundled with the hotfix.

### 4. Verify before you send it

```bash
# fork mainnet at head, run the upgrade, read the getters back
forge test --fork-url $RPC --match-test testUpgradeV3PreservesState -vvv
```

Assert `totalDeposited() == 2_000_000_000000`, `treasury() == 0xC0FFEE…`,
`feeBps() == 500`, and `rewardIndex()` equals its intended start. This single test would
have caught the original bug in seconds and should gate every future upgrade.

Two UUPS-specific things to confirm in the same run, since a mistake here is
unrecoverable: V3 still inherits `UUPSUpgradeable` and implements `_authorizeUpgrade`
with the right access control (an implementation without it permanently bricks
upgradeability), and V3's constructor calls `_disableInitializers()` so the
implementation contract cannot be initialized directly.

## Summary of actions

1. Block fee payouts to the bogus `treasury()` address now.
2. Diff slots 0–3 against the pre-upgrade block to determine whether any V2 write
   corrupted state; reconcile against events and the proxy's USDC balance.
3. Ship V3 with `rewardIndex` appended after `feeBps`, plus a `reinitializer` that
   repairs any slot the diff showed as damaged and sets the index's starting value.
4. Add `@openzeppelin/upgrades-core validate` and a forked upgrade test as required CI
   gates.
5. Plan a follow-up migration to ERC-7201 namespaced storage, and confirm upgrade
   authority sits behind the multisig/timelock rather than an EOA.
