The suite had line coverage, not input-domain coverage. It proved that the
setter can store a few expected fee values and that `deposit()` computes the fee
correctly for those examples. It did not prove the property the vault actually
needed: every owner-settable fee that the contract accepts must still leave
deposits possible, or invalid fees must be rejected.

The untested class was boundary and out-of-range fee inputs around
`BPS_DENOMINATOR`, especially `depositFeeBps >= 10_000`.

The hand-picked values `0`, `10`, and `25` bps are all tiny valid fees:

- `0 < 10_000`
- `10 < 10_000`
- `25 < 10_000`

So they can never exercise the case where the fee consumes the whole deposit or
exceeds it. They all leave `netAmount > 0` for any normal deposit amount. The
event and only-owner tests also cannot find this, because they only prove who can
write the value and that the write is announced; they do not classify which
written values are semantically valid.

The breaking input is `newFeeBps = 10_000`.

For any deposit amount `amount`:

```solidity
fee = (amount * 10_000) / 10_000;
fee = amount;

netAmount = amount - fee;
netAmount = amount - amount;
netAmount = 0;

shares = convertToShares(0);
shares = 0;
```

Then `deposit()` hits:

```solidity
if (shares == 0) revert NoSharesMinted();
```

So every deposit reverts. For `newFeeBps > 10_000`, the situation is also
invalid: for sufficiently large deposits, `fee > amount`, so `amount - fee`
underflows and reverts before shares are even considered.

The testing technique that would have caught this is fuzzing the owner-settable
fee over its accepted domain, with explicit boundary checks around `10_000`.
For this kind of configurable value math, a Foundry fuzz test should generate
`newFeeBps` values instead of only trying examples like `0`, `10`, and `25`.
It should then assert the intended property, such as either:

- `setDepositFee(newFeeBps)` reverts unless `newFeeBps < 10_000`, or
- after any accepted fee value, a valid nonzero deposit can still mint shares.

That fuzz search would have reached `10_000` or a value above it and produced a
counterexample before ops did.
