# Why the USDT deposit reverts

The failure is the raw `approve` call:

```solidity
usdt.approve(address(aavePool), amount);
```

Mainnet USDT is a legacy ERC-20 implementation. Its state-changing token functions do not behave exactly like a modern OpenZeppelin `ERC20`: in particular, its `approve` call does not return the ABI-encoded `bool` that `IERC20.approve` declares. Solidity therefore tries to decode an empty return value as a `bool` and reverts. That ABI decoding failure commonly has no reason string.

The preceding transfer succeeds because it is a different kind of call:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
```

`safeTransferFrom` is supplied by `SafeERC20`. It performs a low-level call and accepts either an explicit `true` return value or no return data, specifically to support tokens such as USDT.

`using SafeERC20 for IERC20` does not automatically wrap every method on the token. It only adds the library's named extension methods. Calling `usdt.approve(...)` still invokes `IERC20.approve` directly, so none of `SafeERC20`'s optional-return handling protects that line.

The OpenZeppelin `MockERC20` never exposes the problem because it is a standards-conforming implementation whose `approve` returns `true`. More assertions and more test cases against that same mock only exercise the mock's behavior; they cannot discover behavior the mock does not model. Matching USDT's six decimals models denomination, not its ABI quirks. A specially written USDT-like mock could reproduce the issue, but the stock mock cannot.

## Code fix

Use the `SafeERC20` allowance helper rather than raw `approve`:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` handles tokens that return no value and also supports USDT's other well-known allowance rule: changing a nonzero allowance to another nonzero allowance may require first setting it to zero. It is therefore preferable here to merely replacing `approve` with an optional-return wrapper. If the project's OpenZeppelin version predates `forceApprove`, use safe optional-return calls to approve zero and then approve `amount`, or upgrade OpenZeppelin.

An alternative architecture is to establish the pool's maximum allowance once with `forceApprove` and reuse it, subject to the project's allowance-risk policy.

## Testing-practice fix

Add a mainnet-fork integration test pinned to a known block and run the deposit path against the actual deployed USDT and Aave V3 pool contracts. Fund the test account with USDT using fork test facilities, approve the vault, deposit, and assert that Aave receives/supplies the assets.

Keep the fast mock unit tests, but do not treat a generic OpenZeppelin ERC-20 mock as compatibility coverage for production tokens. For supported assets, test against their real deployed bytecode on a fork (and optionally maintain adversarial token mocks for no-return values, false returns, zero-first approvals, fees, rebasing, and other relevant behaviors). The fork test would have exercised USDT's real return-data and allowance semantics and failed before deployment.
