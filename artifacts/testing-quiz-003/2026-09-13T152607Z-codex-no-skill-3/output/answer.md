# Root cause

The call that fails is:

```solidity
usdt.approve(address(aavePool), amount);
```

Mainnet USDT is an old, non-standard ERC-20 implementation. Its `approve` function does not return a value. OpenZeppelin's `IERC20.approve`, however, declares `returns (bool)`. A normal high-level call through that interface therefore expects ABI-encoded return data. USDT successfully executes its approval logic but returns zero bytes; Solidity cannot decode those zero bytes as a `bool`, so the caller reverts. This ABI-decoding failure commonly appears as an empty revert, which explains the missing reason string. Because the transaction reverts, the approval state change is rolled back as well.

The first line works precisely because it is different:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
```

That invokes `SafeERC20.safeTransferFrom`. `SafeERC20` makes a low-level call and treats empty return data as success, while still requiring a decoded `bool` to be `true` when return data is present. It exists partly to support tokens such as USDT.

`using SafeERC20 for IERC20` only makes the library's explicitly named extension methods available. It does not intercept or alter calls to `transfer`, `transferFrom`, or `approve`. Thus `safeTransferFrom` is protected, but the plain `.approve(...)` call bypasses `SafeERC20` completely.

There is a second USDT allowance quirk worth handling even though the empty-return ABI mismatch is what makes the shown first deposit fail: USDT rejects changing an existing nonzero allowance directly to another nonzero value. It requires setting the allowance to zero first.

# Code fix

With a current OpenZeppelin release, use `forceApprove`:

```solidity
using SafeERC20 for IERC20;

usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` both accepts tokens that return no value and performs the zero-then-set fallback required by USDT when necessary. It is preferable here to a plain `approve` (and to the deprecated `safeApprove`). If the project's pinned OpenZeppelin version predates `forceApprove`, upgrade it or implement the equivalent with OpenZeppelin's optional-return safe-call machinery: safely try the target allowance and, if needed, safely approve zero before safely approving the target value. Merely writing `approve(0); approve(amount);` as ordinary `IERC20` calls is not sufficient, because both calls still have the same empty-return ABI problem.

# Why the tests stayed green

The stock OpenZeppelin `MockERC20` is standard-compliant: its `approve` returns `true`, and its allowance behavior does not reproduce USDT's zero-first restriction. The mock therefore satisfies the exact assumption that is false in production. Running more cases, fuzzing more amounts, or increasing coverage against that same implementation cannot exercise behavior the mock does not implement. Six decimals are irrelevant to this failure; matching metadata is not the same as matching contract semantics.

# Testing-practice fix

Add integration tests on a pinned Ethereum mainnet fork using the actual USDT contract at `0xdAC17F958D2ee523a2206206994597C13D831ec7` and the actual Aave V3 pool/address-provider configuration. Fund or impersonate a USDT holder, approve the vault, execute the complete deposit path, and assert the resulting Aave position. Pinning the block makes the test reproducible. Include consecutive deposits or a deliberately pre-existing nonzero allowance so the test also covers USDT's zero-first rule.

Fast unit tests can continue using `MockERC20`, but they should be supplemented with adversarial token doubles for known ERC-20 deviations (no return data, `false` return values, and zero-first approvals). The fork test is the decisive regression test here because it validates the production token and protocol behavior rather than a locally assumed substitute.
