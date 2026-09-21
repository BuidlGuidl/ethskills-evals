The tests shown are not useless, but they are much narrower than the confidence being
claimed from them.

`test_DepositMintsShares` establishes that, for the fixture's initial state and one
deposit amount, the deposit path returns `999e18` shares and records that many shares
for `alice`. It checks one local input/output example: "given this empty vault setup,
this deposit mints this many shares."

It only appears to establish that share accounting is generally sound. It does not
show that the share price remains correct after prior withdrawals, that retained
withdrawal fees are incorporated into later share valuation, or that the accounting
state remains tied to the vault's real assets over time. A deposit can mint the
expected number of shares in the first state and still be priced against a stale or
understated asset total in later states.

`test_DepositUpdatesTotalAssets` establishes that after a single deposit,
`totalAssets()` and `totalAssetsStored()` both equal the deposited amount. That is a
one-step synchronization check between the stored total and the expected balance in a
very simple state.

It only appears to establish that `totalAssetsStored` faithfully tracks the vault's
assets. The bug is specifically about history: after withdrawals with retained fees,
the recorded total drifts below the real amount still in the protocol. A single
deposit into an empty vault cannot exercise that accumulation effect. The test proves
the counter can be set correctly once; it does not prove the counter is conserved
through all asset-moving transitions.

`test_WithdrawFeeBps` establishes only that the fee constant is `30` basis points.
That is a configuration check.

It only appears to establish anything about fee behavior. It does not verify that the
fee is retained in the yield protocol, added to the value of remaining shares,
included in `totalAssets`, excluded from any owner sweep, or claimable by the
remaining depositors. A correct constant can be used in an accounting update that is
conceptually wrong.

`test_ConstructorSetsUsdt` establishes that the vault stores the expected token
address at construction.

It only appears to contribute to the economic safety of the vault. It proves the
vault points at the right asset, not that it accounts for that asset correctly after
state transitions.

100% line and function coverage is compatible with this bug because coverage answers
"did execution visit this code?" not "did the tested executions imply the economic
invariant?" The suite can call every function and execute every branch while checking
only local postconditions: a deposit minted the expected shares, a withdrawal returned
the expected net amount, a constant had the expected value, a constructor stored the
expected address. None of that forces the tests to compare the vault's recorded asset
total with the actual assets controlled by the vault after a sequence of operations.

"Every operation is correct in isolation" is the tell because this is a conservation
bug, not a single-call revert-or-wrong-return bug. The failure lives in the relationship
between operations. A withdrawal can send the user the right net amount and charge the
right fee, yet fail to keep the retained fee inside the accounting base. The individual
withdrawal looks fine from the withdrawing user's perspective. The damage appears only
when later deposits, withdrawals, or share-price calculations rely on the understated
total. In other words, the bug is in the protocol-level invariant across a trace, not
in the surface behavior of one call.

The missing property is:

> After any sequence of deposits and withdrawals, the vault's recorded total assets
> must equal the real assets controlled by the vault in the underlying token/yield
> protocol, including withdrawal fees retained for remaining share holders.

Equivalently, there must be no unaccounted asset balance:

```solidity
assertEq(vault.totalAssets(), actualUnderlyingAssetsHeldForVault());
assertEq(vault.totalAssetsStored(), actualUnderlyingAssetsHeldForVault());
```

where `actualUnderlyingAssetsHeldForVault()` is measured from the token/yield protocol
itself, not derived from the vault's own accounting variable. If the vault deposits
USDT into a strategy, this should read the strategy balance or redeemable underlying
attributable to the vault. If the test uses a mock yield protocol, the mock should
expose the vault's actual underlying balance.

The test shape should be trace-based rather than single-example-based:

1. Start with at least two users.
2. Have both deposit.
3. Have one user withdraw, incurring the withdrawal fee.
4. Assert that the withdrawn user's net amount reflects the fee.
5. Assert that the retained fee is still included in the vault's real underlying
   balance.
6. Assert that `totalAssets()` and `totalAssetsStored()` equal that real underlying
   balance.
7. Assert that the remaining user's shares are priced against the full balance,
   including the retained fee.
8. Repeat the same assertion after multiple deposits and withdrawals, ideally with
   fuzzed actors and amounts.

A minimal deterministic version would look like:

```solidity
function test_WithdrawFeeRemainsAccountedForRemainingHolders() public {
    uint256 aliceShares = _deposit(alice, 1_000e18);
    uint256 bobShares = _deposit(bob, 1_000e18);

    uint256 assetsBefore = underlyingBalanceHeldForVault();

    vm.prank(alice);
    vault.withdraw(500e18);

    uint256 assetsAfter = underlyingBalanceHeldForVault();

    // The protocol paid Alice the net amount, but the fee did not leave the vault's
    // economic assets. Whatever the exact mock math is, the accounting value must
    // match the externally observed underlying value.
    assertEq(vault.totalAssets(), assetsAfter);
    assertEq(vault.totalAssetsStored(), assetsAfter);

    // Bob's claim must include the retained withdrawal fee; it must not be priced
    // from an understated stored total.
    assertEq(vault.previewRedeem(bobShares), assetsAfter * bobShares / vault.totalSupply());

    assertLt(assetsAfter, assetsBefore); // only Alice's net withdrawal left
}
```

The strongest form is an invariant/fuzz test:

```solidity
function invariant_AccountingMatchesRealUnderlying() public {
    uint256 realAssets = underlyingBalanceHeldForVault();
    assertEq(vault.totalAssets(), realAssets);
    assertEq(vault.totalAssetsStored(), realAssets);
}
```

Then the handler performs arbitrary valid deposits and withdrawals by multiple users.
That property catches the drift because the first withdrawal that leaves a fee in the
protocol but removes it from the recorded total creates exactly the forbidden state:
real assets greater than recorded assets.
