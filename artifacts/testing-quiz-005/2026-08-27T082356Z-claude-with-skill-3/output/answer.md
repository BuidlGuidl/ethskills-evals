# Why 39 green tests and 100% coverage missed the drift

## The shape of the bug, stated first

The vault keeps a ledger (`totalAssetsStored`, surfaced by `totalAssets()`) and it keeps
holdings (real tokens sitting in the yield protocol). On withdrawal it owes the user
`assets - fee` and it debits the ledger. The debit is the gross `assets`; the transfer out
is the net `assets - fee`. Every withdrawal therefore removes 30bps more from the ledger
than leaves the vault.

```
ledger_after  = ledger_before - assets
held_after    = held_before   - (assets - fee)
drift        += fee                          // monotonic, one term per withdrawal
```

Consequences, all of which match the report: nothing is insolvent (`held > ledger`, the
vault holds more than it thinks); share price is understated for everyone still in, because
pps is computed off the ledger; the fee tokens are real and unclaimable, because no share is
backed by them. And no single call misbehaves — each withdrawal is internally consistent
with the ledger as it found it. The ledger is just wrong on entry, by the sum of all prior
fees.

Keep that last sentence in view. It is the whole answer to the "correct in isolation"
question.

---

## The four tests, one at a time

### `test_DepositMintsShares`

**Actually establishes:** from `setUp()` state, one deposit of `DEPOSIT_AMOUNT` by one
address mints exactly `999e18` shares and credits them to that address. One point, one input,
one starting state.

**Only appears to establish:** that the share-minting formula is correct.

It cannot establish that, for two reasons.

`999e18` is a golden constant — a number copied out of the implementation's output and
frozen. It does not encode a relationship (proportionality, round-tripping,
`convertToShares ∘ convertToAssets ≈ id`), so it cannot disagree with the implementation
about anything except change. If the formula was wrong when the test was written, the test
was written wrong too, and it will stay green forever. It is a change-detector wearing a
specification's clothes.

Worse, it only ever runs against an **empty vault**, where share price is fixed by
definition — first depositor, no prior state, price set by fiat. The entire interesting
behavior of share math is what the *second* depositor gets after value has accrued or been
retained. This test never observes a non-trivial price per share, so it is structurally
incapable of noticing that pps is understated. The bug's whole effect lives in a state this
test never enters.

Side note worth chasing: shares are `999e18` while `totalAssets()` is `DEPOSIT_AMOUNT`
(per the next test). Share price starts at ≠ 1. That's either an entry fee, a virtual-share
offset, or a bug — and the test enshrines the number without saying which. A test that
asserts a magic constant cannot tell you what the constant means.

### `test_DepositUpdatesTotalAssets`

**Actually establishes:** after a single deposit into an empty vault, `totalAssets()` and
`totalAssetsStored()` both equal a constant defined in the test file.

**Only appears to establish:** that the vault's accounting tracks reality.

This is the load-bearing failure of the suite, and it fails in the exact dimension of the
bug. The bug is a divergence between the ledger and the holdings. This test compares the
ledger to a **test-local constant**, and compares `totalAssets()` to `totalAssetsStored()` —
which are two views of the same internal number. Every assertion here is internal
self-consistency. Not one of them reaches outside the vault to ask how many tokens it
actually controls.

Both numbers moving together is precisely what you observe when both are wrong. The buggy
vault passes this test on day one and on day one thousand.

And it runs after a *deposit*. Withdrawal is the only operation that can create the drift.
The one test named for accounting never sees the operation that breaks accounting.

### `test_WithdrawFeeBps`

**Actually establishes:** a public constant equals 30. A compile-time fact, restated at
runtime.

**Only appears to establish:** that the fee is tested.

This test is the most dangerous of the four, not the most harmless, because it puts the word
"fee" in the test log and in the coverage report. It says nothing about whether the fee is
deducted from the user, whether it stays in the protocol, whether the accounting recognizes
it as retained value, or who ends up owning it. The stated design intent — *the fee accrues
to whoever is still in the vault* — appears nowhere in the suite as an assertion. It exists
only in prose, and the prose is exactly what the code got wrong.

If a design intent is not an assertion, it did not ship.

The only failure this test can produce is "you changed a constant you meant to change."

### `test_ConstructorSetsUsdt`

