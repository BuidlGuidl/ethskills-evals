# Why the invariant suite stayed green

`runs = 512` and `depth = 50` mean that Foundry attempted 512 random sequences of up to 50 calls each. They do **not** mean that the vault successfully executed 25,600 meaningful actions.

`targetContract(address(vault))` makes Foundry select functions from the vault's ABI and call them with random calldata and callers. It does not synthesize the state required for those calls to succeed. In particular, it does not automatically:

- give a caller any of the mock token;
- have that caller approve the vault to spend the token;
- choose a deposit amount no greater than the funded/approved amount; or
- choose a withdrawal amount no greater than that caller's deposit or shares.

Consequently, almost every attempted `deposit` reverted for lack of balance or allowance. Since no deposit established a position, attempted `withdraw` calls then reverted or had no useful state to act on. Any other callable selectors merely exercised unrelated paths. With Foundry's normal invariant behavior, a reverted action is discarded and fuzzing continues unless `fail_on_revert` is enabled.

The invariant was therefore usually checked against the initial, empty state (or another trivial state): the vault token balance and `totalDeposits()` were both zero. The assertion was correct, but the fuzzer had no reachable path to the part of the state space in which the bug existed.

The run output to inspect is the invariant campaign's **calls and reverts**, not just its green status or configured depth. At suitable verbosity, and especially with invariant call metrics enabled, Foundry reports the total calls/reverts and the per-selector call/revert counts. A very high overall revert count—and `deposit`/`withdraw` showing all or nearly all calls reverting—would have revealed that the campaign was not exercising the vault. The selector distribution is also worth checking: call count is coverage only when the calls create useful state transitions.

For example, enable metrics and temporarily make unexpected reverts fatal while bringing the harness up:

```toml
[invariant]
runs = 512
depth = 50
show_metrics = true
fail_on_revert = true
```

`fail_on_revert = true` is a harness-debugging aid, not the main fix. The main fix is to target a handler that constructs valid actions and keeps the same actor's state coherent across calls:

```solidity
contract VaultHandler is Test {
    MyVault public immutable vault;
    MockERC20 public immutable token;

    address[] internal actors;

    constructor(MyVault _vault, MockERC20 _token) {
        vault = _vault;
        token = _token;

        actors.push(makeAddr("alice"));
        actors.push(makeAddr("bob"));
        actors.push(makeAddr("carol"));
    }

    function deposit(uint256 actorSeed, uint256 amount) external {
        address actor = actors[actorSeed % actors.length];
        amount = bound(amount, 1, 1_000_000 ether);

        deal(address(token), actor, amount);

        vm.startPrank(actor);
        token.approve(address(vault), amount);
        vault.deposit(amount); // Adapt arguments to the vault's actual API.
        vm.stopPrank();
    }

    function withdraw(uint256 actorSeed, uint256 amount) external {
        address actor = actors[actorSeed % actors.length];
        uint256 available = vault.balanceOf(actor); // Or the vault's deposited-balance getter.
        if (available == 0) return;

        amount = bound(amount, 1, available);
        vm.prank(actor);
        vault.withdraw(amount); // Adapt arguments/units to the vault's actual API.
    }
}

contract VaultInvariantTest is Test {
    MyVault vault;
    MockERC20 token;
    VaultHandler handler;

    function setUp() public {
        token = new MockERC20();
        vault = new MyVault(token);
        handler = new VaultHandler(vault, token);

        targetContract(address(handler));
    }

    function invariant_SolvencyHolds() public view {
        assertGe(token.balanceOf(address(vault)), vault.totalDeposits());
    }
}
```

The exact withdrawal bound must use the unit expected by `withdraw`—assets, shares, or an internal deposit balance. If the production sequence depends on one user depositing and another withdrawing, the actor seed lets the fuzzer build that interleaving while repeatedly selecting stable actors. If it depends on additional ordinary actions, add corresponding handler functions with only the minimum precondition construction/bounding needed to make those actions valid.

After this change, inspect the metrics again. Deposits and withdrawals should have substantial successful-call counts, state should become nontrivial, and the invariant engine can compose the ordinary successful actions into the draining sequence.
