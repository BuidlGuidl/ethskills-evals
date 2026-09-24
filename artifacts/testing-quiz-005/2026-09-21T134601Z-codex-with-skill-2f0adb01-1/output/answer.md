The four tests are not wrong, but they are much narrower than they look.

`test_DepositMintsShares` establishes that, for one particular deposit in the
initial fixture state, `_deposit(alice, DEPOSIT_AMOUNT)` returns `999e18` shares
and records `999e18` shares for Alice.

It only appears to establish that share accounting is generally correct. It does
not test the exchange rate after prior withdrawals, the effect of retained fees,
multiple users, or whether the shares represent all assets the vault controls.
It is a spot check of one local transition.

`test_DepositUpdatesTotalAssets` establishes that, immediately after one deposit,
`totalAssets()` and `totalAssetsStored()` equal `DEPOSIT_AMOUNT`.

It only appears to establish that asset accounting is correct. The bug described
is not "deposit forgot to add assets"; it is "withdrawal fees remain real assets
but stop being included in recorded assets." This test never performs a
withdrawal, never leaves a fee behind, and never compares recorded assets to the
actual token balance or strategy balance controlled by the vault.

`test_WithdrawFeeBps` establishes that the configured withdrawal fee constant is
`30` basis points.

It only appears to establish withdrawal fee behavior. A correct fee rate says
nothing about where the fee goes in accounting. The important question is not
whether the fee is 30 bps, but whether the 30 bps that stays in the protocol
continues to belong to the remaining shareholders.

`test_ConstructorSetsUsdt` establishes that the vault was constructed with the
expected USDT token address.

It only appears to establish that the vault is wired correctly. It does not say
anything about economic accounting, share price, strategy balances, or retained
withdrawal fees.

100% line and function coverage is compatible with this bug because coverage
only proves that code was executed. It does not prove that the right economic
relationships were asserted after execution. A test can run every line in
`deposit`, `withdraw`, `totalAssets`, and the constructor while only checking
local return values, constants, and one-step balances. That gives perfect
coverage of syntax paths while giving poor coverage of the protocol's actual
obligation: conserve and correctly allocate value over time.

"Every operation is correct in isolation" is the tell, not the alibi. This is a
stateful accounting bug. A single withdrawal can look locally correct: the user
gets their withdrawal less the fee, their shares are burned, and the call's
visible balances may match the implementation's formula. But if the fee is meant
to remain in the protocol, then it is still an asset of the vault. The next share
price must include it. If each isolated withdrawal subtracts the gross amount
from recorded assets while the net amount leaves and the fee remains, the system
creates a small accounting gap each time. No one call has to look dramatic; the
drift is the accumulated failure of a global invariant.

The suite should have asserted an asset-conservation property:

> After every deposit and withdrawal, the vault's recorded total assets must equal
> the actual assets controlled for shareholders, including withdrawal fees retained
> in the yield protocol, up to explicitly allowed rounding dust.

In concrete test terms, for every reachable state:

```solidity
uint256 actualAssets =
    usdt.balanceOf(address(vault)) +
    yieldProtocol.balanceOfUnderlying(address(vault));

assertApproxEqAbs(vault.totalAssets(), actualAssets, maxRoundingDust);
assertApproxEqAbs(vault.totalAssetsStored(), actualAssets, maxRoundingDust);
```

If the vault has only strategy-held assets, then `actualAssets` should be that
strategy position. If it can hold both idle USDT and strategy USDT, the property
must include both. The key is that retained withdrawal fees are included in
`actualAssets`; they are not owner fees and not burned value.

The right test shape is a stateful sequence test, ideally fuzzed or invariant
based:

1. Start with at least two users.
2. Have users deposit bounded random amounts.
3. Have one or more users withdraw partial or full positions.
4. After each operation, assert recorded assets equal actual vault-controlled
   assets.
5. Also assert that a remaining user's redeemable value reflects the retained
   fee, within rounding.

A minimal deterministic regression would be:

1. Alice deposits `A`.
2. Bob deposits `B`.
3. Alice withdraws all shares and pays a 30 bps fee.
4. Compute the actual assets still controlled by the vault or strategy.
5. Assert `vault.totalAssets()` equals that actual amount.
6. Assert Bob can redeem the remaining assets, including Alice's retained fee,
   within rounding.

That property catches the shipped bug because the faulty implementation would
leave real tokens in the protocol while `totalAssets()` / `totalAssetsStored()`
falls below the actual controlled balance. The failure is not that a getter had
the wrong value in a vacuum; it is that the accounting stopped conserving value
across a long-lived sequence of valid operations.
