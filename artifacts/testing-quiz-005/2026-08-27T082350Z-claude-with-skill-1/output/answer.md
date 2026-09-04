# Why 39 green tests and 100% coverage missed the drift

## The shape of the bug, first

Two representations of one quantity:

- **the book** — `totalAssetsStored`, what the vault believes it has
- **reality** — USDT the vault actually controls (its position in the yield protocol, plus any idle balance)

Every operation must move both by the same delta. `withdraw` doesn't: it debits the book by the
**gross** amount attributable to the burned shares, but only **net** (gross − 30bps) actually leaves.
The fee stays in the protocol — as intended — and stops being counted — not as intended.

Per call the discrepancy is 30bps. It is never corrected. The drift is the running sum of every fee
ever charged. Share price (`totalAssets / totalShares`) is understated by exactly that sum, so
everyone still in is under-credited, and the uncounted tokens correspond to no shares and are
therefore claimable by nobody. Nothing is insolvent, which is precisely why the usual solvency
assertion would have passed too. See "the `>=` trap" below.

---

## The four tests, one at a time

### `test_DepositMintsShares`

**Actually establishes:** for one hardcoded amount, into an empty vault, `deposit` returns `999e18`,
credits the same number to alice, and doesn't revert. The return value and the stored balance agree
with each other.

**Only appears to establish:** that share issuance is correct.

- `999e18` is a magic number that was read off a run of the implementation. It's not derived from a
  spec anywhere in the test. A test whose expected value came *from* the code under test can detect
  a *change* in behavior; it cannot detect *wrong* behavior. It is a change-detector wearing a
  correctness test's clothes.
- The vault is empty. On the first deposit the exchange rate is definitional — 1:1, or whatever the
  constructor fixes. **The share price is never exercised.** The exchange rate is the single quantity
  this bug corrupts, and this test runs in the one state where it can't be wrong.
- The second assertion is near-tautological with the first: it checks that the function returned the
  same number it stored. Both come from one write.

### `test_DepositUpdatesTotalAssets`

**Actually establishes:** after a single deposit into an empty vault, `totalAssets()` and
`totalAssetsStored()` both report the deposited amount.

**Only appears to establish:** that the vault's accounting tracks reality. This is the near-miss —
right variables, wrong reference point, wrong point in the lifecycle.

- It compares **an internal number to another internal number**, both written by the same statement,
  and then to the test's own input. It never once looks at the external ground truth:
  `yield.balanceOfUnderlying(address(vault))`. The bug is definitionally a divergence between the
  book and the outside world, and this test never crosses that boundary.
- It runs *before any withdrawal has ever happened*. The faulty debit lives in `withdraw`. The test
  is on the wrong side of the only operation that introduces error.

This is the test that had every opportunity. Change its right-hand side from `DEPOSIT_AMOUNT` to the
protocol balance, and move it after a withdrawal, and the suite catches the bug.

### `test_WithdrawFeeBps`

**Actually establishes:** the public constant `WITHDRAW_FEE_BPS` is 30.

**Only appears to establish:** anything at all about withdrawal fees.

It asserts the *declared* rate. It never asserts that the amount *charged* corresponds to that rate,
never that the amount charged *stays* in the protocol, and never what happens to the *books* when it
does. The entire bug is about the fate of the fee after it's retained. This test names the fee and
checks nothing about it — while contributing a green tick, a line of coverage, and a false sense that
"the fee is tested."

Note what the whole slice implies: two of four tests mention withdrawal, and **no test in the slice
performs one.**

### `test_ConstructorSetsUsdt`

**Actually establishes:** `setUp()` deployed the vault with the token address you think it did.
As a smoke test of the fixture, marginally useful.

**Only appears to establish:** anything about behavior. It asserts that an assignment assigned. It is
a test of the Solidity compiler, and the compiler is not the thing that failed.

---

## Why 100% coverage was never going to catch this

**Coverage measures which lines executed, not which claims were checked.** It is a property of the
implementation's control flow, not of your specification. A test that runs a line and asserts nothing
about its effect marks that line covered exactly as strongly as a test that pins its every
consequence. `forge coverage` cannot report on an assertion you never wrote, because there is no
artifact for it to observe. The bug lives entirely in the space of unasserted properties, which is
invisible to coverage **by construction**, not by oversight.

The sharper way to see it: the faulty line

```solidity
totalAssetsStored -= grossAssets;   // should be: -= netAssets
```

is 100% covered. It executed in every withdrawal test. The mutant that produced this bug — swap
`net` for `gross` — **survives all 39 tests**. Coverage answers "did we reach it." Mutation testing
answers "would we have noticed." The lead is quoting the first number as though it were the second.

Two more structural reasons, both visible in the slice:

1. **Every test is depth-1 from genesis.** Each starts from a fresh `setUp()`, performs one
   operation, asserts, and ends. Drift is a *cumulative* quantity — it is zero at genesis and grows
   one fee at a time. A suite of single-operation tests is structurally incapable of observing an
   accumulating discrepancy, at any run count. This isn't a gap you close by adding more tests of the
   same shape; 39 became 390 and the answer stays green.
