# Why the USDT deposit reverts

The failing call is:

```solidity
usdt.approve(address(aavePool), amount);
```

Mainnet USDT is a legacy, non-standard ERC-20. Its `approve` function does not return the `bool` required by the modern `IERC20` interface. Calling it through `IERC20.approve` makes Solidity expect and ABI-decode a Boolean return value. USDT returns no data, so that decoding fails and the transaction reverts without a token-provided reason string.

The preceding transfer succeeds because it is invoked differently:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
```

`safeTransferFrom` is a SafeERC20 wrapper. It treats empty return data as success and, when return data is present, requires it to decode to `true`. This exists specifically to support tokens such as USDT.

`using SafeERC20 for IERC20` does not automatically wrap every `IERC20` call. It only adds the library's explicitly named extension methods. The code calls the token's raw `approve`, not a SafeERC20 allowance method, so SafeERC20 never participates in the failing call.

## Code fix

Use SafeERC20 for the approval as well:

```solidity
using SafeERC20 for IERC20;

usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` uses SafeERC20's optional-return handling and also supports tokens such as USDT that may require an existing nonzero allowance to be reset to zero before setting another nonzero allowance. It is therefore preferable to a raw `approve` (and more robust than merely replacing it with an allowance helper that does not handle the zero-reset rule). The exact method name depends on the installed OpenZeppelin version; upgrade to a version providing `forceApprove`, or implement the same safe zero-then-set behavior with optional-return calls.

An alternative architecture is to establish the pool's maximum allowance once, using `forceApprove`, and then call `supply` for subsequent deposits. That choice should be made with the corresponding allowance-risk tradeoff in mind.

## Why the mock suite could not catch it

OpenZeppelin's stock `ERC20` is standards-compliant: its `approve` returns `true` and it permits ordinary allowance replacement. It therefore does not reproduce either of USDT's relevant behaviors. Token decimals are unrelated to this failure.

Adding more tests against the same mock only explores more scenarios under the same incorrect behavioral assumption. Even exhaustive tests cannot reveal an integration incompatibility that the mock does not model.

The testing-practice fix is to include a mainnet-fork integration test using the real USDT contract at `0xdAC17F958D2ee523a2206206994597C13D831ec7` and the real Aave V3 pool, with a funded/impersonated holder (or otherwise provisioned USDT). The test should execute the complete deposit path and verify the resulting Aave position. Pinning the fork to a known block makes it reproducible.

Purpose-built adversarial token mocks are also useful unit-test coverage: include a no-return ERC-20 and a zero-reset-approval token. But those complement rather than replace fork tests. A fork test exercises the actual deployed token ABI/bytecode and protocol interaction and would have failed at the raw `approve` before deployment.