**Actually establishes:** the constructor assigned its argument to a public field. This tests
that Solidity assignment works.

**Only appears to establish:** that the vault is wired up correctly.

Pure tautology. It cannot fail for a reason anyone cares about. What would have been worth
testing about this dependency is that the vault survives USDT's non-standard ERC20 behavior
(no boolean return on `transfer`, approve-race semantics) against the real deployed token on
a fork — which this test, and a mock that returns `bool`, both silently skip.

Tests 3 and 4 are **coverage tests**: they exist, they pass, they raise the function-coverage
number, and their expected-value contribution to catching a bug is zero. Two of the four
tests in a "representative slice" are in this class, which tells you something about the
other 35.

---

## How 100% coverage was compatible with this

**Coverage measures which lines executed. It does not measure which claims were checked.**
Coverage is a property of the execution trace; bug-detection is a property of the assertions.
Those are independent. A suite with every `assertEq` deleted still reports 100% line and
function coverage. The buggy line — `totalAssetsStored -= assets` — is marked covered the
moment any test calls `withdraw` once, and it is marked covered identically whether it
subtracts the gross or the net. Coverage told the lead the line ran. Nobody asked whether
anything would have noticed if it ran wrong.

**The defect is not in a line.** It is a relationship between two quantities in two different
functions: what `deposit` adds to the ledger versus what `withdraw` subtracts, measured
against what actually moved. There is no line you can visit that exhibits it, because every
line is locally correct. `withdraw` genuinely owes the user `assets - fee`. It genuinely
burns the right shares. It genuinely debits the ledger. The error is the *choice of which
quantity* to debit, and that choice is only wrong relative to the world outside the function.
Line coverage is per-line; the bug lives in the composition. Per-line instrumentation cannot
see a composition defect in principle, not just in practice.

**The state space was explored to depth 1.** Every test starts from `setUp()` and performs
one operation. The drift is cumulative and monotonic in the number of withdrawals — it is a
*sum over a sequence*. A suite whose longest sequence has length one cannot observe a
quantity that only exists over sequences of length N. "100% coverage" here means 100% of
lines, on a state machine explored to a depth of one call. Those are wildly different claims
and the number does not distinguish them.

**A fee test that never tests the fee's effect.** The one lever that creates the drift had a
test named after it. That is how the gap survived review: someone reading the test list saw
`test_WithdrawFeeBps` and checked the box.

---

## Why "every operation is correct in isolation" is the tell

Because that is the *diagnostic signature of a conservation bug*, and the team is reading it
as an exoneration.

Run the contrapositive. If a single call misbehaved, a unit test on that call would find it —
and with 39 tests and 100% function coverage, one probably would have. So the fact that no
single call is wrong is not evidence that nothing is wrong. It is evidence about **where** the
wrongness is: not in a call, but in a quantity that is supposed to be preserved *across*
calls and isn't. "We cannot point at a single call that misbehaves" is not the absence of a
bug. It is a location.

Concretely: each withdrawal is correct *under the ledger it inherits*. The ledger was
silently corrupted by the previous withdrawal. The error is in the relation between
successive states, and there is no single state in which it is visible — you have to look at
the delta, or at the ledger against an external reference. A suite that only inspects states,
one at a time, from a fresh fixture, is blind to it by construction. Not unlucky. Blind by
construction.

The general form: **a system can satisfy every local postcondition while losing a global
property.** Per-call assertions are the wrong instrument for global properties, and no
quantity of them fixes it — 39 depth-1 tests and 3,900 depth-1 tests are equally blind here.
Unit tests *sample* the state space. Invariant tests *quantify over* it. The bug lives in the
quantifier.

There is also a specific tell about the fee. **The fee is the only value in the system that
changes ownership without changing location.** Every other movement has a matching transfer:
tokens in, ledger up; tokens out, ledger down. The fee moves from "the withdrawer's claim" to
"the remaining holders' claim" while the tokens sit still. Any such movement needs an explicit
accounting entry, and if you forget it the ledger and the holdings diverge by exactly the sum
of the omitted entries — which is what happened, to the wei. The standing checklist for this
class: fees, rebases, donations, slashing, rounding dust. Value that moves without a transfer.

---

## The property that catches it

### Primary: the ledger equals the holdings, always, with a bound that does not grow

Let `held(vault)` be everything the vault actually controls:

