# What the tests prove—and what they do not

`test_DepositMintsShares` proves that one deposit, from the particular initial state created by the fixture and for one chosen amount, returns and credits `999e18` shares. It also proves that the return value agrees with Alice's stored balance in that case. It does **not** prove that those shares have the right claim on the vault's assets, that the exchange rate remains correct after withdrawals, or that the shares of users who stay in the vault receive retained withdrawal fees. The asserted number makes the share-minting result look economically correct, but no asset/share conservation relationship is asserted.

`test_DepositUpdatesTotalAssets` proves that immediately after one deposit the two accounting getters equal the amount deposited. That is only the inflow half of the accounting system, from a clean state. It does **not** establish that the recorded amount continues to equal the assets actually owned by the vault after a withdrawal, nor that every kind of asset increase—especially a fee retained in the protocol—is included in the record. The names `totalAssets` and `totalAssetsStored` can make this look like a test of total-asset correctness, but the test merely checks one snapshot reached through one transition.

`test_WithdrawFeeBps` proves that the public constant/getter contains `30`. It does not prove that the fee is applied to the correct base, rounded as intended, paid or retained in the intended place, or reflected in asset and share-price accounting. A correct fee parameter says nothing about correct fee bookkeeping.

`test_ConstructorSetsUsdt` proves that the constructor stores the expected token address. It does not prove any economic property involving that token: balances, transfers, protocol positions, solvency, or reconciliation of those balances with internal accounting.

# Why 100% coverage did not protect the vault

Line and function coverage answer whether execution visited code, not whether the tests checked the right consequence of that execution. A withdrawal test can execute every line in the withdrawal function and assert that the withdrawing user received the expected net amount, while never comparing the vault's post-withdrawal book value with its actual protocol position. All functions can therefore be covered while the essential relationship between two pieces of state is never asserted.

Coverage also does not imply coverage of histories. A stateful contract is not adequately described by a collection of isolated calls. The same withdrawal code may appear correct when its immediate outputs are inspected, yet leave a small inconsistency that changes the initial state for every subsequent call. Repetition then accumulates that inconsistency. Branch, line, and function coverage are particularly weak evidence for properties involving sequences, multiple users, conservation, or cumulative rounding.

That is why “every operation is correct in isolation” is the tell. The requirement is compositional: after each operation, the state must still be a valid starting state for the next operation. Here a withdrawal burns a gross claim but transfers only the net amount after fees. If bookkeeping reduces recorded assets by the gross amount while the protocol position falls only by the net payout, that call can still return the expected value, burn the expected shares, and pay the expected tokens. Nevertheless it has broken the relationship between recorded and real assets by exactly the retained fee. Each later operation starts from an understated share price, and the error accumulates.

# The missing property

The suite should have asserted an asset-conservation/reconciliation invariant:

> At every externally observable settled state, the vault's recorded total assets must equal the amount of underlying assets actually owned for share holders in the yield protocol (subject only to an explicitly documented rounding tolerance and explicitly accounted pending yield).

Equivalently, for a withdrawal whose gross redeemed claim is `g`, fee is `f`, and user payout is `g - f`, the withdrawal transition must satisfy

```
actualAssetsAfter = actualAssetsBefore - (g - f)
bookAssetsAfter   = bookAssetsBefore   - (g - f)
bookAssetsAfter   = actualAssetsAfter
```

The fee `f` remains an asset of the vault. Decreasing book assets by `g` would violate the invariant by `f`, even though the user-facing withdrawal itself looks correct.

A focused regression test should use at least two depositors so that there is a genuine remaining holder:

1. Alice and Bob deposit.
2. Record the vault's book assets and its independently measured underlying protocol position.
3. Alice withdraws or redeems only her position; independently measure the amount actually paid to Alice.
4. Assert that both book assets and the real protocol position decreased by that **net payout**, and assert that they are still equal.
5. Assert that Bob's redeemable claim includes the retained fee; preferably redeem Bob last and verify that the vault can distribute the entire remaining protocol position, modulo the specified rounding bound, leaving neither unaccounted assets nor an unpaid claim.

In Foundry, the durable version should be an invariant or state-machine/fuzz test whose handler performs arbitrary deposits, withdrawals, and redemptions by several actors. After every action it should reconcile `totalAssetsStored()` (and `totalAssets()`, if it is intended to report the same settled quantity) against the vault's independently queried balance/position in the yield protocol. A sequence assertion is essential; merely adding another isolated withdrawal-output assertion would reproduce the original blind spot.
