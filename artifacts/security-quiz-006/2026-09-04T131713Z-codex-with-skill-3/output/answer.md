The upgrade succeeded at the proxy level, but the storage layout became incompatible.

In a UUPS proxy, the proxy keeps all state and the implementation only provides code. State variables are read by fixed storage slot number, in declaration order. Because V2 inserted `rewardIndex` at the top instead of appending it, every existing variable in V1 moved down by one slot from the implementation's point of view.

V1 layout:

- slot 0: `totalDeposited`
- slot 1: `treasury`
- slot 2: `feeBps`

V2 layout as deployed:

- slot 0: `rewardIndex`
- slot 1: `totalDeposited`
- slot 2: `treasury`
- slot 3: `feeBps`

The proxy storage was never rewritten during the upgrade, so the proxy still contains the old V1 values in slots 0, 1, and 2:

- slot 0 = `2_000_000_000000`
- slot 1 = `0xC0FFEE0000000000000000000000000000000000`
- slot 2 = `500`
- slot 3 = `0`

After the upgrade, V2 reads those same slots under new names:

- `rewardIndex()` reads slot 0, so it returns the old `totalDeposited`: `2000000000000`
- `totalDeposited()` reads slot 1, so it returns the old `treasury` bytes interpreted as a `uint256`
- `treasury()` reads slot 2, so it returns `500` interpreted as an address, which is `0x00000000000000000000000000000000000001F4`
- `feeBps()` reads slot 3, which was never used before, so it returns `0`

That is why every value appears shifted and why calls do not revert. Nothing is wrong with the proxy pointer or the implementation dispatch. The code is executing normally against the wrong storage layout.

Your deposit data is not gone. It is still in the proxy, untouched, at the original storage slots. The problem is that V2 now decodes those slots using the wrong schema. If you upgrade again to an implementation with the correct compatible layout, the old values will read correctly again.

The safe V2 change is to preserve the exact existing order and append new storage only at the end:

```solidity
uint256 public totalDeposited;
address public treasury;
uint256 public feeBps;
uint256 public rewardIndex;
```

With that layout:

- slot 0 stays `totalDeposited`
- slot 1 stays `treasury`
- slot 2 stays `feeBps`
- slot 3 becomes the new `rewardIndex`

Because `rewardIndex` is newly appended, slot 3 will initially be zero unless you set it in a reinitializer or another admin function. That is safe. A reinitializer is only needed if V2 requires a nonzero initial reward index or some other migration logic. It is not needed to recover the old data.

What to do next:

1. Deploy a corrected V2 implementation that appends `rewardIndex` instead of inserting it.
2. Upgrade the proxy from the broken V2 implementation to that corrected implementation.
3. Optionally run a reinitializer such as `initializeV2()` only if you need to set `rewardIndex` or perform other one-time migration logic.
4. Before any future upgrade, run a storage-layout compatibility check and reject any change that inserts, deletes, reorders, or changes the type of existing storage variables.

Root cause: an incompatible storage layout change in an upgradeable contract.

Impact: state was not erased, but V2 misread existing proxy storage by one slot, producing exactly the shifted outputs you observed.
