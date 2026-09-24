# Executor transcript — 2026-09-22T143409Z-claude-with-skill-d9952522-1

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals-security-opus/2026-09-22T143409Z-claude-with-skill-d9952522-1/security-quiz-004

## assistant
- **Skill** `{"skill":"security","args":"ERC-20 approve integration: USDT approve reverts on non-zero-to-non-zero, treasury router low-level approve call"}`

  > Launching skill: security

## assistant
- **Bash** `cat > /home/damu/.cache/ethskills-evals-security-opus/2026-09-22T143409Z-claude-with-skill-d9952522-1/security-quiz-004/answer.md <<'EOF'
# USDT approval failure in the treasury router

## Short answe … [6663 more chars]`

  > written

## assistant
Written to `answer.md`. Summary:

**Cause.** USDT's `approve` still carries the original EIP-20 race-condition guard: `require(!((_value != 0) && (allowed[msg.sender][_spender] != 0)))`. Only `0 → X` and `X → 0` are permitted. Run 1 starts from a zero allowance and succeeds; because the strategy underspends, every later run tries `X → Y` with both non-zero and the token reverts, so `ok` is false and your `require` fires before any transfer. USDC's FiatTokenV2 has no such guard, so it never fails.

This is a *different* bug from the one the low-level call was added for — USDT's `approve` also returns no data, which is what broke the strict-interface version. Switching to `call` fixed the decode revert and left the allowance guard in place.

**Also worth knowing:** `(bool ok, )` throws away the return data, so a `false`-returning token or a codeless address both pass the `require` silently. Not biting today with only USDC/USDT, but it's why the fix should be a library call rather than a patched `call`.

**Minimal fix** — OZ v5 `SafeERC20`:

```solidity
using SafeERC20 for IERC20;
token.forceApprove(strategy, amount);
```

`forceApprove` tolerates USDT's missing `bool`, and on failure retries `approve(0)` then `approve(amount)`. Note `safeApprove` was removed in v5, and `safeIncreaseAllowance` is wrong here since it adds to the standing allowance.

**Leftover allowance.** Don't let an approval outlive the operation: approve the exact run amount, then `token.forceApprove(strategy, 0)` after the strategy call in the same transaction. Never infinite-approve. The durable version is to invert the flow — `safeTransfer` + a funding hook — so no allowance exists at all. Worth adding a fork test that runs twice with a deliberate underspend; the current suite only ever exercised `0 → X`.

## run stats
- turns: 4
- duration: 55s
- cost: $0.24997949999999997
- tokens in/out: 59370/4112
- of which cache write/read: 12365/46999
