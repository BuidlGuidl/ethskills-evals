Those 25,600 calls were mostly not 25,600 meaningful vault operations. Because
the invariant targets the vault directly:

```solidity
targetContract(address(vault));
```

Foundry generated arbitrary calls to `MyVault` with arbitrary senders and
arbitrary arguments. Those senders were not set up as users. They had no token
balances, had not approved the vault, and usually had no recorded deposit or
shares to withdraw.

So the run was doing things like:

- `deposit(amount)` from an address that owns no mock tokens or gave no
  allowance
- `withdraw(amount)` from an address with no deposit balance
- calls with amounts outside the useful domain

Those calls reverted before they could move the vault into interesting states.
Invariant reverts are not automatically failures unless configured that way, so
the invariant kept being checked against essentially the initial state:

```solidity
token.balanceOf(address(vault)) == 0
vault.totalDeposits() == 0
```

That state satisfies:

```solidity
token.balanceOf(address(vault)) >= vault.totalDeposits()
```

The user's exploit sequence was in scope conceptually, but it was not reachable
by this test harness. The fuzzer was knocking on the vault's public functions
without ever becoming a valid depositor.

The warning was in the invariant run output: the calls/reverts statistics. A
run with about 25,600 calls and a revert count near 25,600, or otherwise an
overwhelming revert rate, means the test proved almost nothing. The useful
question was not "did the invariant stay green?" but "how many calls actually
changed state?" Setting `fail_on_revert = true` while building the suite would
also have made this obvious immediately.

The fix is to target a handler, not the vault directly. The handler owns the
setup required to make ordinary user actions reachable: funded actors,
approvals, bounded amounts, and calls made as those actors.

For example:

```solidity
contract VaultHandler is Test {
    MyVault public vault;
    MockERC20 public token;

    address[] internal users;

    constructor(MyVault _vault, MockERC20 _token) {
        vault = _vault;
        token = _token;

        users.push(address(0xA11CE));
        users.push(address(0xB0B));
        users.push(address(0xCA11));

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

The exact handler has to match the real vault API, but the important change is
the shape: the fuzzer should generate sequences of valid user-level actions,
not arbitrary direct calls from unprepared addresses. With that harness, the
same invariant can finally be checked after real deposits and withdrawals, so
the draining sequence becomes reachable.
