# Post-mortem: V1 → V2 UUPS upgrade shifted every storage value by one slot

## TL;DR

You inserted `rewardIndex` at the **top** of the declaration list instead of the
bottom. A proxy upgrade replaces *code*, never *storage*. The storage slots kept
holding exactly the bytes V1 wrote; V2's variable names now point one slot lower
than the data they are supposed to name, so every getter reads its neighbour's
value.

**Your deposit data is not gone.** `2_000_000_000000` is still sitting in slot 0,
byte-for-byte intact. It is only being read under the wrong name. All three V1
values are recoverable, with one caveat: any *write* performed through V2 since
the upgrade has been landing in the wrong slot and may have overwritten a
neighbour. That is the part that needs checking, not the original values.

---

## Why the values read shifted

### Storage layout is positional, not nominal

Solidity assigns storage slots by declaration order at compile time. The slot
number is baked into the `SLOAD`/`SSTORE` opcodes of the compiled bytecode.
Nothing about the variable's *name* or *type* survives into storage — the EVM
storage trie is just `uint256 key -> uint256 value`. The proxy holds the storage;
the implementation holds the code that decides which slot a name means.

Let `N` be the first slot your own state occupies (whatever the OZ upgradeable
base contracts leave free above it). Then:

| Slot | Bytes actually stored (written by V1, never changed) | V1 called it | V2 calls it |
|------|------------------------------------------------------|--------------|-------------|
| N+0 | `0x1d1a94a2000` = 2_000_000_000000 | `totalDeposited` | `rewardIndex` |
| N+1 | `0xC0FFEE0000000000000000000000000000000000` | `treasury` | `totalDeposited` |
| N+2 | `0x1f4` = 500 | `feeBps` | `treasury` |
| N+3 | never written = `0x0` | *(did not exist)* | `feeBps` |

Now read the table down the right-hand column and compare against your observed
output:

- `rewardIndex() -> 2000000000000` — slot N+0. That is your USDC total, in base
  units, read under the new name. You never set it; V1 did, two years of
  deposits ago.
- `totalDeposited() -> ` huge number whose hex is your old treasury address —
  slot N+1. `0xC0FFEE00…00` interpreted as a `uint256` is
  `1101833650747854256492557129184819199699562004480`. Printing it in hex gives
  the address back, which is the tell you already spotted.
- `treasury() -> 0x00000000000000000000000000000000000001F4` — slot N+2. That is
  `500` (`0x1f4`), your fee, read as an `address`. An `address` getter masks the
  slot's low 20 bytes, so `500` becomes the address `0x…01F4`.
- `feeBps() -> 0` — slot N+3, a slot no V1 code ever touched. Unwritten storage
  reads as zero.

Every observation is the single hypothesis "shift by exactly one slot," with no
residue. That is as clean a confirmation as this class of bug produces.

### Why nothing reverted

There is no type system at the storage layer, and no layout metadata the proxy
could check. `SLOAD` on any slot succeeds and returns 32 bytes. The compiler
inserted the reads it was told to insert. Reading an address out of a slot
containing `500` is a legal, cheap, successful operation that yields a
nonsensical address. Silent wrongness is the *normal* failure mode of a storage
collision — a revert would have been a lucky break.

Similarly, `upgradeToAndCall` only rewrote the ERC-1967 implementation slot
(`0x360894a1…bbc`), which is a fixed keccak-derived constant deliberately placed
outside the range the compiler allocates sequentially. That is why the proxy
admin and implementation pointer are fine: they live in namespaced slots that
sequential layout can never collide with. Your business variables had no such
protection.

### The missing re-initializer is a red herring

Adding a `reinitializer(2)` would not have helped here and its absence is not the
cause. It would have let you *assign* `rewardIndex`, i.e. write a value into slot
N+0 — which would have **destroyed** `totalDeposited` instead of merely
misreading it. You got lucky: because you added no re-initializer, the upgrade
was a pure code swap and all original bytes survive.

---

## Damage assessment — do this before anything else

The read path is harmless and reversible. The **write** path is where real loss
can occur, because V2's writes go to the same shifted slots:

