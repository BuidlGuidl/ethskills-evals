# Executor transcript — 2026-09-22T143656Z-claude-with-skill-d9952522-3

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals-security-opus/2026-09-22T143656Z-claude-with-skill-d9952522-3/security-quiz-004

## assistant
- **Skill** `{"skill":"security","args":"ERC-20 approve integration: USDT non-standard approve reverting on non-zero-to-non-zero allowance; minimal router fix with OZ v5 SafeERC20"}`

  > Launching skill: security

## assistant
- **Bash** `cat > /home/damu/.cache/ethskills-evals-security-opus/2026-09-22T143656Z-claude-with-skill-d9952522-3/security-quiz-004/answer.md <<'EOF'
# Why the approval fails only for USDT, and only after the fir … [5623 more chars]`

  > ok

## assistant
Written to `answer.md`. The short version:

**Cause.** USDT's `approve` carries the legacy approval-race guard `require(!((_value != 0) && (allowed[msg.sender][_spender] != 0)))` — allowance may only go 0→nonzero or nonzero→0. Run 1 starts from zero and succeeds; the strategy under-spends, leaving a nonzero remainder; every later run attempts nonzero→nonzero and reverts *inside the token*, so `ok` is `false` and you hit the `require`. USDC has no such guard, hence the clean record there.

**The low-level call is a red herring twice over.** It was added for a genuinely different USDT quirk (no return value, so ABI decoding reverts) — but it doesn't address the guard, and it introduced a silent-success hole: `ok == true` for a codeless address or a token that returns `false`.

**Minimal fix** (OZ v5 — `safeApprove` was removed):

```solidity
token.forceApprove(strategy, amount);
```

`forceApprove` tolerates missing return data and, on failure, retries `approve(0)` then `approve(amount)` — exactly what USDT needs — and restores the code-existence check.

**Leftover allowance.** Reset it to zero in the same transaction after the strategy pulls (`forceApprove(strategy, 0)`; nonzero→0 is always legal). A standing allowance is a lingering grant against treasury funds if the strategy is ever upgraded or compromised. Don't dodge the guard with an infinite approval, and don't special-case USDT by address — other tokens share the guard.

## run stats
- turns: 4
- duration: 51s
- cost: $0.227767
- tokens in/out: 58915/3434
- of which cache write/read: 11835/47074