```
held = usdt.balanceOf(address(vault)) + yieldProtocol.balanceOfUnderlying(address(vault))
```

> **Invariant.** After *any* sequence of deposits, withdrawals, and yield accruals, of any
> length, by any set of actors:
>
> ```
> | vault.totalAssets() - held(vault) |  <=  DUST
> ```
>
> where `DUST` is a small **absolute** constant covering integer-division rounding, fixed at
> a handful of wei, and **not** a function of call count, volume, or elapsed time.

Three things about that statement are load-bearing.

**It is two-sided.** The natural instinct is to write the solvency invariant,
`held >= totalAssets()` — "the vault can always pay what it says it owes." *That invariant is
satisfied by this bug.* The report says so explicitly: nothing is insolvent, the vault holds
more than it thinks. The one-sided version is the invariant most teams write and it would
have shipped this bug too. The failure is on the surplus side, and only the equality catches
it. Unaccounted assets are a bug of the same family as missing assets; they are just the one
nobody writes the assert for.

**The tolerance is absolute, not proportional.** The entire failure mode is a term that
accumulates. If you write `assertApproxEqRel(..., 0.01e18)` you have legalized the bug for the
first ~3 withdrawals and merely delayed detection. If you write
`assertApproxEqAbs(..., callCount * 1 wei)` you have legalized it permanently. The tolerance
must be a constant, so that anything which grows with the number of operations eventually
crosses it — and at 30bps per withdrawal, "eventually" is the second or third call.

**It compares against an external reference.** This is the thing
`test_DepositUpdatesTotalAssets` failed to do. `held` must be read from the yield protocol's
own accounting, not from a mirror of the vault's assumptions. Which means: **fork-test it**
against the real protocol. If you mock the yield source with something that returns the
amount you deposited, `held` is computed from the same belief that `totalAssets()` is, and you
have rebuilt the exact self-consistency trap — a green invariant asserting the vault agrees
with itself.

### Secondary invariants, each catching a different face of the same defect

```
// The design intent, finally written down as an assertion.
// A withdrawal must never dilute the holders who stayed; when a fee is charged
// and shares remain, it must strictly enrich them.
pps = totalAssets() * 1e18 / totalShares
    pps_after >= pps_before                      // for every operation
    pps_after >  pps_before                      // for a fee-charging withdrawal with shares left
```

In the buggy vault the fee is debited from the ledger, so pps stays flat across a withdrawal
instead of rising. This catches the bug from the economic direction and is the direct
encoding of "the fee accrues to whoever is still in the vault."

```
// Local form: the ledger may only fall by what actually left.
Δ totalAssetsStored  ==  -(tokens transferred out)     // per withdrawal
```

Same defect, asserted at the exact call that causes it — far better failure output than a
global drift discovered 40 calls later.

```
Σ shareBalance(user) == totalShares                     // cheap, different bug class
deposit-then-withdraw returns <= deposited, and >= deposited * (1 - 30bps) - dust
```

### The test shape

An invariant test with a handler. The details that decide whether it works:

```solidity
contract VaultInvariants is Test {
    Vault vault; VaultHandler handler;

    function setUp() public {
        vm.createSelectFork("mainnet", 19_000_000);   // real yield protocol, real USDT
        vault   = new Vault(USDT, YIELD_PROTOCOL);
        handler = new VaultHandler(vault);
        targetContract(address(handler));             // ONLY the handler
        // exclude vault/token, or the fuzzer calls them with garbage and everything reverts
    }

    function invariant_LedgerMatchesHoldings() public view {
        assertApproxEqAbs(
            vault.totalAssets(), handler.heldByVault(), MAX_DUST,
            "ledger drifted from actual holdings"
        );
    }

    function invariant_FeesAccrueToRemainingHolders() public view {
        assertGe(
            vault.totalAssets() + handler.ghost_withdrawnNet(),
            handler.ghost_deposited(),
            "retained fees are missing from the accounted total"
        );
    }

    function invariant_CallSummary() public view { handler.printCalls(); }  // anti-vacuity
}

contract VaultHandler is Test {
    address[] actors;              // ~5 fixed actors, reused — drift needs repeat interleaving
    mapping(bytes32 => uint256) public calls;
    uint256 public ghost_deposited; uint256 public ghost_withdrawnNet;

    function withdraw(uint256 actorSeed, uint256 pct) external useActor(actorSeed) {
        uint256 shares = bound(pct, 0, 100) * vault.shareBalance(currentActor) / 100;
        if (shares == 0) { calls["withdraw_skipped"]++; return; }   // skip, never revert

        uint256 ledgerBefore = vault.totalAssetsStored();
        uint256 heldBefore   = heldByVault();
        uint256 ppsBefore    = pps();

        vm.prank(currentActor);
        uint256 out = vault.withdraw(shares);

        assertEq(ledgerBefore - vault.totalAssetsStored(),
                 heldBefore   - heldByVault(),
                 "ledger debited more than left the vault");        // <-- fires here
        if (vault.totalShares() > 0)
            assertGe(pps(), ppsBefore, "withdrawal diluted remaining holders");

        ghost_withdrawnNet += out; calls["withdraw"]++;
    }
    // deposit(actorSeed, amount) and accrueYield(amount) in the same style
}
```

