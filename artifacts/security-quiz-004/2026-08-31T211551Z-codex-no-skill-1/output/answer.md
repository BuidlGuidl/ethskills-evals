USDT is the outlier because its `approve` behavior is non-standard: if the current allowance is non-zero, it does not allow changing it directly to another non-zero value. In practice, you must first set the allowance to `0`, then set the new value.

That matches the run history exactly:

1. The first USDT run succeeded because the router's allowance to the strategy started at `0`, so `approve(strategy, amount)` was allowed.
2. The strategy then spent less than `amount`, leaving a non-zero leftover allowance.
3. On the next run, the router again tried `approve(strategy, amount)` while the existing allowance was still non-zero.
4. USDT rejects that transition, so the low-level call returns `ok == false`, and `require(ok, "approve failed")` reverts.

USDC does not enforce that zero-first rule, so repeated non-zero-to-non-zero approvals keep working there.

The minimal router change is to stop doing the raw low-level `approve` call and use OpenZeppelin v5's USDT-compatible helper:

```solidity
using SafeERC20 for IERC20;

IERC20(token).forceApprove(strategy, amount);
```

That is the smallest correct fix on `@openzeppelin/contracts` v5. `forceApprove` handles tokens like USDT by zeroing the allowance first when needed, then setting the requested value.

If you want the equivalent logic spelled out, it is:

```solidity
IERC20 erc20 = IERC20(token);
if (erc20.allowance(address(this), strategy) != 0) {
    erc20.approve(strategy, 0);
}
erc20.approve(strategy, amount);
```

But on OZ v5, `forceApprove` is the better minimal change because it already encapsulates this compatibility behavior safely.

About leftover allowance in general: do not assume you can overwrite a leftover non-zero allowance with another non-zero allowance on every token. The router should treat leftover allowance as state that must be reconciled before setting a new approval. In practice, that means either:

- always use `forceApprove(strategy, amount)` before the run, or
- explicitly zero the allowance before setting a new one.

If the intended security model is "approve exactly what this run may spend," then leftover allowance should not be left sitting around indefinitely; it should be reset to `0` after the strategy is done, or the next approval path must always normalize it first. The key point is that leftover allowance is not harmless bookkeeping for USDT-like tokens: it directly causes the next non-zero approval to fail.
