# Why the invariant suite was green

`calls: 25600` means 25,600 **attempted calls selected from the target ABI**. It does not mean 25,600 successful deposits or withdrawals.

Each of the 512 runs starts from the state produced by `setUp`, then Foundry attempts 50 calls to `vault`. For every step it chooses a callable selector, fuzzes its arguments, and chooses a sender. A reverted call still consumes one unit of `depth`. With the default `fail_on_revert = false`, that revert is ignored and the campaign continues. Foundry checks the invariant after the attempt, but a revert has rolled back all state changes, so it is checking the same unchanged state again.

That matters here because calling a vault is not self-contained. A successful deposit normally requires the caller to own tokens and to have approved the vault. The random invariant senders have neither. A successful withdrawal normally requires that same caller to have an existing deposit/share balance, which it never obtains because deposits revert. Uniformly fuzzed amounts also tend to exceed whatever balance or position might exist. Any view/getter selectors in the ABI can succeed, but they do not create useful state.

The suite therefore spent most or all of its depth doing something equivalent to:

1. try `deposit(randomHugeAmount)` from an unfunded, unapproved address; revert;
2. assert solvency in the pristine state;
3. try `withdraw(randomHugeAmount)` from an address with no position; revert;
4. assert solvency in the pristine state;
5. repeat.

The number that would have exposed this was the **revert count**, not the call count. The normal result summary includes output such as `calls: 25600, reverts: 25600` (or a similarly suspiciously high revert count). Enabling:

```toml
[invariant]
runs = 512
depth = 50
show_metrics = true
```

also prints the per-handler/per-selector call, revert, and discard breakdown. Seeing `deposit` and `withdraw` revert on every call—or seeing zero successful state-changing calls—would have shown that the state space was not being explored. Foundry explicitly counts reverted calls toward depth and recommends `show_metrics` for this purpose in its [invariant-testing documentation](https://getfoundry.sh/forge/invariant-testing).

## Make the calls reachable

Target a handler that establishes the preconditions and constrains each operation to a valid amount, rather than targeting the vault directly. For example (the share/position accessor should be changed to the one exposed by `MyVault`):

```solidity
contract VaultHandler is Test {
    MyVault internal immutable vault;
    MockERC20 internal immutable token;
    address internal actor = address(0xA11CE);

    constructor(MyVault _vault, MockERC20 _token) {
        vault = _vault;
        token = _token;

        vm.prank(actor);
        token.approve(address(vault), type(uint256).max);
    }

    function deposit(uint256 amount) external {
        // Keep generated values in the protocol's meaningful domain.
        amount = bound(amount, 1, 1_000_000 ether);
        token.mint(actor, amount);

        vm.prank(actor);
        vault.deposit(amount);
    }

    function withdraw(uint256 amount) external {
        // Substitute deposits(actor), maxWithdraw(actor), or the vault's actual
        // position accessor here if it is not balanceOf(actor).
        uint256 available = vault.balanceOf(actor);
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

        targetContract(address(handler)); // not address(vault)
    }

    function invariant_SolvencyHolds() public view {
        assertGe(token.balanceOf(address(vault)), vault.totalDeposits());
    }
}
```

If the real exploit needs multiple users, the handler should select an actor from a small fixed actor set using a fuzzed seed, mint to that actor, approve once per actor, and bound withdrawals by that actor's position. The essential change is the same: the fuzzer must generate **valid state transitions**, including successful deposits followed by successful withdrawals, rather than merely generate ABI calls.

Once the handler is designed so its actions are expected to succeed, set:

```toml
[invariant]
fail_on_revert = true
show_metrics = true
```

This makes a newly unreachable handler action fail CI instead of silently consuming depth. A zero-position withdrawal may deliberately return from the handler as above; track successful deposit/withdraw counters as ghost variables and assert in `afterInvariant()` that both were exercised if the suite needs a hard coverage floor.
