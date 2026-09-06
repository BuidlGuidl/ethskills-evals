USDT fails here because it keeps the old ERC-20 allowance behavior: if the current allowance is non-zero, `approve(spender, newAmount)` reverts unless the new amount is zero first.

That matches the run history exactly:

1. On the first USDT run, the router's allowance to `strategy` was `0`, so `approve(strategy, amount)` succeeded.
2. The strategy then spent only part of that approval.
3. A leftover non-zero allowance remained.
4. On the next run, the router tried to do another direct `approve(strategy, amount)` from non-zero to non-zero.
5. USDT reverted inside `approve`, so the low-level call returned `ok == false`, and the router hit `require(ok, "approve failed")`.

USDC does not enforce that zero-first rule, so repeated approvals keep working there.

The low-level call is not the real issue. It only avoided return-data decoding problems. The revert is coming from USDT's allowance policy.

Minimal router change

Before setting the new approval amount, clear any existing allowance to zero.

```solidity
(bool ok0, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, 0));
require(ok0, "approve reset failed");

(bool ok1, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
require(ok1, "approve failed");
```

If you want the OpenZeppelin v5 version, use `SafeERC20.forceApprove`, which exists for exactly this class of token:

```solidity
using SafeERC20 for IERC20;

IERC20(token).forceApprove(strategy, amount);
```

What the router should do about leftover allowance in general

It should not assume the previous allowance was fully consumed. For safety and compatibility, treat residual allowance as normal and explicitly overwrite approvals in a way that works for zero-first tokens:

- either always `approve(0)` and then `approve(amount)`, or
- use `SafeERC20.forceApprove`.

That handles USDT correctly and keeps the router compatible with standard tokens too.

More generally, the leftover allowance should be minimized rather than ignored. Since the strategy often spends less than approved, the router should grant only the exact amount needed for that run, and on the next run reset/replace the allowance instead of stacking another approval on top of the old one.
