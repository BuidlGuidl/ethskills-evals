# Executor transcript — 2026-08-27T082326Z-claude-no-skill-3

**executor**: claude  |  **model**: claude-opus-5  |  **exit**: 0
**workspace**: /Users/liana/.cache/ethskills-evals/2026-08-27T082326Z-claude-no-skill-3/testing-quiz-003

## assistant
- **Bash** `ls -R . | head -60 && echo "---" && cat foundry.toml 2>/dev/null; cat package.json 2>/dev/null`

  > package.json
  > TASK.md
  > ---
  > {
  >   "name": "eval-workspace",
  >   "private": true
  > }

## assistant
Repo's empty (just `TASK.md`), so this is a pure write-up. Writing `answer.md`.

## assistant
- **Bash** `cat > answer.md <<'MDEOF'
# Why deposits revert on mainnet USDT but never against the mock

## TL;DR

`usdt.approve(...)` is a **raw `IERC20` call, not a SafeERC20 call**. Real USDT's
`approve` return … [15950 more chars]`

  >      354 answer.md

## assistant
Written to `answer.md`. Summary of the four asks:

**Why it reverts on real USDT.** Mainnet USDT's `approve` is declared without `returns (bool)` — same selector, zero bytes of returndata. A high-level Solidity call through `IERC20` unconditionally checks `returndatasize() >= 32` before decoding the `bool`, and reverts with empty data when it isn't. That empty revert is the fingerprint: Aave V3 reverts with error codes (`"27"`, `"43"`, …), so no-reason-string already localizes it to line 2. Two more USDT landmines sit behind it — the non-zero→non-zero approve guard (would break the *second* deposit even after a naive fix) and the owner-settable transfer fee.

**Why never against the mock.** OZ `ERC20.approve` returns `true`. 32 bytes, decode succeeds, the line cannot fail. Matching 6 decimals matched the one dimension that was already compatible.

**Why SafeERC20 didn't help.** `using A for B` *adds* members; it doesn't override existing ones. `approve` is already on `IERC20`, so `usdt.approve(...)` resolves to the interface, not the library. Line 1 was protected only because `safeTransferFrom` isn't an `IERC20` member name. Protection is opt-in per call site by spelling a different name — and the `using` line at the top of the file reads to a reviewer like a guarantee it isn't.

**Why no amount of mock tests would surface it.** The mock is a second copy of your assumption, not a check on it. The one fact that had to hold — the bytecode at `0xdAC1…` returns a bool — is at an address the suite never loads. Coverage/fuzzing can't reach it because the untested thing isn't a line, it's an assumption. "39/39 green since the first commit" is the tell: a suite that never went red never contradicted a belief.

**Fixes.** Code: `token.forceApprove(pool, amount)` (OZ ≥ 4.9 — `safeApprove` is deprecated/removed and doesn't handle the race guard), plus a CI grep banning bare `.approve(`/`.transfer(`/`.transferFrom(`. Testing: pinned-block fork tests against the real USDT and Aave addresses as a hard release gate, plus a parameterized token-behavior matrix (no-return, approve-race, fee-on-transfer, returns-false, rebasing, blocklist) so the existing 39 tests run against adversarial mocks in the fast loop.

Five open questions at the end — the two that actually gate the patch are your OZ version and whether share accounting mints off `amount` (which decides if the fee-on-transfer hardening is a three-line change or wider).

## run stats
- turns: 3
- duration: 151s
- cost: $0.4501965
- tokens in/out: 6/10131
