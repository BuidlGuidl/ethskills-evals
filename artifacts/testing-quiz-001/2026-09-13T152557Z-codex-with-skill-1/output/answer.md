# Why the invariant stayed green

`runs = 512` and `depth = 50` mean that Foundry generated 512 sequences with up to 50 **call attempts** in each sequence. They do not mean that 25,600 valid vault operations occurred.

`targetContract(address(vault))` makes Foundry call the vault directly with arbitrary calldata arguments and arbitrary callers. Those callers normally have none of the preconditions needed by a vault:

- they own no mock tokens;
- they have not approved the vault;
- they have no shares/deposit balance to withdraw;
- unconstrained amounts are usually larger than any usable balance or limit.

Consequently, `deposit` attempts revert for lack of balance or allowance, and `withdraw` attempts revert for lack of shares/assets. Any harmless getters may succeed, but they do not change state. By default, a reverted invariant action is discarded; it does not fail the invariant test. Foundry then evaluates `invariant_SolvencyHolds` against essentially the constructor state after every attempted step. In that state both custody and accounting remain zero, so `0 >= 0` is always true.

Thus the 25,600 calls were mostly 25,600 rejected attempts, not a deep exploration of 25,600 state transitions. The property can be correct and capable of detecting the real drain while the action generator is incapable of reaching it.

The warning was in Forge's invariant summary: the `calls` and `reverts` counts. A line showing 25,600 calls with a revert count at or near 25,600 (or the per-handler-call statistics showing deposits and withdrawals reverting almost every time) says that the suite exercised no meaningful state machine. While developing the suite, setting the following would have turned that warning into an immediate failure:

```toml
[invariant]
runs = 512
depth = 50
fail_on_revert = true
```

`fail_on_revert` is a diagnostic guard, not the substantive fix. The fix is to target a **handler** that constructs valid state-changing actions: fund actors, approve the vault, bound deposits to funds, bound withdrawals to existing claims, and call the vault as those actors. For example, adapting the share/balance getters and function signatures to this vault:

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
        vault.deposit(amount); // use the vault's actual deposit signature
    }

    function withdraw(uint256 actorSeed, uint256 amount) external {
        address actor = actors[actorSeed % actors.length];
        uint256 claim = vault.balanceOf(actor); // or the vault's deposit/share getter
        if (claim == 0) return;
        amount = bound(amount, 1, claim);

        vm.prank(actor);
        vault.withdraw(amount); // use the vault's actual withdraw signature
    }
}
```

The invariant setup must then target that handler, not the vault:

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

If the handler inherits other public/external functions, restrict fuzzing with `targetSelector` to only its intended actions. Keep checking the call/revert statistics: a good handler produces many successful deposits and withdrawals and reaches multi-step states. Once those operations are reachable, Foundry can generate and shrink the ordinary deposit/withdraw sequence that violates the stated solvency invariant.
