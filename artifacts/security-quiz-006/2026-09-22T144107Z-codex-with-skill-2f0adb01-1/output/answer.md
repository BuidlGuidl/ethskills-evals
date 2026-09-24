# Post-mortem: V2 storage layout shifted

This was not an admin/proxy-address problem and it was not caused by a revert.
It was a storage layout incompatibility introduced by the V2 implementation.

In a UUPS proxy, the proxy keeps the storage and delegates calls to the current
implementation. The implementation's variable declarations tell Solidity which
storage slots to read and write, but upgrading the implementation does not move
or rewrite the proxy's existing storage.

V1 used the proxy storage like this:

```text
slot 0: totalDeposited = 2_000_000_000000
slot 1: treasury       = 0xC0FFEE0000000000000000000000000000000000
slot 2: feeBps         = 500
```

V2 was declared like this:

```solidity
uint256 public rewardIndex;     // slot 0
uint256 public totalDeposited;  // slot 1
address public treasury;        // slot 2
uint256 public feeBps;          // slot 3
```

So after the upgrade, V2 reads the same old storage slots under new names:

```text
rewardIndex() reads slot 0
  -> old totalDeposited
  -> 2_000_000_000000

totalDeposited() reads slot 1
  -> old treasury address, interpreted as a uint256
  -> the huge number whose hex form is the old treasury address

treasury() reads slot 2
  -> old feeBps value, interpreted as an address
  -> address(uint160(500))
  -> 0x00000000000000000000000000000000000001F4

feeBps() reads slot 3
  -> no V1 value was ever stored there
  -> 0
```

That exactly matches the observed reads.

The deposit data is not inherently gone. The original `totalDeposited` value is
still in proxy storage slot 0. The bad V2 simply calls slot 0 `rewardIndex`.
Likewise, the old treasury and fee values are still in slots 1 and 2.

However, this is only true as long as no V2 function has overwritten those slots.
Any write to `rewardIndex` in the bad V2 would overwrite the old
`totalDeposited`; any write to `totalDeposited` would overwrite the old
`treasury`; any write to `treasury` would overwrite the old `feeBps`. The first
operational response should be to pause or otherwise stop state-changing calls
until the layout is fixed.

The safe V2 layout must preserve every existing V1 variable in the same order
and append new state only after the old layout:

```solidity
uint256 public totalDeposited;  // slot 0, unchanged
address public treasury;        // slot 1, unchanged
uint256 public feeBps;          // slot 2, unchanged
uint256 public rewardIndex;     // slot 3, new in V2
```

Then deploy a corrected V2 implementation and upgrade the proxy to it. With that
layout, the existing slots will decode correctly again:

```text
totalDeposited() -> slot 0 -> 2_000_000_000000
treasury()       -> slot 1 -> 0xC0FFEE0000000000000000000000000000000000
feeBps()         -> slot 2 -> 500
rewardIndex()    -> slot 3 -> 0, unless initialized
```

If `rewardIndex` needs a nonzero initial value, add a V2 reinitializer such as
`initializeV2(...) external reinitializer(2)` that writes only the new appended
slot. Do not use it to redeclare, reorder, or rewrite the existing V1 fields.

Going forward, every upgrade should include an automated storage layout check
before deployment. The invariant is simple: for upgradeable contracts, never
insert, delete, or reorder existing storage variables. Only append new variables,
or reserve storage gaps in earlier versions and consume those gaps deliberately.
