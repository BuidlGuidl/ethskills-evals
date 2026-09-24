# Why 512 × 50 calls never found the drain

## Short version

The assertion is fine. The suite never tested it. Those ~25,600 calls almost all
reverted in the first few lines of `deposit`, and `fail_on_revert = false` (the
Foundry default) threw the reverts away silently. A reverted call leaves no state
behind, so the vault sat at `balance == 0, totalDeposits == 0` for essentially the
entire campaign, and `assertGe(0, 0)` passes 512 times out of 512. You have been
running a very expensive check that zero is greater than or equal to zero.

## What the calls were actually doing

With `targetContract(address(vault))` and no handler, Foundry fuzzes the vault's
external ABI *directly*:

- **`msg.sender` is a random address per call.** The fuzzer draws senders from its
  own address pool (plus addresses it has seen), not from a set you set up. Those
  addresses have never been minted `MockERC20` and have never called
  `token.approve(vault, ...)`.
- **Arguments are unbounded.** `deposit(uint256 amount)` gets values drawn from the
  full `uint256` range, heavily weighted toward boundary values (`0`,
  `type(uint256).max`, and similar).

So the life of a typical call is:

| call | what happens |
| --- | --- |
| `deposit(9.7e76)` from `0x4e59...` | `transferFrom` reverts: insufficient balance |
| `deposit(3)` from `0x1804...` | `transferFrom` reverts: insufficient allowance |
| `deposit(0)` from anyone | succeeds, changes nothing (or reverts on a zero-amount guard) |
| `withdraw(anything)` from anyone | reverts: caller's share balance is 0 |

The only calls that can succeed are the no-op ones. Nothing ever moves tokens into
the vault, so `totalDeposits` never becomes non-zero, so there is no shares/assets
ratio, no rounding, no ordering between two depositors — none of the machinery the
bug lives in is ever built. The user's drain needs a *state*: a funded vault with at
least one prior depositor. Your fuzzer never once reached that state, so no amount of
`runs` or `depth` would have helped. This is the classic "vacuous invariant" — the
guard clauses in your own contract act as a filter that rejects ~100% of the
generated sequences before they touch the logic under test.

Note the compounding effect of depth: because `withdraw` requires a successful
`deposit` first, and deposits succeed with probability ~0, the chance of a *sequence*
containing a real deposit→withdraw pair is the square of an already-negligible
number. Depth 50 doesn't rescue you; it just gives you 50 reverts per sequence
instead of 1.

## What in the run output said so, months ago

Three signals, all of which were on screen or one flag away:

**1. The revert counter in the test summary.** Foundry prints it per invariant:

```
[PASS] invariant_SolvencyHolds() (runs: 512, calls: 25600, reverts: 25600)
```

`reverts` at or near `calls` is the tell. In a healthy invariant suite reverts should
be a small fraction of calls (and ideally zero, if the handler bounds its inputs
properly). `reverts: 25600` means the campaign did 25,600 things and 25,600 of them
were undone. Any invariant run where `reverts ≈ calls` is passing vacuously until
proven otherwise — treat that ratio as a first-class CI metric, not decoration.

**2. `forge test --mt invariant_SolvencyHolds -vvv` / `--show-metrics`.** Newer
Foundry prints per-selector call/revert/discard counts for invariant runs:

```
╭────────────┬───────┬─────────┬──────────╮
│ Selector   │ Calls │ Reverts │ Discards │
├────────────┼───────┼─────────┼──────────┤
│ deposit    │ 12811 │  12811  │    0     │
│ withdraw   │ 12789 │  12789  │    0     │
╰────────────┴───────┴─────────┴──────────╯
```

Two rows at 100% revert is unambiguous.

**3. Coverage of the vault under the invariant test.** `forge coverage` restricted to
this test would have shown the body of `deposit` past the `transferFrom` line, and
all of `withdraw`, at 0% line coverage. An invariant suite that executes none of the
lines it is protecting is not a suite.

**4. The cheapest sanity check of all: break the contract on purpose.** Add a
deliberate solvency bug (e.g. let anyone `withdraw` twice), run the suite, and
confirm it goes red. If the suite stays green against a contract you *know* is
broken, the suite is measuring nothing. This mutation check should be a permanent
part of the workflow — it is the only thing that distinguishes "green because the
code is correct" from "green because nothing ran."

## The change

Stop fuzzing the vault directly. Fuzz a **handler** that owns a fixed set of funded,
approved actors and that bounds every argument into the range where the call can
actually succeed. Then turn `fail_on_revert` on so the suite tells you the moment it
starts reverting again.

### `test/handlers/VaultHandler.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {CommonBase} from "forge-std/Base.sol";
import {StdCheats} from "forge-std/StdCheats.sol";
import {StdUtils} from "forge-std/StdUtils.sol";
import {MyVault} from "../../src/MyVault.sol";
import {MockERC20} from "../mocks/MockERC20.sol";

