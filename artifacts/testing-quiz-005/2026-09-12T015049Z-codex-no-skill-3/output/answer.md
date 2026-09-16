# What the tests prove—and what they do not

The suite proves that selected outputs are right at selected moments. It does not prove that the vault's internal accounting remains equal to the assets it controls. That missing relationship is exactly where the withdrawal fees disappeared from the accounting.

## `test_DepositMintsShares`

```solidity
uint256 shares = _deposit(alice, DEPOSIT_AMOUNT);
assertEq(shares, 999e18);
assertEq(vault.shareBalance(alice), 999e18);
```

This establishes that, from the test's initial state and for this one deposit amount:

- `deposit` returns `999e18`;
- Alice's recorded share balance increases to `999e18`.

It only appears to establish that the minting formula is economically correct. The expected value is hard-coded from the same assumptions as the implementation, and neither assertion relates the shares to the vault's assets or to the claims of other shareholders. It says nothing about the exchange rate after retained yield or fees, about sequential deposits, or about whether all assets already controlled by the vault participate in later share pricing.

## `test_DepositUpdatesTotalAssets`

```solidity
_deposit(alice, DEPOSIT_AMOUNT);
assertEq(vault.totalAssets(), DEPOSIT_AMOUNT);
assertEq(vault.totalAssetsStored(), DEPOSIT_AMOUNT);
```

This establishes that one deposit into an empty vault causes both accounting getters to report the deposited amount.

It only appears to establish that `totalAssets` is a faithful measure of the vault's assets. Here, `totalAssets()` and `totalAssetsStored()` may be two views of the same bookkeeping value; agreement between them is not independent corroboration. The test never compares that value with the tokens actually controlled by the vault or its yield position, and it never checks the value after a fee-retaining withdrawal. It therefore validates the easy inflow path while leaving the relevant outflow transition unconstrained.

## `test_WithdrawFeeBps`

```solidity
assertEq(vault.WITHDRAW_FEE_BPS(), 30);
```

This establishes only that the exposed constant is 30 basis points.

It only appears to test the withdrawal fee. It does not establish that the fee is calculated with the intended rounding, that the receiver gets the net amount, that the fee remains invested, or—most importantly—that the retained fee remains included in total assets and in the value of the remaining shares.

## `test_ConstructorSetsUsdt`

```solidity
assertEq(address(vault.usdt()), address(usdt));
```

This establishes that the constructor stores the supplied token address in `usdt`.

It only appears to provide meaningful assurance about asset handling. It says nothing about token movements, yield-protocol balances, accounting, solvency, or claimability. It is a configuration test, not an accounting test.

# Why 100% coverage did not help

Line and function coverage answer whether execution visited code, not whether the tests asserted the right semantic relationships after visiting it. A withdrawal test can execute every line in `withdraw`, assert the user's net receipt and burned shares, and still never assert how much `totalAssetsStored` changed. Likewise, calling both accounting getters covers them even if both expose the same incorrect state.

Coverage also does not supply history. The defect is relational and temporal: a retained fee must still be counted after a withdrawal and must affect later share valuation. Every relevant line can be covered by isolated, freshly initialized examples without ever exercising the composition `deposit -> withdraw -> value remaining shares` or a long mixed sequence. Thus 100% line and function coverage is entirely compatible with zero coverage of the important invariant.

“Every operation is correct in isolation” is the tell because vault accounting is a state machine. Correctness is not merely that each call returns its locally expected value; every transition must preserve a global conservation relationship. If a withdrawal transfers the right net amount but reduces the stored total by the gross amount, the local transfer and fee calculations look correct while the transition destroys the accounting claim on the retained fee. Repetition then accumulates the discrepancy. A bug that emerges only through composition is precisely what isolated example tests are structurally unable to rule out.

# The missing property

Let `A(s)` be the independently observed amount of the underlying token controlled by the vault in state `s`, including its idle balance and its redeemable balance in the yield protocol. Let `T(s)` be the vault's recorded total assets. Subject only to an explicitly modelled rounding tolerance, the suite should assert:

```text
T(s) == A(s)
```

after every state-changing operation in every reachable test state. “Independently observed” matters: `A` must be computed from token balances and the protocol position, not by calling another getter backed by `totalAssetsStored`.

For the particular withdrawal transition, if `g` is the gross asset value removed from the withdrawing account's shares, `f` is the withdrawal fee retained in the vault, and `p = g - f` is the amount actually paid out, then the conservation law is:

```text
T(after) == T(before) - p
         == T(before) - g + f
```

The fee must not vanish from recorded assets. Equivalently, assuming no external yield or loss during the transaction:

```text
A(after) == A(before) - p
T(after) == A(after)
```

## Test shape

The smallest regression test needs at least two depositors so there is a remaining claimant:

1. Alice and Bob deposit.
2. Snapshot the independently measured controlled assets and `totalAssetsStored`.
3. Alice withdraws some or all of her position.
4. Measure Alice's actual token receipt `p` and compute the retained fee `f`.
5. Assert that controlled assets fell by exactly `p`, not by the gross withdrawal.
6. Assert that `totalAssetsStored` also fell by exactly `p` and still equals independently measured controlled assets.
7. Assert that Bob can redeem the value represented by his shares, including his share of the retained fee (within the protocol's documented rounding tolerance).

The stronger test is a stateful invariant/fuzz test. A handler performs randomized deposits, partial and full withdrawals, redeems, and—if applicable—yield accrual across several actors. After every action it asserts `recordedTotalAssets == independentlyObservedControlledAssets`, and maintains a simple shadow model in which deposits add actual inflows, withdrawals subtract only actual payouts, and yield adds independently observed gains. It should also assert that, when all shares are finally redeemed, no material underlying balance remains stranded beyond the stated rounding/dust bound.

That property would fail on the first fee-bearing withdrawal: the protocol would still hold the fee, while the stored total would have been reduced as though the fee had left. A long run is useful for finding sequences and rounding edges, but it is not necessary to expose the accounting error once the correct invariant is asserted.
