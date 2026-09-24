# Why 100% coverage missed the fee-setter bug

## 1. The bug, stated precisely

`setDepositFee` accepts **any** `uint256`. There is no upper bound, and nothing
downstream tolerates one. The fee is applied as

```solidity
uint256 fee = (amount * depositFeeBps) / BPS_DENOMINATOR;  // BPS_DENOMINATOR = 10_000
uint256 netAmount = amount - fee;
shares = convertToShares(netAmount);
if (shares == 0) revert NoSharesMinted();
```

`depositFeeBps` is only meaningful on the interval `[0, 10_000]`. Once ops stored a
value at or above `10_000`, `deposit()` became unconditionally unusable — not for
some amounts, for **all** of them. That is exactly the observed symptom: every
deposit reverted until redeploy. The setter "has no bug" in the sense that it stores
what it is given; the bug is the **missing precondition** — the setter's contract is
narrower than its signature, and nothing enforces the difference.

## 2. The arithmetic for the inputs that break it

### Case A — `depositFeeBps == 10_000` (exactly 100%)

Take a 1,000 token deposit, 18 decimals: `amount = 1_000e18`.

```
fee       = (1_000e18 * 10_000) / 10_000 = 1_000e18      // the entire deposit
netAmount = 1_000e18 - 1_000e18         = 0
shares    = convertToShares(0)          = 0
           -> revert NoSharesMinted()
```

The multiplication is scale-invariant, so this is amount-independent: for every
`amount`, `fee == amount`, `netAmount == 0`, `shares == 0`, revert. A 1 wei deposit
and a 10,000,000 token deposit fail identically. **Total denial of deposits, no
partial service, no error message that points at the fee.** The revert reason blames
share minting, which is why the cause was not obvious from the failing txs.

### Case B — `depositFeeBps > 10_000`, e.g. `10_001` or the classic `100_000`

With `amount = 1_000e18` and `depositFeeBps = 10_001`:

```
fee       = (1_000e18 * 10_001) / 10_000 = 1_000.1e18
netAmount = 1_000e18 - 1_000.1e18        -> underflow
           -> Panic(0x11) arithmetic overflow/underflow (Solidity >=0.8)
```

`fee > amount` whenever `depositFeeBps > 10_000` (ignoring the floor division, which
only shaves sub-wei dust), so `amount - fee` underflows and reverts with a bare
panic — even less diagnostic than Case A.

