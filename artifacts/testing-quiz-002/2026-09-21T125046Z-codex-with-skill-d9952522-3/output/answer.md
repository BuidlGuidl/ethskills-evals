The suite got 100% line coverage but it did not test the property that matters:
`depositFeeBps` must stay in a semantically valid range. Coverage only says the
setter line and the deposit fee line executed. It does not say the tests searched
the input domain of `newFeeBps`, or that they tried values that make the stored
configuration unusable.

The missing class of input is boundary and out-of-range fees: values at or above
`BPS_DENOMINATOR`, especially `10_000` bps and `10_001` bps. The hand-picked fee
cases `0`, `10`, and `25` bps are all tiny valid interior points. They prove the
formula works for ordinary fees, but they can never reveal that the owner can set
a fee that consumes the entire deposit, or more than the entire deposit. The
event and only-owner tests also cannot find this, because they only prove who can
write the value and that the emitted log matches the write; they do not constrain
which values are safe to write.

For example, if ops sets:

```solidity
depositFeeBps = 10_000;
```

then for any positive `amount`:

```text
fee       = (amount * 10_000) / 10_000 = amount
netAmount = amount - fee               = 0
shares    = convertToShares(0)          = 0
```

so `deposit()` reverts with `NoSharesMinted()`.

If the value is even one basis point higher, the arithmetic can break earlier.
For `amount = 10_000` and `depositFeeBps = 10_001`:

```text
fee       = (10_000 * 10_001) / 10_000 = 10_001
netAmount = 10_000 - 10_001
```

In Solidity 0.8+, that subtraction underflows and reverts. For smaller positive
amounts, integer division may round the fee down to exactly `amount`, producing
`netAmount = 0` and the same `NoSharesMinted()` failure. Either way, deposits are
bricked.

The testing technique that would have caught this is a fuzz/property test over
the owner-settable fee parameter, plus explicit boundary cases around the
denominator. The property should be something like: after any accepted
`setDepositFee(newFeeBps)`, a normal positive deposit in the supported amount
range should either succeed and mint shares, or the setter should have rejected
that fee as invalid. A fuzzer ranging across `newFeeBps` would quickly try
`10_000`, `10_001`, or larger values and produce a counterexample. A focused
boundary test should also classify `9_999`, `10_000`, and `10_001` separately,
because they fail or behave differently.
