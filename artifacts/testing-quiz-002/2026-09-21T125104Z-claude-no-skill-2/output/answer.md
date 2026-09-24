# Why a 100%-covered setter shipped a vault-bricking fee

## Short version

`setDepositFee` has no domain check. `depositFeeBps` is a `uint256` whose only
meaningful range is `[0, BPS_DENOMINATOR]`, but nothing in the code or the tests
ever asserts that. Ops set a promotional fee at or above `10_000` bps, and from
that moment `fee == amount` (or `fee > amount`), so `netAmount == 0` and every
`deposit()` hit `revert NoSharesMinted()`.

The setter is not "wrong" line-by-line — it is wrong in its *contract*. It accepts
a `uint256` and promises nothing about which `uint256`s are safe. The coupling that
makes it dangerous lives in a different function, so nothing local looks broken.

## How 100% coverage missed it

Line/branch coverage answers one question: *was this statement executed by some
test?* It says nothing about *which values* flowed through it. There is exactly one
straight-line path through `setDepositFee` — no `if`, no `require`, no loop — so a
single call with any value whatsoever paints it 100% green. The same is true of the
fee maths in `deposit()`: the arithmetic is unconditional, so one successful deposit
covers every line, and `revert NoSharesMinted()` is the only branch, which the
suite presumably never needed to take.

So coverage was saturated after the very first test. Tests 2, 3 and 4 added
confidence about *arithmetic*, and zero additional information about *the domain of
the input*. Coverage is a necessary condition for a good suite, not a sufficient
one; a metric that maxes out at one test cannot distinguish a one-test suite from
a thorough one.

Worse, the missing code is the thing that would have been covered. You cannot get
coverage on a `require` that was never written. Coverage can only measure the code
you have, never the guard you forgot — which is precisely the failure mode of every
missing-validation bug.

## The class of input never tried

**Out-of-range and boundary values.** Every tested value — 0, 10, 25 — sits deep in
the interior of the valid domain, clustered at the bottom of a 10,000-wide range.
They are all "values ops would plausibly type on a normal day". They were chosen by
imagining reasonable usage, and reasonable usage is exactly the region where bugs
do not live.

Specifically, the suite never tried:

- the boundary itself, `newFeeBps == BPS_DENOMINATOR` (10,000 = 100% fee),
- anything past it, `newFeeBps > BPS_DENOMINATOR`,
- the near-boundary interior, 9,999, where the vault still "works" but is absurd,
- small `amount` against a large-but-legal fee, where integer truncation alone
  drives `shares` to 0.

Why those four values could never have found it: 0, 10 and 25 all satisfy
`fee < amount` by an enormous margin for any realistic deposit, so `netAmount`
stays comfortably positive and `convertToShares` returns a nonzero result. The
failure is a *step function* at `fee >= amount`, i.e. at `depositFeeBps >= 10_000`.
No amount of testing at 25 bps gets you closer to 10,000 bps. The tests sample one
side of a discontinuity and assert the arithmetic is linear there — which it is.
They are correct and irrelevant. And the fourth test (only-owner) probes the
*authorization* axis, not the *value* axis, so it adds nothing here either: the
incident was caused by the legitimate owner, doing an authorized call, with a bad
number.

## The arithmetic

`BPS_DENOMINATOR = 10_000`. Take a normal deposit of 1,000 tokens, 18 decimals:
`amount = 1_000e18`.

**Healthy case, the one that was tested (25 bps):**

    fee       = 1_000e18 * 25 / 10_000 = 2.5e18
    netAmount = 1_000e18 - 2.5e18      = 997.5e18
    shares    = convertToShares(997.5e18) > 0          -> deposit succeeds

**The boundary, `depositFeeBps = 10_000`:**

    fee       = 1_000e18 * 10_000 / 10_000 = 1_000e18   // the entire deposit
    netAmount = 1_000e18 - 1_000e18        = 0
    shares    = convertToShares(0)         = 0
    -> revert NoSharesMinted()

This is the bricked state. It is amount-independent: for *any* `amount`,
`amount * 10_000 / 10_000 == amount`, so `netAmount` is always 0 and every deposit
from every caller reverts. That matches the report exactly — "every single deposit
reverted until we redeployed".

