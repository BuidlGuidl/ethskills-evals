# Why 100% coverage missed the fee that bricked deposits

## 1. What actually broke

`setDepositFee` has no upper bound. It accepts any `uint256`, including values at or
above `BPS_DENOMINATOR` (10 000). Once `depositFeeBps >= 10_000`, the fee consumes the
entire deposit, so *every* call to `deposit()` reverts regardless of amount, caller or
vault state. The setter is, as you say, faithful — the missing bound is the bug, and it
is only observable in a *different* function than the one that was changed.

## 2. The arithmetic

`BPS_DENOMINATOR = 10_000`. Take a normal deposit of `amount = 1_000e18`.

**Case A — the exact limit, `newFeeBps = 10_000`:**

```
fee       = (1_000e18 * 10_000) / 10_000 = 1_000e18
netAmount = 1_000e18 - 1_000e18         = 0
shares    = convertToShares(0)          = 0
          -> revert NoSharesMinted()
```

**Case B — the first value beyond it, `newFeeBps = 10_001`:**

```
fee       = (1_000e18 * 10_001) / 10_000 = 1_000.1e18
netAmount = 1_000e18 - 1_000.1e18       -> underflow
          -> revert Panic(0x11) (arithmetic over/underflow)
```

Note the two cases fail through **different paths**: 10 000 reverts with your custom
error, 10 001 reverts in the compiler's checked-arithmetic. A test that only pinned
"deposits revert above the cap" would have conflated them; they are separate evidence
and deserve separate assertions.

The plausible ops input: a promotion re-tune where someone typed a percentage into a
basis-points field (`100` meaning 100% → harmless 1%, or `10_000` meaning "100.00"
→ total brick), or a fat-fingered extra zero on `1_000` → `10_000`. Nothing in the
setter pushes back.

## 3. The class of input the suite never tried

The suite tested **0, 10, 25 bps** — plus the event and the `onlyOwner` check. Every one
of those is a hand-picked value from deep inside the *intended* operating range. The
domain of `newFeeBps` is the whole of `uint256`; the suite sampled four points from the
first 0.25% of the semantically "sane" part of it and nothing else.

Specifically, it never tried:

- values **at the denominator boundary** (9 999 / 10 000 / 10 001),
- values **beyond** it (the entire rest of `uint256`),
- **any value at all fed forward into `deposit()`** — the fee tests asserted fee maths,
  the setter tests asserted storage, and nothing composed `setDepositFee(x)` then
  `deposit(y)`.

Why the four values could never have found it: 0, 10 and 25 bps all satisfy
`fee < amount` for every non-dust amount, so they all walk the *same* branch —
`netAmount > 0`, shares minted, no revert. They differ numerically but are
behaviourally identical. The failure lives on the other side of a boundary none of
them approaches. The `onlyOwner` test constrains *who* may call, never *what* they may
pass, which is exactly the axis that failed: ops was correctly authorised.

And this is precisely what coverage cannot see. Line coverage records that
`depositFeeBps = newFeeBps;` executed. That line executes identically for 25 and for
10 000 — the storage write is the same opcode either way. Coverage measures which lines
*ran*, never whether an assertion *could have failed*, so 100% here means "we called
both functions", not "we searched their inputs". A setter that stores an unvalidated
number reaches 100% coverage from a single call, forever.

There is also a mirror-the-implementation smell in the suite: asserting
`depositFeeBps == newFeeBps` after the write constrains nothing — it re-states the
assignment. The property worth asserting is about the vault's behaviour *after* the
write, not the write itself.

## 4. The technique that would have caught it

**Fuzz the setter's domain and carry the result into `deposit()`** — every
owner-settable number that feeds value math gets fuzzed across its whole accepted
domain with `bound()`, not sampled from by hand.

```solidity
function testFuzz_feeUpdateNeverBricksDeposits(uint256 feeBps, uint256 amount) public {
    feeBps = bound(feeBps, 0, 10_000);      // the domain the setter ACCEPTS today
    amount = bound(amount, 1e18, 1_000_000e18);

    vm.prank(owner);
    vault.setDepositFee(feeBps);

    deal(address(asset), alice, amount);
    vm.startPrank(alice);
    asset.approve(address(vault), amount);
    vault.deposit(amount);                  // property: a funded, non-dust deposit
    vm.stopPrank();                         // always succeeds after any accepted fee
}
```

The fuzzer walks straight to `feeBps = 10_000` and the run goes red with
`NoSharesMinted()` — before ops ever touches the dial. Widen the `bound` to
`type(uint256).max` and it finds the underflow too. The property under test is the one
that actually matters: *any fee the setter accepts must leave the vault usable.* That
is a statement the four hand-picked values are structurally incapable of making.

Two supporting pieces:

- **Explicit boundary cases**, once the cap exists. Decide first which values are
  *semantically* usable — for a deposit fee, 10 000 is not, even though the subtraction
  survives it — then exercise the nearest valid value, the exact limit, and the first
  value beyond, asserting the distinct revert reasons of Cases A and B above.
- **A handler-driven invariant**, since a vault is stateful. Put `setDepositFee` in the
  handler's call surface alongside `deposit`/`withdraw`, and state
  `deposits are possible` / `recorded assets == assets held` as invariants. The fuzzer
  then generates exactly the sequence ops performed — retune, then deposit — which no
  amount of testing `setDepositFee` in isolation can reach. Check the calls/reverts
  stats: a near-100% revert rate would mean the run proved nothing.

Note what is *not* the fix: reading the code, spotting the missing bound, and writing
one regression test for `feeBps = 10_000`. That confirms the defect you already found
and stops there. The fuzz run is the search.

## 5. The code fix

```solidity
uint256 public constant MAX_DEPOSIT_FEE_BPS = 1_000; // 10%, a policy ceiling

error FeeTooHigh(uint256 requested, uint256 max);

function setDepositFee(uint256 newFeeBps) external onlyOwner {
    if (newFeeBps > MAX_DEPOSIT_FEE_BPS) revert FeeTooHigh(newFeeBps, MAX_DEPOSIT_FEE_BPS);
    uint256 previousFeeBps = depositFeeBps;
    depositFeeBps = newFeeBps;
    emit DepositFeeUpdated(previousFeeBps, newFeeBps);
}
```

Pick the ceiling from policy, not from arithmetic — `<= 10_000` merely moves the brick
to the exact limit, and `< 10_000` still lets a 99.99% fee round small deposits to zero
shares. The fuzz test above then bounds to `MAX_DEPOSIT_FEE_BPS` and becomes a standing
guarantee rather than a bug report.
