Those 25,600 calls were not 25,600 successful user actions against the vault. They
were 512 random sequences of 50 attempted calls to functions on `MyVault`, using
random calldata and random senders.

Because the target was the vault itself, Foundry had no idea how to satisfy the
preconditions for ordinary vault use. A real deposit usually requires the caller to
own tokens and to have approved the vault. The invariant fuzzer was just calling
`vault.deposit(...)` directly from arbitrary senders that had no token balance and
no allowance. Those calls reverted. Withdraw calls had the same problem in the
other direction: since no deposit had succeeded, the random senders had no recorded
deposit or shares to withdraw. Those calls reverted too.

By default, invariant campaigns do not fail just because a target call reverts.
The depth counter still advances. So the campaign could honestly report about
25,600 calls while doing essentially zero useful state transitions. The invariant
was checked after each attempted call, but the vault was still in its initial or
near-initial state, for example:

```solidity
token.balanceOf(address(vault)) == 0
vault.totalDeposits() == 0
```

So `assertGe(token.balanceOf(address(vault)), vault.totalDeposits())` kept passing.
The assertion was good; the reachable state space was empty.

The thing to look at in the run output was the revert count:

```text
[PASS] invariant_SolvencyHolds() (runs: 512, calls: 25600, reverts: 25600)
```

or anything close to that. That line would have said the suite was mostly testing
failed calls. Even better, enable invariant metrics:

```toml
[invariant]
runs = 512
depth = 50
show_metrics = true
```

The metrics would have shown the targeted functions and that `deposit` and
`withdraw` were reverting instead of mutating vault state. A green invariant with a
huge revert count is not evidence that the property survived realistic usage; it is
often evidence that the fuzzer never got through the front door.

The fix is to target a handler, not the vault directly. The handler should model
ordinary users by setting up balances and approvals before deposit, and by bounding
withdrawals to amounts that the selected actor can actually withdraw.

For example:

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

contract VaultHandler is Test {
    MyVault vault;
    MockERC20 token;

    address[] actors;

    constructor(MyVault _vault, MockERC20 _token) {
        vault = _vault;
        token = _token;

        actors.push(makeAddr("alice"));
        actors.push(makeAddr("bob"));
        actors.push(makeAddr("carol"));
    }

    function deposit(uint256 actorSeed, uint256 amount) external {
        address actor = actors[bound(actorSeed, 0, actors.length - 1)];
        amount = bound(amount, 1, 1_000_000 ether);

        deal(address(token), actor, amount);

        vm.startPrank(actor);
        token.approve(address(vault), amount);
        vault.deposit(amount);
        vm.stopPrank();
    }

    function withdraw(uint256 actorSeed, uint256 amount) external {
        address actor = actors[bound(actorSeed, 0, actors.length - 1)];

        uint256 maxWithdraw = vault.balanceOf(actor); // or vault.deposits(actor)
        if (maxWithdraw == 0) return;

        amount = bound(amount, 1, maxWithdraw);

        vm.prank(actor);
        vault.withdraw(amount);
    }
}
```

The exact balance getter and deposit/withdraw signatures should match `MyVault`,
but the important change is structural: the fuzzer calls the handler, and the
handler turns fuzzed inputs into valid user-level actions. Now the 512 sequences
contain real deposits, real withdrawals, and repeated interactions by the same
actors. That is the state space where the drain sequence lives, so this suite can
actually find it.
