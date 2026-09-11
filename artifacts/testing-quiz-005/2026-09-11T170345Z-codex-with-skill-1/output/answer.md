# What the green suite actually proved

The four tests are examples of particular executions. They do not establish the vault's accounting invariant.

## `test_DepositMintsShares`

This establishes that, from the test's particular initial state and for `DEPOSIT_AMOUNT`, `_deposit` returns `999e18`, and that the vault subsequently reports `999e18` for Alice's share balance. It is useful as a regression test for that one deposit quote and balance update.

It only appears to establish that deposits always mint the economically correct number of shares. It does not independently derive the correct share amount from assets under management and the pre-deposit total supply; test other exchange rates, fees, rounding boundaries, or deposits following withdrawals; or show that the shares remain backed. The return value and `shareBalance` may also be two observations of the same implementation decision. Agreement between them is not evidence that the decision used a correct asset total.

## `test_DepositUpdatesTotalAssets`

This establishes that one deposit into the chosen starting state makes two vault accounting getters report `DEPOSIT_AMOUNT`.

It only appears to establish that `totalAssets` is accurate. Both asserted values are supplied by the vault's own accounting; neither is an independent observation of custody. If `totalAssets()` returns, or is derived from, `totalAssetsStored()`, the test is substantially the ledger being checked against itself. It does not compare the ledger to the USDT balance plus the value of the vault's protocol position. It also tests no withdrawal and therefore cannot observe retained withdrawal fees disappearing from the ledger.

## `test_WithdrawFeeBps`

This establishes only that the public constant/getter is `30` basis points.

It only appears to test withdrawal fees. It says nothing about whether a withdrawal charges 30 bps, which amount is used as the fee base, what the user receives, where the fee goes, or—decisive here—whether the retained fee remains included in managed assets and benefits the remaining shares. A correctly configured constant can feed incorrect transition accounting.

## `test_ConstructorSetsUsdt`

This establishes that construction stores the supplied token address and that `usdt()` returns it.

It only appears to establish correct USDT integration. It does not test real USDT transfer behavior, balances, approvals, protocol deposits or withdrawals, valuation of the protocol position, or reconciliation of those positions with the vault's ledger. It is an assignment/getter test, not an asset-accounting test.

# Why 100% coverage was compatible with the bug

Line and function coverage answer whether code ran, not whether the right property was asserted. A test can execute every line while asserting constants, getters, or expectations copied from the implementation. It can take every deposit and withdrawal path once without ever asking whether accounting equals custody after the paths are composed.

This defect is a state-machine defect. On a withdrawal whose gross share claim is `x` and retained fee is `f`, only `x - f` leaves the managed pool. Therefore managed assets must fall by `x - f`, not by `x`. If the ledger falls by `x` while custody falls by `x - f`, that transition introduces drift of `f`:

```text
actualAfter   = actualBefore   - (x - f)
recordedAfter = recordedBefore - x
actualAfter - recordedAfter = (actualBefore - recordedBefore) + f
```

All lines involved can be covered. A withdrawal can still transfer exactly the advertised net amount, burn the expected shares, and update every tested field according to the implementation. Yet the retained fee is omitted from recorded assets. Repetition accumulates the omitted fees.

That is why “every operation is correct in isolation” is the tell, not the alibi. Vault correctness is about preservation of relationships across state transitions. Checking a deposit only from a clean fixture and a withdrawal only against its immediate quoted output resets or ignores the history in which the defect lives. The relevant question is not whether each call produces a plausible local result, but whether arbitrary valid compositions preserve the global accounting relationship.

# The missing property and the test that should assert it

The required property is accounting-to-custody equality after every successful state transition:

```text
recordedManagedAssets == independentlyMeasuredManagedAssets
```

Here `recordedManagedAssets` is `totalAssetsStored()` (and `totalAssets()` too, if it is intended to report the same quantity). `independentlyMeasuredManagedAssets` must be computed without using either accounting getter: it is the vault's idle underlying balance plus the underlying value currently redeemable from every yield-protocol position owned by the vault. It must include retained withdrawal fees and accrued yield, and exclude assets that the vault does not own. If protocol share-to-asset conversion necessarily rounds, the invariant should specify the smallest justified rounding tolerance; it must constrain drift in both directions. `recorded <= actual` is insufficient because this exact bug creates a surplus and would remain green.

The primary test shape should be a handler-driven Foundry invariant test:

- Create several funded, approved actors.
- Target a handler whose actions perform valid deposits and withdrawals (and, where supported, yield accrual/harvest and full redemptions).
- Bound amounts to valid nontrivial ranges and vary both actors and sequence lengths.
- After every generated sequence, value idle USDT and protocol positions independently, then assert equality with the recorded total.
- Ensure calls actually succeed: inspect call/revert counts and use `fail_on_revert = true` while developing the handler so a no-op invariant run cannot pass vacuously.

In schematic Solidity:

```solidity
function invariant_accountingEqualsCustody() public view {
    uint256 actual = usdt.balanceOf(address(vault))
        + protocol.redeemableAssetsOf(address(vault));

    assertApproxEqAbs(
        vault.totalAssetsStored(),
        actual,
        MAX_JUSTIFIED_ROUNDING_ERROR
    );
}
```

For an exact-valued mock with no conversion rounding, this should be `assertEq`, not `assertApproxEqAbs`.

A focused regression test should additionally make the failure obvious: Alice and Bob deposit, Alice withdraws with a nonzero fee, and the test compares pre/post independent custody with pre/post recorded assets. Both must decrease by exactly the net tokens paid to Alice, while the fee remains in the pool. Repeating withdrawals makes the old implementation's gap equal the sum of retained fees. Finally, Bob's redeemable claim should include those fees. That regression captures the known scenario; the stateful invariant searches for other sequences that violate the same underlying property.
