The suite got 100% line coverage, but only over a tiny set of friendly example values. Line coverage proved that `setDepositFee()` stores its input, emits its event, and is owner-gated. It also proved that `deposit()` executes the fee calculation for a few normal fees. It did not prove that every fee value the owner can store is a valid fee for the deposit math.

The missing class of input was out-of-range `newFeeBps`: values at or above `BPS_DENOMINATOR`, meaning a fee of 100% or more. At 10,000 bps the deposit has no net amount left, and above 10,000 bps the fee calculation can exceed the deposit amount.

The breaking case is immediate with `newFeeBps = 10_001`:

```solidity
BPS_DENOMINATOR = 10_000
amount = 10_000
depositFeeBps = 10_001

fee = (amount * depositFeeBps) / BPS_DENOMINATOR
    = (10_000 * 10_001) / 10_000
    = 10_001

netAmount = amount - fee
          = 10_000 - 10_001
          = underflow
```

In Solidity 0.8+, that subtraction reverts. Smaller positive deposits with the same 10,001 bps fee may round the fee down to exactly `amount`, leaving `netAmount == 0`; those still revert at `NoSharesMinted()`. At exactly 10,000 bps, `fee == amount`, `netAmount == 0`, and `shares == convertToShares(0)`, so every positive deposit reverts with `NoSharesMinted()`. Either way, a fee at or above 100% makes the vault unable to accept normal deposits.

The four tested values could never have found this because `0`, `10`, and `25` bps are all well inside the valid range, and the only-owner test checks who may call the setter, not what values the owner is allowed to set. Those tests cover statements, not the boundary of the parameter domain.

The testing technique that would have caught it is fuzz testing, ideally as a property test over `newFeeBps` and `amount`. For example: after the owner sets any allowed deposit fee, a positive deposit should not revert merely because the fee arithmetic underflows, and the minted shares should correspond to a nonnegative net amount. A fuzz test would quickly generate `feeBps >= 10_000` or `feeBps > 10_000` and expose that the setter needs a bound such as:

```solidity
if (newFeeBps > MAX_DEPOSIT_FEE_BPS) revert InvalidDepositFee();
```

with `MAX_DEPOSIT_FEE_BPS` set below 10,000 if deposits must always mint shares, or at least no higher than the protocol's intended maximum fee.
