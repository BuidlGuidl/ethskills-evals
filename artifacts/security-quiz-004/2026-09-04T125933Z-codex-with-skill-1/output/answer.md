USDT fails here because its `approve` implementation is intentionally stricter than a standard ERC-20 overwrite.

Reasoning:
- On the first run, the router is changing allowance from `0` to `amount`, so USDT accepts it.
- On later runs, the strategy has usually spent only part of that allowance, so the router is trying to change allowance from `nonzero` to another `nonzero` value.
- USDT rejects that pattern and reverts unless the current allowance is first set to `0`.
- Your low-level call only checks whether the call reverted:

```solidity
(bool ok, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
require(ok, "approve failed");
```

- That is why this trips only on USDT, and only after the first successful run leaves a leftover allowance behind.
- USDC does not enforce the same zero-first rule, so repeated runs keep working there.

Minimal router change:
- Since the repo is already on OpenZeppelin Contracts v5, replace the low-level approval with `SafeERC20.forceApprove`.
- `forceApprove` handles tokens like USDT by zeroing first when needed, and it also tolerates tokens with non-standard return behavior.

Example:

```solidity
using SafeERC20 for IERC20;

IERC20(token).forceApprove(strategy, amount);
```

If you want the equivalent manual logic, it is:
1. If current allowance to `strategy` is nonzero, set it to `0`.
2. Set allowance to `amount`.

What to do about leftover allowance in general:
- Do not rely on leftover allowance across runs.
- Treat allowance as ephemeral: set the exact amount needed for this run, then clear any remaining allowance back to `0` when practical after the strategy has pulled funds.
- Keeping stale leftover allowance is both what triggers the USDT failure mode and a broader permission risk, because the strategy retains spend authority it no longer needs.

So the shortest correct fix is to use `SafeERC20.forceApprove`, and the safer allowance policy is exact-per-run approval with cleanup back to zero rather than carrying leftovers forward.
