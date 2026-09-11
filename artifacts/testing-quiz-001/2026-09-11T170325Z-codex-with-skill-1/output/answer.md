# Why the invariant suite stayed green

The 25,600 figure is a count of **attempted calls**, not 25,600 successful vault operations.

`targetContract(address(vault))` makes Foundry select public/external functions from `MyVault` and invoke them with fuzzed arguments and fuzzed callers. It does not prepare those callers to use the vault. In this setup no caller was given tokens, no caller approved the vault, and no valid relationship was maintained between deposits and later withdrawals.

Consequently, ordinary calls such as these overwhelmingly reverted:

- `deposit(amount)` reverted because the random caller had no tokens or allowance (and arbitrary amounts were usually impossible anyway).
- `withdraw(amount)` reverted because the random caller had no deposit, shares, or other withdrawal entitlement.
- Any calls that did succeed were calls that did not establish the state needed for the vulnerable deposit/withdraw sequence.

By default, a revert in an invariant action is not itself a test failure. Foundry discards that attempted transition and continues the sequence. Thus most of the nominal depth consisted of no-op, reverted attempts. The vault remained at or very near its initial state, where both its token balance and `totalDeposits()` were zero, so the correct solvency assertion had no opportunity to fail. More runs and greater depth only repeated the same unreachable-input problem.

The warning was in Foundry's invariant run summary: the per-contract/per-selector **Calls** and **Reverts** statistics. A near-100% revert rate for `deposit` and `withdraw`, or zero successful calls to one of them, shows that the campaign is not exploring useful vault states. Those counters should be reviewed as part of every invariant run; a green assertion without successful state transitions is not evidence for the property. Setting this while developing the harness makes the problem impossible to overlook:

```toml
[invariant]
runs = 512
depth = 50
fail_on_revert = true
```

`fail_on_revert` is useful for constructing and debugging the handler. It does not replace inspecting the call/revert distribution, and intentional reverts should be tested separately or explicitly handled.

## The required change

Target a **handler**, not the vault directly. The handler must create funded, approved actors and convert arbitrary fuzz inputs into valid operations. It must also preserve actor state so that a later withdrawal can belong to an actor that previously deposited.

For example, adapting the balance/entitlement getter names to `MyVault`:

```solidity
contract VaultHandler is Test {
    MyVault immutable vault;
    MockERC20 immutable token;

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

        // Replace depositsOf with the vault's actual shares/claim getter.
        uint256 available = vault.depositsOf(actor);
        if (available == 0) return;
        amount = bound(amount, 1, available);

        vm.prank(actor);
        vault.withdraw(amount);
    }
}
```

The invariant setup then becomes:

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

If withdrawal units differ from deposit units (for example, shares versus assets), the handler must use the vault's preview/conversion functions and bound the input in the correct unit. If the real exploit requires a particular actor-selection pattern, the handler must expose that pattern rather than accidentally preventing it. The essential fix is that fuzzed actions now reach successful deposits and withdrawals by persistent, funded, approved actors. That makes the vulnerable sequence reachable; increasing `runs` and `depth` only becomes meaningful after that is true.
