# Why the invariant suite stayed green

`calls: 25600` means that Foundry attempted 25,600 calls. It does not mean that the vault executed 25,600 successful deposit or withdrawal transitions.

By targeting the vault directly, the test asked Foundry to call the vault's external functions with arbitrary calldata and arbitrary callers. Those callers had not been given tokens, had not approved the vault, and had no deposits to withdraw. Consequently, calls such as `deposit` normally reverted in `transferFrom`, while calls such as `withdraw` normally reverted because the caller had no balance (or because the random amount was invalid). Any successful calls were likely harmless views or degenerate inputs. A reverted call rolls back its state changes; by default, it is not a failing invariant result.

The invariant was therefore repeatedly checked against the initial state, or states reached only by trivial calls. The property was valid and capable of detecting the real exploit, but the generated search never constructed the prerequisite state in which the vulnerable sequence could run. Increasing `runs` or `depth` only increased the number of rejected attempts; it did not repair the input distribution or actor setup.

The warning was in Forge's invariant statistics: the call/revert counts, especially a revert count close to the total call count. Depending on the Forge version and verbosity, the summary is printed in a form such as:

```text
runs: 512, calls: 25600, reverts: 25xxx
```

That statistic must be treated as part of the test result. A green assertion accompanied by an approximately 100% revert rate says that almost no state space was explored. Selector/call distribution output, when enabled, is also useful: it shows whether the intended mutating actions actually succeeded. While developing the harness, setting this makes the problem impossible to overlook:

```toml
[invariant]
fail_on_revert = true
```

`fail_on_revert` is a harness diagnostic, not the complete fix. The fix is to target a handler that creates valid actions: it owns or selects funded actors, grants approvals, tracks reasonable input bounds, and invokes the vault as those actors. For example (with names adjusted to the vault's actual API):

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
        uint256 claim = vault.balanceOf(actor); // use the vault's actual per-user getter
        if (claim == 0) return;
        amount = bound(amount, 1, claim);

        vm.prank(actor);
        vault.withdraw(amount);
    }
}
```

The invariant setup then targets the handler, not the vault:

```solidity
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
```

The exact handler must match the real deposit accounting and API, but its essential job is unchanged: turn arbitrary fuzz inputs into valid, successful deposit and withdrawal transitions. After making this change, inspect the call/revert statistics again and confirm that the two mutating handler selectors execute successfully in substantial numbers. Then the configured depth represents sequences of real state changes, making the ordinary user sequence discoverable.
