# The 39 green tests and the fee that went missing

## First, the shape of the bug

The symptom you describe pins the defect exactly: on withdrawal, the vault burns shares
worth `gross`, sends the user `gross - fee`, and decrements `totalAssetsStored` by
`gross`. The protocol balance drops by `gross - fee`; the books drop by `gross`. Every
withdrawal opens a gap of exactly `fee`, and the gaps add up.

The intended behaviour was the opposite: the books should drop by the *net* amount, so
the retained `fee` stays inside `totalAssetsStored`, spread over a now-smaller share
supply, and the share price ticks up for everyone still in. Instead the price is
unchanged, and the retained fee becomes an unaddressed pile of real USDT that no share
has a claim on.

So: `totalAssetsStored < actual protocol balance`, drift equal to the sum of all fees
ever charged. Not insolvency — the reverse. Which is precisely why nothing ever
reverted and nothing ever failed.

## Test-by-test: established vs. appears to establish

### `test_DepositMintsShares`

**Establishes:** that one deposit of `DEPOSIT_AMOUNT`, made from the clean fixture
state, returns `999e18` and credits `999e18` to the depositor. That the return value and
the stored balance agree with each other. That there is a ~0.1% haircut somewhere on the
way in (1000e18 → 999e18), whatever its cause.

**Only appears to establish:** that the share-pricing math is correct. It is a golden
number captured at exactly one point in the state space — the point where the conversion
is trivial because the vault is empty or freshly seeded. The share price is a *ratio*,
`totalAssets / totalSupply`, and this test never observes that ratio anywhere the
numerator and denominator are both non-trivial. Every interesting pricing bug — including
this one, which is a bug in how the numerator evolves — lives in states this assertion
never visits. A hardcoded `999e18` also silently bakes in whatever the haircut is; if the
fee logic were wrong on the way in too, this test would have been updated to match rather
than failing.

### `test_DepositUpdatesTotalAssets`

This is the load-bearing one, and it is the one that most looks like it covers the bug.

**Establishes:** that after a deposit, `totalAssets()` and `totalAssetsStored()` both
report `DEPOSIT_AMOUNT`, and that the two agree with each other.

**Only appears to establish:** that the vault's accounting matches reality. It does not
compare the vault's books to anything outside the vault. `totalAssets()` almost certainly
*reads* `totalAssetsStored()` (or is that value plus a cheap adjustment), so asserting
their equality is close to tautological — two views of the same storage slot agreeing
that they are the same storage slot. The third quantity, the only one that is ground
truth, never appears: the actual redeemable balance the vault holds in the yield
protocol.

The drift is *by definition* a divergence between the books and that external balance.
This test is structurally incapable of seeing it, not because it was written carelessly
but because it never names the quantity that drifts. It also runs only the deposit path,
where books and reality genuinely do move in lockstep; the divergence is introduced
exclusively on withdrawal.

### `test_WithdrawFeeBps`

**Establishes:** that the public constant `WITHDRAW_FEE_BPS` has the value 30.

**Only appears to establish:** anything at all about the fee. This is a restatement of a
source line in assertion form — if someone edits the constant, this test fails and gets
edited to match. It asserts that a number is itself. It does not establish that 30 bps is
charged, that it is charged on the right base, that it is retained rather than
transferred, or — the actual defect — that it is *accounted for* after being retained.

Its real function in the suite is coverage: it ticks the getter green and it makes the
report show a fee-related test passing.

### `test_ConstructorSetsUsdt`

**Establishes:** constructor wiring — the token address argument reaches the `usdt`
storage variable.

**Only appears to establish:** nothing much, and to its credit it does not pretend to.
This is a legitimate smoke test. It is worth naming only because in a 39-test suite, a
meaningful fraction of the green ticks are of this kind, and they inflate the count that
your lead is citing as evidence of thoroughness. Four tests, and two of them (`FeeBps`,
`SetsUsdt`) assert configuration rather than behaviour.

## How 100% coverage was compatible with this

Coverage answers "was this line executed?" The bug is not in a line. Every line involved
is individually correct:

- burning `shares` for a user redeeming `shares` — correct
- computing `fee = gross * 30 / 10_000` — correct
- transferring `gross - fee` to the user — correct
- leaving `fee` in the protocol — correct, and intended
- `totalAssetsStored -= gross` — **correct-looking**, and the entire bug

