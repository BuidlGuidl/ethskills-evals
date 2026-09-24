# major-refine: qa on GPT 5.5 high

- **Benchmark:** `major-refine-d9952522` ([#119](https://github.com/BuidlGuidl/ethskills-evals/issues/119))
- **Stack:** executor `codex`, model `gpt-5.5`, effort `high`
- **Judge:** `claude`, `claude-opus-5`, effort `high`, on every run. `self_judged: false` on all 63.
- **Arms:** none (`no_skill`), old (`with_skill`, `skill_version: 2f0adb01`, the first vendored text, 2821 words), new (`with_skill`, `skill_version: d9952522`, the refined text, 885 words)
- **Runs:** 3 per arm per task, 63 in all, every one graded. Trigger-inclusive: nothing forced the skill.
- **Tasks:** qa-quiz-001, qa-quiz-002, qa-quiz-003, qa-quiz-004, qa-quiz-005, qa-goal-001, qa-goal-002
- **Dates:** 2026-09-22 to 2026-09-24

One `expect_sha` and one `input_sha` per task across all nine runs of it, so every
grade below is on the same rubric and the same prompt.

## Headline

Pass counts, new · old · none:

| Task | new | old | none |
| --- | --- | --- | --- |
| qa-quiz-001 | 3/3 | 3/3 | 3/3 |
| qa-quiz-002 | 3/3 | 3/3 | 3/3 |
| qa-quiz-003 | 3/3 | 3/3 | 2/3 |
| qa-quiz-004 | 3/3 | 2/3 | 3/3 |
| qa-quiz-005 | 3/3 | 2/3 | 3/3 |
| qa-goal-001 | 0/3 | 1/3 | 0/3 |
| qa-goal-002 | 3/3 | 3/3 | 0/3 |
| **all** | **18/21** | **17/21** | **14/21** |

The quizzes do not separate the arms on this model: GPT 5.5 knows the five claims
cold. The two goals are where the skill works, and per-check counts say more than
pass/fail there.

**qa-goal-002** (fix the app unprompted, 14 checks): both skill texts pass 14/14 on
all six runs; no_skill passes 5, 5 and 6. The no_skill misses fall on these nine
checks: connect button (e1), wrong-network branch (e2), USDC to
externalContracts.ts (e5), AddressInput (e6), Address component + contract address
(e7), loading class (e10, 2/3), `--radius-field` (e11), `pollingInterval` (e12),
README/footer (e14).

**qa-goal-001** (review the app, 18 checks), checks passed per run:

| Arm | run 1 | run 2 | run 3 | Failed checks |
| --- | --- | --- | --- | --- |
| new | 17 | 16 | 16 | e17 ×3, e16 ×1, e1 ×1 |
| old | 18 | 17 | 17 | e8 ×2 |
| none | 9 | 8 | 7 | e1, e7, e8, e10, e11, e12, e13, e17, e18 ×3; e5 ×2; e6 ×1 |

New and old both lift the review from about 8/18 to about 17/18. The pass counts
(0/3 vs 1/3) come down to one check each.

## The regression: mobile deep-linking (goal-001 e17)

e17 asks the review to flag that the app has no mobile deep-link handling (on
WalletConnect, tapping a transaction button opens nothing). The old text flags it
3/3 and the new text 0/3. All three new-text runs read `SKILL.md`, so this is the
content, not the trigger. It is the only check where the old text beats the new
one on runs that read the skill.

The cause is visible in the texts. The old skill has an "Important: Mobile Deep
Linking" section: PASS/FAIL list, a `writeAndOpen` pattern, and three checklist
lines. The refined skill has one bullet under `## Mobile`. The model still knows
the material: the same arm passes qa-quiz-004 (deep-linking, asked directly) 3/3,
with the skill read 3/3. In an unprompted audit, one bullet is not enough to put
it on the reviewer's list. This is what `qa-deeplink-delay-magnitude` now
records.

The old arm's two goal-001 failures are both e8, the Payouts contract address
shown nowhere on the page. The new text states that explicitly and passes it 3/3.

## Trigger rates

`SKILL.md` read (grep of `skills/qa/SKILL.md` in `transcript.md`):

| | quizzes | goals |
| --- | --- | --- |
| old (2f0adb01) | 6/15 | 6/6 |
| new (d9952522) | 15/15 | 6/6 |

The refined description triggers on the quiz framing, and the old one mostly does
not. Both old-arm quiz failures (quiz-004 run 1, quiz-005 run 2) are runs that
never opened the skill, so they are baseline answers that landed in the old arm,
not something the old text taught.

## The three quiz failures, read

All three are narrow, and the rubric is strict on each:

- **quiz-003, none, run 2 (e3):** fixed `--radius-field` in both theme blocks, but
  to `0rem`, which the expect does not count as "~0.5rem or similar".
- **quiz-004, old, run 1 (e2):** correct order (write first, deep-link after),
  with a 750–1000ms delay where the expect wants about 2s. Skill not read.
- **quiz-005, old, run 2 (e2):** proposed a production network trace as the proof
  and explicitly rejected checking the host's env settings, which is the check the
  expect grades. Skill not read.

## Cost

From `yarn run-stats --tasks <all seven> --benchmark major-refine-d9952522`, split
by `--variant no_skill`, `--skill-version 2f0adb01` and `--skill-version d9952522`.
Medians per task, n=3 each. Codex dollars are `cost_source: list_price`: the
run's token split at OpenAI's standard list price in `lib/prices.ts`, not what the
account was billed. Codex reports no turn count.

| task | arm | duration | cost | cost range | tokens |
| --- | --- | --- | --- | --- | --- |
| qa-quiz-001 | none | 84s | $0.44 | $0.42–$0.45 | 173297 |
| | old | 82s | $0.39 | $0.28–$0.46 | 167026 |
| | new | 57s | $0.22 | $0.22–$0.24 | 94286 |
| qa-quiz-002 | none | 76s | $0.45 | $0.17–$0.63 | 155405 |
| | old | 94s | $0.51 | $0.49–$0.66 | 250920 |
| | new | 61s | $0.48 | $0.32–$0.51 | 162897 |
| qa-quiz-003 | none | 64s | $0.29 | $0.25–$0.33 | 124115 |
| | old | 79s | $0.31 | $0.30–$0.33 | 136029 |
| | new | 57s | $0.17 | $0.16–$0.31 | 111192 |
| qa-quiz-004 | none | 142s | $0.94 | $0.47–$1.00 | 280040 |
| | old | 131s | $0.79 | $0.34–$1.06 | 361089 |
| | new | 110s | $0.54 | $0.49–$0.65 | 212296 |
| qa-quiz-005 | none | 115s | $0.66 | $0.59–$0.70 | 257997 |
| | old | 112s | $0.57 | $0.42–$0.61 | 259808 |
| | new | 118s | $0.67 | $0.43–$0.70 | 263600 |
| qa-goal-001 | none | 258s | $1.16 | $0.99–$1.36 | 1008824 |
| | old | 213s | $1.11 | $0.96–$1.54 | 910147 |
| | new | 226s | $0.93 | $0.90–$1.07 | 593643 |
| qa-goal-002 | none | 691s | $3.10 | $2.91–$3.44 | 3769225 |
| | old | 1221s | $6.57 | $4.45–$7.45 | 9084247 |
| | new | 929s | $4.90 | $4.24–$5.22 | 6444505 |

On the quizzes the new text costs about the same as no skill or less (quiz-002 and quiz-005 are even). On goal-001 it
is the cheapest arm (594k tokens vs 910k old, 1.01M none). On goal-002, making the
nine fixes no_skill skips costs tokens. The new text does the same 14/14 work as the
old for about 70% of the tokens and 75% of the dollars. The ranges overlap on
several quiz rows, so read those medians loosely at n=3.

## Harness notes

- The codex account hit its usage limit seven times during the benchmark: the
  rolling 5-hour window six times and the weekly cap once, with credits added after
  the weekly hit. Each hit killed the runs in flight with `You've hit your usage
  limit`, exit 1. `verify` refused all of them, and per AGENTS.md each was deleted
  with its workspace and set up again under a new run id. 42 dead runs in all, 4 of
  them started by an orchestrator slip before a reset had happened. None was graded
  and none is in the counts above. This is why run ids span 2026-09-22 to 2026-09-24.
  It is also why the arms are not interleaved as evenly as the benchmark skill asks
  on the goals: the later windows ran whatever runs were left, so goal-002's none
  runs 1–2 finished 5–20 hours before its with_skill runs.
- Quiz evidence is `output/answer.md`, force-added so the grades can be re-checked
  and regraded. Goal evidence is `run.diff`.
- No expect lines or inputs were touched. Nothing looks broken in the task set,
  but see the quiz notes above on how strict three of the checks are.

## Mistake records

Updated with a `codex/gpt-5.5` key (none / with_skill_old / with_skill_new):
`qa-connect-button-not-text`, `qa-external-contract-registration`,
`qa-phantom-and-address-display`, `qa-daisyui-theme-cosmetics`,
`qa-branding-left-default`, `qa-deeplink-delay-magnitude` (plus a note on the
regression).

New: `qa-wrong-network-branch-not-built`, `qa-raw-address-input`,
`qa-polling-interval-slow`, `qa-button-lock-unflagged`,
`qa-env-var-host-check-skipped` (1/9, weak).

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | new vs none **18/21 vs 14/21**, all of it on qa-goal-002 (3/3 vs 0/3); goal-001 is 0/3 for both, but 16–17/18 checks vs 7–9/18. new vs old **18/21 vs 17/21**: new wins quiz-004 and quiz-005 (both old losses were untriggered runs), and old wins goal-001 1/3 vs 0/3 on e17. |
| Did it reduce time/tokens? | new vs old: yes on 6 of 7 tasks. goal-002 is 929s / 6.44M / $4.90 vs 1221s / 9.08M / $6.57, goal-001 594k vs 910k tokens. new vs none: cheaper on the quizzes and goal-001, dearer on goal-002 (929s / 6.44M vs 691s / 3.77M) because it does the nine fixes none skips. |
| Did it create negative deltas? | Yes, one: goal-001 e17 (mobile deep-linking in review), old 0/3 missed and new 3/3 missed, with the skill read every time. Also goal-001 e16 (footer/favicon) 1/3 missed on new vs 0/3 on old, and e1 1/3 on new. |
| What mistakes repeated without the skill? | qa-connect-button-not-text, qa-wrong-network-branch-not-built, qa-external-contract-registration, qa-raw-address-input, qa-phantom-and-address-display, qa-daisyui-theme-cosmetics, qa-polling-interval-slow, qa-branding-left-default (fix facet), qa-deeplink-delay-magnitude (review facet), qa-button-lock-unflagged |
| What mistakes remained with the skill? | new: qa-deeplink-delay-magnitude (3/3), qa-branding-left-default (1/12), qa-connect-button-not-text (1/6). old: qa-phantom-and-address-display (contract address, 2/6); qa-deeplink-delay-magnitude and qa-env-var-host-check-skipped only in untriggered quiz runs. |
| What should change in the skill? | Put mobile deep-linking back on the audit list as a named check, not just a principle: "No deep-link handling on WalletConnect transaction buttons is a finding: fire the write, then open the wallet app; skip inside an in-app browser." One line in `## Mobile` phrased as something to flag, or a line in a final checklist if the skill regains one. Keep the refined description: it is why the new text triggers 15/15 on quizzes where the old triggers 6/15. |
| What should change in the eval? | The quizzes are saturated on GPT 5.5 (none 14/15), so they measure cost here, not correctness. quiz-004 e2 and quiz-005 e2 grade one right answer where the model gave a defensible alternative (a ~1s delay; a production network trace), and quiz-003 e3 rejects `0rem`. Worth a rubric look on #119 before other stacks read those lines as skill failures. |
