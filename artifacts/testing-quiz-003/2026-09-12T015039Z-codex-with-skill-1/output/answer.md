# Why the USDT deposit reverts

The failing call is the direct `approve`:

```solidity
usdt.approve(address(aavePool), amount);
```

Mainnet USDT is an old, non-standard ERC-20 implementation. Its `approve` call does not return the ABI-encoded `bool` that `IERC20.approve` declares. Solidity therefore makes the external call, receives empty return data, and then fails while decoding that data as a `bool`. This ABI-decoding failure commonly surfaces with no reason string.

The OpenZeppelin mock cannot reproduce this behavior. A stock `ERC20` implements the modern interface and returns `true` from `approve`, so the same high-level call decodes successfully. Six decimals are irrelevant to this failure.

The preceding transfer works precisely because it is written as:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
```

`SafeERC20` performs a low-level call and treats empty return data as success, while still requiring a decoded `bool` to be true when return data is present. That accommodates tokens such as USDT.

`using SafeERC20 for IERC20` only makes the library's explicitly named extension methods available. It does not intercept or rewrite ordinary `IERC20` calls. Thus `safeTransferFrom` uses the compatibility wrapper, but `approve` remains a direct high-level interface call and receives no protection from `SafeERC20`.

## Code fix

With a current OpenZeppelin version, use `forceApprove`:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` handles optional/non-standard return data and also supports tokens such as USDT that may require an existing nonzero allowance to be set to zero before another nonzero allowance is assigned. It is more robust than merely replacing the call with a raw low-level call. On an older OpenZeppelin release without `forceApprove`, upgrade OpenZeppelin or implement the equivalent SafeERC20-style operation: try the requested approval, and if it fails, safely approve zero and then safely approve the requested amount.

## Testing-practice fix

Add a mainnet-fork integration test pinned to a specific block. The test must exercise the deployed USDT contract and the real Aave V3 pool through the vault's actual deposit path, using an account funded with USDT and with the required approval to the vault. It should assert that the deposit succeeds and that the expected Aave position/accounting is created.

The mock suite should remain for fast unit tests, but it cannot validate integration compatibility. A mock is an executable version of the assumptions used to write it. Here it assumes standards-compliant ERC-20 return data, while the real token violates that assumption. Adding more cases, fuzzing more amounts, or reaching 100% coverage against the same mock only repeats the same incorrect dependency model; none changes the mock's `approve` return-data shape. A pinned fork would execute the real bytecode and would have reproduced the empty-return decoding revert before deployment.
