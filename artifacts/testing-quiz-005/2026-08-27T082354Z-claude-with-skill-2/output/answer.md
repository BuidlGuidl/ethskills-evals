# Why 39 green tests and 100% coverage missed a growing accounting drift

## 0. The bug, stated in the shape the symptom implies

We don't have the source here, so this is inferred from the symptom — but the symptom
only has one shape. `totalAssetsStored` is a cached total. On withdrawal:

```
gross = shares * totalAssetsStored / totalShares
fee   = gross * WITHDRAW_FEE_BPS / 10_000      // 0.3%
net   = gross - fee
transfer net to user; fee stays in the yield protocol
totalAssetsStored -= gross                      // <-- should be net
```

Real tokens leave by `net`. Accounting leaves by `gross`. Each withdrawal loses `fee`
from the books while keeping it in the protocol. `drift += fee`, monotonically, forever.

That reproduces every reported detail: recorded total below real holdings; never
insolvent (the vault holds *more* than it thinks); share price understated for
everyone still in; the surplus unclaimable because every exit path prices off
`totalAssetsStored`, so no share is ever worth any of it.

The feature's stated intent — "the fee accrues to whoever is still in the vault" —
is exactly the line that is broken. And no test in the suite asserts that intent.

---

## 1. The four tests, one at a time

### `test_DepositMintsShares`

**Actually establishes:** `deposit` doesn't revert on the happy path; it returns a
nonzero share count; shares are credited to the depositor and not to some other
address. Real, if thin — the misattribution check has some value.

**Only appears to establish:** that the share math is correct. `999e18` is a golden
value — a number copied out of one run of the implementation and frozen into the test.
It pins one point on the curve, not the curve. Any conversion formula that happens to
yield `999e18` for `DEPOSIT_AMOUNT` on an empty vault passes. And the empty vault is
the single state where share price is fixed by construction, so the test exercises the
one input for which the pricing logic is trivially right.

Note also what the constant hides: `999e18` for a round deposit means *something* is
being skimmed or seeded (dead shares, virtual offset, a rounding convention). The test
records the number without asserting the rule that produces it. When the rule changes,
the test tells you a number changed, not which invariant broke.

### `test_DepositUpdatesTotalAssets`

This is the most dangerous test in the suite, because it occupies the name the real
check would have had.

**Actually establishes:** `totalAssets()` and `totalAssetsStored()` agree with each
other, and both equal the amount just deposited, starting from empty.

**Only appears to establish:** that asset accounting is correct. The two assertions are
near-duplicates — if `totalAssets()` is `return totalAssetsStored`, the second is a
restatement of the first with extra steps. Neither compares the vault's books to
anything outside the vault: not `usdt.balanceOf(address(vault))`, not the vault's
position in the yield protocol. It asserts the cache is *self-consistent*.

A drifting cache is always self-consistent. That is what drifting means. This test
would pass identically at drift = 0 and at drift = 40,000 USDT, because it never asks
reality what it thinks.

### `test_WithdrawFeeBps`

**Actually establishes:** a constant equals 30. Value only as a change-detector — if
someone edits the literal, this fires. Even that duplicates the source line.

**Only appears to establish:** that the fee "works." It passes if `withdraw` ignores
the fee entirely, charges it twice, sends it to the owner, or — as here — debits it
from the books while leaving the tokens behind.

The tell is in the pairing: the suite has a test for the fee's **value** and zero tests
for the fee's **destination**. The destination is the whole feature, and it is the bug.

### `test_ConstructorSetsUsdt`

**Actually establishes:** the constructor assigns its argument to the right storage
slot — a deployment-wiring smoke check.

**Only appears to establish:** anything about behavior. It's a test that Solidity
assignment works. In coverage terms it's pure padding: it turns the constructor green
while asserting nothing that can fail for an interesting reason.

### The slice as a whole

Two tautologies, two golden-value checks of a single transition from a fresh vault.
**None of the four ever calls `withdraw`** — the fee is on withdrawal, and the only
"fee" test reads a constant. You called this slice representative. If the other 35 are
shaped this way, the suite is 39 assertions about the contract, made using the
contract's own reports, each one starting from `setUp()`.