- Any `deposit()`/`withdraw()` that adjusts `totalDeposited` has been writing
  slot N+1 — **overwriting your treasury address** with a balance number.
- Any admin `setTreasury()` has been writing slot N+2, overwriting the fee.
- Any `setFeeBps()` has been writing the previously-untouched slot N+3
  (harmless).
- Any fee math reading `feeBps` has seen `0`, so **fees have not been charged**
  since the upgrade.
- Any payout routed to `treasury()` has been sent to
  `0x00000000000000000000000000000000000001F4`, an address nobody holds the key
  to. Funds sent there are unrecoverable.

Concretely, before you do anything else:

1. **Pause the contract** if you have a pauser, or otherwise stop the write path.
   Every further transaction can widen the damage.
2. Read the raw slots directly rather than trusting the getters:
   ```bash
   cast storage $PROXY 0 --rpc-url $RPC   # and 1, 2, 3 — offset by N if your
   cast storage $PROXY 1 --rpc-url $RPC   # own state does not start at 0
   ```
   Also read them at the pre-upgrade block for the ground truth:
   ```bash
   cast storage $PROXY 1 --block $BLOCK_BEFORE_UPGRADE --rpc-url $RPC
   ```
3. Check the balance of `0x…01F4` for any value you routed there, and diff
   on-chain USDC balance against the slot-0 figure to see whether accounting and
   reality still agree.
4. Enumerate every transaction to the proxy between the upgrade and the pause,
   and replay the state transitions to reconstruct what each of slots N+0..N+3
   *should* contain.

If the window was short and read-only, the slot values in the table above are
still exactly what V1 left, and recovery is trivial.

---

## The fix

### Rule: append only

In sequential (non-namespaced) proxy storage, across an upgrade you may:

- **append** new variables after all existing ones;
- rename a variable (name is not part of layout);
- change a variable to a different type of the same size *only* if you have a
  concrete migration reason, which is rarely worth it.

You may **never** insert, reorder, remove, or change the size of an existing
variable, and you must not change the inheritance order of base contracts —
C3-linearized base state is laid out before the derived contract's, so
reordering `contract V2 is A, B` to `is B, A` shifts everything just as
destructively as what happened here.

### V2, corrected

```solidity
contract StakingV2 is UUPSUpgradeable, OwnableUpgradeable {
    // --- V1 layout: frozen forever, exact order, do not touch ---
    uint256 public totalDeposited;
    address public treasury;
    uint256 public feeBps;

    // --- V2 additions: strictly appended below this line ---
    uint256 public rewardIndex;
}
```

That is all that is required for correctness. With this layout the proxy's
current bytes line up again: slot N+0 → `totalDeposited` = 2_000_000_000000,
N+1 → `treasury` = `0xC0FFEE…`, N+2 → `feeBps` = 500, N+3 → `rewardIndex` = 0.
`rewardIndex` starting at 0 is the correct initial value for a reward index that
has never accrued, so **if no state-mutating call happened during the V2
window, deploying this as V3 restores every value with no migration writes at
all.**

If writes did occur, add a one-shot repair that runs atomically with the
upgrade:

```solidity
/// @notice One-time repair of slots corrupted while the broken V2 was live.
function reinitV3(uint256 correctTotal, address correctTreasury, uint256 correctFee)
    external
    reinitializer(3)
{
    totalDeposited = correctTotal;
    treasury       = correctTreasury;
    feeBps         = correctFee;
    rewardIndex    = 0;
}
```

and invoke it in the same transaction as the upgrade so no window exists where
the contract is live with half-repaired state:

```solidity
proxy.upgradeToAndCall(
    address(v3),
    abi.encodeCall(StakingV3.reinitV3, (2_000_000_000000, 0xC0FFEE…, 500))
);
```

Two cautions on that repair: `reinitializer(3)` requires a version strictly
greater than the current `_initialized` value, and pass the values you
*reconstructed from the pre-upgrade block*, not the values the broken getters
report today.

### Make this class of bug structurally impossible

**1. Reserve a storage gap in every upgradeable contract.** A gap lets a *base*
contract grow later without shifting derived-contract state:

