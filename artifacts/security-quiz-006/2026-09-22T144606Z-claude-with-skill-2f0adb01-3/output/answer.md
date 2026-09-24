# Post-mortem: V1 → V2 UUPS upgrade returns shifted values

## Short version

Nothing is corrupted and nothing reverted because nothing *can* revert here. You
prepended `rewardIndex` to the state declarations, which pushed every existing
variable down one storage slot **in the V2 source code only**. The proxy's
storage was never touched by the upgrade — the old bytes are still sitting in
slots 0, 1 and 2 exactly where V1 put them. V2 is simply reading them through a
map that is off by one slot.

Your deposit data is not gone. It is in slot 1, being decoded as a `uint256`
instead of an `address`.

## Why this happens at all

A proxy holds the storage; the implementation holds only code. Every call to the
proxy is a `delegatecall` into the implementation, so the implementation's code
runs against the *proxy's* storage. The implementation does not carry a storage
map with it at runtime — Solidity compiles each state variable down to a
hardcoded slot number at compile time, assigned by **declaration order**:

- 1st declared value-type variable → slot 0
- 2nd → slot 1
- 3rd → slot 2
- …

So `totalDeposited()` in V1 compiled to literally `sload(0)`. In V2,
`totalDeposited()` compiles to `sload(1)`, because `rewardIndex` now owns slot 0.

An upgrade replaces the code and nothing else. There is no migration, no type
check, no layout check at the EVM level. Slots are untyped 32-byte words; `sload`
of a slot that used to hold an address succeeds just as happily as one that held
a `uint256`. That is exactly why every call still executes: **a storage layout
mismatch is silent by construction.** There is no revert to catch.

## Slot-by-slot walkthrough of your four readings

Proxy storage, written by V1 and untouched since:

| Slot | Raw 32-byte word | Written by V1 as |
|------|------------------|------------------|
| 0 | `0x…01D1A94A2000` | `totalDeposited = 2_000_000_000000` |
| 1 | `0x…C0FFEE00…0000` | `treasury = 0xC0FFEE…` |
| 2 | `0x…0000001F4` | `feeBps = 500` |
| 3 | `0x00…00` | never written |

Now read that same storage through V2's map:

**`rewardIndex()` → `sload(0)` → 2000000000000.**
You never set it. It is V1's `totalDeposited` (2,000,000 USDC at 6 decimals =
`2_000_000_000000` base units, hex `0x1D1A94A2000`) reinterpreted as the new
variable. This is the tell: a "brand new" variable that comes back non-zero on a
proxy means it has inherited an occupied slot.

**`totalDeposited()` → `sload(1)` → huge number whose hex is your old treasury.**
Slot 1 holds the 20-byte address `0xC0FFEE00…0000`, right-aligned in the 32-byte
word with 12 zero bytes of padding above it. Decoded as `uint256` that is
1101833650747854256492557129184819199699562004480. `address` and `uint256` are
both single-slot value types, so the ABI encoder returns the same word, just
labelled differently in the function's return type. Hence "printed in hex, it is
exactly our old treasury address."

**`treasury()` → `sload(2)` → `0x00000000000000000000000000000001F4`.**
Slot 2 holds `500` (`0x1F4`). Returning a `uint256`-shaped word as an `address`
truncates to the low 20 bytes, which gives you an address that is numerically
500. Note this address is almost certainly not controlled by anyone — if a fee
sweep ran against it, those funds are effectively burned. Check whether anything
has paid out to `0x…01F4` since the upgrade.

**`feeBps()` → `sload(3)` → 0.**
Slot 3 was never written by V1. Fresh zero. Your fee is now 0%, which means fee
accrual has silently been disabled since the upgrade — another thing to quantify
in the incident timeline.

Every value moved down exactly one slot, in lockstep, which is the signature of
a single prepended one-slot variable. (Two prepended variables would shift by
two; a prepended `bool`/`uint128` pair would shift by one but also change
packing, which produces much uglier garbage.)

## Is the deposit data gone?

**Reads alone: no.** Reads do not mutate. The 2,000,000 USDC figure is intact in
slot 0.

**Writes since the upgrade: this is what you must check before doing anything
else.** Every write is also shifted, and writes *do* destroy data:

- A call that increments `totalDeposited` has written to **slot 1** — overwriting
  your treasury address with a deposit total.
- A call that sets `treasury` has written to **slot 2** — overwriting `feeBps`.
- A call that sets `feeBps` has written to **slot 3** — harmless, that slot was
  empty.
- A call that touches `rewardIndex` has written to **slot 0** — overwriting
  `totalDeposited`.

So: pull the proxy's storage at the pre-upgrade block and at head and diff them.

```bash
# before the upgrade
cast storage $PROXY 0 --block $BLOCK_BEFORE_UPGRADE
cast storage $PROXY 1 --block $BLOCK_BEFORE_UPGRADE
cast storage $PROXY 2 --block $BLOCK_BEFORE_UPGRADE
# now
cast storage $PROXY 0 && cast storage $PROXY 1 && cast storage $PROXY 2
```

