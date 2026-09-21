Those 25,600 calls were not 25,600 useful vault transitions. They were direct
fuzzer calls into `MyVault` from Foundry's invariant harness, using generated
arguments and the default invariant actors. The test only did this:

```solidity
targetContract(address(vault));
```

It never gave any actor tokens, never approved the vault for any actor, and never
wrapped the vault behind a handler that performs those preconditions. So the fuzzer
could select ordinary `deposit` and `withdraw` entrypoints, but the calls could not
build the same state a real user built.

In practice, deposits either reverted in `transferFrom` because the caller had no
mock token balance or no allowance, or they deposited `0` / otherwise failed to
change meaningful accounting. Withdrawals then had nothing useful to withdraw,
because no successful deposits had established user balances. After each sequence,
the invariant was checked against a vault that was still essentially in its initial
state:

```solidity
token.balanceOf(address(vault)) == 0
vault.totalDeposits() == 0
```

That trivially satisfies:

```solidity
assertGe(token.balanceOf(address(vault)), vault.totalDeposits());
```

So the invariant was correct, and Foundry did make many calls, but the test's action
space did not include the reachable user states needed to expose the bug. The
production drain required successful deposits followed by withdrawals. The invariant
suite was mostly testing that failed calls and empty vault state do not break
solvency.

The clue was in the invariant run output: the revert count / call statistics. A run
that says something like `runs: 512, calls: 25600, reverts: 25600`, or even a very
high revert percentage, is not a green security signal. It means the fuzzer is
spending its budget bouncing off preconditions. With higher verbosity, the call
traces would also show repeated reverted `deposit` / `withdraw` attempts instead of
successful state-changing flows.

The fix is to fuzz through a handler that creates valid user actions: mint or deal
tokens to actors, approve the vault, bound amounts to useful ranges, and then call
`deposit` / `withdraw` as those actors. Target the handler, not the vault directly.

```solidity
contract VaultHandler is Test {
    MyVault public vault;
    MockERC20 public token;

    address[] public users;

    constructor(MyVault _vault, MockERC20 _token) {
        vault = _vault;
        token = _token;

        users.push(address(0xA11CE));
        users.push(address(0xB0B));
        users.push(address(0xCAFE));
    }

    function deposit(uint256 userSeed, uint256 amount) external {
        address user = users[bound(userSeed, 0, users.length - 1)];
        amount = bound(amount, 1, 1_000_000 ether);

        token.mint(user, amount);

        vm.startPrank(user);
        token.approve(address(vault), amount);
        vault.deposit(amount);
        vm.stopPrank();
    }

    function withdraw(uint256 userSeed, uint256 amount) external {
        address user = users[bound(userSeed, 0, users.length - 1)];
        uint256 maxWithdraw = vault.balanceOf(user);
        amount = bound(amount, 0, maxWithdraw);

        vm.prank(user);
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

The exact helper names may differ depending on the vault API, but the important
change is structural: the invariant fuzzer must call an operation-level handler that
models real users and makes successful deposits and withdrawals common. After that,
`runs = 512` and `depth = 50` are actually exploring vault behavior instead of an
empty-state revert loop.
