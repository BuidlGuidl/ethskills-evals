# Why the invariant suite stayed green

`runs = 512` and `depth = 50` mean that Foundry attempted 512 sequences of up to 50 calls each. They do **not** mean that the vault executed 25,600 useful state transitions.

`targetContract(address(vault))` tells the invariant fuzzer to call the vault's external/public ABI directly with fuzzed calldata and fuzz-selected senders. It does not create users in valid protocol states or arrange the prerequisites for those calls.

In particular, a successful ERC-20 deposit normally requires the caller to:

1. own tokens, and
2. have approved the vault.

Nothing in this setup gives the fuzz senders tokens or approvals. Deposits therefore revert. Withdrawals either revert because the sender has no deposit/shares, or otherwise cannot exercise the deposit-followed-by-withdraw path. ABI getters and any harmless calls may succeed, but they do not build the reachable state needed for the bug. Since invariant fuzzing normally continues past reverts, the invariant is checked after sequences containing mostly reverted or irrelevant attempted calls, against a vault that remains essentially in its initial state. Solvency is trivially true there.

The diagnostic was the invariant run summary, especially its **revert count**, and, with sufficient verbosity, the per-selector call/revert statistics. A result along the lines of:

```text
runs: 512, calls: 25600, reverts: 25600
```

or deposit/withdraw selectors showing nearly all calls reverting is not evidence of 25,600 tested transitions. It is evidence that the fuzzer was failing to drive the system. As a temporary diagnostic, enabling `fail_on_revert = true` would have made this impossible to overlook, although that setting alone does not create meaningful inputs and is not the real fix.

## Make the target a stateful handler

Target a handler whose actions establish valid preconditions and keep a small set of persistent actors. For example (the exact vault method names and units should be adapted to `MyVault`):

```solidity
contract VaultHandler is Test {
    MyVault public immutable vault;
    MockERC20 public immutable token;

    address[] internal actors;

    constructor(MyVault _vault, MockERC20 _token) {
        vault = _vault;
        token = _token;

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

        // Use the vault's actual per-user balance/share getter here.
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

        targetContract(address(handler));
    }

    function invariant_SolvencyHolds() public view {
        assertGe(token.balanceOf(address(vault)), vault.totalDeposits());
    }
}
```

The essential change is replacing `targetContract(address(vault))` with a properly constructed handler target. Its methods turn arbitrary fuzz input into valid, successful deposit and withdrawal actions, preserve actors across calls, and therefore let Foundry explore the same kind of multi-transaction state machine that the user exercised. Afterward, the run statistics should confirm that those handler actions are actually succeeding; call count without that check is misleading.
