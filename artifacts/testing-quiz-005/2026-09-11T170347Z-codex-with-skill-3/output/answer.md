# What the green tests proved—and what they did not

The suite exercised code, but the shown tests mostly check local outputs or read implementation state back through getters. They do not connect the vault's internal accounting to an independent source of truth: the assets it actually controls.

## `test_DepositMintsShares`

```solidity
uint256 shares = _deposit(alice, DEPOSIT_AMOUNT);
assertEq(shares, 999e18);
assertEq(vault.shareBalance(alice), 999e18);
```

This establishes that, for one chosen deposit amount in the initial test state, `_deposit` returns `999e18` and records `999e18` shares for Alice. It can catch a change to that particular deposit calculation or balance update.

It only appears to establish that deposits mint the economically correct number of shares. The expected value is a hand-picked result for one state, and both assertions concern outputs of the same operation. The test does not independently derive the proper share amount from the vault's actual assets and supply; does not test deposits after withdrawal fees have accumulated; and does not show that the resulting shares represent the correct fraction of custody. The deposit can remain internally self-consistent while using an already-understated asset total.

## `test_DepositUpdatesTotalAssets`

```solidity
_deposit(alice, DEPOSIT_AMOUNT);
assertEq(vault.totalAssets(), DEPOSIT_AMOUNT);
assertEq(vault.totalAssetsStored(), DEPOSIT_AMOUNT);
```

This establishes that one deposit into an empty vault causes two accounting getters to report the deposited amount.

It only appears to establish that `totalAssets` is correct. `totalAssets()` and `totalAssetsStored()` may be two views of the same bookkeeping value, so agreement between them is not independent corroboration. Neither assertion compares accounting with the token balance plus the vault's yield-protocol position. Nor does this test pass through the transition that creates the defect—a fee-bearing withdrawal—or through a sequence in which drift accumulates.

## `test_WithdrawFeeBps`

```solidity
assertEq(vault.WITHDRAW_FEE_BPS(), 30);
```

This establishes only that the public constant/getter returns 30.

It only appears to test withdrawal fees. It says nothing about whether a withdrawal charges 30 basis points, where that fee remains, whether the fee increases the value attributable to remaining shares, or whether the fee remains included in `totalAssets`. It exercises configuration, not fee economics or accounting.

## `test_ConstructorSetsUsdt`

```solidity
assertEq(address(vault.usdt()), address(usdt));
```

This establishes that construction stores the supplied mock-token address and exposes it through `usdt()`.

It only appears to validate the vault's asset integration. It does not establish correct custody, protocol balances, USDT behavior, or reconciliation between those balances and the vault ledger. It is essentially a constructor assignment/getter test.

## Why 100% coverage was compatible with the bug

Line and function coverage report that execution reached lines and entered functions. They do not report that the assertions constrain the intended economic behavior, that all relevant states or operation orderings were explored, or that two independently measured quantities agree.

A single happy-path call can cover every line of a function. Separate deposit and withdrawal tests can cover every function while resetting the fixture between tests, so no test ever observes `deposit -> fee-bearing withdrawal -> later deposit/withdrawal`. Constants and getters can add covered functions without testing any useful property. Even 100% branch coverage would not by itself prove a stateful accounting invariant: the defect can arise from the composition of individually valid transitions rather than from an unvisited line.

That is why “every operation is correct in isolation” is the tell. The failure is history-dependent. A deposit may add exactly the deposit amount to both custody and recorded assets. A withdrawal may pay exactly the requested net amount and leave exactly the intended fee in the protocol. Yet if the withdrawal transition subtracts from recorded assets as though that retained fee had left custody, each local result looks right while the two state representations diverge. Correctness for a stateful vault is not merely correctness of each call's immediate return value; every transition must preserve the vault's global accounting relationship. Isolation tests erase precisely the history needed to falsify that claim.

## The property that should have been asserted

Let `controlledAssets` be an independent valuation of all underlying tokens economically controlled by the vault:

```text
controlledAssets = underlying held directly by the vault
                 + underlying value of the vault's yield-protocol position
                 + any other withdrawable underlying controlled by the vault
```

Because the withdrawal fee stays in that position for remaining shareholders, it is part of `controlledAssets`. Subject only to an explicitly defined rounding tolerance if the protocol's conversion necessarily rounds, the invariant is:

```text
vault.totalAssetsStored() == controlledAssets
```

If `totalAssets()` is intended to be the authoritative accounting view, it must satisfy the same equality (and should not merely alias `totalAssetsStored()` in the test):

```text
vault.totalAssets() == controlledAssets
```

This must be equality, not merely `totalAssets() <= controlledAssets`. The latter is only a solvency check and remains green for this bug, where holdings exceed recorded claims and value becomes stranded. If rounding exists, assert a documented tight absolute bound in both directions, such as `absDiff(recorded, controlled) <= MAX_ROUNDING_DUST`; do not use a one-sided inequality that permits accumulating surplus.

## Test shape

Use a handler-driven Foundry invariant test. The handler should maintain several funded, approved actors and expose successful, bounded actions such as `deposit`, `withdraw`, `redeem`, and any yield/protocol update operation. Foundry should generate long, randomized sequences and actor interleavings; after every sequence, the invariant independently reads the token balance and yield-protocol position and compares their total with the vault's recorded assets.

Conceptually:

```solidity
function invariant_accountingMatchesCustody() public view {
    uint256 controlled = usdt.balanceOf(address(vault))
        + yieldProtocol.underlyingBalanceOf(address(vault));

    assertEq(vault.totalAssetsStored(), controlled);
    assertEq(vault.totalAssets(), controlled);
}
```

The protocol-specific measurement must be genuinely independent of the vault's stored total—for example, value the vault's protocol shares using the protocol's own exchange rate or preview function. Otherwise the test would repeat the same bookkeeping mistake.

The handler, rather than the vault itself, should be the invariant target. It must fund actors, grant approvals, bound amounts to executable ranges, and avoid vacuous runs dominated by reverts. During development, `fail_on_revert = true` and the calls/reverts statistics help confirm that meaningful transitions occurred.

A deterministic regression test should accompany the invariant for clarity:

1. Alice and Bob deposit.
2. Alice performs a withdrawal that incurs a nonzero fee.
3. Measure direct underlying plus the independently valued protocol position.
4. Assert that this equals the recorded total immediately after the withdrawal.
5. Optionally have Bob redeem all remaining shares and assert that he can receive the retained fee (apart from specified rounding dust) and that no assets remain stranded.

The equality at step 4 catches the defect at its first accounting divergence; randomized sequences demonstrate that the relationship continues to hold across arbitrary valid histories.
