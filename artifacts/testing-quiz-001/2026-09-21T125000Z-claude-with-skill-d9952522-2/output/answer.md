# Why 25,600 calls found nothing

## Short version

The assertion is fine. The search never happened. `targetContract(address(vault))`
points the fuzzer at the vault directly, so nearly every one of those 25,600 calls
reverted, reverts are discarded rather than failed, and the invariant was asserted
over and over against a vault that never left its constructor state. `0 >= 0` was
green for months.

## What the 25,600 calls were actually doing

With `targetContract(address(vault))` the fuzzer generates calls itself. For each
call it picks a random function on the vault, random `uint256` arguments, and a
**random `msg.sender`** from its address pool. Those senders are addresses like
`0x0000...1f2a`. Consider what each generated call meets:

- `deposit(amount)` — the sender holds zero `MockERC20` and has granted the vault
  zero allowance. The `transferFrom` reverts. Every time.
- `withdraw(amount)` — the sender has no recorded deposit, and `amount` is a random
  `uint256`, typically around `10^70`. Underflow or an explicit balance check
  reverts. Every time.
- Any view or admin function — either state-free, or `onlyOwner` against a sender
  that is not the owner.

`setUp` never mints, never approves, never funds an actor. So there is no sender in
the pool that can complete a `deposit`, and without a completed deposit there is no
state from which a `withdraw` can succeed either. The two calls are locked out in
series: the precondition for the interesting call is created only by the other call
that also always reverts.

Foundry's default is `fail_on_revert = false`. A reverting call is not a failure —
it is silently dropped from the sequence and the run moves on. So each of the 512
sequences was, in effect, 50 no-ops. After each one the invariant ran against:

    token.balanceOf(address(vault)) == 0
    vault.totalDeposits()           == 0
    assertGe(0, 0)                  // passes

512 times, forever. The suite was not testing solvency. It was testing that a
freshly constructed vault is solvent, 512 times per run, which is a statement about
the constructor and is true by inspection.

This is why the bug is the kind you describe — "ordinary deposit and withdraw calls,
nothing exotic." It did not need anything exotic. It needed *two accounts and a
sequence*, and the suite could not produce one account that could transact at all.

## What in the run output would have said so, months ago

Every invariant run prints a per-function table. It looks like this:

    [PASS] invariant_SolvencyHolds() (runs: 512, calls: 25600, reverts: 25597)

`reverts` sitting at or near `calls` is the whole story, and it was printed on every
commit. The rule is: **read the calls/reverts line every time, and treat a revert
rate near 100% as a failed run even though it printed PASS.** A high revert rate
means the sequences never reached real states; the pass carries no information.

If you want the build to tell you instead of trusting a human to read it, set

    [invariant]
    fail_on_revert = true

while building and tuning the handler. That turns "the fuzzer cannot construct a
valid call" into a red run with the exact failing call in the output, which is what
you want during development. (Once the handler bounds all its inputs correctly there
should be nothing left to revert. Only relax it to `false` if you deliberately want
the fuzzer probing unreachable branches, and then you are back to reading the
statistics by hand.)

Foundry also supports asserting this directly, so the guard survives people not
looking:

    function invariant_callsActuallyLanded() public view {
        assertGt(handler.totalCalls(), 0);
        // e.g. require at least 80% of attempted calls to have succeeded
        assertGe(handler.successfulCalls() * 100, handler.totalCalls() * 80);
    }

## The change: point `targetContract` at a handler

The fix is not to the assertion. It is to give the fuzzer a surface where every
generated call is a *valid* deposit or withdraw by a *funded, approved* actor, so
the 25,600 calls become 25,600 real state transitions.

```solidity
contract VaultHandler is Test {
    MyVault  public vault;
    MockERC20 public token;

    address[] public actors;
    address   internal currentActor;

    uint256 public totalCalls;
    uint256 public successfulCalls;

    // ghost accounting, maintained independently of the vault
    uint256 public ghost_depositSum;
    uint256 public ghost_withdrawSum;

    modifier useActor(uint256 actorSeed) {
        currentActor = actors[bound(actorSeed, 0, actors.length - 1)];
        vm.startPrank(currentActor);
        _;
        vm.stopPrank();
    }

    constructor(MyVault _vault, MockERC20 _token) {
        vault = _vault;
        token = _token;

        // multiple actors: the property is about one actor's withdraw
        // not being payable out of another actor's custody
        for (uint256 i = 0; i < 4; i++) {
            address actor = makeAddr(string.concat("actor", vm.toString(i)));
            actors.push(actor);
            token.mint(actor, 1_000_000e18);
            vm.prank(actor);
            token.approve(address(vault), type(uint256).max);
        }
    }

    function deposit(uint256 actorSeed, uint256 amount) external useActor(actorSeed) {
        totalCalls++;
        amount = bound(amount, 1, token.balanceOf(currentActor));
        vault.deposit(amount);
        ghost_depositSum += amount;
        successfulCalls++;
    }

    function withdraw(uint256 actorSeed, uint256 amount) external useActor(actorSeed) {
        totalCalls++;
        uint256 max = vault.balanceOf(currentActor); // or whatever records the claim
        if (max == 0) return;
        amount = bound(amount, 1, max);
        vault.withdraw(amount);
        ghost_withdrawSum += amount;
        successfulCalls++;
    }
}
```

and the test becomes:

```solidity
contract VaultInvariantTest is Test {
    MyVault     vault;
    MockERC20   token;
    VaultHandler handler;

    function setUp() public {
        token   = new MockERC20();
        vault   = new MyVault(token);
        handler = new VaultHandler(vault, token);

        targetContract(address(handler));   // never the vault itself
    }

    function invariant_SolvencyHolds() public view {
        assertGe(token.balanceOf(address(vault)), vault.totalDeposits());
    }
}
```

Four things in there are load-bearing, and each maps to one reason the old run was
empty:

1. **`targetContract(address(handler))`.** The fuzzer can now only call entry points
   that were written to succeed. No more random-sender, random-`uint256` calls.
2. **Funding and approval in the handler constructor.** This is what unlocks
   `deposit`, which is what unlocks `withdraw`. It is the single change that turns a
   dead run into a live one.
3. **`bound()`, not `vm.assume()`.** `bound` maps every random input into the valid
   range, so no call is wasted. `vm.assume` throws the run away and re-rolls, which
   reintroduces the same emptiness in a quieter form.
4. **Multiple actors.** A drain by ordinary deposits and withdraws is almost always
   one account withdrawing against value another account custodied. A single-actor
   handler keeps the run green through exactly that class of bug, because with one
   depositor "my claim" and "the vault's holdings" move together by construction.

Also add `[invariant] fail_on_revert = true` while you tune the handler, and raise
`depth` above 50 once calls are landing — a drift that accumulates needs room to
accumulate, and 50 *effective* calls is a much shorter sequence than 50 attempted
ones. `depth = 200` or more is reasonable now that the calls do something.

## One thing to reconsider after this is green

`assertGe(balanceOf(vault), totalDeposits())` is a one-sided bound. It fires on a
shortfall — which is your drain, so it is the right assertion for the bug you
shipped — but it stays green through anything that leaves a *surplus*: rounding dust
that strands user funds in the vault forever, or a withdraw path that credits too
little. Once the handler is in place, the ghost accounting above lets you state the
stronger property cheaply:

```solidity
function invariant_NoDrift() public view {
    assertEq(
        token.balanceOf(address(vault)),
        handler.ghost_depositSum() - handler.ghost_withdrawSum()
    );
}
```

That ties custody to an accounting total the vault did not compute, so it catches
divergence in both directions rather than only the one that already cost you money.
