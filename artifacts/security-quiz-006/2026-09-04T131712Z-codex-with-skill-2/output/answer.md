The upgrade succeeded because a UUPS proxy only changed its implementation pointer; it did not migrate or rewrite the proxy's existing storage. The bug is that V2 changed the storage layout incompatibly by inserting `rewardIndex` before the variables that already existed in V1.

In an upgradeable proxy, state is read by storage slot number, not by variable name. For the V1 layout:

- slot 0: `totalDeposited = 2_000_000_000000`
- slot 1: `treasury = 0xC0FFEE0000000000000000000000000000000000`
- slot 2: `feeBps = 500`

After the upgrade, V2 interprets those same slots as:

- slot 0: `rewardIndex`
- slot 1: `totalDeposited`
- slot 2: `treasury`
- slot 3: `feeBps`

So every read is shifted by one slot:

1. `rewardIndex()` returns `2000000000000` because V2 reads slot 0, and slot 0 still contains V1's `totalDeposited`.
2. `totalDeposited()` returns the old treasury address as a huge integer because V2 now reads slot 1 as a `uint256`.
3. `treasury()` returns `0x...01F4` because V2 reads slot 2 as an `address`, and slot 2 contains V1's `feeBps = 500 = 0x1f4`.
4. `feeBps()` returns `0` because V2 reads slot 3, which was unused in V1 and is therefore zero.

No call reverts because nothing is syntactically invalid at the EVM level. The getters are just decoding the wrong slots. A `uint256` can read any 32-byte word, and an `address` getter simply takes the low 20 bytes of the slot value.

Your deposit data is not gone. The old `totalDeposited` value is still in proxy storage slot 0 exactly where it always was. The problem is that V2 no longer looks at slot 0 for `totalDeposited`; it looks there for `rewardIndex`. Likewise, the old treasury and fee values are still sitting in slots 1 and 2. This is a layout mismatch, not an erase.

The safe fix is to preserve the entire V1 layout exactly and only append new state variables at the end. V2 should be declared in this order:

```solidity
uint256 public totalDeposited;
address public treasury;
uint256 public feeBps;
uint256 public rewardIndex;
```

If V1 had a storage gap, `rewardIndex` could also be taken from that reserved gap in the usual OpenZeppelin pattern, but the key rule is the same: never insert, delete, reorder, or change the type of existing storage variables in an upgradeable contract.

For a safe V2 upgrade:

1. Redeploy a corrected V2 implementation whose first three state variables match V1 exactly.
2. Upgrade the proxy from the broken V2 implementation to that corrected implementation.
3. If `rewardIndex` needs a nonzero initial value, add a `reinitializer` or an owner-only setup function that writes only the new slot for `rewardIndex`.
4. Before any future upgrade, run a storage-layout compatibility check such as the OpenZeppelin upgrades plugin validation.

After upgrading to the corrected V2, reads line up again:

- `totalDeposited()` reads slot 0 and returns `2_000_000_000000`
- `treasury()` reads slot 1 and returns `0xC0FFEE...0000`
- `feeBps()` reads slot 2 and returns `500`
- `rewardIndex()` reads slot 3 and returns its default `0` until initialized

Root cause: the implementation code changed, but proxy storage stayed fixed. By inserting `rewardIndex` at the front, V2 re-labeled the old slots and caused every value to be interpreted as the next field over.
