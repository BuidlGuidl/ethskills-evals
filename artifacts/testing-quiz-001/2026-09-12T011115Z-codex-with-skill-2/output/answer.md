# Why the green invariant run proved almost nothing

`runs = 512` and `depth = 50` means Foundry generated 512 sequences with up to 50 **call attempts** in each sequence. It does not mean the vault completed 25,600 meaningful deposit or withdrawal transitions.

`targetContract(address(vault))` made Foundry call the vault directly. The caller and arguments were fuzz-generated, but those callers had not been prepared as vault users: they generally owned no tokens, had not approved the vault, and had no deposit, shares, or other withdrawable position. Consequently, calls such as `deposit` failed at `transferFrom`, and calls such as `withdraw` failed because the caller had nothing to withdraw (or because an unconstrained amount was invalid).

In an invariant campaign, a reverted fuzzed action is normally rejected as an invalid step; it does not by itself fail the invariant run. Foundry then invokes `invariant_SolvencyHolds` after the attempted action. Since almost all state-changing actions reverted, the vault remained at, or very near, its initial state:

```text
token.balanceOf(vault) == 0
vault.totalDeposits()   == 0
```

Thus `0 >= 0` passed repeatedly. The fuzzer may also have successfully called harmless/view functions, but those do not construct the deposit/withdraw history required by the bug. Sequence depth measures opportunities to transition state, not evidence that useful transitions occurred.

The warning was in Forge's invariant call statistics. The per-contract/per-selector table reports the number of calls and reverts. We should have inspected it on every run, especially the revert rate for `deposit` and `withdraw`. A rate near 100%, or zero successful calls to the relevant mutators, says that the state machine is unreachable through the harness. The nominal `runs`, `depth`, and green assertion are not substitutes for that evidence. Enabling this while developing the harness makes the problem loud:

```toml
[invariant]
fail_on_revert = true
```

That setting is useful for validating the harness; the essential production fix is to make generated actions valid often enough to explore real state.

## Make the handler the target

Target a handler that creates funded, approved actors and converts arbitrary fuzz inputs into valid actions. The exact getters and deposit/withdraw signatures below should be adapted to `MyVault`, but the required shape is:

```solidity
contract VaultHandler is Test {
    MyVault public immutable vault;
    MockERC20 public immutable token;

    address[] internal actors;

    constructor(MyVault _vault, MockERC20 _token) {
        vault = _vault;
        token = _token;

        actors.push(makeAddr("alice"));
        actors.push(makeAddr("bob"));

        for (uint256 i; i < actors.length; ++i) {
            // `deal` works for a conventional ERC20 storage layout supported by
            // forge-std. Calling the mock's mint function is preferable if it has one.
            deal(address(token), actors[i], type(uint128).max);
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

If `withdraw` is asset-denominated while `balanceOf` returns shares, the handler must calculate or bound against the vault's actual maximum redeemable assets instead; it must not introduce its own invalid calls. If the exploit depends on several users, retain multiple actors and select among them as above. If it depends on a particular action mix, explicitly target the handler selectors for those actions.

After this change, the run is credible only if the call table shows substantial successful `deposit` and `withdraw` counts and a low, understood revert count. With valid transitions chained across depth 50, Foundry can finally generate and shrink the ordinary deposit/withdraw sequence that violates the already-correct solvency assertion.
