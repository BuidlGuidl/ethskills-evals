The upgrade succeeded at the proxy level but broke the storage layout.

In a UUPS proxy, the proxy keeps all state and the implementation only supplies code. That means the meaning of each storage slot must stay compatible across versions. V1 used:

- slot 0: `totalDeposited`
- slot 1: `treasury`
- slot 2: `feeBps`

Those slots held:

- slot 0 = `2_000_000_000000`
- slot 1 = `0xC0FFEE0000000000000000000000000000000000`
- slot 2 = `500` (`0x01f4`)

V2 changed the declaration order to:

- slot 0: `rewardIndex`
- slot 1: `totalDeposited`
- slot 2: `treasury`
- slot 3: `feeBps`

Nothing rewrote storage during the upgrade, so the old bytes are still sitting in slots 0, 1, and 2. The new implementation simply interprets those same slots under different names:

- `rewardIndex()` now reads old slot 0, so it returns the old `totalDeposited` value: `2_000_000_000000`
- `totalDeposited()` now reads old slot 1, so it returns the 32-byte encoding of the old `treasury` address as a huge integer
- `treasury()` now reads old slot 2, so it interprets `500` as an address and returns `0x00000000000000000000000000000000000001F4`
- `feeBps()` now reads slot 3, which was never used before, so it returns `0`

That is why every value appears shifted by one slot and why no call reverts. Reading the wrong slot is still valid EVM behavior. The proxy, admin, and implementation address can all be correct while the logical state is wrong.

Your deposit data is not gone. The original `totalDeposited` value is still present in proxy storage at slot 0. The problem is not data deletion; it is misinterpretation caused by an incompatible layout change. If you upgrade again to an implementation whose storage layout matches V1 for the existing fields, the old values will read correctly again.

The safe V2 change is to preserve all existing variables in exactly the same order and append new storage only at the end. So V2 should be:

```solidity
uint256 public totalDeposited;
address public treasury;
uint256 public feeBps;
uint256 public rewardIndex;
```

With that layout:

- slot 0 remains `totalDeposited`
- slot 1 remains `treasury`
- slot 2 remains `feeBps`
- slot 3 becomes the new `rewardIndex`

Then a reinitializer, admin setter, or normal state-changing function can initialize `rewardIndex` if needed. The crucial rule is that upgrades may append storage, but must not insert, remove, reorder, or change the type of existing state variables. In practice, keep a storage gap as well if you expect future upgrades.

So the post-mortem is:

1. The upgrade did not corrupt proxy storage.
2. V2 corrupted the storage layout compatibility by inserting `rewardIndex` before existing fields.
3. Every getter now reads the previous slot's contents under a new type/name.
4. Recovery is to deploy a corrected V2/V3 that restores the original layout and appends `rewardIndex` at the end.
