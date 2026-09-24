# Why 39 green tests and 100% coverage missed the fee drift

## The shape of the bug (stated first, because it explains everything else)

The vault keeps two numbers that are supposed to track each other:

- **The accounting number** — `totalAssetsStored`, the vault's own belief about how much it owns.
- **The real number** — what the vault actually controls: its token balance plus its position in the yield protocol.

On withdrawal the vault sends out `amount - fee` but debits the accounting number by the
full `amount`. The `fee` never leaves. It sits in the yield protocol as real tokens, and
simultaneously vanishes from the books. Every withdrawal widens the gap by one fee.

That gap is the whole bug, and it has two victims:

1. Share price is `totalAssetsStored / totalShares`. Understated total ⇒ understated price
   ⇒ remaining holders redeem for less than their claim. The fee that was meant to accrue
   to them accrues to nobody.
2. The uncounted balance is unreachable. No accounting path ever names it, so no function
   can ever pay it out. It is not stolen; it is stranded.

Crucially: the gap is a *relation between two quantities*, and it only exists *after* a
withdrawal. Every property the suite asserts is a property of a single quantity, checked
before any withdrawal has happened.

---

## Test by test: what is established vs. what only appears to be

### `test_DepositMintsShares`

```solidity
uint256 shares = _deposit(alice, DEPOSIT_AMOUNT);
assertEq(shares, 999e18);
assertEq(vault.shareBalance(alice), 999e18);
```

**Actually establishes:** on a virgin vault, one deposit of `DEPOSIT_AMOUNT` returns a
specific share count, and the returned value equals the value credited to the ledger
(a genuine consistency check between return value and storage — the one real thing here).

**Only appears to establish:** that share issuance is correct. `999e18` is a magic
constant. It was almost certainly obtained by running the code and pasting the output, which
makes the assertion a snapshot of the implementation rather than a check against an
independent model. It pins today's behaviour; it does not say that behaviour is right.

It is also a *single point on a curve, taken at the one point where the curve is flat*.
Share price on an empty vault is trivially determined. The interesting question — what does
the second depositor get, after fees have accrued to the first? — is never asked. Note the
suite's own numbers already hint at this: shares are `999e18` while `totalAssets()` is
`DEPOSIT_AMOUNT`, so the share price is not 1. Nothing in the suite asserts what it
*should* be.

### `test_DepositUpdatesTotalAssets`

```solidity
_deposit(alice, DEPOSIT_AMOUNT);
assertEq(vault.totalAssets(), DEPOSIT_AMOUNT);
assertEq(vault.totalAssetsStored(), DEPOSIT_AMOUNT);
```

This is the sharpest one, and the most misleading.

**Actually establishes:** after exactly one deposit into an empty vault, both totals equal
the deposit.

**Only appears to establish:** that the accounting number tracks reality. The test compares
`totalAssets()` against `totalAssetsStored()` — *literally the pair whose divergence is the
bug* — and does so in the only state in the vault's entire lifetime where they cannot
possibly differ. No fee has been charged yet. There is nothing to drift.

This is the failure mode to internalise: **the suite contains the right comparison, evaluated
at the wrong time.** It is not that nobody thought of the property. It is that the property
was checked in a state that had no power to falsify it. A test that can only pass is not a
test.

### `test_WithdrawFeeBps`

```solidity
assertEq(vault.WITHDRAW_FEE_BPS(), 30);
```

**Actually establishes:** the constant is 30.

**Only appears to establish:** that the fee is correct. This asserts that a literal in the
contract equals a literal in the test. It exercises no logic, and would still pass if
`withdraw()` ignored `WITHDRAW_FEE_BPS` entirely — which is a near-miss description of the
actual bug, where the fee is applied to the transfer but not to the accounting. The constant
being right is precisely orthogonal to it being *used consistently*.

Its real cost is not the wasted line. It is that it makes the withdraw path *look* covered.

### `test_ConstructorSetsUsdt`

```solidity
assertEq(address(vault.usdt()), address(usdt));
```

