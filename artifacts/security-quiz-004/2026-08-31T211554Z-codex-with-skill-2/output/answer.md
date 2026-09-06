The failure pattern matches USDT's well-known approval behavior.

Reasoning:

1. The first USDT run succeeds because the router starts with `allowance(router, strategy) == 0`, so `approve(strategy, amount)` is a zero-to-nonzero approval.
2. Later runs fail because the strategy often spends less than it was approved for, so a nonzero leftover allowance remains.
3. USDT does not allow changing an existing nonzero allowance directly to another nonzero allowance. It requires setting the allowance to zero first, then setting the new value.
4. Your low-level call only checks whether the token call reverted:

```solidity
(bool ok, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
require(ok, "approve failed");
```

For USDT after the first run, that `approve(strategy, amount)` call itself reverts because the current allowance is still nonzero, so `ok == false` and the router stops at `require(ok, "approve failed")`.
5. USDC does not enforce that zero-first rule, so repeated approvals continue to succeed there.

Minimal router change:

Since the repo is already on OpenZeppelin Contracts v5, replace the low-level approval with `SafeERC20.forceApprove`, which is specifically meant to handle tokens like USDT.

```solidity
using SafeERC20 for IERC20;

IERC20(token).forceApprove(strategy, amount);
```

`forceApprove` first tries the normal approval. If that fails, it falls back to `approve(spender, 0)` and then `approve(spender, value)`, which fixes the USDT case without you needing to hand-roll low-level logic.

What the router should do about leftover allowance in general:

- Do not assume the next exact-amount approval can overwrite a leftover allowance.
- In general, approvals should be for the exact amount needed, and stale allowance should not be left sitting around longer than necessary.
- Practically, that means either:
  - use `forceApprove(strategy, amount)` before each run, which safely resets when needed, and/or
  - clear any leftover allowance back to zero after the strategy is done spending, if your flow allows that.

The safest general rule is: avoid persistent leftover allowance where possible, and when resetting allowance for another run, handle the nonzero-to-nonzero case explicitly. On OpenZeppelin v5, `forceApprove` is the minimal correct fix.
