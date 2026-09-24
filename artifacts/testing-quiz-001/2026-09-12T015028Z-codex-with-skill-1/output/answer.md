# Why the green invariant run proved nothing

`runs = 512` and `depth = 50` means Foundry attempted 512 sequences of up to 50 calls. It does **not** mean the vault completed 25,600 meaningful state transitions.

Because the test targets the vault directly,

```solidity
targetContract(address(vault));
```

Foundry selects vault functions and supplies fuzzed calldata and senders directly to them. Those senders have not been given tokens, have not approved the vault, and generally have no deposit to withdraw. Thus a deposit normally reverts at `transferFrom`, while a withdrawal normally reverts because the sender has no shares/deposit balance (and random arguments are commonly out of range as well).

Invariant-call reverts are discarded by default; they do not make the invariant test fail. After each attempted call, Foundry checked `invariant_SolvencyHolds`, but the vault was still in its constructor/initial state because the mutating call had reverted. It repeatedly proved only that the initially empty vault was solvent. It never explored the reachable sequence of successful deposits and withdrawals that the user executed.

The evidence was in Forge's invariant-run statistics: the total `calls` and `reverts`, including the per-selector call/revert table in verbose output. A revert count equal or close to the call count—and especially `deposit` and `withdraw` showing no successful calls—means the state machine is not being exercised. The headline `(runs: 512, calls: 25600, reverts: ...)` must be read as attempted calls; depth is not coverage. While developing the harness, setting

```toml
[invariant]
runs = 512
depth = 50
fail_on_revert = true
```

would have turned this harness failure into an immediate red run. `fail_on_revert` is a useful guardrail, but it does not itself make the inputs valid.

## The required change

Target a handler instead of the vault. The handler must create valid preconditions: use funded actors, approve the vault as those actors, bound amounts to ranges that can succeed, and execute both operations as the selected actor. For example (adapting share/deposit getters and function signatures to `MyVault`):

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
            token.mint(actors[i], type(uint128).max);
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
        uint256 available = vault.deposits(actor); // or shares/balanceOf
        if (available == 0) return;
        amount = bound(amount, 1, available);

        vm.prank(actor);
        vault.withdraw(amount);
    }
}
```

Then wire it into the invariant test:

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

Now each fuzz step represents an ordinary, valid user operation and successful calls accumulate state across the 50-call sequence. That gives Foundry a search space containing the draining sequence. Keep inspecting the handler selector statistics: both operations should have substantial successful-call counts, and reverts should be rare (or zero with `fail_on_revert = true`).
