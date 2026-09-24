# Post-mortem: V1 → V2 UUPS upgrade returns shifted values

## TL;DR

Nothing is corrupted and nothing is lost. V2 **prepended** `rewardIndex` to the
storage layout instead of appending it, so every pre-existing variable in V2's
source is now bound to the slot of the *next* variable in V1's layout. The proxy
is reading the exact same bytes it always held, but through a layout that is
off by one slot. Deploy a corrected V2 whose layout appends `rewardIndex` after
`feeBps`, upgrade again, and all four values snap back — **provided no
state-changing call has written to the shifted slots since yesterday.** That
caveat is the only place real data loss can occur, and it is why the contract
should be paused now.

---

## 1. Why the values are shifted

A proxy owns the storage. `delegatecall` executes the implementation's *code*
against the *proxy's* storage. Solidity does not store variable names, types, or
any layout metadata on chain — it compiles each declaration down to a hardcoded
slot index assigned by declaration order. So the upgrade replaced the code that
*interprets* slots without touching the bytes *in* those slots.

### Layout before and after

| Slot | Bytes actually stored (unchanged) | V1 reads it as | V2 reads it as |
|---|---|---|---|
| 0 | `0x...01D1A94A2000` (2e12) | `totalDeposited` | `rewardIndex` |
| 1 | `0x...C0FFEE00...00` | `treasury` | `totalDeposited` |
| 2 | `0x...01F4` (500) | `feeBps` | `treasury` |
| 3 | `0x00...00` (never written) | — | `feeBps` |

(Slot numbering here is relative — if the contract inherits `Initializable`,
`OwnableUpgradeable`, `UUPSUpgradeable` etc., the user variables start at some
base offset *n*. That does not change the analysis: the bug is the off-by-one
*within* the contract's own block of variables. ERC-1967's implementation and
admin slots are unaffected because they live at keccak-derived pseudo-random
slots, which is exactly why the proxy admin and implementation pointer look
correct.)

### Each observed reading, explained

- **`rewardIndex() -> 2000000000000`** — slot 0 still holds the V1
  `totalDeposited` value, 2,000,000 USDC in 6-decimal base units
  (2,000,000 × 10⁶ = 2×10¹²). V2 labels slot 0 `rewardIndex`. You never set it;
  you inherited it.
- **`totalDeposited() -> <huge number = old treasury in hex>`** — slot 1 holds
  the 20-byte treasury address, right-aligned and zero-padded to 32 bytes. Read
  as a `uint256` that is a value on the order of 2¹⁵⁵. This is the clearest
  fingerprint of a one-slot shift: an address reinterpreted as a number.
- **`treasury() -> 0x00000000000000000000000000000000000001F4`** — slot 2 holds
  `500`. `0x1F4 == 500`. The `address` getter masks the low 160 bits of the
  word, so the fee basis points are now your treasury address.
- **`feeBps() -> 0`** — slot 3 has never been written by anything. Reading a
  virgin slot yields zero; it does not revert.

### Why nothing reverts

There is no type checking across the proxy boundary and no layout validation at
runtime. `delegatecall` succeeds as long as the implementation exists and its
code does not revert. A type confusion between `uint256` and `address` is a pure
reinterpretation of 32 bytes — silent by construction. "Nothing reverted" is
therefore zero evidence that an upgrade was safe. This class of bug is
*only* caught before deployment, by a storage-layout diff.

### Why the upgrade itself wrote nothing

You added no re-initializer, so the `upgradeToAndCall` payload was empty and no
constructor/initializer body ran against proxy storage. That is the good news:
the upgrade transaction was a pure pointer swap on the ERC-1967 implementation
slot. All original bytes survive.

---

## 2. Is the deposit data gone?

**No — but it is now in the line of fire.** As of the upgrade transaction the
bytes are intact and fully recoverable. What is at risk is everything that
happened *after* it, because V2 is happily writing through the shifted layout:

- A `deposit()` that does `totalDeposited += amount` writes to **slot 1**, i.e.
  it is incrementing your treasury address. Any deposit since yesterday has
  destroyed the stored treasury address (and produced a nonsensical
  `totalDeposited`).
- A `setTreasury()` writes to **slot 2**, overwriting `feeBps` with an address.
- A `setFeeBps()` writes to **slot 3**, which is harmless (scratch space), but
  means your real fee is still 500 sitting in slot 2.
- Anything that touches `rewardIndex` writes to **slot 0** and would obliterate
  the real `totalDeposited`. This is the most damaging write available.

There is a second, live hazard independent of the accounting: `treasury()` now
returns `0x…01F4`, an address with no known private key. Any fee sweep or
withdrawal routed to `treasury` since the upgrade sent funds to a black hole.
Meanwhile `feeBps` reads 0, so fee-charging paths have been silently free, and
`totalDeposited` reading ~2¹⁵⁵ will break any share-price, utilization, or
cap-check arithmetic that divides by or compares against it — possibly causing
mispriced shares or overflow reverts under heavier math.

### What to do right now, in order

1. **Pause the contract** (or, if there is no pause, use the upgrade key to
   point the proxy at a deliberately inert implementation) so no further writes
   land on the shifted slots. Every additional transaction can turn a recoverable
   situation into a permanent one.
