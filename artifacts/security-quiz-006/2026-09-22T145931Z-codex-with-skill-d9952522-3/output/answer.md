# Post-mortem: V2 storage layout corruption

The upgrade changed the implementation code, but it did not move or rewrite the
proxy's storage. In a UUPS proxy, calls execute V2 code by `delegatecall`, so
V2 reads and writes the proxy's existing storage slots.

V1 used the proxy storage like this:

| Slot | V1 variable | Stored value |
| --- | --- | --- |
| `0` | `totalDeposited` | `2_000_000_000000` |
| `1` | `treasury` | `0xC0FFEE0000000000000000000000000000000000` |
| `2` | `feeBps` | `500` |

V2 inserted a new variable before the old variables:

| Slot | V2 variable |
| --- | --- |
| `0` | `rewardIndex` |
| `1` | `totalDeposited` |
| `2` | `treasury` |
| `3` | `feeBps` |

So every V2 getter is reading the old slot at the same numeric position, but
interpreting it under the new variable name/type:

- `rewardIndex()` reads slot `0`, which still contains the old
  `totalDeposited`, so it returns `2000000000000`.
- `totalDeposited()` reads slot `1`, which still contains the old `treasury`
  address encoded as a 256-bit storage word, so it returns a huge integer whose
  hex representation is the old address value.
- `treasury()` reads slot `2`, which still contains old `feeBps = 500`; as an
  address this is `0x00000000000000000000000000000000000001F4`.
- `feeBps()` reads slot `3`, which V1 never used, so it returns the default
  value `0`.

No call reverts because the EVM has no idea that these slots are "wrong".
Storage slots are just 32-byte words. The ABI getter types tell Solidity how to
decode those words, but the proxy does not enforce any relationship between old
and new source declarations.

The deposit data is not gone. The original values are still in the proxy's
storage:

- old `totalDeposited` is still in slot `0`;
- old `treasury` is still in slot `1`;
- old `feeBps` is still in slot `2`.

They only appear corrupted because V2's layout points the variable names at the
wrong slots.

The safe V2 layout must preserve all existing variables in the same order and
append new storage after them:

```solidity
uint256 public totalDeposited;
address public treasury;
uint256 public feeBps;
uint256 public rewardIndex; // new in V2, appended at slot 3
```

Then upgrade the proxy to this corrected implementation. With that layout, the
old values will read correctly again, because the V2 code will map
`totalDeposited`, `treasury`, and `feeBps` back to slots `0`, `1`, and `2`.
`rewardIndex` will use the previously unused slot `3`.

If `rewardIndex` needs a nonzero initial value, add a V2 reinitializer and call
it atomically during the upgrade, for example with `upgradeToAndCall`:

```solidity
function initializeV2(uint256 initialRewardIndex) external reinitializer(2) {
    rewardIndex = initialRewardIndex;
}
```

If zero is the intended initial value, no reinitializer is required, because
slot `3` already defaults to zero.

Going forward, upgrades must pass a storage-layout compatibility check before
deployment. For upgradeable contracts, existing storage variables cannot be
inserted before, removed, reordered, or type-changed. New state must be appended
or placed into a deliberately reserved storage gap / namespaced storage pattern.
