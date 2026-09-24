The suite had 100% line coverage, but it did not have meaningful input coverage.
Both `setDepositFee()` and `deposit()` were executed, and every line in them ran,
but the tests only tried ordinary fee values: `0`, `10`, and `25` bps, plus the
owner/auth path. Those values prove that the formula works for small valid fees;
they do not prove that the stored fee is constrained to a safe range.

The missing class of input was fees at or above the basis-point denominator:
`newFeeBps >= 10_000`.

Because the setter accepts any `uint256`, the owner can set `depositFeeBps` to
`10_000`, `10_001`, or an arbitrarily huge value. At that point deposits either
mint zero shares or revert during subtraction.

For example, with `amount = 1 ether` and `depositFeeBps = 10_000`:

```solidity
fee = (1 ether * 10_000) / 10_000
fee = 1 ether

netAmount = amount - fee
netAmount = 1 ether - 1 ether
netAmount = 0

shares = convertToShares(0)
shares = 0

revert NoSharesMinted();
```

With `depositFeeBps = 10_001`, it is even worse:

```solidity
fee = (1 ether * 10_001) / 10_000
fee = 1.0001 ether

netAmount = amount - fee
netAmount = 1 ether - 1.0001 ether
```

In Solidity 0.8+, that subtraction underflows and reverts before shares are even
computed.

The values `0`, `10`, and `25` could never have found this because they are all
far below the critical boundary. For any positive `amount`, they produce
`fee < amount`, so `netAmount` remains positive and the deposit path keeps
working. They only cover normal examples, not the boundary or invalid range.

The testing technique that would have caught this is property-based fuzz testing
of the fee parameter, ideally with an invariant such as: after any accepted
`setDepositFee(newFeeBps)`, a reasonable positive deposit should not revert
because of the fee setting. A Foundry fuzz test would quickly try values like
`10_000`, `10_001`, or much larger numbers and expose that the setter accepts
fee rates that make every deposit fail. Boundary-value tests around `9_999`,
`10_000`, and `10_001` would also catch the same bug, but fuzzing the owner-retuned
fee is the broader technique that closes the gap.

The fix is to make the contract's intended invariant explicit, for example:

```solidity
if (newFeeBps >= BPS_DENOMINATOR) revert InvalidDepositFee();
```

or, if a 100% fee is intentionally allowed, then the deposit behavior and tests
must explicitly account for the fact that deposits at `10_000` bps mint zero
shares and therefore revert.
