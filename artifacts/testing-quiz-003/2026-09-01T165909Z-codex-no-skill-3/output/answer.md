# Why the mainnet deposit reverts

The reverting statement is the direct `approve`, before execution reaches `aavePool.supply`:

```solidity
usdt.approve(address(aavePool), amount);
```

Mainnet USDT is a legacy, non-standard ERC-20. Its `approve` function does not return the `bool` required by the modern `IERC20` interface. Calling it through `IERC20.approve` makes Solidity expect ABI-encoded Boolean return data. USDT returns no data, so Solidity fails while decoding the empty return buffer. That low-level decode failure commonly appears as a revert with no reason string.

The OpenZeppelin mock never exhibits this behavior because it is a standards-compliant `ERC20`: its `approve` returns `true`. Its ABI behavior therefore matches `IERC20`, whereas mainnet USDT's does not. The mock's six decimals are irrelevant; decimals affect denominations, not the token's call/return behavior.

`SafeERC20` did protect the first line because the wrapper was actually used there:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
```

`SafeERC20` performs a low-level call and treats empty return data as success, while still requiring a decoded `true` if return data is present. But `using SafeERC20 for IERC20` does not automatically replace or intercept calls to methods already declared on `IERC20`. The second line explicitly calls the raw `IERC20.approve`, so none of `SafeERC20`'s compatibility logic applies to it.

## Code fix

Use the SafeERC20 allowance operation as well:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` is the preferred fix in current OpenZeppelin versions. It accepts tokens that return no value and, when necessary, handles USDT's other allowance quirk: changing a nonzero allowance to another nonzero allowance must first set the allowance to zero. If the project's OpenZeppelin version predates `forceApprove`, use SafeERC20-compatible calls to set the allowance to zero and then to `amount` (or upgrade OpenZeppelin); do not call raw `approve`.

An alternative design is to grant the pool a sufficiently large allowance once during initialization, also via `forceApprove`, and then avoid approving on every deposit. The contract should still account for any operational and upgradeability implications of an unlimited approval.

## Testing-practice fix

Add a mainnet-fork integration test, pinned to a known block, that uses the deployed USDT contract and the deployed Aave V3 pool. Fund or impersonate a USDT holder, approve the vault, execute a deposit, and assert the resulting Aave position/aToken balance. Keep the mock unit tests for fast testing, but do not use them as the sole evidence of compatibility with production tokens and protocols.

No number of tests using only the stock OpenZeppelin mock could reveal this bug: every such test exercises the same compliant implementation whose `approve` returns a Boolean. More cases improve coverage of the vault's logic but cannot test behavior the mock does not model. Either a deliberately adversarial non-standard ERC-20 mock (including no-return and zero-first approval behavior) or, more convincingly, a fork test against the exact production bytecode would have exposed the mismatch before deployment.
