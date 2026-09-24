# Post-mortem: V2 shifted the proxy storage layout

The upgrade succeeded because the proxy can delegatecall into the new V2
implementation, and the V2 code is valid. The problem is that the V2 source is
interpreting the proxy's existing storage slots with a different layout than V1
used.

In a UUPS proxy, the persistent state lives in the proxy contract's storage, not
in the implementation contract. Upgrading changes the code that runs, but it
does not move, rewrite, or reinterpret the existing storage. Solidity assigns
state variables to storage slots according to declaration order, so changing
that order changes what each getter reads.

V1 used the proxy storage like this:

| Slot | V1 variable | Stored value |
| --- | --- | --- |
| `0` | `totalDeposited` | `2_000_000_000000` |
| `1` | `treasury` | `0xC0FFEE0000000000000000000000000000000000` |
| `2` | `feeBps` | `500` |

V2 declares a new variable at the front:

| Slot | V2 variable |
| --- | --- |
| `0` | `rewardIndex` |
| `1` | `totalDeposited` |
| `2` | `treasury` |
| `3` | `feeBps` |

So V2 now reads the old V1 data through the wrong names:

- `rewardIndex()` reads slot `0`, which still contains the old
  `totalDeposited` value: `2_000_000_000000`.
- `totalDeposited()` reads slot `1`, which still contains the old `treasury`
  address. Since `totalDeposited` is a `uint256`, the address bytes are printed
  as a huge integer.
- `treasury()` reads slot `2`, which still contains the old `feeBps` value
  `500`, which is `0x1f4`. As an address, that becomes
  `0x00000000000000000000000000000000000001F4`.
- `feeBps()` reads slot `3`, which V1 never used, so it is still zero.

The deposit data is not gone. The original `totalDeposited` value is still in
proxy storage slot `0`; V2 is just calling that slot `rewardIndex`. The old
treasury and fee values are also still present in slots `1` and `2`. What is
broken is the storage layout compatibility between the old implementation and
the new one.

The safe V2 layout must preserve all existing V1 variables in exactly the same
order, type, and slot, then append new state after them:

```solidity
contract StakingV2 is StakingV1 {
    uint256 public rewardIndex; // slot 3, appended after V1 state
}
```

Equivalently, if writing the declarations directly, V2 must be:

```solidity
uint256 public totalDeposited; // slot 0, unchanged
address public treasury;       // slot 1, unchanged
uint256 public feeBps;         // slot 2, unchanged
uint256 public rewardIndex;    // slot 3, new
```

Because `rewardIndex` is new and the current upgrade added no re-initializer,
slot `3` will initially be zero. If V2 needs a nonzero starting reward index,
add a versioned re-initializer such as `reinitializer(2)` and call it during the
upgrade with `upgradeToAndCall`. That initializer must only initialize the new
V2 state; it must not rewrite the existing V1 values unless that is an explicit
migration.

In short: the upgrade inserted a variable before existing state. For upgradeable
contracts, new variables must be appended, not prepended or inserted, and
storage layout checks should be part of the upgrade process before deploying to
mainnet.
