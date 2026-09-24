# Post-mortem: V1 → V2 UUPS upgrade returns shifted values

## TL;DR

You prepended `rewardIndex` to the state variable list. Solidity assigns sequential
storage slots in declaration order, and the proxy's storage is *not* migrated by an
upgrade — only the implementation pointer changes. So V2's getters read the same
physical slots V1 wrote, but with every name shifted down by one slot.

**Your deposit data is not gone.** All three V1 values are still sitting, byte-for-byte,
in slots 0/1/2. They are merely being read under the wrong names. The danger is not the
reads — it is the *next write*, which will destroy real data.

The fix is to append `rewardIndex` after `feeBps` rather than before `totalDeposited`,
ship that as V3, and add an automated storage-layout check to the upgrade pipeline so
this class of bug cannot reach mainnet again.

---

## 1. Why every value reads shifted

A proxy holds the state; the implementation holds only code. `delegatecall` executes V2's
bytecode *against the proxy's storage*. Solidity compiles `totalDeposited` etc. into
hard-coded slot numbers at compile time, derived purely from declaration order. Changing
the order changes those numbers. Nothing at runtime re-checks that the numbers still refer
to the same data.

### Slot map

| Slot | Written by V1 (still there) | Read by V2 as |
|------|-----------------------------|---------------|
| 0 | `totalDeposited` = `2_000_000_000000` | `rewardIndex` |
| 1 | `treasury` = `0xC0FFEE00…0000` | `totalDeposited` |
| 2 | `feeBps` = `500` | `treasury` |
| 3 | *never written* = `0` | `feeBps` |

### Each observed reading, explained

- **`rewardIndex() -> 2000000000000`** — slot 0. That is exactly your 2,000,000 USDC in
  base units (`2e6 * 1e6`), i.e. hex `0x1d1a94a2000`. You never set `rewardIndex`; you are
  reading `totalDeposited`.

- **`totalDeposited() -> <huge number>`** — slot 1, your treasury address widened from
  `address` (20 bytes) to `uint256` (32 bytes) by zero-padding on the left. The slot held
  `0x000000000000000000000000C0FFEE0000000000000000000000000000000000`, which as a decimal
  `uint256` is `1101833650747854256492557129184819199699562004480`. That is why the hex
  print is "exactly our old treasury address" — because it literally is.

- **`treasury() -> 0x00000000000000000000000000000000000001F4`** — slot 2, your
  `feeBps` value `500` = `0x1F4`, truncated from `uint256` to `address` by keeping the low
  20 bytes. `500` fits in 20 bytes, so nothing is lost; it is just displayed as an address.

- **`feeBps() -> 0`** — slot 3 was never written by V1, so it reads as the zero default.
  Storage is not "uninitialized"; it is defined to be zero.

- **Nothing reverts** — because there is no runtime type or layout check. `sload` on any
  slot is valid and returns 32 bytes. A layout mismatch is silent by construction. That is
  precisely what makes this bug class dangerous: your only signal was the wrong numbers.

The absence of a re-initializer is not the cause and adding one would not have helped. A
re-initializer sets values; it does not move them. The cause is purely the declaration
order.

---

## 2. Is the deposit data gone?

**Not yet — but it is one transaction away from being gone.** Two separate questions:

### (a) Is it still on-chain?

Yes. The upgrade transaction only wrote the ERC-1967 implementation slot
(`0x360894...bbc`). Slots 0/1/2 were untouched. `eth_getStorageAt(proxy, 0x0)` will still
return `0x1d1a94a2000`. Confirm this directly before doing anything else:

```bash
cast storage $PROXY 0 --rpc-url $RPC   # expect 0x…01d1a94a2000   (totalDeposited)
cast storage $PROXY 1 --rpc-url $RPC   # expect 0x…C0FFEE00…0000  (treasury)
cast storage $PROXY 2 --rpc-url $RPC   # expect 0x…01f4           (feeBps)
cast storage $PROXY 3 --rpc-url $RPC   # expect 0x…00             (unused)
```

### (b) What destroys it?

Any state-mutating V2 call. Under the shifted layout:

- **A deposit or withdrawal** (`totalDeposited += amount`) writes **slot 1** → overwrites
  the treasury address with a small integer. Your treasury is then gone, and the recorded
  balance becomes garbage.
- **A reward accrual** (`rewardIndex = …`) writes **slot 0** → overwrites the total
  deposits ledger. This one silently corrupts the accounting that backs user funds.
