USDT is the outlier because it does **not** reliably allow changing an existing
non-zero allowance directly to another non-zero allowance. Its `approve`
behavior follows the old "set to zero first, then set the new value" pattern.

That matches the run history exactly:

1. On the first run, the router's allowance to `strategy` was presumably `0`, so
   `approve(strategy, amount)` succeeded.
2. The strategy often spends less than approved, so a leftover allowance remains
   non-zero after the run.
3. On the next run, the router again tries to set a new non-zero allowance while
   the current allowance is still non-zero.
4. USDT rejects that approval change, so the low-level call returns `ok == false`
   and the router reverts at `require(ok, "approve failed")`.

USDC does not enforce that zero-first rule, so repeated runs keep working there.

The minimal router change is to zero the allowance before setting the new one
when refreshing approval. With OpenZeppelin Contracts v5, the cleanest version
is to use `SafeERC20.forceApprove`, which already handles this pattern:

```solidity
using SafeERC20 for IERC20;

IERC20(token).forceApprove(strategy, amount);
```

Equivalent low-level logic would be:

```solidity
(bool ok0, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, 0));
require(ok0, "approve reset failed");

(bool ok1, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
require(ok1, "approve failed");
```

About leftover allowance in general: the router should **not assume** the
previous run consumed the full approval. Any future approval refresh must handle
residual allowance safely. The usual options are:

- always use `forceApprove(strategy, amount)` before each run, or
- explicitly clear allowance back to `0` after the strategy has finished if the
  design wants to avoid leaving standing approval behind.

If the goal is least privilege, clearing the leftover allowance back to zero
after the run is better. But the minimal fix for the current bug is the
zero-first approval refresh.
