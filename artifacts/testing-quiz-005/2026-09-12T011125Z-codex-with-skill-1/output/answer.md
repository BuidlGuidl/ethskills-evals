# What the green vault suite actually proved

The four tests exercise code, but none establishes the system-level accounting property that failed.

## What each test establishes

### `test_DepositMintsShares`

This establishes that, from the particular initial state created by the fixture, one deposit of `DEPOSIT_AMOUNT` returns `999e18` shares and records the same number in Alice's share balance.

It only appears to establish that deposits always mint the economically correct number of shares. It does not independently calculate the shares from the vault's real underlying assets, test a deposit after earlier withdrawals have left fees behind, or show that the share price used for minting is correct. The return value and `shareBalance` may simply be two observations of the same bookkeeping decision. Both can agree while that decision is based on an understated asset total.

### `test_DepositUpdatesTotalAssets`

This establishes that one deposit causes both accounting getters to report `DEPOSIT_AMOUNT` in the tested initial state.

It only appears to establish that asset accounting matches the vault's assets. Both assertions read values maintained by the vault; they do not measure custody. In particular, the test never compares the recorded amount with idle USDT plus the vault's redeemable position in the yield protocol. It also does not execute the transition that creates the discrepancy: a fee-bearing withdrawal followed by continued operation.

### `test_WithdrawFeeBps`

This establishes only that the public constant/getter is `30`.

It only appears to test withdrawal fees. It says nothing about whether the fee is calculated correctly, whether the withdrawing user receives the correct net amount, where the retained fee remains, or whether that retained amount stays included in `totalAssets` and therefore in the remaining holders' share price. A correct constant does not constrain any fee-accounting behavior.

### `test_ConstructorSetsUsdt`

This establishes that the constructor stores the supplied token address and that `usdt()` returns it.

It only appears to add confidence in the vault's asset handling. It tests wiring, not value conservation, token movement, protocol balances, or accounting. Unless the constructor could select the wrong asset, it has no power to detect this defect.

## Why 100% coverage was compatible with the bug

Line and function coverage answer whether execution visited code, not whether the assertions specified the right behavior. A test can execute every deposit and withdrawal line while asserting only returned values, constants, and internally stored values. Coverage does not know that a retained withdrawal fee must remain an asset of the vault, nor does it compare the vault's ledger with external custody.

The suite covered operations but not histories. The faulty state emerges from composition: a deposit establishes a position; a withdrawal leaves a fee in the yield protocol; the vault's recorded total is reduced as though that fee had left; later deposits, withdrawals, and share-price calculations inherit the discrepancy. Executing each function once can reach 100% coverage without exploring that state transition or checking its cross-contract economic consequence.

That is why "every operation is correct in isolation" is the tell. Stateful financial contracts must remain correct under sequences. Local postconditions such as "the user received the expected net withdrawal" and "the stored total was updated by the expected formula" can both pass even when the formula forgets that the fee remains owned by the vault. If correctness disappears when individually plausible transitions are composed, the missing specification is a state invariant, not another isolated example.

## The property that should have been asserted

After every successful state-changing operation and after every valid sequence of operations:

```text
vault.totalAssetsStored()
    == idle underlying held directly by the vault
     + underlying currently redeemable by the vault from the yield protocol
```

Equivalently, if `totalAssets()` is intended to be the authoritative live valuation, both accounting views must agree with custody:

```text
vault.totalAssetsStored() == vault.totalAssets() == actualControlledAssets()
```

`actualControlledAssets()` must be measured independently of the vault's stored total. It should query the vault's direct USDT balance and the underlying value of its yield-protocol position. It must not reuse the accounting variable or a mock implementation derived from the same formula. If the external protocol necessarily rounds, the test should state and justify a tight rounding bound; it must check absolute drift in both directions, not merely `recorded <= actual`, because that one-sided assertion would remain green for this exact surplus/stranded-assets bug.

## Test shape

This belongs in a handler-driven Foundry invariant test. The handler should maintain several funded, approved actors and expose bounded, valid actions such as:

- deposit for different actors;
- withdraw or redeem partially and fully;
- repeat deposits after fee-bearing withdrawals;
- where applicable, advance time or realize protocol yield.

Foundry should target the handler, generate long random interleavings, and assert the accounting-to-custody equality after every generated sequence. Inputs should be bounded so calls make real state transitions, and the call/revert statistics must be checked; targeting the vault directly with unfunded random senders can produce a vacuously green invariant because almost every call reverts.

A deterministic regression test should accompany the invariant and use the minimal revealing history:

```text
1. Alice deposits.
2. Bob deposits (or Alice retains part of her position).
3. Alice performs a fee-bearing partial withdrawal.
4. Measure idle underlying plus redeemable protocol underlying.
5. Assert that measurement equals totalAssetsStored and totalAssets.
6. Optionally have Bob redeem all remaining shares and assert that no
   attributable underlying is stranded, subject only to specified rounding.
```

The equality at step 5 is the essential assertion. Immediately after the withdrawal, the retained fee is still in the protocol and must still be included in recorded assets. Under the shipped behavior, actual controlled assets exceed the recorded total by the omitted fee, so this test fails at the first drift instead of allowing it to accumulate quietly.
