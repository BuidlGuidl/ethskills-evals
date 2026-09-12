# Why the invariant stayed green

`runs = 512` and `depth = 50` mean that Foundry made up to 25,600 **call attempts**. They do not mean that 25,600 successful vault operations occurred or that 512 meaningful state histories were explored.

`targetContract(address(vault))` told the invariant engine to call the vault's public/external functions directly with fuzzed calldata and fuzzed callers. It did not give those callers tokens, approve the vault to spend their tokens, or first establish deposits from which they could withdraw.

Consequently, calls such as `deposit` normally failed at `transferFrom` because the caller had no balance or allowance. Calls such as `withdraw` normally failed because the caller had no shares/deposit balance. Foundry normally treats a reverted action as a discarded step, not as a failed invariant test. After each attempted step it checked `invariant_SolvencyHolds`, but the vault was still at or close to its deployment state. The suite repeatedly proved only that an untouched vault is solvent.

This also explains why increasing `runs` or `depth` did not help. More random attempts do not make an unreachable valid state reachable. The user's sequence is in the vault's abstract API, but it was outside the state space produced by this harness.

The warning was in the invariant result's call/revert statistics, especially the per-selector statistics printed with verbose test output. A line resembling

```text
runs: 512, calls: 25600, reverts: 25xxx
```

or deposit/withdraw selector rows showing almost all calls reverting means that the nominal depth is not effective depth. We should have required a substantial number of successful deposits and withdrawals and inspected their distribution across selectors and actors. While developing the harness, setting this makes the problem impossible to overlook:

```toml
[invariant]
fail_on_revert = true
```

`fail_on_revert` is useful as a harness-quality check; the essential fix is to target a handler that constructs valid actions.

# Fix: target a stateful handler

The handler must own the preconditions that ordinary users supply in production: funded actors, token approvals, valid amounts, and (if interaction matters) multiple actors. For example, adapting the balance getter and mint helper names to the actual vault and mock:

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
        uint256 available = vault.deposits(actor); // use the vault's real getter

        // There is no valid withdrawal for this actor yet. Returning is an
        // intentional no-op, rather than allowing a meaningless revert.
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

If `withdraw` is share-based, its bound must use the actor's share balance and call the corresponding share-based interface. If the exploit needs deposits replenished indefinitely, the handler can mint before each deposit (and track ghost variables if necessary) rather than exhausting its initial funding. The important points are that every generated operation has a real actor, its preconditions are deliberately satisfied, amounts are bounded into the accepted domain, and the invariant engine targets the handler rather than the vault.

After this change, `depth = 50` represents sequences containing successful state transitions. The run output should confirm that both handler selectors are actually called successfully and that reverts are zero or low and understood. Then Foundry can compose the same ordinary deposit/withdraw history that the user executed and minimize it to a counterexample when the solvency assertion fires.
