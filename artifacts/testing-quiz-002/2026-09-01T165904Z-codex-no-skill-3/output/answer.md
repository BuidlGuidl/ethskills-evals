# Why 100% coverage missed the deposit failure

Line coverage shows that each line executed at least once; it does not show that a line was exercised with every meaningful class of input. The tests executed the setter and deposit calculation only with small, valid-looking fees. They therefore proved a few examples, not the property the vault needs: after every accepted fee update, an otherwise valid deposit must still succeed.

The missing class was boundary and out-of-range fee values, especially values at or above `BPS_DENOMINATOR`. Because `setDepositFee` accepts any `uint256`, it also accepts fees of 100% or more. The tested fee values—0, 10, and 25 bps (and any comparable in-range value used by the event test)—are all strictly below 10,000 bps. For every positive `amount`, they produce `fee < amount`, so they cannot reach either the zero-net-amount boundary or the subtraction underflow beyond it. Repeating those examples can increase execution counts, but cannot explore a different input partition.

For example, let ops set `depositFeeBps = 10_001` and let a user deposit `amount = 10_000` base units:

```text
fee = (10_000 * 10_001) / 10_000
    = 100_010_000 / 10_000
    = 10_001

netAmount = 10_000 - 10_001
```

Solidity 0.8 checked arithmetic reverts on that subtraction because the result would be `-1`. Thus every positive deposit reverts: for any positive `amount`, a fee above 10,000 bps is at least `amount` after integer division in many cases, and at 10,001 bps specifically it exceeds `amount` whenever `amount >= 10,000`. Smaller amounts can round to exactly `amount`, leaving zero and ultimately triggering `NoSharesMinted()` instead. At exactly 10,000 bps the arithmetic is:

```text
fee = amount
netAmount = 0
shares = convertToShares(0) = 0
```

so `NoSharesMinted()` bricks every positive deposit even without an underflow.

The testing technique that would have caught this is property-based fuzz testing, with explicit boundary-value cases. A fuzz/property test should choose arbitrary fee values and assert that every fee accepted by `setDepositFee` preserves successful deposits, or, more directly, assert the intended setter invariant such as `newFeeBps < 10_000`. The critical generated or table-driven cases are `9_999`, `10_000`, and `10_001`; the latter two immediately falsify the liveness property. The production setter should enforce the same bound and revert on an invalid fee.

Coverage answers *which code ran*. This incident depended on *which data ran through it*, which line coverage does not measure.
