# What the green tests actually proved

`test_DepositMintsShares` establishes that, from the test's particular initial state and for the single hard-coded `DEPOSIT_AMOUNT`, `deposit` returns `999e18` and credits that many shares to Alice. It is a useful example test for that one transition.

It only appears to establish that share minting is economically correct. It does not independently calculate the shares from the vault's real assets and supply, test a deposit after fees have accumulated, or show that those shares represent the right fraction of custody. In particular, if both the mint calculation and the expectation rely on an already-understated internal asset total, the test can remain green while new depositors receive the wrong economic stake. It also says nothing about conservation across a later withdrawal.

`test_DepositUpdatesTotalAssets` establishes that a deposit of `DEPOSIT_AMOUNT` makes two accounting getters report `DEPOSIT_AMOUNT` in the initial scenario.

It only appears to establish that the vault accounts for all assets. Both assertions inspect the vault's own representation: one stored value is effectively being checked against another value/getter produced by the same implementation. There is no independent custody observation, such as the underlying balance or the vault's position in the yield protocol. Nor is the assertion made after a withdrawal or after a sequence of mixed operations. Thus it proves that the ledger was updated as expected on one deposit, not that the ledger remains reconciled to assets under management.

`test_WithdrawFeeBps` establishes only that the deployed contract exposes the configured constant `30`.

It only appears to test withdrawal fees. It does not show that a withdrawal charges 30 basis points, that rounding is correct, that the recipient receives the net amount, that the fee stays in the yield position, or—critically—that the retained fee remains included in `totalAssetsStored` and in the share price. A correctly configured constant can feed incorrect accounting.

`test_ConstructorSetsUsdt` establishes that the constructor stored the supplied token address and that the getter returns it.

It only appears to establish correct token integration. It says nothing about balance changes, approvals, transfer behavior, token decimals, or the amount actually held after protocol interactions. This is wiring/configuration coverage, not an economic property.

# Why 100% coverage was compatible with the bug

Line and function coverage answer whether code executed, not whether the right facts were asserted about its result. One test can traverse every line of a deposit or withdrawal while checking only a return value, a getter, or a constant. Coverage also has no notion of an independent source of truth: comparing stored accounting with a getter backed by the same accounting can cover everything and constrain almost nothing.

Most importantly, this defect is trace-dependent. The broken state is the relationship between accounting and custody after a history of actions. A collection of tests that resets to a clean fixture and exercises one operation at a time never explores that state space. Thirty-nine examples do not become a sequence test merely because their aggregate coverage is 100%.

"Every operation is correct in isolation" is therefore the tell. It indicates that the suite specified local transition outputs but not the global invariant those transitions must preserve. If a withdrawal of gross amount `x` pays `x - fee` out while leaving `fee` in the yield protocol, custody decreases only by the net payout. If recorded assets instead decrease by `x`, that one transition creates drift of exactly `fee`. The payout, fee calculation, and storage write may each match their narrow unit-test expectations; their composition violates conservation. Repeating such locally accepted transitions accumulates an economically material error.

# The property that should have been asserted

For every reachable vault state after any valid sequence of deposits, withdrawals, and redemptions:

```text
recordedManagedAssets == actualUnderlyingControlledByVault
```

Here `recordedManagedAssets` is the accounting amount used to price shares (for example, `totalAssetsStored`). `actualUnderlyingControlledByVault` must be measured independently and must include all underlying economically owned by the vault: loose tokens plus the redeemable underlying value of its yield-protocol position. If the fixture models yield, both sides must use the same well-defined point-in-time conversion and account for genuine yield; the test must not obtain the right-hand side from the vault's accounting getter.

The assertion must be equality. A solvency check such as `recordedManagedAssets <= actualUnderlyingControlledByVault` would remain green for this exact bug, because the defect produces surplus custody and stranded value.

The withdrawal transition can also be stated precisely. If the pre-state is reconciled, a withdrawal whose gross share claim is `x`, whose retained fee is `f`, and whose external payout is `x - f` must satisfy:

```text
actualAfter   = actualBefore   - (x - f)
recordedAfter = recordedBefore - (x - f)
```

Equivalently, the retained `f` must remain on both sides of the vault's accounting/custody reconciliation and therefore continue to benefit the remaining shares. An implementation that subtracts gross `x` from recorded assets fails immediately by `f`.

The appropriate test shape is a handler-driven Foundry invariant test:

1. A handler owns several funded actors with valid approvals.
2. Handler actions perform deposits, withdrawals, and redemptions with fuzzed amounts bounded to valid ranges, while ensuring calls actually succeed.
3. Foundry targets the handler, not the vault directly, so random sequences reach meaningful multi-user states rather than mostly reverting.
4. After every generated sequence, the invariant independently values the vault's loose underlying and yield-protocol position, then asserts exact equality with the recorded managed assets.
5. The run is configured or inspected to prevent a high revert rate from making the invariant vacuously green (`fail_on_revert = true` is useful while developing the handler).

A focused regression sequence should accompany the invariant: Alice deposits, Bob deposits, one actor withdraws with a nonzero fee, then assert that the protocol-retained fee is still included in recorded assets and in the remaining holder's redeemable value. Repeat withdrawals (and vary actors and amounts) to demonstrate that no drift accumulates. That regression documents this incident; the stateful invariant searches for this and other unanticipated sequences.
