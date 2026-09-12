# Why the invariant suite stayed green

`runs = 512` and `depth = 50` gave Foundry roughly 25,600 **call attempts**, not 25,600 successful vault operations.

Because the vault itself was the target, Foundry called its public/external functions with arbitrary calldata and arbitrary senders. Those senders had not been given tokens, had not approved the vault, and generally had no deposits or shares to withdraw. Consequently, calls such as `deposit` failed for lack of balance or allowance, and calls such as `withdraw` failed for lack of a position. Random arguments may also have violated the functions' ordinary input constraints. Any getters that succeeded did not change state.

Unless `fail_on_revert` is enabled, those reverts do not fail an invariant campaign. Foundry discards the reverting transition, leaves the preceding state unchanged, and checks the invariant against that unchanged state. Thus the suite repeatedly checked the correct assertion against the initial or nearly initial vault. It never generated the prerequisite states needed for the later calls in the draining sequence. Increasing `runs` or `depth` only produced more invalid attempts and did not fix reachability.

The warning was in Foundry's invariant-run output: the per-selector call/revert table and its total calls and reverts. A near-100% revert rate for the state-changing selectors—possibly alongside successful view calls—would have shown that the fuzzer was not exploring vault state. Those statistics should be reviewed on every invariant run. During development, setting this also makes accidental reverts conspicuous:

```toml
[invariant]
fail_on_revert = true
```

That setting is a useful diagnostic, but it is not the substantive fix.

## Make reachable actions the fuzz target

Target a handler rather than `MyVault`. The handler must create valid preconditions: use funded actors, establish approvals, bound amounts to what an actor can validly deposit or withdraw, and preserve state across calls. It should expose deposit and withdrawal actions so Foundry composes them into sequences. Use multiple actors if the bug depends on interaction between accounts.

For example, adapting function and share-balance names to the actual vault API:

```solidity
contract VaultHandler is Test {
    MyVault public immutable vault;
    MockERC20 public immutable token;

    address[] internal actors;

    constructor(MyVault vault_, MockERC20 token_) {
        vault = vault_;
        token = token_;

        actors.push(address(0xA11CE));
        actors.push(address(0xB0B));

        for (uint256 i; i < actors.length; ++i) {
            token.mint(actors[i], 1_000_000 ether);
            vm.prank(actors[i]);
            token.approve(address(vault), type(uint256).max);
        }
    }

    function deposit(uint256 actorSeed, uint256 amount) external {
        address actor = actors[actorSeed % actors.length];
        amount = bound(amount, 1, token.balanceOf(actor));

        vm.prank(actor);
        vault.deposit(amount);
    }

    function withdraw(uint256 actorSeed, uint256 amount) external {
        address actor = actors[actorSeed % actors.length];
        uint256 available = vault.balanceOf(actor); // or the vault's claim/deposit getter
        if (available == 0) return;
        amount = bound(amount, 1, available);

        vm.prank(actor);
        vault.withdraw(amount);
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

The essential change is `targetContract(address(handler))`, backed by handler actions that normally succeed. Once deposits and withdrawals are real successful transitions, `depth = 50` describes meaningful sequences and the fuzzer is capable of reaching and shrinking the ordinary-call sequence that violates solvency.