**Past the boundary, e.g. a fat-fingered `depositFeeBps = 100_000`** (someone typing
a percentage-of-a-percentage, or "10%" as `10 * 10_000`):

    fee       = 1_000e18 * 100_000 / 10_000 = 10_000e18   // 10x the deposit
    netAmount = 1_000e18 - 10_000e18                      // underflow
    -> Panic(0x11): arithmetic underflow (Solidity >=0.8 checked maths)

Same user-visible outcome — all deposits revert — but a different, more confusing
error selector, which is why a bricked vault can be hard to diagnose from logs.

**The quieter cousin, still inside the "valid" range** — `depositFeeBps = 9_999`
with a small deposit, `amount = 5`:

    fee       = 5 * 9_999 / 10_000 = 49_995 / 10_000 = 4   (integer truncation)
    netAmount = 5 - 4 = 1
    shares    = convertToShares(1) = 0 if the vault has appreciated at all
    -> revert NoSharesMinted()

So even a bound of `<= 10_000` leaves a griefable region. The bound you actually
want is a policy maximum (`MAX_FEE_BPS`, say 500 or 1,000), not the mathematical
maximum.

## The technique that would have caught it

**Property-based / fuzz testing on the setter, with the invariant expressed in
terms of `deposit()` rather than in terms of the stored number.** In Foundry, that
is a `testFuzz_` function — the fuzzer draws from the whole `uint256` space and
deliberately biases toward boundaries (0, 1, type max, and values near constants it
finds in the code), so `10_000` and `10_001` are among the first few hundred draws.

    function testFuzz_FeeSetterNeverBricksDeposits(uint256 newFeeBps, uint256 amount) public {
        amount = bound(amount, 1e18, 1_000_000e18);

        vm.prank(owner);
        vault.setDepositFee(newFeeBps);          // today: accepts anything

        // The property: whatever the owner is *allowed* to set,
        // a normal-sized deposit must still succeed.
        deal(address(token), user, amount);
        vm.prank(user);
        vault.deposit(amount);                    // fails at newFeeBps = 10_000
    }

This fails within seconds and Foundry shrinks the counterexample to the minimal
one, which will be at or adjacent to `newFeeBps = 10_000`. The counterexample is
then frozen as a regression test.

Note what makes this work: the property is stated *across* the two functions. A
fuzz test that only asserted "the stored value equals what I passed" would pass
forever, because that is all `setDepositFee` claims. The bug lives in the
relationship between the setter's accepted domain and the arithmetic downstream,
so the property has to span both.

Two techniques that complement it:

- **Boundary-value analysis** — a cheap, deterministic table test at
  `{0, 1, MAX_FEE_BPS - 1, MAX_FEE_BPS, MAX_FEE_BPS + 1, 9_999, 10_000, 10_001,
  type(uint256).max}`, asserting accept/revert for each. This is what you write
  once you *know* to think about the boundary; fuzzing is what finds boundaries you
  did not think of.
- **An invariant test** — `invariant_depositAlwaysMintsShares()`, with the owner's
  `setDepositFee` exposed as a handler action. The invariant runner composes random
  admin calls with random user calls and asserts the vault-level property holds
  after every sequence, which catches "admin action X makes user action Y
  impossible" bugs as a category rather than one at a time.

## The fix

    uint256 public constant MAX_FEE_BPS = 1_000;   // 10%, a policy cap

    function setDepositFee(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh(newFeeBps, MAX_FEE_BPS);
        uint256 previousFeeBps = depositFeeBps;
        depositFeeBps = newFeeBps;
        emit DepositFeeUpdated(previousFeeBps, newFeeBps);
    }

A hard, immutable cap is what makes the setter safe; it also makes the guarantee
legible to depositors, who otherwise have to trust that the owner never types a
number with one too many zeros. Cap it in the code, not in the runbook.

## The generalizable lesson

Coverage tells you which code ran. It cannot tell you which *values* ran, and it
structurally cannot flag a validation check that was never written. Any function
that stores an externally supplied number which another function later does
arithmetic with needs its *domain* tested, not just its *behaviour on nice inputs*
— and the tool for testing a domain is a fuzzer with a cross-function property,
backed by explicit boundary cases.
