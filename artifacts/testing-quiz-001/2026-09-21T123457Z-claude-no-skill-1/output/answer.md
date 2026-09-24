# Why 25,600 calls found nothing

## Short version

The suite was green because nothing ever happened. `targetContract(address(vault))`
with no handler and no funded actors means Foundry fuzzed `deposit`/`withdraw`
directly, from randomly generated sender addresses that held zero tokens and had
given the vault zero allowance, with amounts drawn uniformly from `uint256`. Every
one of those calls reverted. Foundry's default `fail_on_revert = false` swallows
reverts and rolls the state back, so each 50-call sequence was 50 no-ops. The vault
never left its constructor state: `token.balanceOf(vault) == 0` and
`vault.totalDeposits() == 0`, so the assertion evaluated `assertGe(0, 0)` — true —
512 times. The invariant was vacuously satisfied. You have been testing the
constructor for months.

## What the 25,600 calls were actually doing

Unpack what the invariant fuzzer does with a bare `targetContract`:

1. **It picks a random sender.** Unless you call `targetSender`, Foundry draws
   `msg.sender` from its own address dictionary — essentially arbitrary addresses.
   Not your test contract, and not any address `setUp` touched.

2. **It picks a random function and random calldata.** `deposit(uint256)` gets an
   amount that is uniformly distributed over `uint256`, biased toward dictionary
   values. The overwhelming majority of draws are astronomically larger than any
   realistic balance.

3. **The call reverts.**
   - `deposit(amount)` does `token.transferFrom(msg.sender, address(this), amount)`.
     The random sender has a zero balance and a zero allowance. `transferFrom`
     reverts on the allowance check before it ever reaches the balance check.
     There is no amount — including `0`, if `MockERC20` checks allowance
     unconditionally — that gets past this for an unfunded, unapproved sender.
   - `withdraw(amount)` reverts on the share/balance accounting: the caller has no
     position, so it underflows or hits an explicit `require`.
   - Whatever else is external on the vault is either a view (state-neutral) or
     also gated on having a position.

4. **Foundry discards the revert and keeps going.** With `fail_on_revert = false`
   (the default), a reverting call is not a failure and is not a state transition —
   the EVM rolls it back. The fuzzer records it in the revert counter and moves to
   call 2 of 50. Fifty reverts later the sequence ends, the invariant is checked
   against pristine state, and it passes.

That is the whole mechanism. `runs = 512` × `depth = 50` produced 25,600 attempted
state transitions and **zero** actual ones.

## Why the assertion could never fail

The property `balanceOf(vault) >= totalDeposits()` can only break after
`totalDeposits` has been incremented by a real deposit and then desynchronized from
the real token balance by a withdraw path bug. Both halves require the vault to
*hold tokens*. The fuzzer could not get a single token in, so the left and right
sides of the comparison were pinned at `0` for every check.

There is a second, independent reason the suite would have missed this bug even if
you had funded the senders naively: **the drain sequence is correlated across
calls.** It is deposit-then-withdraw by the same account, or an interleaving between
two accounts. A raw `targetContract` fuzzer picks a *fresh random sender per call*,
so even with funding, the probability of the same address being selected twice in a
50-call sequence is negligible. No actor ever accumulates a position, so the
deposit→withdraw relationship that the bug lives in is never exercised. Fixing the
funding without fixing the actor model would take you from "0% chance" to "still
approximately 0% chance."

## What in the run output would have told you

Any one of these, months ago:

**1. The revert counter in the call summary.** Run with `-vvv`:

```
forge test --match-test invariant_SolvencyHolds -vvv
```

Foundry prints, per invariant:

```
[PASS] invariant_SolvencyHolds() (runs: 512, calls: 25600, reverts: 25600)
```

`reverts == calls` is the signature of a dead suite. This number is printed on every
run. **Treat any run where reverts are a large fraction of calls as a failing run**,
regardless of the PASS. A healthy handler-based suite has reverts in the low single
digits or exactly zero.

**2. Coverage of the vault's mutating functions.**

```
forge coverage --match-contract VaultInvariantTest
```

The bodies of `deposit` and `withdraw` would have shown ~0% line coverage —
specifically, coverage stopping at the first `require`/`transferFrom` — after 25,600
calls. That mismatch is impossible to rationalize.

**3. A canary invariant.** The cheapest permanent guard. Temporarily (or
permanently, in a separate test contract) assert something that *must* fail once the
fuzzer reaches interesting state:

```solidity
function invariant_CanaryFuzzerIsReachingState() public view {
    assertEq(vault.totalDeposits(), 0, "canary: fuzzer reached a real deposit");
}
```

If this *passes*, your fuzzer is doing nothing. A canary that never fires is a
suite-is-broken alarm. Run it once when you write the suite and delete it, or keep
it as an inverted check in CI.

**4. A call summary from the handler.** Once you have a handler (below), have it
count calls per selector and dump them:

```solidity
function afterInvariant() public view {
    handler.printCallSummary();
}
```

This gives you a per-function table of how many times each action actually
*succeeded*. It turns "is my fuzzer doing anything" from a guess into a number you
read on every run.

**5. `fail_on_revert = true`.** The structural fix for the whole class of problem:
it converts silent uselessness into a red test on the first commit.

## The change

Replace direct targeting with a handler that owns funded actors, bounds inputs to
reachable values, and preserves per-actor identity across calls.

### `test/handlers/VaultHandler.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {CommonBase} from "forge-std/Base.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {StdUtils} from "forge-std/StdUtils.sol";
import {console} from "forge-std/console.sol";

