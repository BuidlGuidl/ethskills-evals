# Why 100% coverage missed the deposit shutdown

Line coverage only proves that the suite executed each line. It does not prove that it exercised meaningful boundaries of the input domain or checked the contract's invariants. The tests executed `setDepositFee` with ordinary values and executed every branch they happened to encounter, but never asked whether an arbitrary `uint256` is a valid basis-point fee.

The missing class was out-of-range and boundary inputs: fees at or above 100% (`newFeeBps >= 10_000`), especially values greater than the denominator. The tested fee values 0, 10, and 25 bps are all far inside the valid range. `10_000` appears in the code only as the denominator; merely using that constant in the arithmetic does not test it as a setter input. Thus those values cannot reveal what happens when the setter stores an economically invalid fee.

For example, set the fee to 10,001 bps and deposit 10,000 units:

```text
fee       = (10,000 * 10,001) / 10,000
          = 10,001
netAmount = 10,000 - 10,001
          = -1
```

Because `uint256` cannot represent `-1`, Solidity 0.8+ reverts with an arithmetic-underflow panic. Every deposit amount that produces a fee greater than its amount fails at that subtraction. At exactly 10,000 bps, `fee == amount`, so `netAmount == 0`; `convertToShares(0)` should return zero and the explicit `NoSharesMinted()` check then reverts. Therefore a configuration of 100% or more makes normal deposits unusable, albeit through different revert paths.

Property-based fuzz testing—preferably a stateful invariant test—would have caught this. A handler should let the owner call `setDepositFee` with fuzzed `uint256` values and then attempt fuzzed positive deposits. The relevant invariant is that every accepted fee configuration preserves a valid net amount and deposit liveness, equivalently:

```text
0 <= fee < amount
```

for supported positive deposits. The test would quickly shrink a failure toward the 10,000-bps boundary. It is important not to `bound` the fuzzed fee to the assumed valid range unless the setter itself enforces that range; doing so would encode the bug into the test harness.

The contract should make the domain explicit in `setDepositFee`, normally rejecting `newFeeBps >= BPS_DENOMINATOR` (or enforcing a smaller documented maximum). Then fuzz/property tests should assert both sides of the rule: valid fees remain deposit-live, and invalid fees revert in the setter. Boundary examples at 9,999, 10,000, and 10,001 bps complement the invariant test.