If slots 0–2 are byte-identical to the pre-upgrade values, no state-changing call
landed and a corrective upgrade alone restores everything. If they differ, you
have lost the original value of whichever slot was written, and you will need to
reconstruct it from event logs / deposit history and write it back explicitly
with a one-shot re-initializer. Given the upgrade was yesterday on a live
protocol, assume at least some writes landed until you have proven otherwise.

Pause the contract (or at minimum stop the frontend from submitting
state-changing calls) before continuing — every additional write while the layout
is wrong destroys more of slots 0–3.

## The fix: append, never prepend

The rule for any `delegatecall`-based proxy is that storage layout is
append-only. New variables go at the **end**. Never insert, never reorder, never
delete, never change a variable's type to a different size, never reorder within
a packed slot.

```solidity
contract StakingV2 {
    uint256 public totalDeposited;  // slot 0 — unchanged
    address public treasury;        // slot 1 — unchanged
    uint256 public feeBps;          // slot 2 — unchanged
    uint256 public rewardIndex;     // slot 3 — new, appended
}
```

This gives you `rewardIndex` in V2, which is what you need, and it reads `0` on
the existing proxy because slot 3 has never been written — the correct starting
value for a fresh index. Inheritance order counts too: base contracts lay out
their storage before the derived contract's, so adding or reordering a base
contract in V2 shifts everything just as badly as prepending a variable.

### Recovery plan

1. Pause / halt state-changing traffic.
2. Diff slots 0–3 against the pre-upgrade block as above.
3. Deploy `StakingV2Fixed` with the appended layout above.
4. Upgrade the proxy to it. If step 2 showed no writes, you are done — all four
   getters return their correct V1 values again and `rewardIndex` reads 0.
5. If step 2 showed writes, include a one-shot `reinitializer(2)` in
   `StakingV2Fixed` that restores the clobbered slots to values reconstructed
   from your event history, and verify each getter against the pre-upgrade block
   before unpausing.

Verify on a mainnet fork before touching mainnet:

```bash
anvil --fork-url $RPC --fork-block-number <head>
# upgrade the forked proxy to StakingV2Fixed, then assert:
#   totalDeposited() == 2_000_000_000000
#   treasury()       == 0xC0FFEE0000000000000000000000000000000000
#   feeBps()         == 500
#   rewardIndex()    == 0
```

### Stopping this from recurring

**Use the OpenZeppelin Upgrades tooling and let it fail the deploy.** It compares
the compiled layout of the new implementation against the stored layout of the
old one and refuses the upgrade on a mismatch. This exact bug is the thing it is
built to catch.

```solidity
// Foundry: openzeppelin-foundry-upgrades
Upgrades.upgradeProxy(proxy, "StakingV2.sol:StakingV2", "");
// reverts at simulation time with a storage-layout-incompatible error
```

Hardhat's `@openzeppelin/hardhat-upgrades` gives the same guarantee via
`upgradeProxy` / `validateUpgrade`. Run the validation in CI against the
*deployed* implementation, not just locally, so an unvalidated deploy cannot
reach mainnet.

**Reserve a storage gap** in every upgradeable contract, so future versions —
including future base contracts — have room to append without disturbing
anything downstream:

```solidity
uint256[50] private __gap; // shrink by 1 for each new slot you append
```

**Or adopt ERC-7201 namespaced storage**, which sidesteps sequential slot
assignment entirely by hashing each contract's state into its own region:

```solidity
/// @custom:storage-location erc7201:staking.main
struct MainStorage {
    uint256 totalDeposited;
    address treasury;
    uint256 feeBps;
    uint256 rewardIndex;
}

// keccak256(abi.encode(uint256(keccak256("staking.main")) - 1)) & ~bytes32(uint256(0xff))
bytes32 private constant MAIN_STORAGE_LOCATION = 0x...;

function _main() private pure returns (MainStorage storage $) {
    assembly { $.slot := MAIN_STORAGE_LOCATION }
}
```

With namespaced storage, adding a field to the struct is still append-only within
the namespace, but different contracts and base contracts can never collide with
each other. This is the pattern OpenZeppelin v5 upgradeable contracts use.

**Also add to the upgrade runbook:** a post-upgrade smoke check that asserts a
handful of known state values (`totalDeposited`, `treasury`, `feeBps`) still read
their expected pre-upgrade values, run on a fork before the real upgrade and
against mainnet immediately after. Layout bugs are silent — the only way to catch
them is to look, deliberately, at values you already know the answer to.

## Related checks while you are in here

Two items on the upgradeable-contract checklist are worth confirming as part of
the same review, since you are already touching the deploy path:

- `_authorizeUpgrade` is gated, and upgrade authority sits behind a multisig or
  timelock rather than a single EOA. A layout mistake that ships in one
  transaction is a symptom of an upgrade path with no second pair of eyes on it.
- The implementation contract calls `_disableInitializers()` in its constructor,
  so the V2 implementation cannot be initialized directly by anyone.
