The suite got 100% line coverage, but it only covered execution, not the input domain.
Both `setDepositFee()` and `deposit()` were run, but the tests only used harmless fee
values. They proved that the stored value is used in the fee formula for a few normal
cases; they did not prove that every value the owner can store leaves the vault usable.

The missing class of input was boundary and out-of-range basis-point values:
`newFeeBps >= BPS_DENOMINATOR`, especially exactly `10_000` bps. Since the setter does
not cap or reject the value, the owner can configure a 100% fee or worse.

The tested values could never find this because `0`, `10`, and `25` bps are all far
below `10_000`. For any positive deposit amount, those values leave a positive
`netAmount`:

```solidity
fee = (amount * feeBps) / 10_000;
netAmount = amount - fee;
```

With `feeBps < 10_000`, `fee < amount` for normal deposited amounts, so
`netAmount > 0` and shares can be minted. Those examples exercise the same lines, but
not the dangerous edge of the math.

The breaking input is `newFeeBps = 10_000`:

```text
amount = 100 ether
depositFeeBps = 10_000
BPS_DENOMINATOR = 10_000

fee       = (100 ether * 10_000) / 10_000
          = 100 ether
netAmount = 100 ether - 100 ether
          = 0
shares    = convertToShares(0)
          = 0
```

Then `deposit()` hits:

```solidity
if (shares == 0) revert NoSharesMinted();
```

So every deposit reverts. If `newFeeBps > 10_000`, the situation is even worse:
the fee can exceed the amount and `amount - fee` can underflow in Solidity 0.8.

The testing technique that would have caught this is property-based fuzz testing of
the setter/deposit interaction, with `newFeeBps` fuzzed across its full `uint256`
domain or at least around the `10_000` bps boundary. A good property would be either:

```text
valid positive deposits should remain possible after any accepted fee setting
```

or, more directly:

```text
setDepositFee must reject any fee that makes netAmount zero or negative
```

Foundry would shrink a failing case to the boundary value `10_000`, revealing that
the admin parameter needs a constraint such as `newFeeBps < BPS_DENOMINATOR` or a
stricter product-level maximum fee cap.
