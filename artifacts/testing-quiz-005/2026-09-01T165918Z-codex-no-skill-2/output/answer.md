# What the tests prove—and what they do not

The suite proves several local facts about selected calls and constants. It does not prove that the vault's accounting remains faithful to its assets as state changes compose over time.

## `test_DepositMintsShares`

This establishes that, from the particular fixture state used by the test, one deposit returns `999e18` shares and credits exactly that many shares to Alice. It checks agreement between the deposit's return value and one user's recorded share balance for one transition.

It only appears to establish that share minting is economically correct. The hard-coded expected value can agree with the implementation even if the asset base used to price those shares is already incomplete. It does not compare the assets represented by all shares with the assets actually controlled by the vault, does not test a deposit after fees have accumulated, and does not show that the new depositor receives the correct fraction of the real—not merely recorded—pool.

## `test_DepositUpdatesTotalAssets`

This establishes that a deposit into the fixture's initial state causes both accounting getters to equal `DEPOSIT_AMOUNT`. In that state there is apparently no pre-existing retained withdrawal fee, so recorded assets and real assets begin aligned.

It only appears to establish that `totalAssets` accounting is correct generally. It checks the easy creation path, not preservation of the relationship between recorded and actual assets. It never asks what happens to an amount already in the yield protocol when a withdrawal transfers less than the gross amount debited from accounting. In particular, it does not deposit after a withdrawal and compare the stored total with the protocol's real underlying balance.

## `test_WithdrawFeeBps`

This establishes only that the public constant is `30` basis points.

It only appears to test withdrawal fees. It says nothing about whether the fee is calculated on the correct base, whether the receiver gets the intended net amount, or—crucially—whether the retained fee remains included in vault assets and benefits the remaining shareholders. A correct constant is not a correct fee-accounting transition.

## `test_ConstructorSetsUsdt`

This establishes that the constructor stores the supplied USDT address and exposes it through `usdt()`.

It only appears to contribute to broader asset-handling assurance. Correct token configuration does not imply correct denomination, reconciliation, ownership, or lifecycle accounting for that token.

## Why 100% coverage did not help

Line and function coverage answer whether execution visited code, not whether the suite asserted the right semantics. A test can execute every branch while checking only return values, constants, and state fields that are derived from the same flawed internal bookkeeping. Coverage has no notion of conservation of value, no independent model of the vault, and no requirement to exercise meaningful sequences of calls.

The bug is relational and temporal: after a withdrawal, the protocol still holds the retained fee, but the recorded total has been reduced as though the full gross withdrawal left. Both assignments can be executed and every individual call can return its expected local result. The defect is visible only by relating two independently observable quantities—real controlled assets and recorded assets—across a sequence.

That is why “every operation is correct in isolation” is the tell. Vault correctness is not a collection of isolated examples; it is a state-machine property. Deposits establish claims, withdrawals transform those claims, fees stay for remaining claimants, and later deposits must be priced against the resulting pool. If each test resets the fixture, or tests one method against implementation-shaped expectations, it systematically removes the history in which the inconsistency becomes observable.

## The missing property

The suite should have asserted the following accounting invariant after every successful state transition:

> The vault's reported total assets must equal all underlying assets economically owned by current vault shareholders and controlled by the vault, including idle underlying and underlying deposited in the yield protocol. A withdrawal fee retained in the protocol remains part of that total.

In notation, if there are no unrelated donations or external gains/losses:

```text
reportedTotalAssets
  == idleUnderlyingHeldByVault
   + underlyingOwnedByVaultInYieldProtocol
```

If the protocol balance is represented by receipt tokens whose exchange rate changes, the right-hand side must use their current redeemable underlying value, not their raw token count. `totalAssetsStored`, if it is intended to mirror this value, must equal the same independently measured amount (subject only to an explicitly specified rounding tolerance). The expected transition for a withdrawal with gross share value `G` and retained fee `F` is therefore:

```text
actual assets after = actual assets before - (G - F)
reported assets after = reported assets before - (G - F)
```

Reducing reported assets by `G` while transferring only `G - F` is exactly the forbidden drift.

The direct regression test should use a nontrivial sequence in one test, without resetting state:

1. Alice and Bob deposit.
2. Record the independently redeemable underlying held idle and in the yield protocol.
3. Alice withdraws an amount that produces a nonzero fee.
4. Assert that Alice received the net amount and that the retained fee is still in protocol assets.
5. Assert `vault.totalAssets()` and `vault.totalAssetsStored()` equal the independently measured real asset total.
6. Assert that Bob's redeemable claim/share price increased by his share of the retained fee, subject to documented rounding.
7. Optionally deposit with Charlie and assert that his shares are minted using that real post-fee asset total, so he cannot capture or dilute the previously retained value.

The stronger form is a stateful invariant/fuzz test. Generate arbitrary valid sequences of deposits and withdrawals by multiple users; after every action, independently value the vault's idle balance plus its yield-protocol position and assert equality with reported assets. Also maintain a simple reference accounting model in which only the net withdrawal leaves the pool. Vary actors, amounts, ordering, partial and full withdrawals, and rounding boundaries. That test shape detects the first transition that creates drift, even though no single public function looks wrong when tested from a fresh fixture.
