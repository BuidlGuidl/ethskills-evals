# Why the USDT deposit reverts

The failing call is the direct approval:

```solidity
usdt.approve(address(aavePool), amount);
```

Mainnet USDT is not a fully standard ERC-20 implementation. In particular, its `approve` function does not return the `bool` declared by OpenZeppelin's `IERC20`. A normal high-level call through `IERC20.approve` therefore expects and ABI-decodes a Boolean return value. USDT returns no data, so that decoding fails and Solidity reverts without a useful reason string. Because the transaction reverts, any approval state change made inside USDT is rolled back as well.

The mock never exposes this incompatibility. OpenZeppelin's stock `ERC20.approve` returns a proper `bool`, exactly as `IERC20` says it should, so the high-level call always decodes successfully. Its six decimals are irrelevant to this failure; matching decimals does not reproduce USDT's call and return behavior.

`using SafeERC20 for IERC20` only makes the library's extension methods available. It does not automatically wrap every ERC-20 call. The first line explicitly calls `safeTransferFrom`, whose low-level optional-return handling accepts both a returned `true` and empty return data, so it works with USDT. The second line explicitly calls the token's ordinary `approve`, bypassing `SafeERC20`, so it receives no such protection.

## Code fix

Use SafeERC20 for the approval too, preferably its USDT-compatible force-approval helper:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` handles tokens with no Boolean return and tokens such as USDT that require an existing nonzero allowance to be reset to zero before setting another nonzero allowance. This is more robust than merely replacing the call with a direct approval or assuming Aave will always consume the allowance completely. With an older OpenZeppelin version that lacks `forceApprove`, perform the same operation with SafeERC20-compatible optional-return calls: try the desired approval and, if necessary, approve zero before approving the desired amount. Upgrading to a version providing `forceApprove` is preferable.

## Testing-practice fix

Add a pinned mainnet-fork integration test that uses the deployed USDT and Aave V3 Pool addresses and executes the complete deposit path with an actually funded and approved depositor. Assert that the deposit succeeds and that the expected Aave position/accounting change occurs. Pinning the block makes the dependency state reproducible, and the RPC endpoint must support historical state at that block.

No number of tests using only the stock `MockERC20` and `MockAavePool` can discover this defect. A mock implements the behavior its author assumed—in this case, standards-compliant Boolean returns—so additional cases merely exercise that same assumption. Fuzzing amounts would not change the return-data shape either. Testing an external protocol and a known quirky token requires at least one fork test against their real deployed bytecode; unit mocks can remain for fast testing of the vault's own logic.
