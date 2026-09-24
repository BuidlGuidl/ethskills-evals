The tests shown are not bad because they are false. They are bad because they are
small truths that were allowed to stand in for the important truth.

`test_DepositMintsShares`

This establishes that, for a fresh vault and one deposit of `DEPOSIT_AMOUNT`, the
deposit path returns `999e18` shares and records `999e18` shares for Alice. It proves
that this one input reaches the expected minting arithmetic.

It only appears to establish that shares correctly represent Alice's economic claim.
It does not check the exchange rate after later fees, the relationship between shares
and real assets, or whether future users can redeem the assets that should belong to
the remaining share holders. A share balance can be internally consistent and still
be priced against the wrong asset total.

`test_DepositUpdatesTotalAssets`

This establishes that, immediately after one deposit, `totalAssets()` and
`totalAssetsStored()` both equal the deposited amount. It checks the happy-path
initial synchronization between the stored accounting number and the deposit amount.

It only appears to establish that asset accounting is correct. The bug is not that
the first deposit fails to count assets. The bug is that later withdrawals leave fee
assets under vault control while the stored total is reduced as if those assets left.
This test never creates that condition, so it says nothing about whether accounting
continues to match reality after fees accumulate.

`test_WithdrawFeeBps`

This establishes that the configured withdrawal fee basis points value is `30`.

It only appears to establish that withdrawal fees are correct. A fee constant being
correct says nothing about where the fee is accounted. The defect is not "the fee is
30 bps instead of something else"; it is "the retained fee stops participating in the
vault's asset total and share price."

`test_ConstructorSetsUsdt`

This establishes that the constructor stored the expected USDT token address.

It only appears to establish a meaningful part of vault correctness. It confirms the
vault is wired to the intended token, but not that the vault's later internal ledger
matches the token or yield-protocol balance it controls.

100% line and function coverage was compatible with this bug because coverage only
answers whether code was executed, not whether the right relationships were asserted
after execution. A suite can call every branch of `deposit`, `withdraw`, `totalAssets`,
and the constructor while only checking per-call return values, constants, and simple
postconditions. The broken behavior here is relational and temporal: after many
valid operations, the vault's stored asset total diverges from the assets actually
owned or controlled by the vault.

"Every operation is correct in isolation" is therefore the tell, not the alibi. The
failure is an accounting invariant failure. No single withdrawal has to look
obviously wrong to the withdrawing user: they burn shares, receive the expected net
amount, and the fee remains in the protocol. The problem is that the fee is also
removed from the vault's accounting. Each isolated step can match its local
expectations while moving the global ledger one fee farther from reality. The more
ordinary the individual operations look, the more important it is to test the
conservation rule across sequences.

The missing property should have been stated as an invariant:

After every successful deposit or withdrawal, the vault's accounted assets must equal
the real assets controlled for the benefit of current share holders, within any
explicit rounding tolerance. In particular, withdrawal fees that remain in the yield
protocol are still vault assets. A withdrawal may reduce accounted assets only by the
amount that actually leaves vault control, not by the gross amount before the retained
fee.

Equivalently, for a withdrawal:

```text
preAccountedAssets == preActualControlledAssets
fee = grossWithdrawAmount * WITHDRAW_FEE_BPS / 10_000
netPaidOut = grossWithdrawAmount - fee
postActualControlledAssets == preActualControlledAssets - netPaidOut
postAccountedAssets == postActualControlledAssets
```

The test shape should be sequence-based, not just one-call examples:

```solidity
function invariant_accountedAssetsEqualControlledAssets() public {
    uint256 actual =
        usdt.balanceOf(address(vault)) +
        yieldProtocol.balanceOfUnderlying(address(vault));

    assertApproxEqAbs(vault.totalAssets(), actual, 1);
    assertApproxEqAbs(vault.totalAssetsStored(), actual, 1);
}
```

Then drive that invariant with a handler or model test that performs many deposits
and withdrawals by multiple users:

```solidity
function test_FeesRemainInSharePriceAcrossSequence() public {
    uint256 aliceShares = _deposit(alice, 1_000e18);
    uint256 bobShares = _deposit(bob, 1_000e18);

    _withdraw(alice, aliceShares / 2);
    _deposit(carol, 750e18);
    _withdraw(bob, bobShares / 3);
    _withdraw(alice, aliceShares / 4);

    uint256 actual =
        usdt.balanceOf(address(vault)) +
        yieldProtocol.balanceOfUnderlying(address(vault));

    assertApproxEqAbs(vault.totalAssetsStored(), actual, 1);
    assertApproxEqAbs(vault.totalAssets(), actual, 1);
}
```

That property catches the drift because it does not care whether each call looked
locally plausible. It asks the accounting question the vault must always answer:
are all real assets still controlled by the vault, including retained withdrawal
fees, represented in the share price of the users who remain?
