# Why 100% coverage missed the fee setter that bricked deposits

## 1. What actually happened

`setDepositFee` has no domain check. `depositFeeBps` is only meaningful on `[0, BPS_DENOMINATOR)`,
but the setter accepts the whole `uint256` range. Ops wrote a value at or above `10_000`
(the classic cause: typing a percentage into a basis-point field — `50` for "50%" is 0.5%,
so someone "corrects" it to `50_00`… or to `50_000`), and from that block on every call to
`deposit()` reverted, for every caller and every amount. Nothing in the vault could clear it,
because the same setter that set it is not the thing that failed — so the only lever left was a redeploy.

The setter is not buggy in isolation. It stores the number it was given. The bug is that the
**valid domain of the parameter was never stated anywhere in code or asserted anywhere in tests**,
so `deposit()` inherited the job of enforcing it and enforces it by reverting.

## 2. Why 100% coverage proves nothing here

Line coverage answers "did this line execute?". It never answers "could any assertion in this
suite have failed?". Both functions are straight-line code with no branches:

- `setDepositFee` — 3 statements, no `if`. **Any single call** covers 100% of it. Calling it with
  `0`, `10`, `25` and once from a non-owner adds no coverage over calling it once.
- `deposit()`'s fee block — also straight-line. One successful deposit covers every line.

So the coverage number was saturated by the first test and stayed at 100% no matter what the
other tests did. Coverage is a measure of *code* reached, and the missing thing here is not code —
it is an *input region*. There is no line to be red for the bound that was never written: the check
that should have existed is absent, so coverage cannot report its absence. Coverage of a missing
guard is always 100%.

Two of the four tests are also structurally incapable of failing on this class of defect:

- The event test asserts `DepositFeeUpdated(previous, new)` carries back the value just passed in —
  the implementation asserted against itself.
- The `onlyOwner` test exercises the access boundary, which is orthogonal to the value's domain.
  The owner *was* the caller here. Access control was working perfectly while the vault bricked.

## 3. The class of input never tried

Every fee value in the suite — 0, 10, 25 — lives in a single equivalence class:

> **fees so small that `fee < amount` can never fail and `netAmount` is still ~100% of `amount`.**

0, 10 and 25 bps are 0%, 0.1% and 0.25%. They are three samples from one corner of a domain
whose interesting behaviour is entirely at the *other* end. Adding a fourth small value, or a
hundred of them, walks the identical path: subtract a bit, mint shares, pass. They are
hand-picked "plausible production values", and hand-picked values can only confirm the cases
whoever picked them had already imagined. Nobody imagined `10_000`, which is exactly why ops
could enter it.

The untested class is **values at and beyond the denominator boundary**, `depositFeeBps >= BPS_DENOMINATOR`
— and, one step further out, values large enough that `amount * depositFeeBps` overflows `uint256`
before the division ever runs.

Note that the three regions fail through **three different paths**, which is why they have to be
exercised and preserved as separate evidence rather than folded into one "too big" test:

| `depositFeeBps` | behaviour |
|---|---|
| `9_999` | last semantically usable value — 1 wei of net per 10_000 wei in; passes for large deposits, mints 0 shares for small ones |
| `10_000` | `netAmount == 0` → `convertToShares(0) == 0` → **`NoSharesMinted()`** |
| `10_001` | `fee > amount` → `amount - fee` underflows → **`Panic(0x11)`** |
| `~2^256/amount` | `amount * depositFeeBps` overflows before the division → **`Panic(0x11)` at the multiply** |

The exact limit `10_000` is *not* a valid value, even though no numeric inequality is violated by it:
`amount - fee` is a perfectly fine `0`. It is invalid semantically, because a vault that mints zero
shares for every deposit is a vault that takes 100% of your money or reverts. This is the boundary
trap — "the limit is fine because only values past it underflow" is precisely the reasoning that
lets `10_000` through.

## 4. The arithmetic

Take a normal 1,000-token deposit, 18 decimals: `amount = 1_000e18 = 1e21`, `BPS_DENOMINATOR = 10_000`.
Assume an unlevered vault so `convertToShares(x) == x`.

**Last valid value, `depositFeeBps = 9_999`:**

    fee       = (1e21 * 9_999) / 10_000 = 9.999e20
    netAmount = 1e21 - 9.999e20         = 1e17        (0.1 token)
    shares    = 1e17                                   ✅ passes — 99.99% fee, but deposits still work

**The exact limit, `depositFeeBps = 10_000`:**

    fee       = (1e21 * 10_000) / 10_000 = 1e21        (== amount, no underflow)
    netAmount = 1e21 - 1e21              = 0
    shares    = convertToShares(0)       = 0
                                          → revert NoSharesMinted()     ❌ every deposit reverts

**First value beyond, `depositFeeBps = 10_001`:**

    fee       = (1e21 * 10_001) / 10_000 = 1.0001e21   (> amount)
    netAmount = 1e21 - 1.0001e21         → underflow
                                          → revert Panic(0x11)          ❌ every deposit reverts

