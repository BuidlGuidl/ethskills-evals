# Why 100% coverage missed the failure

Line coverage only proves that every line ran at least once. It does not prove that a line was exercised over the full input domain, or that the contract's invariants still hold after every permitted state change.

The tests tried only small, valid-looking fee values: 0, 10, and 25 bps. All are far below `BPS_DENOMINATOR`, so they cannot make `fee` greater than or equal to `amount`. Testing the event and access control adds no coverage of the fee's numeric range. Thus, all of those tests execute the same setter assignment and deposit arithmetic while never probing the critical boundary at 10,000 bps.

The missing class of inputs was out-of-range fees: `newFeeBps >= 10_000` (and, at still larger values, inputs that can also overflow `amount * depositFeeBps`). The setter accepts the entire `uint256` domain even though deposit arithmetic implicitly requires a fee below 100% if deposits are to mint shares.

For example, set the fee to 10,001 bps and deposit 10,000 units:

```text
fee      = (10,000 * 10,001) / 10,000
         = 100,010,000 / 10,000
         = 10,001

netAmount = 10,000 - 10,001
```

In Solidity 0.8+, that subtraction underflows and reverts. For deposits smaller than 10,000 units, integer truncation generally makes the fee equal to the whole amount, leaving `netAmount == 0`; `convertToShares(0)` then returns zero and `NoSharesMinted()` reverts. At exactly 10,000 bps, every positive deposit likewise has a 100% fee, a zero net amount, and mints no shares. Consequently, a fee at or above the denominator can stop all deposits even though the setter behaves exactly as written.

Property-based fuzz testing of the state transition `setDepositFee(fee)` followed by `deposit(amount)` would have caught this. The property could state that every accepted fee configuration intended for operation must permit a representative positive deposit to mint shares, or more directly that an accepted fee must satisfy `fee < BPS_DENOMINATOR`. A fuzzer would quickly produce 10,000, 10,001, or a much larger value as a counterexample. Boundary-value tests at 9,999, 10,000, and 10,001 bps would deterministically expose the same defect.

The corresponding contract invariant should be enforced in the setter, for example by reverting unless `newFeeBps < BPS_DENOMINATOR` (or `<=` only if deliberately allowing a configuration that disables deposits). Coverage measures which code ran; fuzz/property and boundary testing check whether it remains correct across its input space.
