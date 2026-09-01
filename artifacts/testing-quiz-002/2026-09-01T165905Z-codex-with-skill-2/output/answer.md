# Why 100% coverage missed the deposit failure

Line coverage only proves that every line executed at least once. It does not prove that a line was exercised across the relevant input domain, at its boundaries, or in dangerous state combinations. The suite executed the assignment in `setDepositFee` and the arithmetic in `deposit`, but only with ordinary fee values. Thus it verified examples of the implementation rather than the safety property that the configured fee must never make deposits unusable.

The missing input class was an out-of-range fee: `newFeeBps >= BPS_DENOMINATOR`, especially a value greater than `10_000` (more than 100%). The setter accepts the entire `uint256` domain and has no check such as:

```solidity
if (newFeeBps >= BPS_DENOMINATOR) revert InvalidDepositFee();
```

(Whether exactly `10_000` should be allowed is a protocol decision, but it makes every positive deposit's net amount zero and therefore is incompatible with a live deposit function.)

For example, let ops set `depositFeeBps = 10_001` and let a user deposit `amount = 10_000` token base units:

```text
fee      = (10_000 * 10_001) / 10_000
         = 10_001

netAmount = 10_000 - 10_001
          = -1
```

`uint256` cannot represent `-1`, so Solidity 0.8 checked arithmetic reverts on the subtraction. At exactly `10_000` bps, the arithmetic instead gives `fee = amount` and `netAmount = 0`; `convertToShares(0)` returns zero and `NoSharesMinted()` reverts. Very large fee inputs can also make `amount * depositFeeBps` overflow before division.

The tested fee inputs `0`, `10`, and `25` bps are all far below the 10,000-bps boundary, so for normal amounts they necessarily produce `fee <= amount`. They cannot reach either the zero-net boundary or the fee-greater-than-amount underflow. `10_000` appearing as `BPS_DENOMINATOR` is a constant in the calculation, not evidence that it was supplied to the setter and followed by a deposit. Event and access-control tests likewise cover behavior, not hostile numeric values; any ordinary fourth fixture used by those tests has the same limitation.

The testing technique that would have caught this is **property-based fuzz testing**, ideally as a stateful invariant test because an admin state change breaks a later user action. A handler should fuzz owner calls to `setDepositFee(feeBps)` and then deposits, while checking a liveness/safety property such as: every accepted fee configuration permits a valid positive deposit to mint shares. An unbounded `uint256 feeBps` fuzz input would find values above `10_000` almost immediately and produce a reproducible counterexample. Alternatively, if the intended domain is explicitly bounded to valid fees, a fuzz test should first verify that every value outside that domain reverts in the setter, then fuzz deposits for every accepted value.

The contract fix implied by that property is to validate `newFeeBps` in the setter. If deposits must always remain possible, require `newFeeBps < 10_000`; if a 100% fee is intentionally supported, require `newFeeBps <= 10_000` and define deposit behavior for a zero net amount explicitly.
