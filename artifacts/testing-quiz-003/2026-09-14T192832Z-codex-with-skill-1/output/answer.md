# Why the deposits revert

The revert occurs at:

```solidity
usdt.approve(address(aavePool), amount);
```

Ethereum mainnet USDT predates the modern ERC-20 convention and its `approve` function does not return a `bool`. By contrast, OpenZeppelin's `IERC20.approve` declares a `bool` return value, and the stock `MockERC20` implements that declaration correctly.

Calling `usdt.approve(...)` is a normal high-level Solidity interface call. Against real USDT, the call itself may execute, but it returns empty data. Solidity then tries to ABI-decode that empty data as the `bool` promised by `IERC20`; decoding fails and the caller reverts. That ABI-decoding failure explains the absence of an application-level revert reason.

The first line succeeds because it explicitly uses SafeERC20:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
```

SafeERC20 performs a low-level call and accepts either `true` or no return data, specifically accommodating tokens such as USDT. Merely writing `using SafeERC20 for IERC20` does not intercept or alter every IERC20 method call. It only makes the library's methods available on the value. Thus `safeTransferFrom` is protected, but the direct call to `approve` is not.

USDT also has another approval quirk: changing a non-zero allowance directly to another non-zero allowance is rejected; it must first be set to zero. Even if the empty-return mismatch were handled alone, robust approval code should account for that rule too.

# Code fix

Use SafeERC20's `forceApprove`:

```solidity
using SafeERC20 for IERC20;

usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` handles optional/no return data and, when necessary, performs the USDT-compatible zero-then-set approval sequence. The project must use an OpenZeppelin version that provides `forceApprove`; if it is on an older release, upgrade it or implement the equivalent with SafeERC20 low-level optional-return calls, setting the allowance to zero before setting the desired value. A raw `approve` call is not an adequate substitute.

# Testing-practice fix

Add a pinned Ethereum-mainnet fork integration test that executes the complete deposit path against the deployed USDT at `0xdAC17F958D2ee523a2206206994597C13D831ec7` and the deployed Aave V3 Pool used in production. Fund a test actor with real forked USDT state (for example, by impersonating a known funded account and transferring USDT), approve the vault, deposit, and assert the resulting Aave position/accounting. Pin the block number and use an RPC endpoint that serves that historical state so the test is reproducible.

The existing tests validate the vault against the behavior encoded in `MockERC20` and `MockAavePool`. A stock OpenZeppelin ERC20 always returns a correctly ABI-encoded `bool` and does not reproduce USDT's approval semantics. Therefore every additional test using those same mocks—whether 39 or 39,000—continues to test the same incorrect compatibility assumption. It can improve coverage of vault logic, but it cannot discover behavior absent from the doubles. External integrations and quirky deployed tokens require pinned-fork tests against the real contracts; mocks remain useful for fast unit tests but are not sufficient deployment evidence.
