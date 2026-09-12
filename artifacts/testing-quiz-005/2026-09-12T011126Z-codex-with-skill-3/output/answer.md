# What the green suite actually proved

The suite showed that the tested examples followed the implementation's expected local paths. It did not show that the vault's accounting remained consistent with its custody of assets over time.

## `test_DepositMintsShares`

```solidity
uint256 shares = _deposit(alice, DEPOSIT_AMOUNT);
assertEq(shares, 999e18);
assertEq(vault.shareBalance(alice), 999e18);
```

This establishes, for one particular deposit amount, one actor, and the vault's initial state, that `_deposit` returns `999e18` and records `999e18` in Alice's share balance.

It only appears to establish that share minting is economically correct. The expected value is a hand-picked example, and both assertions can agree with the same faulty calculation: the return value and stored balance are two outputs of the same operation. The test does not independently derive the number of shares from the pre-deposit exchange rate, check value conservation, check another depositor's position, or test a deposit after withdrawal fees have accumulated. In particular, it cannot detect that an understated asset total later causes shares to be minted or valued at the wrong exchange rate.

## `test_DepositUpdatesTotalAssets`

```solidity
_deposit(alice, DEPOSIT_AMOUNT);
assertEq(vault.totalAssets(), DEPOSIT_AMOUNT);
assertEq(vault.totalAssetsStored(), DEPOSIT_AMOUNT);
```

This establishes that one deposit into an empty vault makes both accounting getters report `DEPOSIT_AMOUNT`.

It only appears to establish that `totalAssets` is correct. `totalAssets()` and `totalAssetsStored()` may expose the same internal accounting value, so their agreement is not independent evidence. Even comparison with the deposit amount only checks the simplest transition, before any withdrawal fee exists. It never compares recorded assets with the token balance actually held by the vault and/or its yield-protocol position. Thus both getters can drift together while every assertion remains green.

## `test_WithdrawFeeBps`

```solidity
assertEq(vault.WITHDRAW_FEE_BPS(), 30);
```

This establishes only that the constant/getter returns 30.

It only appears to test withdrawal fees. It says nothing about whether a withdrawal charges 30 basis points, how rounding behaves, where the fee remains, whether the internal asset total includes it, or whether remaining shareholders receive it. No withdrawal occurs at all.

## `test_ConstructorSetsUsdt`

```solidity
assertEq(address(vault.usdt()), address(usdt));
```

This establishes that construction stores and exposes the supplied token address.

It only appears to add meaningful assurance about asset handling. It does not test transfers, balances, protocol custody, accounting, USDT-specific behavior, or withdrawal fees. Unless assigning the wrong address was a realistic concern, this is essentially an implementation-to-getter wiring check.

# Why 100% coverage was compatible with the bug

Line and function coverage answer whether code executed, not whether the assertions constrained its behavior. A test may run every line in `withdraw`, including the fee calculation and the accounting update, without ever comparing the resulting book value with independently observed custody. Getter tests and assertions that repeat values produced by the implementation can produce excellent coverage while allowing the implementation and the test expectation to share the same mistake.

Coverage also has no concept of history. Executing `deposit` and `withdraw` somewhere in the suite is not equivalent to exploring sequences such as:

```text
Alice deposits -> Bob deposits -> Alice withdraws with a fee
-> Carol deposits -> Bob partially withdraws -> ...
```

The defect is in the relationship between state variables and real balances across transitions. Coverage does not measure that relationship, the diversity of states at which a line ran, or whether fees remain claimable.

That is why "every operation is correct in isolation" is the tell. It identifies a stateful composition bug: each call can transfer the locally expected amount and update its fields according to its own formula, yet the post-state left for the next call violates the system-wide accounting identity. A vault is a state machine. Correctness must hold after every transition and after arbitrary compositions of transitions; it cannot be inferred by adding together isolated happy-path examples.

# The missing property

Let `recordedAssets` be the asset amount used by the vault to price shares (here, apparently `totalAssetsStored()`), and let `custodiedAssets` be all underlying tokens economically controlled by the vault, including both tokens held directly and its redeemable balance in the yield protocol. Ignoring only explicitly documented and consistently applied rounding dust, the invariant is:

```text
recordedAssets == custodiedAssets
```

For this design, a withdrawal fee remains in the yield protocol. Therefore a withdrawal of gross assets `G` with fee `F` must pay the user `G - F`, reduce custody by only `G - F`, and reduce recorded assets by only `G - F`. Equivalently, the retained `F` must remain in both sides of the equality and thereby increase the value attributable to the remaining shares. Decrementing recorded assets by `G` while only `G - F` leaves custody creates exactly the observed uncounted surplus.

The assertion must be equality, not merely:

```text
recordedAssets <= custodiedAssets
```

That one-sided solvency check detects liabilities exceeding holdings but deliberately permits the surplus/stranded-assets direction of this bug.

# Test shape

This belongs in a handler-driven Foundry invariant test:

1. Deploy the vault and its integration, then create several funded actors with approvals.
2. Target a handler whose actions perform valid deposits, partial and full withdrawals/redemptions, and any yield/accrual operation relevant to the protocol. Bound inputs to valid nonzero amounts and vary the caller. The handler should maintain ghost data if needed to compute aggregate user claims or protocol assets independently.
3. After every generated action sequence, independently read custody: the vault's direct underlying balance plus the underlying value of its yield-protocol position.
4. Assert `vault.totalAssetsStored() == custodiedAssets` (or assert a precisely specified rounding bound if exact equality is impossible). Also ensure the run executes successful state-changing calls; targeting the vault directly with unfunded random senders can yield an almost-all-revert, vacuously green invariant run.

A focused regression test should accompany the invariant: deposit for at least two users, withdraw one user's position so a nonzero fee remains, then assert immediately that the stored total equals actual custody and that the remaining user's redeemable claim includes the retained fee. Repeating deposit/withdraw cycles makes the historical failure obvious, but the accounting equality should already fail on the first transition that drops the fee from the books.

The regression test proves the known failure stays fixed. The stateful invariant searches for the same class of accounting drift across sequences the authors did not think to enumerate.
