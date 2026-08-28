# Why 100% coverage missed the fee-setter bug

## Short version

`setDepositFee` has an unwritten precondition — `newFeeBps <= BPS_DENOMINATOR` — that is
enforced nowhere. `deposit()` is the thing that enforces it, and it enforces it by
reverting. Ops set a fee at or above 10 000 bps and the vault bricked.

The suite never found it because coverage measures *which lines ran*, not *which inputs
were tried*, and neither function branches on the fee value at all. Both functions are
straight-line code with respect to `newFeeBps`: one assignment, one event, one multiply,
one divide, one subtract. **A single test at any fee value whatsoever puts the line
counter at 100%.** The 0/10/25 bps tests added nothing to coverage that the first one
didn't already give you. The metric was saturated before the suite was finished, so it
could never have signalled the gap.

## The class of input that was never tried

The input domain of `newFeeBps` is `uint256` — all 2^256 values. The tests sample it in
exactly one equivalence class:

| class | representative | what the suite tried |
|---|---|---|
| `bps == 0` (no fee) | 0 | ✅ tested |
| `0 < bps < 10 000` (valid fee) | 10, 25 | ✅ tested |
| `bps == 10 000` (fee == 100%) | 10 000 | ❌ never |
| `10 000 < bps <= type(uint256).max / amount` | 10 001 | ❌ never |
| `bps > type(uint256).max / amount` | 2^255 | ❌ never |

0, 10 and 25 are three samples from the interior of the *same* class — "a plausible fee a
human would type". They differ only in magnitude, not in behaviour: all three take the
identical path through identical arithmetic and produce a positive `netAmount`. Adding a
fourth interior value (50, 100, 250 …) would have been just as blind. Interior samples
cannot find a missing boundary guard, because the guard is only reachable by values the
author had already dismissed as "nobody would do that" — which is precisely the set ops
drew from.

The fourth test — the `onlyOwner` check — is the suite's only *negative* test, and it is
about **who** may call the setter, not **what** they may pass. There is no test asserting
that `setDepositFee` **rejects** an out-of-range value. That test is the one that would
have failed on day one and forced the guard into existence.

There is a second, compounding gap: the two functions were tested **in isolation**. The
setter test asserts storage + event; the deposit tests assert maths at a fee that a
fixture assigned. No test composes them — `setDepositFee(x)` *then* `deposit(y)`. The bug
lives in the sequence, not in either function, so a per-function suite structurally cannot
see it. That is why "the setter has no bug" is true and irrelevant.

## The arithmetic

Take a normal deposit: `amount = 1000e18` (1000 tokens, 18 decimals), `BPS_DENOMINATOR = 10_000`.

**Working case, `depositFeeBps = 25` (what the tests do):**

```
fee       = (1000e18 * 25) / 10_000 = 25_000e18 / 10_000 = 2.5e18
netAmount = 1000e18 - 2.5e18        = 997.5e18
shares    = convertToShares(997.5e18) > 0                   → OK
```

**Break #1 — `depositFeeBps = 10_000` (fee == 100%):**

```
fee       = (1000e18 * 10_000) / 10_000 = 1000e18      // fee == amount
netAmount = 1000e18 - 1000e18           = 0
shares    = convertToShares(0)          = 0
                                        → revert NoSharesMinted()
```

Every deposit reverts, for every amount, because `fee == amount` identically for all
`amount` when `bps == 10_000`. Nothing about the caller's size saves them.

**Break #2 — `depositFeeBps = 10_001` (or anything above 10 000):**

```
fee       = (1000e18 * 10_001) / 10_000 = 10_001_000e18 / 10_000 = 1000.1e18
netAmount = 1000e18 - 1000.1e18         → underflow
                                        → Panic(0x11) arithmetic underflow
```

Solidity ≥0.8 checked arithmetic turns `amount - fee` into a panic. Same outcome: the
vault refuses all deposits, and the revert reason is now an opaque panic rather than a
named error, which is why it read as "the vault is broken" instead of "the fee is wrong".

**Break #3 — a fat-fingered huge value, e.g. `depositFeeBps = 2^255`:**

```
amount * depositFeeBps = 1000e18 * 2^255 > type(uint256).max
                                        → Panic(0x11) multiplication overflow
```

The revert moves one line earlier, to the multiply. Three distinct failure mechanisms,
one root cause.

