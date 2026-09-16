# Why 100% coverage missed the deposit shutdown

Line coverage only proves that the tests executed each line. It does not prove that they exercised the relevant input domain or checked the contract's invariants. The tests called `setDepositFee`, observed its event and access control, and ran `deposit` with ordinary fees, so every line was covered while the dangerous state remained unexplored.

The missing input class was an out-of-range fee at or above the basis-point denominator. The setter accepts every `uint256`; it does not enforce the implicit requirement that `depositFeeBps < 10_000` (or, depending on the intended policy, some lower configured maximum).

For example, let:

```text
newFeeBps = 10_001
amount    = 1 ether = 1,000,000,000,000,000,000

fee = amount * 10,001 / 10,000
    = 1,000,100,000,000,000,000

netAmount = amount - fee
          = 1,000,000,000,000,000,000
            - 1,000,100,000,000,000,000
          = -100,000,000,000,000
```

A `uint256` cannot represent that result, so Solidity 0.8+ reverts on the subtraction underflow. At the exact boundary `newFeeBps = 10_000`, `fee == amount`, `netAmount == 0`, and `convertToShares(0)` produces zero, causing `NoSharesMinted()`. Thus both the boundary and values beyond it can disable deposits.

The tested values `0`, `10`, and `25` bps are all tiny interior points in the valid range. For each one, `fee < amount` and `netAmount > 0` for normal test amounts. The event and only-owner tests exercise control flow, not the numerical boundary, so none of those four checks could reveal the missing range validation.

Property-based fuzz testing would have caught this. Fuzz `newFeeBps` across its `uint256` domain and assert a state invariant such as “every accepted fee configuration permits a representative positive deposit” or, more directly, “an accepted fee must satisfy `fee <= amount` and leave a positive net amount.” The fuzzer would quickly shrink a failure to the boundary around `10_000`. Boundary-value tests using `9_999`, `10_000`, and `10_001` would also expose it immediately.

The setter should reject invalid configurations, for example by reverting unless `newFeeBps < BPS_DENOMINATOR` (and tests should encode that rule as a fuzzed property). If a 100% fee is intentionally valid, then the deposit behavior and invariant must instead explicitly account for zero-net deposits; it cannot promise that deposits remain mintable at that setting.
