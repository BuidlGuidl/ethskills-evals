# Why the green suite missed the vault drift

The tests shown establish a few facts about particular snapshots. They do not establish the stateful accounting property on which the vault depends.

## What each test proves

### `test_DepositMintsShares`

This establishes that, from the test's particular initial state and for the single value `DEPOSIT_AMOUNT`, `_deposit` returns `999e18` and records the same number in Alice's share balance.

It only appears to establish that deposits mint the correct number of shares. The expected value is a hand-written example, not an independent property. It says nothing about other amounts, exchange rates, prior deposits, accumulated fees, multiple users, rounding boundaries, or a deposit after withdrawals have changed the relationship between shares and assets. The agreement between the return value and `shareBalance` also checks internal consistency of two outputs of the same operation; it does not prove that those shares represent the correct claim on the assets under custody.

### `test_DepositUpdatesTotalAssets`

This establishes that one deposit into a fresh fixture makes both `totalAssets()` and `totalAssetsStored()` equal `DEPOSIT_AMOUNT`.

It only appears to establish correct asset accounting. If `totalAssets()` is backed by the same stored accounting variable, the two assertions observe the same ledger twice. Neither compares that ledger with an independent source of truth, such as the underlying tokens held directly by the vault plus the underlying value claimable from the yield protocol. It also tests no withdrawal, retained fee, or multi-call history—the exact circumstances in which the two quantities diverge.

### `test_WithdrawFeeBps`

This establishes only that the public constant/getter returns `30`.

It only appears to test withdrawal fees. It does not show that a withdrawal charges 30 basis points, that the recipient receives the right amount, or—most importantly here—that the retained fee remains included in vault assets and therefore belongs proportionally to the remaining shares. It is a configuration test, not an accounting test.

### `test_ConstructorSetsUsdt`

This establishes that construction stores the supplied mock token address and exposes it through `usdt()`.

It only appears to validate the token integration. It does not establish correct transfers, balances, protocol deposits/withdrawals, or behavior of real USDT. It is essentially a wiring assertion.

## Why 100% coverage was compatible with the bug

Line and function coverage report execution, not correctness. A line is covered once it runs; coverage does not care whether any assertion independently constrained its result. These tests can execute every deposit and withdrawal branch while asserting constants, freshly written storage, and isolated expected examples. The faulty withdrawal accounting line can therefore be covered on every run and still never be challenged by an assertion that compares accounting with custody.

Nor do 39 tests imply useful state-space exploration. Many single-call examples can cover all code while testing none of the histories that make a stateful system fail. Coverage does not measure operation ordering, actor interaction, amount ranges, accumulated rounding, or whether a purported invariant held after each transition.

"Every operation is correct in isolation" is the tell because the reported failure is drift: a relational error that accumulates across transitions. A withdrawal can transfer the correct net amount to its caller and charge the correct fee, yet update `totalAssetsStored` as though the gross amount—including the retained fee—left the vault. That call looks locally plausible. Only the post-call relationship between the accounting ledger and the vault's remaining economic assets reveals the error. Repeating such locally plausible calls compounds it. Stateful protocols must therefore be tested by properties preserved across arbitrary valid sequences, not only by expected outputs of individual calls.

## The missing property

At every quiescent state after any valid sequence of deposits and withdrawals, the vault's recorded assets must equal the underlying assets economically owned and redeemable by the vault:

```text
totalAssetsStored
    == underlying held directly by the vault
     + underlying currently claimable by the vault from the yield protocol
```

Equivalently, if `totalAssets()` is intended to report that economic ownership from independent live balances, the property is:

```text
totalAssetsStored == totalAssetsFromCustody()
```

`totalAssetsFromCustody()` must be computed independently from token balances and protocol positions; it must not read or derive from `totalAssetsStored`. Any legitimate protocol yield or loss needs an explicit synchronization rule, or the invariant should compare immediately after synchronization. Under the stated model, a retained withdrawal fee remains on the custody side and must also remain on the recorded-assets side.

This must be an equality. A check such as `totalAssetsStored <= actualAssets` tests only solvency and stays green for this exact bug, where actual assets exceed recorded assets and value becomes stranded.

## Test shape that catches it

Use a handler-driven Foundry invariant test:

1. The handler creates several funded, approved actors.
2. Its actions perform valid deposits and withdrawals, bounding amounts to meaningful nonzero ranges and existing balances/shares.
3. Foundry generates long, reordered sequences across those actors.
4. After every generated sequence, the invariant independently values the vault's idle underlying and yield-protocol position, then asserts exact equality with `totalAssetsStored` (subject only to a deliberately specified rounding tolerance, if the protocol truly requires one).
5. Configure and inspect the run so calls actually succeed; while developing the handler, `fail_on_revert = true` prevents a vacuously green invariant caused by discarded reverting calls.

A focused regression sequence should accompany the invariant: Alice deposits, Bob deposits, Alice withdraws and pays a fee, then compare recorded assets with independently measured custody and verify Bob's redeemable claim/share price includes Alice's retained fee. Repeat withdrawals to demonstrate that no drift accumulates. That regression proves the known failure stays fixed; the invariant searches for other amounts, actors, and orderings that violate the same fundamental conservation property.
