The `25,600 calls` number is a count of **attempted calls**, not a count of
successful vault operations and not a coverage claim about valid call sequences.

`targetContract(address(vault))` tells Foundry's invariant fuzzer to choose exposed
functions from `vault` and invoke them with fuzzed calldata (and fuzzed callers).
It does not infer the protocol that makes those calls usable. In particular, it
does not first give a caller tokens, make that caller approve the vault, or arrange
for that caller to have a withdrawable deposit.

Consequently, calls such as these dominated the run:

* `deposit(x)` from an address with no token balance and/or allowance, reverting in
  `transferFrom`;
* `withdraw(x)` from an address with no recorded deposit, reverting on the vault's
  balance check;
* calls with completely unconstrained amounts, which likewise reverted.

A reverted call rolls back all state. By default, invariant testing does not fail
merely because a targeted call reverted (`fail_on_revert` is false). Foundry then
checked the invariant against essentially the initial state again. Thus 512 runs at
depth 50 can mean 25,600 ineffective attempts, not 25,600 transitions through the
reachable state machine. The vulnerable transaction sequence was in the ABI, but
the states from which its calls succeed were not reachable by this fuzz campaign.

The warning was the **revert count** printed alongside the invariant result, for
example a result shaped like:

```
[PASS] invariant_SolvencyHolds() (runs: 512, calls: 25600, reverts: 25xxx)
```

That number should never be read as harmless noise without investigation. With
invariant call metrics enabled (`show_metrics = true` in the invariant config), the
per-contract/per-selector call metrics make the problem even clearer: the state
changing selectors have very high, often 100%, revert rates. Successful-call and
state-transition coverage matter here; the green assertion alone says only that
the invariant held in the states the fuzzer actually reached. Temporarily setting
`fail_on_revert = true` is also a useful diagnostic, although it is not by itself
the fix: it turns the unreachable-input problem into a loud failure rather than
making useful sequences reachable.

The fix is to target a **handler** whose actions establish the protocol
preconditions and only then call the vault. A minimal single-actor version is:

```solidity
contract VaultHandler is Test {
    MyVault public immutable vault;
    MockERC20 public immutable token;

    constructor(MyVault _vault, MockERC20 _token) {
        vault = _vault;
        token = _token;
        token.approve(address(vault), type(uint256).max);
    }

    function deposit(uint256 amount) external {
        amount = bound(amount, 1, 1e30);
        deal(address(token), address(this),
             token.balanceOf(address(this)) + amount);
        vault.deposit(amount);
    }

    function withdraw(uint256 amount) external {
        uint256 available = vault.balanceOf(address(this)); // use the vault's
                                                            // per-user getter
        if (available == 0) return;
        amount = bound(amount, 1, available);
        vault.withdraw(amount);
    }
}
```

Then change setup to target the handler, not the raw vault:

```solidity
VaultHandler handler;

function setUp() public {
    token = new MockERC20();
    vault = new MyVault(token);
    handler = new VaultHandler(vault, token);
    targetContract(address(handler));
}
```

The exact per-user getter and token-provisioning mechanism should be adapted to the
actual contracts. If the exploit requires interactions among distinct users, the
handler should maintain a small actor set, select an actor from a fuzz input, fund
and approve that actor, and execute under `vm.prank(actor)`. The essential change is
the same: encode valid actions and their prerequisites in a stateful handler, so
depth 50 represents up to 50 real state transitions. Once the user's deposit and
withdraw sequence is reachable, Foundry can shrink a failing run to a reproducible
counterexample.
