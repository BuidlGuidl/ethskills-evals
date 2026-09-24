# Post-mortem: V2 storage layout shifted the proxy state

This is a storage-layout compatibility bug, not a proxy-admin or implementation-address bug.

In a UUPS proxy, the proxy owns the storage. Calls are `delegatecall`ed into the implementation, so the implementation code decides which storage slot each variable name means, but the data itself remains in the proxy's slots.

V1 laid out storage like this:

| Slot | V1 variable | Stored value |
| --- | --- | --- |
| `0` | `totalDeposited` | `2_000_000_000000` = `2000000000000` |
| `1` | `treasury` | `0xC0FFEE0000000000000000000000000000000000` |
| `2` | `feeBps` | `500` = `0x1f4` |

V2 inserted `rewardIndex` before the existing variables, so the compiler now interprets the same proxy storage like this:

| Slot | V2 variable | What it reads |
| --- | --- | --- |
| `0` | `rewardIndex` | the old `totalDeposited` value, `2000000000000` |
| `1` | `totalDeposited` | the old `treasury` address, interpreted as a `uint256` |
| `2` | `treasury` | the old `feeBps` value, interpreted as an address: `0x00000000000000000000000000000000000001F4` |
| `3` | `feeBps` | zero, because V1 never used this slot |

That exactly explains all four observed reads:

- `rewardIndex()` returns `2000000000000` because it now reads slot `0`, where V1 stored `totalDeposited`.
- `totalDeposited()` returns a huge number because it now reads slot `1`, where V1 stored the treasury address. As a `uint256`, that address is just a large integer.
- `treasury()` returns `0x...01F4` because it now reads slot `2`, where V1 stored `feeBps = 500 = 0x1f4`.
- `feeBps()` returns `0` because it now reads slot `3`, which was unused.

The deposit data is not gone from the upgrade itself. The original `totalDeposited` value is still in proxy storage slot `0`; V2 is simply calling that slot `rewardIndex`. Likewise, the old treasury and fee values are still in slots `1` and `2`.

The important caveat is that any writes performed after upgrading to the bad V2 would write using the bad V2 layout. For example, a V2 function that updates `totalDeposited` would write slot `1`, corrupting the old treasury slot. But based on the stated facts, the upgrade itself did not erase or migrate the V1 storage.

The safe V2 must preserve all existing slots exactly and append new state only after them:

```solidity
contract StakingV2 is StakingV1 {
    uint256 public rewardIndex;
}
```

or equivalently, if written in one contract:

```solidity
uint256 public totalDeposited;
address public treasury;
uint256 public feeBps;
uint256 public rewardIndex;
```

Then the layout becomes:

| Slot | Safe V2 variable |
| --- | --- |
| `0` | `totalDeposited` |
| `1` | `treasury` |
| `2` | `feeBps` |
| `3` | `rewardIndex` |

If `rewardIndex` should start at zero, no initializer is needed for that variable. If it needs a nonzero initial value, add a V2 reinitializer that only initializes the newly appended variable, and perform the upgrade with `upgradeToAndCall`:

```solidity
function initializeV2(uint256 initialRewardIndex) external reinitializer(2) {
    rewardIndex = initialRewardIndex;
}
```

Do not reorder, insert before, remove, or change the type of existing storage variables in any future implementation. Before upgrading, run a storage-layout compatibility check, for example with OpenZeppelin Upgrades or another tool that compares the old and new layouts.

Recovery path: deploy a corrected V2 implementation with the original V1 variables in the original order and `rewardIndex` appended after `feeBps`, then upgrade the proxy to that corrected implementation. If no post-upgrade writes corrupted the old slots, the original reads should come back immediately.
