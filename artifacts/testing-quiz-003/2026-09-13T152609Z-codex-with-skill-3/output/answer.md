# Why the USDT deposit reverts

The revert is caused by the direct `approve` call, not by Aave:

```solidity
usdt.approve(address(aavePool), amount);
```

Mainnet USDT is a legacy, non-standard ERC-20. Its `approve` function does not return the `bool` that `IERC20.approve` declares. Solidity therefore makes the call and then tries to ABI-decode an empty return value as a Boolean. That decoding fails, producing a revert with no useful reason string. Execution never reaches `aavePool.supply`.

The OpenZeppelin mock cannot reproduce this because a stock `ERC20` implements the modern interface and returns `true` from `approve`. Its behavior agrees with the assumption encoded by `IERC20`, whereas deployed USDT's behavior does not. The fact that both tokens use six decimals is irrelevant to this failure.

`using SafeERC20 for IERC20` does not automatically intercept every ERC-20 method. It only makes SafeERC20's explicitly named extension functions available on an `IERC20`. Thus:

```solidity
usdt.safeTransferFrom(...);
```

uses SafeERC20's low-level optional-return handling and accepts USDT's empty return data, which is why the first line succeeds. By contrast, `usdt.approve(...)` still calls the `IERC20` method directly and receives none of SafeERC20's protection.

## Code fix

Use SafeERC20 for the allowance operation as well:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` is the robust choice in OpenZeppelin versions that provide it. It handles tokens with no return value and tokens such as USDT that require an existing nonzero allowance to be reset to zero before setting another nonzero allowance. With an older OpenZeppelin release, the equivalent compatibility sequence is to use SafeERC20 operations to set the allowance to zero and then to `amount`; a raw `approve` should not be used. Upgrading to a version with `forceApprove` is preferable.

## Testing-practice fix

Add a pinned mainnet-fork integration test that deploys the vault locally but configures it with the real mainnet USDT and Aave V3 Pool addresses. Give an actor real USDT state on the fork, approve the vault, execute a deposit, and assert the resulting vault/Aave position. Pin the fork to an explicit block and ensure the RPC endpoint serves historical state for that block.

Keep mocks for fast unit tests, but do not use them as evidence that an external integration is compatible. A mock is an executable version of the team's assumptions: this mock always returns a standards-compliant Boolean, so a thousand additional tests against it would exercise the same incorrect assumption a thousand times. Only a fork test against the deployed bytecode would expose USDT's actual return-data behavior (and would also exercise Aave's real integration behavior).