contract VaultHandler is CommonBase, StdCheats, StdUtils {
    MyVault public immutable vault;
    MockERC20 public immutable token;

    address[] public actors;
    address internal currentActor;

    // Ghost accounting: what *should* be true, tracked independently of the vault.
    uint256 public ghost_depositSum;
    uint256 public ghost_withdrawSum;
    mapping(bytes32 => uint256) public calls;

    uint256 internal constant ACTOR_COUNT = 5;
    uint256 internal constant STARTING_BALANCE = 1_000_000e18;

    modifier useActor(uint256 actorSeed) {
        currentActor = actors[bound(actorSeed, 0, actors.length - 1)];
        vm.startPrank(currentActor);
        _;
        vm.stopPrank();
    }

    modifier countCall(bytes32 key) {
        calls[key]++;
        _;
    }

    constructor(MyVault _vault, MockERC20 _token) {
        vault = _vault;
        token = _token;

        for (uint256 i = 0; i < ACTOR_COUNT; i++) {
            address actor = makeAddr(string.concat("actor", vm.toString(i)));
            actors.push(actor);
            token.mint(actor, STARTING_BALANCE);
            vm.prank(actor);
            token.approve(address(vault), type(uint256).max);
        }
    }

    function deposit(uint256 actorSeed, uint256 amount)
        external
        useActor(actorSeed)
        countCall("deposit")
    {
        amount = bound(amount, 0, token.balanceOf(currentActor));
        vault.deposit(amount);
        ghost_depositSum += amount;
    }

    function withdraw(uint256 actorSeed, uint256 amount)
        external
        useActor(actorSeed)
        countCall("withdraw")
    {
        // Deliberately bounded by the ERC20 reality (what tokens exist), NOT by
        // what the vault's own accounting claims this actor is entitled to.
        // See "do not bound away the bug" below.
        amount = bound(amount, 0, token.balanceOf(address(vault)));
        try vault.withdraw(amount) {
            ghost_withdrawSum += amount;
        } catch {
            calls["withdraw:reverted"]++;
        }
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }

    function printCallSummary() external view {
        console.log("deposit           ", calls["deposit"]);
        console.log("withdraw          ", calls["withdraw"]);
        console.log("withdraw:reverted ", calls["withdraw:reverted"]);
        console.log("ghost_depositSum  ", ghost_depositSum);
        console.log("ghost_withdrawSum ", ghost_withdrawSum);
    }
}
```

### `test/VaultInvariant.t.sol`

```solidity
contract VaultInvariantTest is Test {
    MyVault vault;
    MockERC20 token;
    VaultHandler handler;

    function setUp() public {
        token = new MockERC20();
        vault = new MyVault(token);
        handler = new VaultHandler(vault, token);

        // Fuzz the handler, not the vault.
        targetContract(address(handler));

        bytes4[] memory selectors = new bytes4[](2);
        selectors[0] = VaultHandler.deposit.selector;
        selectors[1] = VaultHandler.withdraw.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));

        // Keep the fuzzer out of the scaffolding.
        excludeSender(address(this));
        excludeSender(address(vault));
        excludeSender(address(token));
    }

    function invariant_SolvencyHolds() public view {
        assertGe(token.balanceOf(address(vault)), vault.totalDeposits());
    }

    // Independent cross-check: the vault's own accounting must agree with ghost
    // state. This catches accounting drift even when solvency happens to survive.
    function invariant_TotalDepositsMatchesGhostFlows() public view {
        assertEq(vault.totalDeposits(), handler.ghost_depositSum() - handler.ghost_withdrawSum());
    }

    function afterInvariant() public view {
        handler.printCallSummary();
    }
}
```

### `foundry.toml`

```toml
[invariant]
runs = 512
depth = 100              # raise now that calls actually land; 50 was 50 no-ops
fail_on_revert = true    # the important one
call_override = false
shrink_run_limit = 5000  # so the failing sequence you get back is minimal/readable
```

`fail_on_revert = true` is what stops this from silently rotting again. Every revert
now fails the run, which forces the handler to be honest about what is reachable. The
`try/catch` in `withdraw` is the escape hatch for reverts you have decided are
legitimate — it records them instead of hiding them, so `printCallSummary` tells you
how often that path is taken.

### Do not bound away the bug

The single biggest failure mode when adopting handlers: over-tight `bound()`. If you
had written

```solidity
amount = bound(amount, 0, vault.balanceOf(currentActor));  // WRONG for this bug
```

you would have constrained withdrawals to what the vault *believes* the actor is
owed — which is exactly the quantity the bug corrupts. The fuzzer would then never
attempt the over-withdrawal, and the suite would be green again for a subtler reason
than before.

Rule: bound inputs against **external, ground-truth quantities** (actual token
balances, `type(uint96).max` to avoid meaningless overflow noise), never against the
system-under-test's own view of who is entitled to what. When the vault's accounting
is what you are testing, it cannot also be the oracle that constrains your inputs.

## Verifying the fix works before trusting it

1. Run the canary from §3 against the new suite and confirm it **fails** within a
   few seconds. If it passes, the handler still is not reaching state.
2. Check the summary line: `reverts: 0` and calls distributed across both selectors.
3. Check `forge coverage` now shows the `deposit`/`withdraw` bodies fully covered.
4. Confirm `invariant_SolvencyHolds` now reproduces the drain. Foundry persists the
   failing sequence under `cache/fuzz/failures` and replays it on subsequent runs.
5. Once you have the minimized counterexample, transcribe it into a deterministic
   unit test so the regression is pinned independently of the fuzzer's seed.

Step 4 is non-negotiable as an acceptance criterion: the fix is not "the suite now
makes calls," it is "the suite now finds the bug you already know is there." You have
a known-bad sequence — use it to grade the harness.
