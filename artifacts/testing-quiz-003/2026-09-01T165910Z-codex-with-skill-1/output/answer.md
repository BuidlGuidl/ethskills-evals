# Why the USDT deposit reverts

The failing call is `usdt.approve(...)`, not the preceding transfer. Mainnet USDT is an old, non-standard ERC-20 implementation whose `approve` function does not return the `bool` required by the `IERC20` interface.

Because `usdt` is typed as `IERC20`, this expression:

```solidity
usdt.approve(address(aavePool), amount);
```

is compiled as a normal high-level Solidity call that expects ABI-encoded return data for a `bool`. USDT executes its approval logic but returns no data. Solidity then tries to decode the empty return data as a `bool` and reverts. That ABI-decoding failure commonly has no reason string.

The stock OpenZeppelin `MockERC20` is standards-compliant: its `approve` returns `true`. It therefore satisfies the ABI assumed by `IERC20`, so the mock can never reproduce this behavior regardless of how many amounts or call sequences are tested against that same mock. More tests only exercise the mock's semantics; they do not test the deployed token's bytecode and non-standard return behavior.

`SafeERC20` protected the first line because it was actually invoked there:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
```

`SafeERC20` performs a low-level call and treats either no return data or an encoded `true` as success. The declaration

```solidity
using SafeERC20 for IERC20;
```

only adds the library's extension methods to `IERC20`; it does not intercept or change calls to the original `IERC20.approve` method. Thus the raw `.approve(...)` call received none of `SafeERC20`'s compatibility handling.

## Code fix

With a current OpenZeppelin version, use `forceApprove`:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` uses optional-return handling, so USDT's empty return is accepted. It also supports tokens such as USDT that require an existing non-zero allowance to be set to zero before another non-zero allowance is written: if the direct approval fails, it approves zero and then the requested amount. This is more robust than replacing the line with a raw zero-then-amount sequence.

On an older OpenZeppelin release without `forceApprove`, use the corresponding `SafeERC20` optional-return approval helper and explicitly reset the allowance to zero before setting the new value, or upgrade OpenZeppelin. The important requirements are that both approvals go through optional-return-safe low-level calls and that the zero-first rule is handled.

## Testing-practice fix

Add a Foundry mainnet-fork integration test that uses the actual deployed USDT and Aave V3 Pool contracts, preferably at a pinned block. Fund a test user with real USDT state (for example by impersonating a funded holder, or with a correctly supported `deal` setup), approve the vault, and execute the complete deposit path. Assert that Aave receives the supplied assets or that the vault receives the expected aToken balance.

Keep the mock unit tests for fast testing of the vault's own logic, but do not use them as evidence that integrations are compatible. Every external-protocol and real-token integration should have a fork test against the exact production addresses. Such a test executes USDT's real bytecode, so the original raw `approve` would have failed before deployment and the `forceApprove` version would pass.
