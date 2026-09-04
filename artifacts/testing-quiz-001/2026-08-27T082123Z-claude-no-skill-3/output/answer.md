# Why 25,600 calls found nothing

## Short version

The assertion is fine. The suite never reached a state where it *could* be false.
Essentially every one of those 25,600 calls reverted, and Foundry counted a revert
as a pass. The vault sat at its genesis state — `token.balanceOf(vault) == 0`,
`totalDeposits() == 0` — for all 512 sequences. The invariant was re-checking
`assertGe(0, 0)` about 25,600 times.

## What the calls were actually doing

Four things compound. Any one of them is enough to sterilize the run.

**1. The senders own nothing.** `targetContract(address(vault))` makes the fuzzer
call `vault` directly, with `msg.sender` drawn from Foundry's random sender pool
(random addresses plus addresses harvested from state). `setUp()` never mints
`MockERC20` to anybody and never approves the vault. So `deposit(amount)` hits
`token.transferFrom(msg.sender, address(this), amount)` with zero balance and zero
allowance and reverts on the first line. `withdraw(amount)` reverts on a zero share
balance / underflow. Nothing lands.

**2. The token was never a target.** `targetContract` is opt-in: naming the vault
restricts the target set to *only* the vault. `MockERC20.mint` and `.approve` are
unreachable to the fuzzer, so it cannot bootstrap itself out of (1). This is what
seals the door — an open-target run with no `targetContract` call would at least
have let it mint.

**3. The arguments are unbounded.** Even had the actors been funded, `amount` is a
raw `uint256`. The fuzzer's dictionary biases toward boundary values —
`type(uint256).max`, `2**128`, `0`. Nearly every draw exceeds any plausible balance
and reverts on the transfer or overflows the accounting. The narrow band of amounts
that produces an interesting state transition is a vanishing fraction of the domain.

**4. `fail_on_revert` defaults to `false`.** A reverting call is not an error and
not retried — it is discarded, state-unchanged, and the sequence moves to the next
call. Reverts still consume depth. So `depth = 50` bought you 50 *attempts*, not 50
state transitions. Your effective depth was ~0.

The drain needed an ordered sequence of *successful* deposits and withdraws across
funded actors. The fuzzer never executed two successful calls in a row, let alone
the specific interleaving. Call count is not coverage.

## What the output was telling you, every run, for months

**The reverts counter on the pass line.** Foundry prints it:

```
[PASS] invariant_SolvencyHolds() (runs: 512, calls: 25600, reverts: 25600)
```

`reverts` at or near `calls` means the suite is doing nothing. That number was on
screen on every commit. Treat any invariant run with a revert rate above ~10–20% as
broken until proven otherwise — for a handler-based suite the correct figure is 0.

Three more checks, in the order they're worth running:

- **Flip `fail_on_revert = true` and watch it die.** A healthy suite is unaffected.
  Yours would fail on call #1 with the `transferFrom` revert, naming the exact cause.
  This is a 30-second diagnostic.
- **`show_metrics = true` under `[invariant]`.** Prints a per-selector table of
  calls / reverts / discards. `deposit: 8,431 calls, 8,431 reverts` is unambiguous.
- **`forge coverage`.** The bodies of `deposit` and `withdraw` past the transfer line
  show 0 hits. Coverage from an invariant run is the ground truth on whether the
  fuzzer is reaching your code.

**Canary invariant.** The general technique, worth keeping permanently: assert
something you *expect to fail* once the suite works.

```solidity
function invariant_canary_reachesNonZeroState() public view {
    assertEq(vault.totalDeposits(), 0, "canary: remove me, the suite works now");
}
```

If a green suite can't trip this, it never deposited anything. A suite that has
never failed is not evidence of a safe contract; it is evidence you have not yet
seen the suite fail, and those are different claims.

## The fix: a handler

Stop pointing the fuzzer at the vault. Point it at a handler that owns funded
actors, bounds inputs into the reachable domain, and never makes a call it expects
to revert.

`test/handlers/VaultHandler.sol`:

```solidity
// SPDX-License-Identifier: UNLICENSED
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

    // ghost accounting — an independent model of what the vault should hold
    uint256 public ghost_depositSum;
    uint256 public ghost_withdrawSum;
    mapping(bytes32 => uint256) public calls;

    modifier useActor(uint256 seed) {
        currentActor = actors[bound(seed, 0, actors.length - 1)];
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

        for (uint256 i = 0; i < 5; i++) {
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
        amount = bound(amount, 1, token.balanceOf(currentActor));
        vault.deposit(amount);
        ghost_depositSum += amount;
    }

    function withdraw(uint256 actorSeed, uint256 amount)
        external
        useActor(actorSeed)
        countCall("withdraw")
    {
        uint256 max = vault.balanceOf(currentActor); // whatever the share/balance accessor is
        if (max == 0) return;                        // skip, don't revert
        amount = bound(amount, 1, max);
        vault.withdraw(amount);
        ghost_withdrawSum += amount;
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }
}
```

`test/VaultInvariant.t.sol`:

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

        bytes4[] memory selectors = new bytes4[](2);
        selectors[0] = VaultHandler.deposit.selector;
        selectors[1] = VaultHandler.withdraw.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));

        excludeSender(address(vault));
        excludeSender(address(token));
        excludeSender(address(handler));
    }

    function invariant_SolvencyHolds() public view {
        assertGe(token.balanceOf(address(vault)), vault.totalDeposits());
    }

    // ghost cross-check: catches accounting drift the balance check can miss
    function invariant_DepositsMatchGhost() public view {
        assertEq(
            vault.totalDeposits(),
            handler.ghost_depositSum() - handler.ghost_withdrawSum()
        );
    }

    // not an assertion — prints the call mix under -vvv so you can see the shape
    function invariant_callSummary() public view {
        console.log("deposit ", handler.calls("deposit"));
        console.log("withdraw", handler.calls("withdraw"));
    }
}
```

`foundry.toml`:

```toml
[invariant]
runs = 512
depth = 100          # raise it: depth is now real state transitions, not 50 reverts
fail_on_revert = true
show_metrics = true
```

### Notes on the change

- **`fail_on_revert = true` is the load-bearing line.** It converts "the fuzzer is
  doing nothing" from a silent pass into a loud failure. Everything else is in
  service of being able to keep it on. If a legitimate revert path exists that the
  handler can't cheaply bound around, wrap that one call in `try/catch` and record
  the reason — don't turn the flag back off.
- **Bound, don't discard.** `bound()` maps the whole `uint256` domain onto the valid
  range, so every draw is a useful call. An `if (x > max) return;` guard throws away
  ~100% of draws and reproduces the original problem more quietly.
- **Five fixed actors, not random senders.** The drain was a multi-step interaction;
  a small recurring actor set means sequence *n+1* can build on what actor A did at
  step *n*. Random fresh senders make every call the first call.
- **Raise depth.** With reverts gone, 50 was masking a second problem: a drain
  needing 8–10 ordered successful calls is barely reachable at depth 50 and
  comfortably reachable at 100–500. Watch wall-clock and tune.
- **Verify the fix before trusting it.** Add the canary above, confirm the suite now
  fails it, then delete the canary. Then re-run and confirm `reverts: 0` and nonzero
  deposit/withdraw counts in the call summary. Green from a suite you haven't seen
  fail means nothing.
