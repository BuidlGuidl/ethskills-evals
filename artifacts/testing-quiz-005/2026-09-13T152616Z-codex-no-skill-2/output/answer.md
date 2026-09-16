# What the tests prove—and what they do not

`test_DepositMintsShares` proves that, from this test's particular initial state, one deposit returns `999e18` and credits Alice with the same number of shares. It proves a single example of the deposit calculation and the share-balance write. It does **not** prove that those shares have the correct economic value, that the vault's asset denominator matches its real backing, that later entrants receive a fair number of shares, or that withdrawal fees are credited to the remaining shareholders. The exact expected value can even encode the implementation's accounting assumptions without independently checking whether those assumptions conserve assets.

`test_DepositUpdatesTotalAssets` proves that, immediately after a deposit, `totalAssets()` and `totalAssetsStored()` both report `DEPOSIT_AMOUNT`. If `totalAssets()` is derived from, or merely returns, the same stored accounting value, this is two observations of one piece of bookkeeping. It only appears to establish that the vault really owns that many assets. It never compares the bookkeeping with an independent source of truth—the vault's idle token balance plus the assets attributable to it in the yield protocol—and it never crosses the withdrawal path where retained fees create the discrepancy.

`test_WithdrawFeeBps` proves only that a public constant/getter is `30`. It does not prove that the fee is calculated with the intended rounding, retained rather than transferred, included in assets after withdrawal, or reflected in the price paid to remaining shares.

`test_ConstructorSetsUsdt` proves that the constructor stores the supplied token address. It does not prove correct token movements, protocol accounting, or denomination of shares and assets.

## Why 100% coverage did not help

Line and function coverage answer whether execution reached code, not whether the assertions specified the right behavior. A test can execute every accounting update while asserting values produced by the same flawed accounting model. Coverage also does not imply meaningful path, sequence, boundary, or state-transition coverage. In particular, executing `deposit` in one test and `withdraw` in another does not test the state produced by their composition, and executing a fee-retention line does not prove that the retained fee was included in the next share-price calculation.

The phrase “every operation is correct in isolation” is therefore the tell. A vault is a state machine, and its central obligation is conserved across transitions and across users. This bug is temporal/compositional: a withdrawal can transfer the correct net amount, burn the expected shares, and charge the correct fee, yet leave the next state inconsistent by reducing recorded assets by the gross withdrawal while real backing fell only by the net payout. No single return value need look wrong. The bad result becomes visible when the post-state of that withdrawal is used to price a later deposit or withdrawal.

## The missing property

After every successful state transition, recorded total assets must equal the assets actually attributable to the vault:

```text
totalAssetsStored
    == idle underlying held by the vault
     + underlying value of the vault's position in the yield protocol
```

The right-hand side must be measured independently of `totalAssetsStored`; otherwise the assertion is circular. Subject to the protocol's documented rounding, the comparison should be exact or use only that explicit rounding tolerance.

For a withdrawal whose gross share value is `g`, fee is `f`, and actual transfer to the receiver is `g - f`, where `f` remains invested, the transition-specific form is:

```text
realAssetsAfter     = realAssetsBefore - (g - f)
recordedAssetsAfter = recordedAssetsBefore - (g - f)
```

Equivalently, if the implementation first subtracts `g`, it must add the retained `f` back. Subtracting `g` from recorded assets while transferring only `g - f` is exactly the drift.

The suite should include a sequence test, and preferably the same assertion as a stateful invariant:

1. Alice deposits; record total supply, Alice's shares, recorded assets, and independently measured real assets.
2. Bob deposits, so there are remaining shareholders when one exits.
3. Alice withdraws or redeems and pays a nonzero fee.
4. Measure the receiver's balance delta to establish the net payout and measure the vault's idle-plus-protocol backing again.
5. Assert `totalAssetsStored() == realBacking()` and assert that both decreased by the receiver's net payout, not by the gross redeemed value.
6. Assert the remaining shares' claim includes the retained fee: with `S_after` shares outstanding, their aggregate claim is the full `realBackingAfter`, and the share price is `realBackingAfter / S_after` under the vault's stated rounding rules.
7. Continue with another deposit and withdrawal and repeat the reconciliation after every action.

A handler-based invariant test should generate long, interleaved sequences of deposits and withdrawals by several actors and, after each call, assert the same reconciliation. That test shape catches the reported cumulative drift directly. A useful terminal check is to redeem all remaining shares and assert that only explicitly documented rounding dust remains; a positive, growing protocol balance after supply reaches zero proves that assets have become unclaimable. The reconciliation invariant is the primary property, while the terminal check makes its user impact unmistakable.
