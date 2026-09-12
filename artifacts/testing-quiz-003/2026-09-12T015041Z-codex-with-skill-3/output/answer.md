# Why the mainnet deposit reverts

The failing call is the direct `approve`:

```solidity
usdt.approve(address(aavePool), amount);
```

Mainnet USDT predates the ERC-20 convention used by modern OpenZeppelin tokens. Its `approve` implementation does not return an ABI-encoded `bool`. But `usdt` is statically typed as `IERC20`, whose `approve` signature promises a `bool` return value. Solidity therefore makes the call and then tries to decode 32 bytes of return data. USDT returns no data, so that ABI decoding fails and the caller reverts, commonly with empty revert data. The pool call is never reached.

The preceding transfer succeeds for exactly the reason the approval does not:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
```

`using SafeERC20 for IERC20` only affects calls made through the library's extension methods. It does not rewrite or intercept ordinary interface calls such as `usdt.approve(...)`. `safeTransferFrom` uses a low-level call and treats either empty return data or an encoded `true` as success, so it supports USDT. The direct `approve` uses Solidity's normal high-level ABI decoding and receives no such protection.

There is a second USDT approval behavior worth handling: changing an existing nonzero allowance directly to another nonzero value is rejected. Even if Aave normally consumes the entire allowance, robust integration code should not rely on that incidental state.

## Code fix

With an OpenZeppelin version that provides it, use `forceApprove`:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` uses SafeERC20's optional-return handling and, for tokens such as USDT, falls back to approving zero before approving the requested nonzero amount. Upgrading to a current compatible OpenZeppelin release is preferable to hand-rolling this logic. If the installed SafeERC20 predates `forceApprove`, the equivalent is to perform the zero approval and then the desired approval through SafeERC20's optional-return low-level-call machinery—not through direct `IERC20.approve` calls.

## Why the mock suite could not catch it

The stock OpenZeppelin `MockERC20` is a standards-conforming token: its `approve` returns an encoded `true` and it permits the ordinary allowance transitions expected by the tests. `MockAavePool` likewise contains only the behavior the test author chose to model. Thus the mocks encode the very assumptions that are wrong on mainnet.

Adding more cases, fuzz inputs, or assertions against those same conforming mocks cannot discover a return-data shape or allowance rule the mocks do not implement. Thirty-nine green tests only show compatibility with those mocks; they do not establish compatibility with the deployed contracts. A deliberately USDT-like adversarial mock could reproduce this particular defect, but only after the quirk was already known and modeled.

## Testing-practice fix

Add a pinned mainnet-fork integration test that exercises the full deposit path against the real deployed USDT and the real Aave V3 pool (or its canonical address-provider-resolved pool). Fund a test actor with real forked USDT state, approve the vault, call `deposit`, and assert that the deposit succeeds and that the expected Aave position/accounting changes occur. Pin the block and verify that the RPC endpoint serves historical state so the test is reproducible.

That fork test would execute the real USDT bytecode and observe its empty `approve` return data, causing the original implementation to fail before deployment. Keep fast mock unit tests for vault logic, but require pinned-fork tests for external protocol integrations and non-standard tokens; mocks are not substitutes for compatibility tests against deployed dependencies.
