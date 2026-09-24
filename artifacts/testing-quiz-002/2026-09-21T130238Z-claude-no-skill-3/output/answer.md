# Why 100% coverage missed the fee that bricked deposits

## 1. What actually broke

`setDepositFee` has no upper bound. `depositFeeBps` is a `uint256` and the setter accepts
any value in `[0, 2^256-1]`. `deposit()` then computes

```
fee       = amount * depositFeeBps / 10_000
netAmount = amount - fee
shares    = convertToShares(netAmount)
if (shares == 0) revert NoSharesMinted();
```

There is a hard cliff at `depositFeeBps == 10_000` (100%), and every value at or above it
makes `deposit()` revert for *every* caller and *every* amount:

- **`depositFeeBps == 10_000`** → `fee == amount` → `netAmount == 0` → `shares == 0` →
  `revert NoSharesMinted()`.
- **`depositFeeBps > 10_000`** → `fee > amount` → `amount - fee` underflows → Solidity
  ≥0.8 checked arithmetic reverts with `Panic(0x11)` before your custom error is ever
  reached.

Neither state is recoverable from the outside by depositors — only the owner can move the
number back, and you redeployed instead. The setter is, as you say, bug-free in the sense
that it stores what it is handed. The defect is the *absence of a domain constraint*: a
missing `require(newFeeBps <= MAX_FEE_BPS)`. Missing code is exactly the category of
defect that coverage is structurally incapable of reporting — you cannot fail to cover a
line that does not exist.

### The arithmetic, concretely

Assume a fresh vault, `totalAssets == totalSupply` so `convertToShares(x) == x`, and a
1,000-token deposit: `amount = 1_000e18 = 1_000_000_000_000_000_000_000`.

**Case A — the exact boundary, `depositFeeBps = 10_000`:**

```
fee       = 1_000e18 * 10_000 / 10_000
          = 10_000_000e18 / 10_000
          = 1_000e18
netAmount = 1_000e18 - 1_000e18 = 0
shares    = convertToShares(0) = 0
          → revert NoSharesMinted()
```

**Case B — ops types a percentage into a bps field, `depositFeeBps = 50_000` (they meant
"5%", the field wanted `500`):**

```
fee       = 1_000e18 * 50_000 / 10_000
          = 50_000_000e18 / 10_000
          = 5_000e18
netAmount = 1_000e18 - 5_000e18
          → 1e21 - 5e21 < 0, uint256 subtraction underflow
          → revert Panic(0x11) [arithmetic underflow]
```

Note the second case is amount-independent: `fee = amount * k / 10_000` with `k > 10_000`
gives `fee > amount` for any `amount` large enough that the division does not truncate to
`amount` itself — i.e. for every economically meaningful deposit. That is your "every
single deposit reverted."

There is also a softer, partial version of the same failure you should know about: for
`10_000 > depositFeeBps` but very large, or for dust deposits, `convertToShares(netAmount)`
can round down to 0 and revert `NoSharesMinted()` for small depositors while whales still
succeed. Same root cause, quieter symptom, and it is the one that will bite you next.

## 2. Why 100% coverage said nothing

Line/statement coverage answers one question: *was this line executed by at least one
test?* It says nothing about *which values* flowed through it.

`setDepositFee` is straight-line code — cyclomatic complexity 1 inside the body, with the
only branch living in the `onlyOwner` modifier. **A single call with a single argument
drives it to 100% line and 100% branch coverage.** Your `setDepositFee(10)` test alone
saturates the metric; the tests at 0 and 25 add exactly zero coverage information. The
same is true in `deposit()`: one successful deposit executes all four lines of the fee
path, so the metric was already maxed out before any of the interesting values were
considered.

So coverage measured *reachability of code* and reported 100%. The bug lives in the
*partitioning of the input domain*, which coverage does not model at all. The metric was
green and correct; it was simply answering a different question than the one you needed
answered.

## 3. The class of input never tried

Every value the suite used — **0, 10, 25** — comes from one equivalence class:
*"economically sensible fees, far below the 100% boundary."* Three samples from one class
give you the information content of one sample. The suite never tried:

