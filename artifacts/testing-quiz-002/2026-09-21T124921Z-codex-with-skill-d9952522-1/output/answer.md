The suite had 100% line coverage, but it did not have domain coverage. It proved
that the setter stores some hand-picked values, that the event is emitted, and
that `deposit()` charges the expected fee for a few small fees. It never proved
that every value the owner is allowed to store is a usable vault configuration.

The missing class of input was an out-of-range basis-point fee: values at or above
`BPS_DENOMINATOR`, especially `10_000` bps. Since `setDepositFee()` accepts any
`uint256`, `10_000` is a valid input to the setter even though it means a 100%
deposit fee.

For `depositFeeBps = 10_000`:

```solidity
fee = (amount * 10_000) / 10_000;
fee = amount;

netAmount = amount - fee;
netAmount = amount - amount;
netAmount = 0;

shares = convertToShares(0);
shares = 0;

if (shares == 0) revert NoSharesMinted();
```

So every deposit with a positive `amount` reaches `netAmount == 0`, mints zero
shares, and reverts. For values above `10_000`, deposits can also revert by
underflowing at `amount - fee`, depending on the amount and rounding.

The four tested values could never have found this because `0`, `10`, and `25`
bps are all deep inside the safe region, far below the `10_000` bps boundary.
The event test and only-owner test execute the setter line too, but they do not
assert any semantic bound on the stored value. They only confirm that authorized
callers can write the number they chose.

The testing technique that would have caught this is a fuzz test over the
owner-settable fee domain, with a property connecting the setter to deposits. For
example: for any fee value the setter accepts, either the fee must be within the
semantic bound required by the vault, or a normal positive deposit must still mint
shares. Foundry would quickly try the boundary value `10_000` and produce the
counterexample above. The fix would usually be to make `setDepositFee()` reject
invalid fees, then test the boundary explicitly:

```solidity
// nearest valid value
setDepositFee(9_999); // deposit should still be possible

// exact invalid limit
vm.expectRevert();
setDepositFee(10_000);

// first value beyond the limit
vm.expectRevert();
setDepositFee(10_001);
```

The important part is that the test searches the accepted input space instead of
sampling only nice-looking fee values.
