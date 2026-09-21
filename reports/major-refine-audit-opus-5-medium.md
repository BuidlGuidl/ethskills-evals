# major-refine: `audit` on Opus 5 medium

**Benchmark id:** `major-refine-d9952522` (issue [#119](https://github.com/BuidlGuidl/ethskills-evals/issues/119))

| | |
| --- | --- |
| Executor | `claude` · `claude-opus-5` · effort `medium` |
| Judge | `claude` · `claude-opus-5` · effort `high` |
| `self_judged` | **true** on all 37 records — judge and executor are the same agent |
| Runs | 3 per arm per task, 4 tasks × 3 arms = **36 counted runs**; 37 records (one retracted, one replacement), all `executor_exit: 0` |
| Harness / retractions | 0 `harness_failure`, 0 dead runs, **1 `retracted`** (goal `new` run 1, see Blindness) |
| Trigger | not forced — numbers are trigger-inclusive |
| Checklist revision | new arm pins `evm-audit-skills@ffe4b670`; old arm points at `main` (unpinned) |

**Arms**

| Arm | Variant | `skill_version` | Skill text |
| --- | --- | --- | --- |
| none | `no_skill` | `null` | — |
| old | `with_skill` | `2f0adb01` | first vendored `audit` skill, 72 lines: master index on `main`, "spawn one opus sub-agent per skill", "file GitHub issues" |
| new | `with_skill` | `d9952522` | refined skill, 63 lines: pinned checklist revision, 5–8 checklists, no publishing without confirmation |

Both `skill_version` commits are ancestors of HEAD.

**Tasks** — all four live tasks whose `skill:` is `skills/audit`.

- `audit-goal-001` — template `audit-market-001`, an Arbitrum lending market with eleven planted vulnerabilities (expects 1–11) plus a severity check (expect 12). Its notes say to read it as findings-caught-out-of-11, not as pass/fail.
- `audit-quiz-001` — post-mortem: sequencer outage, sequencer uptime feed + grace period.
- `audit-quiz-002` — `block.number` as a clock on Arbitrum vs Base.
- `audit-quiz-003` — `borrowWithSig` replay, nonce + deadline, cached domain separator.

## Headline — pass counts, new · old · none

| Task | new · old · none | Per run |
| --- | --- | --- |
| `audit-goal-001` | `3/3 · 3/3 · 3/3` | 11/11 findings + severity in every run, every arm (33/33 · 33/33 · 33/33 findings) |
| `audit-quiz-001` | `3/3 · 3/3 · 3/3` | 4/4 expects everywhere |
| `audit-quiz-002` | `3/3 · 3/3 · 3/3` | 4/4 expects everywhere |
| `audit-quiz-003` | `3/3 · 3/3 · 3/3` | 4/4 expects everywhere |
| **total** | **`12/12 · 12/12 · 12/12`** | |

**Saturated.** Not one expect line failed in any of the 36 counted runs (nor in the retracted one). On Opus 5 medium the audit tasks measure the executor model: it finds all eleven planted bugs, ranks `upgradeTo` first in all ten goal reports, and answers all three quizzes without reading anything. The prior claude sittings (2026-08-12, 2026-08-27) were already 11/11 on the goal; this confirms it on the pinned harness against three arms. The codex sittings (2026-09-02, 2026-09-04) are where this task separated anything.

## Blindness: the new arm's goal reports name the checklists

`verify` refused every `new` draw of `audit-goal-001` with a `[checklist provenance]` hit on `run.diff:11`, the report's Method line:

| Run | Method line (start) |
| --- | --- |
| new-1 (retracted) | "Manual line-by-line review, checked against the pinned `evm-audit-skills` checklists (general, precision-math, lending, oracles, chain-specific/Arbitrum, signatures, proxies, ERC20)." |
| new-4 (replacement for 1) | "Manual line-by-line review. Cross-checked against the evm-audit-skills checklists pinned at `ffe4b67` (general, precision-math, lending, oracles, chain-specific, signatures, proxies)." |
| new-2 | "manual line-by-line review against general, precision-math, lending, oracle and Arbitrum-specific checklists." |
| new-3 | "manual line-by-line review, checked against lending, oracle, Arbitrum-specific, ERC20, proxy, signature and DoS checklists." |

No `none` or `old` report carries anything like it, so a judge reading those lines knows the arm. What was done, in order:

1. Run 1 was refused, so it was graded with `--allow-skill-mention` to complete the record, then **retracted** in its `result.yaml` and replaced by run 4, following the 2026-09-04 codex precedent (`2026-09-04T155051Z-codex-with-skill-3`, replaced by run 4 of that sitting).
2. Run 4 leaked the same line. So did runs 2 and 3: **4 of 4 draws**. At that point the leak is a property of the arm on this stack, not an accident to re-draw around — re-drawing until a clean run appeared would select for runs that skipped the checklists, which is a different arm. Runs 2, 3 and 4 were graded with `--allow-skill-mention` and **counted**; run 1 stays retracted so the arm is three draws like the others, not four.
3. **None of the new arm's goal grades were made blind.** The judge could not have been moved by it here — every `none` and `old` run scored the same 11/11 plus severity, so there was nothing for a knowing judge to raise — but on a task that discriminated it would matter. Filed as `audit-checklist-provenance-in-report` (below). On the quizzes nothing leaked, because no quiz run loaded the skill.

## Trigger

Not forced, so which arms actually read the skill matters. Counted from `transcript.jsonl` (`"name":"Skill"` calls, reads of `skills/audit/SKILL.md`, and `curl` of the checklist repo), not from the rendered transcript:

| Task | new: Skill tool | new: read SKILL.md | old: Skill tool | old: read SKILL.md |
| --- | --- | --- | --- | --- |
| `audit-goal-001` | 4/4 | 4/4 | **0/3** | 3/3 (found it with `find`/`ls`, `cat`) |
| `audit-quiz-001` | 0/3 | 0/3 | 0/3 | 0/3 |
| `audit-quiz-002` | 0/3 | 0/3 | 0/3 | 0/3 |
| `audit-quiz-003` | 0/3 | 0/3 | 0/3 | 0/3 |

- **Quizzes: 0/18.** Neither description triggers on a pasted snippet inside a post-mortem or support ticket on claude; every with_skill quiz run made one or two tool calls (a heredoc writing `answer.md`, sometimes after an `ls`). The three quiz columns above are three `none` columns. `audit-skill-not-invoked-on-prose-question` re-measured at 9/9 for both arms.
- **Goal, old arm:** the Skill tool never fired on the old description, but all three runs listed the workspace, saw `.agents/skills/audit/SKILL.md`, and `cat`'ed it. Having read it, none followed it: 0/3 fetched the master index or a checklist, 0/3 spawned an agent, 0/3 tried to file an issue. Two wrote forge proofs of concept in `/tmp` and one queried the Arbitrum feed contracts with `cast` instead.
- **Goal, new arm:** the new description triggers 4/4. Each run `curl`ed pinned checklists in one Bash loop and read them inline — new-1: 8, new-4: 7, new-2: 4, new-3: 3. Step 3 says to always load `general` and `precision-math` for a full audit; new-2 skipped `general` and new-3 skipped both. 0/4 spawned a sub-agent (`audit-subagent-fanout-not-executed` re-measured at 4/4).

## Record, do not grade (goal task)

Per the task notes, per run: sub-agents, checklists, false positives, how expects 4/6/7 were reached, expect 5's chain semantics, leftovers, publishing.

| Run | Arm | Findings/11 | Sev | Agents | Checklists fetched | Compiled the code | RPC (`cast`) | Extra files |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `…T125710Z-claude-no-skill-1` | none | 11 | pass | 0 | 0 | `forge build` + PoC in `/tmp` | 0 | none |
| `…T131044Z-claude-no-skill-2` | none | 11 | pass | 0 | 0 | no | 0 | none |
| `…T132239Z-claude-no-skill-3` | none | 11 | pass | 0 | 0 | no | 10 | none |
| `…T130113Z-claude-with-skill-2f0adb01-1` | old | 11 | pass | 0 | 0 | `forge test` PoC in `/tmp` | 8 | none |
| `…T131413Z-claude-with-skill-2f0adb01-2` | old | 11 | pass | 0 | 0 | `forge test` PoC in `/tmp` | 0 | none |
| `…T132656Z-claude-with-skill-2f0adb01-3` | old | 11 | pass | 0 | 0 | no | 0 | none |
| `…T130704Z-claude-with-skill-d9952522-1` | new, **retracted** | 11 | pass | 0 | 8 (+2 retried) | no | 0 | none |
| `…T131202Z-claude-with-skill-d9952522-4` | new | 11 | pass | 0 | 7 | no | 0 | none |
| `…T131906Z-claude-with-skill-d9952522-2` | new | 11 | pass | 0 | 4 | no | 0 | none |
| `…T133118Z-claude-with-skill-d9952522-3` | new | 11 | pass | 0 | 3 | no | 0 | none |

- **False positives: 0** at the finding level in all ten reports. Every heading is either a planted bug or on the notes' list of true ungraded findings, except four that recur in most reports and are not on that list; all four are true of `src/` as checked for this report: no function returns USDC liquidity or interest to the owner ("treasury USDC locked", 10/10); `requireHealthy` is `view` and does not accrue before checking (8/10); `_borrow` checks health against the liquidation threshold itself, so there is no buffer (8/10); `listCollateral` does not check a feed exists (9/10). Also reported across arms: all-or-nothing liquidation with no bad-debt path (10/10), unprotected `initialize` (10/10), rounding dust (9/10), the cached domain separator (10/10 mention it, counted toward expect 8).
- **Lint handover (expects 4, 6, 7):** only 3 of 10 runs compiled the code (none-1 `forge build` in the workspace with the output redirected to `/tmp`; old-1 and old-2 `forge test` on a `/tmp` copy). The other 7 found all three by reading, so the `forge build` lint cannot explain those cells on this stack.
- **Expect 5 chain semantics:** all 10 reports state that Arbitrum's `block.number` approximates the L1 block, so the 12-second constant is near-correct there by coincidence and would break on a chain whose `block.number` counts L2 blocks; all 10 prescribe `block.timestamp`.
- **Severity:** all ten reports open with `upgradeTo` as C-1, then `setOracle`, then `setLiquidationThreshold`; expect 12 passed everywhere. The `withdraw` reentrancy sits in Medium in all ten, qualified on wstETH having no hook.
- **Leftovers / publishing:** no run left a file other than `AUDIT-REPORT.md` (every `run.diff` touches that file alone); none-1 and old-2 removed the `/tmp` proof-of-concept dirs they made; old-1 left its `/tmp/arbipoc.*` copy behind, outside the workspace and so outside the evidence. A scan of all 37 transcripts for `gh issue`, `gh api`, `git push` or a POST found nothing — the old skill's "file GitHub issues" step was never attempted.

## Cost

From `yarn run-stats --tasks audit-goal-001,audit-quiz-001,audit-quiz-002,audit-quiz-003 --benchmark major-refine-d9952522`, split per arm with `--variant no_skill`, `--skill-version 2f0adb01`, `--skill-version d9952522`. Medians with ranges; `cost_source: executor`.

| Task | Arm | n | turns | duration | cost | cost range | tokens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `audit-goal-001` | new (3 counted, see below) | 3 | 9 | 217s | $1.14 | $1.01–$1.17 | 310050 |
| | new (as `run-stats` prints, incl. retracted run 1) | 4 | 9 | 217s | $1.09 | $1.01–$1.17 | 295477 |
| | old | 3 | 10 | 274s | $1.31 | $1.03–$1.52 | 402102 |
| | none | 3 | 7 | 224s | $1.04 | $0.86–$1.08 | 250937 |
| `audit-quiz-001` | new | 3 | 2 | 48s | $0.21 | $0.20–$0.23 | 41181 |
| | old | 3 | 2 | 45s | $0.23 | $0.21–$0.23 | 41871 |
| | none | 3 | 2 | 44s | $0.22 | $0.22–$0.24 | 41741 |
| `audit-quiz-002` | new | 3 | 3 | 58s | $0.28 | $0.24–$0.28 | 63292 |
| | old | 3 | 2 | 49s | $0.25 | $0.24–$0.29 | 43723 |
| | none | 3 | 3 | 54s | $0.27 | $0.26–$0.31 | 62977 |
| `audit-quiz-003` | new | 3 | 2 | 53s | $0.26 | $0.25–$0.27 | 43854 |
| | old | 3 | 2 | 50s | $0.25 | $0.24–$0.26 | 43245 |
| | none | 3 | 2 | 46s | $0.23 | $0.22–$0.23 | 42053 |

`run-stats` cannot exclude a retracted run, so its `--skill-version d9952522` goal row is n=4. The counted row is read off `run-stats --runs`: run 4 `227s / $1.17 / 310050`, run 2 `208s / $1.14 / 330541`, run 3 `217s / $1.01 / 245224`; the median of three is the middle value in each column.

- **Goal:** new is the cheapest skill arm and within noise of none: `$1.14 / 310k / 217s` against old `$1.31 / 402k / 274s` and none `$1.04 / 251k / 224s`. Old costs the most — its runs wrote and ran forge proofs of concept — with the widest range ($1.03–$1.52). New pays about 60k tokens over none for the checklists it curls in, and gets nothing for them on this fixture. n=3, ranges overlap.
- **Quizzes:** all three arms cost the same within a few cents, because no arm loads anything. The spread on quiz-002 (`$0.24–$0.31`) is one run in each of none and new taking a third turn.

## Records

- **New:** `audit-checklist-provenance-in-report` — new arm 4/4 on claude/opus-5 at d9952522, 0/3 old, 0/3 none; the codex 7be55c8b retraction of 2026-09-04 was the first instance and is carried as 1/4 there. Section: "The Checklists"; the report line paraphrases the skill's own pinning sentence.
- **Updated:** `audit-skill-not-invoked-on-prose-question` (9/9 old, 9/9 new), `audit-subagent-fanout-not-executed` (3/3 old, 4/4 new, plus the old arm's 0/3 checklist fetches), and the five missed-vulnerability records (`audit-block-number-clock-missed`, `audit-cached-domain-separator-missed`, `audit-liquidate-all-unbounded-loop-missed`, `audit-sequencer-liveness-missed`, `audit-withdraw-reentrancy-ordering-missed`) each with a 0/3 · 0/3 · 0/3 measurement for this stack.
- All 27 quiz `output/answer.md` files are force-added (8–12K each); the goal runs' evidence is `run.diff`. Every run stays regradeable.
- `yarn clean-workspaces` was not run: `verify` deleted every audit workspace, and another operator's runs were live in a sibling worktree during this sitting, which the sweep would list as orphans.

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | No — `12/12 · 12/12 · 12/12` (new · old · none); goal 33/33 findings in every arm. Saturated. |
| Did it reduce time/tokens? | New vs old: yes on the goal, `217s / 310k / $1.14` vs `274s / 402k / $1.31` (n=3, ranges overlap). New vs none: no, `$1.14 / 310k` vs `$1.04 / 251k`; the checklists cost ~60k tokens and changed no grade. Quizzes: equal in all arms, since none loads the skill. |
| Did it create negative deltas? | Goal cost: new +~60k tokens / +$0.10 over none. Blindness: new leaked the arm in 4/4 goal reports, so its goal grades are not blind. Coverage: two of three counted new runs skipped `general` / `precision-math`, which the skill says to always load. |
| What mistakes repeated without the skill? | None graded: all five missed-vulnerability records 0/3. |
| What mistakes remained with the skill? | `audit-checklist-provenance-in-report` (new, 4/4), `audit-subagent-fanout-not-executed` (old 3/3, new 4/4), `audit-skill-not-invoked-on-prose-question` (old 9/9, new 9/9). |
| What should change in the skill? | (1) Tell the executor the report is for the client and must not name the checklist repository or the skill — the one edit this benchmark justifies. (2) The description still does not trigger on a pasted snippet in a post-mortem on claude; if the quizzes are meant to be with_skill measurements, name that shape. (3) Either drop the "always load `general` and `precision-math`" rule or say why; 2/3 runs ignored it at no measured cost. |
| What should change in the eval? | All four tasks are saturated on Opus 5 medium and cannot rank the arms. The goal fixture (420 lines) fits one context, so the fan-out the skill prescribes is never forced; a fixture too large for one read, or planted bugs the model does not find by reading, is what would make this column say something. The quiz `with_skill` columns need either a forced trigger (reported as such) or a prompt shape the description names. Wait for the GPT 5.5 / Kimi / GLM columns first — codex did not saturate this task. |
