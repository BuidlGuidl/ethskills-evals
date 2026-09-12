# Why 100% coverage missed the failure

Line coverage only shows that each statement executed at least once. It does not show that the statements were exercised with inputs from every relevant equivalence class or at their boundaries. The tests executed `setDepositFee` and the fee calculation, but only on the happy-path side of the basis-point boundary.

The missing input class was an invalid or economically nonsensical fee: `newFeeBps >= BPS_DENOMINATOR` (10,000 bps, i.e. 100%), especially a value greater than 10,000. The setter accepts such a value because it has no upper-bound check.

At exactly 10,000 bps, the fee consumes the entire deposit. For example, with `amount = 10_000`:

```text
fee      = (10_000 * 10_000) / 10_000 = 10_000
netAmount = 10_000 - 10_000            = 0
shares    = convertToShares(0)          = 0
```

The deposit then reverts with `NoSharesMinted()`.

Above the boundary, checked subtraction can fail even earlier. With `newFeeBps = 10_001` and `amount = 10_000`:

```text
fee = (10_000 * 10_001) / 10_000 = 10_001
netAmount = 10_000 - 10_001       = -1
```

Because `uint256` cannot represent `-1`, Solidity 0.8+ reverts with an arithmetic-underflow panic. Thus a stored fee at or above 100% makes ordinary positive deposits yield no shares or underflow.

The tested values `0`, `10`, and `25` bps (and the constant `10_000`) cannot expose this behavior: all configured test fees are far below the critical boundary, so `fee < amount` for the representative deposits and `netAmount` stays positive. Event and access-control assertions add no coverage of the fee's valid range.

The testing technique that would have caught this is **boundary-value analysis combined with negative testing**: test the values immediately around the maximum meaningful fee—`9_999`, `10_000`, and `10_001` bps—and specify what the setter must do. A property-based/fuzz test is an especially effective implementation. It can assert either that:

- `setDepositFee` rejects every `newFeeBps >= 10_000` (or `> 10_000` if a 100% fee is intentionally allowed), or
- after every accepted fee update, a valid positive deposit cannot underflow and must mint positive shares under the vault's stated conditions.

The production fix implied by that property is to validate `newFeeBps` in the setter, normally requiring `newFeeBps < BPS_DENOMINATOR` when deposits are required to remain possible.
