# Post-mortem: V2 storage layout corruption

The upgrade succeeded mechanically, but V2 is reading the proxy's existing
storage with a different layout than V1 used.

In a UUPS proxy, the proxy owns the storage. Calls are delegated to the
implementation, so the implementation code reads and writes the proxy's storage
slots. Upgrading from V1 to V2 changes the code, but it does not move, clear, or
rewrite the proxy's existing storage.

V1 used these slots:

```text
slot 0: totalDeposited = 2_000_000_000000
slot 1: treasury       = 0xC0FFEE0000000000000000000000000000000000
slot 2: feeBps         = 500
```

V2 declared a new variable before the old variables:

```text
slot 0: rewardIndex
slot 1: totalDeposited
slot 2: treasury
slot 3: feeBps
```

That means every V2 getter is reading the old value from the slot now assigned
to that name:

```text
rewardIndex() reads slot 0 -> old totalDeposited -> 2_000_000_000000

totalDeposited() reads slot 1 -> old treasury address interpreted as uint256

treasury() reads slot 2 -> old feeBps value, 500 decimal = 0x01f4,
                           interpreted as address

feeBps() reads slot 3 -> previously unused slot, so zero
```

This is why nothing reverts. The ABI types are still valid enough to decode:
`uint256` can represent an address-sized value, and an `address` is decoded from
the low 20 bytes of the 32-byte word in slot 2. The contract is not failing at
runtime; it is faithfully reading the wrong storage slots.

The deposit data is not gone. The old `totalDeposited` value is still in proxy
storage slot 0. It is just now being exposed by V2 as `rewardIndex`. Likewise,
the old treasury is still in slot 1, and the old fee is still in slot 2. The
danger is that any V2 function that writes to `rewardIndex`, `totalDeposited`,
`treasury`, or `feeBps` will write to those shifted slots and can overwrite the
old data. If no state-changing V2 calls have written those slots yet, the data
should still be recoverable by deploying a corrected implementation.

The safe V2 layout must preserve the exact V1 storage prefix and only append new
state after it:

```solidity
contract StakingV2 is StakingV1 {
    uint256 public rewardIndex; // slot 3
}
```

or, equivalently:

```solidity
uint256 public totalDeposited; // slot 0, unchanged
address public treasury;       // slot 1, unchanged
uint256 public feeBps;         // slot 2, unchanged
uint256 public rewardIndex;    // slot 3, new
```

Then upgrade the proxy to that corrected implementation. If `rewardIndex` needs
an initial value, add a V2 reinitializer that only initializes the new appended
slot:

```solidity
function initializeV2(uint256 initialRewardIndex) external reinitializer(2) {
    rewardIndex = initialRewardIndex;
}
```

Do not use the reinitializer to rewrite the old V1 fields unless a separate
forensic check proves they were already overwritten. The main fix is storage
layout compatibility: never insert, delete, reorder, or change the type of
existing storage variables in an upgradeable contract. New variables go at the
end, and the layout should be checked with the OpenZeppelin upgrades storage
layout validation tooling before deploying the upgrade.
