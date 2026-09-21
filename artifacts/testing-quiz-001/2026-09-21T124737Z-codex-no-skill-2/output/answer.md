Those 25,600 calls were not 25,600 meaningful user actions.

With only:

```solidity
targetContract(address(vault));
```

Foundry was directly fuzzing calls into `MyVault`. It was choosing random callers,
random calldata/selectors, and random arguments for the vault's public/external
functions. What it was not doing was constructing the surrounding ERC20 state that
ordinary vault usage requires.

For a normal vault, a useful `deposit` call needs something like:

1. a user has tokens;
2. that user approved the vault;
3. the user calls `vault.deposit(...)`;
4. later, a user with a recorded vault balance calls `vault.withdraw(...)`.

The invariant test did not create any of that. `MockERC20` was deployed, but no
actor was minted tokens and no actor approved the vault. So the fuzzer spent its
budget calling the vault in states where deposits reverted because
`transferFrom` could not succeed, and withdrawals reverted because the caller had
no deposit/shares/balance to withdraw.

That means the checked states were basically the initial state plus reverted
attempts. Reverted calls do not advance the vault into the interesting reachable
states. The assertion kept seeing:

```solidity
token.balanceOf(address(vault)) == 0
vault.totalDeposits() == 0
```

or similarly uninteresting states, so solvency held trivially. The production
drain lived in the valid state space reached after successful deposits and
withdrawals. This suite was not reaching that state space.

The run output would have told us this. The line to watch was the invariant
summary's revert count, for example something like:

```text
[PASS] invariant_SolvencyHolds() (runs: 512, calls: 25600, reverts: 25600)
```

or a revert count very close to the total call count. A green invariant with an
all-reverts or mostly-reverts call budget is usually saying "I proved the initial
state survives a lot of failed calls", not "I explored the protocol". With more
verbosity, the traces/call summary would also show that the targeted vault calls
were failing before they changed state.

The fix is to target a handler that turns fuzzer input into valid user actions.
The handler should create funded actors, approve the vault, and only call
`withdraw` for actors that actually have something to withdraw. Then the invariant
continues to assert the real property on the vault.

Example shape:

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

contract VaultHandler is Test {
    MyVault vault;
    MockERC20 token;

    address[] users;

    constructor(MyVault _vault, MockERC20 _token) {
        vault = _vault;
        token = _token;

        users.push(address(0xA11CE));
        users.push(address(0xB0B));
        users.push(address(0xCA11E));
    }

    function deposit(uint256 userSeed, uint256 amount) external {
        address user = users[bound(userSeed, 0, users.length - 1)];
        amount = bound(amount, 1, 1e30);

        token.mint(user, amount);

        vm.startPrank(user);
        token.approve(address(vault), amount);
        vault.deposit(amount);
        vm.stopPrank();
    }

    function withdraw(uint256 userSeed, uint256 amount) external {
        address user = users[bound(userSeed, 0, users.length - 1)];

        uint256 withdrawable = vault.balanceOf(user);
        if (withdrawable == 0) return;

        amount = bound(amount, 1, withdrawable);

        vm.prank(user);
        vault.withdraw(amount);
    }
}
```

The exact balance accessor may differ in the real vault, but the important change
is the target: fuzz the protocol through a handler that models successful,
ordinary user behavior. After that change, the 512 by 50 budget is spent on real
deposit/withdraw sequences, and the solvency invariant can fail on the same kind
of sequence the user found.
