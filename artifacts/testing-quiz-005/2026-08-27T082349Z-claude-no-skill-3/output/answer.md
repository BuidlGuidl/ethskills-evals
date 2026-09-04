# Why 39 green tests at 100% coverage shipped a drifting ledger

## 0. The shape of the bug (needed to read the tests)

Two ledgers exist: what the vault **holds** (its position in the yield protocol, plus
any idle balance) and what the vault **thinks it holds** (`totalAssetsStored`). On
withdrawal the vault computes a gross claim `g`, keeps a fee `f = g * 30 / 10_000` in
the protocol, and sends `g - f` to the user. Real holdings fall by `g - f`. The
recorded total falls by `g`. The residual `real - stored` grows by `f` on every
withdrawal and never shrinks.

That is the whole defect, and it matches every symptom in the report: not insolvent
(the vault holds *more* than it records), share price understated (the price is
computed off `stored`, so the retained fee accrues to nobody), and the surplus
unclaimable (redemptions are also priced off `stored`, so no share can ever reach
those tokens).

Note the scale: the drift is **detectable on the very first withdrawal**. The "long
run of deposits and withdrawals" is what made it big enough to notice in production,
not what was needed to find it. Nobody was looking at the right quantity.

---

## 1. The four tests, one at a time

### `test_DepositMintsShares`

**Actually establishes:** on an *empty* vault, one deposit of `DEPOSIT_AMOUNT` mints
exactly `999e18` shares and credits them to the depositor. That is: the first-deposit
path executes, whatever entry haircut or dead-share offset produces the `999` is
applied once, and the balance mapping is written.

**Only appears to establish:** that share minting is correct. It cannot be. On an
empty vault `totalSupply == 0`, so the price-per-share branch is not consulted at all —
the mint is 1:1-by-definition (modulo the offset). Share price is a *ratio* between two
running totals, and this test runs in the one state where that ratio does not exist.
The depositor who can be harmed by a wrong price is the **second** one, and there
isn't a second one here.

**Second failure mode:** `999e18` is a golden number. It encodes the answer for one
input instead of the relationship that produced it (`shares ≈ assets / pricePerShare`).
A literal like that is almost always transcribed from what the implementation printed,
which makes the test a snapshot of the code rather than a statement of the spec — it
locks in behaviour without ever claiming behaviour is right. Change the fee constant
and this test fails for a reason that has nothing to do with whether the vault is
correct.

### `test_DepositUpdatesTotalAssets`

This is the near-miss. It is the only test in the slice that mentions both ledgers.

**Actually establishes:** after one deposit into a fresh vault, `totalAssets()` and
`totalAssetsStored()` both read `DEPOSIT_AMOUNT`.

**Only appears to establish:** that the two accounting views agree — i.e. that
recorded state tracks reality. It checks that equality at the single point in the
vault's life where it holds **by construction**: both started at zero and the same code
path just added the same delta to both. It is a fixed-point check. The equality is
asserted where it cannot fail and never asserted after the one operation that can
break it.

Worse, both sides are compared against the same literal rather than against *each
other*. Even the form of the assertion has thrown away the relation. If this test's
last line had been `assertEq(vault.totalAssets(), vault.totalAssetsStored())` and that
line had been pasted at the end of every other test in the suite, the bug would have
been caught in whichever test first called `withdraw`.

Also note the unexamined seam between this test and the previous one: `1000` in,
`999e18` shares out, `1000e18` recorded. There is a haircut somewhere and no assertion
anywhere ties the three numbers together.

### `test_WithdrawFeeBps`

**Actually establishes:** the constant literal in the source is `30`. Nothing else.

**Only appears to establish:** that the withdrawal fee is 30 bps — a claim about
*behaviour*. This test asserts a declaration, not a use. It passes identically if
`withdraw()` ignores the fee, charges it twice, sends it to the owner, or — as
happened — charges it correctly and books it wrong. It is also self-ratifying: change
the constant to `50` and the natural repair is to change the test to `50`, green
again, spec unconsulted.

This is the archetypal coverage-without-confidence test, and it is pointed directly at
the mechanism that broke. It names the fee and says nothing about where the fee goes.

### `test_ConstructorSetsUsdt`

**Actually establishes:** the constructor stores its argument in the field the getter
reads. Real value: catches transposed constructor arguments, which is a genuine class
of deployment bug.

**Only appears to establish:** that the vault is "correctly configured." It is a state
mirror — assert that the setter set. No behaviour, no interaction, no invariant.

### The tally

Four tests: two assert stored constants, two assert one operation on a virgin vault.
Zero sequences. Zero second actors. Zero withdrawals. Zero assertions relating two
quantities that could independently drift. Whatever the other 35 tests do, `withdraw`
must be among them (coverage says so) — and it is evidently asserted at the
*call* level (did Alice receive the right amount?) rather than the *ledger* level.

---

## 2. How 100% coverage was compatible with this

Coverage answers "was this line executed by some test?" The question you needed
answered was "is this claim true in every reachable state?" These are different
quantifiers, and coverage is the weaker one in both directions:

