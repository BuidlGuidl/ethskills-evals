# What the suite proved—and what it missed

All four tests are examples, not accounting properties. They prove selected outputs at selected states. They do not prove that the vault's two representations of value—its recorded assets and its actual redeemable holdings—remain synchronized through arbitrary state transitions.

## What each test actually establishes

### `test_DepositMintsShares`

This establishes that, from the test's particular initial state, depositing `DEPOSIT_AMOUNT` through `_deposit` returns `999e18` shares and credits that many shares to Alice.

It may appear to establish that deposit share accounting is correct. It does not. The test repeats the implementation's expected number without relating that number to the vault's assets, the pre-deposit share price, another depositor, or a later redemption. It says nothing about whether those shares retain the correct claim after fees are left behind by withdrawals. Even if the initial mint is exactly right, later asset undercounting can make every outstanding share appear worth too little.

### `test_DepositUpdatesTotalAssets`

This establishes that one deposit into the chosen initial state makes both public accounting views equal `DEPOSIT_AMOUNT` immediately afterward.

It may appear to establish that `totalAssets` is accurate. It only checks a deposit transition, at a moment when recorded and physical assets naturally move by the same amount. It never compares either reported value with the vault's actual redeemable position in the yield protocol, and it never checks the transition that creates the discrepancy: a withdrawal whose fee remains invested. Equality between `totalAssets()` and `totalAssetsStored()` is not useful if both are backed by the same stale or incorrectly updated accounting value.

### `test_WithdrawFeeBps`

This establishes only that the getter/constant returns `30`.

It may appear to test the withdrawal fee. It does not establish that a 30-basis-point fee is calculated correctly, that the user receives the correct net amount, or—most importantly here—that the retained fee remains in total assets and benefits the remaining shareholders. Testing a parameter is not testing the accounting consequences of applying it.

### `test_ConstructorSetsUsdt`

This establishes that the constructor stores the supplied USDT address in `usdt`.

It may appear to validate the vault's asset integration. It does not establish that balances or yield-protocol positions denominated in that token are measured correctly, or that the recorded total reconciles to them after any operation. It is wiring coverage, not an asset-accounting test.

## Why 100% coverage was compatible with the bug

Line and function coverage answer whether execution visited code, not whether the suite asserted the right semantics. A withdrawal test can execute every line in the withdrawal function and check the user's payout, shares burned, event, and fee calculation while never asserting what claim remains for other shareholders. The faulty update to `totalAssetsStored` is then "covered" even if no assertion can distinguish it from the correct update.

Coverage also does not cover histories. A vault is a state machine, and its correctness depends on relationships that must survive sequences of calls. Covering `deposit` and `withdraw` separately does not cover the economically significant transition `deposit -> deposit -> withdraw -> redeem`, nor does it prove an invariant after every transition. Likewise, 100% function coverage can be obtained by calling getters whose values all originate from the same incorrect stored variable.

"Every operation is correct in isolation" is therefore the tell. The bug is not necessarily visible in an operation's local outputs; it is a failure to conserve value across state transitions. On a withdrawal of gross amount `G` with retained fee `F`, the user receives `G - F`. Actual protocol holdings consequently fall by only `G - F`. If stored assets are reduced by all of `G`, recorded assets immediately fall below actual assets by `F`. The payout can be right, the shares burned can look right, and the fee can be right, while the post-state is wrong. Repeating the locally plausible transition accumulates the discrepancy.

## The missing property

The suite should have asserted this reconciliation invariant after every successful state-changing operation:

> `vault.totalAssetsStored()` (and `vault.totalAssets()`, if it is intended to report the same value) equals the current amount of underlying assets that the vault can redeem from its yield-protocol position, plus any underlying held directly by the vault, subject only to an explicitly documented rounding tolerance.

Equivalently, no underlying attributable to the vault may be outside the accounting that determines shareholder claims. A withdrawal fee retained in the yield protocol is still an asset of the vault, so it must remain in the numerator used for share value.

For the particular withdrawal transition, absent external yield or loss, the precise delta property is:

```text
actualBefore = redeemableProtocolAssets(vault) + directUnderlying(vault)
recordedBefore = vault.totalAssetsStored()

withdraw gross G, retaining fee F and transferring net N = G - F

actualAfter   = actualBefore - N
recordedAfter = recordedBefore - N
recordedAfter = actualAfter
```

Thus, if the implementation burns shares corresponding to gross `G`, the retained `F` must still be included in the remaining assets. Subtracting `G` from stored assets is the faulty transition; the appropriate asset decrease is the amount that actually leaves the vault's ownership, `N`.

## Test shape that catches it

Use at least two shareholders so that a withdrawal leaves somebody whose claim must receive the retained fee:

1. Alice and Bob deposit known amounts.
2. Snapshot the vault's actual redeemable protocol assets, recorded assets, total supply, and Bob's shares.
3. Alice withdraws or redeems, paying the 30-basis-point fee while that fee remains in the protocol.
4. Measure the actual assets again and assert that their decrease equals Alice's net token receipt—not the gross withdrawal amount.
5. Assert `totalAssetsStored() == actual redeemable protocol assets + direct underlying` (within only the protocol's known rounding bound).
6. Assert the remaining share price, `totalAssets / totalSupply`, incorporates the retained fee. As an end-to-end check, let Bob redeem all remaining shares and assert that he can receive the entire remaining accounted balance, including Alice's retained fee, again allowing only specified rounding.

A stateful invariant/fuzz test should then generate long, mixed sequences of deposits, withdrawals, redemptions, and yield updates across several actors and run the same reconciliation assertion after every action. The deterministic two-user regression test identifies this exact bug; the stateful invariant prevents the same class of accounting drift from returning under a different call sequence.
