# What the suite proved—and what it missed

The suite's 39 green tests and 100% line/function coverage show that the tested code ran and that the listed example assertions held. They do not show that the vault preserves its accounting relationships over time. The bug is a state-machine bug: each transition can look locally plausible while a sequence of transitions moves two representations of the same value apart.

## What each test actually establishes

### `test_DepositMintsShares`

This establishes that, from the particular fixture state, depositing exactly `DEPOSIT_AMOUNT` through `_deposit(alice, ...)` returns `999e18` and leaves Alice's recorded share balance at `999e18`.

It only appears to establish that deposit share accounting is generally correct. It says nothing about:

- other deposit sizes, rounding boundaries, or states with a non-unit share price;
- deposits made after withdrawals or after retained fees have changed the vault's economic assets;
- whether the returned shares fairly represent Alice's fraction of assets actually held;
- whether total share supply and all user balances remain consistent;
- whether those shares can later redeem the proper fraction of all assets.

The two assertions are also closely coupled: both may be derived from the same incorrect mint calculation. Agreement between a return value and storage does not independently validate the economics.

### `test_DepositUpdatesTotalAssets`

This establishes that one deposit into the fixture makes both `totalAssets()` and `totalAssetsStored()` equal `DEPOSIT_AMOUNT`.

It only appears to establish that `totalAssets` tracks the vault's assets. Both observations may read the same internal accounting value, so they can agree with each other while both disagree with custody. The test never compares the recorded amount with the underlying tokens held directly plus the amount claimable from the yield protocol. It also never checks the value after a fee-bearing withdrawal, much less after repeated deposits and withdrawals.

### `test_WithdrawFeeBps`

This establishes only that the public getter returns the configured constant `30`.

It only appears to test withdrawal fees. It does not establish that 30 basis points are calculated with the intended denominator and rounding, collected in the intended place, left invested, credited to remaining shares, included in total assets, or eventually redeemable. The bug can exist with this test permanently green because the constant can be correct while every accounting use of it is wrong or incomplete.

### `test_ConstructorSetsUsdt`

This establishes that construction stores the supplied mock token address and that `usdt()` returns it.

It only appears to establish that the token integration is correct. It does not test transfers, approvals, actual received amounts, protocol custody, or reconciliation against token balances. In particular, it provides no evidence that the real USDT/protocol position and the vault's internal ledger remain equal. It is essentially a wiring test.

## Why 100% coverage was compatible with the bug

Coverage answers whether a line or function executed, not whether the test placed a meaningful, independent constraint on its result. A test can execute every line while asserting getters against the storage they expose, constants against their declared values, and one transition against values calculated by the same flawed bookkeeping.

Line and function coverage also have no notion of history. The same withdrawal lines may be covered once, but the relevant state space includes sequences such as deposit, deposit, withdraw, deposit, withdraw, with different actors, amounts, rounding outcomes, and share prices. Covering the transition code is not equivalent to exploring compositions of transitions.

Here, the retained fee changed external economic custody without being reflected in the internal total. Nothing about 100% line or function coverage requires a comparison between those two quantities, so coverage could remain perfect while the accounting gap grew.

## Why “correct in isolation” is the tell

For a stateful system, correctness is not merely that each call returns a plausible local result. Every call must also preserve the system's invariants. If deposits and withdrawals each look right when started from a clean fixture, but real usage drifts over time, that strongly indicates that a transition omits part of its effect on persistent state.

That is exactly what a retained withdrawal fee does here: the operation can transfer the requested net amount correctly, calculate the fee correctly, and burn the expected shares, yet fail to carry the retained fee into the vault's recorded assets. The post-state then becomes the faulty pre-state for the next call. Repetition compounds the divergence. “Each operation is correct in isolation” therefore describes the blind spot in the tests; it is not evidence that the state machine is correct.

## The missing property

Ignoring deliberately excluded donations and accounting for any protocol yield according to the vault's stated synchronization rules, the invariant should be:

```text
recordedTotalAssets == underlying held directly by the vault
                     + underlying currently claimable from the yield protocol
```

Equivalently, define `economicAssets()` as all underlying economically owned and recoverable by the vault. At every quiescent point at which the vault promises synchronized accounting:

```solidity
assertEq(vault.totalAssetsStored(), economicAssets());
assertEq(vault.totalAssets(),       economicAssets());
```

This must be an equality, not merely `recordedTotalAssets <= economicAssets()`. That one-sided solvency check detects liabilities exceeding holdings but stays green for this exact failure mode, where holdings exceed recorded claims and value becomes stranded. If unsolicited token donations are possible and intentionally excluded, the custody side must use the protocol position and balance changes attributable to vault operations, or the test must avoid donations; the property should not be weakened into a one-sided bound.

The most useful test shape is a handler-driven Foundry invariant test:

1. The handler owns several funded, approved actors.
2. Its actions make bounded valid deposits and withdrawals/redemptions, including partial and full exits and amounts around fee-rounding boundaries.
3. The invariant runner generates long, interleaved sequences rather than resetting the fixture after every action.
4. After every generated sequence, the invariant computes direct underlying custody plus the yield protocol's redeemable/claimable underlying and asserts exact equality with the vault's recorded total.
5. Calls/reverts statistics are checked, and `fail_on_revert = true` is used while constructing the handler, so a green result cannot come from all generated actions reverting.

A focused regression test should additionally demonstrate the known path with at least two transitions—for example, Alice deposits, Bob deposits, Alice performs a fee-bearing withdrawal, then Bob withdraws or redeems—and assert the equality after each step. It should also assert that Bob's remaining shares gain the retained fee economically: Bob's pro-rata redeemable claim includes that fee, and after the final legitimate holder exits there is no vault-attributable residual left in either the vault or the protocol.

The regression test proves this defect is fixed. The stateful invariant searches for other sequences that violate the same accounting law. Both are valuable, but the invariant is the property the original suite was missing.
