# Why 100% coverage missed the failure

Line coverage only shows that every line ran at least once. It says nothing about whether the tests explored the meaningful parts of `newFeeBps`'s input domain. The existing tests executed the assignment, event emission, and deposit calculation only with ordinary low fees. They therefore covered the implementation while never challenging the unstated invariant that a fee must be less than 100%.

The missing class of inputs was the boundary and out-of-range fee configurations:

- `newFeeBps == 10_000`, meaning exactly 100%; and
- `newFeeBps > 10_000`, meaning more than 100% (as well as extreme values that can overflow the multiplication).

For example, set the fee to `10_000` bps and deposit `1_000_000` token units:

```text
fee      = (1_000_000 * 10_000) / 10_000
         = 1_000_000

netAmount = 1_000_000 - 1_000_000
          = 0

shares    = convertToShares(0)
          = 0
```

The deposit then reverts with `NoSharesMinted()`. This happens for every positive deposit at exactly 10,000 bps. Above the boundary, the arithmetic is invalid even more directly. At `10_001` bps with an amount of `10_000` units:

```text
fee       = (10_000 * 10_001) / 10_000
          = 10_001

netAmount = 10_000 - 10_001
```

That subtraction underflows and reverts under Solidity 0.8 checked arithmetic. For some small amounts integer truncation may instead make the fee equal the amount, but the result is still zero net assets and hence no shares. Very large fee inputs can also make `amount * depositFeeBps` overflow before division.

The tested values `0`, `10`, and `25` bps are all far inside the valid-looking range and are only 0%, 0.10%, and 0.25%. For any normal deposit they leave a positive `netAmount`, so they cannot reach either the 100% zero-net boundary or the greater-than-100% underflow region. Tests for the event and `onlyOwner` exercise who may update the value and what is emitted, not whether the value is safe.

The testing technique that would have caught this is **property-based fuzz testing**, preferably as a stateful invariant test for the sequence `owner sets fee -> user deposits`. A Foundry fuzz/invariant test should generate `newFeeBps` across its full declared `uint256` domain and assert a liveness property such as: after every accepted fee update, a valid positive deposit can mint shares without reverting. Foundry would shrink a failing case toward the critical `10_000`-bps boundary (subject to the chosen deposit and rounding).

That test also forces the contract's intended policy to become explicit. The setter should reject configurations that violate it—for example, require `newFeeBps < BPS_DENOMINATOR` if every positive deposit must retain some gross amount—and the fuzz test should assert both sides of that boundary. Explicit boundary unit tests at `9_999`, `10_000`, and `10_001` bps are useful regression tests, but fuzzing the setter-to-deposit property is what explores the input class the example-based suite failed to imagine.
