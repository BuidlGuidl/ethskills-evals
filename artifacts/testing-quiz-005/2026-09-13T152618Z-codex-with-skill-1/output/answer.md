# What the suite proved—and what it missed

The suite's green status and 100% coverage do not establish that the vault's accounting is correct. They establish that the executed examples produced the values asserted by the tests. Coverage says that code ran; it does not say that the tests compared its result with an independent source of truth.

## What each test establishes

### `test_DepositMintsShares`

This establishes that, for one deposit of exactly `DEPOSIT_AMOUNT` into the test's initial state, `_deposit` returns `999e18` and the vault records `999e18` shares for Alice.

It only appears to establish that deposit share accounting is generally correct. It says nothing about other deposit sizes, rounding boundaries, deposits at a non-unit share price, later depositors, or deposits after fees have accumulated. It also does not establish that those shares represent the correct fraction of the assets actually under management. The return value and `shareBalance` can agree with each other while both are derived from understated internal accounting.

### `test_DepositUpdatesTotalAssets`

This establishes that, after one deposit into the test's initial state, both `totalAssets()` and `totalAssetsStored()` equal `DEPOSIT_AMOUNT`.

It only appears to establish that total-asset accounting tracks the vault's assets. Both observations may be views of the same internal bookkeeping, so their agreement is not an independent reconciliation. The test never asks how many underlying tokens the vault actually controls in its wallet and yield-protocol position. Nor does it check the state after a withdrawal fee has remained invested, which is the transition where bookkeeping and custody diverge.

### `test_WithdrawFeeBps`

This establishes only that the public constant/getter `WITHDRAW_FEE_BPS()` returns `30` in this deployment.

It only appears to test withdrawal fees. It does not establish that a withdrawal computes the fee correctly, sends the correct net amount, leaves the fee in the yield protocol, attributes that retained fee to the remaining shareholders, or includes it in `totalAssets`. It tests configuration, not fee behavior or accounting.

### `test_ConstructorSetsUsdt`

This establishes that construction stores the supplied mock token address and that `usdt()` returns it.

It only appears to add confidence in the token integration. It does not exercise USDT behavior, token transfers, balance reconciliation, the yield protocol, or any economic invariant. It is essentially a wiring/getter test.

## Why 100% coverage was compatible with the bug

Line and function coverage measure reachability: every reported line and function executed at least once. They do not measure whether the assertions constrain the intended economic behavior, whether all meaningful states and input values were explored, or whether calls were composed into adversarial sequences.

It is therefore possible to execute every deposit and withdrawal line while checking only local outputs. A withdrawal can send the user the intended net amount, leave the intended fee invested, and update the stored total exactly as its implementation says—and every line can be covered—without any test comparing that stored total with actual managed assets. Getter-against-storage and constant-value assertions especially inflate coverage while providing almost no independent correctness oracle.

“Every operation is correct in isolation” is the tell because this is a state-transition/composition bug. The intended postcondition of a fee-bearing withdrawal is not merely “the withdrawing user received the right amount.” It also includes “the retained fee remains accounted for and belongs to the remaining shares.” A deposit test starting from a clean fixture and a withdrawal test checking only that call's payout continually reset the context in which drift becomes visible. The defect lives in the relationship between successive states: after one or more withdrawals, later deposits, withdrawals, and share pricing consume an already-wrong recorded total. Local correctness cannot imply preservation of a global invariant.

## The missing property

The suite should have asserted accounting-to-custody conservation after every successful state transition:

```text
recordedManagedAssets == actualManagedUnderlying
```

More concretely, at any quiescent point after a deposit or withdrawal:

```text
vault.totalAssetsStored()
    == underlying.balanceOf(address(vault))
     + underlying represented by the vault's yield-protocol position
```

If `totalAssets()` is intended to be the authoritative accounting value, it must satisfy the same equality. “Actual managed underlying” must be measured independently from the variable being tested; it is the withdrawable underlying attributable to the vault across all custody locations. Any deliberately realized yield, loss, or rounding tolerance must be modeled explicitly. For the fee-only scenario described, exact equality should hold. A one-sided assertion such as `recorded <= actual` is insufficient: it proves solvency but permits precisely this bug, where surplus assets become stranded.

For a withdrawal of gross claim `G` with retained fee `F`, this implies the transition-level postcondition:

```text
recordedAfter = recordedBefore - (G - F)
actualAfter   = actualBefore   - (G - F)
```

The fee `F` remains in both actual custody and recorded managed assets. Decrementing recorded assets by `G` while custody falls only by `G - F` creates a gap of `F`.

## Test shape that catches it

Use a handler-driven Foundry invariant test, not only isolated examples. The handler should maintain funded, approved actors and expose bounded valid actions such as `deposit(actor, amount)` and `withdraw(actor, shares)` (and any harvest/rebalance action that changes custody). Target the handler, let the invariant fuzzer generate long sequences across multiple actors, and after every sequence assert the equality above.

Conceptually:

```solidity
function invariant_accountingEqualsCustody() public view {
    uint256 actual = usdt.balanceOf(address(vault))
        + strategy.underlyingValueOf(address(vault));

    assertEq(vault.totalAssetsStored(), actual);
    assertEq(vault.totalAssets(), actual);
}
```

The handler must bound calls to successful ranges and actually perform meaningful operations; calls/reverts statistics should be inspected, and `fail_on_revert = true` is useful while building it so a nearly inert, all-reverting campaign cannot produce a misleading green result.

A focused regression test should accompany the invariant: deposit for at least two users, withdraw one user's shares, verify that the fee is still in the protocol, and reconcile recorded assets to actual custody. Then perform another state transition—another withdrawal or deposit—and reconcile again, showing that the gap does not appear or grow. Under the faulty implementation, the first reconciliation fails by the retained fee; repeated fee-bearing withdrawals show cumulative drift. The regression proves this known failure stays fixed, while the stateful invariant searches for other sequences that violate the same economic property.
