# Why the USDT approval reverts (and only after the first run)

## Short answer

USDT's `approve()` contains an anti-front-running guard:

```solidity
// Tether (TetherToken.sol), via the ERC20 base it inherits
function approve(address _spender, uint _value) public onlyPayloadSize(2 * 32) {
    require(!((_value != 0) && (allowed[msg.sender][_spender] != 0)));
    allowed[msg.sender][_spender] = _value;
    ...
}
```

It **reverts if you try to set a non-zero allowance while a non-zero allowance is
already outstanding**. The only legal transitions are `0 -> X` and `X -> 0`.

That maps exactly onto what you observed:

- **Run 1:** allowance is `0`, you set it to `amount`. The guard passes. Success.
- **Strategy spends less than approved:** a non-zero remainder is left in
  `allowance(router, strategy)`.
- **Run 2+:** you call `approve(strategy, amount)` with `amount != 0` *and*
  `allowed[router][strategy] != 0`. The `require` inside USDT reverts, the
  low-level call returns `ok == false`, and your `require(ok, "approve failed")`
  reverts the whole run — before any transfer, exactly as reported.

USDC has no such guard (its `approve` is a plain overwrite), so it succeeds on
every run regardless of leftover allowance. Nothing about gas, pausing,
blocklists, or amount size is involved; the asymmetry is purely USDT's approve
semantics.

Note that this is a *different* bug from the one the low-level call was added to
fix. That original revert was the **missing return value**: USDT's `approve` and
`transfer` declare no return value and return zero bytes, so the ABI decoder for
`IERC20.approve`'s `bool` return reverted on empty returndata. Switching to
`token.call(...)` dodged the decode, but it never addressed the zero-allowance
rule — and it introduced two new holes:

1. `require(ok)` ignores the returndata entirely, so a token that returns
   `false` instead of reverting is treated as success.
2. A low-level call to an address with no code returns `ok == true`, so a
   misconfigured/self-destructed token address silently "approves".

## Minimal fix

Use OpenZeppelin v5's `SafeERC20.forceApprove`. It handles the empty-returndata
case, checks the returned `bool` when one is present, requires the target to have
code, and — critically here — retries with `approve(spender, 0)` first if the
direct `approve` fails.

```solidity
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract TreasuryRouter {
    using SafeERC20 for IERC20;

    function _approveStrategy(IERC20 token, address strategy, uint256 amount) internal {
        token.forceApprove(strategy, amount);   // replaces the raw .call + require(ok)
    }
}
```

Delete both lines of the low-level block; `forceApprove` is the whole change.

`forceApprove` in OZ v5 is, in effect:

```solidity
function forceApprove(IERC20 token, address spender, uint256 value) internal {
    bytes memory approvalCall = abi.encodeCall(token.approve, (spender, value));
    if (!_callOptionalReturnBool(token, approvalCall)) {
        _callOptionalReturn(token, abi.encodeCall(token.approve, (spender, 0)));
        _callOptionalReturn(token, approvalCall);
    }
}
```

One caveat worth stating explicitly: on OZ v5, **`safeApprove` no longer exists** —
it was removed in v5.0 precisely because it reverted rather than recovering when a
non-zero allowance was outstanding. If you reach for `safeApprove` (some older
guidance still recommends it) the contract will not compile against your pinned
version. `forceApprove` is its replacement.

## What to do about the leftover allowance in general

`forceApprove` makes the *approval* succeed, but a standing allowance is a
liability in its own right: for as long as it exists, a compromised or upgradeable
strategy can pull that much out of the treasury at any time, with no further
action from the router.

The right shape for the router is **approve exactly what this run needs, then take
it back to zero in the same transaction**:

```solidity
function runStrategy(IERC20 token, uint256 amount) external onlyOperator {
    token.forceApprove(strategy, amount);      // 0 -> amount
    IStrategy(strategy).execute(token, amount);
    token.forceApprove(strategy, 0);           // amount -> 0, reclaims the remainder
}
```

Why this is the right default:

- **The allowance window shrinks to one transaction.** Between runs the treasury's
  exposure to the strategy is exactly zero, so a later strategy compromise cannot
  reach back into funds the router still holds.
- **Every run starts from a clean `0`,** which means the USDT transition is always
  the legal `0 -> X`. The zero-reset path inside `forceApprove` stops being
  load-bearing — it's a safety net, not the normal flow.
- **Partial spends stop accumulating.** Right now an unspent remainder silently
  persists and compounds run over run; the trailing reset reclaims it.

Two related points:

- **Never grant `type(uint256).max` here.** An infinite allowance to the strategy
  makes the entire treasury balance — present and future, including tokens
  deposited long after the approval — reachable by whoever controls the strategy.
  The whole treasury is one strategy bug away from being drained. Approve the
  per-run amount.
- **If the strategy's exact draw isn't known ahead of time,** don't over-approve as
  a workaround. Either have `execute` return the amount consumed, or read
  `token.allowance(address(this), strategy)` after the call and zero it out — the
  trailing `forceApprove(strategy, 0)` above already does this correctly regardless
  of how much was actually pulled.

If you truly need the allowance to persist across runs (e.g. the strategy pulls
asynchronously), then keep it but top up with `safeIncreaseAllowance` rather than
re-approving an absolute figure — it's `X -> X+delta`, which for USDT is still a
non-zero-to-non-zero move and so must go through `forceApprove` anyway, and more
importantly it doesn't quietly discard the fact that a remainder was already
sitting there. The zero-between-runs pattern is strictly safer; prefer it unless
the strategy's design forbids it.

## Checklist items this touches

- *Return values checked* — the raw `.call` + `require(ok)` was not a substitute
  for SafeERC20; it ignored both `false` returns and the no-code case.
- *No infinite approvals* — approve exact per-run amounts, never `type(uint256).max`.
- *Token quirks* — USDT is non-standard in two independent ways (no return value,
  zero-allowance-first). Fixing only the first is what produced this bug.
