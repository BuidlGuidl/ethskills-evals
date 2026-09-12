# What the suite proved—and what it did not

The tests prove facts about selected calls and configuration values. They do not prove that the vault's accounting remains a faithful representation of its assets across a history of calls.

## `test_DepositMintsShares`

This establishes that, from the particular fixture state used by the test, depositing `DEPOSIT_AMOUNT`:

- returns `999e18` shares; and
- credits those `999e18` shares to Alice.

It only appears to establish that share minting is economically correct. The expected value is hard-coded from the implementation's single-call behavior. The test does not derive the expected shares from an independently measured pre-deposit share price, nor does it check the assets backing the shares after the call. In particular, it says nothing about deposits made after withdrawal fees have accumulated but disappeared from `totalAssetsStored`. In that later state, the vault can consistently return and record the same number of shares while minting them at an understated share price, diluting existing holders.

## `test_DepositUpdatesTotalAssets`

This establishes that, from the initial fixture state, one deposit increments both exposed accounting values to `DEPOSIT_AMOUNT`.

It only appears to establish that `totalAssets()` and `totalAssetsStored()` equal the vault's real assets. Both values may be the same accounting variable, or one may merely wrap the other, so comparing them is not an independent reconciliation. The test compares two views of the vault's own books; it does not compare those books with the vault's idle token balance plus its position in the yield protocol. It also tests only the easy transition from an empty vault, before a retained withdrawal fee exists.

## `test_WithdrawFeeBps`

This establishes only that the constant is `30` basis points.

It only appears to test withdrawal fees. It does not show that a withdrawal calculates the fee, pays the correct net amount, leaves the fee in the protocol, or—most importantly—continues to include the retained fee in managed assets. A correct constant is not an accounting assertion.

## `test_ConstructorSetsUsdt`

This establishes that the constructor stores the supplied USDT address.

It only appears to contribute to assurance about asset handling. It does not establish that balances of that token are conserved, valued, or claimable. Correct wiring can coexist with incorrect accounting.

## Why 100% coverage did not help

Line and function coverage answer whether execution visited code, not whether the right semantic relationships held afterward. A test can execute every deposit and withdrawal line and assert only return values, local balance changes, or constants. It can even assert values calculated with the same mistaken accounting model as the implementation. Coverage supplies no independent oracle and does not require meaningful call sequences.

This defect is temporal: it is a bad state transition whose economic consequence becomes visible in later transitions. Tests that reset the fixture before each case exercise each operation only in a convenient state. They miss the reachable state in which retained fees exist physically but are absent from the recorded total. Thus every branch can be covered while the state space—and especially histories such as deposit, deposit, withdraw, deposit, withdraw—remains almost entirely uncovered.

"Every operation is correct in isolation" is therefore the tell. A vault is an accounting state machine. Its correctness is principally about conservation across compositions of operations, not about whether each operation's immediate outputs look plausible from a fresh fixture. If each call uses a slightly wrong transition—for example, reducing recorded assets by the gross redeemed amount although only the net amount left the vault—then no one call need revert, overpay, or visibly underpay. The error accumulates in the relationship between two state variables: real managed assets and recorded managed assets.

## The missing property

Let

- `R(s)` be the vault's recorded total assets in state `s`;
- `M(s)` be independently measured assets controlled for share holders: the vault's idle underlying-token balance plus the underlying value of its position in the yield protocol; and
- `P` be underlying tokens that actually leave the managed system for a withdrawal receiver.

Ignoring only explicitly modelled protocol gain/loss and bounded rounding dust, the accounting invariant is:

```text
R(s) == M(s)
```

It must hold after every externally callable state transition, not merely after deployment or the first deposit. Equivalently, for a withdrawal with no intervening yield or loss:

```text
R_after = R_before - P
M_after = M_before - P
```

If shares representing gross assets `G` are redeemed and the retained fee is `F`, then `P = G - F`. Consequently:

```text
R_after = R_before - (G - F)
```

not `R_before - G`. The fee `F` remains in `M_after` and must remain in `R_after`; it increases the assets per share of the holders who remain. More generally, over a trace with no yield or loss:

```text
R_final = R_initial + sum(deposits received) - sum(withdrawal payouts sent)
R_final = M_final
```

The first equality is the conservation law, and the second is the reconciliation to reality. The second must use balances obtained from the token and protocol, not another vault getter backed by the same bookkeeping.

## Test shape that catches the drift

The suite should contain a stateful invariant test or handler-driven fuzz test with at least two actors. The handler randomly interleaves deposits, withdrawals/redeems, and—if applicable—yield realization. After every action it computes `M` directly from the underlying token and protocol position and asserts `R == M` within an explicitly justified rounding bound. It should also maintain a ghost-accounting value updated by actual token flows and assert that the recorded total equals that value.

A minimal deterministic regression test is:

1. Alice and Bob deposit, so shares remain after either one exits.
2. Record `R_before`, the independently measured `M_before`, and Bob's assets-per-share or previewed full redemption value.
3. Alice withdraws/redeems. Measure Alice's actual token-balance increase `P`; do not use the vault's reported gross amount as the oracle.
4. Assert that the protocol plus idle balance fell by exactly `P`.
5. Assert `totalAssetsStored() == R_before - P` and independently assert `totalAssetsStored() == M_after` (within any specified dust bound).
6. Assert that Bob's claim per share increased by Alice's retained fee, subject only to rounding. If Bob is the sole remaining holder, a final full redemption should be able to extract all `M_after` rather than leave the fee stranded.

The decisive assertion is the reconciliation after a fee-bearing withdrawal. Repeating randomized deposits and withdrawals makes accumulated drift obvious, but a single two-user, fee-bearing withdrawal followed by `recorded == independently measured managed assets` should catch the underlying bug immediately.
