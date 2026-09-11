# The campaign had depth, but no reachable state space

`runs * depth` is a count of **attempted calls**, not successful calls. Foundry generated 512 independent sequences of 50 calls to functions in `vault`. After every attempt it evaluated `invariant_SolvencyHolds`.

The target was called directly, using fuzzed calldata and fuzz-selected senders. None of those senders had been given the prerequisites that a real vault user has:

- no underlying-token balance;
- no allowance for the vault; and
- no deposit/position from which to withdraw.

Consequently, deposits reverted in `transferFrom` (or on an equivalent balance/allowance check), and withdrawals reverted because the caller had no position. A reverted call consumes one unit of invariant depth, but rolls back all of its state changes. Since Foundry's default is `fail_on_revert = false`, those reverts did not fail the test. The assertion was therefore repeatedly checked against essentially the fresh state from `setUp`: zero vault assets and zero deposits. It was proving only that the empty vault is solvent.

This also explains why merely increasing `runs` or `depth` does not help. Random calldata cannot create an ERC-20 approval, because the approval must be made by the same actor against the token contract, which is not even targeted here. Nor can a withdrawal succeed before that actor has a successful deposit.

The warning was in Forge's result line:

```text
[PASS] invariant_SolvencyHolds() (runs: 512, calls: 25600, reverts: 25600)
```

The exact revert count may be slightly below 25,600 if a harmless view call or zero-amount path succeeds, but a revert count at or near the call count is the signal. We should have monitored successful-call/revert ratios, not just the green status. Enabling invariant call metrics makes this still clearer:

```toml
[invariant]
runs = 512
depth = 50
show_metrics = true
```

The per-selector metrics would show that the state-changing deposit and withdrawal paths were always (or almost always) reverting. During suite development, `fail_on_revert = true` is also a useful tripwire: it would have made this vacuous campaign red immediately. It is a diagnostic guard, however, not by itself the fix that makes the exploit reachable.

## Make valid actions reachable with a handler

Target a handler rather than the vault directly. Its fuzz entry points establish token balances and approvals, select persistent actors, and constrain amounts to actions that can succeed. For example (adapting the balance/share getter names to `MyVault`):

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
        actors.push(makeAddr("carol"));
    }

    function deposit(uint256 actorSeed, uint256 rawAmount) external {
        address actor = actors[actorSeed % actors.length];
        uint256 amount = bound(rawAmount, 1, 1e24);

        token.mint(actor, amount);
        vm.startPrank(actor);
        token.approve(address(vault), amount);
        vault.deposit(amount);
        vm.stopPrank();
    }

    function withdraw(uint256 actorSeed, uint256 rawAmount) external {
        address actor = actors[actorSeed % actors.length];
        uint256 available = vault.balanceOf(actor); // or the vault's per-user deposit getter
        if (available == 0) return;
        uint256 amount = bound(rawAmount, 1, available);

        vm.prank(actor);
        vault.withdraw(amount);
    }
}
```

Then change setup to:

```solidity
VaultHandler handler;

function setUp() public {
    token = new MockERC20();
    vault = new MyVault(token);
    handler = new VaultHandler(vault, token);
    targetContract(address(handler)); // not address(vault)
}
```

Now each depth step represents a valid user-level action, actors retain state across the sequence, and Forge can compose ordinary deposits and withdrawals into the draining sequence. Keep the original solvency invariant unchanged. Once handler methods are designed not to reject normal fuzz inputs, add `fail_on_revert = true` as well so the suite cannot silently regress into testing only reverted calls:

```toml
[invariant]
runs = 512
depth = 50
show_metrics = true
fail_on_revert = true
```

If the real withdrawal API uses shares rather than assets, the handler must bound against the actor's shares and call that exact API. That detail matters: the handler should model the same ordinary actions and actor continuity as production, not manufacture protocol storage directly.
