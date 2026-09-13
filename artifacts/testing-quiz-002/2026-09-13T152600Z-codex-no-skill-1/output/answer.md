# Why 100% coverage missed the deposit shutdown

Line coverage only proves that the tests executed each line. It does not prove that they exercised the important parts of the input domain. The tests ran the setter and the fee calculation with ordinary values, but never challenged the unstated invariant that a fee in basis points must be strictly less than `BPS_DENOMINATOR`:

```solidity
newFeeBps < 10_000
```

Because `setDepositFee` accepts any `uint256`, the owner can set the fee to 10,000 bps or more. At exactly 10,000 bps, for any positive deposit `amount` (assuming the multiplication itself does not overflow):

```text
depositFeeBps = 10,000
fee           = amount * 10,000 / 10,000
              = amount
netAmount     = amount - fee
              = 0
shares        = convertToShares(0)
              = 0
```

`deposit()` therefore reverts with `NoSharesMinted()` for every positive deposit.

Above the boundary, subtraction can fail even earlier. For example:

```text
amount         = 10,000
depositFeeBps  = 10,001
fee            = 10,000 * 10,001 / 10,000
               = 10,001
netAmount      = 10,000 - 10,001
               = -1
```

Since `uint256` cannot represent `-1`, Solidity's checked arithmetic reverts on the subtraction.

The missing input class was boundary and out-of-range fee values: `newFeeBps >= 10_000` (and, more broadly, arbitrary `uint256` values). Tests at 0, 10, and 25 bps are all clustered safely below the critical boundary; `10_000` appearing as the denominator does not test it as a setter input. Those values can execute every line while revealing nothing about behavior at or beyond 100%.

Stateful fuzz/property testing would have caught this. A handler can let the fuzzer call `setDepositFee` with arbitrary `uint256` values and then attempt a valid positive deposit, checking the invariant that an accepted configuration cannot disable all deposits. The fuzzer would quickly shrink a failure to the boundary value `10_000`. A direct boundary-value test at `9_999`, `10_000`, and `10_001` would also expose it, but the property test is stronger because it searches the whole setter domain and detects the missing validation assumption.

The contract should enforce that assumption in the setter—for example, revert when `newFeeBps >= BPS_DENOMINATOR`—and the tests should assert both the bound and the deposit-liveness property.
