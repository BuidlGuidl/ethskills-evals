# Why 100% coverage missed the fee bricking

## Short version

`setDepositFee` has no upper bound. Coverage measures *which lines ran*, not *which
values ran through them*. Every test picked a fee from the same small, sane
equivalence class (`0 < f << 10_000`), and no test ever composed the two functions —
set a fee, then deposit with it. The bug lives in the *gap between* the setter and
`deposit()`, and there is no line of code in that gap to cover.

---

## 1. Why coverage was 100% and still told you nothing

`forge coverage` is a *structural* metric. Both functions are straight-line code —
no `if`, no `require`, no branch in the setter at all:

```solidity
uint256 previousFeeBps = depositFeeBps;   // hit
depositFeeBps = newFeeBps;                // hit
emit DepositFeeUpdated(...);              // hit
```

One call with *any* argument marks all three lines green. `setDepositFee(10)` and
`setDepositFee(type(uint256).max)` produce **identical coverage output**. The metric
literally cannot distinguish the safe input from the fatal one, because the
distinction was never encoded as a branch. Coverage rewards you for the check you
*wrote*; it is silent about the check you *didn't* write. A missing validation is
invisible to every structural coverage tool by construction.

Same story in `deposit()`: 0, 10, and 25 bps all take the exact same path through
`fee = ...; netAmount = ...; shares = ...; if (shares == 0)`. Three tests, one path,
zero additional information after the first one.

## 2. The class of input never tried

**Fees at or above the denominator: `newFeeBps >= 10_000`** — i.e. 100% and up.
That is the entire interval `[10_000, 2^256-1]`, which is ~99.99999...% of the
input domain of `setDepositFee`, and it was never sampled once.

Two sub-classes, with different failure modes:

| Input class | `fee` vs `amount` | What deposit does |
|---|---|---|
| `f < 10_000` | `fee < amount` | works (tested) |
| `f == 10_000` | `fee == amount` → `net == 0` | `shares == 0` → `revert NoSharesMinted()` |
| `f > 10_000` | `fee > amount` | `amount - fee` underflows → `Panic(0x11)` |

Both are permanent and total: they don't depend on `amount`, on the caller, or on
vault state. *Every* deposit reverts, for *everyone*, until the fee is set back —
which ops evidently couldn't do from the promo runbook, hence the redeploy.

### Why 0, 10 and 25 could never have found it

Those three values are all drawn from **one equivalence class**: "fee strictly less
than the denominator." Within that class the code has no behavioural boundary, so
sampling it three times is the same experiment three times. Testing 0/10/25 for this
bug is like testing a `uint8` overflow with the inputs 1, 2 and 3.

The interesting points of the function are its **boundaries**, and the tests bracket
none of them:

```
0 ────── 10 ── 25 ──────────────────────────── 9_999 │ 10_000 │ 10_001 ─── 2^256-1
└─────── all three tests live here ───────────┘      ↑        ↑
                                            first failure   underflow
```

Boundary-value analysis says the values worth trying are `9_999`, `10_000`, `10_001`
and `type(uint256).max`. None appears in the suite.

The other two tests are structurally incapable of finding it for a different reason —
they assert the wrong kind of property:

- **The event test** asserts `DepositFeeUpdated(prev, new)` fires with the value that
  was passed. That is a *tautology test* — it re-asserts the assignment on the line
  above it. It is exactly as green when the value is 1,000,000 bps.
- **The onlyOwner test** asserts *who* may call, never *what* they may pass. Ops was
  the owner. Access control was working perfectly; it faithfully authorised the call
  that bricked the vault. Authorisation and validation are orthogonal, and the suite
  tested only the first.

And crucially: **no test called `setDepositFee` and then `deposit`.** The fee-maths
tests presumably set `depositFeeBps` in `setUp`/constructor or tested the arithmetic
directly. Each function was verified alone; the failure only exists in the
composition. Per-function unit tests structurally cannot catch a cross-function state
bug — the state written by A is only lethal when read by B.

## 3. The arithmetic

`BPS_DENOMINATOR = 10_000`. Take a normal 1,000-token deposit, `amount = 1_000e18 = 1e21`.

**Case A — ops enters `10_000` meaning "100% of the promo pool", or fat-fingers a 100% fee:**

```
fee       = (1e21 * 10_000) / 10_000 = 1e21
netAmount = 1e21 - 1e21              = 0
shares    = convertToShares(0)       = 0
          → revert NoSharesMinted()
```

**Case B — unit confusion in the dangerous direction.** Reading a percent as bps
merely under-charges (typing `5` for 5% yields 0.05%) — annoying, not fatal. The
lethal slip is scaling *up*: intending 10% and entering `100_000`, i.e. 10 × 10_000
instead of 10 × 100:

```
fee       = (1e21 * 100_000) / 10_000 = 1e22
netAmount = 1e21 - 1e22
          = 1e21 - 10e21   →  negative
          → Solidity 0.8 checked subtraction → revert Panic(0x11) (arithmetic underflow)
```

