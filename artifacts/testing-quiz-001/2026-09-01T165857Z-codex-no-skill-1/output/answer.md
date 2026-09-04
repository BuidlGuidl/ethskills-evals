# Why the invariant test was vacuous

`runs = 512` and `depth = 50` mean that Foundry generated at most 512 sequences of 50 **call attempts**. They do not mean that it executed 25,600 useful vault state transitions, nor that it covered combinations of deposits and withdrawals.

By targeting the vault directly, the fuzzer selected public/external vault selectors and supplied arbitrary calldata and callers. Most generated `deposit` calls could not satisfy the protocol's preconditions: the caller had no tokens, had not approved the vault, or the random amount exceeded its balance or allowance. `withdraw` calls similarly came from accounts with no deposit/shares or requested an invalid amount. Those calls reverted and their state changes were rolled back. Calls to getters and any zero/no-op paths may have succeeded, but did not construct the required state either.

Consequently, the invariant was checked repeatedly against essentially the initial state (or a small collection of trivial reachable states). It was green because the generator could not reach the interesting state, not because the property survived meaningful deposit/withdraw sequences. Replaying the exploit by hand works because the replay supplies the prerequisite balances, approvals, callers, and valid amounts that the raw fuzzer never constructed.

The warning was in Foundry's invariant summary, especially the `reverts` count alongside `runs` and `calls`, for example:

```text
[PASS] invariant_SolvencyHolds() (runs: 512, calls: 25600, reverts: 25xxx)
```

A very high revert ratio means the depth budget is being spent rejecting inputs. The logs/traces for sample reverts would also have shown allowance, balance, or share/deposit precondition failures. During test development, setting this is a useful way to make that problem impossible to overlook:

```toml
[invariant]
fail_on_revert = true
```

That setting is a diagnostic, however; it does not make the exploit reachable.

## Make actions valid with a handler

Target a handler whose actions create valid protocol operations. The handler should provision actors with tokens and approvals, select callers deliberately, and bound amounts to the actors' current valid ranges. For example (names should be adapted to the vault's actual share/accounting API):

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
            token.mint(actors[i], type(uint128).max);
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
        uint256 available = vault.deposits(actor); // or shares/assets redeemable
        if (available == 0) return;
        amount = bound(amount, 1, available);

        vm.prank(actor);
        vault.withdraw(amount);
    }
}
```

Then change setup so that the handler—not the raw vault—is the target:

```solidity
VaultHandler handler;

function setUp() public {
    token = new MockERC20();
    vault = new MyVault(token);
    handler = new VaultHandler(vault, token);

    targetContract(address(handler));
}
```

It is also reasonable to use `targetSelector` to restrict generation explicitly to the handler's `deposit` and `withdraw` actions. The invariant assertion itself can remain unchanged.

The important change is not merely increasing `runs` or `depth`; it is changing the generated action space so that calls satisfy the vault's preconditions and sequences actually move through relevant states. After that change, the summary should show a low, understood revert count, and Foundry can generate and shrink the ordinary deposit/withdraw sequence that violates solvency.
