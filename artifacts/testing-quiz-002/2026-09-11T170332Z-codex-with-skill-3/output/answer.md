# Why 100% coverage missed the deposit outage

Line coverage only shows that each line executed at least once. It does not show that the functions were exercised over their accepted input domain, nor that an important property held for every input. These tests ran the setter and both fee-calculation lines, but only with values the test author already considered reasonable.

The missing class was an out-of-range basis-point value: `newFeeBps > BPS_DENOMINATOR` (greater than 10,000 bps, or 100%). The setter accepts the entire `uint256` domain even though the deposit arithmetic is only meaningful for a fee no greater than the deposited amount. All the selected fee examples—0, 10, and 25 bps—and the value used by the event test were ordinary values below 10,000. They therefore all keep `fee <= amount`; no combination of line coverage and assertions at those values can exercise the subtraction-underflow case. The ownership test varies the caller, not the numeric input, so it cannot find it either.

For example, suppose ops sets the fee to 20,000 bps and a user deposits 1 ether:

```text
fee = (1 ether * 20,000) / 10,000
    = 2 ether

netAmount = 1 ether - 2 ether
```

That subtraction is negative mathematically and therefore reverts with Solidity 0.8 checked arithmetic. Thus the deposit never reaches `convertToShares` or `NoSharesMinted`. (Extremely large combinations can instead revert during `amount * depositFeeBps`, which is another consequence of accepting an unrestricted fee.)

The testing technique that would have found this is **property-based fuzz testing over the setter's whole accepted domain**, supplemented by explicit boundary cases on both sides of the intended limit. A Foundry fuzz test should vary `newFeeBps`, rather than choosing a few examples, and assert the protocol property: either every accepted fee permits a valid positive deposit to proceed, or fees above 10,000 must be rejected by `setDepositFee`. In particular, the suite should test 9,999, 10,000, and 10,001 bps; 10,001 is the first value past the valid boundary and, for an amount of 10,000 units, gives:

```text
fee = (10,000 * 10,001) / 10,000 = 10,001
netAmount = 10,000 - 10,001             // underflow/revert
```

For the valid-domain property, use `bound(feeBps, 0, 10_000)` so the fuzzer explores that domain efficiently. Separately fuzz the unrestricted setter (or explicitly test `10_001` and `type(uint256).max`) and require every value above 10,000 to revert. That test would fail against this implementation and force the missing production guard, such as `if (newFeeBps > BPS_DENOMINATOR) revert InvalidDepositFee();`, before deployment.
