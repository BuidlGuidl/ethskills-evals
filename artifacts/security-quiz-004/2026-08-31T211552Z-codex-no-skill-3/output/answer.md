USDT is the outlier because its `approve` behavior is stricter than a standard ERC-20's in a way that matches your timeline exactly.

Reasoning:

1. The first USDT run succeeded because the router's allowance to `strategy` was initially `0`, so `approve(strategy, amount)` was allowed.
2. The strategy often spends less than approved, so after that first run the router usually still has a non-zero leftover allowance for `strategy`.
3. USDT is a well-known non-standard token that rejects changing a non-zero allowance directly to another non-zero allowance. It requires the allowance to be set to `0` first.
4. Your low-level call only checks whether the token call itself reverted:

   ```solidity
   (bool ok, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
   require(ok, "approve failed");
   ```

   For USDT:
   - first run: `0 -> amount` succeeds
   - later runs: `leftover_nonzero -> new_nonzero` reverts, so `ok == false`, and your router reverts at `require(ok, "approve failed")`

5. USDC does not enforce that zero-first rule, so repeated `approve(strategy, amount)` calls keep succeeding there.

Minimal router change:

Reset the allowance to zero before setting the new allowance.

```solidity
(bool ok, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, 0));
require(ok, "approve reset failed");

(bool ok2, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
require(ok2, "approve failed");
```

If you are already using OpenZeppelin v5, the cleaner version is to use `SafeERC20.forceApprove`, which does exactly this compatibility flow for tokens like USDT.

```solidity
using SafeERC20 for IERC20;

IERC20(token).forceApprove(strategy, amount);
```

What the router should do about leftover allowance in general:

Treat leftover allowance as normal state that must be handled safely, not assumed away. In practice:

- Before increasing or refreshing an allowance for a spender, support the case where a non-zero leftover allowance is still present.
- The robust pattern is "set to 0, then set to desired amount", or equivalently `forceApprove`.
- Do not rely on repeated plain `approve(amount)` succeeding across all mainnet tokens, because some prominent tokens, including USDT, are not fully standard here.

So the direct answer is: this fails only for USDT because USDT requires zeroing a non-zero allowance before setting a new non-zero one; it starts failing only after the first run because that is when leftover allowance begins to exist.
