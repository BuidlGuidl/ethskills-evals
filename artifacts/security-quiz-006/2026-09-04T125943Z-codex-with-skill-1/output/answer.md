This is a storage layout break, not a proxy routing failure.

In a UUPS proxy, the proxy keeps all state and the implementation only provides code. After the upgrade, calls are still delegated into V2 correctly, so nothing reverts. The problem is that V2 changed the meaning of the proxy's storage slots by inserting a new variable at the front of the layout.

V1 layout was:

- slot 0: `totalDeposited`
- slot 1: `treasury`
- slot 2: `feeBps`

Those slots held:

- slot 0: `2_000_000_000000`
- slot 1: `0xC0FFEE0000000000000000000000000000000000`
- slot 2: `500` = `0x01f4`

V2 layout became:

- slot 0: `rewardIndex`
- slot 1: `totalDeposited`
- slot 2: `treasury`
- slot 3: `feeBps`

Because the upgrade did not rewrite storage, the old bytes are still sitting in slots 0, 1, and 2. V2 now reads those same slots under new names:

- `rewardIndex()` reads slot 0, so it returns the old `totalDeposited` value: `2_000_000_000000`
- `totalDeposited()` reads slot 1, so it returns the 32-byte word containing the old `treasury` address, interpreted as a `uint256`
- `treasury()` reads slot 2, so it returns the old `feeBps` value `500` as an address: `0x...01F4`
- `feeBps()` reads slot 3, which was never written, so it returns `0`

That is why every value appears shifted by one slot. The implementation is live, but its storage layout is incompatible with the existing proxy state.

Your deposit data is not gone. It was not erased by the upgrade. The old `totalDeposited` value is still present in proxy storage slot 0; V2 is just interpreting slot 0 as `rewardIndex` instead of `totalDeposited`. The same is true for `treasury` and `feeBps`: their bytes still exist, but V2 is reading the wrong slots for each field.

The safe V2 change is to preserve all existing variables in exactly the same order and append the new one after them:

```solidity
uint256 public totalDeposited;
address public treasury;
uint256 public feeBps;
uint256 public rewardIndex;
```

That keeps slots 0, 1, and 2 unchanged and places `rewardIndex` in slot 3, which is the first unused slot. This is the core rule for upgradeable storage: never insert, delete, reorder, or change the type of existing state variables; only append new ones.

Operationally, the fix is:

1. Deploy a corrected V2 implementation with the original V1 fields unchanged and `rewardIndex` appended.
2. Upgrade the proxy to that corrected implementation.
3. If `rewardIndex` must start nonzero, add a `reinitializer` or explicit admin setter to initialize only that new variable after the upgrade.
4. Before future upgrades, run a storage layout compatibility check using the upgrade framework tooling.

If `rewardIndex` is allowed to start at `0`, no reinitializer is required. The important part is the storage layout correction. Once the proxy points to the corrected implementation, the old `totalDeposited`, `treasury`, and `feeBps` values will read correctly again because the code will once again map them to slots 0, 1, and 2.
