# Why 39 green tests and 100% coverage shipped a leak

## Verdict first

Every assertion in the slice compares the vault **to itself** or **to a hardcoded
constant**. Not one compares the vault to the outside world — the actual token balance
held in the yield protocol. The bug *is* a divergence between the vault's books and the
outside world. A suite built entirely out of self-consistency checks cannot see it, no
matter how many of them there are.

The mechanism is the ordinary one: `withdraw` computes gross `assets` from shares,
transfers `assets - fee` to the user, and then debits the accumulator by the **gross**
`assets`. The fee never leaves the protocol but is subtracted from the books anyway.
Per call this is self-consistent under a wrong model ("the fee leaves the system"). Over
N withdrawals the books run low by `Σ fee`, share price is understated by exactly that
much, and those tokens become unclaimable — no one's share entitles them to assets the
vault does not believe it has.

---

## The four tests, one at a time

### `test_DepositMintsShares`

**Actually establishes:** on a *fresh* vault, a *first* deposit of `DEPOSIT_AMOUNT`
returns `999e18` and the returned number equals what `shareBalance` reports. That is: the
return value and the storage write agree with each other, at the bootstrap price.

**Only appears to establish:** that share minting is correct. `999e18` is a magic constant
lifted from a run of the implementation, not derived from the spec. An oracle copied from
the code under test cannot distinguish "correct" from "consistently wrong" — it pins
current behaviour, which is exactly what you want from a regression test and exactly
nothing of what you want from a correctness test.

It is also first-deposit-only. The first deposit is the one case where the share price is
fixed by construction. Every share-math defect worth finding lives in the *second* deposit,
at a price that has moved — which is the entire subject of this incident.

Side observation worth a look: this test says `DEPOSIT_AMOUNT` buys `999e18` shares
(a 0.1% haircut) while `test_DepositUpdatesTotalAssets` says the same deposit credits
`totalAssets()` with the full `DEPOSIT_AMOUNT`. Either those `1e18` are a real haircut and
the books *over*-count by it — a second drift, in the opposite direction — or the two
constants are measuring different things. Nothing in the suite forces those two numbers to
be consistent with each other, which is the point.

### `test_DepositUpdatesTotalAssets`

**Actually establishes:** `deposit` writes the accumulator, and `totalAssets()` reads back
what `totalAssetsStored()` holds. Two getters over one storage slot agree.

**Only appears to establish:** that the accounting tracks reality. It compares the vault's
number to its own input argument, and to its own other getter. If `totalAssets()` is
`totalAssetsStored()` plus accrual, the second `assertEq` is close to a tautology. The
external truth — `yieldProtocol.balanceOf(vault) + usdt.balanceOf(vault)` — appears nowhere.

This is the test that sits closest to the bug and is therefore the one that generated the
most false confidence. It is named after the exact quantity that drifted and it never once
looks at the quantity it is supposed to be tracking.

### `test_WithdrawFeeBps`

**Actually establishes:** a constant equals 30.

**Only appears to establish:** "we tested the withdraw fee." It asserts nothing about
whether the fee is applied, applied to the right base, subtracted from the right side, or
lands where the spec says it lands. It is a coverage-shaped test: it touches the fee
symbol so the fee looks covered. Change `30` to `25` and it fails; change the *destination
of the fee* — the actual bug — and it passes.

### `test_ConstructorSetsUsdt`

**Actually establishes:** the constructor assigns its argument to a field.

**Only appears to establish:** that the integration is wired up. It is a compiler check
written in Solidity. Worth keeping, worth zero as evidence of correctness.

### The sampling itself is the finding

Four tests. Two deposits, one constant, one constructor. **Zero assertions about state
after a withdrawal** — and "fee" is a withdrawal-path concept. The suite's shape
concentrates on the code that is easy to assert about, which is the code least likely to
be wrong.

---

## How 100% coverage was compatible with this

**Coverage is existential; correctness is universal.** Line coverage says *this line
executed at least once*. It does not say any assertion depended on the value that line
wrote. `totalAssetsStored -= assets;` is marked covered by any test that calls `withdraw`
at all — including a test that only checks the return value, or the user's token balance,
or that it didn't revert. The line ran. Nobody looked at what it did.

**The defect is not in a line — it's in the relation between two lines.** The transfer says
`assets - fee`; the accounting says `assets`. Each line is individually defensible. The
contradiction only exists in the pair. Coverage instruments statements; it has no
representation for "these two statements must agree," so there is no metric here to be
below 100%.

