# Why the invariant stayed green

`runs = 512` and `depth = 50` means that Foundry attempted up to 512 sequences of 50 generated calls. It does **not** mean the vault completed 25,600 meaningful deposit or withdrawal operations.

`targetContract(address(vault))` tells the invariant engine to call the vault's public/external functions directly, with arbitrary calldata and arbitrary callers. Those callers were not prepared as vault users: they generally had no tokens, had not approved the vault, had no deposit/share balance, and received unbounded withdrawal amounts. Consequently, the economically interesting calls reverted—for insufficient balance, insufficient allowance, zero holdings, invalid amounts, and similar preconditions.

By default, a reverted action is discarded and the campaign continues. It does not make the invariant test fail. The invariant was therefore checked repeatedly against the initial state, or against only the small subset of trivial calls that happened to succeed. In that state both custody and accounting were zero (or otherwise unchanged), so

```solidity
token.balanceOf(address(vault)) >= vault.totalDeposits()
```

was necessarily true. Increasing `runs` or `depth` only produced more invalid attempts; it did not make valid state transitions more likely in a useful way.

The warning was in Foundry's invariant-run summary: the per-selector call and revert counts. `deposit` and `withdraw` would have shown a revert rate at or near 100%, with few or no successful calls. Those statistics describe the search far better than the nominal `runs * depth` number. While developing the campaign, setting this also makes the problem impossible to overlook:

```toml
[invariant]
runs = 512
depth = 50
fail_on_revert = true
```

`fail_on_revert` is a diagnostic guardrail, not the ultimate fix. The fix is to target a handler that constructs valid actions and calls the vault from funded, approved actors. For example (with names adjusted to the vault's actual deposit/share API):

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
        uint256 available = vault.balanceOf(actor); // or the vault's claim/deposit getter
        if (available == 0) return;
        amount = bound(amount, 1, available);

        vm.prank(actor);
        vault.withdraw(amount);
    }
}
```

Then target that handler, not the vault:

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

If the drained sequence depends on more than one user's interactions, the handler must retain multiple actors, as above, and select among them. If it depends on exact deposit/withdraw semantics (assets versus shares, caps, minimums, cooldowns, and so on), each handler action must bound inputs against those real preconditions. The success criterion is visible in the next run's output: substantial successful `deposit` and `withdraw` counts and a low, understood revert rate. At that point the 512 sequences are searches through reachable vault states, rather than 512 repetitions of the unchanged initial state.
