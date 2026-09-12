# Why 100% coverage missed the deposit failure

Line coverage only shows that each statement executed at least once. It does not show that the suite explored the input domain, exercised boundary values, or proved a useful property. Here, the setter test showed that an ordinary value can be stored and its event emitted, while the deposit tests showed that the arithmetic works for a few ordinary fees. None of those tests constrained what an owner is allowed to store.

The missing input class was a fee above 100%: `newFeeBps > BPS_DENOMINATOR`, or greater than 10,000 bps. The values 0, 10, 25, and 10,000 are all at or below the denominator. For all of them, `fee <= amount`, so they cannot expose the invalid-fee behavior. Executing the same lines with more in-range examples would not help.

For example, let the owner set `depositFeeBps = 10_001` and let a user deposit `amount = 10_000` units:

```text
fee      = (10_000 * 10_001) / 10_000
         = 10_001
netAmount = 10_000 - 10_001
```

The subtraction underflows and reverts under Solidity 0.8 checked arithmetic. Smaller positive deposits can instead round to a fee equal to the entire amount; then `netAmount` is zero and `NoSharesMinted()` reverts. Thus an out-of-range fee can make every deposit fail even though `setDepositFee` behaves exactly as written.

The testing technique that would have found this is a **property-based fuzz test** over the full accepted domain of the owner-settable fee, including boundary values on both sides of 10,000. The test should express a property such as: after any accepted fee update, the calculated fee must not exceed the deposit amount and a valid positive deposit must remain possible. With the current unrestricted setter, Foundry would quickly generate a value above 10,000 and shrink the failure toward the boundary, such as 10,001.

The corresponding contract rule should be `newFeeBps <= BPS_DENOMINATOR`, normally enforced by reverting in the setter. Tests should explicitly cover 10,000 as the limit and 10,001 as the first rejected value. A fuzz test for the intended accepted range should use `bound()`; a separate fuzz test should verify that values above the limit revert. This searches the relevant domain, whereas 100% line coverage merely records that the lines ran.
