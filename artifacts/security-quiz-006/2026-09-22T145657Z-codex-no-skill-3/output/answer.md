# Post-mortem: V2 storage layout shifted the proxy state

The upgrade succeeded mechanically, but V2 is reading the proxy's existing
storage through a different layout than V1 used.

In a UUPS proxy, the implementation contract code changes, but the persistent
state remains in the proxy's storage. Solidity assigns ordinary state variables
to storage slots based on declaration order. An upgradeable implementation must
therefore keep the old variables in the same slots forever.

V1's layout was:

| Slot | V1 variable | Stored value |
| --- | --- | --- |
| 0 | `totalDeposited` | `2_000_000_000000` |
| 1 | `treasury` | `0xC0FFEE0000000000000000000000000000000000` |
| 2 | `feeBps` | `500` |

V2 declared a new variable before the old variables, so V2 expects this layout:

| Slot | V2 variable |
| --- | --- |
| 0 | `rewardIndex` |
| 1 | `totalDeposited` |
| 2 | `treasury` |
| 3 | `feeBps` |

No storage was rewritten during the upgrade, so the proxy still contains the V1
values in slots 0, 1, and 2. V2 is simply decoding those same slots under the
new names:

| V2 read | Slot read | Actual stored value | Result |
| --- | --- | --- | --- |
| `rewardIndex()` | 0 | old `totalDeposited` | `2000000000000` |
| `totalDeposited()` | 1 | old `treasury` | the treasury address interpreted as a `uint256` |
| `treasury()` | 2 | old `feeBps` | `address(uint160(500))`, i.e. `0x00000000000000000000000000000000000001F4` |
| `feeBps()` | 3 | never used before | `0` |

That is why everything appears shifted by one slot. Nothing needed to revert:
the EVM can read any 32-byte storage slot, and Solidity's generated getters just
interpret the bytes as the requested type.

The deposit data is not gone. The original `totalDeposited` value is still in
proxy storage slot 0. The old treasury is still in slot 1, and the old fee is
still in slot 2. The problem is that the current V2 implementation no longer
maps its variables to those slots.

The safe V2 storage layout must preserve V1's variables in their original
order and append new state after them:

```solidity
uint256 public totalDeposited;  // slot 0, unchanged
address public treasury;        // slot 1, unchanged
uint256 public feeBps;          // slot 2, unchanged
uint256 public rewardIndex;     // slot 3, new in V2
```

Then upgrade the proxy to an implementation compiled with that layout. If
`rewardIndex` needs a nonzero initial value, add a V2 reinitializer such as
`initializeV2(...) reinitializer(2)` and call it during or immediately after the
upgrade. If zero is correct initially, no rewrite is needed; with the corrected
layout `rewardIndex` will read from the previously unused slot 3.

The general rule for UUPS and other delegatecall-based proxies is: never insert,
remove, reorder, or change the storage type of existing variables. Only append
new variables after the existing layout, or use an explicitly reserved storage
gap/namespaced storage pattern designed for upgrades.
