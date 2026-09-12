# Why the invariant stayed green

`runs = 512` and `depth = 50` means Foundry generated 512 sequences containing up to 50 **attempted calls** each. It does not mean that the vault successfully executed 25,600 state transitions.

`targetContract(address(vault))` made Foundry call the vault's public/external functions directly with arbitrary calldata and fuzzed callers. Those callers had not been prepared to use the vault: they generally owned no tokens, had not approved the vault, and often supplied amounts that were impossible for their balances or vault positions. Consequently, the state-changing deposit and withdrawal calls reverted at their token transfer, allowance, balance, share, or other validity checks.

Unless `fail_on_revert` is enabled, those reverts are discarded as unusable actions; they do not fail the invariant run. After each discarded call Foundry checked `invariant_SolvencyHolds`, but the revert had rolled back all state. The test was therefore repeatedly checking the initial state, or another shallow state reached by the few successful calls. It never explored the valid deposit/withdraw state machine that the user traversed.

This is why the correct assertion did not help: an invariant can only detect bad states that the action generator can reach. Replaying the real transactions reaches such a state, while this generator did not.

## The warning in the output

The invariant run summary's **calls and reverts** statistics were the important evidence. A revert count equal or close to the call count—especially for the deposit and withdrawal selectors—shows that the nominal depth is not effective depth. For example, a report resembling `calls: 25600, reverts: 255xx` says that almost all 25,600 fuzz actions were rolled back. Per-selector call/revert statistics, when printed, would identify `deposit` and `withdraw` as the ineffective actions.

`fail_on_revert = true` is useful while developing the suite because it turns this silent loss of exploration into an immediate failure. It is a diagnostic guard, though, not the main fix.

## Make valid actions through a handler

Target a handler rather than the vault. The handler must construct valid preconditions: fund actors, approve the vault, bound inputs to usable ranges, and preserve persistent actors across calls. Its actions should call the real vault. A representative shape is below; the exact balance/share getter and deposit/withdraw signatures should be adapted to `MyVault`.

```solidity
contract VaultHandler is Test {
    MyVault public immutable vault;
    MockERC20 public immutable token;

    address[] internal actors;
    address internal currentActor;

    constructor(MyVault _vault, MockERC20 _token) {
        vault = _vault;
        token = _token;

        actors.push(makeAddr("alice"));
        actors.push(makeAddr("bob"));

        for (uint256 i; i < actors.length; ++i) {
            token.mint(actors[i], 1_000_000 ether);
            vm.prank(actors[i]);
            token.approve(address(vault), type(uint256).max);
        }
    }

    modifier useActor(uint256 actorSeed) {
        currentActor = actors[bound(actorSeed, 0, actors.length - 1)];
        vm.startPrank(currentActor);
        _;
        vm.stopPrank();
    }

    function deposit(uint256 actorSeed, uint256 amount)
        external
        useActor(actorSeed)
    {
        amount = bound(amount, 1, token.balanceOf(currentActor));
        vault.deposit(amount);
    }

    function withdraw(uint256 actorSeed, uint256 amount)
        external
        useActor(actorSeed)
    {
        // Use the vault's actual withdrawable-balance/share getter here.
        uint256 available = vault.balanceOf(currentActor);
        if (available == 0) return;
        amount = bound(amount, 1, available);
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

During handler development, configure:

```toml
[invariant]
runs = 512
depth = 50
fail_on_revert = true
```

Returning early for an actor with nothing to withdraw is acceptable but is still a no-op, so the final run statistics must be reviewed. The goal is not literally zero no-ops; it is a low revert/no-op rate and substantial successful coverage of both deposit and withdrawal across meaningful multi-call sequences. Once the handler generates the same class of valid ordinary actions as real users, the existing solvency assertion is capable of finding the draining sequence.
