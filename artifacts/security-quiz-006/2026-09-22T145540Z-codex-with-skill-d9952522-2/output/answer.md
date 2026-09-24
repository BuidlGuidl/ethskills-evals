# Post-mortem: shifted storage after the V2 upgrade

The proxy upgrade succeeded, but the V2 implementation was compiled with a
different storage layout than V1. In a UUPS proxy, the proxy owns the storage
and the implementation code is executed with `delegatecall`. Upgrading the
implementation changes the code that interprets storage; it does not move,
rename, rewrite, or re-pack the existing proxy storage slots.

V1 stored these values:

```solidity
// slot 0
uint256 public totalDeposited; // 2_000_000_000000

// slot 1
address public treasury;       // 0xC0FFEE0000000000000000000000000000000000

// slot 2
uint256 public feeBps;         // 500
```

So the proxy storage was:

```text
slot 0 = 2_000_000_000000
slot 1 = 0x000000000000000000000000C0FFEE0000000000000000000000000000000000
slot 2 = 500
slot 3 = 0
```

V2 inserted a new variable at the front:

```solidity
// slot 0 in V2
uint256 public rewardIndex;

// slot 1 in V2
uint256 public totalDeposited;

// slot 2 in V2
address public treasury;

// slot 3 in V2
uint256 public feeBps;
```

That means every getter is now reading the old value from the slot immediately
before where the intended V2 variable should have been:

```text
rewardIndex()    reads slot 0 -> old totalDeposited = 2_000_000_000000
totalDeposited() reads slot 1 -> old treasury address interpreted as uint256
treasury()       reads slot 2 -> old feeBps, i.e. address(500) = 0x...01F4
feeBps()         reads slot 3 -> previously unused storage = 0
```

Nothing reverts because these are all valid storage reads. Solidity does not
know that the value in slot 1 used to be an address and is now being interpreted
as a `uint256`, or that the value in slot 2 used to be a `uint256` and is now
being truncated to an `address`.

The deposit data is not gone merely because the getters are wrong. The original
`totalDeposited` value is still in proxy storage slot 0. The old `treasury` is
still in slot 1. The old `feeBps` is still in slot 2. The problem is that the
current V2 code is looking at those slots under the wrong names and types.

The important caveat is state-changing calls made after the bad upgrade. Any
write through the broken V2 layout would also write to the shifted slot. For
example, code that updates `rewardIndex` would overwrite slot 0, which is where
the real `totalDeposited` still lives. Code that updates `totalDeposited` would
overwrite slot 1, corrupting the real treasury address. If there were no such
writes, recovery is straightforward. If there were writes, the affected slots
must be reconstructed from events, transaction traces, token balances, or other
accounting records.

The safe V2 layout must preserve every V1 variable at exactly the same slot and
append new state after it:

```solidity
contract StakingV2 is StakingV1 {
    // V1 layout, unchanged:
    // slot 0: uint256 totalDeposited
    // slot 1: address treasury
    // slot 2: uint256 feeBps

    // New V2 state starts only after all existing V1 state:
    // slot 3
    uint256 public rewardIndex;
}
```

Or, written directly:

```solidity
uint256 public totalDeposited;
address public treasury;
uint256 public feeBps;
uint256 public rewardIndex;
```

If `rewardIndex` needs a nonzero starting value, add a V2 reinitializer that
sets only the new slot:

```solidity
function initializeV2(uint256 initialRewardIndex) external reinitializer(2) {
    rewardIndex = initialRewardIndex;
}
```

Do not use the reinitializer to rewrite or "shift back" the existing V1 fields
unless a post-upgrade write has already corrupted them and a deliberate repair
plan has been prepared. The clean fix is to upgrade again to an implementation
whose storage layout matches V1 for slots 0-2 and adds `rewardIndex` at slot 3.

For future upgrades, run a storage-layout compatibility check before deployment
such as the OpenZeppelin upgrades validation. The rule is: append variables
only; never insert, delete, reorder, or change the type of existing storage
variables in an upgradeable contract.
