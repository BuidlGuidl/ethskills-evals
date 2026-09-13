# Why 100% coverage missed the deposit-fee failure

Line coverage only shows that the setter and the arithmetic statements in `deposit()` executed. It does not show that the tests explored the input domain, crossed important numeric boundaries, or asserted the property that a permitted fee configuration must not brick every deposit. The event and only-owner tests add behavioral checks, but they do not constrain the value an authorized owner may store.

The suite never tried a fee at or above `BPS_DENOMINATOR`—a fee of 100% or more. The tested fees, 0, 10, and 25 bps, are all far below 10,000 bps and therefore all exercise the same ordinary region of the formula. The fourth relevant constant, the 10,000-bps denominator itself, is used in the arithmetic but is not a tested setter value. No combination of tests restricted to those sub-boundary values can reveal behavior at the boundary or beyond it.

For example, let ops set:

```text
depositFeeBps = 10_001
amount        = 10_000

fee       = (10_000 * 10_001) / 10_000
          = 10_001
netAmount = 10_000 - 10_001
          = -1
```

Because Solidity 0.8+ checked arithmetic cannot represent `-1` as a `uint256`, the subtraction reverts with an arithmetic-underflow panic. Smaller positive deposits are also unusable. For `1 <= amount < 10_000`:

```text
fee = floor(amount * 10_001 / 10_000) = amount
netAmount = 0
```

Consequently `convertToShares(0)` returns zero and `NoSharesMinted()` reverts. Deposits of at least 10,000 underflow (and sufficiently huge operands may revert even earlier on multiplication overflow), so the configuration bricks all positive deposits. Exactly 10,000 bps is already fatal: `fee == amount`, leaving zero net assets and zero shares.

The test that was missing is a property-based Foundry fuzz test over the full domain accepted by the setter, with usable deposit amounts bounded using `bound()`. Its property should be that every fee value the owner is allowed to configure preserves a successful positive deposit, or, equivalently, that unsupported fees are rejected by `setDepositFee`. The fuzzer would quickly produce 10,000 or 10,001 bps as a counterexample. Explicit boundary cases at `9_999`, `10_000`, and `10_001` should then be retained as regression tests.

The production fix implied by that property is to reject `newFeeBps >= BPS_DENOMINATOR` if deposits must always mint shares (or at minimum reject values above the protocol's documented maximum). Fuzzing is what searches for the unanticipated input; the three boundary regressions preserve the discovered defect.