Both failures are **amount-independent** — they scale with `amount`, so no deposit size escapes
them. That is why "every single deposit reverted" rather than "large deposits reverted".
And note the `10_000` case reverts with a *plausible-looking* error, `NoSharesMinted`, which is
the error you would also get from a dust deposit. That error name is what sent ops looking at
deposit sizes instead of at the fee they had just changed.

## 5. The technique that would have caught it

**Fuzz the parameter over its whole accepted domain, not over the values you would have chosen,
with the boundary triple exercised and classified separately.**

Every owner-settable number that feeds value math — fee bps, ratios, caps, exchange rates — needs
a fuzz test across its full accepted domain before deploy. Bound with `bound()`, not `vm.assume()`,
so runs are not discarded and the edges are actually reachable.

```solidity
// The property: the setter must never be able to put the vault in a state
// where a normal deposit cannot mint shares.
function testFuzz_setDepositFee_neverBricksDeposits(uint256 feeBps, uint256 amount) public {
    feeBps = bound(feeBps, 0, type(uint256).max);   // the WHOLE accepted domain, not 0..10_000
    amount = bound(amount, 1e18, 1_000_000e18);

    vm.prank(owner);
    try vault.setDepositFee(feeBps) {
        // If the setter accepted it, deposits must still work.
        deal(address(token), alice, amount);
        vm.startPrank(alice);
        token.approve(address(vault), amount);
        uint256 shares = vault.deposit(amount);      // must not revert
        vm.stopPrank();
        assertGt(shares, 0, "accepted fee bricked deposits");
    } catch {
        // Rejecting the value is the correct behaviour — that is the fix.
    }
}

// Boundary triple, kept as three separate pieces of evidence:
function test_fee_9999_isLastUsableValue() public { /* passes today */ }
function test_fee_10000_revertsNoSharesMinted()  public {
    vm.prank(owner); vault.setDepositFee(10_000);
    vm.expectRevert(NoSharesMinted.selector);
    vault.deposit(1_000e18);
}
function test_fee_10001_revertsPanicUnderflow()  public {
    vm.prank(owner); vault.setDepositFee(10_001);
    vm.expectRevert(stdError.arithmeticError);      // Panic(0x11) — a DIFFERENT path
    vault.deposit(1_000e18);
}
```

The fuzz test fails on its first run with a counterexample somewhere in `[10_000, 2^256)` —
Foundry shrinks it and hands you `10_000` or `10_001` — and it fails *without anyone having
guessed that the denominator was the interesting number*. That is the whole point: the four
hand-picked values could only find what was already suspected; the fuzzer searches the region
nobody proposed.

Two caveats on how to use this, because they are what separates the search from theatre:

- Writing `test_fee_10000_reverts()` *after* reading the code and spotting the missing bound is
  not the search. It confirms the one defect you happened to imagine, and stops there. The fuzz
  over the full domain is what finds the ones you did not imagine (the multiplication overflow,
  for instance, is a second distinct failure mode most people never write a targeted test for).
- Since this is a vault — stateful accounting — the fee parameter also belongs in a
  handler-driven invariant run, with `setDepositFee` as one of the handler's actions alongside
  deposit/withdraw, asserting `totalAssets` against assets actually held. That catches the
  *sequence*-dependent version of this: a fee change mid-life that leaves accounting and custody
  drifting apart, which no single-operation test can see. Watch the calls/reverts statistics —
  if the run is near 100% reverts because the fee got stuck at 10_000, the invariant was asserted
  against a vault that never moved and the green means nothing.

## 6. The fix itself

```solidity
uint256 public constant MAX_DEPOSIT_FEE_BPS = 1_000;   // 10%, a policy limit, well inside the math limit

function setDepositFee(uint256 newFeeBps) external onlyOwner {
    if (newFeeBps > MAX_DEPOSIT_FEE_BPS) revert FeeTooHigh(newFeeBps, MAX_DEPOSIT_FEE_BPS);
    uint256 previousFeeBps = depositFeeBps;
    depositFeeBps = newFeeBps;
    emit DepositFeeUpdated(previousFeeBps, newFeeBps);
}
```

Bound at a *policy* maximum, not at `BPS_DENOMINATOR - 1`. `9_999` is arithmetically survivable and
economically absurd; a cap that only prevents the panic still lets ops confiscate 99.99% of a deposit
with one transaction. The fuzz test above stays in the suite unchanged — it now exits through the
`catch` branch for everything above the cap, and that is the assertion that the cap is real.

### Summary

- **Missed because**: coverage measures executed lines; the defect is a *missing* line (an absent
  bound), and missing lines are always 100% covered. Both functions are branchless, so one call
  saturated the metric.
- **Untested class**: `depositFeeBps >= BPS_DENOMINATOR` — the values 0/10/25 are all one
  equivalence class (fee ≪ amount) sampled three times, and none of them can reach the
  `netAmount == 0` or `fee > amount` paths at any deposit size.
- **Technique**: full-domain fuzzing of the owner-settable parameter with `bound()`, with the
  boundary triple (9_999 valid / 10_000 limit / 10_001 beyond) exercised separately because the
  limit and the value past it fail through different paths — backed by a handler invariant that
  includes `setDepositFee` in its action space.
