# Why the green invariant run did not protect the vault

`runs = 512` and `depth = 50` means Foundry made up to 25,600 **call attempts**. It does not mean that it executed 25,600 successful deposits and withdrawals, or even 512 useful state-transition sequences.

`targetContract(address(vault))` made Foundry call the vault directly with fuzzed selectors, arguments, and callers. Those callers had not been prepared as vault users: they had no tokens, had not approved the vault, and usually had no deposit/share balance to withdraw. Consequently, ordinary calls such as `deposit` failed at `transferFrom`, while `withdraw` failed because the caller had no claim. Any calls that happened to succeed, such as harmless zero-value cases or view calls, did not move the vault through the economically meaningful states needed by the exploit.

By default, a reverting action in an invariant sequence is rejected as an action; it does not make the invariant test fail. Foundry continued to the next attempted action and checked `invariant_SolvencyHolds` against a vault that was still at, or very close to, its initial state. At that state both custody and accounting were zero, so the correct assertion was vacuously green. More runs and depth merely repeated this unreachable-state search.

The warning was in Foundry's invariant call metrics: the total calls/reverts figures, and (when metrics are displayed) the per-contract/per-selector calls and reverts table. A revert count near the call count—especially `deposit` and `withdraw` showing almost all reverts—means the fuzzer is not exploring the state machine. Those statistics should be reviewed as part of every invariant run, rather than treating only `[PASS]` and the call count as evidence. While constructing the suite, this configuration also turns that silent signal into an immediate failure:

```toml
[invariant]
runs = 512
depth = 50
fail_on_revert = true
show_metrics = true
```

`fail_on_revert` is useful while making the handler's intended actions valid. If a suite deliberately includes negative actions later, those should be isolated/handled rather than accepting an unexplained high revert rate.

## The required change

Target a **handler**, not the vault. The handler must create reachable users: fund them, approve the vault for them, select among them, and bound inputs to amounts that can actually succeed. Its actions then call the real vault. For example (the exact share/deposit getter should be adapted to `MyVault`):

```solidity
contract VaultHandler is Test {
    MyVault public immutable vault;
    MockERC20 public immutable token;
    address[] internal actors;

    constructor(MyVault vault_, MockERC20 token_) {
        vault = vault_;
        token = token_;

        actors.push(address(0xA11CE));
        actors.push(address(0xB0B));

        for (uint256 i; i < actors.length; ++i) {
            token.mint(actors[i], 1_000_000 ether);
            vm.prank(actors[i]);
            token.approve(address(vault), type(uint256).max);
        }
    }

    function deposit(uint256 actorSeed, uint256 amount) external {
        address actor = actors[actorSeed % actors.length];
        amount = bound(amount, 1, token.balanceOf(actor));

        vm.prank(actor);
        vault.deposit(amount);
    }

    function withdraw(uint256 actorSeed, uint256 amount) external {
        address actor = actors[actorSeed % actors.length];
        uint256 available = vault.deposits(actor); // or shares/balanceOf, as applicable
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

        targetContract(address(handler));
    }

    function invariant_SolvencyHolds() public view {
        assertGe(token.balanceOf(address(vault)), vault.totalDeposits());
    }
}
```

If the real drain depends on a particular interpretation of withdrawal units, fees, limits, or multiple users, the handler must model those semantics correctly and expose the corresponding actions. The essential fix is that the generated sequence now consists of successful, state-changing deposits and withdrawals by funded, approved actors. With those states reachable, Foundry can discover and shrink the violating sequence, and the existing solvency assertion can finally do its job.
