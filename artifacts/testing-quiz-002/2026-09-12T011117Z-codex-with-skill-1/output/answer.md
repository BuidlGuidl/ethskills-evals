# Why 100% coverage missed the failure

Line coverage only says that each line executed at least once. It does not say that the line was exercised with values capable of falsifying the intended property. The event and only-owner tests likewise prove emission and authorization, not that an authorized value is safe for the downstream fee calculation.

The missing class of inputs was an owner-supplied fee at or above the basis-point denominator, especially `newFeeBps > 10_000`. The setter accepts the entire `uint256` domain even though the deposit arithmetic only makes economic sense for a fee below 100%.

For example, after:

```solidity
setDepositFee(20_000); // 200%
```

any positive deposit amount is charged more than itself. For `amount = 1`:

```text
fee       = (1 * 20_000) / 10_000 = 2
netAmount = 1 - 2
```

The subtraction underflows and Solidity 0.8+ reverts. Thus the configuration bricks every positive deposit (and sufficiently huge operands could instead revert in the multiplication).

The important boundary cases are distinct:

- `9_999`: below the limit; a positive net amount may remain.
- `10_000`: exactly 100%; `fee == amount`, so `netAmount == 0` and the deposit reaches `NoSharesMinted()`.
- `10_001`: above 100%; for `amount = 10_000`, `fee = 10_001`, so `10_000 - 10_001` underflows.

The hand-picked fees `0`, `10`, and `25` bps are all far below the dangerous boundary, so they can only exercise the normal arithmetic region. If `10_000` is counted as the fourth numeric value shown, it is exactly the boundary, not an above-bound input: it demonstrates the zero-net path but cannot exercise the underflow region. Executing the same lines with these values therefore cannot establish that all setter inputs preserve deposit availability.

The testing technique that would have caught this is **property-based fuzz testing over the full accepted setter domain**, including an operation sequence that first sets the fee and then deposits. A Foundry fuzz test should express the policy explicitly: either every accepted fee must leave deposits operable, or values `>= 10_000` must revert in `setDepositFee`. It should use `bound()` to explore the intended regions and test `9_999`, `10_000`, and `10_001` separately. Since this is a vault and the defect depends on a state-changing configuration followed by a deposit, the same property also belongs in a handler-driven invariant test that fuzzes owner retunes and deposits in sequence.

In short, the suite measured execution, not input-domain coverage. Fuzzing the owner-controlled fee and asserting the deposit-liveness/configuration-bound property would have found the value ops supplied before deployment.
