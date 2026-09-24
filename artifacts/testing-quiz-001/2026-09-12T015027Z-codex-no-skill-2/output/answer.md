# Why the invariant suite stayed green

`runs = 512` and `depth = 50` do not mean that Foundry successfully executed 25,600 economically meaningful vault operations. They mean that it generated 512 fresh state-machine runs, each containing up to 50 calls to functions in the ABI of the targeted contract. Foundry checks the invariant as the sequence progresses and resets to the post-`setUp` state for the next run.

Here the target is the raw vault:

```solidity
targetContract(address(vault));
```

Consequently, Foundry supplied arbitrary calldata arguments and, by default, arbitrary callers. It did **not** arrange the preconditions needed to use the vault:

- a caller with tokens;
- an allowance from that caller to the vault;
- an amount limited to that caller's balance;
- a caller with an existing deposit/shares before a withdrawal;
- a withdrawal amount limited to what that caller can withdraw;
- where relevant, a coherent owner/receiver relationship.

The token and vault were newly deployed, but no fuzz actor was funded and no fuzz actor approved the vault. Deposits therefore reverted at the token transfer/allowance checks. Withdrawals reverted because the arbitrary caller had no deposit or shares. Calls to getters merely read state. Any other calls whose random inputs violated a precondition reverted as well. Unless `fail_on_revert` is enabled, those reverts are discarded and the campaign continues.

Thus the suite repeatedly checked solvency on the initial state, or on the small subset of states reachable without satisfying the protocol's prerequisites. A reverted transaction is not a transition. More runs and greater depth only explored that ineffective action generator more often; they could never assemble the user's valid deposit/withdraw history.

## The warning in the test output

Foundry's invariant result reports both calls and reverts, for example:

```text
[PASS] invariant_SolvencyHolds() (runs: 512, calls: 25600, reverts: 25600)
```

The exact revert count may differ if view functions or a few permissive methods were selected, but a very high revert-to-call ratio is the warning. With higher verbosity, the per-call/revert information and traces show deposits failing for balance/allowance and withdrawals failing for insufficient shares. The useful coverage question was not “How many calls did we ask Foundry to make?” but “How many valid state transitions did the handler perform, and which actions/states did it reach?” Ghost counters such as `successfulDeposits` and `successfulWithdrawals` make that visible and can themselves be checked with coverage assertions during harness development.

Setting `fail_on_revert = true` is a useful harness diagnostic because this test would fail immediately and expose the bad generator. It is not, by itself, the fix: the inputs and actors still need to be constructed so calls succeed.

## Make the action generator produce valid operations

Target a handler instead of the raw vault. The handler should create actors, fund them, approve the vault, and bound every action by the actor's current valid range. For example (adapt names for the vault's actual share/deposit API):

```solidity
contract VaultHandler is Test {
    MyVault immutable vault;
    MockERC20 immutable token;

    address[] internal actors;
    uint256 public successfulDeposits;
    uint256 public successfulWithdrawals;

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
        vault.deposit(amount); // or deposit(amount, actor)
        ++successfulDeposits;
    }

    function withdraw(uint256 actorSeed, uint256 amount) external {
        address actor = actors[actorSeed % actors.length];
        uint256 available = vault.balanceOf(actor); // use deposits/shares/preview rules
        if (available == 0) return;
        amount = bound(amount, 1, available);

        vm.prank(actor);
        vault.withdraw(amount); // or withdraw(amount, actor, actor)
        ++successfulWithdrawals;
    }
}
```

Then change setup to target only that handler:

```solidity
VaultHandler handler;

function setUp() public {
    token = new MockERC20();
    vault = new MyVault(token);
    handler = new VaultHandler(vault, token);

    targetContract(address(handler));
}
```

If `withdraw` accepts assets while balances are shares, its bound must use the vault's conversion/`maxWithdraw` logic rather than blindly treating shares as assets. Likewise, if the real exploit requires particular receiver/owner combinations, expose those as deliberate handler actions while preserving the protocol's authorization rules.

This change makes each fuzz step a plausible user action and preserves state across the 50 calls in a run, so Foundry can compose successful deposits and withdrawals into the offending sequence. The solvency assertion can remain exactly as written.
