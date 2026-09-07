# qa (minimal SKILL.md) — claude/opus-5

A fresh benchmark of the compressed `skills/qa`, reported separately from PR #29.
The numbers below are **not** blended with #29's; #29 appears only as the bar to clear.

**Question:** `skills/qa` was cut from 2821 words to 832 (70%) per issue #1 step 4, and the
cut also rewrote two claims — it added an `externalContracts.ts` migration recipe and
replaced the hand-rolled `approveCooldown` timer with `isMining`. Did the cut cost anything?

**Answer:** No, and on this stack it paid. (Review of this PR found two wrong lines in the
benchmarked text and both are fixed in this branch, 832 → 867 words — see "Skill edits";
neither changed a result, and everything below describes the benchmarked `f93bfab3`.) `with_skill` went **3/3 on goal-001 and 3/3 on
goal-002**, against #29's 3/3 and **0/3** — the compressed skill clears the bar on the review
task and beats it on the fix task, sweeping every expect line in all six runs (54/54 and
42/42). Both of #29's `with_skill` residuals closed: goal-002 e5 (`externalContracts`
migration) 1/3 → 3/3 and e7 (Address + contract address) 2/3 → 3/3, the first of them
exactly where the rewrite added a recipe. The cut also reversed the cost sign: #29 reported
"the skill **increases** cost", where here `with_skill` is cheaper than its own baseline on
both tasks — **$1.08 vs $2.07** on goal-001, in half the wall-clock.

Two things complicate the story. The `no_skill` baseline improved sharply (goal-001 26/54 →
38/54, goal-002 14/42 → 27/42), so the graded numbers separate the variants less than they
used to — the same finding #80 reported for noir on this model. And the one measurable cost
of the compression is on an ungraded item: the deleted "USD Values" section took its finding
with it, 3/3 → 0/3. See "What the cut cost".

## Setup

| | |
| --- | --- |
| Executor | `claude`, model `claude-opus-5`, 3 runs per variant |
| Judge | `claude`, model `claude-opus-5` |
| Tasks | `qa-goal-001`, `qa-goal-002` — 12 runs total |
| Skill under test | `skills/qa` @ `f93bfab3` (832 words), recorded as `skill_version: 1ae0ad0a` (branch HEAD) |
| Harness | worktree on `skill/qa-minimal` @ `1ae0ad0a` |
| Trigger | content-only — no "use the qa skill" line was prepended |

All 12 runs came back `self_judged: true` (judge and executor are both claude). That is
expected on a single-stack benchmark and is a caveat on the numbers, not a defect in them;
#29 was graded the same way.

`expect_sha` is uniform within each task across all six of its runs (`fccf283c89a9` for
goal-001, `a33ab27244e7` for goal-002), so every run of a task was graded against one rubric.
No expect line, no `input:` line, and no file under `skills/qa/` was edited while runs
existed. No regrades were needed.

**The five quizzes were deliberately skipped.** qa-quiz-001/002/003/005 went 3/3 in *both*
variants in #29 — they discriminate nothing, and re-running them would have bought six runs
of cost and no signal. qa-quiz-004 grades a ~2s deep-link delay and the `wc@2:` localStorage
hints, both of which the minimal skill no longer gives, so it would have graded the runs
against text that is gone. They are not un-run by oversight; the consequence is recorded
under "What is not measured here".

**Executors were started detached with a fork+setsid launcher**, each run its own session
leader. This mattered twice: the shell waiting on the runs was killed by the OS for memory
pressure on two separate occasions, and every executor survived both kills. `nohup` would not
have — on macOS the child stays in the parent's process group.

### Two run incidents, both benign

**Judge blindness fired on all three `no_skill` goal-001 runs.** Each REVIEW.md recommends
moving the `Paid` event feed to an indexer and notes "ponder / subgraph — both have skills in
`.agents/skills/`". That is the *template's* own bundled skill directory, which ships
identically in both variants and contains neither `qa` nor anything about it. It cannot tell
a judge the variant — it appears only in the arm without the skill, and if anything points
the wrong way. Graded with `--allow-skill-mention`, as the guard's own message prescribes.

