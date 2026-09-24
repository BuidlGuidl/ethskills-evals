# Why 100% coverage missed the fee bricking

## Short version

The bug is not in either function; it is in the **relationship between them**. `setDepositFee`
accepts any `uint256`, and `deposit()` assumes `depositFeeBps <= BPS_DENOMINATOR`. Nothing in the
code enforces that assumption, and nothing in the suite ever probed it, because every fee value the
suite used was hand-picked from the "sane" region.

`forge coverage` measures *which lines executed*, not *which inputs were tried*. Both functions are
straight-line code — no branch depends on the magnitude of `newFeeBps` — so a single call with
`feeBps = 10` marks 100% of the lines in both functions green. The remaining three cases add
coverage of exactly nothing. Line coverage saturates after the first test; the input space is
`2^256` wide and the suite sampled four points of it, all from the same side of the only boundary
that matters.

## The class of input never tried

**Out-of-domain / boundary values of the setter's parameter: `newFeeBps >= BPS_DENOMINATOR`.**

The valid domain of `depositFeeBps` is implicitly `[0, 10_000)` (arguably much tighter), but the
declared domain is `[0, 2^256-1]`. The tests only ever sampled `{0, 10, 25}` — i.e. `0%`, `0.1%`,
`0.25%`. Those four values could not have found it for a structural reason:

- All of them satisfy `fee < amount`, so they all take the *same* execution path through `deposit()`.
- There is no `if` on the fee magnitude, so no amount of "different but small" fee values can
  distinguish behaviours. They are not four test cases; they are one test case run four times with
  different constants.
- The failure only appears at `feeBps >= 10_000`, which is **400x** away from the largest value
  tested. No amount of nudging 25 → 30 → 50 gets you there. You have to cross a boundary the suite
  never acknowledged existed.

The event test and the `onlyOwner` test are orthogonal — they assert that the setter stores and
announces the number, which is precisely the behaviour that hurt you. The setter "has no bug" in
isolation; the missing test is a **cross-function / composed-state** test: *set a fee, then deposit*.
Every existing fee test asserted arithmetic in isolation, so `deposit()` was never executed with a
fee the owner had actually set through the setter.

## The arithmetic for the input that breaks it

`BPS_DENOMINATOR = 10_000`. Take `amount = 1_000e18` (1000 tokens).

### Case A — exactly 100%: `depositFeeBps = 10_000`

```
fee       = (1000e18 * 10_000) / 10_000 = 1000e18
netAmount = 1000e18 - 1000e18           = 0
shares    = convertToShares(0)          = 0
          -> revert NoSharesMinted()
```

Every deposit reverts, for every amount, with `NoSharesMinted` — the whole vault is closed to
deposits, exactly as ops observed. This is the classic units confusion: someone reaching for "1%"
or "100" and typing the full-scale number `10000`, or applying a percent-shaped value to a
bps-denominated field.

### Case B — above 100%: `depositFeeBps = 10_001`

```
fee       = (1000e18 * 10_001) / 10_000 = 1000.1e18
netAmount = 1000e18 - 1000.1e18         -> underflow
          -> Panic(0x11) arithmetic overflow/underflow
```

Same user-visible outcome (all deposits revert), different revert reason. Note the failure mode is
*worse* here: a raw panic, not your custom error, so the frontend can't even explain it.

### Case C — the near miss the tests also couldn't see: `depositFeeBps = 9_999`

```
amount    = 1e4 wei
fee       = (1e4 * 9_999) / 10_000 = 9_999
netAmount = 1
shares    = convertToShares(1)     = 0   (rounds down once the vault has accrued yield)
          -> revert NoSharesMinted()
```

A *partial* brick — large deposits work, small ones revert — which is the harder incident to
diagnose because the vault looks alive. Same root cause: no upper bound on the fee.

### The exact boundary

| `depositFeeBps` | `fee` vs `amount` | Result |
|---|---|---|
| `0 … 25` (tested) | `fee << amount` | works |
| `… 9_999` | `fee < amount` | works for large amounts, dust deposits revert (Case C) |
| **`10_000`** | `fee == amount` | **`NoSharesMinted` for every deposit** |
| `>= 10_001` | `fee > amount` | **`Panic(0x11)` underflow for every deposit** |

The cliff is a single value wide in the sense that crossing `10_000` changes behaviour from "works"
to "totally broken" — and the suite's maximum sample was `25`.

## The technique that would have caught it

**Fuzz testing the setter/deposit composition** (property-based testing over the *unrestricted*
parameter domain), backed by **boundary-value analysis** around `BPS_DENOMINATOR`.

The rule this violates: *any function that takes an unvalidated `uint256` from a privileged caller
must be fuzzed across its declared domain, not its intended domain.* Foundry would have found
`feeBps = 10_000` in well under 256 runs, because the fuzzer specifically biases toward boundary
constants it sees in the code.

```solidity
/// Property: whatever fee the owner is allowed to set, a reasonable deposit still mints shares.
function testFuzz_DepositSucceedsForAnySettableFee(uint256 feeBps, uint256 amount) public {
    feeBps = bound(feeBps, 0, type(uint16).max); // deliberately WIDER than the intended range
    amount = bound(amount, 1e6, 1e30);

    vm.prank(owner);
    vault.setDepositFee(feeBps);                 // if this is allowed to succeed...

    deal(address(token), alice, amount);
    vm.startPrank(alice);
    token.approve(address(vault), amount);
    uint256 shares = vault.deposit(amount);      // ...then this must not revert.
    vm.stopPrank();

    assertGt(shares, 0, "settable fee bricked deposits");
}
```

This fails immediately at `feeBps = 10_000`. The fix it forces is in the setter, not in `deposit()`:

```solidity
uint256 public constant MAX_DEPOSIT_FEE_BPS = 1_000; // 10%, a real economic ceiling

function setDepositFee(uint256 newFeeBps) external onlyOwner {
    if (newFeeBps > MAX_DEPOSIT_FEE_BPS) revert FeeTooHigh(newFeeBps, MAX_DEPOSIT_FEE_BPS);
    ...
}
```

Once the guard exists, the fuzz test above becomes a genuine invariant — bound `feeBps` to
`[0, MAX_DEPOSIT_FEE_BPS]` and the property "any settable fee leaves the vault depositable" is
proven across thousands of inputs rather than four. Add the explicit boundary units too, because
fuzzing tells you *that* it broke, not *what the contract should do*:

```solidity
function test_RevertWhen_FeeExceedsMax() public { /* MAX + 1 */ }
function test_AcceptsFeeAtExactMax()     public { /* MAX     */ }
```

**Supporting technique — invariant testing.** If the handler is allowed to call `setDepositFee`
with random values alongside `deposit`/`withdraw`, the invariant "a user with tokens and approval
can always deposit" (a liveness invariant, not just a solvency one) breaks on the sequence
`setDepositFee(>=10_000) -> deposit(...)`. That is the exact sequence ops executed in production.
Unit tests check one call; invariant tests check the *sequences*, which is where this bug lived.

## The takeaway

Coverage answers "did my tests run this line?" It cannot answer "did my tests run this line with a
value that matters?" For straight-line arithmetic there is no branch for coverage to reward you for
exploring, so 100% is the *baseline*, not evidence of thoroughness. Whenever an admin setter writes
a number that downstream arithmetic depends on, the test that matters is not "does it store the
number" but "for every number it will store, does the protocol still work" — and that is a fuzz
test, not a unit test.