- **`setTreasury(addr)`** writes **slot 2** → overwrites `feeBps` with an address-sized
  integer, producing an absurd fee rate.
- **`setFeeBps(x)`** writes **slot 3** → harmless today, but it means the fee you think you
  set is never read back by anything else that (correctly) expects slot 2.

Two live hazards regardless of writes, for as long as V2 is the implementation:

- **`feeBps` reads as 0** → fee collection is currently disabled. You are losing revenue on
  every operation, not a safety issue but a real loss.
- **`treasury` reads as `0x…01F4`** → any fee or sweep transfer routes to an address
  nobody controls. Funds sent there are **permanently unrecoverable**. If the code
  lacks a zero-address-style sanity check, this is an active fund-loss path.

**Immediate action: pause the contract, or otherwise block all state-mutating entry
points, until V3 is live.** Every minute V2 is unpaused is exposure. If you have no pause
and the mutating functions are permissioned, revoke the callers; if they are public, treat
this as an incident and upgrade now.

---

## 3. The fix: append, never insert

Storage slots are assigned in declaration order, so **existing variables must keep their
positions forever**. New variables go at the end.

```solidity
contract StakingV3 is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    // ---- V1 layout: order is frozen, do not touch ----
    uint256 public totalDeposited;  // slot 0
    address public treasury;        // slot 1
    uint256 public feeBps;          // slot 2

    // ---- appended in V3 ----
    uint256 public rewardIndex;     // slot 3

    // ...
}
```

That alone restores every reading, because the slots never changed — only the names
pointing at them did. `rewardIndex` lands on slot 3, which is currently zero, so it
starts clean.

The same rule covers the cases that bite next: never **delete** a variable (leave it in
place, rename to `uint256 private __deprecated_x`), never **reorder**, never **change a
type's size or packing**, and never **insert a new base contract into the inheritance
list** ahead of existing ones — C3 linearization lays base-contract storage out before the
derived contract's, so a new base shifts everything exactly the way this bug did.

### If you need a nonzero starting `rewardIndex`

Appending gives you `rewardIndex == 0`. If your math expects a `1e18` ray-style starting
index (very common — a zero index makes the first accrual divide by zero or mint infinite
rewards), set it with a `reinitializer`:

```solidity
uint256 private constant INDEX_PRECISION = 1e18;

function initializeV3() external reinitializer(3) {
    rewardIndex = INDEX_PRECISION;
}
```

Use `reinitializer(n)` with a version above whatever V1's `initializer` consumed, and call
it **atomically in the same transaction as the upgrade** via
`upgradeToAndCall(newImpl, abi.encodeCall(StakingV3.initializeV3, ()))`. A separate
follow-up transaction leaves a window in which anyone can front-run and call
`initializeV3` themselves, or in which an accrual runs against a zero index.

### Structural hardening (pick one, apply consistently)

**Option A — reserved gap.** Classic, works with any toolchain. Reserve trailing slots and
decrement the gap by exactly the number of slots you consume when you add a variable:

```solidity
uint256 public totalDeposited;
address public treasury;
uint256 public feeBps;
uint256 public rewardIndex;
uint256[46] private __gap;   // was [47] before rewardIndex was appended
```

The gap does not prevent this bug by itself (a gap would not have saved you here — you
prepended) but it reserves room so a *future* base contract or module can grow without
colliding.

**Option B — ERC-7201 namespaced storage.** Stronger, and what OpenZeppelin Contracts v5
uses internally. Each contract's state lives in a struct at a hashed, collision-resistant
slot rather than in the sequential region, so declaration order across contracts stops
mattering:

```solidity
/// @custom:storage-location erc7201:mystaking.storage.Staking
struct StakingStorage {
    uint256 totalDeposited;
    address treasury;
    uint256 feeBps;
    uint256 rewardIndex;   // appending inside the struct is still required
}

// keccak256(abi.encode(uint256(keccak256("mystaking.storage.Staking")) - 1)) & ~bytes32(uint256(0xff))
bytes32 private constant STAKING_STORAGE_LOCATION = 0x...;

function _s() private pure returns (StakingStorage storage $) {
    assembly { $.slot := STAKING_STORAGE_LOCATION }
}
```

Note the caveat: within the struct you must **still** only append. Namespacing isolates
contracts from each other; it does not make field order inside one struct free. Also, you
cannot retrofit namespaced storage onto an already-deployed sequential layout without a
migration — for this incident, ship the simple append (Option A) now and consider Option B
for a future greenfield contract.

