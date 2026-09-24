# What the green vault suite actually proved

The four tests exercise code, but none of them checks the accounting-to-custody relationship that failed.

## What each test establishes

### `test_DepositMintsShares`

This establishes that, from the fixture's initial state and for exactly `DEPOSIT_AMOUNT`, `_deposit` returns `999e18` and writes the same number to Alice's share balance.

It only appears to establish that deposits mint the economically correct number of shares. The expected value is hard-coded from the same assumptions as the implementation, and the test does not independently derive it from assets, total supply, and the pre-deposit exchange rate. It also says nothing about a deposit after prior deposits, yield, or fee-bearing withdrawals, nor whether the resulting shares remain fully backed.

### `test_DepositUpdatesTotalAssets`

This establishes that one deposit into a fresh fixture makes both `totalAssets()` and `totalAssetsStored()` report `DEPOSIT_AMOUNT`.

It only appears to establish that total-assets accounting is correct. If `totalAssets()` reads or is derived from `totalAssetsStored()`, the two assertions are not independent evidence: they ask the vault's books whether its books agree with themselves. The test never compares either value with independently observed custody, such as the vault's liquid USDT plus its redeemable position in the yield protocol. It also tests the transition that adds assets, not the withdrawal transition on which retained fees create drift.

### `test_WithdrawFeeBps`

This establishes only that the public constant/getter returns `30`.

It only appears to test withdrawal fees. It does not establish that a withdrawal charges 30 basis points, that the user receives the correct net amount, that the fee remains in the strategy, or—critically—that the retained fee remains included in the vault's recorded assets and benefits the remaining shareholders.

### `test_ConstructorSetsUsdt`

This establishes that construction stores the supplied mock token address and that `usdt()` returns it.

It only appears to add confidence in the vault's asset handling. Correct wiring does not establish correct transfers, protocol custody, share valuation, or accounting across transitions. Unless constructor wiring was in doubt, this is a very weak safety property.

## Why 100% coverage was compatible with the bug

Line and function coverage report reachability, not correctness. A test can execute every line—including the faulty withdrawal accounting line—and still never make an assertion capable of distinguishing the faulty result from the correct one. Function coverage likewise says that a withdrawal was called, not that retained fees were reconciled to assets afterward. It also says nothing about whether meaningful input ranges or meaningful operation sequences were explored.

The shown tests are especially coverage-friendly: getter tests execute functions while constraining almost no behavior, and the deposit tests inspect one transition from one initial state. Assertions that compare two values derived from the same stored variable can remain green even when that variable has diverged from reality.

"Every operation is correct in isolation" is therefore the tell. This is a stateful, compositional defect. A withdrawal can burn the expected shares, pay the expected net amount, charge the expected fee, and return the expected values, yet leave the post-state wrong. If gross assets are `G` and the retained fee is `F`, custody falls by only `G - F`. If recorded assets are reduced by `G`, the books fall below custody by `F`. Repeating otherwise plausible operations accumulates that discrepancy. The externally visible result of each call is not the complete correctness condition; preservation of the system-wide accounting invariant is.

## The missing property

After every successful state transition, recorded managed assets must equal independently measured assets under the vault's control:

```text
vault.totalAssetsStored()
    == USDT held directly by the vault
     + USDT-equivalent value independently redeemable by the vault
       from the yield protocol
```

The right-hand side must be obtained from token balances and the protocol position, not from `vault.totalAssets()` or another view backed by `totalAssetsStored()`. If the controlled test protocol has no yield and no rounding, this should be exact. If the real integration necessarily rounds, the test must use a narrowly derived rounding bound; it must not replace equality with `recorded <= custody`, because that one-sided assertion expressly permits the stranded-surplus bug.

For a single withdrawal with no exogenous yield during the transaction, the equivalent transition property is:

```text
storedAfter == storedBefore - assetsActuallyTransferredToWithdrawer
```

Thus, when `G` is redeemed and fee `F` stays invested, `storedAfter` must be `storedBefore - (G - F)`, not `storedBefore - G`.

## Test shape

This belongs in a handler-driven Foundry invariant test:

- The handler owns several funded, approved users.
- Its actions perform bounded, valid deposits and withdrawals (and, if supported, harvests or yield changes), updating no vault bookkeeping itself.
- Foundry targets the handler rather than the vault directly, so generated calls have viable senders, balances, approvals, and withdrawal amounts instead of mostly reverting.
- After every generated sequence, the invariant independently reads direct USDT custody and the vault's redeemable underlying in the yield protocol, sums them, and asserts exact equality with `totalAssetsStored()`.
- Calls/reverts statistics are checked, with `fail_on_revert = true` while developing the handler, to ensure the fuzzer is exploring real transitions.

A focused regression should accompany the invariant: Alice and Bob deposit; Alice withdraws all or part of her position; assert that the fee remains in protocol custody, that recorded assets equal custody, and that Bob's redeemable asset value increases by the retained fee (subject only to explicitly calculated rounding). Repeating deposit/withdraw cycles makes the old defect grow, but the global equality should already fail on the first fee-bearing withdrawal.