**Actually establishes:** the constructor assigns its argument to a field.

**Only appears to establish:** nothing beyond that. This is a test that Solidity assignment
works. Its sole function in this suite is to raise the green-test count and touch the
constructor line for coverage.

---

## How 100% line and function coverage was compatible with this

Coverage answers *"was this line executed?"* The bug lives in a question coverage cannot
phrase: *"was this line's effect ever compared to anything?"*

Four specific gaps let full coverage coexist with a money-losing defect:

**1. Coverage measures execution, not assertion.** The withdraw path ran. The fee
subtraction ran. Both are green lines. Nothing anywhere checked that the amount removed from
the books equalled the amount removed from the vault. You can reach 100% coverage with a
suite whose every assertion is `assertTrue(true)`.

**2. The bug is in a *relation*, and coverage is per-line.** No single line is wrong. The
transfer line is right. The bookkeeping line is right *in isolation*. The defect is that the
two disagree — it lives in the gap between two correct lines, and there is no line to
instrument for a gap.

**3. `setUp()` resets state before every test, so drift can never accumulate.** Foundry
gives each unit test a fresh vault. The bug's magnitude after one withdrawal is one fee —
small, and asserted-against nowhere. The suite is structurally incapable of reaching the
state where the gap is visible, because it destroys the state after every single operation.
39 tests × 1 operation is not the same as 1 test × 39 operations, and only the latter
would have caught this.

**4. Expected values were read off the implementation.** `999e18`, `30`, `DEPOSIT_AMOUNT`.
When the oracle for "correct" is the code under test, the test can only detect *changes*,
never *errors*. The suite is a regression harness for a bug it froze in place.

The lead's claim — "the suite was thorough, 100% coverage, every function exercised, all
green" — is four statements about the *tests*, and zero about the *contract*. Every one of
them is true. None of them is evidence.

---

## Why "every operation is correct in isolation" is the tell, not the alibi

That sentence is a precise description of what a **conservation bug** looks like from the
inside, and it should have been read as a diagnosis rather than a defence.

Think about what it takes for a bug to have that property. If any single call misbehaved,
a unit test would have caught it — and 39 of them were looking. The bug survived *because*
it decomposes into correct steps. Each withdrawal moves the system from one internally
consistent state to another internally consistent state, along a path that leaks. There is
no frame in which the picture looks wrong; only the difference between frames is wrong.

So the statement factors cleanly into two claims:

- *"Every operation is correct in isolation"* — true, and verified by the suite.
- *"Therefore the vault is correct"* — false, and not verified by anything.

The inference from the first to the second is exactly the assumption that composition
preserves correctness. For stateful systems that assumption is false, which is the entire
reason invariant testing exists. A leak of one fee per withdrawal is *unobservable in every
single-operation test* and *inevitable across any long sequence of them*. The production
history — "over a long run of deposits and withdrawals" — is not incidental colour; it is
the experimental condition the suite never ran.

The direction of the error is a second tell. The vault holds *more* than it thinks. Bugs
that make a contract richer than its books do not revert, do not run out of funds, do not
trigger a single failing assertion. They are silent by construction, which is why they run
for months. An insolvency bug announces itself the first time a withdrawal fails; a
*surplus* bug just quietly overcharges everyone who stays.

The correct reading of "we cannot point at a single call that misbehaves": **stop looking at
calls.** Start looking at what must be true across all of them.

---

## The property the suite should have asserted

### Property 1 — Solvency accounting (this is the one that catches the bug)

> At every point in the vault's life, the assets the vault believes it has must equal the
> assets it actually controls:
>
> **`totalAssetsStored == usdt.balanceOf(vault) + yieldProtocol.positionValue(vault)`**
>
> If exact equality is not achievable because of integer rounding, the permitted form is
> one-sided and *bounded by a constant, not by the number of operations*:
>
> **`0 <= real - stored <= ROUNDING_TOLERANCE`**, with `ROUNDING_TOLERANCE` a small fixed
> wei bound that does not grow with call count.

