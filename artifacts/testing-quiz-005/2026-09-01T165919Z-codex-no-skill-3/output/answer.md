# What the suite proved—and what it missed

The suite established that selected calls produced selected expected outputs from selected starting states. It did not establish that the vault's accounting remained consistent with the assets it controlled across a history of calls. Those are different claims.

## What each test actually establishes

### `test_DepositMintsShares`

This establishes that one deposit of `DEPOSIT_AMOUNT`, from the fixture's initial state, returns `999e18` shares and credits exactly that many shares to Alice.

It only appears to establish that share minting is generally correct. It says nothing about whether the minted shares represent the right fraction of the vault after prior deposits, retained withdrawal fees, yield, rounding, or a sequence involving multiple users. Even within this call it checks the nominal share result, not the relationship among shares, recorded assets, and assets actually controlled by the vault.

### `test_DepositUpdatesTotalAssets`

This establishes that after one deposit from the fixture's initial state, both public accounting views equal the deposited amount.

It only appears to establish that `totalAssets` accounting is correct. The test checks two accounting values against the deposit input; it does not independently measure the tokens controlled by the vault or its yield-protocol position. If `totalAssets()` is derived from `totalAssetsStored()`, the two assertions are substantially the same assertion. Most importantly, the test never checks the accounting after a withdrawal that leaves its fee invested.

### `test_WithdrawFeeBps`

This establishes only that the constant/configured value is `30` basis points.

It only appears to test the withdrawal fee. It does not show that a withdrawal calculates that fee correctly, transfers the correct net amount, leaves the fee in the protocol, attributes the retained fee to the remaining shares, or updates recorded assets by the net outflow rather than the gross redemption amount. A correct constant cannot validate the state transition that uses it.

### `test_ConstructorSetsUsdt`

This establishes that the constructor stores the expected token address.

It only appears to contribute to confidence in the vault's financial correctness. It validates wiring, not accounting behavior. The correct token can be configured while balances denominated in that token are recorded incorrectly.

## Why 100% coverage was compatible with the bug

Line and function coverage answer whether code ran, not whether the right facts were asserted after it ran. A test can execute every line in the withdrawal path—including fee calculation, protocol interaction, transfer, and storage update—while asserting only that the call succeeded or that the user received the expected net amount. Coverage treats a line as covered even when no assertion could detect that the line subtracts the gross withdrawal from stored assets although only the net amount actually left the vault.

The same limitation applies to 100% function coverage: every function may be invoked without testing the relationships that must hold between functions and over time. Coverage does not measure scenario diversity, state-space coverage, assertion quality, cross-call composition, or invariants. It is entirely compatible with all 39 tests sharing fresh, simple fixtures and checking local outputs while never comparing internal accounting with an independent asset balance after a mixed sequence.

The two asset assertions above may also be correlated rather than independent. Comparing one internal accounting representation with another derived from it cannot reveal that both omit the same retained fee. An accounting system cannot validate itself merely by agreeing with itself.

## Why “every operation is correct in isolation” is the tell

This is a compositional accounting bug. Deposits can transfer and mint exactly what their local specification says. Withdrawals can burn the expected shares, calculate a 30-basis-point fee, pay the exact net amount, and leave the fee invested. Nevertheless, if the accounting update removes the gross redemption amount while the asset movement removes only the net amount, each withdrawal creates a discrepancy equal to the retained fee:

```text
actual assets after = actual assets before + deposits - net withdrawals
recorded assets after = recorded assets before + deposits - gross withdrawals
drift increase = gross withdrawal - net withdrawal = retained fee
```

Thus the bug lives in the relationship between the otherwise plausible local actions. A retained fee has two effects that must be composed: it is withheld from the withdrawing user **and** it remains an asset belonging economically to the remaining shares. Testing only the first effect leaves the second unverified. Repetition then accumulates the discrepancy and depresses the recorded share price, making the excess assets unreachable through accounting-based redemption.

“Correct in isolation” is therefore evidence that the suite tested examples and endpoints but not conservation across transitions. Stateful financial systems require sequence invariants precisely because locally reasonable transitions can fail to compose.

## The missing property

Assuming the test environment introduces no yield, loss, donation, or rebasing, the suite should assert after **every** successful state transition:

> **All assets controlled for the vault's benefit are accounted for:**  
> `vault.totalAssetsStored() == independentlyMeasuredManagedAssets()`.

Here `independentlyMeasuredManagedAssets()` must be obtained from the token balance and/or the vault's redeemable position in the yield protocol—not from `totalAssetsStored()` or another view derived from it. In the described design it is typically:

```text
managed assets = idle USDT held by the vault
               + USDT value redeemable from the vault's protocol position
```

If protocol conversion introduces rounding, the property should use only the explicitly justified rounding tolerance (for example, at most one smallest unit), not a tolerance related to the fee. If deterministic mocks make valuation exact, equality should be exact.

Equivalently, for a withdrawal of gross asset value `G`, fee `F`, and user payment `G - F`, the transition property is:

```text
recordedAssetsAfter = recordedAssetsBefore - (G - F)
```

because only `G - F` leaves managed assets. The retained `F` must remain both physically present and included in recorded assets. The balance invariant is stronger because it also catches other ways for accounting and custody to diverge.

## Test shape that catches it

Use a stateful invariant/property test with at least two users and a handler that generates sequences of deposits and withdrawals of varied valid sizes. After each action, compare recorded assets with an independently valued protocol balance. A minimal deterministic regression has this shape:

1. Alice deposits.
2. Bob deposits.
3. Record independently measured managed assets.
4. Alice withdraws an amount that incurs a nonzero fee.
5. Assert that the protocol/managed-asset decrease equals Alice's **net receipt**, not the gross redemption.
6. Assert `totalAssetsStored()` equals independently measured managed assets; specifically, the retained fee is still included.
7. Have Bob redeem all remaining shares and assert that he can claim the remaining accounted assets, including Alice's retained fee, subject only to Bob's own withdrawal fee and documented rounding.
8. Repeat the invariant after every generated deposit and withdrawal over long mixed sequences.

In Foundry-style pseudocode:

```solidity
function invariant_allManagedAssetsAreAccountedFor() public view {
    uint256 managed = usdt.balanceOf(address(vault))
        + protocol.assetsRedeemableBy(address(vault));

    assertApproxEqAbs(vault.totalAssetsStored(), managed, ROUNDING_TOLERANCE);
}
```

The handler should select depositors, withdrawers, and bounded amounts, and the invariant must run after arbitrary call sequences rather than only on fresh deployments. A targeted regression should additionally assert:

```solidity
uint256 accountedBefore = vault.totalAssetsStored();
uint256 actualBefore = managedAssets();
uint256 userBefore = usdt.balanceOf(alice);

vm.prank(alice);
uint256 gross = vault.withdraw(requestedAssets, alice); // adapt to actual API

uint256 net = usdt.balanceOf(alice) - userBefore;
uint256 fee = gross - net;

assertGt(fee, 0);
assertEq(managedAssets(), actualBefore - net);
assertEq(vault.totalAssetsStored(), accountedBefore - net);
assertEq(vault.totalAssetsStored(), managedAssets());
```

The precise API details may differ, but the essential test oracle does not: compare the bookkeeping after a sequence against an independently measured conserved quantity. Had that property been asserted, the first fee-bearing withdrawal would have exposed the drift even though every line and function was already covered.
