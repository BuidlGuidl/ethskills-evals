# Why the invariant suite stayed green

`runs = 512` and `depth = 50` mean that Foundry **attempted** 25,600 calls. They do not mean that 25,600 useful vault transitions occurred.

`targetContract(address(vault))` tells the invariant engine to choose public/external selectors on `vault` and fuzz their calldata. It does not manufacture the preconditions of a successful call. In particular, the generated callers were not set up as real vault users: they had no token balance, had not approved the vault, and had no existing deposit/share balance.

Consequently, calls such as `deposit` reverted on insufficient balance or allowance, while `withdraw` reverted because the caller had no position. Depending on the vault API, getters and zero-value operations may also have succeeded without changing relevant state. After each attempted call, Foundry checked the invariant, but it was repeatedly checking the initial state or an equally harmless state. A reverted call rolls back all of its changes, so no generated sequence ever reached the prerequisite state from which the bad deposit/withdraw ordering was possible.

Unless `fail_on_revert` is enabled, reverts during invariant campaigns are normally counted and the campaign continues. Thus a green invariant proves the property only over the states the campaign actually reached, not over every sequence suggested by the nominal call count.

## The warning in the output

The invariant result includes the number of calls and reverts. The warning would have looked roughly like:

```text
[PASS] invariant_SolvencyHolds() (runs: 512, calls: 25600, reverts: 25600)
```

Even if the exact number was slightly lower, a very high revert ratio was the important signal. With invariant metrics enabled, the per-selector call/revert table would also have shown that `deposit` and `withdraw` almost never completed:

```toml
[invariant]
runs = 512
depth = 50
show_metrics = true
```

Setting `fail_on_revert = true` is also useful while developing the harness because it makes this kind of vacuous campaign fail loudly. It diagnoses a bad harness, but by itself does not make the calls valid.

## Make the fuzzer drive valid actions

Target a handler rather than the vault directly. The handler must create the protocol state that ordinary users have: funded actors, approvals, deposits, and withdrawals bounded to positions that can actually be withdrawn. For a single-actor sequence, the shape is:

```solidity
contract VaultHandler is Test {
    MyVault internal immutable vault;
    MockERC20 internal immutable token;

    constructor(MyVault _vault, MockERC20 _token) {
        vault = _vault;
        token = _token;

        token.mint(address(this), 1_000_000_000 ether);
        token.approve(address(vault), type(uint256).max);
    }

    function deposit(uint256 amount) external {
        amount = bound(amount, 1, token.balanceOf(address(this)));
        vault.deposit(amount);
    }

    function withdraw(uint256 amount) external {
        // Replace balanceOf with the vault's actual position/share accessor.
        uint256 position = vault.balanceOf(address(this));
        if (position == 0) return;

        amount = bound(amount, 1, position);
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

The precise position accessor and whether `withdraw` takes assets or shares must be adapted to `MyVault`. If the exploit requires interaction among several users, the handler should maintain a small actor set, fund and approve each actor, select one from the fuzz input, and execute each action under `vm.prank(actor)`. The essential change is the same: fuzz **valid stateful operations with satisfied preconditions**, then target that handler.

After this change, inspect both the invariant and the campaign quality: successful calls to each important mutating selector, a low/understood revert count, and meaningful coverage of deposits followed by withdrawals. The nominal number of calls is not a coverage metric.