Note `1e22 > 1e21`: the fee is ten times the deposit. Underflow, every time, for
every `amount > 0`.

**Case C — the exact boundary, `f = 9_999`, still bad for small deposits:**

```
amount = 10_000 wei
fee       = (10_000 * 9_999) / 10_000 = 9_999
netAmount = 1
shares    = convertToShares(1) = 0    (any share price > 1 wei/share)
          → revert NoSharesMinted()
```

So even *within* the "valid" range there is a second, amount-dependent dust bug: high
fee + small deposit rounds `shares` to zero. Same technique below finds this one too;
the fixed-value tests never would, because they only used one comfortable `amount`.

## 4. The technique that catches it: fuzzing the composed path

Not "more unit tests" — you'd have to already suspect the bug to pick 10_000. The
technique is **fuzz testing over the full input domain, across both functions in one
test**, i.e. property-based testing rather than example-based.

```solidity
/// Fuzz the FULL uint256 domain — do NOT bound feeBps to a range you believe is valid.
/// Bounding it to [0, 10_000] would re-create the exact blind spot as a bug in the test.
function testFuzz_SetFeeThenDeposit(uint256 feeBps, uint256 amount) public {
    amount = bound(amount, 1e6, 1e30);        // realistic deposits
    // feeBps deliberately unbounded

    vm.prank(owner);
    vault.setDepositFee(feeBps);              // <-- fails here once the fix lands

    deal(address(token), alice, amount);
    vm.startPrank(alice);
    token.approve(address(vault), amount);
    vault.deposit(amount, alice);             // <-- fails here today
    vm.stopPrank();

    assertGt(vault.balanceOf(alice), 0, "deposit must mint shares");
}
```

Foundry finds a counterexample within a handful of runs and shrinks it to the minimal
input (`feeBps = 10_000`), printing it in the failure. Two properties are being
asserted that the old suite never stated:

- *the setter only ever accepts fees the vault can actually charge*, and
- *a valid deposit at any accepted fee mints non-zero shares*.

Two reinforcing layers worth adding:

**Boundary-value unit tests** — cheap, explicit, and they document intent:

```solidity
function test_RevertWhen_FeeExceedsMax() public {
    vm.prank(owner);
    vm.expectRevert(Vault.FeeTooHigh.selector);
    vault.setDepositFee(MAX_FEE_BPS + 1);
}
function test_FeeAtMaxIsAccepted() public { /* MAX_FEE_BPS */ }
function test_RevertWhen_FeeIsHundredPercent() public { /* 10_000 */ }
```

**A stateful invariant test** — this is the layer that models what actually happened
in production, because the handler can call `setDepositFee` and `deposit` in any
random order across a long sequence:

```solidity
// handler exposes setFee(uint256) and deposit(uint256), both fuzzed
function invariant_FeeIsAlwaysChargeable() public view {
    assertLe(vault.depositFeeBps(), vault.MAX_FEE_BPS());
}
function invariant_DepositsAlwaysPossible() public {
    // vault must never enter a state where a healthy deposit reverts
    assertTrue(_depositSucceeds(1_000e18));
}
```

That second invariant is the direct machine-checkable statement of "the vault stopped
accepting deposits" — the incident, written as a test.

## 5. The fix

The setter must reject what `deposit()` can't survive:

```solidity
uint256 public constant MAX_FEE_BPS = 1_000; // 10% ceiling — a business decision, not 10_000

error FeeTooHigh(uint256 provided, uint256 max);

function setDepositFee(uint256 newFeeBps) external onlyOwner {
    if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh(newFeeBps, MAX_FEE_BPS);
    uint256 previousFeeBps = depositFeeBps;
    depositFeeBps = newFeeBps;
    emit DepositFeeUpdated(previousFeeBps, newFeeBps);
}
```

`MAX_FEE_BPS` well below `10_000`, not equal to it: 10_000 is merely the point where
the maths breaks, and a 99% fee is an economic disaster that is still arithmetically
"valid." Bound to what the business will actually charge.

Note the side effect: adding the check adds a **branch**, so from now on coverage can
finally tell the two input classes apart — the revert path is a line that only an
out-of-range input reaches. The validation and its testability arrive together.

---

## The general lesson

Coverage answers *"did my tests execute this code?"* It never answers *"did my tests
execute this code with an input that matters?"* — and for a missing bounds check the
answer to the first is trivially yes while the second was never asked. Hand-picked
example values sample the developer's imagination; fuzzing samples the input domain,
including the region ops was always going to reach eventually. Anything an
unvalidated `uint256` can hold, treat as an input someone will one day supply.

Concretely, three habits would have prevented this:

1. **Never bound a fuzz input to the range you assume is valid** — that assumption is
   the thing under test.
2. **Test setter → user-path composition**, not each function in isolation; config
   bugs detonate somewhere else.
3. **Every `onlyOwner` setter needs a validation test, not just an authorisation
   test.** The owner is the most privileged caller and therefore the one most capable
   of bricking the system by accident.
