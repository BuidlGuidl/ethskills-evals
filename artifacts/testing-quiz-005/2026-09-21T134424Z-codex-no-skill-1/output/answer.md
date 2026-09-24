The tests shown are not useless, but they are much narrower than the conclusion being drawn from them.

`test_DepositMintsShares` establishes that, in the tested initial state, one deposit mints the expected number of shares and records those shares for the depositor. It only appears to establish that share accounting is economically correct. It does not check what a share is worth after other users enter and leave, whether share price is preserved across sequences, or whether retained withdrawal fees are reflected in the assets backing the remaining shares.

`test_DepositUpdatesTotalAssets` establishes that after a simple deposit, `totalAssets()` and `totalAssetsStored()` equal the deposited amount. It only appears to establish that the vault's asset accounting matches reality. In this test there has been no withdrawal fee, no retained balance, no prior share-price movement, and no opportunity for the stored total to diverge from the real tokens held by the strategy. It checks the easiest state, not the invariant.

`test_WithdrawFeeBps` establishes only that the configured constant is `30`. It only appears to establish that withdrawal fees are handled correctly. It does not execute a withdrawal, does not check who receives the fee, and does not check whether the fee remains inside both the underlying protocol and the vault's accounting.

`test_ConstructorSetsUsdt` establishes that the vault was constructed with the expected USDT address. It only appears to establish that the vault is correctly wired. Correct token configuration says nothing about the accounting rule that must hold after fee-bearing withdrawals.

So 100% line and function coverage was compatible with the bug because coverage answers a very small question: did the tests execute these lines and functions? It does not answer whether the assertions captured the contract's economic obligations. A suite can execute the withdrawal path, burn shares, transfer the net amount, apply the correct fee rate, update a stored total, and still never assert that the retained fee is still counted as assets belonging to the remaining shareholders.

The phrase "every operation is correct in isolation" is the tell. This is a stateful accounting bug, not a single-call revert-or-transfer bug. The missing behavior is compositional: after each individually plausible deposit or withdrawal, the global relationship between real assets, recorded assets, total shares, and user claims must still hold. If the postcondition for a withdrawal says only "the withdrawer got the right net amount" and "the right shares were burned", then the test has left out the part that matters to everyone who stayed in the vault. A retained fee is not gone. If it remains in the protocol, it must remain in the vault's accounted assets.

The property the suite should have asserted is:

> After any sequence of deposits and withdrawals, the vault's recorded total assets must equal the actual underlying assets owned by the vault in the yield protocol, including withdrawal fees retained in the protocol. Equivalently, a withdrawal fee retained for remaining shareholders must not reduce accounted assets; accounted assets should decrease only by the amount actually paid out of the vault.

In formula form, for a withdrawal from a state with actual assets `A_before` and recorded assets `T_before`, if the user receives `netOut` and the fee `fee` stays in the protocol, then:

```text
actualAssetsAfter == A_before - netOut
totalAssetsStoredAfter == T_before - netOut
totalAssetsAfter == actualAssetsAfter
```

Not:

```text
totalAssetsStoredAfter == T_before - netOut - fee
```

The test shape should be sequence-based, with at least one remaining shareholder:

1. Alice deposits.
2. Bob deposits.
3. Bob withdraws some or all of his shares and pays the withdrawal fee.
4. Assert that the underlying protocol still holds the retained fee.
5. Assert that `vault.totalAssets()` and `vault.totalAssetsStored()` equal the actual underlying balance attributable to the vault.
6. Assert that Alice can redeem against that full accounted balance, including Bob's retained fee.

As a stronger invariant/fuzz test, generate random sequences of deposits and withdrawals across several users. After every operation, compare the vault's recorded assets to the real balance in the underlying protocol and assert they are equal. That property would catch the drift immediately, because the first fee-bearing withdrawal that subtracts the fee from the stored total while leaving the tokens in the protocol breaks the invariant.
