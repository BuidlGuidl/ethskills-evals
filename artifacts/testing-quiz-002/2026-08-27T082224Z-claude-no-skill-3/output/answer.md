# Why 100% coverage missed the fee bricking

## Short version

`depositFeeBps` has an implicit domain — `[0, BPS_DENOMINATOR)` — that is enforced
nowhere. The setter accepts the whole `uint256` range. Every test in the suite drew its
input from deep inside the valid region, so the suite proved the *happy* partition works
and said nothing about the other two. Coverage went to 100% anyway, because coverage
counts lines executed, not values tried.

## 1. Coverage measures the wrong thing

`setDepositFee` is three straight-line statements with no branch. **One** call with
**any** value marks it 100% covered. The other three tests (10 bps, 25 bps, the event, the
`onlyOwner` revert) add zero coverage to it — they're re-walking lines already walked.

Same for `deposit()`: the four lines are all executed on any successful deposit. The
`if (shares == 0) revert` arm was covered too — presumably by a dust-amount test — but
covering the *line* proves the guard fires, not that it can't fire for every caller at
once.

So the metric is saturated at exactly the point where the interesting behaviour begins.
100% line coverage here is achievable by a suite that tests one value. It is not evidence
of input-space exploration; it is evidence of code-path execution. The gap between those
two is where this bug lived.

## 2. The class of input never tried

Partition the input domain of `newFeeBps`:

| Partition | Range | Behaviour of `deposit()` | Tested? |
|---|---|---|---|
| A — normal fee | `0 .. 9_999` | works, fee < amount | yes (0, 10, 25) |
| B — total fee | `newFeeBps == 10_000` | `netAmount == 0` → `NoSharesMinted()` | **no** |
| C — over-unity fee | `> 10_000` | `amount - fee` underflows → panic `0x11` | **no** |

0, 10 and 25 are three samples from partition **A**. They are not three tests; they are
one test run three times with different decorations. Any value in A produces the same
control flow and the same qualitative result — a fee strictly less than `amount`, a
non-zero `netAmount`, shares minted. Adding a fourth, fifth, or five-hundredth value from
A cannot reach B or C, because reaching B or C requires crossing a boundary the suite
never approaches. The nearest tested value, 25, is 0.25% of the way to the cliff at
10_000.

The `onlyOwner` test is orthogonal — it constrains *who* may call, not *what* they may
pass. It is exactly the test that gives false confidence here: authorization was verified,
so the setter "felt" guarded, while the value domain was wide open.

Note also which function the bug lives in versus where it detonates. The defect is a
*missing precondition* in `setDepositFee`; the failure is a revert in `deposit()`, on a
later transaction, from a different caller. Unit tests scoped to one function per file
cannot see this — nothing in `setDepositFee`'s own test file is wrong.

## 3. The arithmetic

`BPS_DENOMINATOR = 10_000`. Take a normal deposit, `amount = 1_000e18`.

**Partition A, as tested — 25 bps:**

```
fee       = 1_000e18 * 25 / 10_000 = 2.5e18
netAmount = 1_000e18 - 2.5e18      = 997.5e18
shares    = convertToShares(997.5e18) > 0        -> succeeds
```

**Partition B — `setDepositFee(10_000)`:**

```
fee       = 1_000e18 * 10_000 / 10_000 = 1_000e18   // fee == amount
netAmount = 1_000e18 - 1_000e18       = 0
shares    = convertToShares(0)        = 0
                                       -> revert NoSharesMinted()
```

The revert is *amount-independent*: for any `amount`, `amount * 10_000 / 10_000 == amount`
exactly, so `netAmount` is always 0 and every deposit reverts. Not "large deposits" or
"dust deposits" — all of them. That matches the incident report: the vault stopped
accepting deposits completely.

**Partition C — `setDepositFee(10_001)`, e.g. a fat-finger or a units mix-up:**

```
fee       = 1_000e18 * 10_001 / 10_000 = 1_000.1e18   // fee > amount
netAmount = 1_000e18 - 1_000.1e18      -> underflow
                                        -> Panic(0x11) arithmetic overflow
```

Same user-visible outcome, different revert reason, and this one doesn't even reach the
`NoSharesMinted` guard.

A plausible route into C in practice is scale confusion: ops wanting "a 50% promo cut"
and typing `50` (correct as percent, = 0.5 bps) is harmless, but typing the percentage
where basis points are expected in the other direction — `100` meaning 100%, or `10000`
meaning "100.00%" — lands squarely on B. There is nothing in the setter, the event, or
the ABI to tell them apart.

