# USDT approval failure in the treasury router

## Short answer

USDT's `approve` refuses to overwrite a **non-zero** allowance with another
**non-zero** value. The first run works because the allowance starts at 0.
Every later run finds the strategy's leftover allowance still non-zero, so
`approve(strategy, amount)` hits USDT's guard, reverts, `ok` is `false`, and
your `require(ok, "approve failed")` fires — before any transfer, exactly as
observed. USDC has no such guard, so it never fails.

Minimal fix: stop hand-rolling the call and use OpenZeppelin v5's
`SafeERC20.forceApprove`, which resets to 0 first when the direct approve
fails.

## Why this is USDT and not USDC

USDT (0xdAC17F958D2ee523a2206206994597C13D831ec7) is a pre-ERC-20-final
token. Its `approve` carries the original "approve race condition"
mitigation from the EIP-20 rationale:

```solidity
// TetherToken.approve, paraphrased
require(!((_value != 0) && (allowed[msg.sender][_spender] != 0)));
```

So the only allowed transitions are `0 -> X` and `X -> 0`. `X -> Y` with both
non-zero reverts.

Map that onto your runs:

| Run | Allowance before | Call | Result |
|---|---|---|---|
| 1 | 0 | `approve(strategy, amount)` | `0 -> X`, allowed ✅ |
| 2+ | leftover > 0 (strategy underspent) | `approve(strategy, amount)` | `X -> Y`, reverts ❌ |

That matches every detail in the report: first run only, always at the
`require`, before any transfer, no dependence on amount size, and no
relevance of gas/pause/blocklist. USDC's FiatTokenV2_x `approve` has no such
check, so overwriting a non-zero allowance is fine — hence "every run
succeeds."

Note this is a *different* problem from the one the low-level call was
introduced to solve. USDT's `approve` also returns **no data** (its signature
is `function approve(address, uint)` with no `bool`), so `IERC20.approve(...)`
on a strict interface reverts in the ABI decoder. That is the bug the earlier
version hit, and switching to `token.call(...)` did fix it. It just left the
non-zero-to-non-zero guard untouched, so the failure moved from "reverts
while decoding" to "reverts inside the token."

## The second, quieter bug in the current code

```solidity
(bool ok, ) = token.call(abi.encodeWithSelector(0x095ea7b3, strategy, amount));
require(ok, "approve failed");
```

The return data is discarded. That means:

- a token that returns `false` instead of reverting (the other
  non-standard family) passes this `require` with no allowance set; and
- if `token` is an address with no code, the call returns `ok == true`,
  so a mis-set or self-destructed token address silently "succeeds."

Today the router only touches USDC and USDT so neither bites, but the
pattern is the reason the fix below should be a library call rather than a
patched-up `call`.

## Minimal change

Replace the low-level call with `forceApprove`:

```solidity
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract TreasuryRouter {
    using SafeERC20 for IERC20;

    function _approveStrategy(IERC20 token, address strategy, uint256 amount) internal {
        token.forceApprove(strategy, amount);
    }
}
```

`forceApprove` (OZ v5, `SafeERC20.sol`) does exactly what is needed here:

1. tries `approve(spender, value)` via `_callOptionalReturn`, which treats
   *empty* return data from a contract as success (handles USDT's missing
   `bool`) and requires `true` when data is returned (handles the
   `false`-returning family);
2. if that call fails, retries `approve(spender, 0)` then
   `approve(spender, value)` — the `X -> 0 -> Y` dance USDT requires; and
3. reverts with `SafeERC20FailedOperation` if the token has no code or the
   retry also fails.

Two version notes for OZ v5 specifically: `safeApprove` was **removed** in
v5, so it is not an option; and `safeIncreaseAllowance` /
`safeDecreaseAllowance` are the wrong tool here — they read the current
allowance and call `forceApprove` with a *sum*, which grows the standing
allowance rather than setting the per-run amount.

## What to do about the leftover allowance

The leftover allowance is not just the trigger for the USDT revert — it is
standing risk. Between runs the strategy holds a live right to pull router
funds, so any bug or compromise in the strategy (including a future upgrade
of it) drains the router with no further router involvement.

The rule: **an approval should not outlive the operation it was granted
for.** Approve immediately before the call, and zero it immediately after,
in the same transaction:

```solidity
function run(IERC20 token, uint256 amount) external onlyOperator {
    token.forceApprove(strategy, amount);
    IStrategy(strategy).execute(token, amount);
    token.forceApprove(strategy, 0);   // clears whatever the strategy underspent
}
```

`forceApprove(..., 0)` is the correct call for the reset too: `X -> 0` is
permitted by USDT, and it handles the no-return-data quirk. If you would
rather assert the strategy consumed everything, `require(token.allowance(
address(this), strategy) == 0)` after the call turns an underspend into a
revert instead of a silent leftover — pick that only if underspending is
genuinely not expected, since the report says it is.

Concrete guidance:

- **Never `approve(type(uint256).max)`** to the strategy. Infinite allowance
  makes the standing-risk problem permanent and is the usual reason routers
  end up in this state.
- **Approve the exact amount for the run**, not a rounded-up or cached
  figure.
- **Zero on the way out**, including in the failure path if the router
  catches strategy reverts rather than bubbling them (a bubbled revert
  reverts the approval too, which is fine).
- **Consider inverting the flow.** If the strategy can be changed to accept
  a push (`token.safeTransfer(strategy, amount)` plus a
  `strategy.onFunded(...)` hook) instead of pulling, the approval disappears
  entirely and so does this whole class of issue. That is a larger change
  than asked for, but it is the durable fix.
- **Pin a mainnet-fork test against real USDT** that runs the router twice
  with a deliberate underspend in between. The current suite evidently only
  ever exercised the `0 -> X` transition, which is why this reached
  production.

## Recap

- **Cause:** USDT's `approve` reverts on non-zero → non-zero; the strategy's
  underspend leaves a non-zero allowance, so run 2 onward always reverts.
- **Fix:** `SafeERC20.forceApprove(strategy, amount)` in place of the raw
  `call` + `require(ok)`.
- **Leftovers:** approve exactly what the run needs, `forceApprove(spender,
  0)` after the strategy call, never infinite approve.
