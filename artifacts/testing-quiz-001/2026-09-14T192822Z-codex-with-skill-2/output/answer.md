# Why the invariant stayed green

`runs = 512` and `depth = 50` means that Foundry generated 512 sequences of up to 50 **attempted calls** each. It does not mean that the vault underwent 25,600 useful state transitions.

`targetContract(address(vault))` made Foundry call the vault directly with fuzzed calldata, arguments, and callers. Those callers had not been given tokens, had not approved the vault, and usually did not have a deposit or shares to withdraw. Consequently, ordinary state-changing calls failed their normal preconditions:

- deposits reverted because the caller had no tokens and/or allowance;
- withdrawals reverted because the caller had no balance, shares, or recorded deposit;
- other calls reverted because random arguments were unusable or the caller lacked a required role.

By default, a reverted invariant action is discarded; it does not make the invariant test fail. Foundry then checked `invariant_SolvencyHolds` after sequences in which almost none of the attempted actions had changed the vault. Getters or harmless calls may have succeeded, but they did not construct the deposit/withdraw history needed to expose the bug. The assertion therefore kept checking the initial or another trivial state, where custody was at least the recorded deposits.

The run output's invariant call metrics were the warning. In particular, the per-selector `calls` and `reverts` counts (and their totals) would have shown a revert rate near 100% for `deposit` and `withdraw`. A large `runs * depth` number is meaningless when almost all calls revert. During harness development, make this unmistakable with:

```toml
[invariant]
runs = 512
depth = 50
fail_on_revert = true
```

`fail_on_revert` is a useful harness-debugging setting; the lasting requirement is to inspect the call/revert statistics and keep the actions' revert rate low.

# The required change

Target a handler, not the vault. The handler must create reachable actions: fund actors, approve the vault, select actors deliberately, and bound amounts according to their current balances or claims. For example (adjusting function and getter names to the actual vault):

```solidity
contract VaultHandler is Test {
    MyVault internal immutable vault;
    MockERC20 internal immutable token;
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

        // Replace this with the vault's actual per-user claim/share getter.
        uint256 available = vault.balanceOf(actor);
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

If withdrawals are share-based, bound shares and call the share-based API; if they are asset/claim-based, bound against that claim. The essential change is that handler calls normally succeed and preserve state across the 50-call sequence. Foundry can then explore combinations of successful deposits and withdrawals—including the user's ordinary sequence—and the existing solvency assertion can finally encounter and report the bad state.
