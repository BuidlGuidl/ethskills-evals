# Why the invariant suite stayed green

`runs = 512` and `depth = 50` do not mean that 25,600 successful vault operations were exercised. They mean that Foundry generated 512 sequences containing up to 50 **call attempts** each.

`targetContract(address(vault))` makes the vault's public/external functions fuzz targets, but it does not arrange their preconditions. In particular, the fuzz callers were not given tokens and did not approve the vault. The token was not itself targeted, and even blindly targeting it would not reliably create the required caller-specific balance and allowance for the vault.

Consequently, generated `deposit` calls reverted at `transferFrom` (or an equivalent balance/allowance check). Since no deposit established shares or a withdrawable balance, generated `withdraw` calls reverted too. The vault therefore remained at, or very close to, its initial state after every attempted step. Foundry checks the invariant after calls, but a reverted call rolls its state changes back, so every check observed the same trivially solvent state.

By default, invariant fuzzing does not treat a target-call revert as a test failure (`fail_on_revert = false`). Thus a campaign can pass even when every useful action reverted. The important part of the Forge result was the **`reverts` count** next to `runs` and `calls`, for example a result resembling:

```text
[PASS] invariant_SolvencyHolds() (runs: 512, calls: 25600, reverts: 25600)
```

A very high revert count—and especially one equal to the call count—says that the nominal depth is not meaningful state-machine coverage. Per-selector/call metrics (`show_metrics = true`) and verbose traces are also useful for confirming which actions never succeed. Enabling `fail_on_revert = true` is a good guardrail because it turns this particular vacuity into an immediate red test, but it does not by itself make deposits reachable.

## Make valid state transitions reachable

Target a handler that supplies the environment and preserves the relationship between caller, token balance, allowance, shares, and withdrawals. For example:

```solidity
contract VaultHandler is Test {
    MyVault public immutable vault;
    MockERC20 public immutable token;

    address internal actor = address(0xA11CE);

    constructor(MyVault vault_, MockERC20 token_) {
        vault = vault_;
        token = token_;

        token.mint(actor, type(uint128).max);
        vm.prank(actor);
        token.approve(address(vault), type(uint256).max);
    }

    function deposit(uint256 amount) external {
        amount = bound(amount, 1, token.balanceOf(actor));
        vm.prank(actor);
        vault.deposit(amount);
    }

    function withdraw(uint256 amount) external {
        // Adapt this bound to the vault's actual per-account balance/share API.
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

        // Replace the raw vault target with the state-aware handler.
        targetContract(address(handler));
    }

    function invariant_SolvencyHolds() public view {
        assertGe(token.balanceOf(address(vault)), vault.totalDeposits());
    }
}
```

If the exploit needs multiple depositors, the handler should select from a small fixed actor set and perform mint/approval and `vm.prank(actor)` consistently for each one. If it depends on particular deposit/withdraw amounts, the handler should bound inputs only to valid protocol ranges rather than over-constraining them.

The essential change is therefore **replacing the raw `vault` target with a state-aware handler whose deposit and withdraw actions can succeed**. Afterward, keep an eye on the revert count (and preferably set `fail_on_revert = true` while developing the handler) to ensure the configured 25,600 attempts correspond to real state exploration.
