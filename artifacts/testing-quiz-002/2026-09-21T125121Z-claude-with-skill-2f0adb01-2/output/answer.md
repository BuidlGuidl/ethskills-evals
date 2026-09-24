# Why 100% coverage missed the fee-setter brick

## Short version

`setDepositFee` has no upper bound. Coverage proved every *line* of both functions
executed; it proved nothing about *which values* reached them. The four fee values in
the suite (0, 10, 25 bps, plus the owner check) are all drawn from the same tiny
sub-region of the input space — the region the author already believed was valid.
The bug lives entirely outside that region, at `newFeeBps >= 10_000`, and no amount of
re-running inputs from inside the valid region can reach it.

---

## 1. What coverage actually measured

`forge coverage` is a **structural** metric. It answers: "was this statement executed
at least once?" Every one of the four tests drives the same straight-line path:

```
setDepositFee:   3 statements, no branches  -> 100% after ONE call with ANY value
deposit fee math: 4 statements, one branch  -> 100% once shares==0 is and isn't hit
```

`setDepositFee` is branch-free. Calling it with `0` covers it exactly as completely as
calling it with `type(uint256).max`. So the coverage number was already saturated after
the first test and could never move again, no matter how wrong the stored value was.

The deeper point: **coverage cannot report a missing line.** The defect here is the
absence of

```solidity
if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
```

There is no such statement, so there is no uncovered statement, so the tool is green.
Coverage is a lower bound on test quality — "you haven't even executed this" — never an
upper bound — "you have tested this."

## 2. The class of input never tried

The suite only ever used **in-domain, nominal values**: `0 <= feeBps <= 25`, all far
below `BPS_DENOMINATOR`. It never tried:

| class | example | what happens |
|---|---|---|
| domain boundary | `feeBps = 10_000` (100%) | `fee == amount`, `netAmount == 0`, every deposit reverts `NoSharesMinted` |
| just past the boundary | `feeBps = 10_001` | `fee > amount`, `amount - fee` underflows -> `Panic(0x11)` |
| unit confusion | `feeBps = 50_000` ("5%" typed as a percent-scaled number, or 500 bps typed with an extra zero) | same underflow |
| absurd / max | `feeBps = type(uint256).max` | `amount * depositFeeBps` overflows before the division — reverts even earlier |

Why 0, 10 and 25 *structurally cannot* find it: the failure is a **step discontinuity at
`feeBps == BPS_DENOMINATOR`**. For every `feeBps < 10_000` the function is total and
well-behaved, and the three sample points are not merely inside that region, they are
clustered at its extreme low end (0.25% of the way to the cliff). Each additional value
drawn from that region re-confirms the same linear behaviour and adds zero information
about the region past it. Three points on a line tell you nothing about where the line
stops existing. The tests encoded the developer's assumption ("fees are small") as the
*test data* rather than asserting it as a *contract invariant*, so the assumption was
never actually checked — it was only re-stated.

The only-owner test is orthogonal: it asserts *who* may call, never *what* they may pass.
Ops was the owner. Authorisation was correct; validation was absent.

## 3. The arithmetic for the input that breaks it

Take the realistic ops slip: intending "1%" and entering `10_000` (or intending 100 bps
and hitting an extra zero twice). Deposit of 1,000 tokens, 18 decimals:

```
amount          = 1_000e18            = 1_000_000_000_000_000_000_000
depositFeeBps   = 10_000
BPS_DENOMINATOR = 10_000

fee        = (1_000e18 * 10_000) / 10_000
           = 10_000_000_000_000_000_000_000_000 / 10_000
           = 1_000e18                            <-- fee == amount

netAmount  = 1_000e18 - 1_000e18 = 0
shares     = convertToShares(0)  = 0
           -> revert NoSharesMinted()
```

One notch higher, `depositFeeBps = 10_001`:

```
fee        = (1_000e18 * 10_001) / 10_000
           = 10_001_000_000_000_000_000_000_000 / 10_000
           = 1_000.1e18
           = 1_000_100_000_000_000_000_000

netAmount  = 1_000e18 - 1_000.1e18
           = -0.1e18                              <-- negative in a uint256
           -> Panic(0x11) arithmetic underflow, checked math in >=0.8.0
```

