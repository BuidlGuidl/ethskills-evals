# Why 39 green tests and 100% coverage missed the fee drift

## 0. The shape of the bug, stated first

The symptom — recorded total drifts *below* real holdings, monotonically, in proportion
to the number of withdrawals — pins the defect to one line's worth of accounting:

    withdraw debits the recorded total by the GROSS amount,
    but only the NET amount actually leaves the vault.

    totalAssetsStored -= gross;          // user's claim, retired
    transfer(user, gross - fee);         // tokens that actually left

`fee` tokens stay in the yield protocol (correct, that was the intent) but the
recorded total was already reduced as if they had left. So the fee is retired from
the ledger instead of being re-credited to the remaining holders. Nobody's balance
went down; the fee simply stopped existing on the books. Every withdrawal repeats it,
so drift = Σ fees, growing forever.

This is a **single-entry bookkeeping error**. The withdrawal debits the exiting user
gross and credits the recipient net. The third line of the entry — the credit that
says *where the fee went* — was never written. Each entry is individually plausible;
the ledger does not balance. Everything below follows from that framing.

---

## 1. The four tests, one at a time

### `test_DepositMintsShares`

```solidity
uint256 shares = _deposit(alice, DEPOSIT_AMOUNT);
assertEq(shares, 999e18);
assertEq(vault.shareBalance(alice), 999e18);
```

**Actually establishes:** on a *fresh vault with zero supply*, one deposit of
`DEPOSIT_AMOUNT` returns some fixed number and credits that same number to the
depositor's balance. Two things are genuinely checked: the return value and the
storage write agree with each other, and neither is zero.

**Only appears to establish:** that share issuance is *priced correctly*. It isn't
tested at all. `999e18` is a golden constant, and it was almost certainly read off the
implementation's output rather than derived from a spec — which makes it a
change-detector, not an oracle. Worse, it is evaluated in the one state where pricing
is unfalsifiable: with `totalSupply == 0`, the bootstrap branch (`shares = assets`) and
the general branch (`shares = assets * supply / totalAssets`) return the same answer
for *any* value of `totalAssets`. The share price is 1:1 by construction, so the test
cannot distinguish a correct `totalAssets` from a drifted one. The line that
mis-prices later deposits is executed here; the *state* that makes it misbehave is not.

That is the whole coverage illusion in one test: line covered, state uncovered.

### `test_DepositUpdatesTotalAssets`

```solidity
_deposit(alice, DEPOSIT_AMOUNT);
assertEq(vault.totalAssets(), DEPOSIT_AMOUNT);
assertEq(vault.totalAssetsStored(), DEPOSIT_AMOUNT);
```

This is the most instructive of the four, because **it has the right shape and the
wrong evaluation point.**

**Actually establishes:** a deposit increments the cached total by the deposited
amount, and the two accessors `totalAssets()` and `totalAssetsStored()` agree — after
exactly one operation, from a clean fixture, with no withdrawal anywhere in the test.

**Only appears to establish:** that the vault's accounting tracks reality. It doesn't,
for two independent reasons:

1. **The oracle is the input, not the ground truth.** `DEPOSIT_AMOUNT` is what the test
   just handed in. Comparing storage to the test's own input confirms the deposit path
   is self-consistent; it says nothing about what the vault *holds*. The real ground
   truth — `yieldProtocol.balanceOf(address(vault)) + usdt.balanceOf(address(vault))` —
   is never read by any of these tests. The bug is precisely a divergence between vault
   storage and that external balance, and no assertion in the suite looks at both.
2. **The two accessors are two views of the same slot.** If `totalAssets()` returns the
   cache (or the cache plus something that is zero here), asserting they're equal is
   near-tautological. It resembles the conservation check the suite needed, evaluated
   at the only moment in the vault's life when it cannot fail: before any fee has ever
   been charged, drift is definitionally zero.

The suite contains a picture of the correct invariant, sampled where the invariant
is trivially satisfied.

### `test_WithdrawFeeBps`

```solidity
assertEq(vault.WITHDRAW_FEE_BPS(), 30);
```

**Actually establishes:** the constant compiles to 30 and is publicly readable.

**Only appears to establish:** anything about fees. No withdrawal occurs. This test is
compatible with a vault that applies the fee twice, applies it to the wrong base,
forwards it to the owner, burns it, or — as here — debits it from the ledger and
credits it to nobody. It is a restatement of a source line inside an `assertEq`; it
asserts against the same declaration it reads from, so it can never disagree with the
implementation. Its only real effect is on the two numbers your lead is citing: it adds
one to "39 green" and marks the constant's getter covered.

