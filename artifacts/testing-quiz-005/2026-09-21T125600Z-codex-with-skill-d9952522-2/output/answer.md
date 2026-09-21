The tests shown are not useless, but they are much narrower than the conclusion being drawn from them.

`test_DepositMintsShares` establishes that, for this particular initial state and this particular deposit amount, `_deposit(alice, DEPOSIT_AMOUNT)` returns `999e18` shares and records the same number in Alice's share balance.

It only appears to establish that deposits price shares correctly in general. It does not check the share-price relationship after the vault has already earned fees, after another user has withdrawn, or after the vault's real token balance and its recorded accounting might differ. It validates one example output, not the accounting rule that should hold across states.

`test_DepositUpdatesTotalAssets` establishes that, after one deposit into the tested starting state, both `totalAssets()` and `totalAssetsStored()` equal the deposited amount.

It only appears to establish that total asset accounting is correct. In reality it checks the easiest state transition: no accumulated withdrawal fees, no prior surplus, and no sequence pressure. It does not ask whether `totalAssetsStored()` continues to match the assets actually controlled by the vault after fee-bearing withdrawals. If the bug is that withdrawal fees remain in the protocol but are removed from the recorded total, this test never reaches the state where that difference exists.

`test_WithdrawFeeBps` establishes that the public constant or getter returns `30`.

It only appears to establish that withdrawal fees are implemented correctly. It says nothing about where the fee goes, whether it remains counted for remaining share holders, whether share price reflects it, or whether repeated withdrawals create drift. A fee parameter test is configuration coverage, not value-flow coverage.

`test_ConstructorSetsUsdt` establishes that the constructor stored the expected USDT address.

It only appears to establish that the vault's token integration is correct. It does not prove that accounting tracks token custody, that USDT behavior is handled correctly, or that balances held through the yield protocol are reflected in vault assets. It checks wiring, not the economic invariant.

The reason 100% line and function coverage was compatible with this bug is that coverage only says execution visited code. It does not say the assertions constrained the behavior that matters. A test can execute every line while merely checking constants, constructor assignments, single-step examples, or state values that mirror the implementation's own bookkeeping. That gives excellent coverage numbers and weak evidence.

This bug is specifically a stateful accounting bug. No single operation needs to look locally wrong. A withdrawal can transfer the right net amount to the withdrawing user, charge the right fee, burn the right shares, and update the stored total according to the code's local formula. The defect is that the fee is supposed to remain an asset of the vault's remaining shareholders, but the accounting stops counting it. That means the error is revealed by comparing the vault's recorded assets to its actual assets after a sequence, especially after multiple fee-bearing withdrawals. "Every operation is correct in isolation" is therefore the tell: it means the suite tested local examples instead of the global conservation property.

The property the suite needed is:

```text
After any valid sequence of deposits and withdrawals, the vault's recorded total assets must equal the assets it actually controls for shareholders, including withdrawal fees retained in the yield protocol.
```

More concretely:

```text
vault.totalAssetsStored() == actualVaultAssets()
```

where `actualVaultAssets()` includes all USDT or USDT-denominated claims held by the vault directly or through the yield protocol. If the vault holds idle USDT plus a protocol position, the property should account for both:

```text
actualVaultAssets =
    usdt.balanceOf(address(vault)) +
    yieldProtocol.assetsOf(address(vault));
```

The exact helper depends on the protocol interface, but the important point is equality, not a one-sided solvency check. `actualVaultAssets >= totalAssetsStored()` would stay green through this bug, because the vault holds more than it records. The missing assertion is no drift in either direction.

The test shape should be a handler-driven invariant, not just another unit test:

1. Create several actors with funded USDT balances and approvals.
2. Let a handler perform bounded valid deposits and withdrawals in arbitrary order.
3. After every generated sequence, assert:

```solidity
assertEq(vault.totalAssetsStored(), actualVaultAssets());
```

4. Also assert the same relationship through the public view used for share pricing if `totalAssets()` is the value that drives conversions:

```solidity
assertEq(vault.totalAssets(), actualVaultAssets());
```

A targeted regression test should include at least two fee-bearing withdrawals to demonstrate accumulation:

```solidity
function test_WithdrawFeesRemainCountedAsVaultAssets() public {
    _deposit(alice, 1_000e18);
    _deposit(bob, 1_000e18);

    _withdraw(alice, 100e18);
    _withdraw(bob, 100e18);

    assertEq(vault.totalAssetsStored(), actualVaultAssets());
}
```

That regression test confirms this known bug. The invariant is the real protection: it searches across long-run interleavings of deposits and withdrawals and checks the conservation rule the vault must never violate.
