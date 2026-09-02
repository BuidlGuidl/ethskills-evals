# Why 100% coverage missed the fee that bricked deposits

## 1. The actual defect

`setDepositFee` has **no domain constraint**. `depositFeeBps` is a `uint256`, so its
declared domain is `[0, 2^256-1]`, but the only values `deposit()` can survive are
`[0, 9_999]` (and really `[0, MAX_SANE_FEE]`). The setter accepts the other
~10^77 values silently and turns the vault into a brick.

Note where the missing check lives: the setter's postcondition is not a property of
the setter at all — it's a **cross-function invariant** (`setDepositFee` must never
leave the vault in a state where `deposit()` reverts). Unit-testing each function in
isolation structurally cannot see it, no matter how many assertions you add.

## 2. Why coverage was 100% and told you nothing

`setDepositFee` is straight-line code: three statements, zero branches. **One** call
with **any** argument executes every line and every branch of it forever. Coverage
saturates on the first invocation and is then completely insensitive to the input
value — `setDepositFee(10)` and `setDepositFee(type(uint256).max)` produce byte-identical
coverage reports.

More fundamentally: **coverage measures execution of code that exists, not the absence
of code that should exist.** The bug is a missing `require`. There is no line for the
profiler to mark red, because the line was never written. You cannot have a coverage
hole in a guard you forgot. Coverage is a *necessary* signal (uncovered code is
definitely untested) but never a *sufficient* one.

Secondary factor: the tests were written from the implementation, by the same person,
with the same mental model. They assert what the code does, so they inherit exactly
the code's blind spots. Tests derived from an implementation cannot discover a
requirement the implementation never encoded.

## 3. The class of input never tried

Partition the setter's input domain by what happens downstream in `deposit()`:

| Class | `newFeeBps` | Effect on `deposit()` |
|---|---|---|
| A — no fee | `0` | net = amount, fine |
| B — sane fee | `1 … ~9_989` | net > 0, fine |
| C — dust-hostile | `~9_990 … 9_999` | works for large deposits, small deposits round to `shares == 0` |
| **D — total confiscation** | **`10_000`** | **`net == 0` → always `NoSharesMinted()`** |
| **E — over 100%** | **`10_001 … 2^256-1`** | **`amount - fee` underflows → `Panic(0x11)`** |

`0, 10, 25` are all in classes A and B. Three samples, **one equivalence class** —
the interior of the happy path. Every one of them satisfies `fee < amount`, which is
the precondition the whole thing hinges on, so all three exercise the identical
arithmetic path. Adding a fourth hand-picked "reasonable" value (50, 100, 250) adds
zero information; you can pick a thousand of them and never leave class B.

The event test and the `onlyOwner` test are orthogonal — they check *who* may call and
*what is emitted*, never *what values are legal*. Together the suite verifies the
setter is a correct assignment statement. It is. That was never the question.

The untried class is: **`newFeeBps >= BPS_DENOMINATOR`** — and, more generally, *any
value at or past a boundary*. The suite never touched a boundary at all.

## 4. Arithmetic for the inputs that break it

`BPS_DENOMINATOR = 10_000`. Take a normal deposit of 1,000 tokens at 18 decimals:
`amount = 1_000e18 = 10^21`.

**Case D — exactly 100% (`newFeeBps = 10_000`):**
```
fee       = (10^21 * 10_000) / 10_000 = 10^21
netAmount = 10^21 - 10^21           = 0
shares    = convertToShares(0)      = 0
→ revert NoSharesMinted()
```
Reverts for *every* `amount`, because `fee == amount` identically. No deposit size
escapes.

**Case E — just past 100% (`newFeeBps = 10_001`):**
```
fee       = (10^21 * 10_001) / 10_000 = 1.0001 * 10^21
netAmount = 10^21 - 1.0001*10^21      = -10^17   ← negative
→ Solidity 0.8 checked subtraction underflows → Panic(0x11)
```
(For tiny amounts the floor division hides the underflow but not the failure:
`amount = 5`, `fee = 5 * 10_001 / 10_000 = 50_005 / 10_000 = 5`, `net = 0` →
`NoSharesMinted()`. Both sub-cases revert, with two *different* revert reasons — a
test asserting only one of them still misses half the class.)

