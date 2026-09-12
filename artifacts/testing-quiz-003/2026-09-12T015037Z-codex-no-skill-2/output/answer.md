# Root cause

The failing call is the raw `approve`, not `supply`:

```solidity
usdt.approve(address(aavePool), amount);
```

Mainnet USDT is an old, non-standard ERC-20. In particular, its `approve` does not return the `bool` declared by OpenZeppelin's `IERC20`. A Solidity high-level call through `IERC20.approve` therefore tries to ABI-decode a Boolean from empty return data and reverts. That revert has no token-provided reason string, which explains the empty revert data. The approval and the earlier transfer are then rolled back with the whole transaction.

USDT also has the well-known approval rule that an existing nonzero allowance must be set to zero before it can be changed to another nonzero value. Approval code should account for both quirks.

The first line works because it actually invokes the SafeERC20 wrapper:

```solidity
usdt.safeTransferFrom(...);
```

SafeERC20 treats empty return data as success and only rejects a returned value when it explicitly decodes to `false`. By contrast, `using SafeERC20 for IERC20` merely makes library functions available as methods; it does not intercept or rewrite ordinary IERC20 calls. `usdt.approve(...)` still calls the interface method directly, so SafeERC20 never protects it.

The stock OpenZeppelin MockERC20 is standards-conforming: `approve` returns `true` and does not reproduce USDT's zero-first allowance behavior. MockAavePool likewise cannot add the behavior missing from the token mock. Running more tests against those same implementations only explores their semantics, so no number of such tests can reveal an incompatibility they do not model.

# Code fix

Use SafeERC20 for the approval too. With an OpenZeppelin version that provides `forceApprove`:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` accepts tokens that return no value and, when necessary, performs the USDT-compatible sequence of approving zero before approving the requested amount. A common alternative is to establish an unlimited allowance once with `forceApprove`; that also avoids resetting approval on every deposit, provided the vault's allowance policy accepts that tradeoff.

On an older OpenZeppelin release without `forceApprove`, use SafeERC20 low-level calls and explicitly perform the zero-then-amount sequence (for example, `safeApprove(pool, 0)` followed by `safeApprove(pool, amount)`, where that release still exposes `safeApprove`). Do not replace the line with another raw `IERC20.approve` call.

# Testing-practice fix

Add a mainnet-fork integration test pinned to a known block, using the real USDT contract and the real Aave V3 Pool. Fund or impersonate an account holding USDT, deposit through the vault, and assert that Aave receives the supply and the vault gets the expected position. Include repeated deposits so allowance-update behavior is exercised.

Fast unit tests should remain, but add adversarial token mocks for known ERC-20 deviations as well: no return data, `false` return values, and zero-first approvals. The fork test is the decisive pre-deployment check here because it validates the exact deployed token and protocol behavior rather than assuming that `IERC20` conformance makes all ERC-20 deployments interchangeable.
