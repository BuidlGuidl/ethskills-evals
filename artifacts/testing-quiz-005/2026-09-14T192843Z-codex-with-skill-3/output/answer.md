# What the green suite actually proved

The suite exercised code, but the representative tests do not establish the vault's central accounting property. They mostly confirm individual snapshots or repeat values already encoded by the implementation.

## `test_DepositMintsShares`

```solidity
uint256 shares = _deposit(alice, DEPOSIT_AMOUNT);
assertEq(shares, 999e18);
assertEq(vault.shareBalance(alice), 999e18);
```

What it actually establishes: for this one initial state, this one depositor, and this one fixed amount, `deposit` returns `999e18` and records the same number in Alice's share balance.

What it only appears to establish: that share minting is generally economically correct. The expected value is a single example, and may simply mirror the implementation's formula. The test does not establish that shares preserve a correct claim on all assets over time, that the exchange rate is based on actual managed assets, or that later fee-bearing withdrawals increase the value belonging to remaining shares. It also does not search across amounts, actors, rounding boundaries, or operation sequences.

## `test_DepositUpdatesTotalAssets`

```solidity
_deposit(alice, DEPOSIT_AMOUNT);
assertEq(vault.totalAssets(), DEPOSIT_AMOUNT);
assertEq(vault.totalAssetsStored(), DEPOSIT_AMOUNT);
```

What it actually establishes: immediately after one deposit from the initial state, both accounting getters report the deposited constant.

What it only appears to establish: that `totalAssets` remains an accurate measure of the assets economically owned by the vault. If `totalAssets()` is derived from `totalAssetsStored()`, these assertions compare two views of the same book entry, not the book entry with an independent source of truth. Even if the initial deposit is accounted for correctly, this says nothing about retained withdrawal fees or cumulative transitions. It never reconciles accounting with the vault's actual token balance plus its position in the yield protocol.

## `test_WithdrawFeeBps`

```solidity
assertEq(vault.WITHDRAW_FEE_BPS(), 30);
```

What it actually establishes: the public constant/getter returns 30.

What it only appears to establish: that withdrawal fees are correctly implemented. It does not show that the fee is calculated correctly, that the user receives the correct net amount, or—crucially here—that the retained fee remains included in managed-asset accounting and therefore belongs to the remaining shareholders. This is configuration testing, not value-conservation testing.

## `test_ConstructorSetsUsdt`

```solidity
assertEq(address(vault.usdt()), address(usdt));
```

What it actually establishes: construction stores and exposes the supplied token address.

What it only appears to establish: little about vault correctness beyond wiring. It does not test the real token's behavior, transfers, balances, protocol custody, or accounting. If this uses a conventional mock in place of real USDT, it also cannot validate USDT-specific integration behavior.

# Why 100% coverage was compatible with the bug

Line and function coverage answer only whether code executed. They do not answer whether the assertions constrained the right behavior, whether all meaningful inputs were searched, or whether relevant state sequences were explored. A getter test can cover a getter while merely asserting stored state back to itself. A single deposit and a single withdrawal can execute every accounting line without ever comparing the final recorded assets to independently observed custody.

This defect is relational and stateful: the error is the divergence between two quantities across transitions. Every line responsible for the divergence may execute exactly as written, so coverage can remain 100%. Thirty-nine hand-selected unit tests can likewise all pass if none asserts the missing relationship.

"Every operation is correct in isolation" is the tell because the reported failure is sequence-dependent accounting drift. A deposit can transfer and mint the expected amounts; a withdrawal can pay the withdrawing user the expected net amount and leave the fee in the protocol. Those local outcomes can all be correct. The bug lies in composing them: after the withdrawal, the retained fee is real vault-owned value, but the next accounting state omits it. Repeating the transition grows the discrepancy and causes later share pricing to use the wrong denominator. Unit tests of isolated calls reset the state before the history that exposes that composition error can form.

# The missing property

After every successful operation in every valid sequence, the vault's recorded managed assets must equal the assets actually owned by and recoverable for the vault's shareholders:

```text
vault.totalAssetsStored()
    == vault-owned underlying held directly
     + vault-owned underlying recoverable from the yield protocol
```

Equivalently, if `totalAssets()` is intended to be the authoritative accounting value:

```text
vault.totalAssets() == independentlyMeasuredManagedAssets(vault)
```

The right-hand side must be obtained independently from token custody and the protocol position; it must not call another getter backed by `totalAssetsStored`. If protocol conversions introduce unavoidable rounding, the invariant should specify the protocol's exact rounding rule or a narrowly justified rounding tolerance. It must not be weakened to `recorded <= actual`: that only detects insolvency and deliberately stays green for this precise stranded-surplus bug.

For this fee design, the property also implies that a withdrawal cannot make the retained fee disappear from shareholder accounting. Immediately after a fee-bearing withdrawal, actual managed assets and recorded managed assets must both have fallen only by the net assets paid out (plus any explicitly externalized loss), not by the gross amount debited from the withdrawing user's claim.

# Test shape that catches it

Use a handler-driven Foundry invariant test:

1. The handler creates several funded, approved actors and exposes valid `deposit` and `withdraw`/`redeem` actions.
2. Inputs are bounded to executable ranges so calls meaningfully mutate state rather than mostly reverting.
3. Foundry generates long, interleaved sequences across actors.
4. After every sequence, the invariant independently values the vault's direct underlying and yield-protocol position and asserts exact reconciliation with the recorded total.

In outline:

```solidity
function invariant_accountingMatchesCustody() public view {
    uint256 actual = usdt.balanceOf(address(vault))
        + yieldProtocol.assetsOwnedBy(address(vault));

    assertEq(vault.totalAssetsStored(), actual);
    // Or assertEq(vault.totalAssets(), actual), if that is authoritative.
}
```

The test should `targetContract(address(handler))`, not the vault directly. The handler must arrange balances, approvals, multiple actors, and valid withdrawal limits. During development, enabling `fail_on_revert = true` and checking the calls/reverts statistics prevents a vacuous green invariant in which random calls nearly always revert.

A focused regression test should accompany the invariant: deposit for at least two users, perform at least two fee-bearing withdrawals while one user remains, and after each withdrawal assert the equality above. Also record the reconciliation gap and assert it remains zero. Two fee-producing transitions matter because they demonstrate the cumulative drift described, rather than only a one-off mismatch. Finally, redeem the remaining shares and assert no vault-owned underlying is stranded except explicitly specified rounding dust. The invariant is the broad search; the regression is the permanent minimal example of this particular failure.
