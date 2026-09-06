# Post-mortem: V1 -> V2 UUPS upgrade broke storage layout

The upgrade succeeded at the proxy level, but V2 changed the storage layout in an unsafe way.

In a proxy setup, the proxy keeps the state and `delegatecall`s into the implementation. That means the implementation's variable order is really a schema for interpreting the proxy's existing storage slots. Upgrading from V1 to V2 did not move or rewrite any stored bytes. It only changed how the new code reads those same slots.

## What V1 stored

V1 declared:

```solidity
uint256 public totalDeposited; // slot 0
address public treasury;       // slot 1
uint256 public feeBps;         // slot 2
```

So the proxy storage before the upgrade was effectively:

| Slot | V1 meaning        | Stored value |
|---|---|---|
| 0 | `totalDeposited` | `2_000_000_000000` |
| 1 | `treasury` | `0xC0FFEE0000000000000000000000000000000000` |
| 2 | `feeBps` | `500` (`0x01f4`) |

## What V2 expects

V2 declared:

```solidity
uint256 public rewardIndex;    // slot 0
uint256 public totalDeposited; // slot 1
address public treasury;       // slot 2
uint256 public feeBps;         // slot 3
```

That inserted `rewardIndex` at the front, so every existing variable shifted by one slot.

After the upgrade, V2 reads the proxy's old storage like this:

| Slot | Actual bytes in proxy | V2 interprets it as | Observed read |
|---|---|---|---|
| 0 | old `totalDeposited` | `rewardIndex` | `2000000000000` |
| 1 | old `treasury` | `totalDeposited` | huge integer equal to treasury bytes |
| 2 | old `feeBps = 500` | `treasury` | `0x...01F4` |
| 3 | empty / zero | `feeBps` | `0` |

That exactly matches the symptoms:

- `rewardIndex()` returns the old `totalDeposited`, because both read slot 0.
- `totalDeposited()` returns the old treasury address reinterpreted as a `uint256`, because it now reads slot 1.
- `treasury()` returns `0x...01F4`, because it now reads slot 2 and formats `500` as an address.
- `feeBps()` returns `0`, because V1 never used slot 3.

## Why nothing reverted

Nothing is wrong with the proxy mechanism itself. The proxy still points to a valid V2 implementation, and `delegatecall` still works. The EVM does not know your intended schema for storage slots; it only reads raw 32-byte words. Reading the "wrong" slot is still a valid read, so calls succeed and just return nonsense.

## Is the deposit data gone?

No. The data is almost certainly still in proxy storage, unchanged:

- slot 0 still contains the old `totalDeposited`
- slot 1 still contains the old `treasury`
- slot 2 still contains the old `feeBps`

What is broken is the layout compatibility of V2, not the stored bytes themselves.

If you were to point the proxy back to the original V1 implementation, or to a corrected V2 that preserves the original field order, those old values would read correctly again.

## How to make V2 safe

Do not insert new state variables before existing ones in an upgradeable contract. Append new variables after all existing storage variables.

Safe V2 layout:

```solidity
uint256 public totalDeposited; // slot 0, unchanged
address public treasury;       // slot 1, unchanged
uint256 public feeBps;         // slot 2, unchanged
uint256 public rewardIndex;    // slot 3, new
```

That keeps every old variable in the same slot and places the new field in the first unused slot.

If this contract uses inheritance, the same rule applies across the full linearized storage layout: never reorder, delete, or insert variables ahead of already-deployed state.

## Recovery path

The practical fix is:

1. Deploy a new implementation whose storage layout matches V1 exactly for existing fields and appends `rewardIndex` after them.
2. Upgrade the proxy from the broken V2 to that corrected implementation.
3. If needed, initialize `rewardIndex` via a new initializer/reinitializer or an owner/admin setter, because it will live in slot 3 and was never previously set.

Because the bad V2 only changed interpretation, not the bytes, upgrading to a corrected layout should restore the original values automatically.

## Root cause

The root cause is a storage layout incompatibility in an upgradeable proxy contract. In UUPS, logic can change, but the storage layout for already-deployed variables must remain append-only.
