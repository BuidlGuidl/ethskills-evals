The failure pattern matches **USDT's non-standard approve behavior**.

Reasoning:

1. The first USDT run succeeded because the router's allowance to the strategy
   was initially `0`, and USDT allows `approve(spender, amount)` from `0` to a
   non-zero value.
2. After that run, the strategy often spent **less** than the approved amount,
   so the router still had a **non-zero leftover allowance** for the strategy.
3. On the next run, the router tried to call `approve(strategy, amount)` again
   while the current allowance was still non-zero.
4. USDT is one of the tokens that rejects changing a non-zero allowance
   directly to another non-zero allowance. It requires the allowance to be set
   to `0` first, then set to the new value.
5. Because the router uses a low-level `call`, it is not failing on ABI return
   decoding. The token call itself is reverting, so `ok` is `false` and
   `require(ok, "approve failed")` reverts.
6. USDC does not enforce that zero-first rule, so repeated approvals keep
   succeeding there.

So this fails only for USDT, and only after the first run, because only then is
there typically a leftover non-zero allowance.

The minimal fix is to use OpenZeppelin's zero-first approval helper instead of
the raw low-level call. In `@openzeppelin/contracts` v5, that is
`SafeERC20.forceApprove`.

Minimal change:

```solidity
using SafeERC20 for IERC20;

IERC20(token).forceApprove(strategy, amount);
```

`forceApprove` handles tokens like USDT by trying the approval and, if needed,
resetting the allowance to `0` before setting it to `amount`.

What the router should do about leftover allowance in general:

- It should **not assume** the previous allowance was fully consumed.
- Before each run, it should set the strategy's allowance to exactly the amount
  needed for that run, using `forceApprove`.
- If the design wants least-privilege behavior, it can also clear any residual
  allowance back to `0` after the strategy finishes, but that is optional and
  costs extra gas.

In short: the bug is not the low-level call itself; the bug is re-approving
USDT from one non-zero allowance to another non-zero allowance. The practical
fix is `forceApprove`, which safely handles the leftover allowance case.
