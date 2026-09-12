# Why 100% coverage missed the deposit shutdown

Line coverage only shows that each statement executed at least once. It does not show that the statements were exercised over the full input domain, nor that the contract preserves a useful property for every accepted configuration. The tests ran the setter and both lines of the fee calculation with ordinary fees, so they could reach 100% coverage while never challenging the missing bound on `newFeeBps`.

The untested class was out-of-range owner-controlled configuration: values at or above the denominator (`newFeeBps >= 10_000`), as well as extreme `uint256` values that can make the multiplication overflow. A basis-point fee must be constrained to a declared range—normally strictly below `10_000` if every positive deposit is expected to remain viable—but the setter accepts the entire `uint256` domain.

For example, ops can set the fee to `10_001` bps. For a deposit of `10_000` units:

```text
fee       = floor(10_000 * 10_001 / 10_000)
          = 10_001
netAmount = 10_000 - 10_001
          = -1
```

Because Solidity 0.8 checked arithmetic cannot represent `-1` as a `uint256`, the subtraction reverts. Smaller positive deposits do not rescue the vault. For example, with `amount = 1`:

```text
fee       = floor(1 * 10_001 / 10_000) = 1
netAmount = 1 - 1 = 0
shares    = convertToShares(0) = 0
```

That deposit reaches `NoSharesMinted()` instead. At exactly `10_000` bps, the fee equals the deposit for every amount, so every deposit likewise has zero net amount and mints no shares. Thus `10_000` and `10_001` expose distinct boundary failures.

The hand-picked fee cases `0`, `10`, and `25` bps could never reveal this because all are far below the denominator. For every positive `amount`, their calculated fee is less than `amount` (subject to ordinary rounding), so `amount - fee` cannot underflow and the fee alone cannot reduce the net amount to zero. Repeating those examples, or merely asserting that the setter stored its input and emitted an event, exercises the same lines without searching the dangerous part of the accepted domain. The `10_000` denominator is a constant in the arithmetic, not evidence that the suite tested the boundary.

The testing technique that would have caught this is a **Foundry fuzz test over the full accepted domain of the owner-settable fee**, asserting a behavioral property rather than mirroring storage. After setting an arbitrary fee, a funded and approved actor's valid positive deposit should remain possible, or—if the intended API rejects invalid fees—the setter must revert outside the documented range. Use `bound()` to explore the relevant ranges and explicitly test both sides of the boundary: `9_999`, `10_000`, and `10_001`. A fuzzed property such as “every successfully accepted fee configuration permits a representative positive deposit” would produce `10_000` or a larger value as a counterexample. It would also reveal that very large accepted fees can overflow `amount * depositFeeBps` before division.

The corresponding contract rule should be explicit in `setDepositFee`, for example `newFeeBps < BPS_DENOMINATOR` when deposits must always retain a positive pre-conversion amount. Coverage can confirm that the validation line ran; fuzzing the boundary and the property confirms that the validation is meaningful.