---

## 2. How 100% coverage was compatible with this

**Coverage measures execution, not observation.** `forge coverage` answers "did this
line run?" The buggy line ran — it ran in every withdrawal test, and every one of them
was green. A test file with all assertions deleted reports the same 100%. Coverage is
necessary and carries no information about correctness.

**The contract was both subject and oracle.** Every assertion in the slice compares a
value the vault reported against another value the vault reported, or against a
constant harvested from a prior run of the vault. A cache-versus-truth bug is
undetectable by construction when the cache is the only thing you ever ask. To catch
it you need a source of truth the buggy code does not produce: the token balance, the
yield protocol's own view of the position, or a ghost variable the test maintains.

**Line coverage is coverage of code; this bug lives in sequences.** The vault is a
state machine. 100% line coverage means every transition has been fired at least once,
from the initial state, in isolation. The property that broke is a relation between
*consecutive* states across arbitrary-length sequences. There is no coverage metric
that goes green on that, and no number of additional single-transition tests would
have raised it — the suite is asymptotically blind here, not merely incomplete.

**`setUp()` resets the accumulator.** Drift grows by 0.3% of each withdrawal. Every
test starts from a fresh vault, so every test observes at most one increment, in a
state where nothing downstream reads it. The one mechanism that makes the bug
expensive — accumulation — is the one thing a per-test fixture guarantees can't happen.

---

## 3. Why "every operation is correct in isolation" is the tell

Take it literally. Each withdrawal returns the right `gross` for the pre-state,
transfers the right `net`, burns the right shares. All true. The error is not in any
value the call *computes*; it's in the state the call *leaves behind*, and that state
is only readable by a *later* call. A test whose assertions all live inside one call's
frame is structurally incapable of seeing it.

So: unit tests are exactly the instrument that detects pointwise-wrong operations. If
a single call misbehaved, this suite would have caught it. All 39 passing therefore
rules out the class of bugs unit tests can see — and says nothing at all about the
class they cannot. "We can't point at a single call that misbehaves" doesn't narrow the
suspect list toward *no bug*; it narrows it toward *conservation and composition bugs*,
which is a small, well-known, expensive family: drift, double-count, rounding leak,
lost accrual. The evidence the lead is holding up as an alibi is the fingerprint of the
culprit.

Concretely: every operation being locally correct while the aggregate is wrong is the
definition of a broken conservation law. Local correctness is what you check with unit
tests; conservation is what you check with invariants. The suite did all of one and
none of the other, and the bug landed precisely in the gap.

---

## 4. The property that catches it

### Primary: accounting tracks reality, with error bounded by a constant

> For every reachable state, `vault.totalAssets()` equals the assets the vault actually
> controls — idle balance plus its position in the yield protocol, measured from the
> *protocol's* books, not the vault's — up to a fixed rounding tolerance that does not
> grow with the number of operations.

```
| vault.totalAssets() - (usdt.balanceOf(vault) + yield.assetsOf(vault)) |  <=  DUST
```

`DUST` must be a **constant** (a few wei per op at most), never a percentage and never
a function of call count. That constant is what does the work: the bug's error grows
without bound, so any fixed tolerance catches it, and there is no way to "tune" the
tolerance to make the test pass without admitting the drift is unbounded.

The measurement on the right must come from outside the vault. That's the whole point.

### The local form, which pins the exact line

> Every state-changing call moves the books and reality by the same delta:
> `Δ totalAssetsStored == Δ realHeld`.

On withdrawal, `realHeld` drops by `net`, so `totalAssetsStored` must drop by `net`.
Assert this per-call in the handler and the failure names the offending line directly.

### Secondary: the fee actually accrues — and why the obvious version is not enough

The invariant you'd reach for second is "price per share never decreases." **It passes
under this bug.** Check it: with `gross = s·A/S`, the buggy update gives
`pps_after = (A - gross)/(S - s) = A/S = pps_before`. Exactly flat. Non-decreasing
holds; the fee simply never arrives. Monotonicity is too weak — you need the
quantitative version:

