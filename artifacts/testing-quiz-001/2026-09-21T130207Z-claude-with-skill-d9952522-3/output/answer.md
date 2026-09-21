# Why 25,600 calls found nothing

## Short version

The assertion is fine. The search never happened. `targetContract(address(vault))`
points the fuzzer straight at the contract under test, so almost every one of those
25,600 calls reverted, reverts are discarded rather than failed by default, and
`invariant_SolvencyHolds` was re-asserted 512 times against a vault that was still
in its `setUp()` state: `0 >= 0`. The suite was green because nothing ever happened.

## What the 25,600 calls were actually doing

With the vault as the direct target, Foundry picks, for each call in a sequence:

- a **random function** from the vault's ABI,
- **random arguments**, and — this is the part that kills the run —
- a **random `msg.sender`** from its address pool.

Those senders are arbitrary addresses. In `setUp()` you minted nothing to them and
approved nothing on their behalf. So:

- `deposit(amount)` → `token.transferFrom(msg.sender, address(vault), amount)` →
  reverts on allowance (and on balance). Every time, for every sender, for every
  amount.
- `withdraw(amount)` → the caller's recorded balance/shares are zero → reverts on
  underflow or on an explicit `InsufficientBalance` check. Every time.
- The handful of calls that *do* succeed are the ones that cannot move value:
  `view` getters, and any no-op path. `totalDeposits()` returning 0 does not
  advance state.

So the fuzzer never got past the very first call of any sequence. `depth = 50`
bought you nothing, because a reverted call leaves the state untouched and the next
call starts from the same empty vault. 512 independent sequences × 50 calls all
bounced off the same wall.

## Why the assertion could never fail

Foundry asserts the invariant after each call in the sequence. The state it was
asserted against, all 25,600 times, was:

```
token.balanceOf(address(vault)) == 0
vault.totalDeposits()           == 0
assertGe(0, 0)                  // passes
```

Your drain is a *stateful* bug: it needs real deposits from real funded actors,
then a withdraw path whose accounting and custody diverge, then enough repetitions
for the gap to be drainable. Reaching it requires at minimum a funded actor, an
approval, a successful `deposit`, and a successful `withdraw` **in sequence**. The
run never produced a single successful `deposit`, so the state space containing the
bug was not merely under-sampled — it was never entered. No value of `runs` or
`depth` fixes that; 512 million sequences of reverts is still zero sequences.

This is also why the hand replay fires. The property was always correct; it was
just being evaluated on the empty state.

## What in the run output would have told you this months ago

The invariant run prints a per-target call/revert table. Run it verbose:

```
forge test --mt invariant_SolvencyHolds -vvv
```

You would have seen something like:

```
[PASS] invariant_SolvencyHolds() (runs: 512, calls: 25600, reverts: 25213)
```

and, in the traces, a breakdown per function:

```
  MyVault.deposit(uint256)   calls: 8471   reverts: 8471
  MyVault.withdraw(uint256)  calls: 8402   reverts: 8402
  MyVault.totalDeposits()    calls: 8727   reverts: 0
```

**`reverts` at or near `calls` is the tell.** A revert rate near 100% means the run
proved nothing at all, regardless of the PASS. A `deposit` column where
`reverts == calls` means no deposit ever landed, which means the invariant was
never asserted against a funded vault. Read that table every time; it is the only
thing in the output that distinguishes "the property held across the state space"
from "the state space was never visited."

The mechanical way to make that impossible to ignore is `fail_on_revert = true`
while you build the handler. With it set, this suite would have gone red on its
very first commit — on the first `transferFrom` revert — months before you shipped.

## The change

Point `targetContract` at a **handler**, never at the contract under test. The
handler owns the setup the fuzzer cannot invent: funded and approved actors,
arguments bounded to plausible ranges with `bound()`, and multiple actors, because
a drain that works by taking value belonging to someone else needs someone else to
exist.

### `test/handlers/VaultHandler.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {CommonBase} from "forge-std/Base.sol";
import {StdUtils} from "forge-std/StdUtils.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {MyVault} from "../../src/MyVault.sol";
import {MockERC20} from "../mocks/MockERC20.sol";