Two details carry the weight, and both are deliberate:

- **One-sided.** `real >= stored` is the safety direction: the vault may never believe it
  owns more than it does. `stored > real` is insolvency and must fail immediately.
- **Bounded by a constant, not a per-operation allowance.** This is what distinguishes
  rounding dust from a leak. The bug in production produces a gap proportional to the number
  of withdrawals. Any tolerance written as `n_ops * 1 wei` would have accommodated the bug
  and passed. The bound must be flat, so that accumulation — the actual defect — breaks it.

### Property 2 — Fee destination (states the *intent* the code got wrong)

> A withdrawal's fee must remain inside the vault's accounted assets. For a withdrawal of
> gross amount `a` with fee `f`:
>
> **`stored_after == stored_before - (a - f)`**
>
> i.e. the books are debited by what *left*, never by what was *requested*.

This is the exact inverted line. Asserting it turns the bug into a one-line failure.

### Property 3 — Share price monotonicity (states the *economic* intent)

> Assets-per-share is non-decreasing across every operation. Deposits and withdrawals may
> not reduce it; a withdrawal that charges a fee must strictly increase it whenever shares
> remain outstanding.
>
> **`assetsPerShare_after >= assetsPerShare_before`**, and strictly greater after a
> fee-charging withdrawal with `totalShares_after > 0`.

Property 1 catches the drift. Property 3 catches the *consequence* — "the fee accrues to
whoever is still in" — and would have failed even if the accounting had been made
self-consistent in the wrong direction.

---

## The test shape that checks it

A handler-driven invariant test. The handler is the essential part: it must be able to
generate long, interleaved sequences of deposits and withdrawals *without resetting state*,
which is exactly the capability the unit suite lacks.

```solidity
// test/invariant/VaultInvariant.t.sol
contract VaultInvariantTest is Test {
    Vault public vault;
    MockUSDT public usdt;
    MockYield public yieldProtocol;
    VaultHandler public handler;

    function setUp() public {
        usdt = new MockUSDT();
        yieldProtocol = new MockYield(usdt);
        vault = new Vault(usdt, yieldProtocol);
        handler = new VaultHandler(vault, usdt);

        // Only the handler acts. Without this, the fuzzer calls view functions
        // and reverting paths and explores almost nothing.
        targetContract(address(handler));
    }

    /// PROPERTY 1: books never claim more than the vault controls, and the gap
    /// never accumulates. This is the assertion that fails on the shipped bug.
    function invariant_StoredAssetsMatchRealAssets() public view {
        uint256 real = usdt.balanceOf(address(vault))
            + yieldProtocol.positionValue(address(vault));
        uint256 stored = vault.totalAssetsStored();

        assertGe(real, stored, "INSOLVENT: books exceed real holdings");
        assertLe(
            real - stored,
            ROUNDING_TOLERANCE, // flat constant — must NOT scale with call count
            "DRIFT: unaccounted assets accumulating"
        );
    }

    /// PROPERTY 3: fees accrue to remaining holders; price never goes backwards.
    /// The handler records the price before each call; this checks it after.
    function invariant_SharePriceNeverDecreases() public view {
        assertGe(
            handler.lastSharePrice(),
            handler.previousSharePrice(),
            "share price decreased"
        );
    }

    /// Diagnostic, not an assertion: confirms the fuzzer actually withdrew.
    /// An invariant suite that never reached the buggy path is a suite that
    /// proves nothing — check this before trusting a green run.
    function invariant_CallSummary() public view {
        console.log("deposits:   ", handler.depositCount());
        console.log("withdrawals:", handler.withdrawCount());
        console.log("drift (wei):", handler.observedDrift());
    }
}

contract VaultHandler is Test {
    Vault public vault;
    MockUSDT public usdt;

    address[] public actors;
    address internal currentActor;

    uint256 public depositCount;
    uint256 public withdrawCount;
    uint256 public lastSharePrice;
    uint256 public previousSharePrice;

    modifier useActor(uint256 seed) {
        currentActor = actors[bound(seed, 0, actors.length - 1)];
        previousSharePrice = lastSharePrice;
        vm.startPrank(currentActor);
        _;
        vm.stopPrank();
        lastSharePrice = _sharePrice();
    }

    function deposit(uint256 actorSeed, uint256 amount) external useActor(actorSeed) {
        amount = bound(amount, 1e6, 1_000_000e6);
        deal(address(usdt), currentActor, amount);
        usdt.approve(address(vault), amount);
        vault.deposit(amount);
        depositCount++;
    }

    function withdraw(uint256 actorSeed, uint256 shares) external useActor(actorSeed) {
        uint256 max = vault.shareBalance(currentActor);
        if (max == 0) return;              // return, don't revert — a revert
        shares = bound(shares, 1, max);    // wastes the whole sequence
        vault.withdraw(shares);
        withdrawCount++;
    }

    function _sharePrice() internal view returns (uint256) {
        uint256 supply = vault.totalShares();
        return supply == 0 ? 1e18 : (vault.totalAssets() * 1e18) / supply;
    }
}
```

