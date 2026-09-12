# What the tests prove—and what they do not

The suite established that selected calls produced selected local results. It did not establish that the vault's accounting remained equal to its custody after arbitrary sequences of calls. That distinction is exactly where this bug lived.

## `test_DepositMintsShares`

```solidity
uint256 shares = _deposit(alice, DEPOSIT_AMOUNT);
assertEq(shares, 999e18);
assertEq(vault.shareBalance(alice), 999e18);
```

This establishes that, from the test's particular initial state and for `DEPOSIT_AMOUNT`, `_deposit` returns `999e18` and records that same number of shares for Alice. It is useful as a single deposit example.

It only appears to establish that share minting is economically correct. The expected value is a hand-picked snapshot, not an independent property. The test does not show that the shares correspond to Alice's proper fraction of all managed assets, that the exchange rate incorporates retained withdrawal fees, or that the result remains correct after other users deposit and withdraw. If both the return value and `shareBalance` are derived from the same understated internal accounting, they can agree while both are economically wrong.

## `test_DepositUpdatesTotalAssets`

```solidity
_deposit(alice, DEPOSIT_AMOUNT);
assertEq(vault.totalAssets(), DEPOSIT_AMOUNT);
assertEq(vault.totalAssetsStored(), DEPOSIT_AMOUNT);
```

This establishes that one deposit into a fresh vault causes both accounting getters to report the deposit amount.

It only appears to establish that `totalAssets` is accurate. The assertions compare accounting outputs with the input in the easiest state, where there is no retained fee and therefore no opportunity for drift. They do not compare recorded assets with an independently measured custody value, such as idle USDT plus the vault's redeemable balance in the yield protocol. The agreement between `totalAssets()` and `totalAssetsStored()` is also weak evidence if one is derived from, or merely exposes, the other: two views of the same bad ledger are not an external reconciliation.

## `test_WithdrawFeeBps`

```solidity
assertEq(vault.WITHDRAW_FEE_BPS(), 30);
```

This establishes only that the public constant/getter returns 30.

It only appears to test withdrawal fees. It does not execute a withdrawal or establish how the fee affects the assets sent to the withdrawing user, the assets left in the protocol, the stored total, the share price, or the claims of remaining shareholders. It tests configuration, not fee accounting.

## `test_ConstructorSetsUsdt`

```solidity
assertEq(address(vault.usdt()), address(usdt));
```

This establishes that the constructor stored the supplied token address and that the getter exposes it.

It only appears to give evidence about correct asset handling. It says nothing about USDT balances, protocol positions, transfer behavior, or reconciliation between custody and the vault's ledger. It is essentially a wiring test.

# Why 100% coverage was compatible with the bug

Line and function coverage answer whether code executed, not whether the test made a meaningful claim about its result. A getter test can cover a getter; a single deposit can cover the deposit path; and one withdrawal elsewhere in the suite can cover the withdrawal path. That can reach 100% while every assertion merely repeats a stored value, checks a constant, or checks one expected snapshot.

Coverage also has no notion of history. Executing every line at least once does not explore the state space formed by interleavings such as deposit by Alice, deposit by Bob, withdrawal by Alice, another deposit, and withdrawal by Bob. Nor does it prove a cross-component relationship such as “the internal asset ledger equals the independently observable assets under management.” The faulty update can therefore be executed—and counted as covered—without any assertion capable of detecting what it omitted.

“Every operation is correct in isolation” is the tell because drift is a stateful, compositional defect. A deposit can mint the expected shares in a clean state. A withdrawal can pay the requested net amount and leave its fee in the protocol. Each local postcondition can hold. The bug is that the withdrawal's two individually plausible effects are not reconciled: custody retains the fee while recorded assets stop including it. Repeating locally acceptable transitions accumulates a global accounting error. The missing evidence is therefore not another isolated example; it is a property that must survive sequences.

# The property that should have been asserted

After every successful state transition, the vault's recorded managed assets must equal its actual managed assets:

```text
totalAssetsStored
    == idle underlying held by the vault
     + underlying currently redeemable from the yield protocol by the vault
```

Equivalently, if `totalAssets()` is intended to be the authoritative accounting value:

```text
totalAssets() == actualManagedAssets()
```

and the suite should separately require `totalAssetsStored() == totalAssets()` if both are intended to agree.

The assertion must be equality. A one-sided solvency check such as `recordedAssets <= actualManagedAssets` would remain green for this exact bug: the vault has a surplus relative to its books. Conversely, checking only that holdings cover user claims cannot show that every held token is represented by a claim. Exact reconciliation catches both missing assets and stranded surplus.

The appropriate test is a handler-driven Foundry invariant test. The handler should create multiple funded, approved actors and expose valid, bounded actions such as deposit and withdraw (and redeem/mint or protocol sync actions if the vault supports them). Foundry should generate long, randomized sequences across those actors. After every generated sequence, the invariant should independently query the token balance and the protocol position and assert:

```solidity
function invariant_accountingMatchesCustody() public view {
    uint256 actual = usdt.balanceOf(address(vault))
        + yieldProtocol.redeemableAssets(address(vault));

    assertEq(vault.totalAssetsStored(), actual);
    assertEq(vault.totalAssets(), actual);
}
```

The exact custody calculation must match the integration: for a share-based yield protocol, it should value the vault's protocol shares in underlying using the protocol's authoritative conversion/preview mechanism, rather than reading the vault's own cached number. That independence is essential; otherwise the test asks the defective ledger to verify itself.

A focused regression sequence should accompany the invariant for diagnosis and permanence:

1. Alice and Bob deposit.
2. Alice withdraws an amount that incurs a nonzero fee.
3. Measure the vault's idle underlying plus its independently redeemable protocol assets.
4. Assert exact equality with recorded total assets, and optionally assert that Bob's redeemable claim/share price increased by the retained fee according to the vault's rounding rules.

The invariant is the general search that would have found the defect; the regression test records the minimal known witness. In the broken implementation, immediately after Alice's withdrawal the custody side includes the retained fee while the recorded side does not, so the equality fails even though Alice received the correct net amount and every individual call completed successfully.
