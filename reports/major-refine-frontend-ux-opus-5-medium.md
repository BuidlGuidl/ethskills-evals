# major-refine: `frontend-ux` on Opus 5 medium

**Benchmark id:** `major-refine-d9952522` (issue [#119](https://github.com/BuidlGuidl/ethskills-evals/issues/119))

| | |
| --- | --- |
| Executor | `claude` · `claude-opus-5` · effort `medium` |
| Judge | `claude` · `claude-opus-5` · effort `high` |
| `self_judged` | **true** on all 54 records — judge and executor are the same agent |
| Runs | 3 per arm per task, 6 tasks × 3 arms = **54 runs**, all `executor_exit: 0` |
| Harness / retractions | 0 `harness_failure`, 0 dead runs, 0 retracted, 0 blindness refusals |
| Trigger | not forced — numbers are trigger-inclusive |
| Sitting | 2026-09-21, 18:27–20:02 (+04), eight detached drivers in parallel |

**Arms**

| Arm | Variant | `skill_version` | Skill text |
| --- | --- | --- | --- |
| none | `no_skill` | `null` | — |
| old | `with_skill` | `2f0adb01` | first vendored `frontend-ux`, 186 lines: "What You Probably Got Wrong" plus nine numbered rules with code |
| new | `with_skill` | `d9952522` | refined skill, 26 lines: four headline surfaces (product identity, address inputs, fiat context, target chain) and five one-line "confirm rather than rebuild" items |

Both `skill_version` commits are ancestors of HEAD. The se-2 template ships without `node_modules` by design (its README strips them), so there was nothing to pre-install; every goal-001 run installs inside its own workspace.

**Tasks** — all six live tasks whose `skill:` is `skills/frontend-ux`.

- `frontend-ux-quiz-001` — approve button: duplicate approval + button dead after rejection, from a given `isPending`/`submitting` snippet.
- `frontend-ux-quiz-002` — `parseEther("250")` on USDC: the 10^12 overshoot, `parseUnits`/`formatUnits` at 6.
- `frontend-ux-quiz-003` — stake widget on the wrong chain and a local `hasApproved` flag; the one-primary-action flow.
- `frontend-ux-quiz-005` — `vitalik.eth` pasted into a hex-regex recipient field; ENS resolution and an address component.
- `frontend-ux-goal-001` — template `se-2`: USDC staking dApp targeting Base. Six lines: USD context, error surfacing, metadata, branding, theme tokens, target chain + polling.
- `frontend-ux-goal-002` — bare workspace: a `/pay` page sending mainnet USDC. Six lines: ENS recipient, 6-decimal math, ETH balance in USD, send-button pending state, error surfacing, product identity.

## Headline — pass counts, new · old · none

| Task | new · old · none | Per run |
| --- | --- | --- |
| `frontend-ux-quiz-001` | `3/3 · 3/3 · 3/3` | 4/4 expects everywhere |
| `frontend-ux-quiz-002` | `3/3 · 3/3 · 3/3` | 3/3 expects everywhere |
| `frontend-ux-quiz-003` | `3/3 · 3/3 · 3/3` | 4/4 expects everywhere |
| `frontend-ux-quiz-005` | `3/3 · 3/3 · 3/3` | 3/3 expects everywhere |
| `frontend-ux-goal-001` | `3/3 · 0/3 · 0/3` | new 6/6 ×3; old 5/6 ×3, all on e6; none 1/6, 3/6, 3/6 |
| `frontend-ux-goal-002` | `3/3 · 3/3 · 0/3` | new and old 6/6 ×3; none 4/6, 4/6, 3/6 |
| **total** | **`18/18 · 15/18 · 12/18`** | |

**Quizzes are saturated** (36/36 across the three arms): on Opus 5 medium the model explains the `isPending` gap, the 10^12 factor, the wrong-network-first flow and ENS resolution with nothing in the workspace. The four quiz columns measure the executor, not the skill.

**The goals separate the arms, on different lines.** None fails the product-completeness lines: on SE-2, USD context (e1) 0/3, metadata (e3) 0/3, branding (e4) 0/3; on the bare build, ETH-in-USD (e3) 0/3 and identity (e6) 0/3. Both skill arms pass all of those 6/6. The only line that separates old from new is goal-001 e6, the Base retarget: **old 0/3, new 3/3** — and it is the whole old-vs-new delta in the benchmark.

### Per-expect, goals

| goal-001 line | new | old | none |
| --- | --- | --- | --- |
| e1 USD context on amounts, ETH from a real price | 3/3 | 3/3 | 0/3 |
| e2 failed tx surfaces a message near the action | 3/3 | 3/3 | 2/3 |
| e3 root `app/layout.tsx` metadata is the app's | 3/3 | 3/3 | 0/3 |
| e4 header + hero branding are the app's | 3/3 | 3/3 | 0/3 |
| e5 theme tokens, no hardcoded dark wrapper | 3/3 | 3/3 | 3/3 |
| e6 `targetNetworks` includes Base; polling healthy | 3/3 | **0/3** | 2/3 |

| goal-002 line | new | old | none |
| --- | --- | --- | --- |
| e1 recipient resolves ENS, validates, normalizes | 3/3 | 3/3 | 3/3 |
| e2 USDC at 6 decimals end to end | 3/3 | 3/3 | 3/3 |
| e3 ETH balance with a USD value from a real source | 3/3 | 3/3 | 0/3 |
| e4 send button held click → confirmation, released on rejection | 3/3 | 3/3 | 2/3 |
| e5 failed transfer surfaces a message near the action | 3/3 | 3/3 | 3/3 |
| e6 own identity: title, favicon, OG/social | 3/3 | 3/3 | 0/3 |

## What the runs did

**goal-001 e6, the old-vs-new line.** All three old-arm runs edited `scaffold.config.ts` and left `targetNetworks: [chains.hardhat]`, each with a comment deferring the switch — "Production target is Base (chains.base). Switch to it after `yarn deploy --network base`: contract types come from the target network, so Staker must be deployed there first." That is a reasoned deferral from SE-2's type generation, made three times out of three, and the old Rule 5 ("RPC Reliability and Polling") never says which chain to configure. All three new-arm runs wrote `targetNetworks: [chains.base]` with the local-dev swap in the comment instead; the new text says "Point the app at the chain the brief names; scaffold defaults sit on local/hardhat" and ends with "confirming the configured target chain matches the brief". Of the none runs, run 1 never touched the file, run 2 made it `NODE_ENV`-conditional and run 3 set Base. Polling: every run set 2000–3000 ms; nothing degraded it.

**goal-001 e1/e3/e4, none.** No none run touched `app/layout.tsx` (e3). For e4, runs 2 and 3 replaced the `app/page.tsx` hero and none of the three removed the `Header.tsx` strings — every `Header.tsx` hunk adds a Stake nav link and nothing else, the exact shape the 2026-09-17 rubric split was written to catch; run 1 touched neither. For e1, run 1 renders the ETH balance from a raw `useBalance` only; runs 2 and 3 render SE-2's `<Balance>` (ETH by default, USD on click) beside their own `useBalance` figure, and the judge failed both under "USD context alongside the token amount". The 2026-08-12 sitting passed that same shape, so part of the none e1 move from 1/3 to 3/3 is the judge. Both skill arms render an inline `≈ $` figure from SE-2's native-currency price, and one new-arm run labels "USD price unavailable", the label the "Fiat context" paragraph asks for.

**goal-001 e2, none run 1.** Catches both transaction errors, calls `console.error`, and comments "Errors are already surfaced to the user via notifications by the transactor" — leaning on SE-2's toast, which the diff cannot show and which is not near the action. The other two none runs render an inline error and passed.

**goal-002, none.** All three resolve ENS unprompted (wagmi `useEnsAddress` with viem `normalize` in a `useRecipient` hook, resolved address shown before submit) — the `address-input-no-ens-resolution` record's 3/3 from 2026-07-24 did not reproduce. None of the three fetches an ETH price anywhere (no coingecko / chainlink / price code in any of the three transcripts), and all three set a title ("USDC Pay") and nothing else: no favicon, no OpenGraph. Run 2 disables Send on wagmi state alone and releases it the moment the receipt lands; the judge failed e4 there and its reasoning is not recorded.

**goal-002, stack choice** (the task notes ask): all nine runs reach for Next.js + wagmi v2 + viem unprompted; the eight with a dependency block list RainbowKit. Run none-2's `package.json` has no dependency block because its install was killed (below).

**Two none runs ended their turn waiting on a background install.** goal-001 none-2 ("I'll be notified when the install finishes; then I'll compile, run tests, and type-check") and goal-002 none-2 ("waiting on the npm install to finish so I can typecheck and build") both started the install with `run_in_background` and ended the assistant turn. In print mode that ends the session: exit 0, `stop_reason: end_turn`, and the last stream event is a `task_notification` for the install with status `stopped`. Both are graded as they stand; their fails are on lines the finished code also lacks. 0/12 skill runs did this. Filed as `frontend-ux-run-ends-waiting-on-background-install`.

**The se-2 template's reviewer subagent.** `templates/se-2/.claude/agents/grumpy-carlos-code-reviewer.md` ships with the template, and five goal-001 runs spawned it (none-3, old-1, old-2, new-2, new-3). It is available to every arm equally.

### Per run, goals

Duration, cost and tokens as `yarn run-stats --runs` prints them (the transcript footer); `wall` is `executor.yaml` where the footer disagrees (see Cost). "commit" is a `git commit` in the transcript. "lib" is the number of files the run wrote under `src/lib/` that the evidence snapshot dropped (see Evidence gap).

| Run | Arm | Expects | Duration | Cost | Tokens | Agent | commit | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| goal-001 `…T142738Z-claude-no-skill-1` | none | f f f f p f | 1993s | $2.16 | 1766085 | 0 | yes | raw `useBalance`, transactor-toast comment |
| goal-001 `…T142738Z-claude-no-skill-2` | none | f p f f p p | 952s | $2.00 | 1409500 | 0 | no | ended on background install |
| goal-001 `…T142738Z-claude-no-skill-3` | none | f p f f p p | 395s (wall 3072s) | $4.84 | 558857 (last footer only) | 1 | no | two result footers |
| goal-001 `…T144538Z-claude-with-skill-2f0adb01-2` | old | p p p p p f | 2047s | $4.34 | 3547544 | 1 | no | hardhat kept, "switch after deploy" |
| goal-001 `…T150604Z-claude-with-skill-2f0adb01-1` | old | p p p p p f | 1962s | $5.34 | 5051899 | 1 | yes | hardhat kept |
| goal-001 `…T152243Z-claude-with-skill-2f0adb01-3` | old | p p p p p f | 1557s | $4.10 | 4198618 | 0 | no | hardhat kept |
| goal-001 `…T152538Z-claude-with-skill-d9952522-2` | new | p p p p p p | 88s (wall 1137s) | $4.55 | 446658 (last footer only) | 1 | yes | two result footers |
| goal-001 `…T153958Z-claude-with-skill-d9952522-1` | new | p p p p p p | 639s | $4.09 | 3871297 | 0 | yes | labels "USD price unavailable" |
| goal-001 `…T154929Z-claude-with-skill-d9952522-3` | new | p p p p p p | 726s | $5.13 | 4255275 | 1 | yes | |
| goal-002 `…T142738Z-claude-no-skill-3` | none | p p f p p f | 1974s | $1.35 | 716781 | 0 | yes | lib 5 |
| goal-002 `…T142739Z-claude-no-skill-1` | none | p p f p p f | 1739s | $2.00 | 1227741 | 0 | yes | lib 9 |
| goal-002 `…T142739Z-claude-no-skill-2` | none | p p f f p f | 748s | $1.13 | 479905 | 0 | no | ended on background install; no dependency block |
| goal-002 `…T144138Z-claude-with-skill-2f0adb01-2` | old | p p p p p p | 1228s | $1.61 | 896201 | 0 | yes | |
| goal-002 `…T145800Z-claude-with-skill-2f0adb01-1` | old | p p p p p p | 1264s | $1.97 | 1037228 | 0 | no | lib 12 |
| goal-002 `…T150201Z-claude-with-skill-2f0adb01-3` | old | p p p p p p | 2111s | $2.50 | 1746147 | 0 | yes | lib 6 |
| goal-002 `…T150448Z-claude-with-skill-d9952522-2` | new | p p p p p p | 907s | $1.84 | 1077926 | 0 | yes | lib 1 |
| goal-002 `…T152013Z-claude-with-skill-d9952522-1` | new | p p p p p p | 1029s | $1.86 | 1202246 | 0 | no | lib 8 |
| goal-002 `…T153751Z-claude-with-skill-d9952522-3` | new | p p p p p p | 337s | $1.63 | 869510 | 0 | no | |

## Evidence gap: `src/lib/` is dropped from bare-task snapshots

`GENERATED_DIRS` in `lib/workspace.ts` lists `lib`, and `lib/evidence.ts` excludes it as `**/lib/**` when it snapshots a bare workspace into `output/`. Six of the nine goal-002 runs put code under `src/lib/` — `useRecipient.ts`, `prices.ts`, `errors.ts`, `recipient.ts`, `wagmi.ts`, `format.ts` and their tests — and none of those files reached the judge:

| Run | Files under `src/lib/` written, none captured |
| --- | --- |
| none-3 | errors, format, parse, usdc, wagmi |
| none-1 | errors, format(+test), usdc, useDebouncedValue, usePayerBalances, validation(+test), wagmi |
| old-1 | amount(+test), contracts, env, errors(+test), format(+test), hooks, recipient(+test), wagmi |
| old-3 | contracts, errors, format, site, socialImage, wagmi |
| new-2 | wagmi |
| new-1 | empty-module, errors, format, prices, tokens, useBalances, useDebounced, useRecipient |

What it means for the grades: the none fails (e3, e6) are on files that were captured (`layout.tsx`, the page and components) and no price code exists anywhere in those transcripts, so they stand on evidence. The skill-arm passes on e1, e3 and e5 in old-1, old-3 and new-1 rest on call sites the judge could see (`recipient.ensName`, `useUsdPrice`, `humanizeError`) and not on the code behind them; the judge accepted them. **Those grades are not fully auditable from the committed record**: `transcript.md` truncates the heredocs that wrote the files, and the full contents survive only in the gitignored `transcript.jsonl` on the machine that made the runs. This is the harness, not this column — it hits every operator's goal-002 and every earlier goal-002 sitting on `main` the same way — so it is raised on #119 rather than fixed on this branch.

## Trigger

Not forced. Counted from `transcript.jsonl` (`"name":"Skill"` calls, and `cat`/`grep` of `frontend-ux/SKILL.md` without a Skill call):

| Task | new: Skill tool | old: Skill tool | old: read the file some other way |
| --- | --- | --- | --- |
| `frontend-ux-quiz-001` | 3/3 | 3/3 | — |
| `frontend-ux-quiz-002` | 3/3 | **1/3** | +1 (`grep -i "decimal\|parseEther\|formatUnits" .claude/skills/frontend-ux/SKILL.md`) |
| `frontend-ux-quiz-003` | 3/3 | 3/3 | — |
| `frontend-ux-quiz-005` | 3/3 | 3/3 | — |
| `frontend-ux-goal-001` | 3/3 | 3/3 | — |
| `frontend-ux-goal-002` | 3/3 | 3/3 | +1 (old-2 also `cat`/`grep`'d it after the Skill call) |

Both descriptions trigger on these prompts on claude, which is unusual across the major-refine rows: the old description's "Use whenever you are building a frontend for an Ethereum dApp" fires on a pasted wagmi snippet inside a support ticket. The one miss is quiz-002 (a units question, not a UI question) where the old text fired 1/3; the new description names "token amounts and decimals" and fired 3/3. The with_skill quiz columns are real with_skill measurements — and they still tie the none column, because the model did not need the text.

quiz-002's notes ask where the 6-decimals fact came from: no run searched the web or fetched anything (0 WebSearch/WebFetch calls in 9 runs); every answer came from parametric memory, with the arithmetic done inline or in a `python3 -` heredoc. quiz-005's notes ask whether a dedicated address component was reached for: 9/9 (the e3 line), including all three none runs.

## Cost

From `yarn run-stats --tasks <six ids> --benchmark major-refine-d9952522`, split per arm with `--variant no_skill`, `--skill-version 2f0adb01`, `--skill-version d9952522`. Medians with ranges; `cost_source: executor`.

| Task | Arm | n | turns | duration | cost | cost range | tokens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `frontend-ux-quiz-001` | new | 3 | 4 | 46s | $0.24 | $0.22–$0.25 | 60086 |
| | old | 3 | 4 | 53s | $0.26 | $0.25–$0.29 | 64099 |
| | none | 3 | 2 | 63s | $0.27 | $0.25–$0.28 | 43915 |
| `frontend-ux-quiz-002` | new | 3 | 6 | 36s | $0.20 | $0.19–$0.21 | 76642 |
| | old | 3 | 4 | 29s | $0.17 | $0.17–$0.22 | 73285 |
| | none | 3 | 4 | 42s | $0.20 | $0.19–$0.23 | 74134 |
| `frontend-ux-quiz-003` | new | 3 | 4 | 67s | $0.25 | $0.23–$0.28 | 60701 |
| | old | 3 | 4 | 49s | $0.25 | $0.25–$0.26 | 62477 |
| | none | 3 | 4 | 87s | $0.27 | $0.27–$0.32 | 78213 |
| `frontend-ux-quiz-005` | new | 3 | 6 | 48s | $0.23 | $0.21–$0.24 | 78499 |
| | old | 3 | 6 | 45s | $0.24 | $0.23–$0.26 | 81839 |
| | none | 3 | 4 | 50s | $0.22 | $0.19–$0.24 | 74527 |
| `frontend-ux-goal-001` | new | 3 | 56 | 639s | $4.55 | $4.09–$5.13 | 3871297 |
| | old | 3 | 55 | 1962s | $4.34 | $4.10–$5.34 | 4198618 |
| | none | 3 | 28 | 952s | $2.16 | $2.00–$4.84 | 1409500 |
| `frontend-ux-goal-002` | new | 3 | 28 | 907s | $1.84 | $1.63–$1.86 | 1077926 |
| | old | 3 | 25 | 1264s | $1.97 | $1.61–$2.50 | 1037228 |
| | none | 3 | 20 | 1739s | $1.35 | $1.13–$2.00 | 716781 |

**Two goal-001 rows are distorted by a second result footer.** none-3 and new-2 resumed after a background-task notification, and the claude stream emitted a second `result` event, so `transcript.md` carries two `## run stats` footers. `run-executor` wrote the last one into `result.yaml` and `run-stats` reads the same: none-3 is recorded as 5 turns / 395s / 558857 tokens where the first footer says 57 turns / 2635s / 4.0M input tokens and the wall clock is 3072s; new-2 as 4 / 88s / 446658 where the first footer says 54 / 977s / 3.6M and the wall clock is 1137s. Cost is cumulative and the same in both footers, so the dollar columns are right. Read with the wall clock and the first footer's tokens added in, the goal-001 medians become: none 2002s / ~1.77M tokens, new 727s / ~4.0M tokens; old is unaffected. That is a harness gap (sum the footers, or take the wall clock the harness already records), raised on #119 with the evidence gap.

- **goal-001:** both skill arms cost about twice the none arm — `$4.55` new, `$4.34` old, `$2.16` none — and use about three times the tokens, because they do the work the none arm skips (layout metadata, header and hero branding, a price hook with a label, inline errors) and four of the six spawn the template's reviewer subagent. New is the fastest arm on the wall clock (727s median corrected, against 1962s old and 2002s none) at the same price as old; n=3, ranges overlap on cost.
- **goal-002:** new `$1.84 / 1.08M / 907s`, old `$1.97 / 1.04M / 1264s`, none `$1.35 / 717k / 1739s`. Same shape: the skill arms pay ~40% over none for the price fetch, the icon and OG image, and the error translation; new is faster than old with the tightest cost range (`$1.63–$1.86`).
- **Quizzes:** all three arms within a few cents on every quiz; the skill costs ~15–20k tokens of cache write and changes no answer.

## Records

- **Updated:** `eth-balance-no-usd-context` (none 6/6, old 0/6, new 0/6; the SE-2 `<Balance>`-on-toggle judge note), `metadata-left-as-template-default` (none 6/6 on the split e3/e4 rubric, 0/6 either skill arm), `target-network-not-retargeted` (none 1/3, **old 3/3**, new 0/3; the "deploy first, then retarget" deferral is now in the symptom; `skill_section` moved to "Target chain"), `frontend-ux-unsurfaced-tx-error` (none 1/6, 0/12 skill; shape (c), the transactor-toast comment), `address-input-no-ens-resolution` (**not reproduced**: none 0/3 on this stack, stays open for the other stacks).
- **New:** `frontend-ux-send-button-released-at-receipt` (goal-002 none 1/3, 0/6 skill; judge reasoning not recorded) and `frontend-ux-run-ends-waiting-on-background-install` (none 2/6, 0/12 skill; a print-mode interaction, not a skill claim).
- All 36 quiz `output/answer.md` files (256K total) and all nine goal-002 `output/` trees (68–104K each, minus the `src/lib/` files above) are force-added; goal-001's evidence is `run.diff`. Every run is regradeable on the evidence the judge saw.
- `yarn clean-workspaces` was not run: `verify` deleted every frontend-ux workspace, and other operators' runs were live in sibling worktrees during this sitting, which the sweep would list as orphans.

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | New vs none: **yes**, `18/18` vs `12/18` — both goals `3/3` vs `0/3`, on USD context, metadata, branding and identity; quizzes tie `12/12` each. New vs old: **yes, by one line**, `18/18` vs `15/18` — goal-001 e6 (retarget to Base), old `0/3`, new `3/3`; everything else ties. |
| Did it reduce time/tokens? | New vs none: no — goal-001 `$4.55 / ~4.0M` vs `$2.16 / ~1.77M`, goal-002 `$1.84 / 1.08M` vs `$1.35 / 717k`; the skill arms do more. New vs old: cost equal within noise (`$4.55` vs `$4.34`, `$1.84` vs `$1.97`), tokens equal, wall clock shorter on both goals (`727s` vs `1962s`, `907s` vs `1264s`; n=3). Quizzes equal in all arms. |
| Did it create negative deltas? | Cost on both goals vs none (above). No grade moved down in either skill arm. The goal-002 evidence gap and the double-footer stats are harness defects, not skill deltas. |
| What mistakes repeated without the skill? | `eth-balance-no-usd-context` 6/6, `metadata-left-as-template-default` 6/6, `target-network-not-retargeted` 1/3, `frontend-ux-unsurfaced-tx-error` 1/6, `frontend-ux-send-button-released-at-receipt` 1/3, `frontend-ux-run-ends-waiting-on-background-install` 2/6. Not reproduced: `address-input-no-ens-resolution` 0/3. |
| What mistakes remained with the skill? | Old arm: `target-network-not-retargeted` **3/3** — the one line the old text does not carry. New arm: none. |
| What should change in the skill? | Nothing this column demands of the new text. Keep the "Target chain" paragraph and the closing "confirm the configured target chain" line: they are the only measured old→new gain, and the old arm's miss was a reasoned deferral ("deploy to Base first, then retarget", because SE-2 derives types from the first network), so a clause that says to point the config at the brief's chain *even before the contract is deployed there* would name the exact excuse. The 186→26 line cut lost nothing measurable on Opus 5 medium. |
| What should change in the eval? | (1) Harness: `lib` in `GENERATED_DIRS` strips `src/lib/` from bare-task snapshots — six of nine goal-002 runs graded on call sites only; anchor the exclude to the workspace root or drop `lib` for bare tasks. (2) Harness: when a session resumes after a background task the stream carries two result events and `result.yaml`/`run-stats` keep only the last one's turns, tokens and duration; sum them or use the wall clock already in `executor.yaml`. (3) The quizzes are saturated on this stack, 36/36, and rank nothing; wait for the GPT 5.5 / Kimi / GLM columns. (4) goal-001 e1 names SE-2's native-currency price as the source but a judge reading the diff cannot see that `<Balance>` carries it; say whether USD-on-click counts, because that decides two of the three none fails. (5) Judge reasoning is not stored, so three grades here (goal-001 none-1 e2, goal-002 none-2 e4, and the e1 toggle calls) can be described but not audited. |
