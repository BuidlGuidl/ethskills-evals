# What the suite proved—and what it did not

The suite has strong *execution* coverage but weak *accounting-property* coverage. Each quoted test checks a local fact at a convenient state. None checks that the accounting remains a faithful description of the assets after a fee-bearing withdrawal.

## What each test establishes

### `test_DepositMintsShares`

It establishes that, from the fixture's initial state, depositing `DEPOSIT_AMOUNT` returns `999e18` and credits exactly that many shares to Alice.

It only appears to establish that share issuance is economically correct. A hard-coded output says nothing about whether those shares are backed at the right exchange rate, whether the conversion remains correct after prior withdrawals, or whether retained fees are included in the assets against which later shares are priced. Indeed, a test can faithfully assert a wrong implementation's output.

### `test_DepositUpdatesTotalAssets`

It establishes that immediately after this deposit path, both asset-reporting values equal the amount deposited.

It only appears to establish that `totalAssetsStored()` is always synchronized with the vault's real holdings. Equality in the initial/deposit-only state is merely a base case. The missing question is whether every later state transition preserves that equality. In particular, this test never crosses the withdrawal-fee path where recorded and real assets separate.

### `test_WithdrawFeeBps`

It establishes only that the public constant is `30`.

It does not establish that a withdrawal charges 30 basis points, rounds it correctly, sends the user the net amount, leaves the fee in the strategy, or—most importantly here—continues to count that retained fee as an asset of the remaining shareholders. Testing a configured rate is not testing the accounting effect of applying it.

### `test_ConstructorSetsUsdt`

It establishes that the constructor stored the expected token address.

It does not establish correct token flows, valuation, strategy balances, or reconciliation between recorded assets and tokens actually controlled by the vault. Correct wiring is necessary but unrelated to the broken conservation rule.

## Why 100% coverage did not help

Line and function coverage answer whether code was executed, not whether the right relationships were asserted. A test can execute every branch, check a return value or event, and never compare the resulting book balance with the real balance. The withdrawal line that drops the fee from accounting may therefore be covered—and even be the source of values asserted by the tests—without its economic meaning being challenged.

This bug is temporal and relational. It concerns two representations of value after a sequence of transitions:

1. tokens actually controlled in the yield protocol, and
2. assets recorded for share pricing and redemption.

Single-operation examples from a fresh fixture mostly verify point outputs. They do not establish that an invariant is inductive: true initially and preserved by every deposit and withdrawal. Thirty-nine such examples and 100% line coverage can still omit that one relationship entirely.

“Every operation is correct in isolation” is therefore the tell. Vault correctness is not a collection of plausible calls; it is conservation of value across calls. A withdrawal may burn the expected shares, transfer the expected net amount, and charge the expected fee while still making an invalid state transition. If gross assets are removed from `totalAssetsStored` but only the net amount leaves the protocol, each field and transfer can look locally reasonable while the cross-state equation is false. Repetition then accumulates the missing fee.

## The property that should have been asserted

With yield, losses, donations, and strategy exchange-rate movement frozen, define:

- `R` as the vault's recorded assets used for share pricing;
- `B` as all real underlying economically controlled by the vault: idle underlying plus the underlying redeemable from its strategy;
- `O` as underlying actually transferred out of that asset pool during a withdrawal.

The reconciliation invariant is:

```text
R == B
```

and the withdrawal transition must preserve it:

```text
R_after = R_before - O
B_after = B_before - O
```

For a gross withdrawal entitlement `G` and retained fee `F`, `O = G - F`. Consequently:

```text
R_after = R_before - (G - F)
```

not `R_before - G`. The fee remains in `B`, so it must remain in `R` and increase the assets backing the shares that remain outstanding. Subject only to the contract's documented rounding bounds, the difference `B - R` must stay zero; it must not increase by `F` on every withdrawal.

## Test shape

Use at least two depositors so shares remain after the fee-bearing withdrawal. Use a deterministic mock strategy with yield disabled. Then:

1. Alice and Bob deposit.
2. Record `R_before`, the strategy-plus-idle balance `B_before`, and Alice's token balance.
3. Alice withdraws or redeems only her position.
4. Compute `O` from the actual token balance increase received by Alice (or, more robustly, from the decrease in the vault's real asset pool).
5. Assert `B_after == B_before - O`.
6. Assert `R_after == R_before - O` and `R_after == B_after`, allowing only an explicitly justified rounding tolerance.
7. Assert the remaining shares' exchange rate is computed from `R_after`, which includes the retained fee.

In Foundry-style pseudocode:

```solidity
function test_RetainedWithdrawalFeeRemainsAccountedFor() public {
    _deposit(alice, amount);
    _deposit(bob, amount);

    uint256 recordedBefore = vault.totalAssetsStored();
    uint256 realBefore = _realAssets(); // idle USDT + strategy-redeemable USDT
    uint256 aliceBefore = usdt.balanceOf(alice);

    vm.prank(alice);
    vault.redeem(vault.shareBalance(alice), alice, alice);

    uint256 paidOut = usdt.balanceOf(alice) - aliceBefore;
    uint256 recordedAfter = vault.totalAssetsStored();
    uint256 realAfter = _realAssets();

    assertEq(realAfter, realBefore - paidOut);
    assertEq(recordedAfter, recordedBefore - paidOut);
    assertEq(recordedAfter, realAfter);
}
```

That targeted regression test catches the reported defect immediately: an implementation that subtracts the gross claim from recorded assets while transferring only the net claim will make `recordedAfter` lower than `realAfter` by exactly the retained fee.

The durable version is a stateful invariant test. Let a handler perform randomized deposits, partial withdrawals, and redeems across several users while a mock strategy prevents unrelated yield or loss. After every action, assert `totalAssetsStored() == _realAssets()` within the stated rounding bound. Also track cumulative external inflows and outflows as a model ledger and compare the vault against that independent model. The independent balance/model is essential: asserting one contract getter against another getter derived from the same faulty variable would only test the bug against itself.
