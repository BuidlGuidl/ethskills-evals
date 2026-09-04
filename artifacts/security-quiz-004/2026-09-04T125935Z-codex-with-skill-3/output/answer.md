USDT is the outlier because its `approve` implementation enforces the old "set to zero before changing to another nonzero allowance" rule. In practice:

1. The first run succeeds because the router starts with `allowance(router, strategy) == 0`, so `approve(strategy, amount)` is a zero-to-nonzero change.
2. The strategy then spends only part of that allowance, so some nonzero allowance remains.
3. On the next run, the router again does `approve(strategy, amount)` while the current allowance is still nonzero.
4. USDT rejects that nonzero-to-nonzero allowance update, so the low-level `call` returns `ok == false` and the router reverts at `require(ok, "approve failed")`.

USDC does not enforce that rule, so repeated nonzero-to-nonzero approvals keep succeeding there.

The minimal fix is to replace the raw low-level approve call with OpenZeppelin v5's `SafeERC20.forceApprove`, which handles this token class by zeroing first when needed.

Example:

```solidity
using SafeERC20 for IERC20;

IERC20(token).forceApprove(strategy, amount);
```

`forceApprove` is the right OZ v5 primitive here specifically because `safeApprove` was removed and this exact compatibility issue is why `forceApprove` exists.

About leftover allowance in general: the router should not assume the previous allowance is harmless. If the strategy only partially spends approval, that residual allowance remains live and can interfere with later approval flows on tokens like USDT. More importantly, leftover allowance is standing authorization, so it should be minimized.

The general policy should be:

- approve only the amount needed for the current run; and
- clear any leftover allowance back to zero when practical after the strategy pull/spend is done, especially if approvals are not intended to stay open.

If the router must support arbitrary ERC-20s and repeated runs, `forceApprove` is the minimal compatibility fix, and zeroing residual allowance after use is the safer allowance hygiene.
