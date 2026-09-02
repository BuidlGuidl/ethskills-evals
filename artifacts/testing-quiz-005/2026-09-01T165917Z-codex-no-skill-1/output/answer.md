# What the tests establish—and what they do not

`test_DepositMintsShares` establishes that, for one deposit into the particular state created by the test fixture, `_deposit` returns `999e18` and credits Alice with `999e18` shares. It also establishes that the return value and Alice's recorded balance agree in that case. It only appears to establish that share issuance is correct. It does not compare the minted shares with the vault's assets and total share supply before and after the deposit, test a deposit after fees have accumulated, or show that the resulting share price preserves each holder's claim on all assets. The asserted number can remain correct even while the asset denominator used for later deposits is understated.

`test_DepositUpdatesTotalAssets` establishes that immediately after one deposit, from the fixture's initial state, both `totalAssets()` and `totalAssetsStored()` equal the deposit amount. It only appears to establish sound asset accounting. At that moment there is no retained withdrawal fee, so the two accounting notions have not yet had an opportunity to diverge. The test never performs the transition that creates the bug and never compares the stored amount with the vault's actual position after such a transition.

`test_WithdrawFeeBps` establishes only that the public constant/configuration value is `30` basis points. It does not establish that the fee is calculated with the intended rounding, retained in the yield protocol, included in total assets afterward, or allocated through the share price to remaining shareholders. A correct constant says nothing about the accounting treatment of the resulting fee.

`test_ConstructorSetsUsdt` establishes only that the constructor stores the supplied USDT address. It does not establish that balances held directly or through the yield protocol are measured correctly, nor that withdrawal fees remain part of shareholder-owned assets.

# Why 100% coverage did not help

Line and function coverage answer whether code was executed, not whether its effects were checked against the right specification. A test can execute every line in `withdraw` and assert the recipient's net payment while never asserting the relationship between the remaining protocol balance, `totalAssetsStored`, and the remaining share supply. Function coverage is even weaker: it merely shows that every function was called.

Coverage also does not imply meaningful state-transition or sequence coverage. The defect requires at least a deposit, a fee-bearing withdrawal, and observation of the remaining state (and is made economically visible by later deposits or withdrawals). A suite of isolated, freshly initialized calls can cover all the same lines without testing that history. Even branch coverage would not by itself supply the missing accounting oracle.

"Every operation is correct in isolation" is therefore the tell. This is a state-machine/accounting-invariant failure, not necessarily a bad transfer or a bad fee calculation. The withdrawal can burn the right shares, pay the user the right net amount, and leave the fee in the protocol, yet subtract the gross withdrawal amount from `totalAssetsStored`. Each local result looks plausible; the post-state is internally inconsistent. Repeating an individually plausible transition accumulates the omitted fees into drift and eventually strands them outside the recorded claims of shareholders.

# The property that should have been asserted

Let `A` be the assets actually controlled for this vault in the yield protocol plus any relevant idle USDT held by the vault, using the same units and valuation rules as `totalAssetsStored`. In every reachable post-state:

```text
totalAssetsStored == A
```

Equivalently, for a withdrawal whose gross asset value is `G` and whose retained fee is `F`, the user receives `G - F`, and because `F` remains vault property:

```text
A_after                 == A_before - (G - F)
totalAssetsStored_after == totalAssetsStored_before - (G - F)
```

It is wrong to reduce the recorded total by `G`; doing so creates exactly `F` of drift per withdrawal. Subject to explicitly documented rounding dust, the equality should be exact or have only that tightly bounded tolerance. The actual-balance side must be obtained independently from token/protocol balances, not by calling another view that merely returns the same stored variable.

The focused regression test should use at least two users so that retained-fee ownership is observable:

1. Alice and Bob deposit.
2. Snapshot the independently measured protocol/idle assets and `totalAssetsStored`.
3. Alice makes a partial, fee-bearing withdrawal.
4. Assert Alice received the net amount, assert the fee remains in the vault's protocol position, and assert both equations above.
5. Assert Bob's remaining shares are valued using the post-withdrawal actual assets, including the retained fee; redeeming all remaining shares (with any final withdrawal fee treated according to the specification) must not leave historical fees stranded.

In Foundry, this should additionally be a stateful invariant/fuzz test whose handler generates arbitrary bounded sequences of deposits and withdrawals across multiple actors. After every action it independently reads the vault's idle balance and yield-protocol position and asserts `totalAssetsStored == actual controlled assets` (within only a specified rounding bound). A conservation assertion can accompany it: initial controlled assets plus deposits and yield, minus net amounts transferred out, equals current controlled assets. That sequence-level invariant would fail on the first fee-bearing withdrawal and would also prevent the cumulative drift that the example-based, operation-local assertions missed.