The realistic ops input sits in break #1/#2 territory: someone running a promotion typed
the fee in the wrong unit — `50` meaning 50% (fine, it's 0.5%), or `100` meaning 100%
(fine), or more likely a percentage-shaped number scaled once too often, e.g. `5` → `50000`
— and the setter stored it without a murmur, emitting a perfectly correct
`DepositFeeUpdated` event on the way.

## The technique that would have caught it

**Boundary-value analysis on the setter's implicit domain, plus property-based (fuzz)
testing that composes the setter with `deposit`.** Concretely, three things, in order of
how cheaply they'd have caught it:

### 1. Boundary tests around 10 000 (would have caught it in five minutes)

Partition the domain, then test each boundary from both sides — `9_999`, `10_000`,
`10_001` — not three interior points:

```solidity
function test_setDepositFee_rejectsFeeAtOrAbove100Pct() public {
    vm.prank(owner);
    vm.expectRevert(FeeTooHigh.selector);
    vault.setDepositFee(10_000);          // fails today: the call succeeds
}

function test_depositStillWorksAtMaxFee() public {
    vm.prank(owner);
    vault.setDepositFee(9_999);
    vm.prank(user);
    assertGt(vault.deposit(1000e18), 0);
}
```

The first test fails against the current contract and cannot be made green without adding
the guard. Note the shape: it asserts a **revert on bad input**, which is the category of
test the suite has exactly zero of for this parameter.

### 2. Stateful fuzz over the (setter → deposit) pair

This is the one that finds bugs you didn't think to name. Foundry's fuzzer explicitly
biases toward boundary values (0, 1, `type(uint256).max`, values near powers of two), so
it hits 10 000-and-above almost immediately:

```solidity
function testFuzz_anyAcceptedFeeStillAllowsDeposits(uint256 bps, uint256 amount) public {
    amount = bound(amount, 1e18, 1_000_000e18);
    vm.prank(owner);
    try vault.setDepositFee(bps) {
        // if the setter accepted it, deposits MUST still work
        vm.prank(user);
        assertGt(vault.deposit(amount), 0);
    } catch {
        // rejecting the value is fine — that's the guard doing its job
    }
}
```

The property being stated is the one nobody wrote down: *any configuration the owner is
allowed to reach must leave the vault operational.* That is a safety property of the
config surface, and it generalises — it would also catch the next unbounded parameter
someone adds.

### 3. Invariant test with a handler

Register a handler that calls `setDepositFee(bps)` and `deposit(amount)` with fuzzed args,
and assert as an invariant `depositFeeBps < BPS_DENOMINATOR`, or better,
`vault.deposit(reasonableAmount)` never reverts. This is the version that scales to the
whole contract rather than to this one parameter.

## The fix

```solidity
uint256 public constant MAX_DEPOSIT_FEE_BPS = 1_000;   // 10%, a policy ceiling

error FeeTooHigh(uint256 feeBps, uint256 maxFeeBps);

function setDepositFee(uint256 newFeeBps) external onlyOwner {
    if (newFeeBps > MAX_DEPOSIT_FEE_BPS) revert FeeTooHigh(newFeeBps, MAX_DEPOSIT_FEE_BPS);
    uint256 previousFeeBps = depositFeeBps;
    depositFeeBps = newFeeBps;
    emit DepositFeeUpdated(previousFeeBps, newFeeBps);
}
```

Validate at the **setter**, not at `deposit()`. Both stop the bleeding, but only the setter
fails the transaction that is actually wrong, in front of the person who is actually able
to fix it. Pushing the check into `deposit()` converts one ops mistake into an outage for
every user. A policy ceiling well below 10 000 also makes the guard catch unit confusion
(`50000` for 5%) rather than merely catching total bricking.

## The generalisation

Coverage answers "did this line execute?" It cannot answer "was this input space
partitioned correctly?", and it goes to 100% on branch-free code after one input — so on
exactly the code where input-domain bugs hide, it is at its least informative. For any
owner-settable parameter, the questions coverage will never ask you are:

- What is the valid range, and is it enforced *in the setter*?
- What happens at each boundary of that range, from both sides?
- Is there a test asserting the setter **reverts** on out-of-range input?
- Is there a test that sets the parameter and *then* exercises the code that consumes it?

All four were "no" here, with the suite green and the coverage report at 100%.
