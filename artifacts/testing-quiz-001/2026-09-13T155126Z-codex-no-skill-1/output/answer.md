# Why the invariant suite was green

`runs * depth` is an execution budget, not a count of successful state transitions. Foundry generated 512 independent sequences and, in each sequence, attempted 50 calls to selectors on `vault` with fuzzed arguments and fuzz-selected senders. After every attempt it called `invariant_SolvencyHolds`.

A reverted call still consumes one unit of `depth`. Since `fail_on_revert` defaults to `false`, that revert is ignored and the campaign continues. Its state changes are rolled back, so the invariant is then checked against exactly the state that existed before the attempted call.

Here the generated callers were never made into valid vault users:

- They had no mock tokens.
- They had not approved the vault, so a normal `deposit` could not complete its `transferFrom`.
- They had no existing deposit/share balance, so a normal `withdraw` could not complete either.
- Independently selected senders also do not naturally model “the same funded user deposits and later withdraws.”

Consequently, the purported 25,600 calls were overwhelmingly—or, for the relevant entry points, entirely—failed transaction attempts. They did not construct the reachable states needed by the exploit. The initial state was `token.balanceOf(vault) == 0` and `vault.totalDeposits() == 0`; every reverted attempt left it there, and `0 >= 0` passed every time. More runs merely repeated the vacuous exercise.

## The warning in the output

The important part of Forge's result line was not `[PASS]`; it was the revert count:

```text
[PASS] invariant_SolvencyHolds() (runs: 512, calls: 25600, reverts: 25600)
```

The exact count can vary if the vault has other callable selectors, but a revert count close to the call count is the same warning. Enabling this makes the per-selector problem even clearer:

```toml
[invariant]
runs = 512
depth = 50
show_metrics = true
```

The call metrics show how often each handler/target function was called, reverted, or discarded. Deposits and withdrawals with zero successful calls mean the invariant has not exercised the vault lifecycle. Foundry explicitly documents that reverted calls still increment depth and recommends `show_metrics` for this reason: [Invariant Testing](https://getfoundry.sh/forge/invariant-testing).

Setting `fail_on_revert = true` is also a useful CI guardrail: this harness would have failed immediately instead of appearing healthy. It diagnoses the broken harness, however; by itself it does not make deposits and withdrawals valid.

## Make valid state transitions through a handler

Replace the vault as the fuzz target with a handler. The handler must choose from a small persistent actor set, fund the chosen actor, approve the vault, and bound actions to values that satisfy the protocol's preconditions. For a vault whose API is `deposit(uint256)` and `withdraw(uint256)`, the shape is:

```solidity
contract VaultHandler is Test {
    MyVault internal immutable vault;
    MockERC20 internal immutable token;

    address[] internal actors = [address(0xA11CE), address(0xB0B)];

    constructor(MyVault vault_, MockERC20 token_) {
        vault = vault_;
        token = token_;
    }

    function deposit(uint256 actorSeed, uint256 rawAmount) external {
        address actor = actors[actorSeed % actors.length];
        uint256 amount = bound(rawAmount, 1, 1e24);

        token.mint(actor, amount);
        vm.startPrank(actor);
        token.approve(address(vault), type(uint256).max);
        vault.deposit(amount);
        vm.stopPrank();
    }

    function withdraw(uint256 actorSeed, uint256 rawAmount) external {
        address actor = actors[actorSeed % actors.length];
        uint256 available = vault.balanceOf(actor); // use the vault's claim/share getter
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

        targetContract(address(handler)); // not address(vault)
    }

    function invariant_SolvencyHolds() public view {
        assertGe(token.balanceOf(address(vault)), vault.totalDeposits());
    }
}
```

The getter and whether `withdraw` consumes assets or shares must be adapted to the actual vault API. If the real transaction sequence needs several accounts or transfers, expose those operations on the same handler and select actors from the same persistent array. The essential change is that every fuzzed action prepares a legitimate call and preserves actor history, so a generated `deposit -> ... -> withdraw` sequence actually changes vault state. With those calls reachable, Foundry checks the solvency assertion after each successful step and can shrink a discovered failure to the draining sequence.

Keep `show_metrics = true`, and preferably `fail_on_revert = true`, after adding the handler. A healthy campaign should report substantial successful calls for every important action; the raw `calls` number alone is not coverage.