**Five of six goal-002 judges failed transiently on the first pass** — `spawnSync env
ETIMEDOUT` ×4 and `judge output was not strict JSON` ×1 — and were re-verified identically
with the same judge. Nothing was lost or self-graded: `verify` captures `run.diff` and only
deletes a workspace after it grades, so the evidence for all six was intact and five
workspaces were still on disk. #29 hit the same class of failure twice in 42 runs.

## Headline — per-check counts

### qa-goal-001 — pre-ship review, 18 expects, nothing named in the prompt

`no_skill` **38/54** flagged; `with_skill` **54/54**. Run pass **0/3 vs 3/3**.

| Expect | no_skill | with_skill | | Expect | no_skill | with_skill |
| --- | --- | --- | --- | --- | --- | --- |
| e1 connect-button | 1/3 | 3/3 | | e10 bg-black wrapper | 3/3 | 3/3 |
| e2 wrong-network | 3/3 | 3/3 | | e11 loading class | 3/3 | 3/3 |
| e3 simultaneous approve+pay | 3/3 | 3/3 | | **e12 --radius-field** | **0/3** | 3/3 |
| e4 raw useWriteContract | 3/3 | 3/3 | | e13 pollingInterval | 3/3 | 3/3 |
| e5 shared isPending lock | 3/3 | 3/3 | | e14 RPC posture | 3/3 | 3/3 |
| e6 USDC→externalContracts | 2/3 | 3/3 | | e15 branding title/readme | 3/3 | 3/3 |
| e7 raw address input | 3/3 | 3/3 | | e16 footer/favicon | 2/3 | 3/3 |
| **e8 Address + contract addr** | **0/3** | 3/3 | | **e17 mobile deep-link** | **0/3** | 3/3 |
| e9 console.error-only | 3/3 | 3/3 | | **e18 Phantom** | **0/3** | 3/3 |

### qa-goal-002 — fix unprompted, 14 expects, graded from the diff

`no_skill` **27/42**; `with_skill` **42/42**. Run pass **0/3 vs 3/3**.

| Expect | no_skill | with_skill | | Expect | no_skill | with_skill |
| --- | --- | --- | --- | --- | --- | --- |
| **e1 connect-button** | **0/3** | 3/3 | | e8 readable errors | 3/3 | 3/3 |
| **e2 wrong-network branch** | **0/3** | 3/3 | | e9 bg-black→theme | 3/3 | 3/3 |
| e3 one primary action gated | 3/3 | 3/3 | | e10 loading spinner span | 3/3 | 3/3 |
| e4 useScaffoldWriteContract | 3/3 | 3/3 | | **e11 --radius-field both blocks** | **0/3** | 3/3 |
| e5 USDC→externalContracts | 3/3 | 3/3 | | e12 pollingInterval | 3/3 | 3/3 |
| e6 AddressInput | 3/3 | 3/3 | | e13 title identity | 3/3 | 3/3 |
| **e7 Address comp + addr shown** | **0/3** | 3/3 | | **e14 README/footer** | **0/3** | 3/3 |

**All three `with_skill` runs of both tasks passed every expect line.** The single graded
failure count in the benchmark is 16 `no_skill` misses on goal-001 and 15 on goal-002.

## The three things this benchmark was watching

**1. The five checks compressed to one line each held.** goal-001 e3 (one action at a time),
e4 (the scaffold write hook), e5 (button locking), e9 (error surfacing) and e14 (RPC posture)
were 3/3 in both variants in #29, and are 3/3 in both variants here. Compressing them cost
nothing measurable — but note what that sentence is worth: they were already saturated in
#29, so this is the absence of a regression, not evidence the lines are carrying weight.
Their `no_skill` counterparts on goal-002 are also 3/3, so nothing distinguishes the arms on
any of the five.

**2. goal-002 e5 and e7 — the only `with_skill` residuals in #29 — both closed.**

- **e5, `externalContracts` migration: 1/3 → 3/3.** This is where the cut deliberately added
  material rather than removing it, and #29's report named it "the single clearest gap and the
  top skill-improvement candidate". The minimal skill answers it directly: *"Migrate rather
  than flag"*, the `externalContracts.ts` literal, *"Then revert `deployedContracts.ts` to its
  generated state and confirm `yarn next:check-types` passes."* Reading the workspaces before
  `verify` deleted them, all six goal-002 runs ended with USDC in `externalContracts.ts` and
  zero USDC references left in `deployedContracts.ts`. **The honest qualifier is large: the
  `no_skill` arm also went 1/3 → 3/3 on the same expect.** The recipe landed and the base
  model caught up in the same round, and this benchmark cannot separate them.
