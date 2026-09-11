# Why the invariant was green

`calls: 25600` does not mean that 25,600 meaningful vault operations executed successfully. With `targetContract(address(vault))`, Foundry selected callable functions from the vault ABI, generated arbitrary calldata and senders, and attempted up to 50 calls in each of 512 fresh sequences. It checked the invariant as the sequence progressed, including after reverted calls.

The generated calls did not establish the preconditions for the vault's state-changing paths. A random caller starts with no tokens, has not approved the vault, and has no deposit or shares to withdraw. Thus, in the usual ERC-20 flow:

- `deposit(amount)` reverts when the vault tries to transfer tokens from a caller with no balance and/or allowance.
- `withdraw(amount)` reverts because that caller has no recorded deposit or shares.
- Any calls that do succeed are getters or other operations that do not construct the required deposit/withdraw history.

A revert rolls the call back, so it cannot move the vault toward the bad state. Repeating an impossible call 25,600 times does not increase coverage of the reachable deposit/withdraw state machine. Targeting the token as a second arbitrary contract would not reliably fix this either: the fuzzer would still have to correlate token ownership, `approve`'s spender, the caller of `approve`, the caller of `deposit`, and a later withdrawal amount and actor.

The warning was the invariant result's **revert count**, for example:

```text
[PASS] invariant_SolvencyHolds() (runs: 512, calls: 25600, reverts: 25600)
```

The exact formatting depends on the Foundry version, but `reverts` being equal or close to `calls` is the important signal. Verbose invariant output and the per-selector/call breakdown would likewise show deposit and withdrawal attempts reverting rather than exercising successful transitions. `runs` and `calls` alone are not coverage metrics. Setting `fail_on_revert = true` during development is a useful alarm for this condition, but it only exposes the vacuity; it does not create valid actions.

# Make the fuzzer generate valid actions

Target a handler whose functions turn arbitrary inputs into valid, stateful user actions. The handler must create the ERC-20 balance and allowance, keep the same actor across calls (or deliberately select from a bounded actor set), and bound withdrawals to an amount the actor can withdraw. For a vault whose API is `deposit(uint256)` and `withdraw(uint256)`, the shape is:

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
        // `deal` is test scaffolding: it supplies the ordinary user's starting assets.
        amount = bound(amount, 1, type(uint128).max);
        deal(address(token), address(this), amount);
        vault.deposit(amount);
    }

    function withdraw(uint256 amount) external {
        uint256 available = vault.balanceOf(address(this)); // shares, for an ERC-4626-like vault
        if (available == 0) return;
        amount = bound(amount, 1, available);
        vault.withdraw(amount);
    }
}
```

The exact withdrawal bound should use the vault's real unit: shares for a share-denominated withdrawal, or `maxWithdraw(address(this))`/the recorded deposit for an asset-denominated withdrawal. If the production sequence requires several users, the handler should choose an actor from a small fixed set and perform funding, approval, deposit, and withdrawal under that actor with `vm.startPrank(actor)`.

Then change the test target:

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

Now every sequence is composed from executable semantic operations, so earlier deposits create the state consumed by later withdrawals. The fuzzer can explore the same class of ordinary transaction sequence as the user's drain. After adding the handler, inspect both the revert count and handler call distribution; successful deposit and withdrawal counts are the evidence that the invariant is being tested rather than merely asserted against the deployment state.
