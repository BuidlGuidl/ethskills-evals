# Why the invariant suite stayed green

`runs = 512` and `depth = 50` describe the size of the attempted search, not the number of successful vault operations. Foundry started 512 fresh sequences and, in each sequence, made up to 50 calls to functions selected from the ABI of the target. Thus 25,600 is an upper bound on generated call attempts.

The target was the vault itself:

```solidity
targetContract(address(vault));
```

That gives Foundry no protocol-aware setup. Calls are made with fuzzed arguments and fuzzed `msg.sender` values. Those senders normally have no mock tokens, have not approved the vault, and have no deposit position to withdraw. Consequently:

- `deposit` calls revert during balance/allowance/transfer checks;
- `withdraw` calls revert because the caller has no shares or recorded deposit;
- other input-dependent calls may revert for similarly invalid preconditions.

With the normal invariant configuration, a reverting target call is discarded and testing continues; it does not make the invariant test fail. The invariant was therefore repeatedly evaluated at the initial state, or at a very small set of trivial reachable states. In that state the vault balance and `totalDeposits()` are both zero, so the correct assertion is vacuously green. More depth merely produced more invalid attempts. It did not create the prerequisite state needed for the draining sequence.

The warning was in Forge's invariant call statistics. The per-contract/per-selector table reports **calls** and **reverts**. `deposit` and `withdraw` would have shown a revert count equal or very close to their call count, and the overall revert rate would have been near 100%. Those numbers, rather than the nominal `runs * depth`, tell us whether the fuzzer was actually exploring state. While constructing the suite, setting this also makes the problem impossible to overlook:

```toml
[invariant]
runs = 512
depth = 50
fail_on_revert = true
```

`fail_on_revert` is a diagnostic guard, not the actual fix. The fix is to target a handler that establishes valid preconditions and turns arbitrary fuzz input into successful, meaningful operations. At minimum, the same funded and approved actor must be able to deposit and later withdraw. For example, adapting the position getter and mint function to the actual interfaces:

```solidity
contract VaultHandler is Test {
    MyVault public immutable vault;
    MockERC20 public immutable token;

    constructor(MyVault vault_, MockERC20 token_) {
        vault = vault_;
        token = token_;
        token.approve(address(vault_), type(uint256).max);
    }

    function deposit(uint256 amount) external {
        // Supply a valid actor balance, then constrain the operation to a
        // useful range instead of rejecting most generated values.
        amount = bound(amount, 1, 1e30);
        token.mint(address(this), amount);
        vault.deposit(amount);
    }

    function withdraw(uint256 amount) external {
        uint256 available = vault.deposits(address(this)); // or share balance
        if (available == 0) return;
        amount = bound(amount, 1, available);
        vault.withdraw(amount);
    }
}
```

The test setup then targets the handler, not the vault:

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
```

If the real drain requires interactions among users, the production handler should maintain a small actor set. Each handler action should select an actor, fund and approve it, execute the vault call under `vm.prank(actor)`, and bound withdrawals to that actor's current position. It can also use `targetSelector` to expose only meaningful actions. The success criterion is visible in the next run: deposit and withdraw receive substantial call counts with a low, understood revert rate, and Forge can compose those successful calls into the offending sequence.