**Every test starts at drift zero.** `setUp()` gives a fresh vault; drift is 0 at t=0 and
grows monotonically with the number of withdrawals. A property whose magnitude is
`Σ fees over N withdrawals` is identically zero in any test whose longest sequence is one
or two calls. Line coverage was 100%; **state-space coverage was one point**. The suite
never visited a state in which the bug had a nonzero value.

**The oracles were derived from the implementation.** `999e18` and friends were obtained by
running the code and pasting the output. Any bug present at the time the constants were
recorded is now encoded as the expected result and defended by the test suite.

The right metric here is mutation score, not coverage. The mutant `totalAssetsStored -=
assets` (vs. `assets - fee`) survives all 39 tests. That single number would have told the
lead what the coverage number could not: the suite executes the code, it does not
*constrain* it.

---

## Why "every operation is correct in isolation" is the tell

Because it is a *result*, not a defence. Run the argument forward:

1. The system has two representations of one quantity — recorded assets and real assets.
2. Correctness means they stay in lockstep across **arbitrary sequences** of operations.
   That is a conserved-quantity property, and conserved quantities are only observable
   along a trajectory. There is no single state at which conservation is visible.
3. Every single-call check passes. So the defect is *proved* not to be a per-call defect.
4. Therefore it lives in composition — in the relation between operations. Which is the
   one thing the suite contains no test for.

"Correct in isolation" doesn't clear the code; it eliminates a whole class of causes and
points at what remains. It is the signature of a **missing invariant**, not a missing case,
and adding more unit tests — more cases — is by construction the one response that cannot
find it.

There's a sharper way to say it. The fee is the only quantity in this system defined as a
**residual**: it is the difference between what gets debited and what gets paid out.
Anything defined as a difference is invisible to tests that assert each term separately
against a constant. You have to assert the difference.

And note the symptom shape: the vault holds *more* than it thinks. That's why nothing
reverted, no user was ever short-paid, no monitoring fired, and no operation misbehaves —
solvency was never violated. The failure is pure slack, and slack is silent by nature. It
takes an equality to catch it. Any `assertGe(real, booked)` solvency check — the one most
teams write — passes cleanly on this bug, forever.

---

## The property the suite should have asserted

Three properties, stated over **every reachable state after any sequence of operations**.
Let `realAssets = yieldProtocol.balanceOf(vault) + usdt.balanceOf(vault)`.

**P1 — Books equal reality (no unclaimable slack).**

```
realAssets - vault.totalAssets()  ==  0    (± 1 wei per operation, for rounding)
```

Two halves, both load-bearing:
- `realAssets >= totalAssets()` — solvency. Passes today. Not the interesting half.
- `realAssets - totalAssets() <= ε` — **no orphaned assets**, where `ε` is a fixed dust
  bound (`opCount` wei), *not* something proportional to fees collected. This is the half
  that's violated, and it must be an equality-with-dust-bound, never a `>=`.

**P2 — The book equals the net observed token flow.** The strongest form, because the
right-hand side is computed from an oracle wholly independent of the vault's own code:

```
vault.totalAssets()  ==  Σ(tokens pulled from depositors) - Σ(tokens paid to withdrawers)
```

Fees are never paid out, so they never appear in the subtrahend, so they must remain in
`totalAssets()`. The buggy vault fails this with error equal to exactly `Σ fees` — the
assertion's error term *is* the leak, measured.

**P3 — Fees actually accrue to whoever stays (the spec sentence, as an assertion).** After
any withdrawal with `fee > 0` that leaves `totalSupply > 0`:

```
pricePerShare_after  >  pricePerShare_before        // STRICTLY greater
```

Be careful here — a non-strict `assertGe` is **too weak and does not catch this bug.**
Under the buggy code the price after a withdrawal is exactly `T/S`, unchanged: burning `s`
shares and debiting `s·T/S` leaves the ratio flat. "Share price never falls" passes. Only
strict increase — by roughly `fee·1e18 / (S - s)` — encodes what the spec actually
promised.

### Test shape

**Stateful invariant fuzzing (Foundry), with a handler that keeps ghost accounting.** The
handler is what makes P2 possible: it records observed token movements, so the invariant
compares the vault against an oracle the vault did not produce.

