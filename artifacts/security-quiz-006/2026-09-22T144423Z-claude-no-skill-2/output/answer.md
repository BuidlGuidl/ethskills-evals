# Post-mortem: V1 → V2 UUPS upgrade returns shifted values

## Summary

Nothing is corrupted and nothing is lost. You prepended a new state variable
(`rewardIndex`) to the front of the contract's storage declarations. A proxy's
storage lives in the *proxy*, and Solidity addresses that storage by **slot
index derived from declaration order**, not by variable name. The upgrade
changed the names-to-slots mapping in the new code while leaving the bytes in
the proxy exactly where V1 put them. Every getter is now reading the slot that
belonged to its predecessor — a one-slot off-by-one across the whole layout.

The urgent issue is not the read values. It is that `treasury()` now resolves
to a live, non-zero, almost certainly unowned address, and that any state-
writing call made since the upgrade has written real corruption into the slots.

---

## 1. Why the values shifted

### The layout before and after

Let `N` be the first slot the contract's own variables occupy (whatever
`Initializable` / `UUPSUpgradeable` inherited storage sits below it — that part
is unchanged, which is why the shift is a clean +1 and not something worse).

| Slot | V1 declares | Bytes actually sitting in the proxy |
|------|-------------|-------------------------------------|
| `N`   | `totalDeposited` | `0x00…01D1A94A2000` (= 2,000,000,000000) |
| `N+1` | `treasury`       | `0x00…C0FFEE0000000000000000000000000000000000` |
| `N+2` | `feeBps`         | `0x00…01F4` (= 500) |
| `N+3` | —                | never written → `0x00…00` |

V2 keeps the same bytes but renumbers the names:

| Slot | V2 declares | Same bytes, reinterpreted | Getter returns |
|------|-------------|---------------------------|----------------|
| `N`   | `rewardIndex`    | 2,000,000,000000 as `uint256` | `2000000000000` ✔ matches your report |
| `N+1` | `totalDeposited` | `0xC0FFEE…00` as `uint256`    | `1101833650747854256492557129184819199699562004480` — "a huge number that in hex is exactly the old treasury address" ✔ |
| `N+2` | `treasury`       | `500` as `address`            | `0x00000000000000000000000000000000000001F4` ✔ (500 = `0x1F4`) |
| `N+3` | `feeBps`         | virgin slot                   | `0` ✔ |

All four observations are explained by a single fact, with no other hypothesis
needed. Note the confirmation in the third row: an `address` is just the low 20
bytes of the slot, so the integer `500` renders as the address `0x…01F4`. That
is a fingerprint of a layout shift, not of a corrupted write.

### Why it didn't revert

Solidity emits `sload(N)` — a raw slot read. The EVM has no type information at
runtime and no notion of "this slot belongs to `feeBps`". A 32-byte word is
always a valid `uint256`, and its low 20 bytes are always a valid `address`.
There is nothing for the EVM to reject. Silence is the expected failure mode
here, which is exactly why storage-layout bugs are dangerous: the upgrade
transaction succeeding tells you nothing about layout compatibility.

### Why the re-initializer wouldn't have helped

You note you "added no re-initializer." Worth being precise: a re-initializer
would **not** have fixed this. Initializers write values into slots; they do not
renumber slots. A `reinitializer(2)` that set `rewardIndex = 0` would have
written `0` into slot `N` — destroying `totalDeposited` — and left the other
three still shifted. The defect is in the declaration order, and only the
declaration order fixes it.

---

## 2. Is the deposit data gone?

**The original bytes are intact.** The upgrade wrote no storage; `totalDeposited`'s
2,000,000,000000 is still sitting in slot `N`, now answering to the name
`rewardIndex`. Redeploying with a correct layout makes every value read
correctly again, with no migration and no data reconstruction.

**That holds only if no state-writing call has landed since the upgrade.** This
is the part that needs checking before anything else, because a write through
the shifted layout is genuine, irreversible corruption:

- A deposit that does `totalDeposited += amount` writes to slot `N+1`, adding
  to a number whose high bytes are your old treasury address — and leaves slot
  `N` (the real deposit total) stale.
- A `setTreasury(x)` writes `x` into slot `N+2`, destroying `feeBps`'s 500.
- Anything that writes `rewardIndex` overwrites `totalDeposited` outright.

**Check this now, before deploying any fix:**

```bash
# Raw slot values as they stand right now — the ground truth, name-independent.
for i in 0 1 2 3 4 5 6 7 8 9; do
  echo -n "slot $i: "; cast storage <PROXY> $i --rpc-url <RPC>
done

# Every transaction to the proxy since the upgrade block.
cast logs --from-block <UPGRADE_BLOCK> --address <PROXY> --rpc-url <RPC>
```

Compare each slot against its value one block *before* the upgrade
(`cast storage <PROXY> <slot> --block <UPGRADE_BLOCK-1>`). If they are
identical, you are clean and the fix below is a pure redeploy. If any differ,
you have a reconciliation job and should pause the contract first.

### The fund-loss exposure

