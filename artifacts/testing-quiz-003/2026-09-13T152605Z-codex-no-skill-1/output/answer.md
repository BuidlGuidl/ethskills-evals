# Root cause

The revert occurs at `usdt.approve(address(aavePool), amount)`, before `supply` is reached.

Mainnet USDT is a legacy, non-standard ERC-20. Its `approve` call succeeds at the token-contract level but returns no value. By contrast, OpenZeppelin's `IERC20.approve` declaration says that the call returns a `bool`. A normal Solidity interface call therefore tries to ABI-decode a Boolean from USDT's empty return data. That decoding fails and the caller reverts, commonly without a useful reason string.

The transfer works because it is invoked through `safeTransferFrom`. `SafeERC20` deliberately accepts either a returned `true` or no return data, which supports tokens such as USDT. The approval does **not** receive that protection: `using SafeERC20 for IERC20` only makes the library's methods available; it does not intercept or rewrite direct calls to `IERC20.approve`. The code calls the token's `approve` method, not a `SafeERC20` method.

The OpenZeppelin mock follows the modern ERC-20 ABI and returns `true` from `approve`, so the decode always succeeds. Its six decimals are irrelevant to this failure. Repeating tests against that same compliant implementation cannot reveal behavior that the mock does not model; green unit tests here establish compatibility with the mock, not with every deployed contract that is commonly treated as an ERC-20.

# Code fix

Use `SafeERC20.forceApprove` (on a current OpenZeppelin version):

```solidity
using SafeERC20 for IERC20;

usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` uses optional-return handling and also supports tokens that require an existing nonzero allowance to be reset to zero before setting another nonzero value. This makes it preferable to replacing the line with another raw `approve`. If the project uses an older OpenZeppelin release without `forceApprove`, upgrade it or implement the equivalent with SafeERC20-compatible optional-return calls: try the desired approval, and on failure approve zero before approving the desired value.

# Testing-practice fix

Add a pinned mainnet-fork integration test that impersonates/funds a USDT holder and executes the complete deposit against the **actual mainnet USDT contract and actual Aave V3 pool**. Assert both that the deposit succeeds and that Aave receives/accounts for the supplied assets. Keep the fast mock unit suite, but do not use it as the compatibility test for production token and protocol contracts.

It is also useful to add adversarial token fixtures—especially an ERC-20 that returns no data and one that enforces zero-first approvals—but those are simulations. The fork test is what would have exercised USDT's real return-data behavior, Aave's real allowance pull, and the exact deployed integration before mainnet.
