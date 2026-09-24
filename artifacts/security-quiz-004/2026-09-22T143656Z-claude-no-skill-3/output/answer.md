# Why the USDT approval reverts (and only after the first run)

## Short version

USDT's `approve()` contains a non-standard guard:

```solidity
// Tether (TetherToken.sol), inherited from the original ERC20 draft
function approve(address _spender, uint _value) public onlyPayloadSize(2 * 32) {
    require(!((_value != 0) && (allowed[msg.sender][_spender] != 0)));
    ...
}
```

That `require` is the "approval race condition" mitigation from the 2017-era
ERC20 drafts: **a non-zero allowance may not be overwritten with another
non-zero value.** You must first set it to `0`.

Map that onto the observed behaviour:

- **Run 1**: allowance is `0` → `_value != 0 && 0 != 0` is false → approve
  succeeds. The strategy then spends *less* than approved, so a non-zero
  residual allowance is left behind.
- **Run 2..n**: allowance is the residual (non-zero) and `amount` is non-zero
  → the `require` inside USDT trips → the call reverts → `ok == false` →
  the router's `require(ok, "approve failed")` fires. It fires *before* any
  transfer, exactly as reported.
- **USDC** has a plain OpenZeppelin-style `approve` with no such guard, so
  overwriting a non-zero allowance is fine. Hence it never fails.

So the failure is not gas, pausing, blocklists, or amount size — it is purely
"non-zero → non-zero allowance transition on a token that forbids it".

## The second, hidden bug in the same two lines

The low-level call was introduced to dodge a *different* USDT quirk: USDT's
`approve` has **no return value** (`function approve(...) public` returns
nothing), so `IERC20(token).approve(...)` reverts in the ABI decoder on
Solidity ≥0.4.22. Using `token.call(...)` works around that, but it
introduces its own hazard:

```solidity
(bool ok, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
require(ok, "approve failed");
```

- A call to an address with **no code** returns `ok == true`. If `token` is
  ever mis-set, or a token is self-destructed/not-yet-deployed, the router
  silently believes the approval succeeded.
- The returndata is discarded, so a token that returns `false` instead of
  reverting (some older tokens) is also treated as success.

Both are silent-failure paths the router should not keep.

## Minimal fix

You are already on `@openzeppelin/contracts` v5. Use `SafeERC20.forceApprove`,
which does exactly what is needed: it tries `approve(spender, value)`, and if
that call fails, it retries `approve(spender, 0)` followed by
`approve(spender, value)`. It also tolerates missing/`false` return values and
reverts if the target has no code.

```solidity
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract TreasuryRouter {
    using SafeERC20 for IERC20;

    function _approveStrategy(IERC20 token, address strategy, uint256 amount) internal {
        token.forceApprove(strategy, amount);   // replaces the raw .call + require
    }
}
```

Diff, literally:

```diff
-        (bool ok, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
-        require(ok, "approve failed");
+        IERC20(token).forceApprove(strategy, amount);
```

Notes on v5 specifically:
- `safeApprove` was **removed** in OZ v5 — `forceApprove` is the replacement.
  Do not reintroduce `safeApprove` from an older version.
- `forceApprove` costs one extra `approve` call (~a few thousand gas plus a
  zero-write) only on the tokens that need it; USDC takes the fast path.

If for some reason you want to avoid `forceApprove`'s try/retry, the explicit
equivalent is a zero-then-set, which is also always safe:

```solidity
token.forceApprove(strategy, 0);
token.forceApprove(strategy, amount);
```

## What to do about the leftover allowance

Leaving a standing non-zero allowance is the actual root cause of the
recurring revert, and it is also a standing risk: the strategy (or anything
that can make the strategy call `transferFrom`) can pull those tokens at any
later time, including after the strategy is upgraded or compromised.

Policy for the router:

1. **Approve exactly what this run needs**, immediately before the call — not
   a rounded-up or `type(uint256).max` amount.
2. **Zero it out in the same transaction, after the strategy call returns**:

```solidity
token.forceApprove(strategy, amount);
strategy.run(token, amount);
token.forceApprove(strategy, 0);   // no allowance survives the transaction
```

   Do the reset unconditionally (it is cheap and correct even when the
   strategy consumed the full amount; on USDT setting to zero is always
   permitted). If any step can revert in a way you catch, make sure the reset
   still runs.
3. Because of (2), the "non-zero → non-zero" transition never happens again,
   so the USDT guard becomes irrelevant rather than merely worked around.
   `forceApprove` remains as the belt-and-braces layer for the case where a
   previous run reverted mid-way and left dust behind.
4. **Never use infinite approval** here. It converts every future strategy bug
   into a full treasury drain.
5. **One-time cleanup**: the current USDT allowance from run 1 is still live
   on mainnet. Send a single `approve(strategy, 0)` for USDT (and audit any
   other token/spender pairs the router has approved) before redeploying.

A stronger variant, if the strategy's interface allows it: skip approvals
entirely and have the router `safeTransfer` the tokens to the strategy, with
the strategy pulling nothing. That removes the allowance surface completely,
but it is a bigger change than the question asked for.

## Summary

| | |
|---|---|
| Why USDT only | Tether's `approve` reverts on a non-zero → non-zero allowance change |
| Why after run 1 only | Run 1 starts from a zero allowance; the strategy under-spends, leaving a non-zero residue that run 2 tries to overwrite |
| Why USDC is fine | Standard `approve`, no such guard |
| Minimal fix | Replace the raw `.call` + `require` with OZ v5 `SafeERC20.forceApprove` (`safeApprove` no longer exists in v5) |
| Allowance policy | Approve the exact per-run amount, reset to `0` in the same transaction after the strategy call, never approve `type(uint256).max`, and revoke the live USDT allowance now |
