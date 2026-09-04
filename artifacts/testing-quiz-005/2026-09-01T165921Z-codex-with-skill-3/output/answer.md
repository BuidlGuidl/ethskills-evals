# What the suite proved—and what it missed

The suite has strong statement coverage but weak specification coverage. Each example checks a local output or a configured value. None checks that the vault's internal accounting remains equal to the assets it actually controls after a sequence of state transitions.

## What each test establishes

### `test_DepositMintsShares`

This establishes that, from the particular fixture state and for `DEPOSIT_AMOUNT`, `_deposit` returns `999e18` and credits Alice with `999e18` shares.

It only appears to establish that deposit share issuance is economically correct. The expected value can merely mirror the implementation's formula. It says nothing about whether those shares are backed by the right amount of assets, whether the exchange rate remains correct after fees have accumulated, whether a later depositor receives a fair number of shares, or whether existing holders can claim all managed assets.

### `test_DepositUpdatesTotalAssets`

This establishes that one deposit into a fresh fixture makes both the public `totalAssets()` result and the stored accounting variable equal `DEPOSIT_AMOUNT`.

It only appears to establish that `totalAssets` represents reality. The two asserted values may come from the same bookkeeping source, so their agreement is not independent evidence. The test does not compare either value with the underlying tokens actually controlled by the vault in the yield protocol (plus any idle tokens). Nor does it exercise the transition where the bug occurs: withdrawal with a retained fee.

### `test_WithdrawFeeBps`

This establishes only that the constant/getter is `30` basis points.

It only appears to test withdrawal fees. It does not establish that the fee charged is correct, that the user receives the gross amount minus the fee, or—most importantly here—that the retained fee remains included in managed-asset accounting and therefore belongs to the remaining shares. This is configuration testing, not economic-behavior testing.

### `test_ConstructorSetsUsdt`

This establishes that construction stores the supplied token address and exposes it through `usdt()`.

It only appears to validate the token integration. It does not prove that balances in that token are measured correctly, that assets placed in the external yield protocol are included, or that transfers and accounting reconcile over time.

## Why 100% coverage did not help

Line and function coverage answer whether execution reached code, not whether the assertions specified the right behavior. A withdrawal test may execute every line of withdrawal—including the faulty accounting update—and still pass if it checks only the withdrawing user's payout, shares burned, an event, or a value calculated with the same mistaken formula.

Likewise, all functions can be called at least once without ever testing their composition. Coverage does not require a deposit followed by withdrawals by different holders, a check after each transition, comparison with an independent source of truth, or proof that every controlled token remains represented by outstanding shares. Even branch coverage would not by itself supply that specification.

The two sides of the crucial equality are also different kinds of state:

- **Accounting:** `totalAssetsStored` (and any view derived from it).
- **Reality:** all underlying assets controlled for the vault, including its position/balance in the yield protocol and any idle underlying held directly.

Asserting two getters backed by the first side cannot validate the first side.

## Why “correct in isolation” is the tell

This is a state-machine bug. A deposit can mint the expected shares. A withdrawal can burn the expected shares, charge exactly 30 bps, and transfer exactly the expected net amount. Nevertheless, the transition can be globally wrong if bookkeeping decreases by the gross withdrawal while custody decreases only by the net payout. The difference is the retained fee:

```text
actual managed assets after = actual before - net paid out
recorded assets after       = recorded before - gross withdrawal
drift increase              = gross withdrawal - net paid out = fee
```

Thus no individual return value needs to be surprising. The failure exists in the relation between state variables across a history of operations. Saying operations are correct only in isolation points directly to the missing sequential invariant and to a lack of stateful testing.

## The property that should have been asserted

Assuming no unsolicited donations and treating separately any yield accrued since the last synchronization, the core invariant is:

```text
totalAssetsStored == idle underlying balance
                   + underlying value of the vault's yield-protocol position
```

Equivalently, after every deposit or withdrawal transition with no intervening yield:

```text
accounted assets after - accounted assets before
    == actual managed assets after - actual managed assets before
```

For a withdrawal whose gross asset entitlement is `G`, fee is `F`, and user payout is `G - F`, the specific postcondition is:

```text
totalAssetsStored_after == totalAssetsStored_before - (G - F)
```

because `F` never leaves the managed position. If the design uses a synchronization mechanism for yield, the equality should be asserted immediately after synchronization, or the invariant should compare against the protocol position using exactly the documented valuation and rounding tolerance. It must not silently permit an ever-growing positive difference.

## Test shape

At minimum, write a regression test with two holders:

1. Alice and Bob deposit.
2. Snapshot independently measured managed assets and `totalAssetsStored`.
3. Alice makes a partial or full withdrawal that incurs a nonzero fee.
4. Measure the yield-protocol position plus idle underlying again.
5. Assert that the user's balance increased by the net payout, that actual managed assets fell by that same net payout, and that `totalAssetsStored` equals actual managed assets (within only an explicitly justified rounding bound).
6. Assert that Bob's shares can redeem their proportional claim on the retained fee. After the final legitimate holder redeems, no unexplained underlying should remain stranded.

The durable version is a Foundry stateful invariant test. A handler should generate bounded deposits, partial withdrawals/redeems, full exits, multiple actors, and varied amounts, with withdrawals chosen often enough to produce nonzero fees. After every handler call, assert:

```solidity
assertApproxEqAbs(
    vault.totalAssetsStored(),
    underlying.balanceOf(address(vault)) + protocol.assetsOf(address(vault)),
    documentedRoundingTolerance
);
```

The exact protocol-side expression will depend on the integration: it may require valuing receipt tokens rather than calling `assetsOf`. The important point is that the right-hand side is an independent custody measurement, not `vault.totalAssets()` if that view reads the same stored variable.

A useful additional end-state assertion is that, after all outstanding shares are redeemed, the residual managed balance is at most the documented rounding dust. The primary invariant catches the first bad transition; the terminal assertion demonstrates the user consequence—retained fees cannot become ownerless, unclaimable assets.
