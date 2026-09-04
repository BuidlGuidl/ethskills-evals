# Why the mainnet deposits revert

The revert occurs at:

```solidity
usdt.approve(address(aavePool), amount);
```

Mainnet USDT is a legacy, non-standard ERC-20. Its `approve` implementation does not return a value, even though the `IERC20` interface declares `approve(address,uint256) returns (bool)`. A direct high-level call through `IERC20` therefore expects 32 bytes of ABI-encoded return data. USDT returns no data, and Solidity's return-data decoding reverts. That decoding failure commonly has no reason string, so execution never reaches `aavePool.supply`.

The OpenZeppelin mock cannot reproduce this. A stock `ERC20` implements the modern interface and returns `true` from `approve`; it also does not reproduce USDT's other approval restriction that an existing nonzero allowance must generally be reset to zero before setting another nonzero allowance. Giving the mock six decimals changes only its units, not its call/return or allowance semantics.

## Why `SafeERC20` did not protect this call

`using SafeERC20 for IERC20` only makes the library's extension methods available. It does not transparently wrap every call made on an `IERC20` value.

Thus:

```solidity
usdt.safeTransferFrom(...);
```

uses `SafeERC20`, whose optional-return handling accepts both a returned `true` and empty return data. But:

```solidity
usdt.approve(...);
```

selects `IERC20.approve` directly. It bypasses `SafeERC20`, so Solidity tries to decode USDT's nonexistent return value and reverts.

## Code fix

Use the SafeERC20 approval operation, preferably `forceApprove` in current OpenZeppelin versions:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` handles tokens that return no value and tokens such as USDT that require a zero allowance before a new nonzero allowance is written. An alternative design is to grant Aave a maximum allowance once, also through `forceApprove`, subject to the project's allowance-risk policy. A raw `approve` should not be used here. In older OpenZeppelin releases without `forceApprove`, use SafeERC20's optional-return-safe approval mechanism and explicitly set the allowance to zero before setting the desired value.

## Testing-practice fix

Keep the mock-based unit tests, but add a mainnet-fork integration test using the actual deployed USDT and the actual Aave V3 Pool, pinned to a specific block. Fund a test user with USDT (for example with Foundry's token `deal` facility or by impersonating a funded account), approve the vault, execute a deposit, and assert that Aave receives the supply or that the vault receives the expected aToken/accounting change.

No number of additional tests against the same OpenZeppelin mock would expose this bug: every invocation still exercises the mock's standards-compliant `approve` implementation, not USDT's bytecode and return-data behavior. Fuzzing more amounts or call sequences expands inputs but does not change the implementation under test. A fork test crosses the real integration boundary and would have failed before deployment at the direct `approve` call. For important supported assets, the suite should include pinned fork tests for each real token/protocol combination, especially known non-standard tokens such as USDT.
