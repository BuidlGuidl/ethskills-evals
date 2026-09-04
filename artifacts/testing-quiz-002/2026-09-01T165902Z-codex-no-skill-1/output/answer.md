# Why 100% coverage missed the deposit-fee bug

Line coverage only proves that the tests executed each line. It does not prove that they exercised the relevant parts of the input domain or checked the contract's invariants. Every tested fee—0, 10, and 25 bps—was a normal value well inside the valid range, so each test followed the same successful arithmetic path. The event and `onlyOwner` tests establish who may set the value and what is emitted; they do not establish that the value is safe.

The missing class of inputs was the boundary and out-of-range fee values: `newFeeBps >= BPS_DENOMINATOR`. The intended invariant is therefore something like:

```solidity
newFeeBps < BPS_DENOMINATOR
```

and the setter should reject any value outside that range. A fee of exactly 10,000 bps is 100%, so it leaves a zero net deposit and reaches `NoSharesMinted()`. A fee above 10,000 bps can make `fee` exceed `amount`, causing Solidity's checked subtraction to underflow before conversion.

For example, set the fee to 10,001 bps and deposit 10,000 units:

```text
fee       = (10,000 * 10,001) / 10,000
          = 10,001
netAmount = 10,000 - 10,001
          = -1
```

`uint256` cannot represent `-1`, so `amount - fee` reverts with an arithmetic underflow. At exactly 10,000 bps the arithmetic is:

```text
fee       = (amount * 10,000) / 10,000 = amount
netAmount = amount - amount = 0
```

and, assuming the ordinary conversion of zero assets to zero shares, `NoSharesMinted()` reverts. Thus the boundary itself already bricks deposits, while values above it introduce an underflow region. The denominator value `10_000` appearing in the formula does not test that boundary as a setter input; and 0, 10, and 25 are all too far below it to reveal the missing range check. Executing the same lines with several nearby valid examples adds coverage counts, not domain coverage.

The testing technique that would have caught this is invariant/property-based fuzz testing, ideally combined with explicit boundary-value tests. Generate `newFeeBps` across the full `uint256` input domain and assert the policy property: accepted fees must be below 10,000 bps, while `setDepositFee(10_000)` and `setDepositFee(10_001)` must revert. Alternatively, if the setter is intentionally allowed to accept every value, fuzzing the stateful sequence `setDepositFee(fee) -> deposit(amount)` under the property “an accepted configuration permits a valid positive deposit” immediately produces a counterexample at the boundary.

A direct fix and regression test would be:

```solidity
function setDepositFee(uint256 newFeeBps) external onlyOwner {
    if (newFeeBps >= BPS_DENOMINATOR) revert InvalidDepositFee();
    uint256 previousFeeBps = depositFeeBps;
    depositFeeBps = newFeeBps;
    emit DepositFeeUpdated(previousFeeBps, newFeeBps);
}
```

Then fuzz `newFeeBps` and assert that values below 10,000 are accepted and values at or above 10,000 revert, with explicit tests at 9,999, 10,000, and 10,001. Those boundary cases test the invariant that line coverage cannot measure.
