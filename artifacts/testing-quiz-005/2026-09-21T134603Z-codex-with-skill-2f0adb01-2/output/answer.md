# What the Tests Proved, and What They Did Not

The sample tests are not useless, but they are much narrower than the claim being made for them. They prove that particular code paths execute and return the expected values for one-step examples. They do not prove that the vault preserves its economic accounting across a history of deposits and withdrawals.

## `test_DepositMintsShares`

```solidity
function test_DepositMintsShares() public {
    uint256 shares = _deposit(alice, DEPOSIT_AMOUNT);
    assertEq(shares, 999e18);
    assertEq(vault.shareBalance(alice), 999e18);
}
```

This actually establishes that, from an empty or fixture-defined starting state, one deposit by Alice mints exactly the expected number of shares and records those shares against Alice.

It only appears to establish that the share accounting is generally correct. It does not check what those shares are worth after later withdrawals, whether retained fees are included in the share price, or whether shares continue to represent all assets controlled by the vault after a sequence of operations. It verifies the local mint calculation, not the long-run conservation of value.

## `test_DepositUpdatesTotalAssets`

```solidity
function test_DepositUpdatesTotalAssets() public {
    _deposit(alice, DEPOSIT_AMOUNT);
    assertEq(vault.totalAssets(), DEPOSIT_AMOUNT);
    assertEq(vault.totalAssetsStored(), DEPOSIT_AMOUNT);
}
```

This actually establishes that a single deposit increases the vault's reported assets to the deposited amount, and that the public view and stored accounting agree immediately after that deposit.

It only appears to establish that `totalAssets` tracks the vault's real assets. It does not compare reported assets to the vault's actual underlying balance in the yield protocol after withdrawals. In particular, it never tests the case that matters here: a withdrawal fee remains inside the protocol and therefore must remain part of `totalAssetsStored`. A deposit-only test can pass even if the withdraw path later subtracts too much from stored assets.

## `test_WithdrawFeeBps`

```solidity
function test_WithdrawFeeBps() public view {
    assertEq(vault.WITHDRAW_FEE_BPS(), 30);
}
```

This actually establishes only that the configured withdrawal fee constant is 30 basis points.

It only appears to establish that fees are handled correctly. It says nothing about where the fee goes, whether the fee is counted as remaining vault-owned assets, whether it accrues to remaining shareholders, or whether it becomes orphaned. Testing the parameter is not testing the economics of the fee.

## `test_ConstructorSetsUsdt`

```solidity
function test_ConstructorSetsUsdt() public view {
    assertEq(address(vault.usdt()), address(usdt));
}
```

This actually establishes that the constructor stored the expected token address.

It only appears to contribute to confidence in the vault's asset handling. It proves the vault points at the intended token, but not that it accounts for all of that token once funds move through the yield protocol and withdrawal fees are retained.

# Why 100% Coverage Still Missed This

Coverage says which lines and functions were executed. It does not say which properties were asserted.

A suite can execute the deposit path, the withdrawal path, fee math, getters, and constructor, and still never ask the important question: after many operations, does the vault's recorded asset total equal the assets the vault actually controls?

That is exactly how this bug survives 100% line and function coverage. The tests can touch the buggy line while asserting only that the individual call returns plausible local values. If the withdrawal path pays the withdrawing user correctly and charges the expected fee, the call can look correct in isolation even while stored vault assets are decremented by the gross withdrawal amount instead of only the amount actually paid out. The retained fee still exists in the protocol, but the accounting no longer includes it.

"Every operation is correct in isolation" is therefore the tell. Vault bugs are often state-history bugs. The failure is not necessarily that one deposit or one withdrawal produces an obviously wrong immediate result. The failure is that each locally plausible transition leaves a tiny accounting residue, and those residues compound until real assets are no longer represented by shares. That is a missing invariant, not a missing getter test.

# The Property That Should Have Been Asserted

The suite needed an asset-conservation invariant:

After any sequence of deposits and withdrawals, the vault's recorded total assets must equal the total underlying assets actually controlled by the vault, including idle token balance and any underlying balance held in the yield protocol on behalf of the vault, up to explicitly allowed rounding. Withdrawal fees that remain in the protocol are still vault assets and must remain included in `totalAssets` / `totalAssetsStored`.

In formula form:

```text
vault.totalAssets()
  == usdt.balanceOf(address(vault))
   + underlyingAssetsHeldForVaultInYieldProtocol
```

and, if `totalAssetsStored` is the source of share-price accounting:

```text
vault.totalAssetsStored()
  == usdt.balanceOf(address(vault))
   + underlyingAssetsHeldForVaultInYieldProtocol
```

The withdrawal-specific transition property is:

```text
newTotalAssetsStored
  == oldTotalAssetsStored
   - assetsPaidToWithdrawer
   + externalYieldOrLossSinceLastAccounting
```

not:

```text
oldTotalAssetsStored - grossAssetsRedeemedIncludingRetainedFee
```

because the fee was not paid out and was not swept away. It stayed in the strategy for remaining shareholders.

# Test Shape That Catches It

The strongest test shape is a stateful invariant test with a handler that performs randomized deposits and withdrawals across multiple users. After every generated sequence, assert that reported assets match actual controlled assets in the vault plus strategy.

Sketch:

```solidity
function invariant_TotalAssetsMatchesControlledUnderlying() public view {
    uint256 actualControlled =
        usdt.balanceOf(address(vault))
        + strategy.underlyingBalanceOf(address(vault));

    assertApproxEqAbs(
        vault.totalAssets(),
        actualControlled,
        1,
        "reported assets must include retained withdrawal fees"
    );

    assertApproxEqAbs(
        vault.totalAssetsStored(),
        actualControlled,
        1,
        "stored assets must include retained withdrawal fees"
    );
}
```

A smaller deterministic regression test would also expose the specific bug:

```solidity
function test_WithdrawFeeRemainsInSharePriceForRemainingDepositors() public {
    _deposit(alice, 1_000e18);
    _deposit(bob, 1_000e18);

    uint256 assetsBefore = actualControlledUnderlying();
    uint256 aliceBalanceBefore = usdt.balanceOf(alice);

    vm.prank(alice);
    vault.withdraw(500e18, alice, alice);

    uint256 paidToAlice = usdt.balanceOf(alice) - aliceBalanceBefore;
    uint256 expectedControlled = assetsBefore - paidToAlice;

    assertEq(actualControlledUnderlying(), expectedControlled);
    assertEq(vault.totalAssetsStored(), expectedControlled);

    // The retained fee is still in the vault economy, so Bob's shares must
    // price against the fee-inclusive remaining asset pool.
    assertEq(vault.totalAssets(), actualControlledUnderlying());
}
```

The exact helper names depend on the implementation, but the assertion should not mirror the vault's own accounting. It must independently read the real underlying balance from the token and strategy. Otherwise the test can reproduce the same bad accounting model and still pass.

The missing test was not "call withdraw once." It was "after arbitrary deposit/withdraw histories, no controlled token can fall out of the share accounting." That is the property this bug violated.
