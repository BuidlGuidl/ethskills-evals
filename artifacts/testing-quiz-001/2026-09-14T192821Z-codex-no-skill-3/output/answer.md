# Why the invariant suite stayed green

`runs = 512` and `depth = 50` mean that Foundry *attempted* 25,600 calls to the target. They do not mean that 25,600 useful vault transitions occurred.

`targetContract(address(vault))` tells the invariant engine to select the vault's external/public functions and generate arbitrary calldata and senders for them. It does not perform the prerequisites of those calls. In particular, the generated callers were not given tokens and had not approved the vault. Consequently, ordinary positive deposits reverted in `transferFrom` (or in the vault's own checks), while withdrawals reverted because the caller had no deposit. Getters may have succeeded, and zero-value operations may have succeeded depending on the implementation, but neither moved the suite away from the empty/trivial initial state.

Invariant fuzzing normally continues after a target-call revert. The invariant was then evaluated against essentially the same state again:

```text
token.balanceOf(vault) == 0
vault.totalDeposits()   == 0
```

Thus `0 >= 0` passed repeatedly. Random ABI calls technically included `deposit` and `withdraw`, but the harness never made the sequence economically executable. A correct invariant cannot detect a bad state that the harness cannot reach.

The warning was the run's revert information, not its green status. The summary reports runs, calls, and reverts; a line with roughly `calls: 25600, reverts: 25600` (or otherwise an unexpectedly high revert count) says that the apparent test volume is mostly illusory. Foundry's per-selector call metrics should also be enabled and inspected:

```toml
[invariant]
runs = 512
depth = 50
show_metrics = true
```

Those metrics reveal how many calls to each action succeeded or reverted. During harness development, `fail_on_revert = true` is also a useful diagnostic: it would have made the suite fail immediately instead of silently treating the reverts as harmless exploration. It is not, by itself, the final fix; callers still need valid preconditions.

## Make the relevant states reachable

Target a handler that creates a funded, approved actor and exposes only executable vault actions. For example (adapting `mint` and function names to the actual contracts):

```solidity
contract VaultHandler is Test {
    MyVault public immutable vault;
    MockERC20 public immutable token;

    constructor(MyVault vault_, MockERC20 token_) {
        vault = vault_;
        token = token_;

        token.mint(address(this), type(uint128).max);
        token.approve(address(vault), type(uint256).max);
    }

    function deposit(uint256 amount) external {
        amount = bound(amount, 1, token.balanceOf(address(this)));
        vault.deposit(amount);
    }

    function withdraw(uint256 amount) external {
        uint256 deposited = vault.balanceOf(address(this)); // use the vault's user-deposit getter
        if (deposited == 0) return;
        amount = bound(amount, 1, deposited);
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

Because calls from the handler reach the vault with the handler as `msg.sender`, deposits and later withdrawals operate on the same funded account across a generated sequence. Bounding the inputs makes successful transitions common without hiding boundary cases entirely; separate actions can be added for exact values such as zero or maximum amounts if those matter.

If the production sequence requires interactions among several users, the handler should instead select an actor from a small actor set, mint/fund and approve that actor, and wrap each vault call in `vm.prank(actor)`. The essential change is the same: target stateful actions whose preconditions the harness establishes, then confirm in the metrics that `deposit` and `withdraw` are actually succeeding. After this change, the fuzzer can reach the same class of deposit/withdraw histories as the user and the existing solvency assertion can expose the drain.