Both are *total* failures, not partial ones: the result is independent of `amount`
(for `feeBps == 10_000`, `fee == amount` for every `amount`; for `feeBps > 10_000`,
`fee > amount` for every `amount >= 1`). That is exactly what ops saw — not "some
deposits failed", but every single deposit reverting until redeploy. No user could
route around it, and because the setter itself still worked, the owner could in
principle have fixed it by calling `setDepositFee` again with a sane value; the fact
that you redeployed suggests nobody realised the setter was the culprit, which is its
own argument for reverting at the setter instead of failing later in `deposit`.

## 4. The technique that would have caught it

**Fuzz the setter's input domain, not just the fee arithmetic** — property-based testing
with the administratively-settable parameter as a fuzzed argument, backed by boundary
value analysis at `BPS_DENOMINATOR`.

The decisive test is: *for any fee the owner is allowed to set, a normal deposit must
still succeed.* That is a property, and it makes the unwritten assumption executable.

```solidity
// The one test that finds it. Note feeBps is fuzzed over the FULL settable range,
// not the range the developer assumed.
function testFuzz_AnySettableFeeStillAllowsDeposits(uint256 feeBps, uint256 amount)
    public
{
    feeBps = bound(feeBps, 0, type(uint16).max); // deliberately past 10_000
    amount = bound(amount, 1e18, 1e24);

    vm.prank(owner);
    vault.setDepositFee(feeBps);                 // fails here once MAX_FEE_BPS exists

    deal(address(token), alice, amount);
    vm.startPrank(alice);
    token.approve(address(vault), amount);
    uint256 shares = vault.deposit(amount);      // today: reverts at feeBps >= 10_000
    vm.stopPrank();

    assertGt(shares, 0, "a settable fee must never brick deposits");
}
```

Foundry's fuzzer targets boundaries of the bound range and of integer types, so
`10_000`, `10_001` and `65_535` all get sampled within the default 256 runs; the
counterexample is shrunk and reported as a concrete `feeBps`.

Supporting layers, in order of value:

1. **Boundary value analysis, written explicitly.** Fuzzing finds it; explicit boundary
   cases document it and stop regressions:
   `test_SetFee_At9999_Ok`, `test_RevertWhen_SetFee_At10000`,
   `test_RevertWhen_SetFee_At10001`, `test_RevertWhen_SetFee_AtMaxUint`.
   The rule of thumb the original suite missed: for any comparison against a constant,
   test `n-1`, `n`, `n+1` — 0/10/25 are all "typical value" tests and no boundary test
   exists among them.
2. **Invariant testing with the admin function in the handler.** Most vault invariant
   suites only expose `deposit`/`withdraw` to the fuzzer. Put `setDepositFee` in the
   handler and assert `invariant_DepositsAlwaysPossible()`; that catches the whole
   family of "config value bricks the protocol" bugs, not just this one.
3. **Negative tests on admin setters as a policy.** Every `onlyOwner` setter deserves
   two tests: a non-owner is rejected (you had this), *and* an out-of-range value is
   rejected (you did not). Access control and input validation are independent
   defences; the suite tested one and assumed the other.

## 5. The fix

Validate at the setter, where the bad value enters and where the failure is cheap and
legible, rather than discovering it later in every user's `deposit`:

```solidity
uint256 public constant MAX_FEE_BPS = 1_000; // 10% ceiling, pick your policy

error FeeTooHigh(uint256 requested, uint256 max);

function setDepositFee(uint256 newFeeBps) external onlyOwner {
    if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh(newFeeBps, MAX_FEE_BPS);
    uint256 previousFeeBps = depositFeeBps;
    depositFeeBps = newFeeBps;
    emit DepositFeeUpdated(previousFeeBps, newFeeBps);
}
```

A cap strictly below `BPS_DENOMINATOR` is better than `<= BPS_DENOMINATOR`: a 100% fee
is never a legitimate configuration, and the ceiling also serves as a governance
guarantee to depositors. Note that this change *adds a branch*, which is the other
reason the original coverage number was misleading — the code had no branch to miss,
because the safety check that should have been there did not exist.

**The lesson in one line:** coverage tells you which code ran; only fuzzing and boundary
analysis tell you which *values* ran, and bugs in unvalidated inputs live entirely in
the values.
