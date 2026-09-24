The suite got 100% line coverage but not meaningful input coverage. It proved that
`setDepositFee` can store a few ordinary fee values and that `deposit` uses the
stored value on the happy path. It did not test the boundary where the fee stops
being a fee and becomes all, or more than all, of the deposit.

The missing class of input is invalid or out-of-range fee basis points:
`newFeeBps >= BPS_DENOMINATOR`, i.e. `>= 10_000` bps. The setter has no guard such
as `require(newFeeBps < BPS_DENOMINATOR)` or `require(newFeeBps <= maxFeeBps)`, so
the owner can configure a fee that makes deposits impossible.

For the exact breaking boundary, set:

```solidity
depositFeeBps = 10_000;
```

Then for any positive deposit amount:

```text
fee       = (amount * 10_000) / 10_000
          = amount

netAmount = amount - fee
          = amount - amount
          = 0

shares    = convertToShares(0)
          = 0
```

So `deposit()` reaches:

```solidity
if (shares == 0) revert NoSharesMinted();
```

and every deposit reverts.

Values above the denominator are also bad. For example, with `amount = 10_000` and
`depositFeeBps = 10_001`:

```text
fee       = (10_000 * 10_001) / 10_000
          = 10_001

netAmount = 10_000 - 10_001
```

In Solidity 0.8+, that subtraction underflows and reverts.

The tested values could never have found this because `0`, `10`, and `25` bps are
all far inside the valid range. They only prove the formula works for small,
normal-looking fees. They do not exercise the boundary at `10_000`, values just
above it, or arbitrary owner-provided inputs. The event and only-owner checks also
cannot reveal the problem because the setter faithfully emits and stores whatever
number it receives.

The testing technique that would have caught this is property-based fuzz testing
with boundary assertions. For example, fuzz `newFeeBps` across the full `uint256`
range and assert either:

```text
setDepositFee(newFeeBps) reverts when newFeeBps >= 10_000
```

or, if the design intentionally allows any stored value:

```text
after setting the fee, every reasonable positive deposit should still produce
nonzero shares
```

That property fails immediately at `newFeeBps = 10_000`, and boundary-value tests
around `9_999`, `10_000`, and `10_001` would expose the same bug.
