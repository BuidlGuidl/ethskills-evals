# Why 39 green tests and 100% coverage missed the fee drift

## Short version

The bug is not in any one call. It is in the *relationship between two numbers over
time*: `totalAssetsStored` (what the vault thinks it has) and the assets the vault
actually controls in the yield protocol. On withdrawal the vault debits its stored
total by the gross amount while only the net amount leaves the protocol — the fee
stays behind, uncounted. One withdrawal: off by 30bps, invisible. Ten thousand
withdrawals: the stored total is materially below reality, share price is understated
for everyone still in, and the difference is tokens nobody can ever redeem.

Every test in the suite asserts something about a *single state* — usually a fresh
one. The bug only exists as a *difference between two states*. No amount of
single-state assertion can see it.

---

## Test by test

### `test_DepositMintsShares`

```solidity
uint256 shares = _deposit(alice, DEPOSIT_AMOUNT);
assertEq(shares, 999e18);
assertEq(vault.shareBalance(alice), 999e18);
```

**Actually establishes:** that on an empty vault, `deposit` returns a number and
credits the same number to the depositor's balance. That the return value and the
storage write agree with each other. That's it.

**Appears to establish:** that share minting is correct. It does not. `999e18` is a
golden value copied out of a run of the implementation. It encodes the current
arithmetic, not the intended relation. If the conversion formula were wrong in a way
that also produced `999e18` from this input — an off-by-one in the virtual-share
offset, a fee applied at the wrong end, a rounding direction that favours the
depositor — the test still passes. The assertion has no independent idea of what the
right answer is, so it cannot disagree with the implementation.

Critically: this runs on an **empty vault**, where `totalSupply == 0` takes the
first-deposit branch. It says nothing about minting when a share price already exists,
and therefore nothing about minting against a share price that has *drifted*. The
understated share price in production means later depositors are over-minted shares —
they buy in cheap, diluting the people the fee was supposed to reward. That is a
second-order consequence of the same bug, and this test is structurally incapable of
seeing it because it never has a second depositor.

### `test_DepositUpdatesTotalAssets`

```solidity
_deposit(alice, DEPOSIT_AMOUNT);
assertEq(vault.totalAssets(), DEPOSIT_AMOUNT);
assertEq(vault.totalAssetsStored(), DEPOSIT_AMOUNT);
```

**Actually establishes:** that a single deposit into an empty vault increments both
accounting figures by the deposited amount.

**Appears to establish:** this is the painful one. The suite *already contains the
correct assertion* — `totalAssets()` and `totalAssetsStored()` agreeing is exactly the
property that broke — and it asserts it at the one moment in the vault's life when it
cannot possibly fail. Before any withdrawal, before any fee, on a vault with one
depositor and no history, the two are trivially equal. The test checks the invariant
at the only point where the invariant is a tautology.

It is a *reachability* check dressed as a *correctness* check. It proves the
accounting can be right; it proves nothing about whether it stays right. Divergence is
created by `withdraw`, and this test never calls `withdraw`.

### `test_WithdrawFeeBps`

```solidity
assertEq(vault.WITHDRAW_FEE_BPS(), 30);
```

**Actually establishes:** that a constant is 30.

**Appears to establish:** nothing about fees at all. This is the constant re-read from
the same source file that declares it — restating a literal in a second place and
checking the two literals match. If someone changes the fee to 50, this test fails and
the fix is to edit the test, which means it is not protecting anything. It is
noise that inflates the test count and contributes coverage on the getter.

Note what it conspicuously does not test: **where the fee goes**. The whole design
intent — "the fee stays in the protocol and accrues to remaining holders" — has zero
assertions behind it. The suite tests the fee's *magnitude* and never its
*destination* or its *effect*. The bug lives precisely in the untested half.

### `test_ConstructorSetsUsdt`

```solidity
assertEq(address(vault.usdt()), address(usdt));
```

**Actually establishes:** that a constructor argument was stored in the field named
after it.

**Appears to establish:** correct wiring. In practice it tests that Solidity performs
assignment. It cannot fail except by a typo that swaps two same-typed constructor
args — and this vault has one address arg. Pure coverage tax.

---

## How 100% coverage was compatible with this bug

Coverage answers: *was this line executed?* The property you needed answers: *did the
relationship between two quantities survive a sequence of executions?* These are
different questions, and the first is unable to approximate the second.

Concretely:

1. **The buggy line was covered.** `totalAssetsStored -= assets` executed in every
   withdrawal test and produced the right answer locally: the user received net, the
   fee remained behind. The line is green because it ran, not because it was right.

2. **Coverage is per-call; the defect is per-history.** A single withdrawal leaves a
   30bps discrepancy that no single-operation assertion has any reason to look for.
   The defect is a *sum over operations*. Coverage has no notion of a sequence — it is
   a set of visited lines, and a set forgets order and repetition, which is exactly
   the information the bug is encoded in.

