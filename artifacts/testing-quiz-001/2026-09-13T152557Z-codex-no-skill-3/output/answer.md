# Why the invariant suite was green

`runs * depth` is a budget of **attempted calls**, not a measure of useful state transitions or coverage. Each of the 512 runs starts from the state produced by `setUp`, and Forge attempts a sequence of 50 calls. It checks the invariant after every attempt, including an attempt that reverted. A revert still consumes one unit of depth.

Here, `targetContract(address(vault))` tells Forge to fuzz calls to the vault ABI directly. It also replaces the default target set, so the separately deployed `MockERC20` is not being fuzzed. Forge supplies random calldata and, by default, random senders. It does not infer the protocol preconditions for a deposit:

- the sender must own the asset;
- the sender must have approved the vault;
- the amount must be meaningful and within the sender's balance; and
- a later withdrawal must be made by an actor with an appropriate existing position.

No such state is established in `setUp`. Consequently, deposits from the generated senders revert at `transferFrom` for lack of balance and/or allowance. Withdrawals revert because the generated sender has no deposit (and random 256-bit amounts are generally invalid anyway). A zero-value call may occasionally succeed, depending on the implementation, but it does not move the vault into an interesting state. Because a reverted EVM call rolls back all of its state changes, the invariant is then checked against essentially the initial empty, solvent vault over and over:

```text
attempt deposit -> revert -> unchanged empty vault -> invariant passes
attempt withdraw -> revert -> unchanged empty vault -> invariant passes
```

Thus “25,600 calls” did not mean 25,600 successful deposit/withdraw transitions. It most likely meant approximately 25,600 rejected attempts against the same trivial state.

## The warning in the output

The important field was `reverts` in Forge's invariant summary, for example:

```text
[PASS] invariant_SolvencyHolds() (runs: 512, calls: 25600, reverts: 25600)
```

Even if the exact number was slightly lower because zero-value or otherwise harmless calls succeeded, a very high revert count was the coverage alarm. Enable:

```toml
[invariant]
show_metrics = true
```

and inspect the per-selector call/revert/discard metrics. They would have shown that `deposit` and `withdraw` were not producing successful state transitions. During development, also use:

```toml
[invariant]
fail_on_revert = true
```

after constructing valid actions. The default is `false`, so reverted calls otherwise do not fail the campaign. `fail_on_revert = true` alone is not the real fix: with the current test it merely reports that the generated calls are invalid.

## Make the generated actions valid

Target a handler rather than the vault directly. The handler turns arbitrary fuzz input into reachable protocol actions: it selects persistent actors, bounds amounts, funds them, approves the vault, and only withdraws from an actor that has a position. For example (adapt names and signatures to `MyVault`):

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
        actors.push(address(0xCA401));
    }

    function deposit(uint256 actorSeed, uint256 rawAmount) external {
        address actor = actors[actorSeed % actors.length];
        uint256 amount = bound(rawAmount, 1, 1_000_000 ether);

        token.mint(actor, amount);
        vm.startPrank(actor);
        token.approve(address(vault), amount);
        vault.deposit(amount);
        vm.stopPrank();
    }

    function withdraw(uint256 actorSeed, uint256 rawAmount) external {
        address actor = actors[actorSeed % actors.length];
        uint256 available = vault.balanceOf(actor); // or vault.deposits(actor)
        if (available == 0) return;

        uint256 amount = bound(rawAmount, 1, available);
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

If the real withdrawal API uses shares, an owner/receiver pair, or permits withdrawal on behalf of another actor, the handler must model those exact choices rather than using the placeholder `balanceOf`. Likewise, do not over-constrain `amount` if the production API intentionally accepts a wider range: the handler should eliminate impossible calls, not eliminate the suspected attack surface. If the exploit depends on multiple depositors or cross-actor calls, keep the actor seed parameters as above so a sequence can reproduce them.

After this change, `depth = 50` represents up to 50 meaningful, stateful actions in a run. The fuzzer can now build the prerequisite deposits and then explore the withdrawal ordering that breaks solvency. Keep `show_metrics = true`, and aim to see substantial successful call counts for every intended handler action. Forge's official invariant-testing guide documents that reverted calls consume depth, that `targetContract` determines the called contracts, and that handlers are the intended way to satisfy ERC-20 deposit preconditions: [Foundry invariant testing](https://getfoundry.sh/forge/invariant-testing).
