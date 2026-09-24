The 25,600 calls were not 25,600 meaningful vault histories. They were 512
random sequences of up to 50 raw calls to `MyVault`'s ABI, because the only
target was:

```solidity
targetContract(address(vault));
```

Foundry was therefore doing things like calling `deposit(randomAmount)` and
`withdraw(randomAmount)` directly on the vault from fuzzed senders with fuzzed
arguments. It was not also doing the real setup that makes those calls possible:
minting tokens to users, approving the vault, choosing a depositor that actually
has a position, or choosing a withdraw amount that can reach the interesting
state.

So the campaign was busy, but sterile:

- `deposit(...)` calls mostly or entirely reverted in `transferFrom`, because
  the caller had no token balance and no allowance.
- `withdraw(...)` calls mostly or entirely reverted, because the caller had no
  recorded deposit/shares.
- Any successful calls were harmless views, zero-amount edge cases, or other
  calls that did not create the state needed for insolvency.

The vault stayed at the deployment state, or very close to it:

```solidity
token.balanceOf(address(vault)) == 0
vault.totalDeposits() == 0
```

That makes the invariant trivially true forever. The assertion was correct, but
the harness never generated the valid user action grammar that could falsify it.
The real user sequence had successful deposits and withdrawals; the invariant
runner was mostly exercising failed attempts to do those things.

The run output would have told us this. The field to watch was the invariant
summary's revert count, for example a line shaped like:

```text
runs: 512, calls: 25600, reverts: 25000+
```

or, in the worst case, almost every mutating call reverting. With higher
verbosity, the traces would have shown the same precondition failures over and
over: ERC20 insufficient allowance/balance on deposit, and insufficient vault
balance/shares on withdraw. A green invariant with a huge revert ratio is not
evidence that the property survived realistic behavior; it is often evidence
that the harness failed to produce realistic behavior.

The fix is to target a handler that performs valid actions, instead of targeting
the vault directly. The handler should encode the ordinary user workflow:
provision a user with tokens, approve the vault, deposit, then later withdraw
from users who actually have deposits.

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

        uint256 deposited = vault.balanceOf(user); // or vault.deposits(user)
        if (deposited == 0) return;

        amount = bound(amount, 1, deposited);

        vm.prank(user);
        vault.withdraw(amount);
    }
}
```

Then the invariant test should target the handler:

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

If the vault bug is reachable through normal successful deposits and withdrawals,
this is the change that gives Foundry a path to reach it. The important shift is
that the fuzzer now mutates protocol state through valid user-level operations,
instead of spending its whole budget bouncing off ERC20 and accounting
preconditions.
