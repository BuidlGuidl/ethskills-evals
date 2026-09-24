Those 25,600 calls were not 25,600 realistic user actions.

With `targetContract(address(vault))`, Foundry was fuzzing the vault ABI directly. It generated random calls to the vault's external functions, with random arguments and fuzzed senders. What it did not do was build the preconditions that make a deposit/withdraw workflow meaningful:

- it did not mint or deal tokens to the caller;
- it did not call `token.approve(address(vault), amount)` from that same caller;
- it did not choose amounts that were valid relative to that caller's token balance, allowance, deposit balance, or shares;
- it did not coordinate a sequence like "Alice gets tokens, Alice approves, Alice deposits, Alice withdraws".

So the run was mostly, or entirely, exercising reverting calls. A random `deposit(amount)` from an unfunded/unapproved sender reverts at `transferFrom`. A random `withdraw(amount)` before any successful deposit reverts because the sender has no withdrawable balance. Since reverted calls do not advance the vault into an interesting state, the invariant kept being checked against the same basically empty state:

```solidity
token.balanceOf(address(vault)) == 0
vault.totalDeposits() == 0
```

That trivially satisfies:

```solidity
assertGe(token.balanceOf(address(vault)), vault.totalDeposits());
```

The bug could be completely real and still invisible, because the fuzzer never reached the part of the state space where the bug exists.

The output clue was the invariant run statistics, especially the revert count. A passing line like this is not reassuring:

```text
[PASS] invariant_SolvencyHolds() (runs: 512, calls: 25600, reverts: 25600)
```

or even a very high revert count, should have been treated as a coverage failure. It means the fuzzer spent its budget throwing invalid calls at the contract, not exploring successful state transitions. With more verbosity, the call summary/distribution would also have shown calls hitting the vault methods but not successfully driving the intended deposit/withdraw lifecycle.

The fix is to target a handler, not the raw vault. The handler should expose ordinary user actions and make their preconditions true before calling the vault. For example:

```solidity
contract VaultHandler is Test {
    MyVault public vault;
    MockERC20 public token;

    address[] internal users;

    constructor(MyVault _vault, MockERC20 _token) {
        vault = _vault;
        token = _token;

        users.push(makeAddr("alice"));
        users.push(makeAddr("bob"));
        users.push(makeAddr("carol"));
    }

    function deposit(uint256 userSeed, uint256 amount) public {
        address user = users[bound(userSeed, 0, users.length - 1)];
        amount = bound(amount, 1, 1_000_000 ether);

        token.mint(user, amount);

        vm.startPrank(user);
        token.approve(address(vault), amount);
        vault.deposit(amount);
        vm.stopPrank();
    }

    function withdraw(uint256 userSeed, uint256 amount) public {
        address user = users[bound(userSeed, 0, users.length - 1)];

        uint256 maxAmount = vault.balanceOf(user);
        if (maxAmount == 0) return;

        amount = bound(amount, 1, maxAmount);

        vm.prank(user);
        vault.withdraw(amount);
    }
}
```

Then the invariant test targets the handler:

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

The exact handler methods should match the real vault interface, especially if the vault uses ERC4626 `deposit`, `mint`, `withdraw`, and `redeem`. The key change is the same either way: fuzz valid user-level actions that successfully mutate protocol state. Once the fuzzer can produce successful deposits and withdrawals by realistic actors, it has a path to the same kind of sequence the user used to drain the vault.
