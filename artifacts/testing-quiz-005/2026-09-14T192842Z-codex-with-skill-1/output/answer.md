# What the green suite actually proved

The four tests prove narrow facts about particular snapshots. They do not prove that the vault's accounting remains consistent with its assets as state evolves.

## `test_DepositMintsShares`

This establishes that, from the test's particular starting state and for `DEPOSIT_AMOUNT`, `_deposit` returns `999e18` and records that same number in Alice's share balance.

It only appears to establish that deposit share pricing is generally correct. It does not independently connect those shares to the assets backing them, test another exchange rate or amount, or test a deposit after fees have accumulated. The return value and the balance can agree while both are calculated from an already-understated `totalAssetsStored`. In particular, this test never asks whether a later depositor receives an unfair number of shares because retained withdrawal fees were omitted from the share price.

## `test_DepositUpdatesTotalAssets`

This establishes that one deposit into the test's initial state makes both `totalAssets()` and `totalAssetsStored()` equal `DEPOSIT_AMOUNT`.

It only appears to establish that the accounting total tracks the vault's assets. The assertion compares two accounting views at one moment; depending on the implementation, `totalAssets()` may simply expose `totalAssetsStored()`, making part of the test an assertion of stored state against itself. Even if the initial deposit also transfers exactly that amount, the test says nothing about whether the equality survives withdrawals, retained fees, yield, or a long mixed sequence. It never compares the recorded number with an independent custody measurement.

## `test_WithdrawFeeBps`

This establishes only that the compiled constant/getter `WITHDRAW_FEE_BPS()` returns `30`.

It only appears to test the withdrawal fee. It does not execute a withdrawal and proves nothing about the fee calculation, the amount sent to the user, where the fee remains, or whether the retained amount stays in `totalAssetsStored`. A correctly configured 30-basis-point constant can feed incorrect accounting perfectly consistently.

## `test_ConstructorSetsUsdt`

This establishes that construction stores the supplied token address and that `usdt()` returns it.

It only appears to establish correct token integration. It says nothing about transfers, actual balances, protocol positions, USDT-specific behavior, or reconciliation between custody and internal accounting. It is wiring coverage, not an economic property.

# Why 100% coverage was compatible with the bug

Line and function coverage answer **whether code executed**, not whether its result was constrained by a meaningful assertion. A getter test can cover a function while merely reading back the variable it returns. A withdrawal test can execute every withdrawal line while asserting only the user's payout, leaving the retained-fee accounting unchecked. Function coverage also does not explore the relevant state space, values, actors, ordering, or histories. Line/function coverage is not branch coverage, and even branch coverage would not prove a temporal accounting invariant.

The defect is compositional: each call can produce the expected immediate user-visible result, yet the post-state it leaves becomes the incorrect input to later calls. The statement that “every operation is correct in isolation” is therefore the tell. It says the tests reset to a convenient initial state and checked local examples, while the failure depends on accumulated history. Stateful systems such as vaults must be tested for properties preserved by every transition, not just for plausible outputs from individual transitions.

# The missing property

After every successful state transition, the vault's recorded assets must equal all assets economically owned and redeemable by the vault:

```text
totalAssetsStored
    == idle USDT held by the vault
     + USDT-equivalent assets in the vault's yield-protocol position
```

The right-hand side must be measured independently from token balances and the protocol position, not obtained through `vault.totalAssets()` if that function reads `totalAssetsStored`. If the vault never holds idle USDT, the idle term is zero. Any documented rounding tolerance must be explicit and tightly bounded; otherwise this is equality, not `recorded <= actual`. A one-sided solvency assertion would remain green for this exact surplus/stranded-assets bug.

For a fee-bearing withdrawal whose gross asset claim is `G`, fee is `F`, and user payout is `G - F`, the same property implies the concrete transition rule:

```text
recordedAssetsAfter == recordedAssetsBefore - (G - F)
```

because only the net payout leaves vault custody. Subtracting `G` drops the retained fee from the books and creates the observed gap.

# Test shape

The primary test should be a handler-driven Foundry invariant test. The handler should own several funded, approved actors and expose valid, bounded operations such as `deposit`, `withdraw`/`redeem`, and any yield-accrual or protocol-sync action. The invariant runner should target the handler, generate long interleavings across actors, and after every generated sequence assert:

```solidity
function invariant_recordedAssetsEqualCustodiedAssets() public view {
    uint256 actual = usdt.balanceOf(address(vault))
        + yieldProtocol.redeemableAssets(address(vault));

    assertEq(vault.totalAssetsStored(), actual);
}
```

`redeemableAssets` above stands for the integration's independent, USDT-denominated measurement of the vault's position. It must not call back into the vault's recorded total. Inputs should be bounded so calls are valid, the runner's call/revert statistics should show that it is exercising real transitions, and `fail_on_revert = true` is useful while constructing the handler; otherwise a nearly all-reverting handler can yield a vacuously green invariant.

A focused regression test should supplement that search: deposit for multiple users, perform at least two fee-bearing withdrawals while someone remains in the vault, and check the equality after each withdrawal. It should also show that the retained holder's redeemable claim/share price includes the fees. Two withdrawals are important if the claim is cumulative drift: the test should demonstrate that the gap does not merely occur, but would grow under repeated fee-bearing operations. The invariant is the deployment-grade protection; the regression test is a readable reproduction of this particular failure.
