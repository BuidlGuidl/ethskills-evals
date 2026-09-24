# Why the invariant stayed green

`runs = 512` and `depth = 50` means that Foundry generated up to 50 calls per run against the configured target. It does **not** mean that 25,600 useful vault operations succeeded.

Here, `targetContract(address(vault))` makes Foundry call the vault's public/external functions directly, with arbitrary calldata and fuzz-selected callers. Those callers have not been given tokens, have not approved the vault, and usually have no deposit or shares to withdraw. Consequently:

- deposits generally revert when `transferFrom` encounters no balance or allowance;
- withdrawals generally revert because the caller has no recorded claim/shares;
- arbitrary amounts also frequently violate ordinary input or state preconditions;
- getters and any calls without such preconditions may succeed, but do not create the deposit/withdraw state being searched for.

Unless `fail_on_revert` is enabled, these reverts are discarded as invalid steps rather than treated as test failures. Foundry can therefore execute thousands of *attempted* calls while the vault remains at, or very close to, its initial state. The invariant is checked after calls, but in that unchanged state both custody and accounting remain zero (or otherwise solvent), so the correct assertion has no opportunity to fail.

The warning was in the invariant run's call/revert statistics. We should have inspected the per-selector call counts and reverts, especially the overall revert rate. Deposit and withdraw reverting on nearly every invocation means the campaign is not traversing meaningful vault states; a green invariant under those conditions is vacuous. While developing the harness, setting this also makes the problem impossible to overlook:

```toml
[invariant]
runs = 512
depth = 50
fail_on_revert = true
```

`fail_on_revert` is a harness diagnostic, not the substantive fix. The fix is to target a **handler**, not the vault. The handler must construct valid actions: fund actors, approve the vault, choose an actor, and bound each operation by that actor's currently valid deposit/withdraw range. For example, adapting the exact minting and vault accounting APIs to the implementation:

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

        // Use the vault's actual per-user withdrawable-assets/shares getter here.
        uint256 available = vault.deposits(actor);
        if (available == 0) return;
        amount = bound(amount, 1, available);

        vm.prank(actor);
        vault.withdraw(amount);
    }
}
```

The invariant setup then becomes:

```solidity
VaultHandler handler;

function setUp() public {
    token = new MockERC20();
    vault = new MyVault(token);
    handler = new VaultHandler(vault, token);

    targetContract(address(handler));
}
```

If the real API uses ERC-4626 shares, the withdrawal action should bound shares/assets using `maxWithdraw(actor)` or `maxRedeem(actor)` and call the corresponding function with `actor` as owner/receiver. If the exploit needs more than one participant, keep multiple actors as above. The essential change is that each fuzzed handler call maps arbitrary input into a valid, state-changing deposit or withdrawal by a funded and approved participant. Then a depth-50 run searches sequences of real vault transitions, and the solvency assertion can encounter and shrink the draining sequence.
