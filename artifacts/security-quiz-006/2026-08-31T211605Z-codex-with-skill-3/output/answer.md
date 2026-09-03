The upgrade broke the proxy's **storage layout**, not its code path.

With a UUPS proxy, the implementation executes with `delegatecall`, so all state is read from and written to the **proxy's existing storage slots**. That means the order of state variables in the implementation is part of the contract's externalized storage schema. In V1, the proxy had:

- slot 0: `totalDeposited = 2_000_000_000000`
- slot 1: `treasury = 0xC0FFEE0000000000000000000000000000000000`
- slot 2: `feeBps = 500`

V2 changed the declaration order to:

- slot 0: `rewardIndex`
- slot 1: `totalDeposited`
- slot 2: `treasury`
- slot 3: `feeBps`

No storage was rewritten during the upgrade, so those old V1 values are still sitting in slots 0, 1, and 2. V2 now interprets them through a different layout:

1. `rewardIndex()` reads slot 0, so it returns the old `totalDeposited`: `2_000_000_000000`.
2. `totalDeposited()` reads slot 1, so it returns the 32-byte word containing the old `treasury` address. When printed in hex, it matches that address because that is exactly what is stored there.
3. `treasury()` reads slot 2, so it interprets the old `feeBps = 500` as an address. `500` decimal is `0x01f4`, which becomes `0x00000000000000000000000000000000000001F4`.
4. `feeBps()` reads slot 3, which was never used in V1, so it returns the default zero value.

That is why every value appears shifted by one slot and why nothing reverts. The bytecode is valid, the proxy is valid, and the implementation is valid. The logic is just reading the wrong storage words.

Your deposit data is **not gone**. The old `totalDeposited` is still in proxy slot 0. The old treasury is still in slot 1. The old fee is still in slot 2. The failure is interpretation, not erasure. As long as no V2 write path has overwritten those slots with new semantic meanings, the original data still exists onchain in the proxy storage.

The safe fix is to deploy a corrected V2 (or V3) whose storage layout preserves all existing variables in exactly the same order as V1 and only appends the new variable at the end:

```solidity
uint256 public totalDeposited;
address public treasury;
uint256 public feeBps;
uint256 public rewardIndex;
```

If you need initialization for the new field, add a `reinitializer` that only sets `rewardIndex` and leaves the existing slots untouched. For example, set `rewardIndex` in a new upgrade step after upgrading to the corrected implementation.

The rule for upgradeable contracts is strict: **never reorder, insert before existing fields, change types, or delete storage variables**. Only append new variables at the end, or use reserved storage gaps if the inheritance pattern requires them. That is the change required to make the V2 upgrade safe while still adding `rewardIndex`.

One practical caution: if the broken V2 has already executed any state-changing function that writes to `rewardIndex`, `totalDeposited`, `treasury`, or `feeBps`, then it may already have overwritten one or more legacy slots with misaligned meanings. In that case the data is no longer merely "shifted"; some of it may have been mutated and recovery becomes a slot-by-slot forensic exercise from chain history. But from the symptoms you gave, the read pattern is exactly what we expect from a one-slot insertion at the top of storage.