3. **Every test starts from `setUp()`.** Each test sees a nearly-fresh vault: one or
   two operations, a handful of actors. Drift at n=1 is 0.3% of one withdrawal and
   below anything a hand-written `assertEq` would be written against. The suite never
   reaches the state where the bug is visible, because reaching it takes hundreds of
   interleaved operations and no human writes that test by hand.

4. **Assertions were golden values, not relations.** `999e18`, `30`,
   `DEPOSIT_AMOUNT` — all of them are "what the implementation produced, written
   down." A suite made of golden values is a change-detector for the implementation,
   not a check against a specification. It will tell you when behaviour changes. It
   will never tell you the behaviour was wrong from day one, which is what happened
   here.

5. **The one real invariant was asserted where it could not fail.** As above,
   `test_DepositUpdatesTotalAssets` had the right shape and the wrong state. Having
   the invariant in the suite gave false confidence that it was being enforced.

100% line and function coverage on this suite means: every line is reachable, and the
vault does not revert on the happy path. Both true. Neither is solvency.

---

## Why "every operation is correct in isolation" is the tell

The lead is reading it as an alibi: no single call misbehaves, therefore the code is
fine and the loss must have come from somewhere else. It is the opposite. It is the
signature of the exact bug class you have.

A bug that breaks a *single* operation gets caught by unit tests, usually within a
day, usually by the person who wrote it. Those bugs do not survive to production and
do not "quietly lose money over a long run." The bugs that do survive are, by
selection, the ones where each step is individually defensible and only the
composition is wrong. "We cannot point at a single call that misbehaves" is not
evidence of absence — it is the diagnostic criterion that tells you which kind of bug
you are holding.

Mechanically: each withdrawal is locally consistent. The user asked for X, received
X minus fee, the fee stayed in the protocol. Check the transfer — correct. Check the
user's share burn — correct. Check the fee arithmetic — correct. The error is that the
vault's *claim* about its own size was reduced by X while its *actual* holdings were
reduced by X minus fee. Both numbers are individually defensible; the pair is wrong.
There is no line to point at because the defect is in a relationship, and
relationships do not live on lines.

That is also why it is cumulative and why it presents as "quietly." A per-call bug is
loud and bounded. A relational bug compounds silently until someone reconciles the two
numbers — which, in your suite, nobody ever did past the first deposit.

Read as a signal, "correct in isolation" should have routed you to invariant testing
immediately. That is precisely the class of property that isolation-based testing
cannot reach: the vault is a stateful protocol with multiple interacting entry points,
and its correctness condition is a conservation law over histories, not a postcondition
on any one call.

---

## The property the suite should have asserted

Two properties. The first catches the drift directly; the second catches the *intent*
that the drift violates, and would survive a refactor that changes how the accounting
is stored.

### P1 — Accounting conservation (no phantom, no orphan)

> After **any** sequence of deposits and withdrawals by **any** set of actors, the
> vault's recorded total equals the assets the vault actually controls in the yield
> protocol, up to a tolerance that is bounded by per-operation rounding and does not
> grow with the number or size of operations.

Precisely:

```
| totalAssetsStored() - yieldProtocol.balanceOfUnderlying(address(vault)) |  <=  opCount
```

(one wei of rounding slack per operation; the tolerance is linear in operation *count*
and independent of operation *value*). With a fee of 30bps, the buggy vault's error
grows as `Σ 0.003 × withdrawalAmount` — proportional to value moved — so it blows
through this bound almost immediately and keeps going. That is the distinguishing
shape: **rounding error is bounded by op count; a missing-accounting bug is
proportional to value.** Writing the tolerance in terms of op count rather than a
percentage is what makes the assertion able to tell them apart.

The vault must never think it has *more* than it holds (insolvency) nor *less*
(orphaned funds). Your bug is the second direction, which is why nothing reverted and
nothing looked broken — an asymmetric assertion (`assertGe(held, stored)`) would have
passed all the way through. Assert the two-sided bound.

### P2 — The fee actually accrues to remaining holders

> A withdrawal never decreases the price per share for the holders who remain.

Precisely: for a withdrawal executed at a state where `totalSupply > 0` both before
and after,

```
pricePerShare_after >= pricePerShare_before
```

and, when a fee was actually charged and shares remain outstanding, **strictly**
greater by approximately `fee / totalSupply_after`.

This is the design intent stated as an assertion, and it is the one the entire suite
omitted. `test_WithdrawFeeBps` checks that the fee is 30bps; nothing checks that the
30bps *does what it is for*. In the buggy vault, the fee is removed from the recorded
total at the moment it is charged, so `pricePerShare` after a withdrawal is flat
instead of rising — the remaining holders get nothing. P2 fails on the very first
withdrawal, in a test that needs no long sequence at all.

Note P2 catches the bug at n=1 while P1 catches it at scale. Have both: P2 localises
it, P1 proves the fix holds over histories.

### Test shape

An invariant test with a handler, plus one unit test for P2's n=1 case.

