The failure pattern matches USDT's well-known approval rule: it does **not**
allow changing an existing **non-zero allowance** directly to another non-zero
allowance.

Reasoning:

1. On the first run, the router's allowance to `strategy` was presumably `0`.
   `approve(strategy, amount)` therefore succeeded for USDT.
2. The strategy often spends **less** than the approved amount, so after the
   run there is still a **leftover non-zero allowance**.
3. On the next run, the router again does a low-level `approve(strategy, amount)`.
   For USDT, that is a non-zero to non-zero allowance change, so USDT reverts.
   Your low-level call sees `ok == false`, and `require(ok, "approve failed")`
   reverts before any transfer happens.
4. USDC does not enforce that zero-first rule, so repeated approvals keep
   succeeding there.

So this is not a decoding problem. The low-level call avoided return-value
decoding issues, but it does not change token-specific approval semantics.

Minimal fix:

Before setting a new non-zero allowance, force the allowance to zero first when
needed.

With OpenZeppelin v5, the minimal router change is to use `SafeERC20.forceApprove`:

```solidity
using SafeERC20 for IERC20;

IERC20(token).forceApprove(strategy, amount);
```

That helper is specifically meant for tokens like USDT. It attempts the approve,
and if needed performs the zero-then-set flow safely.

If you want the equivalent logic spelled out, it is effectively:

```solidity
if (IERC20(token).allowance(address(this), strategy) != 0) {
    (bool ok0, ) = token.call(
        abi.encodeWithSelector(0x095ea7b3, strategy, 0)
    );
    require(ok0, "approve zero failed");
}

(bool ok1, ) = token.call(
    abi.encodeWithSelector(0x095ea7b3, strategy, amount)
);
require(ok1, "approve failed");
```

What to do about leftover allowance in general:

Do not rely on leftover allowance as part of normal operation. Treat it as stale
approval state.

At minimum, each run should overwrite allowance with a zero-then-set pattern so
USDT-style tokens work reliably.

For tighter privilege, the router should also clear any unused allowance back to
zero after the strategy has finished pulling funds, because leftover allowance is
unnecessary standing authorization if approvals are meant to be per-run.
