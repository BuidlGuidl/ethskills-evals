# What the tests prove—and what they do not

`test_DepositMintsShares` establishes that, from that test's initial state, depositing `DEPOSIT_AMOUNT` returns `999e18` and credits Alice with exactly that many shares. It checks one deposit's quoted/minted amount and the corresponding share ledger entry.

It only appears to establish that those shares have the right economic backing. It does not compare the assets represented by the new shares with the underlying actually held in the yield protocol, check the resulting price per share, introduce another shareholder, or follow the deposit with a fee-bearing withdrawal. A correct share count can coexist with incorrect asset accounting.

`test_DepositUpdatesTotalAssets` establishes that immediately after one deposit, both `totalAssets()` and `totalAssetsStored()` report `DEPOSIT_AMOUNT`.

It only appears to establish that the vault's asset accounting is correct. If `totalAssets()` is derived from, or merely exposes, the same stored accounting variable, the two assertions are not an independent reconciliation: they show that two internal views agree. They never compare either value with the vault's actual, withdrawable/claimable underlying in the yield protocol. The test also stops before the transition that retains a withdrawal fee.

`test_WithdrawFeeBps` establishes only that the configured constant is 30 basis points. It does not establish that a withdrawal calculates the fee correctly, sends the correct net amount, leaves the fee invested, or adds that retained value to the assets backing the remaining shares. Configuration coverage is not accounting coverage.

`test_ConstructorSetsUsdt` establishes only that the constructor stored the expected token address. It does not establish anything about token flows, protocol balances, asset valuation, or withdrawal accounting.

# Why 100% coverage was compatible with the bug

Line and function coverage answer whether code was executed, not whether the important relationships between states were asserted. A test can execute every line in `withdraw`, observe the user's net payment and share burn, and still fail to check what must happen to both sides of the vault's balance sheet after the fee remains invested. Assertions against values produced from the same internal variable can also give 100% coverage while supplying no independent accounting oracle.

This bug is historical and relational. It appears only when a transition is evaluated against both the pre-state and post-state, and its effect is then carried into later users' share value. Fresh fixtures and single-operation examples repeatedly test locally plausible outputs while discarding the accumulated error. Coverage has no notion of operation sequences, independent asset custody, conservation of value, or whether all assets remain attributable to shares.

That is why “every operation is correct in isolation” is the tell. A vault is a state machine: its principal obligation is that a sequence of individually valid-looking transitions preserves its global accounting invariant. On a withdrawal of gross asset value `G` with retained fee `F`, paying the user `G - F` and burning the appropriate shares may look locally correct. But because `F` stays in the protocol for the remaining shareholders, recorded assets must fall by only `G - F`, not by `G`. Reducing the books by `G` creates an accounting deficit of exactly `F`; repeating withdrawals makes the deficit equal the sum of retained but unrecorded fees. There is therefore a faulty state transition even if the immediately visible return values of the call look right.

# The missing property

After every successful state-changing operation, the vault's recorded assets must equal the underlying assets that the vault can actually claim from its idle holdings and the yield protocol:

```text
totalAssetsStored
    == idle underlying held by the vault
     + underlying currently claimable by the vault from the yield protocol
```

Equivalently, assuming no donations, yield, or rounding during the tested sequence, the conservation equation is:

```text
recordedAssetsAfter
    == recordedAssetsBefore + deposits - netUnderlyingTransferredOut
```

For a fee-retaining withdrawal specifically:

```text
recordedAssetsAfter == recordedAssetsBefore - (grossWithdrawal - retainedFee)
actualAssetsAfter   == actualAssetsBefore   - (grossWithdrawal - retainedFee)
```

The equality must use an independent measure of real assets—for example the underlying token balance of the vault plus the yield protocol's redeemable balance for the vault—not another getter backed by `totalAssetsStored`.

The direct regression test needs at least one remaining shareholder:

1. Alice and Bob deposit, establishing an initial recorded/actual-assets equality.
2. Alice withdraws an amount that produces a nonzero fee.
3. Measure Alice's actual token balance increase (`netPaid`) and independently measure the vault's remaining claimable underlying.
4. Assert that recorded assets decreased by `netPaid`, not by the gross withdrawal; assert `totalAssetsStored == actualClaimableAssets`.
5. Assert that the retained fee increases the value backing Bob's remaining shares. Ultimately, after all remaining shares are redeemed, the vault should not leave the accumulated fees stranded (apart from explicitly bounded rounding dust).

In Foundry-like pseudocode:

```solidity
function test_RetainedWithdrawalFeeRemainsAccountedFor() public {
    _deposit(alice, ALICE_AMOUNT);
    _deposit(bob, BOB_AMOUNT);

    uint256 recordedBefore = vault.totalAssetsStored();
    uint256 actualBefore = _actualClaimableUnderlying();
    uint256 aliceBefore = usdt.balanceOf(alice);

    vm.prank(alice);
    vault.withdraw(WITHDRAW_AMOUNT /* appropriate receiver/owner args */);

    uint256 netPaid = usdt.balanceOf(alice) - aliceBefore;
    uint256 actualAfter = _actualClaimableUnderlying();

    assertEq(actualBefore - actualAfter, netPaid);
    assertEq(vault.totalAssetsStored(), recordedBefore - netPaid);
    assertEq(vault.totalAssetsStored(), actualAfter);

    // Bob is the remaining shareholder and must be able to realize the retained fee.
    uint256 bobClaim = vault.previewRedeem(vault.shareBalance(bob));
    assertEq(bobClaim, actualAfter); // when Bob owns all remaining shares
}
```

The strongest suite version makes this a stateful invariant test: a handler generates long, mixed sequences of deposits and fee-bearing withdrawals across several actors, while a ghost ledger tracks deposits and actual net transfers out. After every action it asserts both the conservation equation and equality between recorded and independently observed claimable assets, with only a stated rounding tolerance. That test fails on the first retained fee rather than waiting for user-visible drift to accumulate.
