# What the suite proved—and what it did not

The suite's green status and 100% line/function coverage do not establish that the vault preserves its accounting over time. The tests shown mostly check local snapshots or wiring. The production defect is a state-machine defect: each withdrawal can look reasonable by itself while its accounting transition omits a retained fee, and the omission accumulates across a sequence.

## What each test actually establishes

### `test_DepositMintsShares`

This establishes that, from the particular fixture state and for the single fixed `DEPOSIT_AMOUNT`, `_deposit` returns `999e18` and writes `999e18` to Alice's share balance.

It only appears to establish that deposit share accounting is generally correct. It does not independently derive the expected shares from the pre-deposit exchange rate, cover other amounts or prior states, check the change in assets against tokens actually received, or show that those shares remain fairly valued after later withdrawals. If `999e18` was copied from the implementation's formula, the assertion can merely encode the same mistake as the implementation.

### `test_DepositUpdatesTotalAssets`

This establishes that one deposit into the initial fixture causes both `totalAssets()` and `totalAssetsStored()` to report `DEPOSIT_AMOUNT`.

It only appears to establish that reported total assets equal the vault's real assets. Both values may come from the same internal accounting variable, so their agreement is not independent evidence. The test never compares either value with custody—for example, the underlying-token balance held directly by the vault plus the underlying value of its yield-protocol position. It also says nothing about how the stored total changes on withdrawal, especially when part of the nominal withdrawal is retained as a fee.

### `test_WithdrawFeeBps`

This establishes only that the public constant/getter returns `30`.

It only appears to test withdrawal fees. It does not perform a withdrawal, calculate the fee, check the user's receipt, check where the fee went, or check whether the retained fee remains included in total assets and therefore in the exchange rate. It tests configuration, not fee behavior or accounting.

### `test_ConstructorSetsUsdt`

This establishes that construction stores the supplied token address and exposes it through `usdt()`.

It only appears to add confidence in asset handling. It does not establish correct transfer behavior, actual balances, yield-protocol custody, or reconciliation between custody and the ledger. Unless there is constructor transformation or validation to test, this is essentially a wiring assertion.

## Why 100% coverage was compatible with the bug

Coverage answers whether execution visited a line or entered a function. It does not answer whether the resulting state was checked against an independent correctness condition. A test can execute every deposit and withdrawal line while asserting getters against values written by those same lines. It can also traverse the faulty withdrawal update and still remain green because no assertion observes the omitted retained fee.

Line and function coverage also do not measure meaningful state histories. Thirty-nine one-operation examples can cover all code while never exercising `deposit -> withdraw -> deposit -> withdraw` under changing supply, exchange rate, users, and amounts. Coverage therefore cannot demonstrate conservation, absence of drift, or eventual claimability.

"Every operation is correct in isolation" is the tell because the reported failure has composition as its essential ingredient. A retained fee creates a relationship between the completed withdrawal and the value left for future shareholders. If tests reset the fixture for each operation, they discard precisely the history in which that relationship matters. The relevant question is not merely whether one call returns a plausible amount; it is whether every transition preserves the global relationship between internal accounting and externally held value. A small transition error can be invisible or look locally plausible, yet become obvious after repeated transitions.

## The missing property

At every settled state in which the vault's accounting is meant to be current:

```text
totalAssetsStored
    == underlying held directly by the vault
     + underlying value of every yield-protocol position owned by the vault
```

Equivalently, if `actualControlledAssets()` independently measures those custody locations:

```solidity
assertEq(vault.totalAssetsStored(), actualControlledAssets());
```

`totalAssets()` should satisfy the same equality if it is specified to report current controlled assets. The custody side must be derived independently—token balances and the protocol position's redeemable underlying—not from `totalAssetsStored()` or another getter backed by the same ledger. If protocol conversion necessarily rounds, the invariant must state the exact justified rounding bound; it must not use only `recorded <= actual`, because that one-sided assertion deliberately permits the surplus/stranded-assets failure described here.

For a withdrawal worth `grossAssets` with retained fee `fee` and user payment `grossAssets - fee`, this property implies that controlled assets and recorded assets both fall only by the amount actually paid out (plus any separately documented external loss):

```text
recordedAfter = recordedBefore - (grossAssets - fee)
actualAfter   = actualBefore   - (grossAssets - fee)
```

The fee remains in the protocol, remains in `actualAfter`, and must remain in `recordedAfter`. Subtracting `grossAssets` from the stored total while transferring only the net amount is exactly the drift.

## Test shape that catches it

Use a handler-driven Foundry invariant test, not another single example:

1. The handler owns several funded actors with valid approvals.
2. Its actions perform successful deposits and withdrawals/redemptions with amounts bounded to valid balances and shares. Include partial and full withdrawals, repeated cycles, and different users so that value retained from one user's withdrawal must accrue to those still invested.
3. Target the handler, so generated calls usually reach real state transitions rather than reverting because arbitrary senders lack funds or approvals.
4. After every generated sequence, independently compute `actualControlledAssets()` from direct token custody plus the yield-protocol position and assert exact equality with `totalAssetsStored()` (and `totalAssets()` if applicable).
5. While developing the handler, enable `fail_on_revert = true` and inspect call/revert statistics; an invariant that leaves the initial state unchanged proves nothing.

A small deterministic regression should accompany the invariant: Alice and Bob deposit, Alice withdraws with a nonzero fee, then assert that the vault's recorded total equals independently measured controlled assets and that the post-withdraw share price includes the retained fee. Repeat withdrawals to demonstrate that equality never drifts. That regression documents this defect; the randomized invariant searches for other sequences that violate the same conservation rule.
