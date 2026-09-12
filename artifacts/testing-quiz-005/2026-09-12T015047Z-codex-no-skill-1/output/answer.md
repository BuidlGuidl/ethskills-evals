# What the tests prove—and what they do not

`test_DepositMintsShares` proves that, in the fixture's initial state, one deposit through `_deposit` returns `999e18` shares and credits that many shares to Alice. It does not prove that those shares represent the right fraction of the vault's real assets, that the exchange rate remains correct after earlier withdrawals, or that all assets backing the shares are included in the accounting. The hard-coded result can remain true while the vault-wide denominator is wrong in later states.

`test_DepositUpdatesTotalAssets` proves that this particular deposit makes both getters return `DEPOSIT_AMOUNT`. It does not reconcile either getter to an independent source of truth. If `totalAssets()` is derived from, or merely exposes, `totalAssetsStored`, the two assertions are effectively checking the same book entry twice. The test only appears to show that the vault has accounted for everything it owns. It never compares the book entry with the vault's idle token balance plus its redeemable position in the yield protocol, and it never enters the state in which a withdrawal fee has been retained.

`test_WithdrawFeeBps` proves only that a configuration constant is 30 basis points. It says nothing about whether the fee is charged, where it goes, how much leaves the protocol, or whether the retained amount remains in `totalAssetsStored` and benefits the remaining shares.

`test_ConstructorSetsUsdt` proves only that the constructor stores the expected token address. It says nothing about asset conservation or withdrawal accounting.

# Why 100% coverage did not help

Line and function coverage answer structural questions: did execution visit every line and enter every function? They do not answer whether the assertions characterize the contract's required economics. A withdrawal test can execute every fee-calculation and accounting line, assert that the withdrawing user received the correct net amount, and still omit the relationship between the updated stored total and the assets that remain in the protocol. Coverage also does not imply useful coverage of state histories, combinations of calls, boundary values, or interactions among users.

That is why all 39 tests could be green. They checked selected local outputs, while the defect is a broken transition invariant. In particular, if a withdrawal deducts the gross withdrawal from `totalAssetsStored` but transfers only the net amount out of the yield protocol, the retained fee remains real backing while disappearing from the books. No executed line is necessarily uncovered; the missing item is an assertion.

“Every operation is correct in isolation” is the tell because vault correctness is compositional and history-dependent. A deposit can mint the locally expected number of shares, and a withdrawal can burn the expected shares and pay the expected net tokens, while their combined state transition violates conservation. The fee is not merely part of the withdrawing user's output calculation: because it stays invested, it must also be part of the post-withdrawal backing of every remaining share. A test suite focused on isolated calls is exactly where such drift can hide.

# The property that should have been asserted

After every successful state-changing operation, the vault's reported total assets must equal all assets economically owned and redeemable by the vault:

```text
vault.totalAssetsStored()
    == idle USDT held by the vault
     + USDT currently redeemable from the yield protocol for the vault's position
```

If `totalAssets()` is the canonical public accounting value, it must equal that same independently measured quantity as well. The protocol-side term must be measured from the mock/protocol position, not calculated from `totalAssetsStored`; otherwise the test is circular. Any genuine yield or loss should appear on the physical side of this equality according to the vault's synchronization rules.

For the fee-bearing withdrawal specifically, let `A` be actual managed assets before withdrawal, `G` the gross assets represented by the shares being redeemed, `F` the withdrawal fee, and `N = G - F` the amount sent to the user. Because the fee stays in the protocol, the required postcondition is:

```text
actualManagedAssetsAfter == A - N
reportedTotalAssetsAfter == A - N
                         == A - G + F
```

Reducing the reported total by `G` is the bug: it creates a discrepancy of exactly `F` on that withdrawal.

The decisive test should contain a sequence, at minimum with a remaining shareholder:

1. Alice deposits and Bob deposits.
2. Record the independently measured managed assets and Bob's claim/share price.
3. Alice withdraws or redeems, paying a nonzero fee that remains in the yield protocol.
4. Measure the vault's idle balance and protocol position independently.
5. Assert that both `totalAssetsStored()` and `totalAssets()` equal their sum; equivalently for this transition, assert that the total fell by the net payout, not by the gross redemption.
6. Assert that Bob can redeem his proportional claim including the retained fee (subject only to any fee charged on Bob's own eventual withdrawal).

This should also be encoded as a stateful invariant/fuzz test whose handler performs arbitrary deposits, withdrawals/redemptions, and any modeled yield changes across multiple users. After every action it should assert the reconciliation equality. A useful diagnostic assertion is that cumulative book-to-physical drift is always zero—not merely that each call returned its expected local value. The first fee-bearing withdrawal would then fail immediately, and a long randomized sequence would prevent the same class of accounting error from returning.
