# Post-mortem

This is a storage layout break, not a logic break.

In a UUPS proxy, the proxy keeps all state and the implementation only supplies code. Solidity assigns storage slots by declaration order. In `V1`, the layout was:

- slot `0`: `totalDeposited`
- slot `1`: `treasury`
- slot `2`: `feeBps`

Those proxy slots still contain the old values:

- slot `0` = `2_000_000_000000`
- slot `1` = `0xC0FFEE0000000000000000000000000000000000`
- slot `2` = `500` (`0x01f4`)

After the upgrade, `V2` changed the order by inserting `rewardIndex` at the front, so `V2` now interprets the same slots as:

- slot `0`: `rewardIndex`
- slot `1`: `totalDeposited`
- slot `2`: `treasury`
- slot `3`: `feeBps`

That exactly explains the observed reads:

- `rewardIndex()` reads old slot `0`, so it returns the old `totalDeposited` value: `2000000000000`
- `totalDeposited()` reads old slot `1`, so it returns the old `treasury` address reinterpreted as a `uint256`
- `treasury()` reads old slot `2`, so it returns `0x...01F4`, which is `500` reinterpreted as an address
- `feeBps()` reads slot `3`, which was never used before, so it returns `0`

Nothing reverts because the EVM has no notion of "wrong slot type". Reading an address from a slot that used to hold a `uint256`, or a `uint256` from a slot that used to hold an address, is still a valid storage read.

## Is the deposit data gone?

No. The data is almost certainly still in proxy storage, unchanged, in its original slots. What is broken is the implementation's interpretation of those slots.

The old deposit amount is still sitting in slot `0`; `V2` is just calling that slot `rewardIndex`. Likewise the old treasury is still in slot `1`, and the old fee is still in slot `2`.

So this is not data erasure. It is a storage layout mismatch.

## Safe V2 change

For upgradeable contracts, existing state variables must keep the exact same order and types. New variables must be appended, never inserted before existing ones.

Safe `V2` layout:

```solidity
contract V2 is V1 {
    uint256 public rewardIndex;
}
```

Or, if written out explicitly, it must remain:

```solidity
uint256 public totalDeposited;
address public treasury;
uint256 public feeBps;
uint256 public rewardIndex;
```

Then the slots become:

- slot `0`: `totalDeposited`
- slot `1`: `treasury`
- slot `2`: `feeBps`
- slot `3`: `rewardIndex`

That preserves all existing values and gives `rewardIndex` a fresh slot.

## Migration / recovery

The fix is to upgrade again to a corrected implementation with the preserved layout and `rewardIndex` appended at the end. Because the old values were not overwritten, once the corrected implementation is active:

- `totalDeposited()` will read slot `0` again and return `2_000_000_000000`
- `treasury()` will read slot `1` again and return `0xC0FFEE0000000000000000000000000000000000`
- `feeBps()` will read slot `2` again and return `500`
- `rewardIndex()` will read new slot `3` and initially return `0` until explicitly set

If `rewardIndex` needs initialization, do it with a reinitializer or an admin-only setter after upgrading to the corrected layout. Do not try to "move" old values around in storage to fit the broken `V2`; the implementation should be fixed to match the existing storage, not the other way around.

## Root cause

The root cause is violating the upgradeable-storage rule: **never change the order of inherited or existing state variables**. In proxy-based upgrades, storage layout compatibility is part of the contract's external interface.