- **the boundary itself**: `10_000` (`fee == amount`, `netAmount == 0`)
- **just below / just above it**: `9_999`, `10_001`
- **beyond it**: `50_000`, `type(uint256).max` (underflow / overflow territory)
- **the unit-confusion class**: percent-shaped input (`5`, `100`) in a bps-shaped field,
  and its inverse
- **the cross-product**: fee value × deposit amount, including dust amounts where
  `convertToShares` truncates to zero

And critically: the four tests are all *unit* tests of `setDepositFee` and `deposit()` in
isolation. None of them tested the **composition** — "after any `setDepositFee` the owner
is allowed to make, does `deposit()` still work?" That composed property is the thing ops
violated, and no amount of per-function coverage can express it.

Why those four values could never have found it: `0`, `10`, and `25` all satisfy
`newFeeBps << 10_000`, so `fee << amount`, so `netAmount > 0`, so `shares > 0`. The
failing predicate is `newFeeBps >= 10_000`; the tests sampled only the region where it is
false. The only-owner test exercises the access-control branch, which is orthogonal — it
proves *who* may call the setter, never *what* they may pass. A test suite can only find a
bug in the region of the input space it visits, and all four points sit inside the same
safe region.

## 4. The technique that would have caught it

**Property-based (fuzz) testing of the setter, plus an invariant test over the
setter/deposit pair.** Both are built into Foundry; you already have the toolchain.

### 4a. Fuzz the setter → deposit composition

```solidity
function testFuzz_depositSucceedsForAnyAcceptedFee(uint256 feeBps, uint256 amount) public {
    amount = bound(amount, 1e18, 1_000_000e18);

    vm.prank(owner);
    try vault.setDepositFee(feeBps) {
        // If the setter accepted it, deposits MUST still work.
        deal(address(token), alice, amount);
        vm.startPrank(alice);
        token.approve(address(vault), amount);
        uint256 shares = vault.deposit(amount);   // must not revert
        vm.stopPrank();
        assertGt(shares, 0, "accepted fee bricked deposits");
    } catch {
        // Rejecting an out-of-range fee is the correct behaviour.
    }
}
```

This fails on the very first run. The fuzzer draws from the whole `uint256` range and
deliberately biases toward boundary values (`0`, `1`, `type(uint256).max`, and powers of
two), so it hits `feeBps >= 10_000` almost immediately, and Foundry's shrinker will hand
you a minimal counterexample near `10_000`. Then you add the missing guard:

```solidity
uint256 public constant MAX_FEE_BPS = 1_000;   // 10%, pick your policy

function setDepositFee(uint256 newFeeBps) external onlyOwner {
    if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh(newFeeBps, MAX_FEE_BPS);
    ...
}
```

and the property flips to passing via the `catch` arm — the test now *documents* the
constraint rather than asserting a magic number.

### 4b. The stateful invariant that generalises it

Register `setDepositFee` and `deposit` as handlers and assert, after any sequence of owner
and user actions:

```solidity
function invariant_depositsNeverBricked() public {
    assertLe(vault.depositFeeBps(), vault.MAX_FEE_BPS());
}
```

This is the durable statement of what ops actually assumed: *no reachable owner action can
put the vault into a state where deposits are impossible.* It keeps holding as you add the
next fee, the next setter, the next role.

### 4c. Cheap supporting practice: boundary-value analysis

Independently of fuzzing, the manual discipline that finds this in about thirty seconds is
boundary-value analysis: for any parameter, enumerate the equivalence classes and test the
edge of each one — `MAX_FEE_BPS`, `MAX_FEE_BPS + 1`, `10_000`, `10_001`,
`type(uint256).max` — rather than three samples from the comfortable middle. Fuzzing is
strictly better because it does not depend on you correctly guessing where the boundaries
are, but explicit boundary tests are worth writing anyway: they are fast, deterministic,
and serve as regression anchors for the exact values that once broke production.

## 5. The one-line takeaway

Coverage tells you which code ran. It cannot tell you which code is missing, and it cannot
tell you that every value you tried came from the same equivalence class. Fuzzing and
invariant tests search the input space instead of the source text, which is where this bug
lived.
