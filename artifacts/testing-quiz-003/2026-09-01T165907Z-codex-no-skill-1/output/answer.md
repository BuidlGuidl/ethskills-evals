# Why the USDT deposit reverts

The failing call is the direct `approve`, not the preceding transfer:

```solidity
usdt.approve(address(aavePool), amount);
```

Mainnet USDT is a legacy, non-standard ERC-20. Its `approve(address,uint256)` implementation does not return a `bool`, even though `IERC20.approve` declares one. Solidity therefore makes the external call and then tries to ABI-decode a Boolean from the return data. USDT returns no data, so that decode reverts. ABI-decoding failures commonly surface as empty revert data, which explains the missing reason string.

The mock cannot reproduce this behavior. OpenZeppelin's stock `ERC20` is standards-compliant and returns `true` from `approve`, so the decode succeeds. Matching USDT's six decimals matches only its unit scale; it does not reproduce USDT's call/return behavior or its allowance quirks. Running any number of tests against that same mock only explores the mock's implementation, so those tests cannot reveal an incompatibility that the mock does not model.

`using SafeERC20 for IERC20` merely adds the library's extension methods to the type. It does not intercept or rewrite ordinary interface calls. Thus `safeTransferFrom` used SafeERC20's low-level optional-return handling and worked with USDT, while `approve` was still a direct `IERC20.approve` call and retained the strict Boolean ABI decode.

## Code fix

Use SafeERC20 for the allowance operation as well:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` is the robust OpenZeppelin helper for tokens such as USDT: it accepts an empty successful return value and, when necessary, resets an existing nonzero allowance to zero before setting the requested allowance. With an older OpenZeppelin release that lacks `forceApprove`, perform the equivalent operation with SafeERC20-compatible calls: set the allowance to zero and then set it to `amount` (or upgrade OpenZeppelin). A raw `approve` should not be used.

## Testing-practice fix

Add mainnet-fork integration tests, pinned to a known block, using the actual deployed USDT and Aave V3 pool contracts. Fund or impersonate a real USDT holder, execute the complete deposit path, and assert the resulting Aave position/aToken balance. Keep the fast mock unit tests, but do not treat a generic OpenZeppelin ERC-20 mock as a compatibility test for production tokens.

Where fork testing is impractical, add token-faithful adversarial mocks that reproduce non-standard behaviors—especially successful `transfer`/`approve` calls with empty return data and the zero-first allowance rule. The fork test is the decisive pre-deployment check because it exercises the exact token and protocol implementations and their real integration semantics.