`treasury()` currently returns `0x…01F4`. That is not the zero address, so a
zero-address guard would not catch it, and it is not an address anyone holds a
key for. Any fee sweep, withdrawal, or payout routed to `treasury` since the
upgrade sent USDC somewhere permanently unrecoverable. Grep the V1/V2 source
for every use of `treasury` as a transfer destination, and check the token's
`Transfer` logs from the proxy since the upgrade block:

```bash
cast logs --from-block <UPGRADE_BLOCK> \
  --address 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 \
  'Transfer(address,address,uint256)' <PROXY> --rpc-url <RPC>
```

Separately: `feeBps` reading `0` is benign-looking but means fees have been
silently waived since the upgrade, and `totalDeposited` reading ~1.1e48 will
overflow-revert or wildly misprice anything that does share-ratio math against
it. If any of that is reachable, pause before you do anything else.

---

## 3. The fix

### Rule: append-only

Storage variables in an upgradeable contract may only ever be **appended** to
the end of the layout. Never prepend, never insert, never reorder, never remove,
never change a type's size. Existing slots are effectively immutable once the
proxy holds data.

V3 — same feature, correct layout:

```solidity
contract StakingV3 is UUPSUpgradeable, OwnableUpgradeable {
    uint256 public totalDeposited;  // slot N   — unchanged
    address public treasury;        // slot N+1 — unchanged
    uint256 public feeBps;          // slot N+2 — unchanged
    uint256 public rewardIndex;     // slot N+3 — NEW, appended
}
```

Deploy this and `upgradeToAndCall` the proxy to it. Slot `N+3` is the virgin
slot `feeBps()` is currently returning `0` from, so `rewardIndex` starts at `0`
with no initialization needed — and every other getter snaps back to its real
value. **Do not add a re-initializer that touches the three pre-existing
variables**; they already hold the right bytes and writing them would be the
second mistake in a row. A `reinitializer` is only appropriate if `rewardIndex`
must start at something other than `0` (e.g. `1e18` for a ratio index), and then
it must set *only* `rewardIndex`.

### Make this class of bug impossible to ship again

**Reserve space up front.** Either a gap in each upgradeable contract:

```solidity
uint256[47] private __gap;  // shrink by 1 each time you append a slot
```

…or, better for new work, ERC-7201 namespaced storage, which pins your layout
to a hashed slot far from slot 0 and makes declaration order irrelevant:

```solidity
/// @custom:storage-location erc7201:mystaking.storage.main
struct MainStorage {
    uint256 totalDeposited;
    address treasury;
    uint256 feeBps;
    uint256 rewardIndex;   // appending here is safe by construction
}

// keccak256(abi.encode(uint256(keccak256("mystaking.storage.main")) - 1)) & ~bytes32(uint256(0xff))
bytes32 private constant MAIN_STORAGE_LOCATION = 0x...;

function _getMainStorage() private pure returns (MainStorage storage $) {
    assembly { $.slot := MAIN_STORAGE_LOCATION }
}
```

**Automate the check — this is the real control.** The OpenZeppelin Upgrades
plugin diffs the compiled storage layout of old and new implementations and
refuses incompatible upgrades. It would have rejected this upgrade at build
time:

```bash
forge clean && forge build
# Foundry: Upgrades.validateUpgrade("StakingV1.sol:StakingV1", "StakingV3.sol:StakingV3", opts);
# Hardhat: await upgrades.validateUpgrade(proxyAddr, StakingV3);
```

Wire that into CI as a required check, with the reference layout committed to
the repo (`--ast` build info retained), so the diff is against the layout
actually deployed rather than whatever is on the branch.

**Rehearse on a fork.** Every upgrade should be replayed against a mainnet fork
first, asserting that all pre-existing getters return their pre-upgrade values:

```solidity
function test_upgradePreservesState() public {
    uint256 before = staking.totalDeposited();
    address treasuryBefore = staking.treasury();
    uint256 feeBefore = staking.feeBps();
    _upgradeTo(address(new StakingV3()));
    assertEq(staking.totalDeposited(), before);
    assertEq(staking.treasury(), treasuryBefore);
    assertEq(staking.feeBps(), feeBefore);
    assertEq(staking.rewardIndex(), 0);
}
```

That single test fails loudly on V2 and passes on V3.

---

## Action order

1. **Pause** the contract if any state-writing path is reachable — every call
   from here on writes through the shifted layout.
2. **Snapshot raw slots** now and at `UPGRADE_BLOCK - 1`; diff them to establish
   whether the bytes are still pristine.
3. **Audit USDC `Transfer` logs** from the proxy since the upgrade for anything
   sent to `0x…01F4`.
4. **Deploy V3** with `rewardIndex` appended last, validated by the OZ layout
   checker, rehearsed on a fork.
5. **Upgrade**, then confirm all four getters read their correct values.
6. **Reconcile** any corruption found in step 2 via a targeted, one-shot
   re-initializer — and only then.
7. **Add the CI layout check and the fork test** so the next V4 cannot repeat
   this.