2. **Every test has one actor.** The harm — "share price understated for everyone still in" —
   requires someone to *still be in* when someone else leaves. With a single actor, the withdrawer is
   the vault, and any drift they cause is drift in an account about to be closed. You need a second
   holder for the property to even be expressible.

---

## Why "every operation is correct in isolation" is the diagnosis, not the defence

The defence assumes:

> system correctness == conjunction of per-operation correctness

For a stateless pure function that holds. For a stateful protocol it is false. The real condition is:

> system correctness == per-operation correctness **AND** the invariants that bind operations across time

A conservation law is not a property of any single transition. It's a property of the *sum* of
transitions. So the observation "every call is individually fine, yet the aggregate is wrong" isn't
exculpatory — it is a **localisation**. It says, with precision: the fault is in the class of
properties that no single-call test can express. That's the one place left for it to be.

Concretely: the withdrawer's payout is right. Their shares burned is right. The fee retained is right
and the correct 30bps. The event is right. Each call is locally consistent — book and shares balance
*at the moment of the call*, against each other. The error is in the relationship between the book
and reality *across* calls, and no observer standing inside one call can see it. "We cannot point at
a single call that misbehaves" is what a broken invariant sounds like from the inside.

So the correct reading of the lead's sentence is: *we have confirmed the bug is exactly the kind our
suite is built not to find.*

---

## The property the suite should have asserted

### P1 — Two-sided conservation (the primary one)

For **every** reachable state:

```
vault.totalAssets() == yield.balanceOfUnderlying(address(vault)) + usdt.balanceOf(address(vault))
```

Read it as: *the vault's books equal the assets the vault controls — no less, and no more.*

**The `>=` trap.** The invariant people actually write is the solvency half:

```solidity
assertGe(controlledBalance, vault.totalAssets());   // "we can pay everyone out"
```

**This bug passes that assertion on every single run.** The vault holds *more* than it thinks.
Solvency is half a property. You need both directions:

- `controlled >= totalAssets()` — solvency: the vault can't owe more than it holds.
- `controlled <= totalAssets()` — **completeness**: no value the vault controls is orphaned outside
  the share accounting.

Drift bugs, donation attacks, and unclaimable-dust bugs all live under the second half, which is why
the second half is the one worth writing down.

**On tolerance:** rounding may force `assertApproxEqAbs` rather than `assertEq`. The tolerance must
be a small absolute constant, or at worst linear in the number of operations (a few wei per op). It
must **never** be a percentage of TVL — a proportional tolerance re-creates the exact bug inside the
assertion and will absorb the drift it was written to detect.

### P2 — Fee accrual monotonicity (encodes the *intent*)

Where `pps() = totalAssets() * 1e18 / totalShares()`, for every operation, whenever
`totalShares() > 0` both before and after:

```
pps_after >= pps_before
```

and strictly greater when a fee was charged and shares remain outstanding.

The fee is *meant* to accrue to whoever is still in. So a withdrawal must **raise** the price per
share for the remaining holders. Under the bug it stays flat or falls. P2 is what turns "quietly
losing our users money" from a postmortem sentence into a failing assertion.

(Skip the check and reset the high-water mark when `totalShares() == 0` — after a full exit, pps is
undefined and the next depositor legitimately re-establishes it.)

### P3 — Nothing is unclaimable

After every holder redeems every share, in any order, the residual controlled balance is within the
dust bound. This is P1 restated at the terminal state, and it is the property whose violation is the
user-facing harm.

---

## Test shape

### The 12-line regression test — depth 2, and it was always enough

The suite didn't need 10,000 fuzz runs. It needed a second actor and a withdrawal in the same test.

```solidity
function test_WithdrawFeeAccruesToRemainingHolders() public {
    _deposit(alice, DEPOSIT_AMOUNT);
    _deposit(bob,   DEPOSIT_AMOUNT);

    uint256 ppsBefore = _pps();
    _withdrawAll(alice);

    // P2: the fee is supposed to make bob's shares worth more.
    assertGt(_pps(), ppsBefore, "withdraw fee must accrue to remaining holders");

    // P1: and it must still be on the books.
    assertEq(vault.totalAssets(), _controlled(), "books drifted from controlled balance");
}

function _pps() internal view returns (uint256) {
    return vault.totalShares() == 0 ? 0 : vault.totalAssets() * 1e18 / vault.totalShares();
}

function _controlled() internal view returns (uint256) {
    return yield.balanceOfUnderlying(address(vault)) + usdt.balanceOf(address(vault));
}
```

Both assertions fail against the shipped code. Note `_controlled()` — the right-hand side is read
from the outside world, never from the vault. An assertion whose two sides both come from the
contract under test can only prove the contract is self-consistent, and this contract *is*
self-consistent. It's just wrong.

### The invariant suite — what actually generalises

