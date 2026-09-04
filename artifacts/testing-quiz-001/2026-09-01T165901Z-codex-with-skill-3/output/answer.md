# Why the invariant suite stayed green

`runs = 512` and `depth = 50` mean that Foundry generated 512 sequences of up to 50 **call attempts**. They do not mean that it executed 25,600 successful, valid vault operations.

`targetContract(address(vault))` made Foundry select public/external functions from the vault ABI and call the vault directly with fuzzed arguments. It did not automatically create funded depositors, mint tokens to them, approve the vault, or choose withdrawals that were valid for the current state.

Consequently, the calls that mattered were not reaching useful states:

- A deposit made by the invariant-test caller had no token balance and/or allowance, so `transferFrom` reverted before a deposit was recorded.
- A withdrawal had no existing deposit or shares to withdraw, so it reverted (or was otherwise a no-op) before changing the vault.
- Random values were overwhelmingly outside the small state-dependent set of useful inputs.

Foundry normally treats a reverted action during invariant exploration as a rejected step and continues (`fail_on_revert` is false unless configured otherwise). The invariant was then checked against essentially the initial state, or another trivial reachable state. In that state both the token balance and `totalDeposits()` were zero, so the correct assertion was vacuously true. Increasing `runs` or `depth` only produced more attempts at the same unreachable paths.

The warning was in the invariant result's call/revert statistics. With verbose output, Foundry reports the number of runs, calls, and reverts, for example:

```text
[PASS] invariant_SolvencyHolds() (runs: 512, calls: 25600, reverts: 25600)
```

Depending on the Foundry version and verbosity, the per-selector call summary also shows how often each function was called and how many of those calls reverted. A very high overall revert rate—especially deposits and withdrawals reverting every time—or zero successful calls to the important selectors says that the fuzzer is not exploring the protocol. The green `PASS` line alone is not evidence of meaningful coverage. Temporarily setting `fail_on_revert = true` is also a useful diagnostic because this suite would fail immediately, but it does not by itself make the inputs valid.

## Make valid state transitions reachable

Target a handler instead of the vault. The handler should turn arbitrary fuzz input into valid actions: fund an actor, approve the vault, bound amounts to useful ranges, and bound withdrawals to what that actor can actually withdraw. For example (adjust the vault's exact deposit/withdraw signatures as needed):

```solidity
contract VaultHandler is Test {
    MyVault internal immutable vault;
    MockERC20 internal immutable token;

    address[] internal actors;

    constructor(MyVault _vault, MockERC20 _token) {
        vault = _vault;
        token = _token;
        actors.push(makeAddr("alice"));
        actors.push(makeAddr("bob"));
    }

    function deposit(uint256 actorSeed, uint256 amount) external {
        address actor = actors[actorSeed % actors.length];
        amount = bound(amount, 1, 1_000_000e18);

        deal(address(token), actor, amount);
        vm.startPrank(actor);
        token.approve(address(vault), amount);
        vault.deposit(amount);
        vm.stopPrank();
    }

    function withdraw(uint256 actorSeed, uint256 amount) external {
        address actor = actors[actorSeed % actors.length];
        uint256 available = vault.deposits(actor); // or shares/balanceOf(actor)
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

The essential change is `targetContract(address(handler))`, with handler methods that successfully establish the prerequisites for ordinary user calls. If the exploit depends on a particular relationship between deposit and withdrawal amounts or actors, the handler must preserve that relationship rather than filtering it away. After the change, inspect the call summary again: deposits and withdrawals should both have substantial successful-call counts and the vault's state should demonstrably move away from zero. Then the 512 sequences can search for the draining sequence instead of repeatedly bouncing off preconditions.