### `test_ConstructorSetsUsdt`

```solidity
assertEq(address(vault.usdt()), address(usdt));
```

**Actually establishes:** the constructor argument reached the storage variable — a
real, if small, wiring check. Genuinely useful for catching a swapped constructor
parameter.

**Only appears to establish:** that the vault is correctly integrated with its asset.
It checks the address, never a transfer, never a balance, never the yield protocol at
all. The vault's relationship with the token that actually goes missing from the books
is tested only as far as "the pointer is right."

### The pattern across all four

Every test is: *fresh fixture → one operation → assert on a value the test itself
supplied or on a constant*. None of them (a) sequences two state-changing operations,
(b) involves two actors whose outcomes must relate, or (c) reads any state outside the
vault. The bug requires all three to be visible. The suite has zero tests in the shape
that could fail.

---

## 2. How 100% line and function coverage was compatible with this

Coverage answers "was this line executed?" It is asked and answered per line, on a
single contract, over whatever states the fixtures happened to reach. The bug is not
in a line. Concretely:

- **Coverage measures execution, not assertion.** Nothing checks that an executed line
  was observed. `forge coverage` counts a line as covered if a test *ran* it, including
  tests whose assertions are about a different variable entirely. A suite of 39 tests
  with zero assertions would report the same 100%.
- **The defect is a relation between two lines, and each is individually reachable and
  individually defensible.** `totalAssetsStored -= gross` is correct if gross leaves;
  `transfer(user, gross - fee)` is correct if the fee is credited elsewhere. Coverage
  has no vocabulary for "these two must agree." There is no uncovered line to find —
  the wrongness lives in the space *between* covered lines.
- **The oracle it would need is outside the unit under test.** The invariant relates the
  vault's storage to the *yield protocol's* balance. A coverage report on the vault
  cannot, even in principle, notice that another contract's storage was never read.
  100% of the wrong contract's lines is still 0% of the invariant.
- **Line coverage ≠ state coverage.** The vault's behavior is a function of
  `(supply, totalAssetsStored, realAssets)`. Every line was reached from
  `(0, 0, 0)` or one step from it. The reachable-state region where drift is nonzero —
  everything past the first withdrawal — was never entered, so the pricing arithmetic
  was executed exclusively in the degenerate regime where it cannot be wrong.
- **Path/sequence coverage was ~0.** The bug's minimal reproduction is length ≥ 3
  (deposit, deposit, withdraw) and its *severity* is a function of sequence length. The
  suite's maximum sequence length is 1–2 with a clean reset before each. Coverage is
  flat over `n`; the bug is linear in `n`.

The right metric here is **mutation testing**. Replace `-= gross` with `-= net` — the
mutation that *fixes* the bug, or symmetrically, inject the bug into a correct vault.
The entire 39-test suite stays green. A surviving mutant is the exact thing "100%
coverage, all green" is unable to report, and it is the number to bring to your lead:
coverage measures what you ran, mutation score measures what you'd notice.

---

## 3. Why "every operation is correct in isolation" is the tell, not the alibi

Because an accumulating drift **must** look locally fine. If any single withdrawal
visibly misbehaved, it wouldn't accumulate — it would be a one-shot, obvious error that
the first unit test caught. The defining property of a conservation bug is that each
step is individually small, individually plausible, and individually within spec. So
"we cannot point at a call that misbehaves" is not evidence against the bug class; it
is the bug class's signature.

The deeper reason is that **local correctness doesn't compose unless the local specs
add up.** Each operation was checked against a local spec:

- deposit: *the depositor receives shares proportional to what they put in* — satisfied.
- withdraw: *the withdrawer receives `gross - fee`* — satisfied, every time, forever.

Neither local spec mentions where the fee goes. You can satisfy both at every step and
still have the system be wrong, because the property that was violated is not the
conjunction of the local specs — it's a global one that no local spec entails. The fee
left one side of the ledger and arrived at no other. That is invisible from inside
either operation and visible only from a vantage point that sees the whole ledger.

