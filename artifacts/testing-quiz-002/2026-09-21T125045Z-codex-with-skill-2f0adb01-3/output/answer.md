The suite had line coverage, not input-space coverage. It proved that the setter
can store a few values, that the event is emitted, and that `deposit()` computes
fees correctly for small, normal fees. It never tested the boundary class of
configuration inputs at or above the denominator: `depositFeeBps >= 10_000`.

That is the value class that bricks deposits. For example, if ops sets:

```solidity
depositFeeBps = 10_000;
```

then for any positive deposit amount:

```solidity
fee = (amount * 10_000) / 10_000 = amount
netAmount = amount - fee = amount - amount = 0
shares = convertToShares(0) = 0
```

So every deposit reverts at:

```solidity
if (shares == 0) revert NoSharesMinted();
```

If the fee is set above `10_000`, it is even worse:

```solidity
fee = (amount * 10_001) / 10_000 > amount
netAmount = amount - fee
```

In Solidity 0.8+, that subtraction underflows and reverts before shares are even
calculated.

The tested values, `0`, `10`, and `25` bps, could never have found this because
they are all far below the cliff. They all satisfy `fee < amount` for ordinary
positive deposits, so `netAmount` stays positive and `convertToShares(netAmount)`
can mint shares. Those examples exercise the lines, but not the dangerous
boundary.

The testing technique that would have caught this is fuzz/property testing over
the fee parameter, especially with boundary values around `BPS_DENOMINATOR`.
A useful property would be one of:

```solidity
// If this vault is supposed to remain depositable after fee changes:
// for every allowed fee, setting the fee and then depositing a positive amount
// should mint nonzero shares.

// Or, if 100%+ fees are invalid:
// setDepositFee(newFeeBps) must revert whenever newFeeBps >= BPS_DENOMINATOR.
```

That fuzz test would quickly try `10_000` or shrink a failing input down to
`10_000`, showing that the setter needs a bound such as:

```solidity
require(newFeeBps < BPS_DENOMINATOR, "fee too high");
```
