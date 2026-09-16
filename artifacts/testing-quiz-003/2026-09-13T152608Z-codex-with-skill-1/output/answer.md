# Why the mainnet deposit reverts

The failing call is:

```solidity
usdt.approve(address(aavePool), amount);
```

Mainnet USDT predates the behavior expected by the standard OpenZeppelin `ERC20` implementation. In particular, its `approve` function does not return an ABI-encoded `bool`. Because `usdt` is statically typed as `IERC20`, Solidity compiles the direct call as though a `bool` must be returned. The token call returns empty data, and Solidity's return-data decoding therefore reverts. That ABI-decoding failure commonly has no reason string. The transaction is atomic, so even if USDT changed the allowance before returning, the revert rolls that change back and `aavePool.supply` is never reached.

The mock never exposes this because OpenZeppelin's stock `ERC20.approve` is standards-conforming and returns `true`. Its behavior therefore matches the `IERC20` declaration exactly, whereas the declaration does not make the real USDT implementation conform to it. The mock's six decimals are irrelevant to this failure.

`using SafeERC20 for IERC20` only adds the library's explicitly named extension methods; it does not intercept or rewrite ordinary `IERC20` calls. Thus `usdt.safeTransferFrom(...)` uses `SafeERC20` and tolerates empty return data, which is why that line succeeds, but `usdt.approve(...)` calls USDT directly and receives none of SafeERC20's compatibility handling.

## Code fix

Use SafeERC20 for the allowance operation as well. With an OpenZeppelin version that provides it, the robust fix is:

```solidity
using SafeERC20 for IERC20;

usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` both accepts tokens that return no value and handles USDT-style allowance rules by falling back to setting the allowance to zero before setting the requested nonzero value. This is safer than replacing the line with a raw `approve`, and more generally correct than relying on a nonzero allowance always having been consumed completely. On an older OpenZeppelin release without `forceApprove`, perform the equivalent zero-then-value sequence through SafeERC20's optional-return-aware allowance functions, or upgrade OpenZeppelin.

## Testing-practice fix

Keep the mock unit tests for local logic, but add a pinned-mainnet-fork integration test for the actual external boundary. The test should deploy/configure the vault against the real mainnet USDT and Aave V3 Pool contracts, fund or impersonate a USDT holder, approve the vault, execute a real deposit, and assert the resulting vault/Aave position. Pin a block and use an archive-capable RPC endpoint so the test is reproducible.

No number of additional tests against the same stock OpenZeppelin mock could reveal this defect: a mock encodes the assumption that `approve` returns a standard `bool`, so every such test repeats that assumption. A deliberately USDT-compatible nonstandard mock could serve as a regression test after the issue is known, but it is not a substitute for the pinned-fork test that exercises the deployed token and protocol behavior before mainnet deployment.