```solidity
// test/invariant/VaultInvariant.t.sol
contract VaultInvariantTest is Test {
    Vault vault;
    MockUSDT usdt;
    MockYield yield;
    VaultHandler handler;

    function setUp() public {
        usdt    = new MockUSDT();
        yield   = new MockYield(usdt);
        vault   = new Vault(usdt, yield);
        handler = new VaultHandler(vault, usdt, yield);

        targetContract(address(handler));   // only the handler is called
    }

    // P1: recorded total tracks reality, two-sided, tolerance in op count not value
    function invariant_StoredTotalMatchesHeld() public view {
        uint256 stored = vault.totalAssetsStored();
        uint256 held   = yield.balanceOfUnderlying(address(vault));
        assertApproxEqAbs(stored, held, handler.opCount(),
            "accounting drifted from real holdings");
    }

    // P2: no withdrawal ever cheapens the remaining holders' shares
    function invariant_SharePriceNeverDecreases() public view {
        assertGe(handler.lastPricePerShare(), handler.minPricePerShareSeen(),
            "share price went backwards");
    }

    // corollary of P1: everything held is claimable by someone
    function invariant_NoOrphanedAssets() public view {
        uint256 claimable;
        address[] memory actors = handler.actors();
        for (uint256 i; i < actors.length; ++i) {
            claimable += vault.previewRedeem(vault.shareBalance(actors[i]));
        }
        assertApproxEqAbs(claimable, yield.balanceOfUnderlying(address(vault)),
            handler.opCount(), "assets held by nobody");
    }
}

contract VaultHandler is Test {
    uint256 public opCount;
    uint256 public lastPricePerShare;
    uint256 public minPricePerShareSeen = type(uint256).max;
    address[] internal _actors;   // fixed pool, so sequences revisit the same users

    function deposit(uint256 actorSeed, uint256 amount) public {
        address actor = _pickActor(actorSeed);
        amount = bound(amount, 1e6, 1e30);
        deal(address(usdt), actor, amount);

        vm.startPrank(actor);
        usdt.approve(address(vault), amount);
        vault.deposit(amount);
        vm.stopPrank();

        _record();
    }

    function withdraw(uint256 actorSeed, uint256 shares) public {
        address actor = _pickActor(actorSeed);
        uint256 max = vault.shareBalance(actor);
        if (max == 0) return;
        shares = bound(shares, 1, max);

        vm.prank(actor);
        vault.withdraw(shares);

        _record();
    }

    function _record() internal {
        ++opCount;
        if (vault.totalSupply() > 0) {
            lastPricePerShare = vault.previewRedeem(1e18);
            if (lastPricePerShare < minPricePerShareSeen) {
                minPricePerShareSeen = lastPricePerShare;   // ratchet: any dip is recorded
            }
        }
    }
}
```

Configure it to actually explore:

```toml
[invariant]
runs = 512
depth = 100          # long histories — the bug needs repetition to become visible
fail_on_revert = false
```

Three things make this shape work where the existing suite failed:

- **A fixed actor pool.** Random fresh addresses give you isolated deposits that never
  interact. Drawing from a handful of reused actors produces the interleaving —
  deposit, someone else withdraws, deposit again at the now-wrong price — that surfaces
  both the drift and the over-minting it causes.
- **`depth = 100`.** The bug is a sum over operations. Short sequences hide it by
  construction; the assertion is only as good as the history it runs against.
- **Ghost state in the handler.** P2 is a statement about a *transition*, and an
  `invariant_` function only sees the final state. Recording the price after every
  operation and ratcheting the minimum is how you turn a transition property into
  something a terminal assertion can check.

And the n=1 companion, which is the test that should have existed all along in place
of `test_WithdrawFeeBps`:

```solidity
function test_WithdrawFeeAccruesToRemainingHolders() public {
    _deposit(alice, 1000e18);
    _deposit(bob,   1000e18);

    uint256 priceBefore = vault.previewRedeem(1e18);
    uint256 aliceShares = vault.shareBalance(alice);

    vm.prank(alice);
    uint256 received = vault.withdraw(aliceShares);

    uint256 fee = (grossFor(aliceShares) * vault.WITHDRAW_FEE_BPS()) / 10_000;
    assertEq(received, grossFor(aliceShares) - fee, "alice paid the fee");

    // the fee did not vanish: bob's claim went up by exactly it
    assertGt(vault.previewRedeem(1e18), priceBefore, "fee did not accrue to bob");
    assertApproxEqAbs(
        vault.previewRedeem(vault.shareBalance(bob)),
        1000e18 + fee,
        1,
        "bob did not receive the fee"
    );

    // and the books still match reality
    assertApproxEqAbs(vault.totalAssetsStored(),
        yield.balanceOfUnderlying(address(vault)), 1);
}
```

That last test fails on the shipped contract, on the first withdrawal, with two users
and no fuzzing. The suite had 39 tests and none of them was it — because all 39 asked
"did this call return the right number?" and none asked "where did the money go?"