**Case E, the realistic ops keystroke — a WAD/bps unit mix-up.** Someone entering a
5% promo fee in 18-decimal fixed point types `0.05e18 = 5 * 10^16`:
```
fee       = (10^21 * 5*10^16) / 10^4 = 5*10^37 / 10^4 = 5 * 10^33
netAmount = 10^21 - 5*10^33          ← massively negative
→ Panic(0x11), every deposit, every size
```
This is the shape that matches the incident: *complete* and *immediate*, not
size-dependent. The transaction that caused it succeeded and emitted a perfectly
valid `DepositFeeUpdated` event, which is why nothing looked wrong until deposits
started failing. (For very large `amount` you'd instead panic one step earlier, in the
`amount * depositFeeBps` multiplication — same outcome, different opcode.)

**Case C, the quiet one you should also fix:** `newFeeBps = 9_999`, `amount = 10_000`
wei → `fee = 9_999`, `net = 1` → `convertToShares(1)` rounds to `0` →
`NoSharesMinted()`. Large deposits still work, small ones don't. A partial brick that
example-based tests are even worse at finding.

## 5. The technique that would have caught it

**Property-based (fuzz) testing over the setter's full declared domain, plus a
stateful invariant that spans both functions.** Foundry gives you both.

The fuzzer's job is exactly the one hand-picked examples can't do: sample the whole
`uint256` domain, including the values no human would type. It also biases toward
boundaries — `0`, `1`, `type(uint256).max`, and values near constants in the
contract — so `10_000` and `10_001` are among the first things it tries.

```solidity
// Property: any fee the owner is ALLOWED to set must leave the vault usable.
function testFuzz_feeNeverBricksDeposits(uint256 newFeeBps, uint256 amount) public {
    amount = bound(amount, 1e18, 1_000_000e18);

    vm.prank(owner);
    try vault.setDepositFee(newFeeBps) {
        // setter accepted it → deposit MUST still work
        deal(address(asset), user, amount);
        vm.prank(user);
        uint256 shares = vault.deposit(amount);   // fails today at newFeeBps = 10_000
        assertGt(shares, 0, "accepted fee bricked deposits");
    } catch {
        // rejecting the value is the acceptable outcome
    }
}
```

This fails on the very first run and prints the minimised counterexample
(`newFeeBps = 10_000`). Add the stateful version for the composition bug:

```solidity
// handler calls setDepositFee + deposit with fuzzed args; invariant holds across sequences
function invariant_depositsAlwaysAccepted() public {
    assertTrue(vault.previewDeposit(1e18) > 0);
}
```

Supporting techniques, in the order I'd add them:

1. **Boundary-value analysis** — the manual cousin. For any comparison against a
   constant, test `k-1, k, k+1`. Here: `9_999 / 10_000 / 10_001`. Cheap, deterministic,
   catches this specific bug without a fuzzer. Use it as the regression tests you commit
   after the fuzzer finds the counterexample.
2. **Mutation testing** — deleting a nonexistent guard can't be mutated, but mutation
   testing on the fee maths (`-` → `+`, `/` → `*`) exposes how weak three samples from
   one equivalence class really are, in a way coverage never will.
3. **Negative/rejection tests as a habit** — for every setter, ask "what is the
   *illegal* input, and does the setter reject it?" A setter with no `revert` path is a
   design smell on its own.

## 6. The fix

```solidity
uint256 public constant MAX_DEPOSIT_FEE_BPS = 1_000;   // 10% ceiling, well inside safe range

error FeeTooHigh(uint256 requested, uint256 max);

function setDepositFee(uint256 newFeeBps) external onlyOwner {
    if (newFeeBps > MAX_DEPOSIT_FEE_BPS) revert FeeTooHigh(newFeeBps, MAX_DEPOSIT_FEE_BPS);
    uint256 previousFeeBps = depositFeeBps;
    depositFeeBps = newFeeBps;
    emit DepositFeeUpdated(previousFeeBps, newFeeBps);
}
```

Cap well below `BPS_DENOMINATOR`, not at it — `10_000` is still a total-confiscation
setting, and class C (`9_990`–`9_999`) breaks small deposits even under a `< 10_000`
check. Then commit the boundary trio (`MAX`, `MAX+1`, `10_000`) and keep the fuzz
property in CI, so the next unit change can't reintroduce it.

## One-line summary

100% coverage proved every line that *exists* runs; it could not prove the line that
*should exist* is missing. Three fee values from a single equivalence class, none near
a boundary, never asked what happens when the fee reaches or exceeds 100% —
`fee == amount` gives `netAmount == 0 → NoSharesMinted()`, and `fee > amount`
underflows to `Panic(0x11)`. Fuzz/property testing over the full `uint256` domain,
with an invariant that couples the setter to `deposit()`, finds it on the first run.