```solidity
contract StakingV1 is UUPSUpgradeable {
    uint256 public totalDeposited;
    address public treasury;
    uint256 public feeBps;

    /// @dev Reserved. Decrement by the number of slots consumed when adding state.
    uint256[47] private __gap;
}
```

Adding `uint256 public rewardIndex;` then means shrinking the gap to `[46]` in
the same commit. The gap discipline only works if it is applied consistently and
the decrement is never forgotten — which is why the automated check below
matters more than the gap itself.

**2. Prefer ERC-7201 namespaced storage for new work.** This removes sequential
layout from the picture entirely; each contract's state hangs off a
keccak-derived root, so insertion order within the struct is the only thing that
matters and nothing can collide with a neighbour:

```solidity
/// @custom:storage-location erc7201:staking.main
struct MainStorage {
    uint256 totalDeposited;
    address treasury;
    uint256 feeBps;
    uint256 rewardIndex;   // appended — still append-only inside the struct
}

// keccak256(abi.encode(uint256(keccak256("staking.main")) - 1)) & ~bytes32(uint256(0xff))
bytes32 private constant MAIN_STORAGE_LOCATION = 0x...;

function _main() private pure returns (MainStorage storage $) {
    assembly { $.slot := MAIN_STORAGE_LOCATION }
}
```

OpenZeppelin Contracts v5 uses this throughout, which is why upgrading the OZ
base contracts themselves no longer shifts your state. Note that append-only
still applies *within* the struct.

**3. Gate every upgrade on an automated layout diff — this is the control that
would actually have caught it.** The OpenZeppelin Upgrades tooling compares the
compiled layout of the new implementation against the stored layout of the
deployed one and refuses to proceed on an incompatible change. Run it in CI, not
just locally:

```bash
# Foundry
forge clean && forge build --build-info
npx @openzeppelin/upgrades-core validate out/build-info \
    --contract StakingV2 --reference StakingV1
```

```js
// Hardhat
await upgrades.validateUpgrade(proxyAddress, StakingV2);
await upgrades.upgradeProxy(proxyAddress, StakingV2);
```

Either one rejects this exact diff with a "New variables should be placed after
all existing inherited variables" error. Make the CI job a required check on the
branch that produces upgrade artifacts.

**4. Rehearse on a mainnet fork.** `anvil --fork-url $RPC` against the real proxy,
execute the upgrade, then assert every getter equals its pre-upgrade value.
Three assertions would have caught this in seconds, and unlike a code review they
catch layout shifts introduced by dependency bumps too.

**5. Add post-upgrade invariant assertions to the upgrade runbook.** Read the key
getters immediately after the upgrade transaction and compare to values captured
before it. If your upgrade path goes through a timelock or multisig, put the
checks between "queued" and "executed" so there is a human-reviewable diff.

---

## Summary

| Question | Answer |
|---|---|
| Why is everything shifted? | `rewardIndex` was declared first, pushing every V1 variable one slot down in V2's view. Proxy storage was untouched, so each name now reads its neighbour's slot. |
| Why no revert? | Storage is untyped 32-byte words; every `SLOAD` succeeds. `500` read as an `address` is a valid address. |
| Is deposit data gone? | No. `2_000_000_000000` is intact in slot N+0. All V1 values survive, *unless* a write executed through the broken V2 overwrote a neighbouring slot — audit the post-upgrade transactions. |
| What do we change? | Declare `rewardIndex` **after** `feeBps`, ship as V3; if state was written during the broken window, repair it with a `reinitializer(3)` called atomically via `upgradeToAndCall`. |
| How do we prevent it? | Append-only discipline, storage gaps or ERC-7201 namespaced storage, and a required CI layout-compatibility check plus a fork rehearsal before every upgrade. |

### Immediate next steps

1. Pause writes.
2. `cast storage` the proxy at the pre-upgrade block to capture ground truth.
3. Audit post-upgrade transactions for writes to the shifted slots, and check
   whether anything was routed to `0x…01F4`.
4. Ship V3 with the corrected append-only layout, plus `reinitV3` if and only if
   step 3 found corruption.
5. Land the layout check in CI before the next upgrade goes out.