**Coverage is existential over code; the bug is universal over traces.** Line coverage
is satisfied by *at least one* execution of each line. The invariant is a statement
about *all* sequences of operations. The offending line — the one that decrements the
recorded total by the gross amount — was executed, was marked covered, and is the bug.
Coverage told you it ran. It has no vocabulary for whether anything downstream
constrained what it produced.

**Coverage does not look at assertions.** A suite with zero `assertEq` calls can reach
100% line and function coverage. Coverage measures the code under test; it does not
measure the test. Two of your four sample tests are getters — they raise the
denominator's satisfaction without raising confidence at all, and they are indexed by
the metric exactly as heavily as a real behavioural test.

**The defect is not located in any line.** It lives in the *relation between two
ledgers across two code paths*: deposit's write and withdraw's write are individually
sensible and mutually inconsistent. There is no line you can point at and call wrong
without reference to the other one. A per-line metric structurally cannot represent a
per-relation defect. Same for function coverage: every function ran; the bug is in
what a function's effects imply about another function's assumptions.

**The state space, not the code, was uncovered.** 100% of lines, and roughly one point
of the reachable state space: `{empty vault}` and `{one deposit}`. The vault's actual
state space is (number of holders × deposit history × withdrawal history), and the
residual `real - stored` is a coordinate in it that no test ever read.

The metric that would have flagged this is **mutation score**, not coverage. Mutate
the withdrawal bookkeeping from net to gross — that is literally the shipped bug — and
run the suite. It stays green. A surviving mutant on the fee line, in a suite claiming
100% coverage of that line, is the precise machine-checkable statement of "your
coverage is fake here." Coverage is a lower bound on what you failed to test; it is
never an upper bound on risk.

---

## 3. Why "every operation is correct in isolation" is the tell

Because it is not an alibi for the suite — it is the differential diagnosis, and it
rules out the only hypothesis the suite was built to test.

Unit tests check **local postconditions**: given this state and these arguments, this
call returns/writes the right thing. If the bug were in a call, a per-call test would
find it — that is what per-call tests are for, and you have 39 of them. So the fact
that you *cannot* point at a misbehaving call is positive evidence that the defect is
not at call granularity. It is at **trace granularity**: a predicate over states that
every operation, individually correct, fails to preserve.

Local correctness does not compose into global correctness. Each withdrawal is
faithful in its own frame — the user gets gross-minus-fee, the fee genuinely remains in
the protocol, the right shares burn. The error is that two operations disagree about
what a unit of "asset" means at the boundary between them, and each one's postcondition
is stated only in its own terms, so neither notices. Nothing is wrong *inside* any
operation; something is unpreserved *across* them.

And the residual is monotone. It only grows. That is the signature that turns a bug
from "rare edge case" into "certainty over time," and it is also what makes the bug
trivially findable by the right test: a quantity that should stay pinned and instead
drifts in one direction is detected by a single assertion after a single withdrawal,
and by any randomized sequence with essentially probability 1. It hid for months not
because it was subtle but because it was never named.

So read the sentence as it should be read: **"every operation is correct in isolation"
is a complete description of what you tested and a complete description of what is
not sufficient.** It tells you the missing test is not a better unit test. It is an
invariant.

---

## 4. The property the suite should have asserted

Define, for the vault at any point in time:

- `real()` — assets actually attributable to the vault = its balance in the yield
  protocol plus any idle token balance it holds. Measured **externally**, from the
  protocol and the token, never from the vault's own storage. This is non-negotiable:
  if you measure reality using the vault's accounting you are asserting a tautology,
  which is precisely the mistake `test_DepositUpdatesTotalAssets` made.
- `stored()` — `vault.totalAssetsStored()`.
- `n` — number of user operations executed so far.

### P1 — Accounting completeness (the one that fails)

> For every reachable state, after any sequence of deposits and withdrawals by any
> set of actors:
>
>     0  ≤  real() - stored()  ≤  n
>
> (units: wei). Equivalently: the vault never records more than it holds
> (**solvency**), and never holds more than it records beyond integer-division dust
> of at most 1 wei per operation (**completeness**).

Both halves matter, and completeness is the half that was missing. The tolerance must
be expressed in **wei per operation**, tied to rounding, and never as a percentage. A
30 bps gap is ~14 orders of magnitude above 1 wei/op on 1e18-scale flows, so this trips
on the first withdrawal and cannot be silenced by loosening the bound to something
"reasonable."

The corresponding per-operation form, which is what the implementation should satisfy:

> For a withdrawal of gross `g` with fee `f`:
> `Δstored == Δreal == -(g - f)`.
> The shipped code has `Δstored == -g`, `Δreal == -(g - f)`, residual `+f`.

### P2 — Fee accrual (the property that expresses the intent)

The stated intent is that the fee accrues to remaining holders. That is a claim about
share price, and it deserves its own assertion:

