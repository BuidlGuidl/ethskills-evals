# What the tests prove—and what they do not

The suite demonstrates that selected calls produce selected expected snapshots. It does not demonstrate that the vault's accounting remains a faithful ledger of its assets across a sequence of calls.

## `test_DepositMintsShares`

This establishes that, from the particular state created by `setUp`, depositing `DEPOSIT_AMOUNT` through `_deposit` returns `999e18` shares and records the same number for Alice.

It only appears to establish that share issuance is economically correct. The expected `999e18` may merely repeat the implementation's formula. The test does not independently reconcile the issued shares with assets received, total share supply, the pre-deposit exchange rate, rounding, or later redeemability. In particular, it says nothing about whether a retained withdrawal fee is reflected in the assets backing those shares.

## `test_DepositUpdatesTotalAssets`

This establishes that one deposit into a fresh fixture makes both public accounting views return `DEPOSIT_AMOUNT`.

It only appears to establish that `totalAssets` is correct. Both values may be backed by the same storage variable, so comparing them to each other adds no independent oracle. Even comparison with the deposit amount checks only the deposit transition. It never compares recorded assets with the assets independently observable in the yield protocol, and it never checks the accounting after a withdrawal leaves a fee behind.

## `test_WithdrawFeeBps`

This establishes only that the exposed constant is `30` (0.30%).

It only appears to test withdrawal fees. It does not establish that the fee is calculated on the right base, that the user receives the correct net amount, that only that net amount leaves the protocol, or—crucially—that the retained fee remains in `totalAssetsStored` and therefore belongs to the remaining shareholders. It tests configuration, not fee behavior or fee accounting.

## `test_ConstructorSetsUsdt`

This establishes that the constructor stores the supplied token address and `usdt()` returns it.

It only appears to provide meaningful assurance about the asset integration. It does not establish correct USDT transfers, protocol balances, valuation, accounting reconciliation, or handling of token behavior. It is a wiring/getter test and has no bearing on the loss mechanism.

# Why 100% coverage did not help

Line and function coverage answer whether execution visited code, not whether the tests asserted the right economic consequence. A test can execute every line in `withdraw`, assert the caller's net payment and burned shares, and still omit the one relationship that makes retained fees claimable. It is also possible for assertions to duplicate the contract's own mistaken bookkeeping, so both implementation and expected value agree while reality disagrees.

Coverage is insensitive to history. The bug is a bad state transition whose damage is visible only by relating pre-state, post-state, and an independent measure of assets. Thirty-nine isolated fixtures can cover every branch without ever composing `deposit -> deposit -> withdraw -> withdraw` or checking a global invariant after each step.

That is why “every operation is correct in isolation” is the tell. A vault is a state machine, and its central obligation is conservation across transitions. Here a withdrawal can be locally correct—the requested shares are burned, the user receives the correct amount after a 30 bps fee, and the fee physically stays invested—while the accounting transition is globally wrong if recorded assets are reduced by the gross amount rather than the amount that actually left. Each local output looks right; the ledger diverges from reality. Repetition then compounds the divergence and understates the exchange rate for everyone remaining.

# The missing property

The suite needed an asset-reconciliation invariant:

> After every successful state-changing operation, the vault's recorded total assets must equal the independently measured assets economically owned by the vault across all of its locations, including idle tokens and tokens or claims held in the yield protocol, subject only to an explicitly defined rounding tolerance.

Precisely, if `actualBacking(s)` independently values all vault-owned positions in state `s`, then for every reachable state:

```text
totalAssetsStored(s) == actualBacking(s)       // or absDiff <= documented rounding bound
```

For the fee-bearing withdrawal transition, the equivalent conservation law is:

```text
recordedAfter = recordedBefore - tokensActuallyPaidOut
```

not:

```text
recordedAfter = recordedBefore - grossAssetsRepresentedByBurnedShares
```

because `grossAssets - tokensActuallyPaidOut` is the retained fee and is still backing the remaining shares. If yield may accrue during the transition, the equation must additionally include independently measured yield; the reconciliation invariant remains the more general statement.

# Test shape

A focused regression test should use at least two depositors so somebody remains to own the fee:

1. Alice and Bob deposit.
2. Snapshot `totalAssetsStored`, independently query the vault's idle balance plus its balance/claim in the yield protocol, and snapshot Bob's shares.
3. Alice withdraws or redeems some or all of her shares.
4. Measure the tokens Alice actually received and the protocol's actual remaining backing.
5. Assert that `storedAfter == storedBefore - amountReceivedByAlice` (within only the documented rounding bound).
6. Independently assert that `storedAfter == actualBackingAfter`.
7. Assert that the retained fee increases the assets attributable per remaining share: Bob's redeemable asset value includes his share of that fee. A final Bob redemption can additionally prove that no residual asset becomes stranded once all shares are redeemed.

The stronger Foundry test is a handler-based invariant test. The handler performs bounded deposits and withdrawals/redeems for several actors in arbitrary sequences. After every call, an invariant function computes actual backing directly from the token and yield-protocol positions—not through `vault.totalAssets()` or another view derived from `totalAssetsStored`—and compares it with the recorded total. It should also track external inflows/outflows so that the conservation equation is independently derived. Random sequence depth and fuzzing vary amounts, ordering, partial withdrawals, rounding boundaries, and the identity of the last remaining depositor.

That test fails on the first fee-bearing withdrawal that subtracts the gross amount from storage while transferring only the net amount out. It catches the defect immediately, before a long production history makes the discrepancy large.