Note also the direction of the failure, which is itself a clue: the vault holds *more*
than it thinks. There's no revert, no insolvency, no failed transfer, no user whose
withdrawal is rejected — no error-path signal at all. Silent, one-sided, growing drift
is the fingerprint of a missing credit. When you see it, the productive move is to stop
looking for a bad call and start asking *which quantity is conserved and who checks it*
— reasoning about the relation, not the line.

So this observation should have narrowed the search immediately rather than closing it.
Having empirically ruled out every local defect, what remains is by elimination an
invariant violation. "All the parts are fine and the whole is wrong" localizes the bug
to the seams.

**Reusable heuristic:** any sentence in your spec containing *accrues*, *over time*,
*stays in*, or *for everyone still in* is a statement about ≥2 actors at ≥2 points in
time. It is structurally unexpressible as a one-actor, one-call unit test. The intent
here — "the fee stays in the protocol and accrues to whoever is still in the vault" —
was never written as an assertion because the suite's test shape had no room for it.

---

## 4. The property the suite should have asserted

Two properties. **P1** catches the drift mechanically; **P2** states the intent the code
was actually meant to implement. P1 is the one that fails today.

Let, at any reachable state:

    realAssets   := yieldProtocol.balanceOf(address(vault)) + usdt.balanceOf(address(vault))
                    // every token the vault controls, read from outside the vault
    booked       := vault.totalAssets()
    pps          := totalSupply == 0 ? WAD : booked * WAD / totalSupply

### P1 — Accounting completeness (no stranded assets)

> **At every reachable state, after any sequence of deposits and withdrawals in any
> order by any actors: `booked == realAssets`.**
>
> Tolerance, if per-op integer rounding makes exact equality impossible:
> `0 <= realAssets - booked <= K`, for a constant `K` **independent of the number of
> operations**. The direction matters (never book more than you hold) and so does the
> bound: the defect is not that drift exists but that it is **unbounded in `n`**.

Equivalently, as a per-operation rule and the actual fix:

> **A withdrawal must decrement the recorded total by the tokens that leave the vault,
> not by the tokens debited from the user.** `totalAssetsStored -= (gross - fee)`. The
> retained `fee` stays counted, so it lands in the numerator of `pps` and accrues to
> remaining shares automatically.

### P2 — Fee accrual / share-price monotonicity (the intent)

> **`pps` is non-decreasing across every operation.** Deposits and withdrawals never
> lower it (a deposit mints at the current price; a withdrawal burns at the current
> price and retains the fee). Strictly: for any withdrawal charging `fee > 0` that
> leaves `totalSupply > 0`, `pps_after > pps_before`, and no holder's redeemable value
> `shareBalance(u) * pps` ever decreases without `u` acting.

P2 is what "accrues to whoever is still in the vault" means, written down. It is also a
useful independent check: an implementation could conserve total assets (P1 holds) but
misdirect the fee to the owner, and P2 would catch that.

### Test shape

**Primary: a stateful invariant fuzz suite.** This is the shape the whole suite was
missing — not a longer list of unit tests, but a harness where the sequence is the
input and the invariant is the assertion.

```solidity
// Handler: bounded actions over a small actor set, NO state reset between calls.
contract VaultHandler is Test {
    Vault vault; MockUSDT usdt; address[] actors;
    uint256 public ghost_lastPps = 1e18;
    uint256 public ghost_depositedTotal;
    uint256 public ghost_withdrawnNet;

    function deposit(uint256 actorSeed, uint256 amount) external {
        address a = actors[bound(actorSeed, 0, actors.length - 1)];
        amount = bound(amount, 1e6, 1_000_000e18);
        // ... mint, approve, prank, deposit ...
        ghost_depositedTotal += amount;
        _snapPps();
    }

    function withdraw(uint256 actorSeed, uint256 sharesPct) external {
        address a = actors[bound(actorSeed, 0, actors.length - 1)];
        uint256 shares = vault.shareBalance(a) * bound(sharesPct, 1, 100) / 100;
        if (shares == 0) return;                       // skip, never revert-and-hide
        ghost_withdrawnNet += _withdrawAs(a, shares);
        _snapPps();
    }

    function _snapPps() internal {
        uint256 pps = vault.totalSupply() == 0 ? ghost_lastPps
                    : vault.totalAssets() * 1e18 / vault.totalSupply();
        // P2, checked at every step inside the handler so we see the exact call
        assertGe(pps, ghost_lastPps, "pps decreased");
        ghost_lastPps = pps;
    }
}

contract VaultInvariants is Test {
    function setUp() public { /* deploy, targetContract(address(handler)) */ }

    // P1 — the one that fails today
    function invariant_bookedEqualsReal() public view {
        assertEq(vault.totalAssets(), _realAssets(), "stranded assets");
    }

    // P2 — restated at the boundary
    function invariant_ppsNeverDecreases() public view {
        assertGe(_pps(), handler.ghost_lastPps());
    }

    // Conservation across the whole run: nothing created or destroyed
    function invariant_valueConserved() public view {
        assertEq(handler.ghost_depositedTotal(),
                 handler.ghost_withdrawnNet() + _realAssets());
    }
}
```

