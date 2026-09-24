The tests show that the suite executed the vault. They do not show that the
vault's accounting stayed tied to the assets it controlled.

`test_DepositMintsShares`

This establishes that, for the one chosen deposit amount and the initial vault
state, `_deposit(alice, DEPOSIT_AMOUNT)` returns `999e18` shares and records the
same share balance for Alice.

It only appears to establish that deposit/share accounting is generally correct.
It does not check the share price against an independent accounting model, does
not exercise deposits after fees have accumulated, and does not ask whether the
shares minted are correct once the vault already contains retained withdrawal
fees. If the vault's recorded total has drifted below the real assets, a later
deposit can still mint exactly the amount the implementation says it should mint
while using the wrong price.

`test_DepositUpdatesTotalAssets`

This establishes that one deposit increases `totalAssets()` and
`totalAssetsStored()` to `DEPOSIT_AMOUNT`.

It only appears to establish that total-asset accounting is correct. The test
checks the simplest state transition before any fee-bearing withdrawal has
occurred. It does not compare the recorded total to the actual USDT or protocol
position controlled by the vault, and it does not check that later retained fees
remain counted as vault assets.

`test_WithdrawFeeBps`

This establishes that the public constant/getter returns `30`.

It only appears to establish that withdrawal fees are tested. It says nothing
about how the fee affects custody, share price, total assets, or the remaining
depositors. A fee rate can be configured correctly while the fee is accounted for
incorrectly.

`test_ConstructorSetsUsdt`

This establishes that the constructor stored the USDT address passed into it.

It only appears to establish that the vault is wired correctly. It does not check
USDT balances, protocol balances, transfer behavior, or conservation of assets.

100% line and function coverage was compatible with this bug because coverage is
only a statement about execution. It says each line and function ran at least
once; it does not say the tests made assertions capable of detecting the wrong
economic state. A test can cover the withdrawal code and still only assert the
receiver got the expected net amount, the burned shares changed, or the fee bps
constant is right. None of those assertions fail if the retained fee is real
money held by the protocol but omitted from `totalAssetsStored()`.

"Every operation is correct in isolation" is the tell. The reported failure is
not a single bad call that immediately violates a local expectation. It is a
stateful accounting drift: each withdrawal can pay the withdrawing user the
right net amount and leave the fee in the protocol as intended, while also
subtracting too much from the vault's recorded total. One call creates a small
gap between recorded assets and actual assets. Repeating the same individually
plausible operation grows the gap. That is exactly the kind of bug unit tests
over isolated calls miss and stateful invariants find.

The property the suite needed is:

After any successful sequence of deposits and withdrawals, the vault's recorded
asset total must equal the assets economically controlled by the vault, including
withdrawal fees intentionally retained in the yield protocol for remaining
shareholders.

More concretely:

```solidity
recordedAssets == actualVaultAssets
```

where `recordedAssets` is `vault.totalAssetsStored()` or the value used to price
shares, and `actualVaultAssets` is computed independently from custody:

```solidity
actualVaultAssets =
    usdt.balanceOf(address(vault))
    + yieldProtocol.assetsOf(address(vault));
```

using whatever real protocol query represents the vault's claim. The important
part is that retained withdrawal fees are included in `actualVaultAssets`, because
the design says those fees still belong to the remaining vault shareholders.

The test shape should be a handler-driven invariant, not only example tests:

1. Create several funded actors.
2. Let the handler perform valid deposits and valid withdrawals in many orders
   and sizes.
3. After every sequence, independently compute the vault's actual USDT/protocol
   position.
4. Assert exact no-drift accounting:

```solidity
function invariant_recordedAssetsEqualCustodiedAssets() public {
    uint256 actualAssets =
        usdt.balanceOf(address(vault)) +
        yieldProtocol.assetsOf(address(vault));

    assertEq(vault.totalAssetsStored(), actualAssets);
    assertEq(vault.totalAssets(), actualAssets);
}
```

A focused regression test should also demonstrate the accumulation:

1. Alice deposits.
2. Bob deposits.
3. Alice withdraws, creating a retained fee.
4. Bob withdraws or another user deposits/withdraws, creating another retained
   fee or repricing event.
5. Assert that the recorded total still equals actual custodied assets after
   each withdrawal, and that the remaining share price includes the retained
   fees.

The invariant is the real guardrail. A one-sided assertion such as
`recordedAssets <= actualAssets` would not catch this bug, because the bad state
is precisely a surplus stranded outside the accounting. The property must be an
equality, or an explicit zero-drift assertion:

```solidity
assertEq(actualAssets - recordedAssets, 0);
```

That is the missing search: not "did every function run?", but "can any valid
sequence make accounting diverge from custody?"
