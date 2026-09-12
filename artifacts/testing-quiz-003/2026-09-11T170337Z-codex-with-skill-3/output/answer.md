# Why the USDT deposit reverts

Mainnet USDT is not a fully conforming `IERC20`. In particular, its legacy implementation does not return a Boolean value from calls such as `approve`, even though `IERC20.approve` declares `returns (bool)`.

The first call succeeds because it actually uses SafeERC20:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
```

SafeERC20 makes a low-level call and accepts either `true` return data or no return data. The empty return from USDT is therefore treated as success.

The next call does **not** use SafeERC20:

```solidity
usdt.approve(address(aavePool), amount);
```

`using SafeERC20 for IERC20` only adds the library's explicitly invoked methods; it does not intercept or change ordinary `IERC20` method calls. This remains a high-level Solidity call through the `IERC20` ABI. After USDT successfully executes `approve` but returns no data, Solidity tries to decode the declared `bool` from an empty byte array and reverts during ABI decoding. That decoding failure commonly has no reason string. Execution consequently never reaches `aavePool.supply`.

The OpenZeppelin mock always returns the standards-compliant Boolean expected by `IERC20`, so it cannot reproduce the failure. More tests using that same mock would only exercise the same incorrect assumption more times. Test count, coverage, fuzzing, and additional deposit values cannot discover behavior that the dependency model does not implement.

## Code fix

Use SafeERC20 for the approval as well. With current OpenZeppelin versions, the robust form is:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` tolerates tokens that return no value and also handles USDT-like tokens that require an existing nonzero allowance to be reset to zero before setting another nonzero allowance. In an older OpenZeppelin release that lacks `forceApprove`, use the SafeERC20 approval helper available in that version (or safe zero-then-set calls), rather than calling `IERC20.approve` directly:

```solidity
usdt.safeApprove(address(aavePool), 0);
usdt.safeApprove(address(aavePool), amount);
```

The zero-first form matters if an earlier operation can leave a residual allowance.

## Testing-practice fix

Keep mocks for fast unit tests, but add a pinned mainnet-fork integration test that uses the real USDT contract and the real Aave V3 Pool. Fund or impersonate a USDT holder, approve the vault, execute a deposit, and assert the resulting vault accounting and Aave position/aToken balance. Pin a block and use an RPC endpoint that serves its historical state so the test is deterministic.

That test would have exercised USDT's real return-data behavior and failed at the direct `approve` before deployment. For integrations with deployed protocols or known nonstandard tokens, a fork test is required evidence; standards-compliant mocks alone are not an adequate substitute.
