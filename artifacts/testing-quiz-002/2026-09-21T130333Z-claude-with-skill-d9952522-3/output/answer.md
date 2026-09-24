# Why 100% coverage missed the fee that bricked deposits

## What actually broke

`setDepositFee` accepts any `uint256`. Nothing bounds `newFeeBps` against
`BPS_DENOMINATOR`. Once ops stored a value at or above 10_000, every call to
`deposit()` reverted, for every caller and every amount, until redeploy.

The setter is, as you say, not buggy in the "does the wrong thing with its input"
sense. The defect is that the *domain of the input* is unbounded while
`deposit()` is only correct on part of it. That is a cross-function defect: it is
not observable in either function tested alone, only in the composition
`setDepositFee(x)` → `deposit(amount)`.

## The arithmetic

Take `amount = 1_000e18`, `BPS_DENOMINATOR = 10_000`.

**Largest still-usable fee — 9_999 bps**

```
fee       = 1_000e18 * 9_999 / 10_000 = 999.9e18
netAmount = 1_000e18 - 999.9e18       = 0.1e18   (> 0)
shares    = convertToShares(0.1e18)   > 0        -> deposit succeeds
```

**The exact numeric limit — 10_000 bps (the value that bricked the vault)**

```
fee       = 1_000e18 * 10_000 / 10_000 = 1_000e18
netAmount = 1_000e18 - 1_000e18        = 0
shares    = convertToShares(0)         = 0
                                       -> revert NoSharesMinted()
```

Note the shape of this: `fee` scales linearly with `amount`, so `netAmount` is
**identically zero for every input amount**. There is no deposit size that gets
through. That is exactly the "stopped accepting deposits completely" symptom.
10_000 is where `fee <= amount` still holds numerically, which is why it looks
like a legal limit — but it is not semantically usable, because a 100% fee mints
nothing. The last usable value is 9_999, not the round number.

**First value beyond the limit — 10_001 bps**

```
fee       = 1_000e18 * 10_001 / 10_000 = 1_000.1e18
netAmount = 1_000e18 - 1_000.1e18      -> arithmetic underflow
                                       -> Panic(0x11)
```

10_000 and 10_001 both brick deposits but through **different paths** —
a custom-error revert versus a solc panic — so they are separate pieces of
evidence and a fix must be checked against both. A guard written as
`newFeeBps <= BPS_DENOMINATOR` stops the panic and leaves the brick in place.

(A related, milder case lives just under the limit: at 9_999 bps a deposit of
1 wei floors to `fee = 0`, `net = 1`, but for other small amounts the fee floor
can leave a `netAmount` that `convertToShares` rounds to zero. Same class of
input — near-total fees — found by the same search.)

## Why the suite could not have found it

**0, 10 and 25 bps are one test case, not three.** Every value in that set
satisfies `0 <= feeBps << 10_000`, so all three produce `fee < amount`,
`netAmount > 0`, `shares > 0`. They traverse an identical path through identical
branches and differ only in the numeral that comes out the other end. They are a
single equivalence class sampled three times. Nothing in the set approaches the
boundary where the behaviour changes — the nearest is 25, a factor of 400 short.
No amount of additional hand-picked values from the same neighbourhood would have
helped; the search has to cover the *domain*, not more points inside one region
of it.

**The fee-maths tests assert the implementation back to itself.** Asserting that
a 25 bps fee on 1000 tokens yields 2.5 tokens re-runs `amount * bps / 10_000` in
the test and compares it to the contract doing the same. It restates the formula;
it cannot fail for any input where the formula is what you wanted. The setter
test is the purest form of this — store `newFeeBps`, read `depositFeeBps` back,
assert equality. That constrains nothing beyond "solc implements assignment,"
which is not your bug.

**The event and `onlyOwner` tests are orthogonal.** They check who may call and
what is announced. The failure was an authorised owner, with a correctly emitted
event, storing a value the rest of the contract cannot survive.

**Coverage is structurally incapable of seeing this.** Line coverage records
which lines executed. The defect here is a line that *does not exist* — the
missing bound check. There is no such thing as an uncovered absent line, so the
metric reads 100% precisely because the guard was never written. Coverage also
never asks whether an assertion *could* have failed; three tests that walk the
same path light up the same lines as three tests that walk three different ones.
100% on these two functions means "every statement ran at least once," which was
already true after the 0 bps test alone.

## The technique that would have caught it

**A bounded fuzz test over the full accepted domain of the setter, composed with
`deposit()`** — the setter's input fuzzed, not the deposit amount alone, and the
assertion made on `deposit()`, because the setter in isolation has no observable
failure.

```solidity
function testFuzz_FeeNeverBricksDeposits(uint256 feeBps, uint256 amount) public {
    feeBps = bound(feeBps, 0, type(uint16).max);   // the domain the setter ACCEPTS,
                                                   // not the domain you intended
    amount = bound(amount, 1e6, 1_000_000e18);

    vm.prank(owner);
    vault.setDepositFee(feeBps);

    // property: any fee the setter accepts must leave deposit() functional
    uint256 shares = vault.deposit(amount, alice);
    assertGt(shares, 0, "accepted fee bricked deposits");
}
```

Foundry reports the counterexample at `feeBps = 10_000` (or earlier, on the
rounding case) on the first run. The key move is `bound()` over the domain the
setter *accepts*, not the domain you assumed it would receive; `vm.assume` used
to filter out "unreasonable" fees would have discarded the exact bug.

Pair it with the explicit boundary triplet spelled out above — 9_999 / 10_000 /
10_001, asserted as success / `NoSharesMinted` / `Panic(0x11)` — as a named
regression test. The fuzzer performs the search; the triplet pins the three
outcomes so a future refactor cannot half-fix it.

The permanent fix belongs in the setter, not in `deposit()`:

```solidity
uint256 public constant MAX_DEPOSIT_FEE_BPS = 1_000;  // 10%, a policy ceiling

function setDepositFee(uint256 newFeeBps) external onlyOwner {
    if (newFeeBps > MAX_DEPOSIT_FEE_BPS) revert FeeTooHigh(newFeeBps);
    ...
}
```

Pick the ceiling as a *policy* number well under 10_000. `newFeeBps < 10_000`
would be technically sufficient to keep deposits alive, but it still lets a
fat-fingered 9_998 confiscate 99.98% of a deposit — legal by the check, and
indistinguishable from the incident you just had.

Since the vault is stateful, this also wants a handler-driven invariant where
the handler may retune the fee between deposits and withdrawals, asserting that
recorded assets equal assets actually held. That catches the accumulation-shaped
sibling of this bug — fee changes mid-flight leaving accounting and custody out
of step — which no single-operation test can see however many you write.

## The short version

The suite verified that the fee formula computes a fee, that the setter stores a
number, that only the owner may call it, and that it emits. It never asked the
one question that mattered: *is there any value the setter accepts that the rest
of the contract cannot survive?* Three samples drawn from one corner of the
domain cannot answer that, and a coverage metric that counts executed lines
cannot notice that the question was never asked.
