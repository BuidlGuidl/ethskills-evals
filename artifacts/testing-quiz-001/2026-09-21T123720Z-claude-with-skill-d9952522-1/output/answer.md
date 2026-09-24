# Why 25,600 calls found nothing

## Short version

`targetContract(address(vault))` is the bug in the test. The fuzzer was allowed to
call the vault directly, which means it also chose `msg.sender` at random. Those
senders are fresh addresses that hold no `MockERC20` and have granted no approval,
so essentially every call it made reverted. Foundry discards reverting calls instead
of failing the run, so the invariant was asserted 512 times against a vault that had
never left the state `setUp()` left it in: `token.balanceOf(vault) == 0`,
`vault.totalDeposits() == 0`. `assertGe(0, 0)` passes. The suite has been re-proving
`0 >= 0` on every commit for months.

The assertion is fine. The search never happened.

## What the calls were actually doing

Walk one sequence of depth 50. For each call the fuzzer picks a function on the
vault, random arguments, and a random `msg.sender`:

- `deposit(amount)` from a random address → inside, the vault does
  `token.transferFrom(msg.sender, address(this), amount)`. That sender's balance is
  0 and its allowance to the vault is 0. Revert.
- `withdraw(amount)` from a random address → that sender's recorded deposit is 0, so
  either the accounting check or the underflow reverts. Revert.
- Any admin/owner-gated function → random sender is not the owner. Revert.
- The occasional `deposit(0)` / `withdraw(0)` that does succeed moves no tokens and
  changes no accounting, so it leaves `0 >= 0` intact.

There is no path by which a random, unfunded, unapproved address gets tokens into
the vault. And the drain you shipped is a *stateful* bug: it needs real balances,
real approvals, and at least two accounting-changing operations in sequence for the
divergence to appear and then be exploited. The fuzzer never got past call one of
that sequence. Depth 50 is 50 attempts to make the first move, not a 50-step walk.

This is also why the bug is invisible to unit tests: each operation is correct on
its own. "Every function passes in isolation" is the symptom of an accumulating
accounting bug, not evidence against one.

## What in the run output would have said this months ago

The per-invariant statistics table that `forge test` prints:

```
[PASS] invariant_SolvencyHolds() (runs: 512, calls: 25600, reverts: 25575)
```

`reverts` within a rounding error of `calls` means the run proved nothing. That
number was in your CI log on every commit. A healthy handler-driven run looks more
like `calls: 25600, reverts: 300` — some reverts are normal and expected (bounds,
access control), near-total reverts are not.

Two habits make it impossible to miss again:

1. Read `calls` vs `reverts` on every invariant run, and treat a high ratio as a red
   result even though the line says `[PASS]`.
2. Set `fail_on_revert = true` in `[invariant]` while building the handler. Then a
   reverting call *is* a failure, and the handler is not finished until the fuzzer
   can drive the system without tripping it. Relax it later only for functions where
   a revert is genuinely part of the property under test.

Coverage would not have helped here either: every line of `deposit` and `withdraw`
"ran" — they ran up to their revert. Coverage records which lines executed, never
whether an assertion could have failed.

## The change

Point `targetContract` at a handler, never at the contract under test. The handler
owns the things a random EOA cannot have: funded actors, approvals, bounded inputs,
and more than one actor so properties about interaction between users are reachable.

```solidity
// test/handlers/VaultHandler.sol
import {Test} from "forge-std/Test.sol";
import {MyVault} from "../../src/MyVault.sol";
import {MockERC20} from "../mocks/MockERC20.sol";

contract VaultHandler is Test {
    MyVault public vault;
    MockERC20 public token;

    address[] public actors;
    address internal currentActor;

    // ghost accounting, for the stronger assertions below
    uint256 public ghost_depositSum;
    uint256 public ghost_withdrawSum;

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

    modifier useActor(uint256 actorSeed) {
        currentActor = actors[bound(actorSeed, 0, actors.length - 1)];
        vm.startPrank(currentActor);
        _;
        vm.stopPrank();
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

Note `bound()`, not `vm.assume()` — `assume` throws the run away and leaves you back
at a high discard rate; `bound` maps every random input onto a usable one, so the
sequence keeps going and actually reaches depth 50.

```solidity
// test/VaultInvariant.t.sol
contract VaultInvariantTest is Test {
    MyVault vault;
    MockERC20 token;
    VaultHandler handler;

    function setUp() public {
        token = new MockERC20();
        vault = new MyVault(token);
        handler = new VaultHandler(vault, token);

        targetContract(address(handler));   // handler, not vault

        bytes4[] memory selectors = new bytes4[](2);
        selectors[0] = VaultHandler.deposit.selector;
        selectors[1] = VaultHandler.withdraw.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    function invariant_SolvencyHolds() public view {
        assertGe(token.balanceOf(address(vault)), vault.totalDeposits());
    }

    // stronger: custody must equal accounting, not merely cover it
    function invariant_CustodyEqualsAccounting() public view {
        assertEq(token.balanceOf(address(vault)), vault.totalDeposits());
    }

    // accounting must be reconstructible from the operations performed
    function invariant_TotalDepositsMatchesFlows() public view {
        assertEq(
            vault.totalDeposits(),
            handler.ghost_depositSum() - handler.ghost_withdrawSum()
        );
    }

    function invariant_callSummary() public view {
        console.log("deposits", handler.ghost_depositSum());
        console.log("withdraws", handler.ghost_withdrawSum());
    }
}
```

Two points about the assertions themselves, beyond the handler fix:

- `assertGe` is one-sided. It fires on a shortfall and stays green through anything
  that leaves a *surplus* — value stranded in the vault that no user can claim is
  just as much a bug, and this suite would never have seen it. Where value can be
  stranded as well as lost, state the property as an equality
  (`invariant_CustodyEqualsAccounting`) and keep the `Ge` version only if some
  deliberate donation/buffer mechanism makes strict equality false.
- The ghost-variable invariant is what catches a drift bug early: it ties the
  contract's own accounting to an independent tally of the operations performed, so a
  per-operation rounding or double-count shows up as a growing gap rather than only
  when it has grown large enough to break solvency.

## Also worth doing before the next deploy

- `MockERC20` encodes your assumption about the token. If the vault is meant to hold
  a real asset, add a pinned-block fork test against that deployment — a mock always
  answers in the standard shape, so it can never surface fee-on-transfer, rebasing,
  or a non-standard return value.
- Fuzz every owner-settable number feeding the value math (fee bps, caps, ratios)
  across its whole domain with `bound()`, exercising the nearest valid value, the
  exact limit, and the first value past it.
- Re-run with `fail_on_revert = true` and confirm the revert count is low. That
  number, not the `[PASS]`, is the evidence that the search ran.
