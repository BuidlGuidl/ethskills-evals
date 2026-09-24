# Why 39 green tests and 100% coverage missed the fee drift

## 1. Test-by-test: what is established vs. what only appears to be

### `test_DepositMintsShares`
**Actually establishes:** on a vault in exactly one state — empty, `totalSupply == 0`, `totalAssets == 0` — a single deposit of `DEPOSIT_AMOUNT` returns `999e18` and credits `999e18` to the depositor's balance. It establishes that the return value and the recorded balance agree with each other, and that the entry fee/rounding produces the literal `999e18` for this one input.

**Only appears to establish:** that share *conversion* is correct. It says nothing about the conversion formula, because on an empty vault the formula is degenerate — the first deposit defines the price, so any implementation that mints "roughly the deposit" passes. The interesting regime is `totalAssets != totalSupply`, i.e. after the price per share has moved. That is precisely the regime the drift lives in, and this test never enters it. The hardcoded `999e18` pins an *answer* rather than a *relationship*; if the fee accounting changed the price, this assertion would keep passing because it's a fresh vault every time.

### `test_DepositUpdatesTotalAssets`
**Actually establishes:** after one deposit on an empty vault, the accessor `totalAssets()` and the storage variable `totalAssetsStored()` both equal the deposited amount.

**Only appears to establish:** that the vault's accounting matches reality. It doesn't — it compares two *internal* numbers against each other and against the test's own input. `assertEq(vault.totalAssets(), vault.totalAssetsStored())` is a tautology at the one moment in the vault's life when the two cannot possibly differ. The external truth — how many tokens the vault can actually command in the yield protocol — is never read. The bug is exactly `totalAssetsStored < real balance`. A test that never queries the real balance is structurally incapable of seeing it, no matter how many times you run it.

### `test_WithdrawFeeBps`
**Actually establishes:** the public constant `WITHDRAW_FEE_BPS` equals `30`.

**Only appears to establish:** that the withdrawal fee works. This is a restatement of a source line in assertion syntax: it has zero behavioral content and cannot fail for any reason other than someone editing the constant. It is worth noting what is conspicuously absent around it: nothing in the suite asserts *where the fee goes*. The fee's destination is the entire specification of this feature ("stays in the protocol, accrues to remaining holders") and the suite's only mention of the fee is its magnitude.

### `test_ConstructorSetsUsdt`
**Actually establishes:** the constructor stores the token address it was given.

**Only appears to establish:** nothing beyond that, and it doesn't pretend otherwise — it's a legitimate wiring smoke test. It's listed here because tests like this are a large part of how the suite reached 39 and 100%: they execute constructor and getter lines, which counts as coverage, while contributing no behavioral constraint.

## 2. How 100% line and function coverage was compatible with this bug

Coverage measures *execution*, not *assertion*, and not *relationship*.

- **A line can be covered and unasserted.** The withdraw path was executed; nothing asserted what it did to the invariant afterwards. Coverage instrumentation cannot tell an executed line from a checked one.
- **The defect is not located on a line.** It's in the relationship between two lines in the withdraw path: the amount decremented from `totalAssetsStored` versus the amount actually transferred out. Each line is individually defensible. There is no line you could delete or fix in isolation and no line whose execution is suspicious. Line coverage has no vocabulary for "these two statements must agree."
- **Coverage is blind to state regime.** Every one of those lines was covered exactly once, from a fresh, empty, 1:1-priced vault. `withdraw()` executed at price 1.0 reports the same coverage as `withdraw()` executed at price 1.0000037 after 200 prior operations — but only the second exposes the bug. The suite's *state* coverage of the reachable state space is effectively zero.
- **Coverage is per-call; the bug is per-sequence.** Path coverage over *sequences* of transactions — the only thing that could have caught an accumulating error — is not what `forge coverage` reports, and 100% of the former tells you nothing about the latter.
- **Coverage cannot express negative properties.** "No reachable state has unclaimable surplus" is a statement about states the contract must never enter. There is no line of code corresponding to it, so there is no line to cover.

