Those 25,600 calls were not 25,600 realistic user interactions. They were direct invariant-fuzzer calls into `MyVault` because the suite did:

```solidity
targetContract(address(vault));
```

That tells Foundry to pick callable functions on the vault and invoke them with fuzzed arguments and fuzzed callers. It does not automatically create funded users, mint them tokens, approve the vault, or keep withdraw amounts inside the caller's deposited balance.

So the run was mostly trying things like:

```solidity
vault.deposit(randomAmount)
vault.withdraw(randomAmount)
```

from random `msg.sender` addresses that had no token balance, had not approved the vault, and often had no vault balance to withdraw. A normal `deposit` would revert at `transferFrom` because the caller had no funds or allowance. A normal `withdraw` would revert because the caller had no deposit. Since Foundry invariant tests do not fail on target-call reverts by default, those reverting calls were discarded as failed attempts, and the invariant was checked against a vault that was still basically in its setup state.

In other words, the assertion was good, but the state-space search never reached the part of the state space where the assertion could become false. It was repeatedly checking something like:

```solidity
token.balanceOf(address(vault)) >= vault.totalDeposits()
// 0 >= 0
```

or some similarly untouched state. The user exploit was an ordinary sequence of successful deposits and withdrawals, but the invariant suite was not producing successful deposits and withdrawals.

The run output would have shown this. Foundry prints invariant statistics like:

```text
[PASS] invariant_SolvencyHolds() (runs: 512, calls: 25600, reverts: 25600)
```

or at least a revert count very close to the total call count. That `reverts` number was the warning. A green invariant run with a near-100% revert rate has mostly proven that invalid random calls revert, not that the protocol survives valid state transitions.

The fix is to target a handler, not the vault directly. The handler should own the setup needed to make calls meaningful: funded actors, approvals, bounded deposit amounts, bounded withdraw amounts, and `prank`ed callers. Then Foundry fuzzes sequences through that handler.

For example:

```solidity
contract VaultHandler is Test {
    MyVault public vault;
    MockERC20 public token;

    address[] public users;

    constructor(MyVault vault_, MockERC20 token_) {
        vault = vault_;
        token = token_;

        users.push(address(0xA11CE));
        users.push(address(0xB0B));
        users.push(address(0xCA1));

        for (uint256 i = 0; i < users.length; i++) {
            token.mint(users[i], 1_000_000 ether);

            vm.prank(users[i]);
            token.approve(address(vault), type(uint256).max);
        }
    }

    function deposit(uint256 userSeed, uint256 amount) external {
        address user = users[bound(userSeed, 0, users.length - 1)];
        amount = bound(amount, 1, token.balanceOf(user));

        vm.prank(user);
        vault.deposit(amount);
    }

    function withdraw(uint256 userSeed, uint256 amount) external {
        address user = users[bound(userSeed, 0, users.length - 1)];
        uint256 deposited = vault.balanceOf(user);

        if (deposited == 0) return;

        amount = bound(amount, 1, deposited);

        vm.prank(user);
        vault.withdraw(amount);
    }
}
```

Then the invariant test becomes:

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

While building this, turn on:

```toml
[invariant]
fail_on_revert = true
```

or at least treat the `reverts` count as a required health check. The goal is not just many calls; it is many successful, protocol-valid calls. Once the fuzzer is driving the vault through funded, approved users and valid deposit/withdraw ranges, the same invariant can actually find the user's sequence.