> After a withdrawal charging `fee`, with `S_after` shares outstanding and `S_after > 0`:
> `(pps_after - pps_before) * S_after == fee`, up to rounding dust.
> And if `S_after == 0`, the vault's residual real balance is dust.

### Third: no unclaimable residue

> If every holder redeems all shares in any order, the total paid out equals every
> token ever deposited, and the vault's real balance ends at dust.

This is the half of the symptom that made it unrecoverable, and it deserves its own
assertion.

---

## 5. Test shapes

### A. Stateful invariant test — the one that was missing

```solidity
contract VaultInvariantTest is Test {
    Vault vault; MockUSDT usdt; MockYield yield; VaultHandler handler;

    uint256 constant DUST = 100; // wei, absolute, NOT proportional to op count

    function setUp() public {
        usdt  = new MockUSDT();
        yield = new MockYield(usdt);
        vault = new Vault(usdt, yield);
        handler = new VaultHandler(vault, usdt, yield);
        targetContract(address(handler));
    }

    function _realHeld() internal view returns (uint256) {
        // measured from OUTSIDE the vault's own accounting
        return usdt.balanceOf(address(vault)) + yield.assetsOf(address(vault));
    }

    /// THE invariant. Fails on the first withdrawal under the current bug.
    function invariant_AccountingTracksRealAssets() public view {
        assertApproxEqAbs(vault.totalAssets(), _realHeld(), DUST,
            "books drifted from tokens actually held");
    }

    /// Deposits are conserved: nobody's principal evaporates.
    function invariant_SolventForAllHolders() public view {
        assertGe(_realHeld(), vault.totalAssets(), "insolvent");
    }

    /// Fees land with the stayers, not in limbo. Handler tracks fees charged.
    function invariant_FeesAccrueToRemainingHolders() public view {
        if (vault.totalShares() == 0) return;
        assertApproxEqAbs(
            vault.totalAssets(),
            handler.ghost_deposited() - handler.ghost_paidOut(),
            DUST,
            "charged fees did not land in the vault's books"
        );
    }

    /// Everyone exits; nothing is left stranded. Runs once per sequence.
    function afterInvariant() public {
        handler.forceExitAll();
        assertEq(vault.totalShares(), 0);
        assertLe(_realHeld(), DUST, "unclaimable residue left in protocol");
    }
}

contract VaultHandler is Test {
    Vault vault; MockUSDT usdt; MockYield yield;
    address[] public actors;
    uint256 public ghost_deposited;   // sum of all principal in
    uint256 public ghost_paidOut;     // sum of all net transfers out

    constructor(Vault v, MockUSDT u, MockYield y) {
        vault = v; usdt = u; yield = y;
        for (uint256 i; i < 5; ++i) actors.push(makeAddr(string.concat("a", vm.toString(i))));
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[bound(seed, 0, actors.length - 1)];
    }

    function deposit(uint256 seed, uint256 amount) public {
        address a = _actor(seed);
        amount = bound(amount, 1e6, 1_000_000e6);
        deal(address(usdt), a, amount);
        vm.startPrank(a);
        usdt.approve(address(vault), amount);
        vault.deposit(amount);
        vm.stopPrank();
        ghost_deposited += amount;
    }

    function withdraw(uint256 seed, uint256 shareSeed) public {
        address a = _actor(seed);
        uint256 max = vault.shareBalance(a);
        if (max == 0) return;                       // guard, don't revert
        uint256 shares = bound(shareSeed, 1, max);

        // local conservation check, per call — names the exact broken line
        uint256 booksBefore = vault.totalAssets();
        uint256 realBefore  = usdt.balanceOf(address(vault)) + yield.assetsOf(address(vault));

        vm.prank(a);
        uint256 out = vault.withdraw(shares);
        ghost_paidOut += out;

        uint256 realAfter = usdt.balanceOf(address(vault)) + yield.assetsOf(address(vault));
        assertApproxEqAbs(
            booksBefore - vault.totalAssets(),
            realBefore - realAfter,
            1,
            "books moved by a different amount than tokens did"
        );
    }

    function forceExitAll() public {
        for (uint256 i; i < actors.length; ++i) {
            uint256 s = vault.shareBalance(actors[i]);
            if (s == 0) continue;
            vm.prank(actors[i]);
            vault.withdraw(s);
        }
    }
}
```

