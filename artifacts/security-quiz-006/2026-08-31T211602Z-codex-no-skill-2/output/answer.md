# Post-mortem: why the values shifted after the UUPS upgrade

This is classic **storage layout corruption from inserting a new state variable at the front of an upgradeable contract**.

In a proxy pattern, the proxy holds the storage and the implementation only provides code. After the upgrade, the proxy kept the old storage exactly as it was. What changed is that V2 interprets those existing storage slots using a different layout.

## 1. What V1 stored

V1 declared:

```solidity
uint256 public totalDeposited; // slot 0
address public treasury;       // slot 1
uint256 public feeBps;         // slot 2
```

So the proxy storage before the upgrade was:

- `slot 0` = `2_000_000_000000`
- `slot 1` = `0xC0FFEE0000000000000000000000000000000000`
- `slot 2` = `500` (`0x01f4`)

## 2. What V2 expects

V2 declared:

```solidity
uint256 public rewardIndex;    // slot 0
uint256 public totalDeposited; // slot 1
address public treasury;       // slot 2
uint256 public feeBps;         // slot 3
```

That means V2 now reads the proxy storage as:

- `rewardIndex()` reads `slot 0`
- `totalDeposited()` reads `slot 1`
- `treasury()` reads `slot 2`
- `feeBps()` reads `slot 3`

But the proxy storage still contains the old V1 values in slots `0`, `1`, and `2`.

## 3. Why each returned value looks exactly like this

Slot-by-slot:

### `rewardIndex() -> 2000000000000`

`rewardIndex` now reads **slot 0**, which still contains V1 `totalDeposited`.

So:

```text
rewardIndex = old totalDeposited = 2_000_000_000000
```

That is why it looks like a real value even though you never set `rewardIndex`.

### `totalDeposited() -> old treasury address as a huge number`

`totalDeposited` in V2 now reads **slot 1**, which still contains the V1 `treasury` address.

An `address` is just a 20-byte value stored in a 32-byte slot, so when V2 reads that slot as `uint256`, it returns the numeric form of the old address.

### `treasury() -> 0x00000000000000000000000000000000000001F4`

`treasury` in V2 now reads **slot 2**, which still contains V1 `feeBps = 500`.

`500` in hex is `0x01f4`, so when interpreted as an address it becomes:

```text
0x00000000000000000000000000000000000001F4
```

### `feeBps() -> 0`

`feeBps` in V2 now reads **slot 3**.

V1 never had a variable in slot 3, and your upgrade did not write anything there, so that slot is still the default zero value.

## 4. Is the deposit data gone?

No. The data is almost certainly **not gone**. It is still in proxy storage where V1 left it:

- old `totalDeposited` is still in `slot 0`
- old `treasury` is still in `slot 1`
- old `feeBps` is still in `slot 2`

The problem is not deletion. The problem is that V2 uses the wrong map from variable names to slots.

If you upgrade again to an implementation with the correct storage layout, the original values should read correctly again, assuming no V2 logic has since written bad data into those slots.

## 5. Why calls still succeed

Nothing about this mistake necessarily causes a revert.

The proxy is healthy, the implementation address is valid, and the getters are reading existing storage slots. Solidity has no runtime check that says "this slot used to belong to a different variable." So the contract keeps running, but with semantically wrong values.

## 6. What must change to make V2 safe

For upgradeable contracts, **never reorder existing state variables and never insert new ones before old ones**. Append new variables only at the end.

Safe V2:

```solidity
contract StakingV2 is StakingV1 {
    uint256 public rewardIndex; // appended after all V1 storage
}
```

Or, if written inline, keep the exact original order first:

```solidity
uint256 public totalDeposited; // slot 0
address public treasury;       // slot 1
uint256 public feeBps;         // slot 2
uint256 public rewardIndex;    // slot 3
```

Then `rewardIndex` occupies the new free slot instead of shifting the old variables.

## 7. Do you need a reinitializer?

Only if V2 needs to set an initial value for `rewardIndex` or initialize other new state.

For example:

```solidity
function initializeV2(uint256 initialRewardIndex) external reinitializer(2) {
    rewardIndex = initialRewardIndex;
}
```

But the reinitializer is **not** what fixes this bug. The critical fix is preserving storage order. The reinitializer is only for assigning values to newly added state after the layout is correct.

## 8. Recovery path

The safe recovery is:

1. Deploy a corrected V2 implementation whose storage layout preserves the V1 ordering and appends `rewardIndex` at the end.
2. Upgrade the proxy to that corrected implementation.
3. If needed, call a `reinitializer(2)` to set `rewardIndex`.
4. Verify that no V2 write operations already corrupted slots `0`, `1`, or `2`.

That last check matters. If the broken V2 executed mutating functions that wrote to `rewardIndex`, `totalDeposited`, `treasury`, or `feeBps`, those writes may have overwritten live V1 data. If only reads happened, then the original data should still be intact.

## Conclusion

The values are shifted because V2 changed the storage layout from:

```text
slot 0 = totalDeposited
slot 1 = treasury
slot 2 = feeBps
```

to:

```text
slot 0 = rewardIndex
slot 1 = totalDeposited
slot 2 = treasury
slot 3 = feeBps
```

The proxy storage did not move; only the interpretation changed. Your deposit data is not inherently lost. The safe fix is to deploy a corrected V2 that keeps all V1 variables in the exact same order and adds `rewardIndex` only at the end, optionally with a `reinitializer(2)` if `rewardIndex` needs initialization.