- **e7, Address component + contract address shown: 2/3 → 3/3.** Here the arms do separate,
  and the reason is legible in the diffs. All six runs, both variants, deleted the hand-rolled
  `shorten()` and render the payout list through `<Address/>`. Every `no_skill` failure of e7
  is the *other* half — the Payouts contract address is never put on the page. The minimal
  skill states it as its own bullet ("The contract the user transacts with is shown on the
  page") and it lands 3/3.

**3. goal-001 e7/e8/e17/e18 — the four #81 keeps unconditional against #48's proposal — are
3/3 with the skill.** No drop, so nothing here argues for making them conditional. Three of
the four are also the benchmark's most durable baseline gaps: e8, e17 and e18 are 0/3 in
`no_skill` on both models. e7 (AddressInput) is the exception at 3/3 in both variants on both
models, because SE-2's own bundled AGENTS.md teaches `AddressInput` — it has never
discriminated and does not now.

## Skill trigger — 6/6

| Context | Runs that invoked the `qa` skill |
| --- | --- |
| goal-001 (with_skill) | **3 / 3** |
| goal-002 (with_skill) | **3 / 3** |

Every `with_skill` run opened with `Skill{"skill":"qa"}` before reading a single file. This
was worth checking because the cut rewrote the `description:` frontmatter — from "Give this
to a separate reviewer agent … whenever you are finalizing a dApp built with Scaffold-ETH 2"
to a comma-separated topic list ending "Use when finalizing an SE-2 build, ideally from a
fresh reviewer context after the build is complete." It still fires on both the review
framing and the ship framing, matching #29's 6/6 on the goal tasks.

## Did any run reach for the dropped material?

No. Across all 12 runs' deliverables and transcripts:

| Dropped construct | Occurrences |
| --- | --- |
| `setTimeout` deep-link (the `writeAndOpen` / 2000ms recipe) | **0** |
| `wc@2:` localStorage read for wallet detection | **0** |
| hand-rolled `approveCooldown` / fixed-timer button lock | **0** |

The `setTimeout` string appears at all in exactly two goal-001 `with_skill` deliverables, and
both are the *replacement* text landing: with-skill-2 writes "hold the button with local state
cleared in the same `finally` — never on a `setTimeout`", with-skill-3 the same. The rewrite
swapped a 4-second timer for `isMining` and the runs repeat the new rule, including its
prohibition on the old one.

`isMining` appears in every goal-002 payouts page — in `no_skill` too, twice per run, because
SE-2's bundled AGENTS.md teaches `useScaffoldWriteContract`. The rewrite's `isMining` claim is
consistent with the repo's own guidance rather than competing with it, which is presumably why
e4 and e5 are saturated in both arms.

## What the cut cost

**The USD-values finding, and only that.** #29's `with_skill` runs raised "No USD value next
to USDC amounts" as a numbered finding with a fix, 3/3. The minimal skill dropped the
"Important: USD Values" section, and `with_skill` now raises it **0/3**. `no_skill` is 0/3 on
both models, so this is attributable to the skill text and not to the model. Filed as
`qa-usd-context-omitted`.

It is also the cheapest possible loss to defend. The item is deliberately ungraded — no expect
covers it — and #29's own runs wrote *"USDC ≈ $1 so this is low-stakes"* while raising it. On
a USDC-denominated payouts app the finding is close to worthless. On an ETH- or
volatile-token app it would not be, and the rewrite has no line that would produce it.

**The OG-image section cost nothing, and there is no variant contrast in it at all.** What
the compression removed is the narrow *absolute-URL / `metadataBase`* rule, and that rule
appears in **zero of the six** 2026-09-06 goal-001 diffs — neither arm states it. In #29 it
was stated 3/3 by `with_skill`, and two of those three runs *checked the claim and passed it*
— "builds an **absolute** URL from `metadataBase` … so it's not a bare relative path ✅". The
full skill's OG section produced a verified non-finding on this template, not a catch.

Meanwhile the stock OG asset is flagged **6/6 here, in both arms**, under branding: every
`no_skill` run names the SE-2 `/thumbnail.jpg` and so does every `with_skill` run
(with-skill-1 "the thumbnail is what renders when someone shares a payout link";
with-skill-3 "the thumbnail is the OG share image"). The minimal skill's "check all five"
branding line carries that half. So dropping the section cost one checkbox on a rule nobody
now states, and cost no coverage of the asset itself.

**One quality cost inside a check that still passes.** goal-001 e17 lands 3/3 on prose alone —
with-skill-1 and with-skill-3 write the finding without code, and with-skill-3 reproduces all
three prose rules (fire the write first, target the wallet actually connected, skip inside an
in-app browser). But with-skill-2, the one run that wrote a code sketch, produced
`if (isMobile && connector?.id === "walletConnect") window.location.href = "wc://"` — a generic
scheme with no delay, contradicting its own prose two lines below about targeting the
connected wallet. The deleted `openWallet` block is what made that sketch correct. The expect
grades the finding, not the sketch, so this costs nothing in the table.

## The baseline moved, and that is the real caveat

`no_skill` improved on both tasks — 26/54 → 38/54 on goal-001, 14/42 → 27/42 on goal-002.
This is the third benchmark in a row where the pass column loses resolution on the newer
model (after tools #68 and noir #80). What closed, without the skill:

| Check | #29 no_skill | here | closed by |
| --- | --- | --- | --- |
| goal-001 e15 branding title/README | 0/3 | **3/3** | the model — AGENTS.md carries no branding rule |
| goal-002 e13 branding (tab title) | 1/3 | **3/3** | the model |
| goal-001 e10/e11 DaisyUI cosmetics | 1/3, 1/3 | **3/3, 3/3** | the model |
| goal-002 e9/e10 DaisyUI cosmetics | 1/3, 1/3 | **3/3, 3/3** | the model |
| goal-002 e5 externalContracts fix | 1/3 | **3/3** | the model (in parallel with the recipe) |
| goal-001 e1 connect-button | 0/3 | 1/3 | partially; the fix task is still 0/3 |

What did **not** move at all, on either model:

- `--radius-field: 9999rem` — 0/3 in `no_skill` on both tasks and both models, 3/3 with the
  skill every time. The single most durable check in the benchmark.
- The Payouts contract address on the page — 0/3 in `no_skill`, both tasks, both models.
- Phantom — 0/3, both models.
- Mobile deep-linking — 0/3, both models.
- goal-002 e1/e2 (connect button and wrong-network branch as *fixes*) — 0/3 both models, even
  though goal-001's review-shaped e2 is 3/3 in `no_skill`. Seeing the wrong-network gap in a
  review is now free; building the branch unprompted is not.
- goal-002 e14 (replacing the template README and footer as a *fix*) — 0/3 both models, while
  the review-shaped e15 went 0/3 → 3/3 and the tab-title fix e13 went 1/3 → 3/3. The same
  split: the baseline learned to rename the tab and flag the README, not to rewrite it.

Five checks still carry the whole graded delta. n=3 is noisy and the baseline is the noisy
half, but four of those five are 0/3 vs 3/3 on both models and both task shapes, which is
about as clean as this benchmark gets.

## Cost — the cut reversed the sign

Every figure from `yarn run-stats --tasks qa-goal-001,qa-goal-002 --since 2026-09-01`.
Medians, with the cost range beside them.

| task | variant | n | turns | duration | cost | cost range | tokens |
| --- | --- | --- | --- | --- | --- | --- | --- |
| qa-goal-001 | no_skill | 3 | 35 | 396s | $2.07 | $1.96–$2.86 | 1,373,857 |
| qa-goal-001 | with_skill | 3 | **20** | **182s** | **$1.08** | $0.95–$1.27 | 593,779 |
| qa-goal-002 | no_skill | 3 | 82 | 1272s | $5.75 | $4.09–$8.12 | 6,795,319 |
| qa-goal-002 | with_skill | 3 | **70** | **1077s** | **$4.31** | $3.84–$4.75 | 4,718,782 |

On goal-001 the skill produces a **fuller** review (54/54 vs 38/54) in **54% less wall-clock,
48% less cost, 43% fewer turns and 57% fewer tokens** than the baseline. On goal-002 it passes
every line the baseline misses five of, for **25% less cost**.

This is a direction change. #29's report on the 2821-word skill said plainly: "The skill
**increases** cost — it does a full checklist sweep and more edits" ($0.76 → $0.86 on
goal-001, $2.49 → $4.36 on goal-002, each against its own baseline). Absolute dollars are not
comparable between the two benchmarks — different model, different prices — but the sign of
the within-benchmark delta is, and it flipped from positive to negative on both tasks.

The ranges are worth reading: goal-002 `no_skill` spans $4.09–$8.12, and its dearest run
(no-skill-2, 108 turns, 1763s, 11.2M tokens) is nearly double the dearest `with_skill` run.
The `with_skill` range is tight on both tasks ($0.95–$1.27 and $3.84–$4.75). The checklist
does not only lower the mean, it removes the tail.

The two tasks ran as separate batches of six, so both variants of a task were under identical
machine load; absolute seconds are still inflated by six-way contention and should not be
compared against #29's absolute numbers.

## What is not measured here

- **The five quizzes.** 001/002/003/005 were saturated in #29 and 004 grades deleted text.
  The consequence is that `qa-deeplink-delay-magnitude`'s magnitude facet has no reading on
  this stack and cannot be closed on it, and that this benchmark says nothing about whether
  the compressed skill still triggers in quiz framing (#29: ~0/15, a property of the framing).
- **Contract verification and the hosting env-var check.** No real deploy exists in the
  workspace, so the skill's "If it is deployed" section and the `vercel env ls` check are
  untestable here, as qa-goal-001's notes state.
- **Whether the `externalContracts` recipe or the model closed goal-002 e5.** Both moved 1/3
  → 3/3 in the same round. Separating them needs the recipe removed and re-run, which no
  question in issue #1 currently asks for.

## Skill edits — both applied in this PR

**The committed skill is no longer the benchmarked one.** Review of this PR turned up two
wrong lines in `f93bfab3`, and they are fixed in this branch (832 → 867 words). Everything
above describes `f93bfab3`. Both are scored against the 12 runs below; neither changed an
outcome, and neither is compression damage — one is a claim the rewrite introduced, the other
a snippet it inherited and shortened.

**1. `isMining` locks only the async write path.** The benchmarked line read "Lock the button
on `isMining`, **not** the `isPending` it passes through from wagmi." `useScaffoldWriteContract`
exposes one `isMining`, but only `sendContractWriteAsyncTx` sets it
(`useScaffoldWriteContract.ts:109`, cleared at `:144`); the synchronous `sendContractWriteTx`
path (`:148-183`) calls `wagmiContractWrite.writeContract(...)` and never touches the flag. A
reviewer following the bullet onto a component that uses the sync write gates the button on a
flag that is permanently `false` — the exact double-submit the bullet exists to prevent.

**Scored against the runs: 0/12 affected, and the failure mode could not have fired.** All six
goal-002 runs destructure `writeContractAsync` (5 call sites each) and zero call the
synchronous `writeContract`; all six derive the lock the same way —
`const { writeContractAsync: writeUsdcAsync, isMining: isApproving } = useScaffoldWriteContract(...)`
then `const isBusy = isApproving || isPaying`. That shape is identical in `no_skill`, which
gets it from SE-2's bundled AGENTS.md. The line is latent on this template and wrong in
general. **Applied:** the bullet now names `writeContractAsync` and states that the
synchronous path never sets the flag.

**2. The `externalContracts.ts` snippet is headed as a whole file but omits its import.** The
block is labelled `// packages/nextjs/contracts/externalContracts.ts` and ends
`export default externalContracts satisfies GenericContractsDeclaration;` without
`import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";`. A model
reading the path comment as "this is the file" and writing it out gets `Cannot find name
'GenericContractsDeclaration'` from the very `yarn next:check-types` the next sentence tells
it to run.

**Scored against the runs: 0/12 affected, for a reason that does not generalise.** The
template already ships `externalContracts.ts` with that import on line 1, so all six goal-002
runs *edited* the existing file rather than creating it — the import never appears as an added
line in any `run.diff` because it was never missing. The snippet's defect needs a workspace
where the file does not exist yet, which `templates/qa-target` is not. **Applied:** the import
is in the block.

This is the same handling as noir #80: the fixes land in the branch rather than as issues
against a skill this PR is introducing, and each is scored against the runs so a reader can
see it changed no result.

## Final table

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | goal-001 `3/3 with_skill vs 0/3 no_skill`; goal-002 `3/3 vs 0/3`. Per-expect 54/54 vs 38/54 and 42/42 vs 27/42. `with_skill` matches #29's bar on goal-001 and **beats it on goal-002 (0/3 → 3/3)**, where both #29 residuals closed. |
| Did it reduce time/tokens? | **Yes, on both tasks** — goal-001 182s/$1.08/594k vs 396s/$2.07/1.37M; goal-002 1077s/$4.31/4.72M vs 1272s/$5.75/6.80M. #29's full skill increased cost against its own baseline; the cut reversed the sign. |
| Did it create negative deltas? | One, ungraded: the deleted USD-values section, `with_skill` 3/3 → 0/3 (`qa-usd-context-omitted`). One quality cost inside a passing check: the single deep-link code sketch written by any run is a generic `wc://` with no delay, which the deleted `openWallet` block would have prevented. No graded check dropped anywhere. |
| What mistakes repeated without the skill? | `qa-daisyui-theme-cosmetics` (now only the `--radius-field` facet, 0/3 both tasks), `qa-phantom-and-address-display` (0/3 both facets, unmoved on either model), `qa-deeplink-delay-magnitude` (review facet 3/3 unflagged), `qa-connect-button-not-text` (5/6), `qa-branding-left-default` (narrowed to the footer, favicon and the README-as-a-fix, 4/12). |
| What mistakes remained with the skill? | None graded — `with_skill` is 0 failures in 12 runs. `qa-usd-context-omitted` is new and ungraded, and is a consequence of the cut rather than of the model. |
| What should change in the skill? | **Two wrong lines, both applied in this PR** (832 → 867 words), neither of which changed an outcome: `isMining` scoped to the `writeContractAsync` path it actually tracks, and the missing `GenericContractsDeclaration` import in the `externalContracts.ts` block. Both scored 0/12 against the runs — see "Skill edits". Nothing else. If the USD claim is wanted back it is one bullet, but it was ungraded and self-described as low-stakes by the runs that made it. Do **not** restore the `openWallet` block, the `wc@2:` read or the 2s figure: zero of 12 runs reached for them and the prose lands e17 3/3. |
| What should change in the eval? | **Split goal-002 e7** — its Address-component half now passes 6/6 in both variants and measures nothing; the contract-address half carries the entire 0/3 vs 3/3 delta. **Retire or rewrite goal-001 e7 (AddressInput)** — 3/3 in both variants on both models, taught by the template's own AGENTS.md, and it has never discriminated. **Grade the USD and OG items or drop them from the notes** — the only measurable cost of the compression sits on items no expect covers, which is how it nearly went unnoticed. **Reconsider the all-N pass bar**: goal-002 went 0/3 → 3/3 on a bar that hid a 39/42 in #29, and the per-expect rows are still where the story is. |

## Verdict

**Keep `skills/qa` minimal.** The 70% cut clears #29's bar on the review task, beats it
on the fix task, closes both of the residuals #29 identified, holds every compressed check at
3/3, and costs roughly half as much to run. Nothing in 12 runs reached for the deleted
recipes. The one real loss is a low-stakes ungraded finding on a stablecoin app.

The caveat to carry into issue #1 is the same one #80 raised for noir, one benchmark later
and stronger: the `no_skill` baseline closed six checks it used to fail, including all of
branding and two of the three DaisyUI cosmetics. Five checks now carry the entire graded
delta — `--radius-field`, the contract address on the page, Phantom, mobile deep-linking, and
building the connect/wrong-network branches unprompted. They are clean, 0/3 vs 3/3 on both
models and both task shapes. But a skill whose measurable value has narrowed to five items
is a skill whose next benchmark should be built around those five, not around 18 and 14 lines
most of which the base model now passes on its own.