100% coverage is a statement about the *tests' reach into the code*. This bug is in the code's reach into the *state space*. They are different axes, and the suite maxed out the one that was free to max out.

## 3. Why "every operation is correct in isolation" is the tell, not the alibi

The lead is reading "no single call misbehaves" as evidence that the system is correct. It is actually a precise diagnosis of *which class* of bug you have.

"Every operation correct ⟹ system correct" holds only if correctness is closed under composition. It isn't, unless you have stated an invariant — a predicate on *state* that every operation preserves. Per-operation correctness is a property of *transitions*: given this input and this pre-state, the outputs look right. That is a strictly weaker claim, and the gap between the two is exactly where conserved-quantity bugs live.

Concretely, the shape of the symptom identifies the shape of the defect:

- The error **accumulates** — it appears over a long run and not in any single call. Anything that is invisible per-step and visible in aggregate is, by definition, a fold/accumulation error: a small per-step leak in a quantity that is supposed to be conserved.
- The error is **one-directional**. `totalAssetsStored` drifts *below* the real balance, monotonically, never back. A random or symmetric bug would cancel out on average and would eventually show up as an overshoot too. Monotone drift means a systematic sign error in an update rule — each withdrawal decrements the recorded total by the gross amount while only the net leaves the protocol, so 30 bps of every withdrawal is deducted from the books but not from the vault.
- Each step's error is **below any single test's resolution**. 30 bps of one withdrawal is a number a unit test author would plausibly write into an expected value without blinking, or lose to a rounding tolerance. It only becomes legible after summation.
- Nothing is **insolvent**. The vault holds more than it thinks. That rules out an entire family of bugs (over-minting, double-spend, reentrancy) and points squarely at accounting that has decoupled from custody — the recorded total and the real balance are two numbers that used to agree and no longer do, which means nothing in the system was ever forcing them to agree.

So: if each operation were wrong by an *observable* amount, a unit test would have caught it. The fact that no operation is individually wrong is what tells you the broken property isn't at the operation level at all. It's an invariant, and the suite contains no invariants — only transition checks. The lead's "every call is correct" is the same sentence as "we never tested a property that spans calls."

## 4. The property the suite should have asserted

### Primary: accounting exactness (the one that fails)

> **At every reachable state, the vault's recorded total assets equal the assets it can actually command.**
>
> `vault.totalAssets() == realBalance()`, where
> `realBalance() = yieldProtocol.balanceOf(address(vault)) + usdt.balanceOf(address(vault))`
>
> for every state reachable by any sequence of `deposit` / `withdraw` / `redeem` / yield accrual, by any set of actors, in any order.

Today only `<=` holds, and the inequality becomes strict after the first withdrawal and widens monotonically. If you must tolerate wei-level rounding dust, state the bound explicitly and tie it to operation count (`assertApproxEqAbs(totalAssets(), realBalance(), opCount)`), not to a magic constant — an unbounded tolerance re-hides the bug.

### Corollary: fee accrual / price-per-share monotonicity

This is the fee's actual specification, stated numerically. Let `pps = totalAssets() * 1e18 / totalSupply()` (defined when `totalSupply() > 0`).

> **(a)** For every operation, `pps_after >= pps_before`. Price per share never decreases; no user action dilutes the remaining holders.
>
> **(b)** For a withdrawal with gross amount `g` and fee `f = g * WITHDRAW_FEE_BPS / 10_000`, with `totalSupply() > 0` afterwards:
> `pps_after == pps_before + f * 1e18 / totalSupply_after` (± 1 wei).
>
> The fee doesn't merely "not go to the owner" — it goes *to the remaining holders*, by exactly this amount. (b) is the assertion the suite is missing entirely; it is what `test_WithdrawFeeBps` should have been.

### Corollary: no orphaned value

> **When `totalSupply() == 0`, `realBalance() == 0`.** Equivalently: the last holder to exit can claim everything the vault holds.

