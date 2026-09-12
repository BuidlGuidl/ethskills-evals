# Why the USDT deposit reverts

Mainnet USDT is not a fully conforming `IERC20`. In particular, its legacy `approve` implementation succeeds without returning the `bool` value required by the ERC-20 interface.

The direct call

```solidity
usdt.approve(address(aavePool), amount);
```

is compiled from the declared type, `IERC20`, so Solidity expects and ABI-decodes a 32-byte Boolean return value. Real USDT returns zero bytes. The token call itself may have completed, but the caller then fails while decoding the empty return data, producing the observed revert without a reason string.

The preceding `safeTransferFrom` succeeds for exactly the same non-standard behavior because that call actually goes through `SafeERC20`. `SafeERC20` makes a low-level call and treats empty return data as success; if return data is present, it requires it to decode to `true`.

`using SafeERC20 for IERC20` only makes the library's extension methods available on an `IERC20` value. It does not replace or intercept the interface's own methods. Thus `usdt.safeTransferFrom(...)` is protected, while `usdt.approve(...)` is still a raw high-level `IERC20` call.

The OpenZeppelin `MockERC20` follows the standard interface and returns `true` from `approve`, so it cannot reproduce this failure. A mock is an executable version of the assumptions made about the dependency. Adding more tests against the same standards-compliant mock merely exercises more inputs against the same incorrect assumption; it cannot discover behavior the mock does not implement.

## Code fix

With a current OpenZeppelin SafeERC20 version, use `forceApprove`:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` both tolerates tokens that return no value and supports USDT-style approval semantics that may require resetting a nonzero allowance to zero before assigning another nonzero value. This is safer than merely replacing the line with a raw zero-then-nonzero pair, because raw `approve` calls would still have the empty-return decoding problem.

For an older OpenZeppelin release that predates `forceApprove`, use that release's SafeERC20 approval helper (or perform the zero-then-value approvals through SafeERC20's optional-return low-level-call logic), and account for USDT's zero-reset rule. Upgrading to a compatible release and using `forceApprove` is the clearest fix.

## Testing-practice fix

Keep the mock unit tests for fast testing of vault logic, but add a pinned Ethereum-mainnet fork integration test that uses the real USDT contract and the real Aave V3 pool. Fund a test actor with USDT on the fork, approve the vault, execute a deposit, and assert the resulting Aave position/vault accounting.

That test crosses the actual ABI boundary and therefore reproduces USDT's empty return data and approval behavior. Pinning the fork block makes the test deterministic; the RPC endpoint must support historical state at that block. External protocol integrations and known non-standard tokens require this kind of fork test before deployment—green mock tests alone are not deployment evidence for compatibility with the deployed contracts.