2. **Read the raw slots directly**, bypassing both ABIs, and record them:
   ```bash
   cast storage $PROXY 0 --rpc-url $RPC   # expect 0x…01d1a94a2000 (2e12)
   cast storage $PROXY 1 --rpc-url $RPC   # expect 0x…c0ffee00…00
   cast storage $PROXY 2 --rpc-url $RPC   # expect 0x…01f4 (500)
   cast storage $PROXY 3 --rpc-url $RPC   # expect 0x00…00
   ```
   Compare against the same slots at the block *before* the upgrade
   (`cast storage $PROXY 0 --block <preUpgradeBlock>`). If they match, you are
   clean and a corrected upgrade restores everything.
3. **Enumerate every transaction to the proxy since the upgrade block** and
   classify which of those slots each one wrote. `debug_traceTransaction` with
   the `prestateTracer`, or a `trace_replayBlockTransactions` sweep, gives you
   the exact slot writes rather than a guess from the function selector. This is
   your definitive damage assessment.
4. **Reconcile against ground truth.** The USDC the proxy actually custodies is
   `IERC20(USDC).balanceOf(proxy)` — an external fact the bug cannot corrupt.
   Deposit and withdrawal events give you the per-user ledger. Between the two
   you can rebuild the correct `totalDeposited` even if slot 0 or slot 1 was
   clobbered. **User funds are safe unless a withdrawal path was tricked into
   over-paying**; check that explicitly against the balance.

---

## 3. The fix: an append-only V2

The rule is that a new implementation may only **append** to storage. Never
insert, reorder, remove, or change the type or size of an existing variable, and
never change the order of inherited base contracts (their storage is laid out
before the child's).

```solidity
contract StakingV2 is StakingV1Storage, UUPSUpgradeable, OwnableUpgradeable {
    // --- V1 layout, byte-for-byte identical, in the original order ---
    uint256 public totalDeposited;  // slot 0
    address public treasury;        // slot 1
    uint256 public feeBps;          // slot 2

    // --- appended in V2 ---
    uint256 public rewardIndex;     // slot 3

    /// @custom:oz-upgrades-validate-as-initializer
    function initializeV2(uint256 initialRewardIndex) external reinitializer(2) {
        rewardIndex = initialRewardIndex;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
```

Then upgrade *from the currently-broken V2* to this corrected V2 in a single
transaction:

```solidity
proxy.upgradeToAndCall(
    address(fixedV2),
    abi.encodeCall(StakingV2.initializeV2, (0))   // or the intended seed value
);
```

Because slots 0–2 were never rewritten by the upgrade itself, the corrected
layout rebinds each name to its original word and `totalDeposited`, `treasury`
and `feeBps` read correctly again the moment the pointer moves. Slot 3, which
the broken V2 was using as `feeBps` scratch space, becomes the real
`rewardIndex` — so **seed it explicitly in `initializeV2` rather than assuming
it is zero**, since a `setFeeBps()` call during the broken window would have
left a stale value there. If step 3 above found writes to slots 0–2, extend
`initializeV2` into a one-shot repair that also restores those values from your
reconciliation, and burn the reinitializer version afterward.

Two checks on the corrected implementation before you send anything:

- `_authorizeUpgrade` must be present and correctly gated. Under UUPS the
  upgrade logic lives in the *implementation*, so shipping one without a working
  `_authorizeUpgrade` permanently bricks the proxy — there is no admin-side
  escape hatch as there is with a transparent proxy.
- The implementation's constructor must call `_disableInitializers()` so nobody
  can initialize the logic contract directly and call `upgradeToAndCall` on it.

---

## 4. Preventing a recurrence

**Make the layout check a gate, not a habit.** A human reading two files for
declaration order will miss this again. Automate it:

```bash
# Foundry
forge inspect StakingV2 storage-layout --pretty
# and diff against the V1 layout committed in-repo

# OpenZeppelin Upgrades plugin — fails the build on an incompatible layout
await upgrades.validateUpgrade(proxyAddress, StakingV2);
await upgrades.upgradeProxy(proxyAddress, StakingV2);
```

Commit the V1 storage layout JSON to the repo and have CI fail on any
incompatible diff. The plugin catches inserted, reordered, removed, resized, and
retyped variables — including changes hidden in inherited contracts.

**Pick a layout discipline and hold it.** Two options:

- *Storage gaps* (the classic approach): end each upgradeable base with
  `uint256[50] private __gap;` and decrement the gap size by exactly the number
  of slots you add. This reserves room so a base contract can grow without
  shifting its children.
- *Namespaced storage, ERC-7201* (preferred for new work, and what OZ v5 uses):
  put each contract's state in a struct at a keccak-derived slot. Ordering
  becomes a local concern per namespace, and inheritance can no longer shift
  anything.

```solidity
/// @custom:storage-location erc7201:staking.main
struct MainStorage { uint256 totalDeposited; address treasury; uint256 feeBps; uint256 rewardIndex; }
// keccak256(abi.encode(uint256(keccak256("staking.main")) - 1)) & ~bytes32(uint256(0xff))
bytes32 private constant MAIN_STORAGE = 0x...;
```

**Rehearse every upgrade on a mainnet fork.** Fork at the current block, apply
the upgrade, and assert that every getter returns its pre-upgrade value:

```solidity
uint256 before = staking.totalDeposited();
// ... perform upgrade ...
assertEq(staking.totalDeposited(), before);
assertEq(staking.treasury(), TREASURY);
assertEq(staking.feeBps(), 500);
```

That three-line assertion would have caught this yesterday, before a single wei
of gas was spent on mainnet.

**Put the upgrade key behind a timelock + multisig.** A timelock inserts a delay
in which an automated layout check, or a human, can catch a bad implementation
before it takes effect — and, per the same reasoning, gates the pause and
parameter-update powers you will be reaching for today.
