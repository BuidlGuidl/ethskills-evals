# Why the mainnet deposit reverts

The failing call is the raw `approve`:

```solidity
usdt.approve(address(aavePool), amount);
```

Mainnet USDT is a legacy, non-standard ERC-20. Its `approve` function does not return the ABI-encoded `bool` that `IERC20.approve` declares. Because the call is made through `IERC20`, Solidity expects and decodes a 32-byte Boolean return value. USDT returns no data, so the caller's generated ABI return-data check/decoder reverts. That low-level return-data mismatch need not contain a reason string. The revert also rolls back the approval, so `aavePool.supply` is never reached.

The OpenZeppelin `MockERC20` does return `true` from `approve`, exactly as the interface says it should. It therefore cannot reproduce this behavior. Its six decimals are irrelevant: decimals affect display and amount scaling, not the ABI return value of `approve`.

`using SafeERC20 for IERC20` only adds explicitly selected library methods; it does not intercept or replace ordinary interface calls. Thus `usdt.safeTransferFrom(...)` uses `SafeERC20` and accepts either a returned `true` or empty return data, which is why the first line works. `usdt.approve(...)` is still a direct `IERC20.approve` call and receives no such protection.

## Code fix

Use the SafeERC20 wrapper for the approval as well. With a recent OpenZeppelin version, the robust form is:

```solidity
using SafeERC20 for IERC20;

usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` handles tokens that return no value and tokens such as USDT that require an existing nonzero allowance to be reset to zero before setting another nonzero allowance. If the installed OpenZeppelin version predates `forceApprove`, upgrade it. Alternatively, perform the zero-reset and new approval through SafeERC20-compatible optional-return calls; do not fall back to raw `IERC20.approve`.

Another valid allowance strategy is to establish a sufficiently large allowance once with `forceApprove` and reuse it, provided that persistent approval is acceptable in the protocol's trust model.

## Testing-practice fix

Add a pinned mainnet-fork integration test using the deployed USDT and Aave V3 contracts, in addition to the fast mock unit tests. Deploy/configure the vault on that fork, obtain real USDT state by impersonating a funded holder (or otherwise fund an actor reliably), approve the vault, execute a deposit, and assert the resulting Aave position/aToken balance and vault accounting.

For example, the fork setup should select an explicit block:

```solidity
vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), PINNED_BLOCK);
```

The RPC endpoint must support archive state at that block. Pinning makes the test reproducible.

No number of tests against the current mocks could reveal this defect. A mock is an executable statement of the assumptions used to write it: here, that ERC-20 methods follow the standard ABI and return `bool`. Adding more inputs, fuzz cases, or repetitions still exercises the same conforming implementation. Only a fork test against the actual deployed token—or a deliberately adversarial non-standard-token mock written to reproduce empty return data and USDT's allowance rules—can search this compatibility boundary. For this integration, the pinned fork test is the decisive pre-deployment check; the adversarial mock is a useful fast regression test, not a substitute for it.
