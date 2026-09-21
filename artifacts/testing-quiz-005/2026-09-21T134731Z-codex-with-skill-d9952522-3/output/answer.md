# What the tests proved

`test_DepositMintsShares` proves that, for one chosen deposit amount into the initial state prepared by the test, `_deposit(alice, DEPOSIT_AMOUNT)` returns `999e18` shares and records `999e18` shares for Alice.

It only appears to prove that deposit accounting is generally correct. It does not prove the share price is correct after prior activity, that shares remain fairly priced after fees have accrued, or that the vault's internal accounting matches the assets actually under management. It checks one local outcome against the expected value for one local setup.

`test_DepositUpdatesTotalAssets` proves that, after one deposit into that same simple state, both `totalAssets()` and `totalAssetsStored()` equal the deposit amount.

It only appears to prove that asset accounting is correct. In reality it proves that the deposit path writes or reports the obvious value immediately after a deposit. It does not prove that all assets belonging to the vault are included in accounting after withdrawals, fees, yield, or mixed sequences of users entering and exiting.

`test_WithdrawFeeBps` proves that the configured withdrawal fee constant is `30`.

It only appears to prove fee behavior. It says nothing about where the fee goes, whether it remains claimable by remaining shareholders, whether it is included in share price, or whether repeated fee-bearing withdrawals preserve accounting. A correct number can still be applied in the wrong accounting model.

`test_ConstructorSetsUsdt` proves that the constructor stored the token address the test passed in.

It only appears to prove that the vault handles USDT correctly. It does not prove custody, accounting, transfer behavior, fee behavior, or any interaction with a real USDT-like token. It is a wiring test.

# Why 100% coverage missed it

Coverage records that code executed. It does not record that the right property was asserted.

A suite can execute every line and every function while only asserting implementation-shaped facts: the getter returns the stored address, the constant has the configured value, a single deposit produces the expected local balance, and the stored total equals the number just deposited. Those assertions can all remain true while the vault steadily loses track of fee assets over time.

This bug lives in a relationship between states across a sequence: the vault has more tokens in the protocol than its accounting recognizes. No single isolated call has to look wrong. A withdrawal can charge the intended fee, transfer the intended net amount, and update the withdrawing user's shares as expected, yet still fail to keep the retained fee inside `totalAssetsStored`. The error is not "this operation reverts" or "this one return value is bad"; it is "after valid operations, accounting and custody diverge."

That is why "every operation is correct in isolation" is the tell rather than the alibi. Vault safety is a system property. If the only evidence is a list of locally correct operations, the suite has not tested whether those operations compose into a correct history.

# The property that should have been asserted

The suite needed a conservation/accounting invariant:

> After any valid sequence of deposits and withdrawals, the vault's recorded total assets must equal the assets actually held for the vault in the underlying token/yield protocol, including withdrawal fees retained for remaining shareholders.

Precisely, in the terminology from the prompt:

```solidity
assertEq(vault.totalAssetsStored(), actualAssetsControlledByVault());
assertEq(vault.totalAssets(), actualAssetsControlledByVault());
```

Where `actualAssetsControlledByVault()` is not another vault accounting getter that could share the same bug. It must be measured from custody: the token balance held by the vault plus the vault's balance in the yield protocol, converted to underlying if needed.

If the fee is meant to accrue to remaining depositors, then after a withdrawal the fee must remain inside the asset base used to price the remaining shares. A weaker assertion like `vault.totalAssetsStored() <= actualAssetsControlledByVault()` is insufficient, because this exact bug is a surplus/drift bug: the vault holds more than it counts. The assertion must be equality, or an explicit zero-drift check:

```solidity
uint256 drift = actualAssetsControlledByVault() - vault.totalAssetsStored();
assertEq(drift, 0);
```

# Test shape

This should be a stateful invariant test, not just another single example unit test.

Use a handler that creates realistic valid actions:

- multiple funded users;
- approvals set up in advance;
- bounded deposit amounts;
- withdrawals bounded by each user's share balance;
- at least some withdrawals large enough to incur a nonzero fee;
- calls sequenced randomly by Foundry.

Then assert the invariant after every sequence:

```solidity
contract VaultInvariant is Test {
    Vault vault;
    VaultHandler handler;

    function setUp() public {
        // Deploy token, vault, yield protocol/mock or pinned fork integration.
        // Fund actors and approve through the handler.
        handler = new VaultHandler(vault, usdt);
        targetContract(address(handler));
    }

    function invariant_recordedAssetsEqualCustody() public {
        uint256 actual = underlyingHeldByVaultAndProtocol();

        assertEq(vault.totalAssetsStored(), actual);
        assertEq(vault.totalAssets(), actual);
    }
}
```

A targeted regression test should also demonstrate the specific failure mode with at least two fee-bearing withdrawals, because the report describes accumulating drift:

```solidity
function test_FeesRetainedInProtocolRemainCountedAcrossWithdrawals() public {
    _deposit(alice, 1_000e18);
    _deposit(bob, 1_000e18);
    _withdraw(alice, 100e18);
    _withdraw(bob, 100e18);

    uint256 actual = underlyingHeldByVaultAndProtocol();

    assertEq(vault.totalAssetsStored(), actual);
    assertEq(vault.totalAssets(), actual);
}
```

The important part is not those exact numbers. The important part is that the assertion ties accounting to custody after composed behavior. That is the property the green suite never asked the contract to satisfy.
