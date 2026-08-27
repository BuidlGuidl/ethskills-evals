# Executor transcript — 2026-08-27T082324Z-claude-no-skill-2

**executor**: claude  |  **model**: claude-opus-5  |  **exit**: 0
**workspace**: /Users/liana/.cache/ethskills-evals/2026-08-27T082324Z-claude-no-skill-2/testing-quiz-003

## assistant
- **Bash** `ls -R | head -50 && cat RTK.md 2>/dev/null | head -30`

## assistant
- **Bash** `find . -name "*.sol" -not -path "./lib/*" -not -path "./node_modules/*" | head -30`

  > (Bash completed with no output)

  > package.json
  > TASK.md

## assistant
No Solidity in this directory (just `TASK.md` + `package.json`), so I'll write the analysis from the snippet as given.

## assistant
- **Bash** `cat > /Users/liana/.cache/ethskills-evals/2026-08-27T082324Z-claude-no-skill-2/testing-quiz-003/answer.md <<'MDEOF'
# Why deposits revert on mainnet USDT but never against the mock

## TL;DR

`usdt.ap … [11097 more chars]`

  >      244 /Users/liana/.cache/ethskills-evals/2026-08-27T082324Z-claude-no-skill-2/testing-quiz-003/answer.md

## assistant
Written to `answer.md`. Summary of the argument:

**The revert.** Real USDT's `approve` is declared with *no return value* (it predates the finalized ERC20 ABI). Your call goes through OZ's `IERC20`, whose `approve` is `returns (bool)`, so solc emits a mandatory 32-byte decode after the CALL. USDT succeeds at EVM level but returns 0 bytes → caller-side decode fails → solc's bare `revert(0, 0)`. No selector, no string. Exactly your symptom.

There's a **second, latent** USDT bug on the same line: `require(!((_value != 0) && (allowed[...] != 0)))` — you can't overwrite a non-zero allowance. Aave currently pulls the full amount so allowance returns to 0 and you'd usually skate; any partial pull or failed supply arms it.

**Why SafeERC20 didn't help.** `using SafeERC20 for IERC20` is member-lookup extension, not a wrapper — it adds `safeTransferFrom`/`forceApprove`, it does not rebind `approve`. Line 1 worked *because* it used the `safe` prefix (`_callOptionalReturn` tolerates empty returndata). Line 2 is a plain high-level call with zero SafeERC20 involvement. Four missing characters, no compiler warning.

**Why more mocks can't help.** Fidelity failure, not coverage failure. The line had 100% coverage and passed every time — because `MockERC20` (stock OZ) *encodes the same false assumption as the bug*. Oracle == assumption, so disagreement is structurally unobservable. Test #4,000 still passes. Also flagged: "green since the first commit" is a smell — that suite has never demonstrated it can go red.

**Fixes.** Code: `usdt.forceApprove(pool, amount)` (OZ ≥4.9/v5; `safeApprove` is gone in v5), or better, one-time max approval at init. Plus a grep to sweep every other raw `approve`/`transfer`/`transferFrom` and a lint rule to ban the pattern. Testing: fork-test the deposit path against real USDT + the real Aave pool at a pinned block, as a required pre-deploy check — with a `MockNoReturnERC20` in the hostile-token mock library as the fast inner-loop version that catches it without an RPC.

## run stats
- turns: 4
- duration: 116s
- cost: $0.3670965
- tokens in/out: 6/7698