Two configuration points are load-bearing, not incidental:

- **Depth must be large** (`runs = 256`, `depth >= 100` in `foundry.toml`). Drift is
  linear in withdrawal count; at depth 1 this suite is as blind as the current one.
- **The handler must not reset state between calls.** The existing suite's per-test
  `setUp` is exactly what hides the bug; a fresh vault has zero drift by definition.

**Secondary: a deterministic regression test**, so the failure is legible in CI even
without the fuzzer, and so the bug can never come back silently.

```solidity
function test_WithdrawFeeAccruesToRemainingHolders() public {
    _deposit(alice, 1000e18);
    _deposit(bob,   1000e18);

    uint256 ppsBefore = _pps();
    uint256 alicePayout = _withdrawAll(alice);

    assertGt(_pps(), ppsBefore, "fee did not accrue to bob");          // P2 — FAILS today
    assertEq(vault.totalAssets(), _realAssets(), "assets stranded");    // P1 — FAILS today

    uint256 bobPayout = _withdrawAll(bob);
    assertGt(bobPayout, alicePayout, "bob did not earn alice's exit fee");

    // nothing created or destroyed: payouts + retained fees == principal
    assertEq(alicePayout + bobPayout + _realAssets(), 2000e18);
    assertEq(vault.totalAssets(), _realAssets());
}

function test_DriftDoesNotGrowWithOperationCount() public {
    _deposit(alice, 1_000_000e18);          // seed liquidity, never withdrawn
    uint256 driftAfterFirst;
    for (uint256 i = 0; i < 50; i++) {
        _deposit(bob, 1000e18);
        _withdrawAll(bob);
        uint256 drift = _realAssets() - vault.totalAssets();
        if (i == 0) driftAfterFirst = drift;
        assertEq(drift, driftAfterFirst, "drift grows with op count");  // FAILS at i == 1
    }
}
```

The second test is the direct expression of the whole diagnosis: the pass/fail
criterion is not the value of any single operation but whether the error term is
constant in `n`. It fails on the second iteration, and its failure message names the
actual defect.

### What this changes about the four existing tests

Keep `test_ConstructorSetsUsdt` — cheap wiring check, does what it says.
Keep `test_DepositUpdatesTotalAssets`, but replace `DEPOSIT_AMOUNT` on the right-hand
side with `_realAssets()`, so it compares against ground truth instead of its own input.
Delete or fold `test_WithdrawFeeBps` into a test that performs a withdrawal and asserts
where the 30 bps *lands*. Replace `999e18` in `test_DepositMintsShares` with an
expression derived from the spec (`amount * totalSupply / totalAssets`), and add the
same test starting from a vault that already has supply and accrued fees.

And the metric to report alongside coverage from now on is the mutation score, or at
minimum the answer to: *which single-character edit to the vault leaves this suite
green?*

---

## Unresolved questions

1. Does `totalAssets()` return the cached `totalAssetsStored`, or does it re-read the
   yield protocol? If the latter, the drift is somewhere else than assumed above (the
   fix location changes; P1 as stated still catches it either way).
2. Is `999e18` from `DEPOSIT_AMOUNT = 1000e18` an entry fee, a virtual-share offset, or
   rounding? That determines whether P1's tolerance `K` should be 0 or a small constant.
3. Is there a `harvest`/rebase path that credits yield? If so it belongs in the handler
   as a third action, and P2's monotonicity claim needs to cover loss-bearing harvests
   explicitly (or be scoped to fee-only operations).
4. Migration: the already-stranded balance is unclaimable under the current code. Fixing
   the accounting going forward does not recover it — do you want a one-time
   `syncTotalAssets()` that re-books `realAssets` and hands the historical drift to
   current holders? That's a policy call, not a bug fix.