```solidity
contract Handler is Test {
    Vault vault; IERC20 usdt; address[] actors;

    uint256 public ghost_depositedGross;  // tokens actually pulled from actors
    uint256 public ghost_withdrawnNet;    // tokens actually paid back to actors
    uint256 public ghost_ops;
    uint256 public prevPrice = 1e18;

    function deposit(uint256 seed, uint256 amount) external {
        address a = _actor(seed);
        amount = bound(amount, 1e6, 1_000_000e6);
        deal(address(usdt), a, amount);
        vm.startPrank(a);
        usdt.approve(address(vault), amount);
        vault.deposit(amount);
        vm.stopPrank();
        ghost_depositedGross += amount;
        ghost_ops++;
        _recordPrice(false);
    }

    function withdraw(uint256 seed, uint256 pct) external {
        address a = _actor(seed);
        uint256 bal = vault.shareBalance(a);
        if (bal == 0) return;
        uint256 shares = bal * bound(pct, 1, 100) / 100;
        uint256 before = usdt.balanceOf(a);
        vm.prank(a);
        vault.withdraw(shares);
        ghost_withdrawnNet += usdt.balanceOf(a) - before;   // net, as observed
        ghost_ops++;
        _recordPrice(true);                                  // fee-bearing op
    }

    function realAssets() public view returns (uint256) {
        return yieldProtocol.balanceOf(address(vault)) + usdt.balanceOf(address(vault));
    }

    function _recordPrice(bool feeBearing) internal {
        uint256 s = vault.totalSupply();
        uint256 p = s == 0 ? 1e18 : vault.totalAssets() * 1e18 / s;
        if (feeBearing && s > 0) assertGt(p, prevPrice);   // P3, strict
        else                      assertGe(p, prevPrice);
        prevPrice = p;
    }
}

contract VaultInvariants is Test {
    function invariant_NoUnclaimableAssets() public view {          // P1
        uint256 real = handler.realAssets();
        assertGe(real, vault.totalAssets());                        // solvency (passes today)
        assertLe(real - vault.totalAssets(), handler.ghost_ops());   // no slack (fails today)
    }

    function invariant_BookMatchesNetFlows() public view {          // P2 — the sharp one
        assertApproxEqAbs(
            vault.totalAssets(),
            handler.ghost_depositedGross() - handler.ghost_withdrawnNet(),
            handler.ghost_ops()
        );
    }
}
```

Run it with `runs = 256, depth = 100` or better — depth is what matters, since the drift is
proportional to the number of withdrawals.

**Plus one cheap closed-loop unit test**, which needs no fuzzer and is the one to write
first because it fails in five seconds and reads like the incident report:

```solidity
function test_FullDrainLeavesNothingBehind() public {
    // several actors deposit, interleave a dozen deposits/withdrawals,
    // then every actor redeems 100% of their shares
    assertEq(vault.totalSupply(), 0);
    assertLe(realAssets(), 20);              // dust only — fails by Σ fees today
    assertEq(vault.totalAssets(), realAssets());
}
```

If fees are orphaned, an empty vault still holds real tokens. Supply zero, balance
positive, nobody able to claim it — the bug, stated as an assertion.

**The discipline that generalises:** an invariant must compute its expected value from a
source independent of the contract under test. `assertEq(vault.totalAssets(),
vault.totalAssetsStored())` is the failure mode in miniature — the code agreeing with
itself. Ghost variables built from observed token transfers, and direct reads of
`balanceOf` on the underlying, are the only oracles here that are not downstream of the bug.

**And the review heuristic for the lead:** for each test, ask *what single-character edit to
the contract would make this fail?* For `test_WithdrawFeeBps`, the answer is "change the
constant." For the accounting bug, the answer across all 39 tests is "nothing." That's the
number to track — not coverage.

---

## Where the fix lands

`withdraw` should debit the accumulator by the amount that actually leaves the protocol:

```solidity
totalAssetsStored -= (assets - fee);   // not: -= assets
```

The historical drift is a separate question — the orphaned balance is real and still
sitting there, so a corrected vault will need a one-time reconciliation of
`totalAssetsStored` up to `realAssets` (which credits the accumulated fees to current
holders, as originally intended).

---

## Unresolved

- The `999e18`/`DEPOSIT_AMOUNT` mismatch between the first two tests: is there a deposit-side
  haircut that `totalAssets()` fails to account for? If so there is a second drift, opposite
  in sign, and P1 catches it too — but it changes the reconciliation math.
- Does `totalAssets()` include unrealised yield-protocol accrual? If yes, P2's oracle needs a
  yield term and the tolerance stops being pure dust.
- Are there other entry points (donations, direct transfers, rebases, admin) that can move
  `realAssets` without a corresponding book entry? Those need to be in the handler, or P1
  will produce false failures and get relaxed into uselessness.
- Reconciliation policy for the existing orphaned balance: credit it to current holders in a
  single write, or let it amortise?
