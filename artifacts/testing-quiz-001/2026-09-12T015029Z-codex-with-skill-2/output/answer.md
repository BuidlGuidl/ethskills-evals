# Why the green invariant run proved almost nothing

`runs = 512` and `depth = 50` means that Foundry generated up to 512 call sequences of up to 50 calls each. It does **not** mean that 25,600 successful vault state transitions occurred.

Because the test targets `address(vault)` directly, Foundry chooses functions from the vault ABI and fuzzes their arguments and callers. Those callers were not prepared as vault users: they generally had no tokens, had not approved the vault, and had no deposit to withdraw. Random `deposit` amounts therefore reverted in `transferFrom`, while random `withdraw` calls reverted because the caller had no sufficient claim. Any accidentally selected views or harmless calls did not build the required state either.

By default, a reverted invariant action is rejected as an action; it does not make the invariant test fail. Foundry simply continued the sequence and checked `invariant_SolvencyHolds()` against essentially the initial, solvent state. Thus the configured depth measured attempted calls, not useful reachable transitions. Repeating an unreachable search for months cannot discover a multi-call bug, even when the relevant function selectors are nominally in the target ABI.

The warning was in Forge's invariant-run call statistics. The per-selector `calls` and `reverts` counts would have shown `deposit` and `withdraw` with a revert rate at or near 100%, and little or no successful state-changing traffic. Those statistics should be reviewed on every invariant run. While constructing the suite, setting the following is also useful because it turns these discarded actions into an immediate red flag:

```toml
[invariant]
runs = 512
depth = 50
fail_on_revert = true
```

`fail_on_revert` diagnoses an ineffective action generator; it does not by itself make random direct calls useful.

## Make the state space reachable with a handler

Target a handler that creates valid users and translates arbitrary fuzz inputs into valid operations. It must fund actors, arrange approvals, bound amounts to what an actor can actually deposit or withdraw, and call the vault as those actors. For example (with names adjusted to the actual vault and mock API):

```solidity
contract VaultHandler is Test {
    MyVault public immutable vault;
    MockERC20 public immutable token;

    address[] internal actors;

    constructor(MyVault _vault, MockERC20 _token) {
        vault = _vault;
        token = _token;

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

        // Use the vault's actual per-user claim/share accessor here. If the
        // API withdraws shares rather than assets, bound in shares instead.
        uint256 available = vault.deposits(actor);
        if (available == 0) return;
        amount = bound(amount, 1, available);

        vm.prank(actor);
        vault.withdraw(amount);
    }
}
```

Then change setup so the handler, not the vault, is the fuzz target:

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
    }

    function invariant_SolvencyHolds() public view {
        assertGe(token.balanceOf(address(vault)), vault.totalDeposits());
    }
}
```

If the exploit depends on a particular relationship between amounts, add handler actions or ghost state that preserve only the protocol's real preconditions; do not constrain away valid user behavior. After this change, inspect the same call/revert table again: both handler actions should execute successfully in meaningful numbers, with reverts at zero (or at least explained and low). The 50-call depth will then represent sequences of reachable deposits and withdrawals, making the suite capable of shrinking and reporting the draining sequence.
