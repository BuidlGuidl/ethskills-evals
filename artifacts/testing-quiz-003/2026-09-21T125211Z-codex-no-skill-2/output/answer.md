The revert is caused by using a high-level `IERC20.approve` call against mainnet
USDT.

Mainnet USDT is not a standard OpenZeppelin-style ERC20. Its `transfer`,
`transferFrom`, and `approve` functions do not return the `bool` that the ERC20
interface says they should return. OpenZeppelin's stock `MockERC20` does return a
`bool`, so it behaves correctly when called through `IERC20`.

This line is protected:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
```

`SafeERC20.safeTransferFrom` performs a low-level call and treats either a
successful call with no return data or a successful call returning `true` as
success. That is why the first line works with real USDT.

This line is not protected:

```solidity
usdt.approve(address(aavePool), amount);
```

Even though the contract has `using SafeERC20 for IERC20`, this still calls
`IERC20.approve` directly. Solidity expects the call to return a `bool` because
that is what the interface declares. USDT's `approve` returns no data, so the
high-level ABI return-value handling fails and the transaction reverts without a
useful reason string. The mock never shows this because OpenZeppelin's ERC20
mock has the standard return value.

USDT also has another approval quirk: changing an existing non-zero allowance to
another non-zero allowance can fail unless the allowance is first set to zero.
So the robust fix should handle both the missing return value and the zero-first
approval behavior.

The code fix is to use SafeERC20 for the approval too, preferably
`forceApprove`:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

Or approve a sufficiently large allowance once, using the same safe approval
path:

```solidity
if (usdt.allowance(address(this), address(aavePool)) < amount) {
    usdt.forceApprove(address(aavePool), type(uint256).max);
}
```

On older OpenZeppelin versions without `forceApprove`, the equivalent is a
low-level SafeERC20-compatible zero-then-set approval pattern:

```solidity
usdt.safeApprove(address(aavePool), 0);
usdt.safeApprove(address(aavePool), amount);
```

The testing fix is not "more tests with the same mocks." No amount of extra
tests against a stock OpenZeppelin `MockERC20` would have surfaced this, because
that mock does not model USDT's behavior. The tests were proving compatibility
with a standard ERC20, not compatibility with the deployed token bytecode.

The suite should include an integration test on a mainnet fork using the real
USDT contract at `0xdAC17F958D2ee523a2206206994597C13D831ec7` and the real Aave
V3 pool, or at minimum a deliberately adversarial token mock that matches USDT's
non-standard behavior: no return data from `approve`/`transfer`/`transferFrom`
and zero-first allowance semantics. The mainnet-fork test is the one that would
have caught this before deployment.
