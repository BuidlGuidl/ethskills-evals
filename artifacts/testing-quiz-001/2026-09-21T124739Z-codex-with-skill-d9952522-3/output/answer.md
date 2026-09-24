Those 25,600 calls were not 25,600 successful user actions.

With `targetContract(address(vault))`, Foundry was calling the vault directly with
random function arguments and fuzzed senders. It was not doing the setup a real
user transaction needs: minting tokens to a user, approving the vault, choosing an
amount the user can actually deposit, then later withdrawing from an address that
has a vault balance.

So most of the campaign was probably:

- `deposit(randomAmount)` from an address with no token balance or no allowance,
  reverting in `transferFrom`.
- `withdraw(randomAmount)` from an address with no shares/deposit balance,
  reverting in the vault's balance checks.
- Other random vault entrypoints, if any, called with unconstrained arguments and
  reverting before they changed useful state.

By default, invariant reverts are not themselves failures. They are counted and
the run continues. A reverted call leaves state unchanged, so the invariant kept
being checked against the initial or near-initial state:

```solidity
token.balanceOf(address(vault)) == 0
vault.totalDeposits() == 0
```

That state satisfies:

```solidity
assertGe(token.balanceOf(address(vault)), vault.totalDeposits());
```

The suite was green because the fuzzer almost never reached the part of the state
space where deposits and withdrawals had actually happened in a coherent sequence.
It was testing "random direct calls mostly revert" rather than "ordinary users can
deposit and withdraw in arbitrary order."

The clue would have been in the invariant run output: the calls/reverts statistics.
A healthy run should show that many calls are successfully mutating state. A line
like this is a warning sign, even though it says `PASS`:

```text
[PASS] invariant_SolvencyHolds() (runs: 512, calls: 25600, reverts: 25590)
```

or worse:

```text
[PASS] invariant_SolvencyHolds() (runs: 512, calls: 25600, reverts: 25600)
```

That says the suite did not explore meaningful vault behavior. While building the
test, `fail_on_revert = true` is also useful because it turns that hidden signal
into an immediate failure.

The fix is to target a handler, not the vault. The handler should own the user
workflow: create funded actors, approve the vault, bound amounts to values that
can succeed, and call deposit/withdraw as those actors. Then the invariant still
asserts the real property on the real vault.

Example shape:

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
        uint256 deposited = vault.balanceOf(user); // or the vault's per-user accounting getter
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

The exact getters and accounting names may differ, but the essential change is
that the fuzzer targets valid actions on a handler. Now its 512 sequences are made
of successful deposits and withdrawals by funded, approved users, so the invariant
runner can actually reach the drain sequence and shrink it into a useful
counterexample.
