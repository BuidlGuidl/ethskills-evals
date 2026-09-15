# Why the green suite missed the vault's accounting drift

The tests establish facts about particular fields and return values at particular moments. They do not establish that the vault's ledger continues to represent all assets economically owned by its shareholders.

## What each test does—and does not—establish

### `test_DepositMintsShares`

This establishes that, from the fixture's initial state, depositing `DEPOSIT_AMOUNT` returns `999e18` shares and credits exactly that many shares to Alice. It checks agreement between the deposit's return value and Alice's recorded balance for one example.

It only appears to establish that share issuance is economically correct. The test does not derive the expected shares from the vault's assets and supply before the deposit, check the resulting exchange rate, or ask whether those shares represent the correct fraction of the assets actually held. It also says nothing about deposits made after fees have accumulated or after the stored and real asset balances have diverged. A deposit can mint the locally expected number while using a stale, understated denominator and thereby dilute existing holders.

### `test_DepositUpdatesTotalAssets`

This establishes that, immediately after one deposit in the initial fixture, both `totalAssets()` and `totalAssetsStored()` equal `DEPOSIT_AMOUNT`.

It only appears to establish that total-asset accounting is correct. If `totalAssets()` merely exposes or is derived from the same stored accounting as `totalAssetsStored()`, the two assertions are not independent evidence: they compare the ledger with itself. Even if the accessors have separate code, this test never reconciles either value to the vault's wallet balance plus its redeemable position in the yield protocol. It tests the easy transition—depositing principal—but not the transition in which retained withdrawal fees become assets of the remaining shareholders.

### `test_WithdrawFeeBps`

This establishes only that the public constant/configuration value is `30` basis points.

It only appears to test withdrawal fees. It does not establish that a withdrawal charges 30 bps, that the user receives the correct net amount, where the fee remains, or—critically—that the retained fee remains included in `totalAssetsStored()` and in the remaining shares' exchange rate. Correct fee configuration is not correct fee accounting.

### `test_ConstructorSetsUsdt`

This establishes that the constructor stores the supplied USDT address in `vault.usdt()`.

It only appears to contribute to correctness of the vault as a whole. It says nothing about accounting, protocol positions, withdrawals, fees, or shareholder claims. It is a valid wiring test, but irrelevant to the observed loss.

## Why 100% coverage was compatible with the bug

Line and function coverage report which implementation locations executed, not whether the tests asserted the right semantics after executing them. A withdrawal test can run every line of fee calculation, protocol interaction, transfer, and stored-total update while asserting only the caller's returned amount or token receipt. The faulty subtraction is therefore “covered” even though nobody checks its effect on the assets attributed to those who remain.

Coverage also does not supply histories. Executing deposit and withdrawal functions in separate tests from a fresh fixture is not equivalent to checking a sequence of deposits and withdrawals against an independent accounting model. Nor does 100% line coverage imply branch, boundary, invariant, or state-transition coverage. Even full branch coverage would not prove the conservation relationship needed here.

The two total-asset assertions may compound the problem if both values share the same source of truth. Agreement between correlated views is not reconciliation against reality.

## Why “correct in isolation” is the tell

This is a state-machine/accounting bug. Its defining symptom is that each call's immediate observable result can be plausible while the post-state is wrong for the next call. A withdrawing user can receive exactly the promised net amount, the fee can physically remain in the yield protocol, and the burn can complete correctly. Nevertheless, if the stored total is reduced by the gross withdrawal amount rather than by the assets that actually leave the vault's ownership, the ledger omits the retained fee.

For example, if a withdrawal is quoted as gross amount `A`, fee `F`, and net payment `A - F`, while `F` stays in the protocol, the vault's real assets fall by only `A - F`. Its recorded assets must fall by the same amount. Reducing the recorded total by `A` creates a discrepancy of `F`. Repeating otherwise successful operations accumulates that discrepancy. Future share prices are then computed from an understated asset total, and no share represents the omitted assets.

So “every operation is correct in isolation” points directly to a missing relational property across transitions: the suite validated outputs, but not conservation of owned assets and shareholder claims over a history.

## The property the suite needed

After every successful state-changing operation, the vault's accounted assets must equal all assets economically owned by the vault:

```text
totalAssetsStored
    == usdt.balanceOf(vault)
     + protocol.redeemableAssets(vault)
```

Here `protocol.redeemableAssets(vault)` must be an independent valuation of the vault's complete protocol position, including retained withdrawal fees and accrued yield. If protocol conversion rounds, the assertion should use the protocol's specified rounding rule or a tightly justified rounding bound—not a tolerance large enough to hide cumulative drift.

Equivalently, for a withdrawal transition with no yield or external transfer during the call:

```text
accountedAssetsBefore - accountedAssetsAfter
    == realAssetsBefore - realAssetsAfter
    == assetsActuallyPaidOut
```

Thus, when a fee remains owned by the vault, it must not disappear from accounted assets. For gross `A` and retained fee `F`, both real and recorded assets should decrease by `A - F`, not by `A`.

The strongest test shape is a stateful invariant test with an independent reference model:

1. Have multiple actors perform arbitrary sequences of deposits and withdrawals, including partial and full withdrawals, deposits after fee-bearing withdrawals, and repeated churn. Include time/yield changes if the production vault supports them.
2. After every action, independently query the vault's loose USDT balance and the protocol's redeemable value of its entire position.
3. Assert the reconciliation property above, with only protocol-defined rounding allowance.
4. Track the model's asset delta for each transition and assert that a withdrawal reduces vault-owned assets and the stored total only by the net tokens that ceased to be vault-owned.
5. Also assert that the value represented by all outstanding shares uses that reconciled total, so a later depositor cannot receive shares priced against an understated balance.

A focused regression test should make the bug unmistakable: Alice and Bob deposit; Alice withdraws an amount that produces a nonzero fee; the test verifies Alice's net receipt and verifies that the fee remains in the protocol; then it asserts that `totalAssetsStored()` equals wallet assets plus the full redeemable protocol position. It should additionally check that Bob's redeemable claim increased by, or includes his proportional entitlement to, the retained fee. Repeating the withdrawal several times is useful because the expected discrepancy becomes the sum of retained fees, but the invariant should fail immediately after the first nonzero fee.

That reconciliation—not another example assertion and not a higher coverage percentage—is the missing specification.
