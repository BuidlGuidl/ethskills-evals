# Why 100% line coverage missed the failure

Line coverage says that every line executed at least once. It does not say that a line was exercised over the full input domain, at its boundaries, or in every relevant state. The tests proved that `setDepositFee` stores the few values they chose and that `deposit` works for those values. They did not prove the required property that a configured fee can never make `fee` exceed `amount`.

The missing input class was an out-of-range fee: `newFeeBps > BPS_DENOMINATOR`, meaning a fee above 100%. The setter accepts every `uint256` and has no upper-bound check. All the named fee examples—0, 10, and 25 bps—are far below 10,000 bps; 10,000 itself is only the boundary (a 100% fee), not a value above it. Consequently, none can make the calculated fee greater than the deposit. They can exercise exactly the same source lines as the bad value without exercising the bad arithmetic relation.

A simple counterexample avoids any multiplication-overflow distraction. Let:

```text
newFeeBps = 10,001
amount    = 10,000

fee = (10,000 * 10,001) / 10,000
    = 100,010,000 / 10,000
    = 10,001

netAmount = 10,000 - 10,001
          = -1
```

Because `netAmount` is a `uint256`, Solidity 0.8+ reverts on that subtraction underflow. Thus every deposit of this amount fails. More generally, a sufficiently large deposit at any fee above 10,000 bps makes the rounded-down fee exceed the amount. Extremely large combinations may instead revert even earlier when `amount * depositFeeBps` overflows.

The testing technique that would have found this is **property-based fuzz testing**, ideally as a **stateful invariant test** for this vault. A handler should fuzz owner calls to `setDepositFee(feeBps)` and then fuzz deposits, checking a property such as: every accepted fee configuration is at most 10,000 bps, or every otherwise-valid positive deposit remains executable and never computes `fee > amount`. Unlike example-based tests at 0, 10, and 25, the fuzzer explores boundary and adversarial values, including values just above 10,000.

The contract should enforce the same domain explicitly, for example by reverting in `setDepositFee` when `newFeeBps > BPS_DENOMINATOR`. A focused boundary unit test at 10,000 and 10,001 is also valuable, but fuzzing is the specific technique that discovers the unanticipated input rather than relying on someone to think of that exact example first.
