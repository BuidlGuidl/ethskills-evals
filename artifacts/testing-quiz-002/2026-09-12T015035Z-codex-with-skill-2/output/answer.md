# Why 100% coverage missed the failure

Line coverage only proves that each line executed at least once. It does not prove that the lines were exercised over the full input domain, or that the tested assertions expressed the vault's required safety and liveness properties. The setter test merely showed that an ordinary value can be stored, its event is emitted, and callers are restricted; it did not show that every value the owner is allowed to store is safe for `deposit()`.

The missing input class was a fee at or above the denominator: `newFeeBps >= 10_000` (and, more generally, arbitrary large `uint256` values accepted by the unbounded setter). All of the ordinary fee fixtures—0, 10, 25 bps, and any similarly small configured/default value—are strictly below that boundary. For them,

```text
floor(amount * feeBps / 10_000) < amount
```

for positive practical amounts, so they cannot exercise either the zero-net or greater-than-amount cases. Running those cases can cover exactly the same source lines as the bad input while producing completely different arithmetic.

For example, let ops set `depositFeeBps = 10_001` and deposit `amount = 10_000`:

```text
fee       = (10_000 * 10_001) / 10_000
          = 100_010_000 / 10_000
          = 10_001

netAmount = 10_000 - 10_001
```

The subtraction underflows and Solidity reverts with arithmetic panic `0x11`. Deposits below 10,000 units do not rescue the vault: with this fee they round to `fee == amount`, producing `netAmount == 0`, and then `NoSharesMinted()`. At exactly 10,000 bps every positive deposit likewise has `fee == amount` and mints no shares. Therefore a live-deposit configuration must be strictly below 10,000 bps, not merely at most 10,000.

The testing technique that would have found this is **property-based fuzz testing over the setter's entire accepted domain**, with explicit boundary coverage. A Foundry fuzz test should vary `newFeeBps` rather than choosing a few examples, and assert the intended property: every accepted fee permits a valid positive deposit, while every unsafe fee is rejected by `setDepositFee`. Inputs should be generated with `bound()` and must include both sides of the boundary—9,999, 10,000, and 10,001—as well as very large values that can overflow `amount * depositFeeBps`.

That test would immediately falsify the current contract at 10,000 or 10,001 bps. The corresponding contract invariant is that every stored fee satisfies `depositFeeBps < BPS_DENOMINATOR`; the setter should enforce that invariant with a revert. Coverage could remain 100% before and after this test—the new evidence is the searched input domain and the property, not a higher coverage percentage.
