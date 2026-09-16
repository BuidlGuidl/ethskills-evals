# What the green suite actually proved

The suite proved that selected calls produced selected expected snapshots. It did not prove that the vault's accounting remained consistent with its assets over time.

## `test_DepositMintsShares`

This establishes that, from the particular fixture state and for `DEPOSIT_AMOUNT`, `_deposit` returns `999e18` and records the same number of shares for Alice. It is a useful example test for the deposit calculation and balance update on that path.

It only appears to establish that share issuance is generally correct. It does not test other amounts, exchange rates, prior yield, prior fees, rounding boundaries, or a deposit made after withdrawals have created an accounting/custody gap. Most importantly, it never asks whether the shares are priced against all assets economically owned by the vault. The returned value and `shareBalance` can agree with one another while both are derived from an understated `totalAssetsStored`.

## `test_DepositUpdatesTotalAssets`

This establishes that one deposit into the initial test state increments both the public view and the stored accounting value to `DEPOSIT_AMOUNT`.

It only appears to establish that `totalAssets` is a truthful measure of the assets backing shares. Both assertions may be checking two views of the same bookkeeping value. Neither compares that value with an independent custody measurement, such as idle USDT plus the vault's redeemable balance in the yield protocol. Thus the bookkeeping can be internally consistent and externally false. The test also exercises no fee-bearing withdrawal and no sequence in which drift can accumulate.

## `test_WithdrawFeeBps`

This establishes only that the getter returns the configured constant `30`.

It only appears to test withdrawal fees. It does not show that a fee is calculated correctly, retained in the protocol, attributed to remaining shareholders, included in total assets, or eventually redeemable. No value moves at all. It is a configuration/wiring assertion, not an economic-behavior assertion.

## `test_ConstructorSetsUsdt`

This establishes that the constructor stored the supplied token address and that `usdt()` returns it.

It only appears to say something about correct token handling. It does not exercise transfers, actual received amounts, yield-protocol custody, accounting, or USDT-specific behavior. It verifies constructor wiring, not a vault safety property.

# Why 100% coverage was compatible with the defect

Line and function coverage answer whether execution visited code, not whether the assertions constrained its meaning. A test can execute every deposit and withdrawal line while asserting constants, getters, or values derived from the same state it is trying to validate. Coverage also has no concept of conservation of value and does not search histories of calls merely because each function was called once.

Here, deposit and withdrawal paths could each be covered in a fresh or otherwise convenient state. The missing behavior exists in the relationship between states across a sequence: a withdrawal leaves a fee in the yield protocol, but recorded assets fail to retain that fee. Subsequent share pricing trusts the understated record. Nothing about reaching all lines forces a test to compare that record with independently measured custody after the transition, much less after many transitions.

That is why “every operation is correct in isolation” is the tell. An accumulating accounting bug is a failure of composition. Each local transition can have plausible outputs—correct shares sent, correct net withdrawal paid, correct fee charged—while updating a shared aggregate with the wrong quantity. If the fee remains invested, accounting must decrease by the assets that actually leave custody, not by the gross amount that includes the retained fee. Repeating a locally plausible but globally inconsistent transition grows the discrepancy. Isolated examples systematically reset or ignore the history that exposes it.

# The missing property

After every successful state-changing operation, and therefore after every valid sequence of deposits and withdrawals, the vault's recorded assets must equal the assets economically owned by the vault and backing its outstanding shares:

```solidity
vault.totalAssetsStored()
    == usdt.balanceOf(address(vault))
     + yieldProtocol.redeemableAssets(address(vault));
```

The right-hand side must be adapted to the integration's real custody model—for example, converting the vault's protocol shares to underlying at the current exchange rate—and must not be computed from `totalAssetsStored` itself. If `totalAssets()` is intended to report backing assets, it must satisfy the same equality. Subject only to an explicitly documented rounding tolerance, this is an equality, not `recorded <= actual`: a one-sided solvency assertion would remain green for precisely this surplus/stranded-assets bug.

The appropriate test is a handler-driven Foundry invariant test. The handler should maintain funded, approved actors and expose valid, bounded actions such as deposits and partial/full withdrawals for multiple users. Foundry should generate arbitrary sequences against the handler, and after each sequence the invariant should independently calculate idle underlying plus redeemable underlying in the yield protocol and assert exact equality with the vault's recorded total. Inputs must reach successful state transitions; the run's call/revert statistics should be checked, and `fail_on_revert = true` is useful while constructing the handler so a no-op, mostly reverting campaign cannot look green.

A focused regression test should accompany the invariant: deposit for at least two users, perform at least two fee-bearing withdrawals while one user remains, and after each withdrawal compare recorded assets with independently measured backing. It should also assert that the remaining user's claim/share price increases by the retained fees according to the specified rounding rules and that the final legitimate claimant can redeem those assets. Two fee-bearing transitions demonstrate that the gap grows; a single mismatch proves divergence but not the reported cumulative drift.

In compact form, the invariant is: **no accounting-to-custody drift, in either direction, after any valid operation sequence**. Had the suite asserted that property, the first withdrawal that retained a fee physically but removed it from recorded assets would have failed the test.
