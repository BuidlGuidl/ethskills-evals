# Post-mortem: V2 storage layout shifted the proxy state

This was a storage layout incompatibility, not a proxy admin or implementation
address problem.

With a UUPS proxy, calls execute V2's code by `delegatecall`, but the storage
being read and written is still the proxy's storage. The implementation contract
does not bring fresh storage with it. Solidity assigns storage slots according
to the declaration order, so changing that order changes what each getter reads.

V1 stored the proxy state like this:

| Slot | V1 variable | Stored value |
| --- | --- | --- |
| `0` | `totalDeposited` | `2_000_000_000000` |
| `1` | `treasury` | `0xC0FFEE0000000000000000000000000000000000` |
| `2` | `feeBps` | `500` / `0x1f4` |

V2 declared the variables like this:

| Slot | V2 variable | What is actually in that slot |
| --- | --- | --- |
| `0` | `rewardIndex` | old `totalDeposited` |
| `1` | `totalDeposited` | old `treasury` |
| `2` | `treasury` | old `feeBps` |
| `3` | `feeBps` | never written, so zero |

That exactly explains the observed reads:

- `rewardIndex()` returns `2000000000000` because V2 reads slot `0`, which was
  V1's `totalDeposited`.
- `totalDeposited()` returns a huge integer whose hex representation is the old
  treasury address because V2 reads slot `1` as a `uint256`.
- `treasury()` returns `0x00000000000000000000000000000000000001F4`
  because V2 reads slot `2` as an address. Slot `2` contains `500`, and
  `500 == 0x1f4`.
- `feeBps()` returns `0` because V2 reads slot `3`, which V1 never used.

The deposit data is not gone merely because the upgrade happened. The old
`totalDeposited` value is still in proxy storage slot `0`. The old treasury is
still in slot `1`, and the old fee is still in slot `2`. The problem is that
the current implementation is interpreting those slots under the wrong layout.

However, the situation becomes dangerous as soon as V2 writes through this bad
layout. For example, setting `rewardIndex` would overwrite slot `0`, which is
where the real historical `totalDeposited` value lives. Updating
`totalDeposited` would overwrite slot `1`, where the real treasury address
lives.

The safe V2 layout must preserve every existing variable at the exact same
slot, then append new variables after them:

```solidity
uint256 public totalDeposited; // slot 0, unchanged
address public treasury;       // slot 1, unchanged
uint256 public feeBps;         // slot 2, unchanged

uint256 public rewardIndex;    // slot 3, new in V2
```

Then upgrade the proxy to this corrected implementation. With that layout,
existing reads return the original values and `rewardIndex` starts at zero in
slot `3`.

If `rewardIndex` needs a non-zero initial value, add a V2 reinitializer and call
it during the upgrade, for example via `upgradeToAndCall`. The reinitializer
must only initialize new V2 state; it must not rewrite the V1 variables unless
there is an intentional migration.

Going forward, upgrades should be checked with storage layout validation, such
as the OpenZeppelin upgrades tooling, and tested against a fork or fixture that
contains real V1 proxy storage. The rule is simple: never insert, remove,
rename-with-type-change, or reorder existing upgradeable contract state
variables. Only append new state, or consume reserved `__gap` slots if the
contract was designed with a storage gap.
