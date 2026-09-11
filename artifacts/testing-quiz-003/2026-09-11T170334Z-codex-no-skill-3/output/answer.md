# Why the USDT deposit reverts

The failing call is the raw `approve`, not the preceding transfer and most likely not `AavePool.supply`:

```solidity
usdt.approve(address(aavePool), amount);
```

Mainnet USDT predates the modern ERC-20 conventions. Its `approve` function does not return a Boolean value, even though `IERC20.approve` declares `returns (bool)`. Calling it through `IERC20` makes Solidity expect ABI-encoded return data. USDT executes the state change but returns no data, so Solidity's return-data decoding reverts the transaction without a reason string. Because the whole transaction is reverted, the approval state change is rolled back as well.

The mock never exposes this problem because OpenZeppelin's stock `ERC20` is standards-conforming: its `approve` returns `true`. Matching USDT's six decimals only matches denomination; it does not reproduce USDT's non-standard call behavior. Repeating or expanding tests against that same conforming mock cannot reveal an incompatibility that the mock does not model.

`using SafeERC20 for IERC20` does not automatically make every token call safe. It only adds the library's explicitly named extension methods. The first line calls `safeTransferFrom`, so `SafeERC20` performs a low-level call and accepts either `true` or empty return data. The second line calls `approve` directly, bypassing `SafeERC20`, so normal Solidity ABI return decoding is still used.

USDT also requires an existing nonzero allowance to be set to zero before it can be changed to another nonzero value. The robust code fix, with a current OpenZeppelin version, is therefore:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` handles tokens that return no value and, when necessary, performs the zero-then-set allowance sequence required by USDT. With an older OpenZeppelin release that lacks `forceApprove`, the equivalent is to use `SafeERC20` calls to set the allowance to zero and then to `amount`; a raw `approve` must not be used.

The testing fix is a mainnet-fork integration test pinned to a known block, using the actual USDT contract and the actual Aave V3 pool. Fund or impersonate a holder, call the vault's real deposit path, and assert the resulting Aave position. Unit tests should additionally include adversarial token doubles for common ERC-20 deviations—especially no-return tokens and zero-first approval tokens—but such mocks supplement rather than replace the fork test. A fork test would have exercised USDT's deployed bytecode and caught this exact failure before deployment.
