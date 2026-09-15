# Why the USDT deposit reverts

The failing call is the direct `approve`:

```solidity
usdt.approve(address(aavePool), amount);
```

Ethereum mainnet USDT predates the ERC-20 conventions implemented by OpenZeppelin's `ERC20`. In particular, its `approve` does not return the ABI-encoded `bool` that `IERC20.approve` declares. Solidity therefore performs a normal high-level call and then tries to decode a `bool` from empty return data. That ABI decoding fails, producing a revert with no token reason string. Execution never reaches `aavePool.supply`.

The mock never exposes this because stock OpenZeppelin `ERC20.approve` is fully conforming and returns `true`. Giving it six decimals reproduces USDT's denomination, but not USDT's non-standard call/return behavior. More tests against the same conforming mock only exercise the same false assumption; test count and coverage cannot compensate for an inaccurate test double.

The first line succeeds for exactly this reason:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
```

`safeTransferFrom` is an actual `SafeERC20` wrapper. It makes a low-level call and treats either no return data or an ABI-encoded `true` as success, while still reverting for `false` or a failed call. By contrast, `using SafeERC20 for IERC20` merely adds the library's functions to values of that type. It does not intercept or rewrite the native `approve` method, so `usdt.approve(...)` receives no protection from `SafeERC20`.

## Code fix

Use the SafeERC20 allowance wrapper too. With a current OpenZeppelin release, the robust form is:

```solidity
usdt.safeTransferFrom(msg.sender, address(this), amount);
usdt.forceApprove(address(aavePool), amount);
aavePool.supply(address(usdt), amount, address(this), 0);
```

`forceApprove` accepts tokens that return no value and also handles USDT-like tokens that require an existing nonzero allowance to be reset to zero before setting another nonzero allowance. This is preferable to a direct `approve`. If the project's OpenZeppelin version predates `forceApprove`, upgrade it or implement the equivalent with SafeERC20 low-level optional-return calls: try approving the requested amount and, if that fails, safely approve zero and then safely approve the requested amount. A version's deprecated `safeApprove` can handle missing return data, but its allowance-transition restrictions make `forceApprove` the clearer general fix.

## Testing-practice fix

Add an integration test on a mainnet fork, pinned to a known block, using the real USDT contract and the real Aave V3 pool. Fund or impersonate a USDT holder, approve the vault, deposit, and assert the resulting Aave position. That test exercises the actual bytecode, return-data shape, allowance rules, and pool interaction and would have failed at the direct `approve` before deployment.

Keep fast mock-based unit tests, but supplement them with fork tests for every production token/protocol combination whose deployed behavior matters. It is also useful to add adversarial token doubles—such as a no-return ERC-20 and a zero-first-approval ERC-20—but those only catch quirks already anticipated. A pinned-fork integration test is what validates compatibility with the concrete deployed USDT and Aave contracts rather than with an idealized ERC-20 model.
