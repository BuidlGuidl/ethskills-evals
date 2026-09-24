# major-refine: `frontend-ux` on GPT 5.5 high

**Benchmark id:** `major-refine-d9952522` (issue [#119](https://github.com/BuidlGuidl/ethskills-evals/issues/119))

| | |
| --- | --- |
| Executor | `codex` · `gpt-5.5` · effort `high` |
| Judge | `claude` · `claude-opus-5` · effort `high` |
| `self_judged` | false on all 54 runs |
| Runs | 3 per arm per task, 6 tasks × 3 arms = **54 runs**, all `executor_exit: 0` |
| Harness / retractions | 0 `harness_failure`, 0 `retracted`, 0 dead runs, 0 blindness flags; 7 goal-002 grades needed a second `verify` (below) |
| Trigger | not forced; all 36 with-skill runs read `.agents/skills/frontend-ux/SKILL.md` |
| Sitting | 2026-09-22, 17:00–18:08 (+04) execution, ten detached drivers in parallel |

**Arms**

| Arm | Variant | `skill_version` | Skill text |
| --- | --- | --- | --- |
| none | `no_skill` | `null` | — |
| old | `with_skill` | `2f0adb01` | first vendored `frontend-ux`, 186 lines |
| new | `with_skill` | `d9952522` | refined skill, 26 lines |

Both `skill_version` commits are ancestors of HEAD. se-2 ships without `node_modules`, so nothing to pre-install.

**Tasks** — the six live tasks whose `skill:` is `skills/frontend-ux`: `frontend-ux-quiz-001`, `-quiz-002`, `-quiz-003`, `-quiz-005`, `-goal-001` (template `se-2`), `-goal-002` (bare). Task descriptions as in the Opus row's report (#151).

## Harness note: `.npm-cache` in the bare snapshot

Seven of nine goal-002 grades first failed with `verify: judge failed: spawnSync env EPIPE`. Codex's sandbox cannot write `~/.npm`, so the executor points npm at `./.npm-cache` inside the workspace (17–64 MB). `.npm-cache` is not in `GENERATED_DIRS`, so the bare-task snapshot copied it into `output/` and the judge prompt overflowed the pipe. Nothing was graded; the workspaces were intact.

With the human's go-ahead, `.npm-cache/` (and only that dir) was deleted from those seven workspaces and `verify` re-run, same judge. The executor's deliverable was not touched; the other two goal-002 runs had no cache in the workspace. `lib/` was left at the benchmark commit, so the fix — add `.npm-cache` to `GENERATED_DIRS` — is for a harness PR, not this branch. It will hit every codex bare task that runs `npm install`; the building-blocks GPT row saw a 52K one that got through.

## Headline — pass counts, new · old · none

| Task | new · old · none | Per run |
| --- | --- | --- |
| `frontend-ux-quiz-001` | `3/3 · 3/3 · 3/3` | every expect everywhere |
| `frontend-ux-quiz-002` | `3/3 · 3/3 · 3/3` | every expect everywhere |
| `frontend-ux-quiz-003` | `3/3 · 3/3 · 3/3` | every expect everywhere |
| `frontend-ux-quiz-005` | `3/3 · 3/3 · 2/3` | none run 2 fails e2 |
| `frontend-ux-goal-001` | `3/3 · 3/3 · 0/3` | skill arms 6/6 ×3; none 3/6, 3/6, 2/6 |
| `frontend-ux-goal-002` | `2/3 · 1/3 · 0/3` | new 6,6,5; old 5,5,6; none 2,1,3 (of 6) |
| **total** | **`17/18 · 16/18 · 11/18`** | |

**Quizzes are near-saturated** (35/36). The model knows the `isPending` gap, the 10^12 factor, the wrong-network flow and ENS resolution without the skill.

**The goals separate skill from no skill, not old from new.** On both goals none fails the product-completeness lines and both skill arms pass them. The one line where the arms differ is goal-002 e6 (identity), and that comes down to one run: new 2/3, old 1/3.

**Compared with Opus 5 medium (#151, `18/18 · 15/18 · 12/18`):** the old-vs-new delta there was goal-001 e6, the Base retarget (old 0/3). On GPT the old arm retargets 3/3, so that delta does not carry over. GPT's none arm is weaker on the bare build: it skips ENS 3/3, where Opus none resolved it 3/3.

### Per-expect, goals

| goal-001 line | new | old | none |
| --- | --- | --- | --- |
| e1 USD context on amounts, ETH from a real price | 3/3 | 3/3 | 0/3 |
| e2 failed tx surfaces a message near the action | 3/3 | 3/3 | 1/3 |
| e3 root `app/layout.tsx` metadata is the app's | 3/3 | 3/3 | 1/3 |
| e4 header + hero branding are the app's | 3/3 | 3/3 | 0/3 |
| e5 theme tokens, no hardcoded dark wrapper | 3/3 | 3/3 | 3/3 |
| e6 `targetNetworks` includes Base; polling healthy | 3/3 | 3/3 | 3/3 |

| goal-002 line | new | old | none |
| --- | --- | --- | --- |
| e1 recipient resolves ENS, validates, normalizes | 3/3 | 3/3 | 0/3 |
| e2 USDC at 6 decimals end to end | 3/3 | 3/3 | 3/3 |
| e3 ETH balance with a USD value from a real source | 3/3 | 3/3 | 0/3 |
| e4 send button held click → confirmation, released on rejection | 3/3 | 3/3 | 2/3 |
| e5 failed transfer surfaces a message near the action | 3/3 | 3/3 | 1/3 |
| e6 own identity: title, favicon, OG/social | **2/3** | **1/3** | 0/3 |

## What the runs did

**goal-001, none.** All three render the ETH balance from a raw `useBalance`: no `<Balance>` and no `useFetchNativeCurrencyPrice` in any diff (e1 0/3). Every `Header.tsx` hunk adds a Stake nav link and nothing else (e4 0/3). This is the same shape as on Opus, and the one the 2026-09-17 rubric split was written to catch. Run 2 alone rewrote `app/layout.tsx` metadata (e3), and no run touched `getMetadata.ts`. Runs 1 and 2 surface tx errors only through SE-2's `useTransactor` / `notification.error` toast, with nothing inline near the button (e2).

**goal-001, skill arms.** All six rewrite `layout.tsx`, `getMetadata.ts`, `Header.tsx` and the `app/page.tsx` hero. Five of the six price the ETH balance with SE-2's `useFetchNativeCurrencyPrice`; new run 1 fetches CoinGecko instead.

**goal-001 e6.** All nine runs put Base in `targetNetworks`: seven as `[chains.base, chains.hardhat]`, new run 2 as `[chains.base]`, none run 2 as an env switch that defaults to Base. None of the old-arm runs defers the switch the way every Opus old-arm run did.

**goal-002, none.** All three gate the recipient with viem `isAddress()` only and never resolve ENS (e1 0/3). None of them fetches an ETH price (e3 0/3). Each ships `<title>USDC Pay</title>` with no favicon and no OG tags (e6 0/3). The error line (e5) fails on two runs: run 2 renders `{writeError.message}` raw, and run 1's `getErrorMessage` falls back to `error.message` for anything but a top-level `UserRejectedRequestError`, which viem wraps. Run 2 also disables Send on `!isWritePending && !receipt.isLoading` alone, with no flag of its own and no `finally` (e4). That is the same shape as `frontend-ux-send-button-released-at-receipt` on Opus.

**goal-002 e6, skill arms.** Every failing skill run (old 1 and 2, new 3) ships a favicon, `og:title` and `twitter:` tags but no `og:image`. The three passing runs add `public/og.svg` with an `og:image` tag. The new text names "image" in its Product identity line, and one new run still dropped it.

**goal-002, stack choice.** All nine runs build Vite + React + wagmi/viem, not Next.js. On Opus all nine chose Next.js.

**quiz-005 none run 2, e2.** It describes detecting, resolving, pending and error states, but never says to show the user the address the name resolved to. The expect line asks for that explicitly.

**Other.** quiz-002 old run 1 tried codex's `request_user_input` tool. Codex refuses it in exec mode (`executor.err`), the run went on and passed. What it wanted to ask is not recorded.

## Cost

From `yarn run-stats --tasks <the six> --benchmark major-refine-d9952522`, split per arm. All figures are codex `cost_source: list_price`: token split × OpenAI list price in `lib/prices.ts`, not a bill. Medians, n=3 each.

| Task | new | old | none |
| --- | --- | --- | --- |
| quiz-001 | 73s · 77k · $0.20 ($0.16–0.20) | 98s · 121k · $0.27 ($0.25–0.48) | 125s · 143k · $0.45 ($0.20–0.93) |
| quiz-002 | 46s · 73k · $0.12 ($0.12–0.12) | 81s · 98k · $0.18 ($0.16–0.20) | 37s · 53k · $0.10 ($0.06–0.12) |
| quiz-003 | 53s · 72k · $0.13 ($0.11–0.13) | 77s · 114k · $0.20 ($0.19–0.26) | 70s · 57k · $0.11 ($0.09–0.17) |
| quiz-005 | 59s · 73k · $0.14 ($0.13–0.15) | 85s · 120k · $0.25 ($0.22–0.39) | 56s · 71k · $0.15 ($0.14–0.27) |
| goal-001 | 1064s · 6.60M · $5.05 ($4.14–5.12) | 1258s · 7.35M · $5.74 ($4.81–6.47) | 1510s · 7.63M · $5.61 ($5.18–5.64) |
| goal-002 | 877s · 1.43M · $2.08 ($1.58–2.63) | 603s · 1.03M · $1.47 ($1.27–3.39) | 1167s · 2.13M · $2.39 ($1.40–3.78) |

The new text is cheaper than the old on five of six tasks. On quizzes it costs about the same as none. On goal-001 it is the fastest and cheapest arm. Two none quiz-001 runs spent 10–22 web searches each, which is where that task's $0.93 top comes from. The goal-002 ranges overlap across all three arms, so its medians carry no ordering.

## Mistake records

Updated six records under `mistakes/frontend-ux/`, adding `codex/gpt-5.5@2f0adb01` and `codex/gpt-5.5@d9952522` frequency blocks. They start from #151's versions of these files, which is not merged yet, so whichever PR merges second takes the other's blocks, a superset.

- `address-input-no-ens-resolution` — none 3/3, skills 0/3. It reproduces on GPT after not reproducing on Opus.
- `eth-balance-no-usd-context` — none 6/6, skills 0/6.
- `metadata-left-as-template-default` — none 6/6. Skill arms old 2/6, new 1/6, on `og:image` alone.
- `frontend-ux-unsurfaced-tx-error` — none 4/6, skills 0/12. Adds shape (d): the error reaches the UI untranslated.
- `frontend-ux-send-button-released-at-receipt` — none 1/3, the same shape as the Opus run.
- `target-network-not-retargeted` — 0/9 on every arm. The Opus old-arm deferral does not reproduce.

`frontend-ux-run-ends-waiting-on-background-install` is claude print-mode behaviour and not applicable here. No new records.

## Summary

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | Yes over none: new `17/18` and old `16/18` vs none `11/18`, all of it on the two goals (goal-001 `3/3 · 3/3 · 0/3`, goal-002 `2/3 · 1/3 · 0/3`) plus one quiz-005 run. New vs old: one run apart, on goal-002 e6 (`og:image`); not a measured difference at n=3. |
| Did it reduce time/tokens? | New vs old: yes on 5/6 tasks, e.g. goal-001 1064s / 6.60M / $5.05 vs 1258s / 7.35M / $5.74. New vs none: cheaper on goal-001 (vs 1510s / 7.63M / $5.61), level on quizzes. goal-002 ranges overlap on all three arms. |
| Did it create negative deltas? | None on pass rate. Old is the dearest arm on quiz-002/003/005, at 1.7–2.0× none tokens. |
| What mistakes repeated without the skill? | `address-input-no-ens-resolution` 3/3, `eth-balance-no-usd-context` 6/6, `metadata-left-as-template-default` 6/6, `frontend-ux-unsurfaced-tx-error` 4/6, `frontend-ux-send-button-released-at-receipt` 1/3 |
| What mistakes remained with the skill? | `metadata-left-as-template-default`, on `og:image` only: old 2/3, new 1/3 on goal-002 |
| What should change in the skill? | Product identity: the new line lists "image" among six items and one run still dropped it. Say what the image is (a real file under `public/` referenced by `og:image`), since title and favicon get done and the image does not. Nothing else: every other line both arms fail without the skill is closed by the new text. |
| What should change in the eval? | Harness: add `.npm-cache` to `GENERATED_DIRS`, or every codex bare task that installs dependencies risks an ungradeable run. Rubric: goal-002 e6 bundles title, favicon and three OG fields into one line; split out the image so the report can say which part a run missed without re-reading the files. Quizzes are saturated on both stacks and measure the model, not the skill. |
