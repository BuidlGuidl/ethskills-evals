# Why the invariant run was green

`runs` and `depth` are budgets, not coverage guarantees. Forge generated 512 sequences of up to 50 **attempted** calls to `MyVault`. It did not generate the state needed for those calls to succeed.

Because the vault itself was targeted, Forge called it with fuzzed selectors, calldata, and callers. Those callers had no token balance and, more importantly, had not approved the vault. Consequently, a deposit normally reverted in `transferFrom`. Since no deposit succeeded, the callers acquired no withdrawable position, so withdrawals reverted as well. Reverted calls roll back all state. The invariant was therefore repeatedly checked against essentially the deployment state, where the vault was solvent.

Thus “25,600 calls” did not mean 25,600 useful state transitions. It meant approximately 25,600 call attempts. Random calldata cannot manufacture a valid multi-call workflow whose preconditions include balances, approvals, and an existing position.

The warning was the invariant report's **revert count**. Forge reports runs, calls, and reverts (and, with more verbose invariant output, the selector/call distribution). A revert count close to the call count, especially with deposit and withdraw contributing no successful state transitions, shows that the campaign is not exploring the protocol. `fail_on_revert = true` is a useful guardrail because it would have made this suite loudly fail instead of looking healthy, but it does not by itself make the fuzzer reach valid vault states.

# Make valid actions fuzzable

Target a handler whose actions establish and preserve the protocol preconditions. Fund the handler (or a set of actor proxies), approve the vault, and bound withdrawals to positions that actually exist. For example, adapting the balance/position getter names to `MyVault`:

```solidity
contract VaultHandler is Test {
    MyVault public immutable vault;
    MockERC20 public immutable token;

    constructor(MyVault _vault, MockERC20 _token) {
        vault = _vault;
        token = _token;

        // Use the mock's mint helper, or `deal(address(token), ...)`.
        token.mint(address(this), type(uint128).max);
        token.approve(address(vault), type(uint256).max);
    }

    function deposit(uint256 amount) external {
        amount = bound(amount, 1, token.balanceOf(address(this)));
        vault.deposit(amount);
    }

    function withdraw(uint256 amount) external {
        uint256 available = vault.balanceOf(address(this)); // or deposits(this)/shares(this)
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

        targetContract(address(handler)); // not address(vault)
    }

    function invariant_SolvencyHolds() public view {
        assertGe(token.balanceOf(address(vault)), vault.totalDeposits());
    }
}
```

If the exploit requires interactions among distinct users, the production handler should select from a small, persistent set of actor proxy contracts, fund each actor, approve once from each actor, and perform deposit/withdraw through the selected actor. The essential change is the same: fuzz **valid state transitions**, not raw calls that almost all revert. Keep `fail_on_revert = true` as a separate regression signal for accidentally unreachable handler actions.
