# Why 100% coverage missed the deposit failure

Line coverage only says that each line executed at least once. It does not say that the relevant input domain was explored, that a boundary was crossed, or that the assertions expressed a useful safety property. The tests executed the setter and the fee calculation with values the authors already expected to be valid, so they covered the lines without challenging the unrestricted value accepted by `setDepositFee`.

The missing class of inputs was fee values at and above `BPS_DENOMINATOR`: `depositFeeBps >= 10_000`. The chosen fee examples—0, 10, and 25 bps—are all far below that boundary. The other covered behavior, the event and only-owner check, says nothing about the numerical validity of an owner-supplied fee. No combination of those cases can reveal what happens when the fee is 100% or greater.

At exactly 10,000 bps, for any positive `amount`, for example `amount = 10_000`:

```text
fee       = (10_000 * 10_000) / 10_000 = 10_000
netAmount = 10_000 - 10_000             = 0
shares    = convertToShares(0)           = 0
```

The deposit therefore reverts with `NoSharesMinted()`. Thus setting the fee to exactly 10,000 bps disables every positive deposit even without arithmetic underflow.

The first value above the boundary gives an even more direct failure. With `depositFeeBps = 10_001` and `amount = 10_000`:

```text
fee       = (10_000 * 10_001) / 10_000 = 10_001
netAmount = 10_000 - 10_001             = -1
```

Since Solidity 0.8 checked arithmetic cannot represent `-1` as a `uint256`, the subtraction reverts with an arithmetic underflow panic. Larger unrestricted values can also make `amount * depositFeeBps` overflow before division.

The testing technique that should have caught this is **property-based fuzz testing over the full accepted domain of the owner-settable fee**, with explicit boundary tests at `9_999`, `10_000`, and `10_001`. A useful property is that every fee accepted by the setter must preserve the ability of an otherwise-valid positive deposit to mint shares without an arithmetic panic. Fuzzing `newFeeBps` and a valid deposit amount would quickly shrink a failure to the 10,000/10,001 boundary.

That test should drive the implementation requirement: either reject `newFeeBps >= 10_000` (if deposits must always remain possible), or at minimum reject values above the intended documented maximum. A targeted regression test for 10,000 and 10,001 should then be kept, but the regression alone is not a substitute for fuzzing every owner-controlled numeric parameter that feeds value math.
