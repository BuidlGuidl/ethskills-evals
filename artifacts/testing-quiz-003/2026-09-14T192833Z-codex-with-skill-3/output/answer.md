# Why the USDT deposit reverts

The failing statement is the raw approval:

```solidity
usdt.approve(address(aavePool), amount);
```

Mainnet USDT is a legacy ERC-20 implementation whose `approve` function does not return an ABI-encoded `bool`. The `IERC20` interface says that it does, so Solidity makes the call and then attempts to decode a boolean from the returned bytes. USDT returns no bytes. That ABI decoding fails, causing a revert with no token-provided reason string. Execution therefore never reaches `aavePool.supply`.

The preceding transfer succeeds for exactly the reason that `SafeERC20` exists:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
```

`safeTransferFrom` performs a low-level call and treats empty return data as success; if return data is present, it requires it to decode to `true`. But `using SafeERC20 for IERC20` only adds library methods to the type. It does not intercept or change ordinary interface calls. Calling `usdt.approve(...)` directly bypasses `SafeERC20`, so Solidity applies the `IERC20` return-data expectation and reverts while decoding USDT's empty response.

The OpenZeppelin `MockERC20` is standards-conforming and returns `true` from `approve`. It therefore cannot reproduce this behavior. Thirty-nine tests—or any number of additional tests—against that same mock only explore the behavior encoded in the mock. They cannot discover an integration difference the mock does not model. A specially written USDT-faithful mock could produce a regression test after the issue is understood, but it is still an assumption about deployed code rather than integration evidence.

## Code fix

Use the `SafeERC20` approval helper as well:

```solidity
using SafeERC20 for IERC20;

usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` is the preferred current OpenZeppelin helper for tokens such as USDT. It accepts optional/empty return data and, when necessary, handles tokens that require an existing nonzero allowance to be reset to zero before a new nonzero allowance is set. If the project's OpenZeppelin version predates `forceApprove`, upgrade it or implement the equivalent safe zero-then-set flow using optional-return low-level calls; do not replace this with another raw `approve` call.

## Testing-practice fix

Add a Foundry integration test on a **pinned mainnet fork** using the actual deployed USDT and Aave V3 pool, and exercise the complete deposit path:

```solidity
vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
```

Give a test actor real USDT state (for example, by impersonating a funded holder and transferring tokens), have that actor approve the vault, call `deposit`, and assert that the deposit succeeds and the expected Aave position/balance is created. The RPC endpoint must support historical state at the pinned block.

Keep the fast mock unit tests, but do not use them as proof that an external integration is deployable. A pinned-fork test against the real token and protocol would have executed USDT's actual return-data behavior and failed at the raw approval before mainnet deployment. A USDT-like mock is useful as a permanent focused regression test, while the fork test is what validates the real integration.
