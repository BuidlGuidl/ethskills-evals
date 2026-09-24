# What the tests prove—and what they do not

The suite establishes several local facts about the implementation. It does not establish the vault's accounting invariant.

## `test_DepositMintsShares`

This test establishes that, from the particular fixture's initial state, depositing `DEPOSIT_AMOUNT` returns `999e18` and credits that many shares to Alice. It also checks that the return value and the recorded share balance agree for that call.

It only appears to establish that deposits mint the economically correct number of shares. It does not compare the minted shares with the vault's pre-deposit assets and supply, test a deposit after a fee-bearing withdrawal, or show that those shares represent the right fraction of the real assets. A hard-coded expected result in an empty-vault scenario cannot expose an already accumulated difference between recorded and actual assets.

## `test_DepositUpdatesTotalAssets`

This test establishes that a deposit into the initial fixture makes both accounting views exposed by the vault report `DEPOSIT_AMOUNT`.

It only appears to establish that `totalAssets` is accurate. The two reported values may be the same accounting number, directly or indirectly, so comparing them is not an independent reconciliation. Neither is compared with the tokens actually controlled by the vault in the yield protocol. It tests the easy transition—an inflow that both the asset balance and the stored counter increase by the same amount—not the fee-retention transition where they can diverge.

## `test_WithdrawFeeBps`

This test establishes only that the public constant is `30` basis points.

It only appears to test withdrawal fees. It does not establish that the fee is calculated with the intended rounding, that the user receives the net amount, that only the net amount leaves the protocol, that the retained fee remains attributed to the vault, or that the fee benefits the remaining shareholders. A correct constant says nothing about how the resulting amount is accounted for.

## `test_ConstructorSetsUsdt`

This test establishes that the constructor stores the supplied token address in `usdt`.

It only appears to contribute evidence that asset handling is correct. It does not check balances, protocol positions, valuation, share pricing, or any state transition after construction.

# Why 100% coverage did not help

Line and function coverage answer whether execution reached code, not whether the suite asserted the right relationship between states. Every line involved in deposit, fee calculation, withdrawal, and stored-total updates can execute while the test checks only return values or each field against an expectation derived from the same flawed accounting model. Coverage also has no concept of an operation sequence: executing every function once is not equivalent to checking their composition.

The bug is temporal and relational. A withdrawal can correctly burn shares, correctly calculate a 30 bps fee, correctly pay the user the net amount, and correctly leave the fee in the protocol. The defect appears in the relationship between two pieces of post-state: the amount subtracted from recorded assets does not equal the amount that actually left the vault's control. If the accounting subtracts the gross redemption while only the net payment leaves, each locally observed action looks plausible, but the retained fee disappears from the ledger.

That is why “every operation is correct in isolation” is the tell. Vault correctness is fundamentally about conservation across transitions and sequences. Deposits determine ownership using the state left by previous withdrawals; withdrawals determine what later shares can claim. A test strategy that resets to a clean fixture and examines one call at a time systematically erases the history in which accounting drift lives.

# The missing property

Let:

- `R` be the vault's recorded total assets (`totalAssetsStored`, and therefore the value used for share pricing);
- `H` be all underlying assets economically controlled for shareholders, including idle tokens and the vault's position in the yield protocol;
- `O` be assets actually transferred out of that controlled set during an operation.

With yield, donations, and explicit losses disabled in the test, the required invariant is:

```text
R == H
```

after every state transition, up to only explicitly documented rounding dust. Equivalently, for a withdrawal:

```text
R_after = R_before - O
H_after = H_before - O
```

If a redemption has gross value `G`, retains fee `F` in the protocol, and pays `G - F` to the receiver, then `O = G - F`; consequently:

```text
R_after = R_before - (G - F)
```

not `R_before - G`. The retained `F` must remain in both `H` and `R` and thus in the value backing the remaining shares.

# Test shape that catches it

Use at least two users so that someone remains after a fee-bearing exit:

1. Alice deposits; Bob deposits.
2. Snapshot `R_before`, the independently measured protocol-plus-idle balance `H_before`, Bob's shares, and total share supply.
3. Alice performs a nonzero, fee-bearing partial or full withdrawal. Measure the receiver's actual token increase `O` rather than recomputing it through the vault's bookkeeping.
4. Independently query the underlying held by the yield protocol for the vault and add any idle underlying to obtain `H_after`.
5. Assert `H_after == H_before - O`, `R_after == R_before - O`, and, most importantly, `R_after == H_after`.
6. Assert that Bob's redeemable claim is computed from that reconciled value. With no other gains or losses, his claim must include his pro-rata share of Alice's retained fee; it must not be unchanged as though the fee had vanished.
7. Continue with another deposit and several withdrawals, checking the reconciliation after every step and finally redeeming all shares. Except for bounded rounding dust, the last shareholders must be able to withdraw all of `H`; no positive protocol balance may remain when supply reaches zero.

This should also be implemented as a stateful invariant/fuzz test over arbitrary sequences of deposits and fee-bearing withdrawals by multiple actors. The test needs an independent balance oracle—actual idle underlying plus the actual protocol position—not `totalAssets()` if that function is backed by `totalAssetsStored`. The core assertion is always that assets on the ledger equal assets under control. That single conservation property turns the retained-fee drift into a failure on the first affected withdrawal, rather than after a long production history.
