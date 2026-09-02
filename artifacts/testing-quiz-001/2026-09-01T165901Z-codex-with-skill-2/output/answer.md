# Why the invariant suite stayed green

The 25,600 figure is **25,600 attempted calls**, not 25,600 successful deposit/withdraw state transitions.

`targetContract(address(vault))` tells Foundry to call the vault's public/external functions directly with generated calldata. It does not create a funded depositor, mint tokens to the generated caller, approve the vault to spend those tokens, or constrain withdrawals to positions that exist.

Consequently, calls such as `deposit(amount)` almost always reverted at `transferFrom` because the caller had no tokens and/or allowance. Withdrawal calls likewise reverted because the caller owned no deposit balance or shares. Any callable views, zero-value edge cases, or other successful calls did not construct the multi-step state needed for the exploit. Since reverted calls roll back all state, the vault remained at or near its initial empty state, where

```text
token.balanceOf(vault) == 0
vault.totalDeposits()    == 0
```

and the solvency assertion was trivially true. Increasing `runs` and `depth` only repeated exploration of this unusable action space; it did not make the prerequisite balances and approvals appear.

The warning was in Forge's invariant summary, especially the **calls versus reverts** counts (and, in verbose output, the per-function call/revert distribution). A very high or 100% revert rate for `deposit` and `withdraw`, zero successful calls to the important mutators, or an invariant that never moved its relevant state variables should have made the green result untrustworthy. `calls: 25600` by itself is not coverage evidence. Enabling `fail_on_revert = true` during development is also useful because this suite would then fail noisily instead of treating all those rejected actions as harmless fuzz attempts.

# Change required

Target a handler that makes valid protocol actions reachable. The handler must provision actors with tokens, perform approvals, preserve actor identity across deposit and withdrawal, and bound withdrawals to an actor's actual position. For example (adjust the vault's exact deposit/withdraw signatures as needed):

```solidity
contract VaultHandler is Test {
    MyVault public immutable vault;
    MockERC20 public immutable token;

    address[] internal actors;

    constructor(MyVault _vault, MockERC20 _token) {
        vault = _vault;
        token = _token;
        actors.push(makeAddr("alice"));
        actors.push(makeAddr("bob"));
        actors.push(makeAddr("carol"));
    }

    function deposit(uint256 actorSeed, uint256 amount) external {
        address actor = actors[actorSeed % actors.length];
        amount = bound(amount, 1, 1_000_000 ether);

        deal(address(token), actor, amount);
        vm.startPrank(actor);
        token.approve(address(vault), type(uint256).max);
        vault.deposit(amount);
        vm.stopPrank();
    }

    function withdraw(uint256 actorSeed, uint256 amount) external {
        address actor = actors[actorSeed % actors.length];
        uint256 available = vault.balanceOf(actor); // or the vault's depositor balance
        if (available == 0) return;

        amount = bound(amount, 1, available);
        vm.prank(actor);
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

        targetContract(address(handler)); // target valid actions, not raw vault calls
    }

    function invariant_SolvencyHolds() public view {
        assertGe(token.balanceOf(address(vault)), vault.totalDeposits());
    }
}
```

Optionally restrict targeting further with `targetSelector` so only the handler's action functions are selected, and add ghost counters such as `successfulDeposits` and `successfulWithdrawals`. Assert in a separate `invariant_callSummary`/`afterInvariant` check that both counters are nonzero (or inspect them in the run output). That prevents a vacuously green suite from returning unnoticed.

The essential fix is not more runs. It is replacing `targetContract(address(vault))` with a stateful handler whose generated calls can successfully reproduce ordinary user workflows. With deposit and withdrawal reachable in the same sequence, Foundry can explore—and shrink—the draining sequence that violates the assertion.