Worth noting the near-miss inside partition A too: at 9_999 bps a deposit of
`amount = 1` gives `fee = 1 * 9_999 / 10_000 = 0` (floor), `netAmount = 1`, so it survives —
but at high fees, small deposits round `netAmount` down to a value where
`convertToShares` returns 0, reverting for *some* users. That's a partial-outage variant
of the same missing bound, and it also sits outside the tested region.

## 4. The technique that would have caught it

**Property-based / fuzz testing over the full input domain**, i.e. Foundry's `testFuzz_`,
backed by **boundary-value analysis** on `BPS_DENOMINATOR`.

The reason fuzzing is the right answer and not "add more unit tests" is that the failing
value is not one a human enumerating *sensible fees* would ever write down. A fuzzer does
not know 10_000 is sensible or not; it draws from `uint256` and, critically, Foundry's
dictionary biases toward boundary constants it observes in the contract — `0`,
`type(uint256).max`, and values near literals like `10_000`. The first run hits partition
C essentially immediately.

The test that finds it — a round-trip property rather than an assertion about the setter
in isolation:

```solidity
/// After ANY fee the owner is allowed to set, a normal deposit still mints shares.
function testFuzz_feeNeverBricksDeposits(uint256 feeBps, uint256 amount) public {
    amount = bound(amount, 1e18, 1_000_000e18);

    vm.prank(owner);
    vault.setDepositFee(feeBps);      // unbounded on purpose

    deal(address(asset), alice, amount);
    vm.prank(alice);
    uint256 shares = vault.deposit(amount, alice);

    assertGt(shares, 0, "fee config bricked deposits");
}
```

This fails on the first non-trivial `feeBps`, and Foundry shrinks the counterexample to
the minimal breaking input — `feeBps = 10_000`, which is precisely the incident. The
property is the one that actually matters and that no unit test stated: *no reachable
configuration makes the core entry point unusable*.

Two supporting techniques, in order of value:

- **Boundary-value analysis** as the cheap deterministic complement: once you notice
  `depositFeeBps` is compared against `BPS_DENOMINATOR`, the values to test are
  `9_999 / 10_000 / 10_001`, plus `0` and `type(uint256).max`. Fuzzing finds these for
  free; BVA is what you write in the regression suite afterwards so the fix stays fixed.
- **Stateful invariant testing**, with a handler that lets the fuzzer call
  `setDepositFee` with arbitrary values between deposits, asserting the invariant
  "a solvent, approved user can always deposit." This catches the whole family —
  any future admin setter that can drive the vault into an unusable state, not just this
  one.

Mutation testing is *not* the technique here, and it's worth saying why: there is no
guard to mutate. Mutation testing scores the assertions you have against the code you
wrote; this bug is code you *didn't* write. It would report the suite as strong.

## 5. The fix the test drives you to

```solidity
uint256 public constant MAX_DEPOSIT_FEE_BPS = 1_000; // 10%

error FeeTooHigh(uint256 feeBps, uint256 maxFeeBps);

function setDepositFee(uint256 newFeeBps) external onlyOwner {
    if (newFeeBps > MAX_DEPOSIT_FEE_BPS) revert FeeTooHigh(newFeeBps, MAX_DEPOSIT_FEE_BPS);
    uint256 previousFeeBps = depositFeeBps;
    depositFeeBps = newFeeBps;
    emit DepositFeeUpdated(previousFeeBps, newFeeBps);
}
```

Cap below `BPS_DENOMINATOR`, not at it: `<= 10_000` still permits the 100%-fee brick, and
`< 10_000` still permits a 99.99% fee that is economically identical to an outage. A
policy cap makes partition B and C both unreachable and turns the ops mistake into a
reverted transaction instead of a redeploy.

Then bound the fuzz test to the new domain (`feeBps = bound(feeBps, 0, MAX_DEPOSIT_FEE_BPS)`)
and add the deterministic boundary cases — including
`vm.expectRevert` at `MAX_DEPOSIT_FEE_BPS + 1` — so the guard itself is covered.

## Takeaway

Coverage answers "did this line run." It cannot answer "for which inputs is this line
correct," and for a straight-line setter storing an unvalidated parameter those two
questions have nothing to do with each other. Every value in the suite came from one
equivalence class; the bug lived in the two classes nobody sampled. The systematic fix is
to let a fuzzer choose the inputs, and to state properties about the *system* after the
call rather than assertions about the storage slot the call wrote.
