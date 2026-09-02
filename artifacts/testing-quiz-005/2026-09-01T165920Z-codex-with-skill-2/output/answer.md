# What the tests prove—and what they do not

The suite proves several local examples. It does not prove the vault's accounting model remains true as state evolves.

## `test_DepositMintsShares`

```solidity
uint256 shares = _deposit(alice, DEPOSIT_AMOUNT);
assertEq(shares, 999e18);
assertEq(vault.shareBalance(alice), 999e18);
```

This establishes that, from the particular state created by `setUp`, one deposit of `DEPOSIT_AMOUNT` returns `999e18` and credits that many shares to Alice. It checks agreement between the deposit's return value and Alice's recorded share balance for one chosen input.

It only appears to establish that share issuance is economically correct. The expected `999e18` is a point example, potentially calculated with the same assumptions as the implementation. The test does not independently establish that the pre-deposit share price is correct, that all assets backing existing shares were included in the calculation, or that the result remains correct after fees have accumulated through prior withdrawals. A function can calculate shares perfectly from a stale `totalAssetsStored` and still issue the wrong number economically.

## `test_DepositUpdatesTotalAssets`

```solidity
_deposit(alice, DEPOSIT_AMOUNT);
assertEq(vault.totalAssets(), DEPOSIT_AMOUNT);
assertEq(vault.totalAssetsStored(), DEPOSIT_AMOUNT);
```

This establishes that, after one deposit into an initially configured state, both exposed accounting values equal the deposited amount.

It only appears to establish that `totalAssets` represents the vault's real assets. Both getters may share the same stored source of truth, so their agreement is not independent corroboration. The test compares bookkeeping with an expected bookkeeping result, not bookkeeping with the tokens actually controlled in the yield protocol. It exercises no withdrawal and therefore never creates the retained-fee state in which the two diverge.

## `test_WithdrawFeeBps`

```solidity
assertEq(vault.WITHDRAW_FEE_BPS(), 30);
```

This establishes only that the configured constant/getter is 30 basis points.

It only appears to test withdrawal fees. It proves nothing about the fee amount calculated for a withdrawal, the amount paid to the user, where the fee remains, or whether the retained fee continues to be included in total assets and share price. A correct constant can feed incorrect accounting.

## `test_ConstructorSetsUsdt`

```solidity
assertEq(address(vault.usdt()), address(usdt));
```

This establishes that the constructor stores the supplied token address.

It only appears to give confidence in asset handling. It does not show that token balances or yield-protocol claims are measured correctly, and it has no bearing on fee retention or long-run accounting.

# Why 100% coverage did not help

Line and function coverage answer whether execution visited code, not whether the right economic claim was asserted. One happy-path call can cover every line of a short deposit or withdrawal function. Coverage does not measure:

- the quality or independence of assertions;
- important state histories or orderings of calls;
- interactions between deposit, withdrawal, fees, and later share pricing;
- boundary values or randomized amounts;
- conservation of value across a sequence; or
- consistency between internal accounting and assets held externally.

The tests can therefore execute the line that subtracts a gross withdrawal from `totalAssetsStored`, execute the line that transfers only the net amount to the user, and mark both covered. Nothing fails unless a test asserts that the retained difference is still an asset of the remaining shareholders.

Coverage is particularly misleading when tests compare two values derived from the same bookkeeping variable. `totalAssets()` equaling `totalAssetsStored()` can be 100% consistent and 100% wrong relative to the protocol position.

# Why “correct in isolation” is the tell

This is a state-machine bug. Each operation can satisfy its immediate, local postconditions:

- a deposit transfers the requested tokens and mints the locally calculated shares;
- a withdrawal burns the requested shares;
- the withdrawing user receives the correct net amount;
- the 30-basis-point fee remains in the yield protocol.

The failure is in the transition between states. If a withdrawal represents gross assets `G`, charges fee `F`, and pays the user `G - F`, the vault's real managed assets fall by only `G - F`. If its stored total falls by `G`, bookkeeping loses `F` even though the protocol position retains it. Future operations then use a state variable already missing that value. Repetition accumulates the discrepancy.

That is why the absence of a visibly bad single call is not an alibi; it points directly to a missing cross-operation invariant. Stateful financial systems must be tested for properties preserved by every transition, not merely for plausible outputs from isolated examples.

# The missing property

At every reachable state, the vault's recorded total assets must equal the vault's independently measured, redeemable assets under management, subject only to an explicitly stated rounding tolerance:

```text
totalAssetsStored
    == idle underlying held by the vault
     + underlying currently redeemable from the vault's yield-protocol position
```

Equivalently, absent yield, loss, or unsolicited token transfers, accounting must obey conservation:

```text
recordedAssetsAfter
    = recordedAssetsBefore
    + assets actually received from deposits
    - assets actually paid out of the managed pool
```

For a withdrawal with gross quote `G` and retained fee `F`, “actually paid out” is `G - F`; therefore:

```text
recordedAssetsAfter = recordedAssetsBefore - (G - F)
```

The fee `F` remains part of both real and recorded assets and consequently accrues to the remaining shares. This formulation should be adjusted only for real protocol yield/loss and documented rounding—not by dropping retained fees.

The independent measurement is essential. If `totalAssets()` merely returns or is derived from `totalAssetsStored`, comparing the two is circular. The test must inspect the underlying token balance of the vault plus the yield position's independently redeemable underlying (or redeem/preview that position using a trustworthy mock/integration interface).

# Test shape that catches the drift

Use a stateful invariant test with a handler that performs bounded, randomized deposits and partial/full withdrawals for multiple actors. After every call in every generated sequence, assert:

```solidity
function invariant_recordedAssetsMatchManagedAssets() public view {
    uint256 actual = usdt.balanceOf(address(vault))
        + yieldProtocol.redeemableUnderlying(address(vault));

    assertApproxEqAbs(vault.totalAssetsStored(), actual, ROUNDING_TOLERANCE);
}
```

The handler should track or constrain valid shares, ensure withdrawals actually charge a nonzero fee, and allow remaining shareholders to stay in the vault while others exit. It should not compute `actual` through the vault's own `totalAssets()` implementation.

A deterministic regression test should accompany the invariant:

1. Alice and Bob deposit.
2. Record independently measured managed assets and total supply.
3. Alice withdraws enough to produce a nonzero fee.
4. Assert that the managed-asset decrease equals the net tokens Alice received, not the gross withdrawal quote.
5. Assert `totalAssetsStored == independently measured managed assets` within rounding tolerance.
6. Assert Bob's redeemable asset value includes the retained fee; then redeem Bob and verify the fee is claimable rather than stranded.
7. Repeat withdrawals/deposits, or fuzz their amounts and order, so cumulative drift cannot hide behind a one-wei tolerance.

The decisive check is step 5. With the shipped logic, immediately after Alice's withdrawal the actual protocol assets exceed `totalAssetsStored` by the retained fee, so the test fails at the first faulty state transition rather than only after users have suffered long-run drift.