---

## 4. Process fix — this must be caught by a machine, not a reviewer

The real failure is that a layout-incompatible upgrade reached mainnet. The tooling to
block it is standard and cheap:

**Hardhat (`@openzeppelin/hardhat-upgrades`)** — `upgradeProxy` and `validateUpgrade` run
the layout comparison against the stored manifest and **refuse to deploy** on a mismatch.
Running it here would have failed with "Inserted `rewardIndex` — new variables should be
placed after existing ones".

```js
await upgrades.validateUpgrade(PROXY_ADDR, await ethers.getContractFactory("StakingV3"), {
  kind: "uups",
});
```

**Foundry (`openzeppelin-foundry-upgrades`)** — `Upgrades.upgradeProxy(...)` with
`--ffi` and reference build info, plus `@custom:oz-upgrades-from StakingV1` on the V3
contract, performs the same check.

Make this a required CI gate on any PR touching an upgradeable contract, and require the
deploy script to call the validating path — never a raw `upgradeToAndCall` from a script
or from Etherscan's UI. The V1→V2 upgrade almost certainly bypassed the validator; that is
the hole to close.

Additional checks worth adding to the runbook, given this is UUPS on mainnet:

- **Simulate on a mainnet fork first.** Fork at head, run the upgrade, then assert every
  getter returns its pre-upgrade value. A ~10-line fork test catches 100% of this bug
  class and would have caught this one:
  ```solidity
  function test_upgradePreservesState() public {
      uint256 dBefore = s.totalDeposited();
      address tBefore = s.treasury();
      uint256 fBefore = s.feeBps();
      _upgradeToV3();
      assertEq(s.totalDeposited(), dBefore);
      assertEq(s.treasury(),       tBefore);
      assertEq(s.feeBps(),         fBefore);
  }
  ```
- **Diff the raw layouts** as a belt-and-braces check: `forge inspect StakingV1 storage`
  vs `forge inspect StakingV3 storage`, and confirm the first three entries are identical
  in name, type, slot, and offset.
- **UUPS-specific: confirm you can still upgrade.** With UUPS the upgrade logic lives in
  the *implementation*, so a bad implementation can brick the proxy permanently. Your
  observed values indicate `totalDeposited` sits at slot 0, meaning inherited
  storage (Ownable, Initializable, UUPS) is namespaced (OZ v5 style) and was not shifted —
  so `_authorizeUpgrade`'s owner check should still read the correct owner. **Verify this
  explicitly** by calling `owner()` on the proxy before you build the V3 transaction. If
  it returns anything other than your expected admin, stop and reassess; a shifted owner
  slot would mean the escape hatch is compromised.
- **Put upgrade authority behind a multisig or timelock**, not an EOA. Separately from
  this incident, a single key that can `delegatecall`-swap the code behind 2M USDC is the
  largest item in your threat model.

---

## 5. Recommended sequence

1. **Pause** all state-mutating entry points on the proxy. Nothing below is safe while
   writes can land.
2. **Snapshot** slots 0–3 with `cast storage` and record them. This is your ground truth.
3. **Verify** `owner()` / upgrade authority on the proxy still resolves correctly.
4. **Write V3** with `rewardIndex` appended after `feeBps`, plus `reinitializer(3)` if a
   nonzero starting index is needed, and a trailing `__gap`.
5. **Validate** the layout with the OZ plugin and **fork-test** that the three getters
   return the snapshotted values post-upgrade.
6. **Upgrade** via `upgradeToAndCall`, bundling `initializeV3` in the same transaction.
7. **Verify on mainnet**: `totalDeposited() == 2000000000000`, `treasury() == 0xC0FFEE…`,
   `feeBps() == 500`, `rewardIndex()` == your intended seed.
8. **Unpause**, then **reconcile**: confirm no fee transfers were sent to `0x…01F4` and no
   deposits/withdrawals executed under the broken layout during the exposure window. If
   any write did occur, do **not** unpause — restore the affected slot from your snapshot
   inside the V3 reinitializer before resuming.
9. **Gate CI** on `validateUpgrade` so the next upgrade cannot skip the check.

---

## 6. The one-line takeaway

An upgrade swaps code, never storage. Variable names are a compile-time fiction over
fixed slot numbers, so the only safe edit to an upgradeable contract's state is to
**append** — and that rule needs to be enforced by the upgrade tooling in CI, because the
failure mode is silent: no revert, no event, just wrong numbers.
