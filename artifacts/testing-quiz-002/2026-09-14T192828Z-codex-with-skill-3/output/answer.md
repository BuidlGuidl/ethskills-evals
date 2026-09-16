# Why 100% coverage missed the fee failure

Line coverage only says that the setter assignment, event emission, and deposit arithmetic were executed. It does not say that the suite explored the values the setter accepts or proved a property such as “after any permitted fee update, a positive deposit can mint shares.” The event test is especially weak evidence here: it can prove that the contract reports the value it stored while saying nothing about whether that value is safe to use.

The missing input class was boundary and out-of-range values for the owner-controlled fee. `setDepositFee` accepts the entire `uint256` domain, even though a basis-point fee must be strictly below `10_000` if every positive deposit is to remain usable. The selected examples `0`, `10`, and `25` bps are all small values on the same safe side of that boundary. Access-control testing varies the caller, not the numeric input. `10_000` appearing as `BPS_DENOMINATOR` also provides no coverage of the setter boundary unless the test actually sets the fee to that value and attempts a deposit. Thus those examples can cover every line without exercising the dangerous configuration.

At exactly 10,000 bps, for any positive `amount` (assuming the multiplication itself does not overflow):

```text
fee       = amount * 10_000 / 10_000 = amount
netAmount = amount - amount          = 0
shares    = convertToShares(0)        = 0
```

The deposit then reverts with `NoSharesMinted()`. This setting therefore disables all deposits.

The first value beyond the percentage boundary also demonstrates the unchecked configuration with an arithmetic failure. For `newFeeBps = 10_001` and `amount = 10_000` units:

```text
fee       = 10_000 * 10_001 / 10_000 = 10_001
netAmount = 10_000 - 10_001           = -1
```

Because Solidity uses unsigned integers, that subtraction underflows and reverts. Still larger inputs can also make `amount * depositFeeBps` overflow before the division.

The testing technique that would have found this is **property-based fuzz testing over the setter's full accepted input domain**, with explicit boundary classification. A Foundry fuzz test should vary `newFeeBps`, call the setter, and then exercise `deposit`, asserting the intended liveness/property rather than merely asserting that the stored value equals the input. It should explicitly cover the nearest usable value (`9_999`), the exact limit (`10_000`), and the first value beyond it (`10_001`). Foundry would shrink a failing fuzz case to a useful counterexample near this boundary.

The contract should define the intended domain too—for example, have the setter revert when `newFeeBps >= 10_000` if a 100% fee must never disable deposits. Then the fuzz property can assert both sides: values below the bound remain depositable, while values at or above it are rejected. A targeted regression test for `10_000`/`10_001` should be retained, but that test confirms this known bug; fuzzing is the technique that searches for the unanticipated value before operations finds it.
