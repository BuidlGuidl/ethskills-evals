# Root cause

Mainnet USDT is not fully ERC-20 ABI-compliant. In particular, its `approve(address,uint256)` function does not return a `bool`. Calling it through OpenZeppelin's `IERC20` interface makes Solidity expect and ABI-decode a Boolean return value. USDT returns no data, so the high-level call fails while decoding the empty return data. That is why the transaction reverts without a reason before `aavePool.supply` can complete.

The preceding transfer succeeds because it is actually wrapped:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
```

`SafeERC20` performs a low-level call and accepts either no return data or a decoded `true`, specifically accommodating tokens such as USDT. By contrast:

```solidity
usdt.approve(address(aavePool), amount);
```

is a direct `IERC20.approve` call. `using SafeERC20 for IERC20` only makes the library's explicitly named methods available; it does not intercept or change ordinary `approve` calls. Consequently, `SafeERC20` protected `safeTransferFrom` but never participated in the failing call.

The OpenZeppelin mock always returns the standard `bool` from `approve`, so it cannot reproduce this behavior. More tests against that same implementation would only explore more inputs against the same compliant semantics; they could not reveal an incompatibility that the mock does not model. Matching USDT's six decimals does not make the mock behaviorally equivalent to USDT.

# Code fix

Use the SafeERC20 allowance helper as well:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` accepts tokens that return no value and also handles USDT-style allowance rules by retrying via an allowance of zero when a direct allowance update fails. It is therefore preferable to a raw `approve` and more robust than merely wrapping approval with an optional-return call. The project should use an OpenZeppelin version that provides `SafeERC20.forceApprove`; on older versions, implement the equivalent safe zero-then-set sequence with SafeERC20 helpers or upgrade OpenZeppelin.

# Testing-practice fix

Add mainnet-fork integration tests using the actual deployed USDT contract at `0xdAC17F958D2ee523a2206206994597C13D831ec7` and the actual Aave V3 pool, at a pinned block. Fund or impersonate a real USDT holder, approve the vault, execute a deposit, and assert the resulting Aave position/aToken balance. Keep the fast mock unit tests, but supplement them with fork tests for every production token and external protocol integration.

For focused unit coverage, also include adversarial token doubles that model common non-standard ERC-20 behavior—especially no return value and zero-first approval—but those doubles complement rather than replace a fork test against the exact deployed contracts. The fork test would have exercised USDT's real return-data behavior and failed before deployment.