contract VaultHandler is CommonBase, StdCheats, StdUtils {
    MyVault public vault;
    MockERC20 public token;

    address[] public actors;
    address internal currentActor;

    // Ghost variables: the handler's own accounting, independent of the vault's.
    uint256 public ghost_depositSum;
    uint256 public ghost_withdrawSum;

    // Call counters, so we can assert the campaign actually exercised the logic.
    mapping(bytes32 => uint256) public calls;

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

        // A small, fixed actor set. Small is deliberate: it forces actors to
        // interact with each other's positions, which is where the bug lives.
        for (uint256 i = 0; i < 4; i++) {
            address actor = makeAddr(string.concat("actor", vm.toString(i)));
            actors.push(actor);
            token.mint(actor, 1_000_000e18);
            vm.prank(actor);
            token.approve(address(vault), type(uint256).max);
        }
    }

    function deposit(uint256 actorSeed, uint256 amount)
        external
        useActor(actorSeed)
        countCall("deposit")
    {
        // Bound into the range that can actually succeed: non-zero, and no more
        // than the actor holds.
        amount = bound(amount, 1, token.balanceOf(currentActor));
        vault.deposit(amount);
        ghost_depositSum += amount;
    }

    function withdraw(uint256 actorSeed, uint256 amount)
        external
        useActor(actorSeed)
        countCall("withdraw")
    {
        uint256 max = vault.balanceOf(currentActor); // or maxWithdraw(currentActor)
        if (max == 0) return;                        // nothing to do, don't revert
        amount = bound(amount, 1, max);
        vault.withdraw(amount);
        ghost_withdrawSum += amount;
    }

    // Donations / direct transfers are a real-world state the vault must survive,
    // and they are exactly the kind of thing that perturbs a share price. Include
    // them explicitly rather than hoping the fuzzer stumbles on them.
    function donate(uint256 amount) external countCall("donate") {
        amount = bound(amount, 1, 1_000e18);
        token.mint(address(this), amount);
        token.transfer(address(vault), amount);
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }
}
```

### `test/VaultInvariant.t.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {MyVault} from "../src/MyVault.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {VaultHandler} from "./handlers/VaultHandler.sol";

contract VaultInvariantTest is Test {
    MyVault vault;
    MockERC20 token;
    VaultHandler handler;

    function setUp() public {
        token = new MockERC20();
        vault = new MyVault(token);
        handler = new VaultHandler(vault, token);

        // Fuzz the handler, and ONLY the handler.
        targetContract(address(handler));
        excludeContract(address(vault));
        excludeContract(address(token));

        // Only the fuzzable entry points; keep view/helper functions out.
        bytes4[] memory selectors = new bytes4[](3);
        selectors[0] = VaultHandler.deposit.selector;
        selectors[1] = VaultHandler.withdraw.selector;
        selectors[2] = VaultHandler.donate.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    function invariant_SolvencyHolds() public view {
        assertGe(token.balanceOf(address(vault)), vault.totalDeposits());
    }

    /// The vault's own accounting must agree with the handler's independent tally.
    function invariant_TotalDepositsMatchesGhost() public view {
        assertEq(
            vault.totalDeposits(),
            handler.ghost_depositSum() - handler.ghost_withdrawSum()
        );
    }

    /// Sum of per-user balances must not exceed the total. This is the one that
    /// catches "user withdraws more than their share" directly.
    function invariant_SumOfBalancesLteTotal() public view {
        uint256 sum;
        for (uint256 i = 0; i < handler.actorCount(); i++) {
            sum += vault.balanceOf(handler.actors(i));
        }
        assertLe(sum, vault.totalDeposits());
    }

    /// Anti-vacuity guard: fail if the campaign never exercised the real paths.
    /// This is the assertion that would have gone red months ago.
    function invariant_CallSummary() public view {
        assertGt(handler.calls("deposit"), 0, "no deposits were executed");
        assertGt(handler.calls("withdraw"), 0, "no withdrawals were executed");
        assertGt(vault.totalDeposits(), 0, "vault was never funded");
    }
}
```

### `foundry.toml`

```toml
[invariant]
runs = 512
depth = 50
fail_on_revert = true   # was false (the default) — this is the important line
shrink_run_limit = 5000
```

`fail_on_revert = true` is the structural fix, not a style preference. With it on,
the suite cannot silently degrade into vacuity again: if a future change adds a guard
clause that starts rejecting the handler's calls, the run goes red immediately
instead of quietly going back to testing nothing. The cost is that the handler must
bound its inputs honestly — which is the work that makes the campaign real in the
first place. Where a call legitimately has nothing to do (`withdraw` with a zero
balance), return early rather than letting it revert.

`invariant_CallSummary` is the belt-and-braces version of the same idea, and it is
worth keeping even with `fail_on_revert = true`: it asserts the campaign reached a
funded, non-trivial state, not merely that it avoided reverting.

## Checklist for the rest of the suite

The same failure mode is probably present in your other invariants. For each one:

1. Run it and read the `reverts:` count. If `reverts ≈ calls`, it is vacuous.
2. Check `forge coverage` for the target contract under that test. 0% on the guarded
   paths means the same thing.
3. Mutate the contract to violate the invariant on purpose and confirm the suite goes
   red. If it doesn't, the suite is decorative.
4. Fuzz a handler, never the protocol contract directly. A protocol contract's own
   access control and balance checks are a near-perfect filter against random senders
   and random arguments.
5. Track ghost variables in the handler and assert the vault's internal accounting
   against them. An invariant that only reads the contract under test can be
   satisfied by a contract that is consistently wrong.
