The failure is USDT-specific because USDT does not behave like a normal ERC-20 for
`approve`.

Reasoning:

1. The router currently does a raw call to `approve(strategy, amount)` and only
   checks whether the call reverted:

   ```solidity
   (bool ok, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
   require(ok, "approve failed");
   ```

2. USDC allows changing allowance from one nonzero value to another nonzero
   value, so repeated runs succeed.

3. USDT uses the older "zero-first" approval rule: if the current allowance is
   nonzero, setting it to another nonzero value reverts. The first run worked
   because the initial allowance was `0`. After that, the strategy often spent
   less than approved, so a leftover nonzero allowance remained. On the next
   run, the router attempted a nonzero-to-nonzero `approve`, and USDT reverted.
   Your low-level call avoided return-data decoding issues, but it did not avoid
   the token's actual approval rule, so `ok == false` and the router hit
   `require(ok, "approve failed")`.

Minimal fix:

Since the repo is on OpenZeppelin Contracts v5, replace the raw `approve` call
with `SafeERC20.forceApprove`, which handles zero-first tokens like USDT.

```solidity
using SafeERC20 for IERC20;

IERC20(token).forceApprove(strategy, amount);
```

`forceApprove` will set the allowance directly when possible, and for tokens
like USDT it will fall back to:

1. `approve(strategy, 0)`
2. `approve(strategy, amount)`

That is the minimal router change that fixes the issue.

What to do about leftover allowance in general:

- Do not assume you can overwrite a leftover nonzero allowance.
- Keep approvals exact or tightly bounded.
- When practical, clear leftover allowance back to zero after the strategy has
  finished, especially if approvals are only meant for a single run.

In short: the router should treat leftover allowance as state that must be
explicitly handled. On OZ v5, `forceApprove` is the correct primitive for that.
