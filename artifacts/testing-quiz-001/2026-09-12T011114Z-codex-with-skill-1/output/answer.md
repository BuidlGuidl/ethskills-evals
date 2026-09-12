# Why the invariant stayed green

`runs = 512` and `depth = 50` means that Foundry generated 512 sequences of up to 50 **target calls** each. It does not mean that 25,600 calls successfully exercised the vault. Here, `targetContract(address(vault))` made Foundry call the vault ABI directly with fuzzed selectors, arguments, and senders.

Those random senders were not prepared to be vault users. In particular, they generally had no tokens, had not approved the vault, and had no deposit balance or shares to withdraw. Consequently, the ordinary state-changing paths reverted: deposits failed on balance or allowance, and withdrawals failed because the caller had nothing withdrawable. Foundry's invariant engine normally treats such reverts as rejected calls and continues; a revert is not itself a test failure.

The invariant was therefore repeatedly checked against the initial state, or against only the small subset of states reachable without valid user setup. It was a good assertion over an ineffective state-space search. Increasing `runs` or `depth` merely produced more invalid attempts; it did not make the required deposit/withdraw sequence reachable.

The warning was in Forge's invariant-run summary: the per-selector and aggregate **calls/reverts** statistics. The deposit and withdraw selectors would have shown a revert rate at or near 100%, and the number of successful state-changing calls would have been negligible. That output should be treated as part of the test result, not incidental diagnostics. While developing the harness, setting this also makes the problem loud:

```toml
[invariant]
fail_on_revert = true
```

That setting is useful for exposing a broken harness, but it does not by itself fix reachability.

## Required change

Target a handler that creates valid calls instead of targeting the vault directly. The handler must own the environmental setup the protocol expects: funded actors, approvals, amounts bounded to currently valid ranges, and, if actor interaction matters, multiple persistent actors. Its actions should call the same public `deposit` and `withdraw` entry points users call.

For example, adapting names and share/accounting getters to the actual vault API:

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
            token.mint(actors[i], type(uint128).max);
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
        uint256 available = vault.depositsOf(actor); // use the real claim/share getter
        if (available == 0) return;
        amount = bound(amount, 1, available);

        vm.prank(actor);
        vault.withdraw(amount);
    }
}
```

Then wire the invariant suite to the handler:

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

With valid persistent actors, funding, approvals, and state-aware bounds, each depth step can be a successful transition and later withdrawals can depend on earlier deposits in the same sequence. The engine can then construct and shrink the ordinary deposit/withdraw sequence that reaches the insolvent state. After the change, inspect the calls/reverts table again: the handler actions should have substantial successful-call counts and a low, understood revert rate.