The realistic ops slip that lands here: intending "1%" and typing the *percentage
scaled wrong*. 1% is `100` bps. Entering `10000` (reading "100 = 1%, so 10000 =
100%… of a percent?") or pasting a 1e4-scaled WAD-style number gives exactly Case A.
Entering `1e18` — a fee expressed in WAD because every other number in the codebase
is WAD — gives Case B with `fee` astronomically larger than `amount`.

### Case C — the silent near-miss (still uncaught, still live)

Even *below* the boundary the pair is under-specified. At `depositFeeBps = 9_999`
and a small deposit of `amount = 5_000 wei`:

```
fee       = (5_000 * 9_999) / 10_000 = 4_999 (floor)
netAmount = 5_000 - 4_999            = 1 wei
shares    = convertToShares(1)       = 0   // rounds down against a grown share price
           -> revert NoSharesMinted()
```

Here deposits fail for small amounts and succeed for large ones — an amount-dependent
threshold that no fixed-value test will find either.

## 3. Why the suite passed, and why coverage was never going to help

The suite exercised four points: `0`, `10`, `25` bps, the event, and `onlyOwner`.

**They are all the same test.** `0`, `10` and `25` are three samples drawn from one
equivalence class: *small, valid, well inside the domain*. They differ in value but
not in **behaviour class** — each one produces `fee < amount`, `netAmount > 0`,
`shares > 0`, no revert. Three samples from one class give you the confidence of one
sample, not three. The classes that were never sampled at all:

| Class | Representative | Never tested |
|---|---|---|
| Valid, low | 0, 10, 25 | ✅ tested (3×, redundantly) |
| Valid, at the ceiling | 10_000 − 1 = 9_999 | ❌ |
| **Boundary: exactly 100%** | **10_000** | ❌ — Case A |
| **Invalid: above 100%** | **10_001 … type(uint256).max** | ❌ — Case B |
| Interaction: high fee × tiny amount | 9_999 × 5_000 wei | ❌ — Case C |

Every value that breaks the vault lives in the bottom three rows. None of `0`, `10`,
`25` could ever have reached them: they are all ≤ 25, and the failure mode does not
begin until 9_999–10_000. There is no continuity argument that gets you from 25 to
10_000 — the function is well-behaved everywhere below the boundary and catastrophic
at it, so testing three points on the safe side tells you nothing about the cliff.

**Why 100% coverage is not evidence of anything here.** `forge coverage` measures
*lines and branches executed*, i.e. a property of the **code**, not of the **input
space**. `setDepositFee` is straight-line: three statements, one path, zero branches.
Any single call with any single argument — including `setDepositFee(0)` — marks 100%
of its lines covered. Coverage saturates after one test and then stays at 100% no
matter how wrong the argument is. Same for the deposit arithmetic: the fee lines are
unconditional, so a 10 bps deposit covers exactly the same lines a 10_000 bps deposit
would.

Worse, the defect is a **missing** statement — the absent
`require(newFeeBps <= MAX_FEE_BPS)`. Coverage can only report on code that exists; it
is structurally blind to code you failed to write. A line that was never authored
cannot be an uncovered line. So the metric reads 100% precisely *because* the guard is
missing, which is the exact opposite of the signal you want. **100% line coverage is a
statement about which lines ran, never about which values ran through them.**

## 4. The technique that would have caught it

**Fuzz / property-based testing of the setter–deposit pair, backed by boundary-value
analysis, and enforced with an invariant test.** Primary tool: Foundry's built-in
fuzzer.

The move is to stop asserting *outputs for chosen inputs* and start asserting a
*property over all inputs*:

```solidity
/// Property: whatever the owner sets, a normal deposit must still work.
function testFuzz_feeNeverBricksDeposits(uint256 newFeeBps, uint256 amount) public {
    amount = bound(amount, 1e6, 1_000_000e18);

    vm.prank(owner);
    vault.setDepositFee(newFeeBps);          // unbounded on purpose

    deal(address(token), alice, amount);
    vm.prank(alice);
    uint256 shares = vault.deposit(amount);  // must not revert
    assertGt(shares, 0, "deposit produced no shares");
}
```

Against the current code this fails within a handful of runs. Foundry's fuzzer does
not sample uniformly — it deliberately biases toward boundary and extremal values
(`0`, `1`, `type(uint256).max`, and values near constants it finds in the bytecode),
so `10_000` and "absurdly large" are among the *first* things it tries, not the last.
Uniform sampling would find it too, just less directly: the failing region is
`[10_000, 2^256)`, which is essentially the entire `uint256` range — over 99.99…% of
inputs break the vault. The only reason the suite survived is that a human hand-picked
three neighbouring values from the vanishingly small safe interval.

Two things to pair with it:

1. **Boundary-value analysis** as the manual discipline that tells you *which* fixed
   tests to write once the fuzzer names the boundary: test `9_999`, `10_000`,
   `10_001` explicitly, plus `type(uint256).max`, and keep them as regression tests.
   The rule: for any bounded parameter, test at the bound, one below, one above. The
   old suite tested three values that share a neighbourhood; BVA tests values that
   share a *frontier*.
2. **Invariant testing** for the ops scenario specifically. Add a handler that lets
   the fuzzer call `setDepositFee` with arbitrary values interleaved with deposits and
   withdrawals, and assert the system-level invariant *"the vault always accepts a
   deposit of ≥ 1e6 tokens"*. This models exactly what happened — a privileged config
   change mid-life bricking an unrelated user path — which a unit test of the setter
   in isolation cannot express, because the failure is in the **coupling** between
   the two functions, and both functions individually do exactly what they say.

Secondary, if you want a metric that would have flagged this where coverage did not:
**mutation testing**. A mutant that deletes a bounds check is the canonical mutation;
since there is no check to delete, the closest signal is that mutating
`depositFeeBps = newFeeBps` to `depositFeeBps = newFeeBps * 1000` survives the entire
suite — a surviving mutant is the alarm that 100% coverage refused to raise.

## 5. The fix

```solidity
uint256 public constant MAX_FEE_BPS = 1_000;  // 10% ceiling — pick a policy number,
                                              // not 10_000; 100% is never a valid fee

error FeeTooHigh(uint256 newFeeBps, uint256 maxFeeBps);

function setDepositFee(uint256 newFeeBps) external onlyOwner {
    if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh(newFeeBps, MAX_FEE_BPS);
    uint256 previousFeeBps = depositFeeBps;
    depositFeeBps = newFeeBps;
    emit DepositFeeUpdated(previousFeeBps, newFeeBps);
}
```

Cap at a **policy** maximum, not at `BPS_DENOMINATOR`. Bounding at `10_000` only
converts Case B into Case A; it does not make a 100% deposit fee sane, and it leaves
Case C (`9_999` × dust deposits) fully live. A 10% ceiling makes the whole
catastrophic region unreachable, keeps `netAmount ≥ 0.9 * amount`, and fails the ops
typo loudly at the setter — where the operator is watching — instead of silently at
every user's deposit an hour later.

Keep the three original tests (they document intent), add the fuzz test, the invariant
handler, and explicit `9_999 / 10_000 / 10_001 / type(uint256).max` boundary cases.
Coverage will still read 100%. It just will not be the reason you trust the code.
