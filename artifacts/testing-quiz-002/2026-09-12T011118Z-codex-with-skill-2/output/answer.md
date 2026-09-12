# Why 100% coverage missed the deposit-fee failure

Line coverage only says that each line executed at least once. It does not say that the lines were exercised over the full input domain, at their boundaries, or with assertions capable of detecting every bad behavior. The tests executed the setter and the deposit calculation with expected, hand-picked values, so they covered the lines while leaving almost the entire `uint256` domain of `newFeeBps` unexplored.

The missing class of inputs was fees at or above the basis-point denominator, especially values greater than `10_000` bps. The setter accepts any `uint256`; it does not enforce the economic precondition that a deposit fee must be less than `100%` (or whatever lower maximum the protocol intends).

For example, let:

```text
newFeeBps = 10_001
amount    = 10_000

fee       = (10_000 * 10_001) / 10_000
          = 10_001

netAmount = 10_000 - 10_001
          = -1
```

Because `uint256` cannot represent `-1`, Solidity 0.8+ reverts on the subtraction with an arithmetic-underflow panic. Thus this deposit cannot reach `convertToShares` at all. Larger out-of-range fee settings similarly make the calculated fee exceed the deposit for ordinary amounts (and sufficiently large operands can also make `amount * depositFeeBps` overflow).

The exact boundary is independently bad:

```text
newFeeBps = 10_000
fee       = amount
netAmount = 0
shares    = convertToShares(0) = 0
```

That path reverts with `NoSharesMinted`. The nearest values should therefore be tested separately: `9_999`, `10_000`, and `10_001` bps. They represent a below-boundary fee, a 100% fee producing zero net assets, and an above-boundary fee producing underflow, respectively.

The 0, 10, and 25 bps examples could never expose this because all are far below `10_000`; for them, `fee <= amount`, so the subtraction remains valid and the deposit retains a positive net amount (subject to ordinary rounding). The event test only proves that the supplied value is emitted/stored, and the only-owner test only proves who may call the setter. Neither constrains which values the owner may store. If “four values” refers to those three nominal fee cases plus the value used by the event test, the conclusion is the same: a finite set of expected in-range examples does not search the accepted `uint256` domain.

The testing technique that would have caught this is **property-based fuzz testing of the owner-settable fee across its entire accepted domain**, combined with explicit boundary tests. A Foundry fuzz test should generate `newFeeBps`, have the owner set it, and assert the intended property: every accepted fee permits a valid nonzero deposit to mint shares, or else an out-of-range fee must be rejected by `setDepositFee`. Use `bound()` to exercise the intended regions and test below, exactly at, and above the limit separately rather than filtering inconvenient inputs away with broad `vm.assume()` calls.

Such a fuzz test would quickly shrink a failure to the `10_000`/`10_001` boundary. The corresponding production rule should be enforced in the setter—for example, reject `newFeeBps >= BPS_DENOMINATOR` if deposits must always retain a positive net amount. One regression test at `10_001` would confirm this known defect, but the fuzz property is what searches for boundary values nobody thought to hand-pick in the first place.
