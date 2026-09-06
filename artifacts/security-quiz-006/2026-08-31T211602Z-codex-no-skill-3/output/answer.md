The upgrade succeeded at the proxy level, but the storage layout became incompatible.

In a UUPS proxy, the proxy keeps all state and the implementation only supplies code. That means the implementation must keep the exact same storage layout for all existing variables. Solidity assigns storage slots by declaration order for these simple types.

V1 used:

- slot `0`: `totalDeposited`
- slot `1`: `treasury`
- slot `2`: `feeBps`

Before the upgrade, those slots held:

- slot `0` = `2_000_000_000000`
- slot `1` = `0xC0FFEE0000000000000000000000000000000000`
- slot `2` = `500` = `0x1f4`

V2 changed the order to:

- slot `0`: `rewardIndex`
- slot `1`: `totalDeposited`
- slot `2`: `treasury`
- slot `3`: `feeBps`

So after the upgrade, V2 reads the old proxy storage like this:

- `rewardIndex()` reads slot `0`, so it returns the old `totalDeposited` value: `2000000000000`
- `totalDeposited()` reads slot `1`, so it returns the old `treasury` address interpreted as a `uint256`
- `treasury()` reads slot `2`, so it returns the old `feeBps` value `500`, interpreted as an address: `0x00000000000000000000000000000000000001F4`
- `feeBps()` reads slot `3`, which was never written in V1, so it returns `0`

That is why every value appears shifted by one slot and why no call reverts. The code is valid, but it is decoding the existing storage with a different layout.

Your deposit data is not gone. The proxy storage still contains the original values in the original slots. The problem is that V2 now looks at the wrong slots. If you deploy a corrected implementation with a compatible layout, the original values will read correctly again.

The safe V2 layout is to append new state, never insert it before existing state. V2 should keep all inherited/existing variables in the same order and add `rewardIndex` after them:

```solidity
uint256 public totalDeposited;
address public treasury;
uint256 public feeBps;
uint256 public rewardIndex;
```

That produces:

- slot `0`: `totalDeposited`
- slot `1`: `treasury`
- slot `2`: `feeBps`
- slot `3`: `rewardIndex`

Then the old data remains mapped correctly, and `rewardIndex` uses a fresh slot. Since slot `3` is currently unused, it will default to `0` unless you set it in a reinitializer or by some admin/configuration function.

If `rewardIndex` needs a nonzero initial value in V2, add a guarded migration step such as a `reinitializer(2)` or another one-time admin-only setter and initialize only the new variable. Do not rewrite the old slots.

The core lesson is: for upgradeable contracts, storage layout is part of the public ABI of the implementation. Reordering, inserting, or removing state variables in the middle corrupts how the proxy interprets existing storage, even when the upgrade transaction itself succeeds.
