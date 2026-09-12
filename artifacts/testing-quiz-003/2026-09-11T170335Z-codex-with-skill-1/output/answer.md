# Why the USDT deposit reverts

The failing call is `usdt.approve(...)`, not the preceding transfer. Mainnet USDT is a legacy, non-standard ERC-20: its `approve` implementation does not return the `bool` that `IERC20.approve` declares. Calling it through the typed `IERC20` interface therefore makes Solidity expect and ABI-decode a Boolean return value. USDT returns no data, so the decode fails and the transaction reverts without a reason string. The revert rolls back the allowance update and the earlier transfer as well.

The OpenZeppelin mock cannot reproduce this. A stock `ERC20` implements the modern interface and returns `true` from `approve`, so the typed call always receives correctly shaped return data. Its six decimals are irrelevant: decimals affect display and amount conventions, not the ABI behavior of `approve`.

`using SafeERC20 for IERC20` only adds wrapper functions; it does not transparently replace every ERC-20 method call. The first line explicitly invokes `safeTransferFrom`, whose optional-return handling accepts either `true` or no return data, so it works with USDT. The second line explicitly invokes the raw `approve` method, bypassing `SafeERC20`, and therefore retains Solidity's strict return-data decoding.

USDT also has the well-known zero-first allowance rule: changing an existing nonzero allowance directly to another nonzero value reverts. The robust code fix is therefore OpenZeppelin's `forceApprove`, which handles both optional return data and tokens that require resetting the allowance to zero:

```solidity
using SafeERC20 for IERC20;

usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

This requires an OpenZeppelin version that provides `forceApprove`. With an older version, upgrade it or implement the equivalent using SafeERC20 optional-return calls: try the desired allowance, and on failure safely approve zero before safely approving the desired value. A raw `approve(0)` followed by raw `approve(amount)` is not sufficient because both raw calls still have the missing-return-value problem.

No number of additional tests against the same stock `MockERC20` could reveal this integration mismatch. A mock encodes the standard behavior the test author assumed; repeatedly exercising it cannot discover that the deployed contract has different return-data and allowance semantics. Coverage and a green unit suite only show behavior under those mocked assumptions.

The testing-practice fix is to add a pinned mainnet-fork integration test that uses the actual USDT contract at `0xdAC17F958D2ee523a2206206994597C13D831ec7` and the actual configured Aave V3 pool. Fund a depositor with real USDT state (for example, by impersonating a holder or using a Foundry balance helper appropriate for that token), approve the vault, execute a deposit, and assert both the vault/Aave accounting and the resulting aToken position. Pin the block number and first confirm the RPC endpoint serves historical state at that block. Keep fast mock unit tests for local logic, but require fork tests for external protocols and known non-standard tokens before deployment.
