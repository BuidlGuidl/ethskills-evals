# What the suite proved—and what it missed

The 39 green tests and 100% line/function coverage show that the selected calls executed without violating the assertions the authors wrote. They do not show that the vault's accounting remains consistent with its assets over time.

## What each test actually establishes

### `test_DepositMintsShares`

This establishes that, from the particular initial state created by the fixture, depositing exactly `DEPOSIT_AMOUNT`:

- returns `999e18` shares; and
- records `999e18` as Alice's share balance.

It appears to establish that deposit share minting is correct. It does not establish that `999e18` is economically correct according to independently observed assets and supply. Both assertions can agree with the same faulty accounting path: the return value and `shareBalance` may simply reflect the value the implementation just computed and stored. It also says nothing about later deposits, deposits after fees have accumulated, other amounts, rounding, multiple users, or whether those shares can redeem their proper fraction of custody.

### `test_DepositUpdatesTotalAssets`

This establishes that one deposit from the fixture state makes both `totalAssets()` and `totalAssetsStored()` equal `DEPOSIT_AMOUNT`.

It appears to establish that total-asset accounting is correct. In reality it mostly checks the internal ledger against itself: if `totalAssets()` is derived from, or otherwise agrees with, `totalAssetsStored()`, both can report the same wrong number. The test never compares that number with an independent custody observation, and it never checks the ledger after a withdrawal fee has been retained. Thus it cannot see real tokens that exist in the yield protocol but have disappeared from the vault's accounting.

### `test_WithdrawFeeBps`

This establishes only that the public constant/getter returns `30`.

It appears to test withdrawal fees, but it tests none of the fee behavior: whether 30 basis points is calculated correctly, who receives or retains it, how much reaches the withdrawing user, or how retained fees affect `totalAssets`, share price, and later redemptions. A correctly configured constant does not imply correct fee accounting.

### `test_ConstructorSetsUsdt`

This establishes that construction stores the supplied token address and exposes it through `usdt()`.

It appears to validate the USDT integration. It does not exercise a USDT transfer, the yield protocol, custody balances, accounting, or any token-specific behavior. It is a wiring test, not an economic correctness test.

## Why 100% coverage was compatible with the bug

Coverage is a reachability measurement. Line coverage says every reported line executed; function coverage says every reported function was entered. Neither says that an assertion independently constrained the result, that relevant inputs were searched, or that meaningful state-machine sequences were explored.

A suite can therefore execute the faulty withdrawal-accounting line and still pass because it asserts only the user's payout, the new stored value, or another result produced by the same faulty calculation. It can execute every getter and constructor line through assertions that merely read values back. Coverage gives no credit distinction between an assertion capable of exposing the bug and one that restates the implementation.

The defect is relational and stateful: after fees are retained, the relationship between the internal ledger and external custody becomes false. No listed test asserts that relationship. One hundred percent of the code can run while zero tests check the missing property.

## Why “correct in isolation” is the tell

The system's correctness is not the conjunction of isolated examples. A vault is a state machine: each deposit or withdrawal changes the state used to price the next operation. Here, a withdrawal can correctly calculate the gross amount, correctly pay the user the net amount, and correctly leave the fee in the protocol, yet incorrectly reduce recorded assets by the gross amount. Each local effect looks plausible. Their composition is inconsistent:

1. custody loses only the net payment;
2. recorded assets fall by the gross withdrawal;
3. the retained fee becomes the gap between custody and accounting;
4. later share pricing uses the understated accounting value; and
5. repeated withdrawals grow the gap.

That is precisely why “every operation is correct in isolation” points toward a missing stateful invariant. The bug lives in the relationship preserved across transitions, not necessarily in an obviously bad standalone output.

## The property that should have been asserted

The required property is an accounting-to-custody equality, not merely a solvency inequality:

> After every successful state transition, the vault's recorded total assets must equal the independently measured assets attributable to the vault in custody, including withdrawal fees retained in the yield protocol.

In notation, for every reachable state `s`:

```text
recordedAssets(s) == custodyAssetsAttributableToVault(s)
```

The right-hand side must be obtained independently of `totalAssetsStored()`—for example, from the vault's underlying-token balance plus the redeemable value of its position in the yield protocol, with any assets in transit handled explicitly. It must not call another view that simply reads the same internal ledger.

Equality matters. An assertion such as `recordedAssets <= custodyAssets` checks that claims are covered, but remains true in this incident because the vault has a surplus. Only equality, or an equivalent assertion that the drift is exactly zero, detects stranded assets.

For the described fixed-fee behavior, a useful transition-level equivalent is:

```text
recordedAssetsAfter
    == recordedAssetsBefore - assetsActuallySentOut
```

If a withdrawal requests gross amount `G`, pays fee `F`, sends `G - F` to the user, and retains `F` in the protocol, recorded assets must fall by `G - F`, not by `G`. This transition assertion is an excellent regression test, but the general custody equality remains the stronger invariant.

## Test shape that catches it

Use a handler-driven Foundry invariant test:

- The handler owns several funded, approved actors.
- It exposes valid, bounded deposit and withdrawal actions and tracks successful calls.
- Foundry generates long, randomized interleavings of deposits and withdrawals by those actors.
- After every generated sequence, the invariant independently values the vault's token balance and yield-protocol position and asserts exact equality with `totalAssetsStored()` (or the canonical recorded-assets value).
- The setup targets the handler rather than the vault directly, and inputs are constructed so calls usually succeed; while building it, `fail_on_revert = true` and call/revert statistics ensure the fuzzer is exploring real state rather than discarding inert calls.

The invariant's essential assertion is conceptually:

```solidity
function invariant_accountingEqualsCustody() public view {
    uint256 custody = usdt.balanceOf(address(vault))
        + yieldProtocol.redeemableAssets(address(vault));

    assertEq(vault.totalAssetsStored(), custody, "asset accounting drift");
}
```

The exact custody expression must match the integration and avoid double-counting, but it must come from token/protocol state rather than the vault's own stored total.

Also keep a small deterministic regression test: deposit for at least two users, perform a fee-bearing withdrawal, assert the first nonzero custody/accounting gap would be zero, perform another state transition, assert it remains zero, and verify a remaining user's redeemable claim includes their share of the retained fee. Showing multiple transitions demonstrates the cumulative failure described here; the invariant then searches many amounts, actors, orderings, and repetitions instead of protecting only the one known counterexample.
