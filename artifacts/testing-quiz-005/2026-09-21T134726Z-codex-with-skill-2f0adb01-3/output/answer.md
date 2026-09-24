The tests shown exercise the vault, but they do not specify the vault's accounting
law.

`test_DepositMintsShares`

What it actually establishes: for one fixed deposit amount, into one initial state,
`deposit` returns `999e18` shares and records those shares for `alice`.

What it only appears to establish: that share minting is economically correct. It
does not prove that the shares represent the right fraction of the vault, that the
price per share is correct after prior activity, or that later fees left in the
protocol will be reflected in the remaining shares. It is a point example, not a
property of the share accounting system.

`test_DepositUpdatesTotalAssets`

What it actually establishes: after a single deposit into the tested starting state,
`totalAssets()` and `totalAssetsStored()` equal the deposited amount.

What it only appears to establish: that the vault's recorded assets always match the
assets it controls. It checks the easiest state transition, where assets enter and
stored accounting increases by the same amount. It says nothing about the harder
transition: assets leaving on withdrawal while the withdrawal fee remains inside the
protocol and must therefore remain counted.

`test_WithdrawFeeBps`

What it actually establishes: the configured withdrawal fee constant is `30` basis
points.

What it only appears to establish: that withdrawal fees are handled correctly. It
does not check that the fee is charged, where it goes, whether it remains included in
`totalAssets`, or whether it accrues to remaining share holders. It verifies a
parameter, not the effect of that parameter on value conservation.

`test_ConstructorSetsUsdt`

What it actually establishes: the vault stores the expected USDT token address.

What it only appears to establish: that the vault is wired correctly. It does not
check protocol accounting, share pricing, claimability, or the interaction between
USDT balances, protocol balances, and stored totals.

This is why 100% line and function coverage was compatible with the bug. Coverage
answers only "did a test execute this code?" It does not answer "did a test assert
the economic fact this code is responsible for preserving?" A suite can call every
function, hit every branch, and still only assert local postconditions and constants.
The missing condition here was cross-operation accounting conservation.

"Every operation is correct in isolation" is therefore the tell, not the alibi. A
vault is a state machine. Deposits, withdrawals, fees, share supply, and protocol
balances compose over time. If a single withdrawal subtracts the gross redeemed
amount from `totalAssetsStored` while only the net amount actually leaves the system,
that one call can look locally sensible: the user received the right net amount, the
fee was charged, shares were burned, and no transfer failed. But the retained fee is
still an asset controlled by the vault. If the accounting forgets it, the error is
not visible as an insolvent withdrawal; it appears as drift between the recorded
asset total and the real redeemable asset total. Repeating correct-looking steps
accumulates an incorrect global state.

The property the suite should have asserted is:

After any sequence of deposits and withdrawals, the vault's recorded total assets
must equal the underlying assets actually controlled by the vault and its yield
protocol position, up to intentional rounding. Equivalently, a withdrawal fee that
remains in the protocol must remain included in `totalAssets`; only the amount paid
out to the withdrawing user may reduce the vault's recorded assets.

For a withdrawal, the local form is:

```solidity
uint256 assetsBefore = vault.totalAssets();
uint256 receiverBalanceBefore = usdt.balanceOf(receiver);

vault.withdraw(...);

uint256 paidOut = usdt.balanceOf(receiver) - receiverBalanceBefore;
assertEq(vault.totalAssets(), assetsBefore - paidOut);
assertEq(vault.totalAssets(), actualUnderlyingControlledByVault());
```

The sequence test shape should force at least one user to remain in the vault:

```solidity
function test_WithdrawFeeStaysAccountedForRemainingHolders() public {
    uint256 aliceShares = _deposit(alice, 1_000e18);
    _deposit(bob, 1_000e18);

    uint256 assetsBefore = vault.totalAssets();
    uint256 aliceBefore = usdt.balanceOf(alice);

    vm.prank(alice);
    vault.redeem(aliceShares, alice, alice);

    uint256 paidToAlice = usdt.balanceOf(alice) - aliceBefore;
    uint256 actualAssets = actualUnderlyingControlledByVault();

    assertEq(vault.totalAssets(), assetsBefore - paidToAlice);
    assertEq(vault.totalAssets(), actualAssets);
    assertEq(vault.totalAssetsStored(), actualAssets);
}
```

And the stronger version should be an invariant test with a handler that performs
random deposits and withdrawals across multiple users:

```solidity
function invariant_RecordedAssetsEqualControlledAssets() public view {
    assertApproxEqAbs(
        vault.totalAssets(),
        actualUnderlyingControlledByVault(),
        1
    );
}
```

That invariant would catch exactly this bug because each retained withdrawal fee
would increase the difference between real controlled assets and recorded assets.
The test would fail not because a single operation obviously misbehaved, but because
the composed accounting state no longer conserved value.