```toml
[invariant]
runs = 512
depth = 50
fail_on_revert = true     # handlers make only valid calls; silent reverts = vacuous pass
```

Two operational notes. Handlers must **return early rather than revert** on
impossible actions — a handler that reverts on "actor has no shares" turns most of the
sequence into no-ops and the suite passes vacuously; the `invariant_CallSummary` counter
exists so you can *see* that `withdraw` actually ran and wasn't bounced. And the fixed actor
set matters: dealing a fresh random `msg.sender` per call means nobody ever withdraws after
anyone else deposited, which is the interleaving the drift needs.

At depth 50 with 30bps per withdrawal, this fails on the first sequence containing two
withdrawals. It does not need luck.

### If you want the cheap version today

One fuzzed multi-op test, no handler rig, catches this specific bug:

```solidity
function testFuzz_LedgerTracksHoldingsAcrossWithdrawals(
    uint256[8] memory amounts, uint256[8] memory pcts
) public {
    // alice and bob deposit, then 8 interleaved partial withdrawals
    ...
    assertApproxEqAbs(vault.totalAssets(), heldByVault(), MAX_DUST);
}
```

Strictly weaker than the invariant suite — it explores one call ordering you chose rather
than 512 the fuzzer chose — but it is an hour of work and it turns red today.

---

## The check that would have settled the argument with the lead

Run mutation testing. Flip `-= assets` to `-= (assets - fee)` — i.e. inject the *correct*
line as a mutant of the shipped one, or vice versa — and see whether any of the 39 tests
fails. None does. That is the objective statement of the problem: **the suite does not
specify that line.** It executes it and has no opinion about it.

Three different questions, routinely conflated into one number:

| Question | Answered by |
|---|---|
| Did the code run? | coverage |
| Would we notice if it were wrong? | mutation score |
| Is the thing we actually care about still true, over arbitrary histories? | invariants |

The suite scored 100% on the first and was never asked the other two. 100% coverage was not
a thorough suite that got unlucky; it was a measurement of something other than thoroughness.

---

## What the four tests should have been

1. `test_DepositMintsShares` → assert the *relationship*, not the constant: shares are
   proportional to assets at the current price; a second depositor into a vault with accrued
   value gets fewer shares per token than the first; `convertToShares(convertToAssets(s)) ≈ s`.
2. `test_DepositUpdatesTotalAssets` → compare `totalAssets()` to `held(vault)`, never to a
   test constant and never to `totalAssetsStored()`.
3. `test_WithdrawFeeBps` → delete. Replace with: a withdrawal of X delivers `X*(1 - 0.003)`
   to the user, leaves `X*0.003` in the protocol, and raises pps for everyone remaining.
4. `test_ConstructorSetsUsdt` → delete. Replace with a fork test that the vault round-trips
   against real USDT, whose `transfer` returns no boolean.

---

## Unresolved

- Is `999e18`-on-`1000e18` an entry fee, a virtual-share offset, or a second bug? The suite
  can't say, and it changes whether the deposit path also needs an accounting entry.
- Is the fee retained as underlying inside the yield protocol, or held as idle balance in the
  vault? Determines the exact form of `held(vault)`.
- What should happen to the already-orphaned surplus on the deployed vault — donate it to
  current holders by re-syncing the ledger, or distribute it to the historical withdrawers who
  paid it? That's a policy call, not a testing one, and it needs answering separately from the
  fix.
