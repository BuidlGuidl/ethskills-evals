The upgrade succeeded at the proxy level but broke the storage layout at the
implementation level.

In a UUPS proxy, the proxy keeps the storage and the implementation only
provides code. That means state is not keyed by variable name. It is keyed by
storage slot number, assigned from the declaration order.

V1 layout was:

- slot 0: `totalDeposited`
- slot 1: `treasury`
- slot 2: `feeBps`

Before the upgrade, those slots held:

- slot 0: `2_000_000_000000`
- slot 1: `0xC0FFEE0000000000000000000000000000000000`
- slot 2: `500` (`0x01f4`)

V2 changed the declaration order to:

- slot 0: `rewardIndex`
- slot 1: `totalDeposited`
- slot 2: `treasury`
- slot 3: `feeBps`

After that upgrade, the proxy storage did not move, but the V2 code started
interpreting the old slots using the new layout:

- `rewardIndex()` reads slot 0, so it returns the old `totalDeposited` value
  `2_000_000_000000`
- `totalDeposited()` reads slot 1, so it returns the old `treasury` value,
  which appears as a huge integer whose hex form is that address
- `treasury()` reads slot 2, so it returns the old `feeBps` value, i.e.
  `0x...01F4`
- `feeBps()` reads slot 3, which was never written in V1, so it returns `0`

That is why every value appears shifted by one slot and why nothing reverts.
The EVM is reading valid storage words; they are just being decoded under the
wrong schema.

Your deposit data is not gone. The old `totalDeposited` value is still present
in proxy storage slot 0. The problem is that V2 no longer reads slot 0 as
`totalDeposited`; it reads it as `rewardIndex`. Likewise, the treasury and fee
data are still present in slots 1 and 2. This is a layout corruption issue, not
a data wipe.

The safe fix is to preserve the existing variable order exactly and only append
new state variables at the end. V2 should therefore declare:

```solidity
uint256 public totalDeposited;
address public treasury;
uint256 public feeBps;
uint256 public rewardIndex;
```

That yields:

- slot 0: `totalDeposited` unchanged
- slot 1: `treasury` unchanged
- slot 2: `feeBps` unchanged
- slot 3: `rewardIndex` new

Then `rewardIndex` can be initialized separately if needed, for example through
a `reinitializer` or another authorized setter, depending on the protocol’s
upgrade flow. The key requirement is that the new variable must be appended, not
inserted before existing ones.

So the post-mortem is:

1. The proxy upgrade itself worked.
2. The implementation introduced an incompatible storage layout by prepending
   `rewardIndex`.
3. All reads shifted because Solidity maps state variables to slots by order,
   not by name.
4. Existing funds/accounting data is still in storage, but V2 is decoding the
   wrong slots.
5. A safe V2 keeps the V1 fields in the same order and adds `rewardIndex` only
   after them.

Operationally, the remediation is to deploy a corrected implementation and
upgrade the proxy again to that implementation. If the corrected V2 restores the
original field order and appends `rewardIndex`, the old values will line up
again automatically without migrating storage.
