# Executor transcript — 2026-09-22T143409Z-claude-with-skill-2f0adb01-1

**executor**: claude  |  **model**: claude-opus-5  |  **effort**: medium  |  **exit**: 0
**workspace**: /home/damu/.cache/ethskills-evals-security-opus/2026-09-22T143409Z-claude-with-skill-2f0adb01-1/security-quiz-004

## assistant
- **Skill** `{"skill":"security","args":"ERC20 approve race / non-standard tokens (USDT) allowance reset"}`

  > Launching skill: security

## assistant
- **Bash** `ls -a /home/damu/.cache/ethskills-evals-security-opus/2026-09-22T143409Z-claude-with-skill-2f0adb01-1/security-quiz-004`

  > .
  > ..
  > .agents
  > .claude
  > .git
  > package.json
  > TASK.md

## assistant
- **Write** `/home/damu/.cache/ethskills-evals-security-opus/2026-09-22T143409Z-claude-with-skill-2f0adb01-1/security-quiz-004/answer.md`

  > File created successfully at: /home/damu/.cache/ethskills-evals-security-opus/2026-09-22T143409Z-claude-with-skill-2f0adb01-1/security-quiz-004/answer.md (file state is current in your context — no need to Read it back)

## assistant
Written to `answer.md`. Summary:

**Cause.** USDT's `approve` carries a non-standard guard:
```solidity
require(!((_value != 0) && (allowed[msg.sender][_spender] != 0)));
```
It rejects any non-zero → non-zero allowance change. Run 1 starts from allowance 0 and passes. Because the strategy under-spends, every later run starts from a non-zero leftover, so USDT reverts (bare revert, no reason string), the low-level call returns `ok == false`, and you hit `require(ok, "approve failed")`. USDC has no such guard. The low-level call was masking a *different* USDT quirk — `approve` returns no data, which is what made the earlier `abi.decode` version revert.

**Minimal fix.** One line, OZ v5:
```solidity
using SafeERC20 for IERC20;
token.forceApprove(strategy, amount);
```
`forceApprove` tolerates the missing return value and, on failure, retries as `approve(0)` then `approve(amount)`. Note the skill file in this repo suggests `safeApprove` — that was removed in v5 precisely because it reverts on this case; `forceApprove` is its replacement.

**Leftover allowance.** Revoke it — `forceApprove(strategy, 0)` after the strategy call, so the exposure window is one transaction rather than weeks. A standing allowance is a live claim on the treasury if the strategy is ever compromised. Explicitly *not* the fix: `approve(type(uint256).max)`, which would also make the symptom vanish while handing over the whole balance permanently.

Also flagged: the raw `call` returns `ok == true` for an address with no code, so it would silently "succeed" on a misconfigured token address.

## run stats
- turns: 5
- duration: 59s
- cost: $0.344258
- tokens in/out: 98802/4490
- of which cache write/read: 19218/79576