This is the "unclaimable tokens" symptom stated directly, and it is the cheapest of the three to write.

### Test shape

**1. Stateful invariant test (Foundry) — this is the one that catches it.**

```solidity
contract VaultHandler is Test {
    Vault vault; MockUSDT usdt;
    address[] actors;
    uint256 public opCount;
    uint256 public lastPps = 1e18;   // ghost

    function deposit(uint256 actorSeed, uint256 amount) public useActor(actorSeed) {
        amount = bound(amount, 1e6, 1_000_000e18);
        deal(address(usdt), currentActor, amount);
        usdt.approve(address(vault), amount);
        vault.deposit(amount);
        _snapPps();
    }

    function withdraw(uint256 actorSeed, uint256 shares) public useActor(actorSeed) {
        uint256 bal = vault.shareBalance(currentActor);
        if (bal == 0) return;
        vault.withdraw(bound(shares, 1, bal));
        _snapPps();
    }

    function accrueYield(uint256 amount) public { /* mint into the protocol */ _snapPps(); }

    function _snapPps() internal {
        opCount++;
        if (vault.totalSupply() == 0) return;
        uint256 pps = vault.totalAssets() * 1e18 / vault.totalSupply();
        assertGe(pps, lastPps, "price per share decreased");   // property (a)
        lastPps = pps;
    }
}

contract VaultInvariants is StdInvariant, Test {
    function setUp() public { /* deploy, targetContract(address(handler)) */ }

    function invariant_AccountingMatchesReality() public view {
        assertApproxEqAbs(vault.totalAssets(), realBalance(), handler.opCount());
    }

    function invariant_NoOrphanedValue() public view {
        if (vault.totalSupply() == 0) assertEq(realBalance(), 0);
    }
}
```

The essential configuration details: `targetContract` must be the *handler*, not the vault, so sequences are meaningful rather than mostly-reverting; `runs`/`depth` set high enough (e.g. 256 × 100) that drift accumulates past the dust bound; multiple actors, because a single-actor vault can't exhibit "the fee accrues to someone else"; and the vault must **not** be redeployed between calls — the entire point is that state carries forward.

**2. Deterministic regression test naming the bug** (fast, readable, goes in the suite permanently):

```solidity
function test_WithdrawFeeAccruesToRemainingHolders() public {
    _deposit(alice, 1_000_000e18);
    _deposit(bob,   1_000_000e18);

    uint256 aliceBefore = vault.previewRedeem(vault.shareBalance(alice));
    uint256 gross = 100_000e18;
    uint256 fee   = gross * vault.WITHDRAW_FEE_BPS() / 10_000;

    _withdraw(bob, gross);

    // the fee landed on the remaining holder, not nowhere
    assertApproxEqAbs(vault.previewRedeem(vault.shareBalance(alice)), aliceBefore + fee, 1);
    // and the books still match custody
    assertEq(vault.totalAssets(), realBalance());
}
```

**3. Exit-to-zero test:** everyone deposits, many partial withdrawals interleave, then all holders redeem in full. Assert `totalSupply() == 0 && realBalance() == 0`. Under the current implementation the leftover fees strand here, and this test fails with a number that is precisely the sum of every fee ever charged.

**4. Repair the existing unit tests while you're in there.** Replace literal expectations with relational ones evaluated *away from* price 1.0: seed the vault, accrue yield so `totalAssets != totalSupply`, and only then assert `shares == amount * totalSupply / totalAssets`. Note that `assertEq(shares, vault.convertToShares(amount))` is *not* an improvement — it's the same tautology as `test_DepositUpdatesTotalAssets`, comparing the implementation to itself. Rename `test_WithdrawFeeBps` to something that asserts the fee's destination rather than its magnitude.

The general rule this bug illustrates: for any contract that holds value, at least one test must compare the contract's *opinion* of its balance against the *external* source of truth, across a long adversarially-ordered sequence of operations. Every test in the sample compares the vault to itself, once, from a clean slate. That is why they are all green, why coverage is 100%, and why the fees vanished anyway.