contract VaultHandler is CommonBase, StdCheats, StdUtils {
    MyVault public vault;
    MockERC20 public token;

    address[] public actors;
    address internal currentActor;

    // ghost accounting, for the stronger assertions below
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

        for (uint256 i = 0; i < 4; i++) {
            address actor = address(uint160(uint256(keccak256(abi.encode("actor", i)))));
            actors.push(actor);
            token.mint(actor, 1_000_000e18);
            vm.prank(actor);
            token.approve(address(vault), type(uint256).max);
        }
    }

    function deposit(uint256 actorSeed, uint256 amount) external useActor(actorSeed) {
        amount = bound(amount, 0, token.balanceOf(currentActor));
        vault.deposit(amount);
        ghost_depositSum += amount;
    }

    function withdraw(uint256 actorSeed, uint256 amount) external useActor(actorSeed) {
        amount = bound(amount, 0, vault.balanceOf(currentActor));
        vault.withdraw(amount);
        ghost_withdrawSum += amount;
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }
}
```

Two details that matter: `bound()`, not `vm.assume()` — `assume` throws the call
away and you are back to burning depth on nothing, while `bound` maps every random
input onto a usable one. And the actor is chosen from a fixed small set so that
sequences *revisit* the same accounts; a drain that depends on one account's state
evolving across several calls needs collisions, and a fresh random address every
call never collides.

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

        targetContract(address(handler));

        // only the state-changing entry points; keep view helpers out of the
        // call budget so depth is spent on state transitions
        bytes4[] memory selectors = new bytes4[](2);
        selectors[0] = VaultHandler.deposit.selector;
        selectors[1] = VaultHandler.withdraw.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    function invariant_SolvencyHolds() public view {
        assertGe(token.balanceOf(address(vault)), vault.totalDeposits());
    }

    // conservation: custody must equal accounting exactly, not merely cover it
    function invariant_NoDrift() public view {
        assertEq(token.balanceOf(address(vault)), vault.totalDeposits());
    }

    // accounting must equal the sum of what actually went in and out
    function invariant_DepositsReconcile() public view {
        assertEq(
            vault.totalDeposits(),
            handler.ghost_depositSum() - handler.ghost_withdrawSum()
        );
    }

    // totalDeposits must equal the sum of per-user balances
    function invariant_SumOfBalances() public view {
        uint256 sum;
        for (uint256 i = 0; i < handler.actorCount(); i++) {
            sum += vault.balanceOf(handler.actors(i));
        }
        assertEq(sum, vault.totalDeposits());
    }

    function invariant_callSummary() public view {
        // `forge test --mt invariant -vvv` — read calls vs reverts here
    }
}
```

### `foundry.toml`

```toml
[invariant]
runs = 512
depth = 50
fail_on_revert = true   # keep this on until the handler is clean
```

Leave `fail_on_revert = true` while you develop the handler. Every revert is then a
bug in your bounding, and you fix it until sequences run to full depth. Only relax
it once you have a legitimate revert you intend to tolerate — and if you do relax
it, you are back to reading the calls/reverts table by hand on every run.

## The two additions beyond the fix you asked for

`assertGe` is a one-sided bound. It fires on a shortfall — which is your drain, so
it would have caught this once the handler existed — but it stays green through any
bug that *strands* value in the vault, because a surplus satisfies it. Since this is
a vault where value can be lost in either direction, the property you actually want
is the equality in `invariant_NoDrift`. Keeping both is worthwhile: `SolvencyHolds`
tells you at a glance which direction broke.

`invariant_DepositsReconcile` and `invariant_SumOfBalances` are what turn a
counterexample into a diagnosis. Solvency tells you the vault is short;
the ghost reconciliation tells you whether the shortfall came from tokens leaving
without accounting, or accounting moving without tokens.

## Checklist for the re-run

- [ ] `reverts` is a small fraction of `calls` in the run output, and `deposit` /
      `withdraw` each show a large non-zero success count.
- [ ] `fail_on_revert = true` passes with the handler as written.
- [ ] Replaying the drain sequence through the handler reproduces the failure.
- [ ] Sequences reach full `depth`; if the shrinker reports a 2–3 call
      counterexample, confirm the gap after at least two withdrawals before
      calling it cumulative drift.
