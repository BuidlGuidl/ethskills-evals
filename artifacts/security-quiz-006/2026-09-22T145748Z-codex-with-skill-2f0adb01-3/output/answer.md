# Post-mortem: V2 storage layout shifted the proxy's state

The upgrade succeeded because the proxy only changed which implementation it
delegates to. It did not migrate, rewrite, or reinterpret storage. In a UUPS
proxy, the implementation code runs by `delegatecall` against the proxy's
storage slots, so the implementation's declared storage layout must keep the
same meaning for every existing slot.

V1 used the proxy storage like this:

| Slot | V1 variable | Stored value |
| --- | --- | --- |
| `0` | `totalDeposited` | `2_000_000_000000` |
| `1` | `treasury` | `0xC0FFEE0000000000000000000000000000000000` |
| `2` | `feeBps` | `500` (`0x01f4`) |
| `3` | unused | `0` |

V2 declared a new variable before the old variables:

| Slot | V2 variable | What is actually in that slot |
| --- | --- | --- |
| `0` | `rewardIndex` | old `totalDeposited` |
| `1` | `totalDeposited` | old `treasury` |
| `2` | `treasury` | old `feeBps` |
| `3` | `feeBps` | unused zero |

That exactly explains the observed reads:

- `rewardIndex()` reads slot `0`, which still contains the old
  `totalDeposited`: `2_000_000_000000`.
- `totalDeposited()` reads slot `1` as a `uint256`. Slot `1` still contains
  the old treasury address, so the returned integer is the numeric value of
  `0xC0FFEE0000000000000000000000000000000000`.
- `treasury()` reads slot `2` as an `address`. Slot `2` still contains
  `feeBps = 500`, so Solidity returns the low 160 bits as
  `0x00000000000000000000000000000000000001F4`.
- `feeBps()` reads slot `3`, which was never used, so it returns `0`.

The deposit data is not inherently gone. The old `totalDeposited` value is
still in proxy storage slot `0`; the bad V2 implementation is simply calling
that slot `rewardIndex`. However, the system is dangerous while running this
implementation. Any V2 function that writes `rewardIndex` will overwrite the
real deposited-total slot, any write to `totalDeposited` will overwrite the
treasury slot, and so on. If no writes have happened through the bad layout,
the data should be recoverable by upgrading again to a layout-compatible
implementation.

The safe V2 must preserve all existing storage slots and append the new state
at the end:

```solidity
contract StakingV2 is StakingV1 {
    uint256 public rewardIndex; // slot 3

    function initializeV2(uint256 initialRewardIndex) external reinitializer(2) {
        rewardIndex = initialRewardIndex;
    }
}
```

Equivalently, the final storage order must be:

```solidity
uint256 public totalDeposited; // slot 0, unchanged
address public treasury;       // slot 1, unchanged
uint256 public feeBps;         // slot 2, unchanged
uint256 public rewardIndex;    // slot 3, new
```

We should upgrade immediately from the bad V2 to this fixed V2 and avoid any
state-changing calls through the bad implementation before doing so. The
reinitializer is only for initializing new V2 state such as `rewardIndex`; it
must not rewrite the existing V1 values. For future upgrades, enforce storage
layout validation in CI with the OpenZeppelin upgrades tooling and treat
inserting, reordering, deleting, or changing existing storage variables as a
failed upgrade review.