```toml
# foundry.toml — depth is what turns one fee into visible drift
[invariant]
runs = 512
depth = 100
fail_on_revert = false
```

Three things about this shape matter more than the code:

- **Depth is the active ingredient.** At `depth = 1` this suite is as blind as the unit
  tests. The bug's signal is `n_withdrawals × fee`; you need `n` large before it clears any
  plausible rounding tolerance. If you set a tolerance and it passes, raise `depth` and
  confirm the drift number in `invariant_CallSummary` stays flat rather than climbing.
- **Handlers must not revert.** `withdraw` returns early on a zero balance instead of
  reverting. With `fail_on_revert = false` a reverting handler silently truncates sequences,
  and you get a green run over states that never reached a second withdrawal. This is the
  most common way an invariant suite passes vacuously.
- **Verify the test can fail.** Before trusting it, revert the fee fix locally and confirm
  the invariant breaks, then reapply. An invariant nobody has seen fail is in the same
  category as `test_DepositUpdatesTotalAssets`.

### Two unit tests worth adding alongside

These are cheap, they localise the failure to a line, and they encode intent in a form a
reader can check without running the fuzzer:

```solidity
/// Property 2 as a direct assertion — fails on exactly the inverted line.
function test_WithdrawFeeStaysInVaultAccounting() public {
    _deposit(alice, DEPOSIT_AMOUNT);
    uint256 storedBefore = vault.totalAssetsStored();

    vm.prank(alice);
    uint256 received = vault.withdraw(vault.shareBalance(alice) / 2);

    uint256 gross = (received * 10_000) / (10_000 - vault.WITHDRAW_FEE_BPS());
    uint256 fee = gross - received;

    // Books debited by what LEFT, not by what was requested.
    assertEq(vault.totalAssetsStored(), storedBefore - received, "fee debited from books");
    assertGt(fee, 0, "fee must be non-zero or this test proves nothing");
}

/// Property 3 at the level that users actually feel it.
function test_WithdrawalFeeAccruesToRemainingHolders() public {
    _deposit(alice, DEPOSIT_AMOUNT);
    _deposit(bob, DEPOSIT_AMOUNT);

    uint256 bobPriceBefore = _sharePrice();
    vm.prank(alice);
    vault.withdraw(vault.shareBalance(alice));

    assertGt(_sharePrice(), bobPriceBefore, "alice's fee must enrich bob");
}
```

Note that the second test would have failed on day one. It needs two actors and two
operations — one more of each than any test in the current suite.

---

## The one-line version

The suite asserted 39 facts about single operations and zero facts about the relationship
between operations. The bug lives entirely in that relationship, so no amount of coverage
over the first category could ever reach it. `test_DepositUpdatesTotalAssets` shows the team
already knew which two numbers mattered — it just compared them in the only state where the
answer was guaranteed. Replace "does each call do the right thing?" with "what must remain
true after *any* sequence of calls?", and the drift shows up in the first invariant run.