```toml
# foundry.toml — depth matters; drift needs sequences, not calls
[invariant]
runs = 512
depth = 50
fail_on_revert = true    # handler guards instead of swallowing reverts
```

`fail_on_revert = true` with guarded handlers is deliberate: with it false, a handler
that silently reverts every withdrawal reports a green invariant run having tested
nothing — the same failure mode as the coverage number.

### B. The deterministic regression test — the one that should exist regardless

Invariant machinery is the general answer, but this bug also had a three-line
statement that nobody wrote. It reads as the feature's spec:

```solidity
function test_WithdrawFeeAccruesToRemainingHolders() public {
    _deposit(alice, 1000e6);
    _deposit(bob,   1000e6);

    uint256 ppsBefore = vault.totalAssets() * 1e18 / vault.totalShares();

    vm.prank(bob);
    uint256 bobOut = vault.withdraw(vault.shareBalance(bob));

    uint256 fee = 1000e6 * 30 / 10_000;
    assertApproxEqAbs(bobOut, 1000e6 - fee, 1, "bob paid the wrong fee");

    // the entire point of the feature, asserted for the first time:
    uint256 ppsAfter = vault.totalAssets() * 1e18 / vault.totalShares();
    assertGt(ppsAfter, ppsBefore, "fee did not accrue to remaining holders");
    assertApproxEqAbs(
        (ppsAfter - ppsBefore) * vault.totalShares() / 1e18, fee, 1,
        "the amount that accrued is not the fee"
    );

    // and alice can actually claim it
    vm.prank(alice);
    uint256 aliceOut = vault.withdraw(vault.shareBalance(alice));
    assertApproxEqAbs(aliceOut, (1000e6 + fee) * 9970 / 10_000, 2, "fee unclaimable");
    assertLe(usdt.balanceOf(address(vault)) + yield.assetsOf(address(vault)), 2,
        "tokens stranded after full exit");
}
```

Note `assertGt`, not `assertGe`. Under the bug, price per share is exactly flat, so the
weak form is green. The strict form and the quantitative form both fail on line 1 of
the withdrawal.

### C. Fuzz the drift directly

```solidity
function testFuzz_NoDriftOverManyOps(uint256[20] calldata seeds) public {
    for (uint256 i; i < seeds.length; ++i) {
        (i % 2 == 0) ? handler.deposit(seeds[i], seeds[i])
                     : handler.withdraw(seeds[i], seeds[i]);
    }
    assertApproxEqAbs(vault.totalAssets(), _realHeld(), 100);
}
```

If the vault sits on a real lending market, run the same handler as a fork test against
the deployed pool (`vm.createSelectFork`, pinned block) and read `_realHeld()` from the
aToken/receipt-token balance. A mock's rounding behavior is your own assumption; the
deployed protocol's is the truth you'll be marked against.

---

## 6. What to tell the lead

The suite was thorough about *lines*. It never asserted a single *property*. Coverage
went to 100% while the number of independent facts checked about the vault stayed near
zero, because every assertion asked the contract to confirm its own report from a
fresh, single-step state.

One concrete rule going forward: **at least one assertion in the suite must compare the
vault's accounting against a quantity the vault did not compute**, and it must hold
across a random sequence of operations, not one call from `setUp()`. That single
requirement catches this bug on the first withdrawal, and catches the rest of the
family — double-count, rounding leak, lost accrual — before they ship.

The `test_WithdrawFeeBps`/no-destination-test pairing is worth a second look as a
review heuristic: if a suite tests a parameter's value but never its effect, the effect
is untested no matter what coverage says.
