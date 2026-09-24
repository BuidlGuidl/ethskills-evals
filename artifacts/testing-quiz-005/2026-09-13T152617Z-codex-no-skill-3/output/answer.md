# What the tests prove—and what they do not

`test_DepositMintsShares` proves that, from the fixture's initial state, one deposit returns `999e18` shares and credits that many shares to Alice. It checks one output and one account balance after one call.

It does **not** prove that `999e18` is economically correct for every state, that the shares remain backed by the right amount of assets, that the share price is correct after withdrawals, or that fees retained by the vault benefit those shares. The exact expected value can even freeze the implementation's current formula into the test without independently checking the accounting law that makes the formula correct.

`test_DepositUpdatesTotalAssets` proves that, immediately after one deposit into the initial state, both reported accounting values equal the deposited amount.

It does **not** prove that either value equals the assets the vault actually controls after other transitions. In particular, it never creates a retained withdrawal fee and compares the resulting stored total with the token balance in the yield protocol. It checks two internal views that may share the same erroneous bookkeeping source; agreement between them is not independent evidence of solvency or complete accounting.

`test_WithdrawFeeBps` proves only that the public constant is `30` basis points.

It does **not** prove that a fee is computed on the intended base, rounded as intended, transferred or retained in the intended place, included in total assets afterward, or allocated economically to the remaining shareholders. A correct constant says nothing about correct fee accounting.

`test_ConstructorSetsUsdt` proves only that the constructor stores the supplied USDT address and that the getter returns it.

It does **not** establish any accounting behavior, including whether balances held directly or through the yield protocol are included in `totalAssets`.

# Why 100% coverage did not help

Line and function coverage answer whether execution visited code, not whether the test asserted the right relationship between states. A withdrawal test can execute every line, verify the user's net payment, verify burned shares, and still omit the retained fee from the vault's recorded assets. All lines can therefore be covered while the one missing specification—conservation across a sequence—is never asserted.

The shown tests are example-based and mostly local: fixed input, fresh fixture, one operation, expected field values. The bug is relational and stateful. It concerns the relationship among:

- assets actually controlled by the vault,
- assets recorded by its accounting,
- assets paid out, and
- claims represented by shares,

across multiple transitions. Coverage has no metric for whether that relationship was checked. It can reach 100% even if assertions are weak, tautological, or derived from the same mistaken implementation assumptions.

"Every operation is correct in isolation" is the tell because drift is a failure of composition. For a withdrawal with gross asset value `g` and fee `f`, paying the user `g - f` can be locally correct, and burning shares worth `g` can also be locally correct. But if stored assets are reduced by `g` while only `g - f` actually leaves, the post-state omits `f`. The operation's independently inspected outputs look right while its combined state transition violates conservation. Repetition accumulates the omitted fees:

```text
actual assets after withdrawal = actual assets before - (g - f)
recorded assets after withdrawal = recorded assets before - g
new drift = old drift + f
```

That is why a fresh-state test of each method is insufficient: the economically important behavior is what remains true after methods are composed.

# The missing property

The suite should assert an asset-accounting conservation invariant:

> After every completed state transition, the vault's recorded total assets must equal all underlying assets economically owned or controlled by the vault, including withdrawal fees retained in the yield protocol.

Precisely, if the vault can hold both idle USDT and a claim on a yield protocol, the invariant is:

```text
vault.totalAssetsStored()
    == usdt.balanceOf(address(vault))
     + independently measured underlying value of the vault's yield-protocol position
```

If all assets always reside in the protocol, this simplifies to:

```text
vault.totalAssetsStored() == protocol.underlyingBalanceOf(address(vault))
```

Subject only to explicitly specified rounding tolerance, `vault.totalAssets()` should equal that same independently measured quantity. The right-hand side must be read from token/protocol state, not calculated through another vault getter backed by `totalAssetsStored`, or the check becomes circular.

For a single withdrawal, the equivalent transition property is:

```text
storedAfter == storedBefore - amountActuallyPaidToWithdrawer
```

when the fee stays in the protocol and there are no other gains, losses, or transfers during the call. Thus, for gross redemption value `g` and retained fee `f`:

```text
storedAfter == storedBefore - (g - f)
```

not `storedBefore - g`. This also implies that the retained fee increases the assets per share of the shareholders who remain.

# Test shape

Use a stateful, multi-user sequence and check the invariant after **every** action:

1. Alice and Bob deposit.
2. Record the independently observed protocol assets, stored assets, total shares, and Bob's shares.
3. Alice withdraws or redeems only part or all of her position, creating a nonzero retained fee.
4. Independently measure Alice's token increase and the protocol's remaining underlying assets.
5. Assert that stored assets fell by Alice's actual net receipt, not by the gross redemption amount.
6. Assert that stored assets equal idle assets plus the protocol position.
7. Assert that Bob's redeemable claim reflects his pro-rata share of the retained fee (within the documented rounding bound).
8. Repeat deposits and withdrawals by several actors and reassert the same invariant after each step.

A minimal regression test needs two depositors; with only one depositor exiting completely, there may be no remaining claimant through whom to observe the intended fee accrual. In pseudocode:

```solidity
function test_RetainedWithdrawalFeeRemainsAccountedFor() public {
    _deposit(alice, amount);
    _deposit(bob, amount);

    uint256 storedBefore = vault.totalAssetsStored();
    uint256 aliceBefore = usdt.balanceOf(alice);
    uint256 bobShares = vault.shareBalance(bob);

    vm.prank(alice);
    vault.redeem(/* Alice shares */);

    uint256 paid = usdt.balanceOf(alice) - aliceBefore;
    uint256 actual = usdt.balanceOf(address(vault))
        + protocol.underlyingBalanceOf(address(vault));

    assertEq(vault.totalAssetsStored(), storedBefore - paid);
    assertEq(vault.totalAssetsStored(), actual);
    assertEq(vault.totalAssets(), actual);
    assertGt(vault.convertToAssets(bobShares), /* Bob's pre-withdraw claim */);
}
```

The strongest version is an invariant/fuzz handler that generates arbitrary bounded sequences of deposits, withdrawals/redemptions, and any modeled yield changes across several users. After each call it compares vault accounting with independently observed custody and maintains a simple reference-model ledger. That test catches cumulative drift immediately on the first fee-bearing withdrawal and continues to protect against sequence- and rounding-dependent variants.