```solidity
contract VaultInvariantTest is Test {
    Vault vault; MockUSDT usdt; MockYield yield; VaultHandler handler;

    function setUp() public {
        usdt    = new MockUSDT();
        yield   = new MockYield(usdt);
        vault   = new Vault(usdt, yield);
        handler = new VaultHandler(vault, usdt, yield);

        targetContract(address(handler));
        bytes4[] memory sels = new bytes4[](3);
        sels[0] = VaultHandler.deposit.selector;
        sels[1] = VaultHandler.withdraw.selector;
        sels[2] = VaultHandler.accrueYield.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: sels}));
    }

    // P1 — equality, both directions. `assertGe` here is the bug's alibi.
    function invariant_BooksEqualControlledBalance() public view {
        uint256 controlled = yield.balanceOfUnderlying(address(vault))
                           + usdt.balanceOf(address(vault));
        assertApproxEqAbs(vault.totalAssets(), controlled, handler.callCount(),
            "accounting drifted from controlled balance");
    }

    // P2 — high-water mark maintained by the handler around every action.
    function invariant_SharePriceNeverDecreases() public view {
        if (vault.totalShares() == 0) return;
        assertGe(_pps(), handler.ppsHighWater(), "share price fell");
    }

    // P3 — every holder can be made whole; nothing orphaned.
    function invariant_FullExitLeavesNoDust() public {
        uint256 snap = vm.snapshot();
        handler.forceFullExitAllActors();
        assertLe(
            yield.balanceOfUnderlying(address(vault)) + usdt.balanceOf(address(vault)),
            handler.callCount(),
            "value left behind that no share can claim"
        );
        vm.revertTo(snap);
    }

    // Guardrail: a handler that silently no-ops is a green suite that tested nothing.
    function invariant_HandlerActuallyRan() public view {
        assertGt(handler.withdrawCount(), 0, "no withdrawals executed");
        assertGt(handler.actorCount(),    1, "single-actor runs cannot express P2");
    }
}
```

Handler requirements — these are the parts that decide whether the suite finds the bug:

- **A bounded actor set, not `msg.sender`.** Fresh senders every call means every actor is a
  single-actor test again. Use ~4 fixed actors, `bound()` the index, `vm.prank` the chosen one.
- **Withdrawals must actually land.** The common failure is a handler that early-`return`s when the
  actor has no shares, in every call, forever — a permanently green invariant suite that never
  withdrew. Hence `invariant_HandlerActuallyRan`. Track `withdrawCount` and check it.
- **Ghost variables:** `ghost_deposited`, `ghost_withdrawnNet`, `ghost_feesRetained`,
  `ppsHighWater`, `callCount`. `ghost_deposited - ghost_withdrawnNet` is an independent
  reconstruction of what the vault *should* hold, computed entirely outside the contract.
- **`accrueYield`** in the action set, so P1 and P2 are tested against a moving share price rather
  than a constant one. A conservation invariant that only ever sees a 1:1 ratio is a weaker test than
  it looks.
- **`fail_on_revert = false`** with the guardrail above — otherwise a handler that reverts on
  everything passes silently.

```toml
[invariant]
runs = 512
depth = 50
fail_on_revert = false
```

`depth = 50` is what turns "30bps once" into visible drift, and it's the dimension the whole existing
suite has pinned at 1.

---

## Coda: the fix, and the reason it's structural

Two options:

1. Debit only what leaves: `totalAssetsStored -= netAssets`. The retained fee stays counted, so the
   next `pps()` is higher — which is the intended behavior, now expressed in code.
2. Delete `totalAssetsStored` and derive `totalAssets()` from the protocol position. **You cannot
   drift from a number you don't store.** Caveat: a balance-derived `totalAssets()` is exposed to
   donation/inflation attacks, so this trades one class of bug for another — take it only with
   virtual shares or a dead-shares floor in place.

Either way, keep P1 as a standing invariant. The general lesson: this bug existed because the
contract held two copies of one fact and nothing checked they agreed. Testing that *any* two
representations of one quantity stay in lockstep — book vs. balance, shares vs. supply, sum of parts
vs. total — is where drift bugs live, and it's the class the whole existing suite skipped.

Separately, and out of scope here: the already-orphaned surplus needs a recovery decision. Note that
the obvious `syncTotalAssets()` is dangerous — it hands the entire accumulated surplus to whoever
deposits in the block before it's called. Fixing the accounting forward and distributing the backlog
are two different problems.

---

## Unresolved

- Where does `999e18` come from — an entry fee, a virtual-share offset, or a rounding artifact? It
  changes whether `deposit` has a second accounting bug alongside this one.
- Does the yield protocol expose a reliable `balanceOfUnderlying` for the vault, or does P1's
  right-hand side have to be reconstructed? That determines whether the invariant is cheap or needs a
  fork test.
- Is `totalAssets()` currently just a getter over `totalAssetsStored`, or does it already add
  something on top? Two views agreeing in `test_DepositUpdatesTotalAssets` suggests the former, which
  makes that test fully tautological rather than merely weak.