> For any withdrawal that charges a nonzero fee while `totalSupply > 0` afterward:
> `pricePerShare` strictly increases, by exactly `f / remainingShares`.
> Across any sequence, `pricePerShare` is **non-decreasing** — a passive holder is
> never diluted by someone else's exit.

The shipped vault leaves `pricePerShare` flat across withdrawals: the fee is credited
to nobody. P2 catches the bug and, unlike P1, names the *harm* rather than the
symptom.

### P3 — Full distributability (catches "unclaimable")

> If every holder redeems all of their shares, in any order, then `totalSupply == 0`
> and `real() ≤ n` wei.

Nothing may be stranded. This is the property whose violation is the user-visible
complaint, and it is the cheapest one to explain to a non-engineer.

### Test shape

**Primary: a stateful Foundry invariant suite.** A handler with several actors and
bounded random amounts, and the invariants asserted after every call sequence:

```solidity
contract VaultHandler is Test {
    Vault vault; IERC20 usdt; address[] actors;
    uint256 public opCount;
    uint256 public minPps = type(uint256).max;  // ghost: lowest pps ever observed
    uint256 public lastPps;

    function deposit(uint256 actorSeed, uint256 amount) external {
        address a = _actor(actorSeed);
        amount = bound(amount, 1e6, 1_000_000e18);
        deal(address(usdt), a, amount);
        vm.startPrank(a);
        usdt.approve(address(vault), amount);
        vault.deposit(amount);
        vm.stopPrank();
        opCount++;
        _snapPps();
    }

    function withdraw(uint256 actorSeed, uint256 shareSeed) external {
        address a = _actor(actorSeed);
        uint256 bal = vault.shareBalance(a);
        if (bal == 0) return;
        vm.prank(a);
        vault.withdraw(bound(shareSeed, 1, bal));
        opCount++;
        _snapPps();
    }

    function _snapPps() internal {
        if (vault.totalSupply() == 0) return;
        uint256 pps = vault.totalAssets() * 1e18 / vault.totalSupply();
        if (lastPps != 0) assertGe(pps, lastPps, "pps decreased");  // P2
        lastPps = pps;
    }
}

// P1 — the one that catches this bug
function invariant_StoredMatchesReal() public view {
    uint256 real = usdt.balanceOf(address(vault)) + yield.balanceOf(address(vault));
    uint256 stored = vault.totalAssetsStored();
    assertGe(real, stored, "insolvent");                       // never records more than it holds
    assertLe(real - stored, handler.opCount(), "unaccounted"); // never holds more than it records
}
```

The second `assertLe` is the entire fix to the suite. Note that it fails on the first
withdrawal the fuzzer emits — no long run required.

**Secondary: one deterministic regression test**, ten lines, that the suite is missing
outright — two actors and one withdrawal:

```solidity
function test_WithdrawFeeAccruesToRemainingHolders() public {
    _deposit(alice, 1_000e18);
    _deposit(bob,   1_000e18);

    uint256 ppsBefore  = _pricePerShare();
    uint256 realBefore = _realAssets();

    vm.prank(alice);
    uint256 out = vault.withdraw(vault.shareBalance(alice));

    assertEq(_realAssets(), realBefore - out, "fee left the protocol");     // fee retained
    assertEq(vault.totalAssetsStored(), _realAssets(), "ledgers diverged"); // P1 — FAILS today
    assertGt(_pricePerShare(), ppsBefore, "fee accrued to nobody");         // P2 — FAILS today

    vm.prank(bob);
    uint256 bobOut = vault.withdraw(vault.shareBalance(bob));
    assertGt(bobOut, 1_000e18 * (10_000 - 30) / 10_000, "bob got no fee share");
    assertLe(_realAssets(), 2, "assets stranded");                          // P3
}
```

**Cheapest structural change, worth doing regardless:** put P1 in a
`_assertAccounting()` helper and call it at the end of every existing test, or in
`tearDown`. The 39 tests you already have then become 39 invariant checkpoints for
free, and `test_DepositUpdatesTotalAssets` becomes what it was always pretending to be.

**Third: mutation testing as the gate.** Adopt "a surviving mutant on a covered line
is a test-suite defect." That single rule would have rejected this suite at the
`WITHDRAW_FEE_BPS` line before anything shipped, and it is the only cheap way to keep
tests like `test_WithdrawFeeBps` from being counted as evidence.

---

## 5. What to tell the lead

The suite was thorough about **code** and blind to **state**. 100% coverage is
compatible with zero assertions; it certifies that lines ran, not that claims hold, and
it structurally cannot see a defect that lives in the relation between two operations
rather than inside either one. The green suite was accurate — every operation *is*
correct in isolation. That was never the property that mattered.

Concretely, keep tests 3 and 4 as cheap wiring checks but stop counting them as
coverage of fee behaviour; rewrite test 1's `999e18` as a relation and add a
second-depositor case; promote test 2's equality into an invariant asserted after every
operation everywhere. Then add the handler above. Total cost is well under a day, and
the first fuzz run tells you the exact residual you are currently sitting on — which
is also the number you need in order to decide how to return those tokens to the
holders they were meant for.