That last line is not wrong in any way a reader or a coverage tool can localise. It is
wrong only in relation to the transfer three lines above it. The defect is a *relation
between two statements*, and coverage instruments statements, not relations.

Three compounding reasons the metric was satisfied anyway:

1. **Executed ≠ asserted.** The withdraw path ran — that's how it got covered — and the
   fee line ran with it. Coverage marked it green the instant control flow touched it.
   Whether any assertion then examined the consequence is not something line coverage
   measures. The fee was executed 39 ways and checked zero.

2. **Covered ≠ reached in the state that matters.** Every test starts from a clean
   fixture. Line coverage treats "this line ran once from an empty vault" as identical to
   "this line ran from a vault with three depositors and 200 prior withdrawals." The drift
   is only *observable* in the second kind of state, and the suite never constructs one.
   Coverage of code says nothing about coverage of state.

3. **The oracle was the implementation.** `test_WithdrawFeeBps` asserts a constant against
   itself; `test_DepositUpdatesTotalAssets` asserts a storage slot against a view of the
   same storage slot; `test_DepositMintsShares` asserts a number recorded from a previous
   run. None of these consult an independent notion of what should be true. A suite whose
   expected values are all derived from the contract can reach 100% coverage while being
   unable, in principle, to disagree with the contract.

100% line and function coverage is a statement about the *test suite's reach*, not about
the *specification's completeness*. It is a lower bound on effort, never an upper bound on
correctness — and here it was fully satisfied by a suite that had never written down what
the vault is supposed to preserve.

## Why "every operation is correct in isolation" is the tell

Your lead is offering it as the alibi: no single call misbehaves, therefore the code is
fine and the loss must be something else. Invert it.

The vault is wrong. Every operation is individually right. Those two facts together
*locate* the defect — they do not excuse it. If the wrongness is not inside any
operation, it must be in what is supposed to hold *between* operations. That is the
definition of a broken invariant. "Correct in isolation" narrows the search to exactly one
class of bug; it is a diagnosis, not a clearance.

More sharply, the structure of this bug is a per-operation error term that is too small to
notice and never gets reset:

- Each withdrawal introduces an error of `fee`, ~0.3% of one withdrawal. Against a single
  test's numbers that is noise — plausibly rounding, plausibly the fee "working."
- The error is never corrected, because nothing ever recomputes `totalAssetsStored` from
  the protocol balance. Errors like this integrate.
- Unit tests are existentially quantified: "there exists a starting state (the fixture)
  and one operation such that the result is X." The property that's broken is universally
  quantified: "for all sequences of operations, this relation holds." No number of the
  former implies the latter, because a single-step test cannot observe an accumulated sum.

The suite is 39 first derivatives. The bug is in the integral.

There is also a design smell the tests could have surfaced and didn't. The fee is meant to
accrue to remaining holders. That is a claim about a *third party* — a user who is not the
one calling `withdraw`. Not one of these tests has a second actor observing the effect of
the first actor's operation. A test suite where every test has exactly one participant
structurally cannot check a property whose whole point is the effect on somebody else.

## The property the suite should have asserted

Let, at any instant:

- `B` = assets the vault actually controls in the yield protocol, measured from the
  protocol, not from the vault (the vault's redeemable position)
- `A` = `vault.totalAssetsStored()`
- `S` = total share supply

### P1 — Conservation (the one that catches this bug)

> After **any** sequence of deposits and withdrawals, with no external yield accrued:
> **`A == B`** exactly. Every asset the vault holds is represented in its books, and
> nothing is represented that it does not hold.

If your protocol accrues yield between syncs, the property splits and stays just as sharp:
`A <= B` always, and the deficit `B - A` must be **fully attributable to unharvested
yield** — so after a `sync()`/`harvest()`, `A == B` exactly. That second half is what
fails today: syncing would not close the gap, because the gap is retained fees, not yield.
A one-sided `A <= B` on its own would pass while the vault bleeds, which is why the
post-sync equality is the assertion that matters.

### P2 — Fee accrual (the property the fee exists to provide)

> Define `pps = A * 1e18 / S` for `S > 0`. Across any operation, `pps` is
> **non-decreasing**. Across a withdrawal with `fee > 0` that leaves `S_after > 0`,
> `pps` **strictly increases**.

P1 alone catches the drift. P2 catches the *intent*: it is the assertion that the fee
actually reaches the remaining holders. Today `pps` is flat across withdrawals — the fee
neither reaches anyone nor is recorded. Both properties fail on the current code, from
opposite directions, which is the right kind of redundancy.

### P3 — No round-trip profit

> `deposit(x)` followed immediately by a full `withdraw` returns `<= x`, and for
> `fee > 0`, strictly `< x`.

Cheap, and it fences off the class of "fix" that overcorrects P2 into a mint.

### Test shape

**Primary: a stateful invariant test** (Foundry `invariant_`), which is the only shape
that quantifies over sequences.

```solidity
contract VaultHandler is Test {
    Vault public vault; MockUSDT public usdt;
    address[] internal actors;
    uint256 public ghost_lastPps;

    function deposit(uint256 actorSeed, uint256 amount) public {
        address a = actors[bound(actorSeed, 0, actors.length - 1)];
        amount = bound(amount, 1e6, 1_000_000e18);
        deal(address(usdt), a, amount);
        vm.startPrank(a); usdt.approve(address(vault), amount); vault.deposit(amount); vm.stopPrank();
    }

    function withdraw(uint256 actorSeed, uint256 sharesPct) public {
        address a = actors[bound(actorSeed, 0, actors.length - 1)];
        uint256 bal = vault.shareBalance(a);
        if (bal == 0) return;                       // skip, do not revert
        uint256 shares = bound(sharesPct, 1, bal);
        vm.prank(a); vault.withdraw(shares);
    }
}
```

Target the handler (`targetContract(address(handler))`) so the fuzzer composes long
randomised sequences across multiple actors, then:

```solidity
// P1 — the assertion that fails today
function invariant_BooksMatchProtocolBalance() public {
    vault.sync();                                   // or harvest(); no-op if none
    assertEq(vault.totalAssetsStored(), yieldProtocol.balanceOf(address(vault)),
        "unaccounted assets: books below actual holdings");
}

// P2 — share price never falls, fees actually accrue
function invariant_PricePerShareNeverDecreases() public {
    uint256 s = vault.totalSupply();
    if (s == 0) return;
    uint256 pps = vault.totalAssetsStored() * 1e18 / s;
    assertGe(pps, handler.ghost_lastPps());
    handler.setLastPps(pps);
}
```

Configure it to actually explore: `runs = 256`, `depth = 100+`, `fail_on_revert = false`
with the handler guarding its own preconditions (a handler that reverts constantly
produces long green runs that tested nothing). This bug appears on the *second* withdrawal
in the sequence and grows from there, so depth is what finds it — a depth-1 invariant run
is just a slower unit test.

**Secondary: one deterministic multi-actor regression test**, so the failure is legible
in CI rather than arriving as a fuzz counterexample:

```solidity
function test_WithdrawFeeAccruesToRemainingHolders() public {
    _deposit(alice, 1000e18);
    _deposit(bob,   1000e18);

    uint256 bobValueBefore = vault.previewRedeem(vault.shareBalance(bob));

    vm.prank(alice); vault.withdraw(vault.shareBalance(alice));

    // the fee is retained, and it belongs to bob
    uint256 bobValueAfter = vault.previewRedeem(vault.shareBalance(bob));
    assertGt(bobValueAfter, bobValueBefore, "fee did not accrue to remaining holder");

    // and it is on the books, not sitting unowned in the protocol
    assertEq(vault.totalAssetsStored(), yieldProtocol.balanceOf(address(vault)));
}
```

Two actors, two operations, one assertion about the party who did not act. That test would
have failed on day one.

## The summary line for your lead

The suite was thorough about *coverage* and silent about *conservation*. It executed every
line and asserted no invariant. The fee line was green because control flow touched it,
not because anything checked what it did. And "every operation is correct in isolation" is
not evidence that the vault is correct — given that the vault is demonstrably losing
users' money, it is the proof that the defect lives in an invariant nobody wrote down.

The drift equals the sum of all fees ever charged. That number is recoverable: the fix is
to decrement `totalAssetsStored` by the *net* amount on withdrawal, plus a one-time
`sync()` that rebases the books up to the actual protocol balance, handing the stranded
fees to current holders as the design always intended. Land P1 as a failing invariant
first, then fix — so the regression is proven caught rather than assumed.
