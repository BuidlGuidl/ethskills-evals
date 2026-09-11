# Root cause

Mainnet USDT is not a fully ABI-conforming `IERC20`. In particular, its `approve` implementation does not return the `bool` that `IERC20.approve` declares.

The first call succeeds because it goes through `SafeERC20`:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
```

`SafeERC20` makes a low-level call and accepts either `true` **or no return data**, which accommodates tokens such as USDT.

The next call does not go through `SafeERC20`:

```solidity
usdt.approve(address(aavePool), amount);
```

This is a normal high-level call through the `IERC20` ABI. Solidity therefore expects and decodes a returned `bool`. Real USDT returns no data, so ABI decoding fails and the caller reverts. The empty-data decoding failure explains the absence of a token revert reason. Execution never reaches `aavePool.supply`.

`using SafeERC20 for IERC20` does not transparently intercept or replace existing `IERC20` methods. It only makes the library's explicitly named extension methods, such as `safeTransferFrom` and `forceApprove`, available on the value. Calling `approve` still calls `IERC20.approve` directly.

The OpenZeppelin `MockERC20` follows the standard ABI and returns `true` from `approve`, so it cannot reproduce this behavior. Its six decimals are irrelevant. Adding more tests against that same conforming mock only exercises the mock's semantics; it cannot reveal a mismatch that the mock does not model. A deliberately USDT-like mock could expose it, but the stock mock cannot.

# Fixes

Use SafeERC20 for the allowance operation as well. With a current OpenZeppelin version, the robust change is:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` handles tokens with optional/no return data and also handles USDT's other non-standard rule: changing a nonzero allowance to another nonzero allowance may require first setting it to zero. With an older SafeERC20 version that lacks `forceApprove`, use SafeERC20-wrapped approvals to set the allowance to zero and then to `amount` (or upgrade OpenZeppelin); do not use a raw `IERC20.approve` call.

The testing-practice fix is to add a mainnet-fork integration test that uses the actual USDT contract and the actual Aave V3 pool, funds/impersonates an account holding USDT, performs a deposit, and verifies the resulting Aave position. Keep unit tests and mocks for speed, but run fork tests for every real external token/protocol combination the deployment supports. Such a test executes the deployed bytecode and would have failed on the direct `approve` before deployment. Complementary adversarial token mocks for no-return values, false returns, and zero-first approvals are useful, but they are not a substitute for the fork test.
