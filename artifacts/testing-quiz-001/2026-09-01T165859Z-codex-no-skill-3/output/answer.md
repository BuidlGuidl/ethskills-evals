# Why the invariant run was green

`runs = 512` and `depth = 50` mean that Foundry generated 512 call sequences of up to 50 calls each. They do **not** mean that 25,600 successful vault state transitions occurred.

By targeting `address(vault)` directly, the invariant engine called the vault's public/external functions with fuzzed arguments and fuzzed senders. Those senders had never been given tokens and had never approved the vault. Consequently, an ordinary `deposit` that uses `transferFrom` reverted for lack of balance or allowance. With no successful deposit and no resulting balance or shares, ordinary withdrawals reverted as well. Other invalid random arguments may have produced still more reverts.

Foundry checks the invariant after calls, including reverted calls, but a revert rolls back the attempted transition. Thus the assertion was repeatedly checked against essentially the deployment state:

```text
vault token balance = 0
vault.totalDeposits() = 0
```

That state is solvent, so the assertion passed. The fuzzer covered the function selectors syntactically, but it did not reach the stateful behavior semantically. The production sequence being expressible using the same entry points is not enough; the harness must make valid prefixes of that sequence reachable.

The warning was the invariant result's **calls/reverts statistics**. With verbose invariant output, Forge reports a line of the form:

```text
(runs: 512, calls: 25600, reverts: 25600)
```

or at least a revert count very close to the call count. The relevant coverage measure was not `calls`, but successful calls and meaningful state changes. Enabling `fail_on_revert = true` during harness development is also a useful alarm: this suite would have failed immediately instead of silently treating all those rejected inputs as useful exploration. It is a diagnostic guard, though, not the complete repair.

# Make valid operation sequences reachable

Target a handler that creates valid preconditions and bounds actions to the current state. For example, for a single-actor exploit sequence:

```solidity
contract VaultHandler is Test {
    MyVault public immutable vault;
    MockERC20 public immutable token;

    constructor(MyVault _vault, MockERC20 _token) {
        vault = _vault;
        token = _token;

        // The handler is the actor seen by the vault.
        token.approve(address(vault), type(uint256).max);
    }

    function deposit(uint256 amount) external {
        // Choose a protocol-appropriate maximum so arithmetic remains useful.
        amount = bound(amount, 1, 1e30);
        token.mint(address(this), amount);
        vault.deposit(amount);
    }

    function withdraw(uint256 amount) external {
        uint256 available = vault.balanceOf(address(this)); // shares or claim units
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
        targetContract(address(handler));
    }

    function invariant_SolvencyHolds() public view {
        assertGe(token.balanceOf(address(vault)), vault.totalDeposits());
    }
}
```

The exact getter used to bound `withdraw` must match the vault API: it may be `balanceOf`, `sharesOf`, `maxWithdraw`, or an internal accounting getter, and the withdrawal argument may be assets rather than shares. The important change is to target a **stateful handler** that funds an actor, grants allowance, and converts arbitrary fuzz input into valid deposits and withdrawals. If the real exploit requires multiple users, the handler should maintain a small actor set and use `vm.startPrank(actor)` around approval and vault calls, selecting an actor from fuzz input and bounding each operation against that actor's live balance.

After this change, the call/revert ratio should show substantial successful execution, vault balances and accounting should actually move, and the fuzzer can compose the ordinary deposit/withdraw sequence that violates the assertion. Keep `runs` and `depth` for search budget, but treat them as useful only after the harness demonstrates reachable, successful transitions.
