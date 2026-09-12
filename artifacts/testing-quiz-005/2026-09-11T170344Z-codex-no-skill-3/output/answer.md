# What the tests prove—and what they do not

`test_DepositMintsShares` proves that, from the test's particular initial state, one deposit of `DEPOSIT_AMOUNT` returns `999e18` shares and credits that same number to Alice. It does not prove that the shares are fairly priced against all assets attributable to the vault, that the exchange rate remains correct after a withdrawal fee has been retained, or that deposits compose correctly with earlier deposits and withdrawals. The expected value can remain internally consistent with an already understated asset total.

`test_DepositUpdatesTotalAssets` proves that immediately after one deposit, both public accounting views equal the amount deposited. It only appears to prove that the accounting represents the vault's assets. At that moment no withdrawal fee has yet been retained, so the state that creates the discrepancy has never occurred. Further, if `totalAssets()` is derived from `totalAssetsStored()`, comparing the two checks two expressions of the same bookkeeping value, not the bookkeeping value against an independent source of truth such as the strategy's underlying-token balance.

`test_WithdrawFeeBps` proves only that the configured constant is 30 basis points. It does not prove that a withdrawal charges that fee, sends the correct net amount, leaves the fee in the strategy, or—most importantly—continues to include the retained fee in total assets and the share price.

`test_ConstructorSetsUsdt` proves only that the constructor stored the expected token address. It says nothing about asset conservation or withdrawal accounting.

# Why 100% coverage did not help

Line and function coverage answer whether code was executed, not whether the important relationships between states were asserted. A test can execute every withdrawal line, check the user's net receipt and the burned shares, and still never compare the vault's recorded assets with the assets it actually controls. Coverage also does not imply coverage of histories: a line reached once in a clean fixture says nothing about its effect after many interacting deposits and withdrawals.

This bug is a failure of composition. Suppose a withdrawal has gross amount `g` and fee `f`, and the user receives `g - f`. Because `f` remains attributable to the vault, the vault's actual assets fall by only `g - f`. If stored total assets are reduced by `g`, the operation creates an accounting deficit of exactly `f`:

```text
actualAssets' = actualAssets - (g - f)
recordedAssets' = recordedAssets - g
actualAssets' - recordedAssets' =
    (actualAssets - recordedAssets) + f
```

The payout, fee calculation, share burn, and token movements may each look locally plausible. The error is visible only in the relationship between the post-state and the complete pre-state. Thus “every operation is correct in isolation” is the tell: vault correctness is not a collection of isolated examples but a state-machine invariant that every transition must preserve. Repetition merely accumulates the invariant violation until it becomes economically significant.

# The missing property

With exogenous yield disabled, the precise property is:

> After every successful state transition, the vault's recorded total assets must equal all underlying assets attributable to the vault, including withdrawal fees retained in the yield protocol.

In symbols, for every reachable state `s`:

```text
totalAssetsStored(s) == actualUnderlyingControlledByVault(s)
```

Here `actualUnderlyingControlledByVault` must be measured independently of the vault's stored accounting. It is the underlying held directly by the vault plus the independently valued/redeemable underlying held for it by the yield protocol (with any legitimate liabilities or explicitly modeled pending amounts treated consistently). It must not call another view that ultimately reads `totalAssetsStored`.

For the withdrawal transition specifically, when the fee stays in the strategy, the equivalent conservation check is:

```text
recordedBefore - recordedAfter == actualBefore - actualAfter == userNetReceipt
```

assuming no yield, unrelated transfers, or other flows during the call. If `g` denotes the gross redeemed amount, then `actualAfter` and `recordedAfter` should both be `before - (g - f)`, not `before - g`.

The suite should include a stateful invariant/fuzz test. A handler should generate sequences of deposits and withdrawals by multiple users, including partial and full withdrawals, and after **each** action assert the independent equality above. The strategy or yield protocol should be a deterministic mock whose real underlying balance or redeemable balance can be queried independently. A shadow model can additionally track deposits, net user payouts, and modeled yield:

```solidity
assertEq(
    vault.totalAssetsStored(),
    usdt.balanceOf(address(vault)) + strategy.underlyingBalanceOf(address(vault))
);
```

The exact right-hand side should match where this implementation custodies assets. A minimal regression test is: deposit, record both totals, withdraw an amount that produces a nonzero fee, then assert (1) the user's balance increased by the net amount, (2) the strategy retained the fee, and (3) `totalAssetsStored()` still equals independently measured actual assets. Repeating randomized deposit/withdraw cycles turns that regression into the stronger reachability invariant and catches cumulative drift immediately—on the first fee-bearing withdrawal, not only after a long run.
