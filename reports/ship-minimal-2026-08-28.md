# ship minimal — 2026-08-28

Executor: Codex `gpt-5.6-sol`. Judge: Codex `gpt-5.6-sol`. Runs: 3 per
variant for five tasks (30 total). Every judge ran as a fresh process after the
executor and received only the task and captured evidence. All records say
`self_judged: true` because the schema defines that field by agent stack, not
process identity.

Skill version: `43d5be6` (660 words). The cohort was run after committing the
skill and prompt corrections, so every with-skill record points at the shipped
revision.

Isolation, precisely: the harness of the day (`43d5be6`) still placed each
workspace at `artifacts/<task>/<run-id>/workspace`, inside the eval repository,
and ran `git init` there. That nested boundary is what stopped `git status` from
resolving to the eval repo, which closes the August 24 leak — but it stops only
git. Sibling run dirs, whose names carry `-with-skill-` / `-no-skill-`, and
`tasks/` with its expect lines stayed reachable by a plain `ls`, since no marker
stops one. Reading the 30 committed transcripts, two runs did step above the
workspace, both with `find .. -name AGENTS.md`
(`ship-quiz-001/…no-skill-2`, `ship-quiz-002/…no-skill-2`); both printed
nothing, so no sibling name or expect line reached an executor. No run listed a
parent directory. The out-of-tree workspace root that removes the residual
exposure landed on this branch with the merge at `218931d`, after these runs.

`verify` retained both `run.diff` and `output/` for all 30 runs and then deleted
the workspaces. The quiz `output/answer.md` files are committed as the graded
deliverable; the goal runs' `output/` trees are not, per AGENTS.md — their
`run.diff` carries the same files.

## Results

| Task | no_skill | with_skill | Delta |
| --- | --- | --- | --- |
| ship-quiz-001 | 3/3 | 3/3 | saturated |
| ship-quiz-002 | 3/3 | 3/3 | saturated |
| ship-quiz-003 | 2/3 | 3/3 | +1 |
| ship-quiz-004 | 3/3 | 3/3 | saturated |
| ship-goal-001 | 0/3 | 3/3 | +3 |

The useful signal remains the unprompted build. Every no-skill goal run stored
tool metadata in contract storage. One also omitted caller coverage for
USDC-moving transitions and left the target/deployment procedure undecided.
All three with-skill goal runs passed all six checks. Quiz 003 supplied a
smaller independent signal: one no-skill answer named a transition caller
without a concrete gas incentive; every with-skill answer supplied one.

Quiz 002 is now a translator marketplace with credential verification, not a
second tool-lending task. Quiz 004 no longer states Base's graded capabilities
in its prompt; executors had to identify or research the onboarding fit. Both
remain saturated on this model, as do the marketplace contract-count checks in
quiz 001.

## Token use

Every transcript recorded a comparable `tokens used` value.

| Task | no_skill mean | with_skill mean | Change |
| --- | ---: | ---: | ---: |
| ship-quiz-001 | 18,648 | 27,410 | +47% |
| ship-quiz-002 | 16,196 | 19,224 | +19% |
| ship-quiz-003 | 25,246 | 28,843 | +14% |
| ship-quiz-004 | 38,382 | 42,281 | +10% |
| ship-goal-001 | 64,783 | 65,298 | +1% |

The skill increased mean token use on every task. The largest overhead appears
on already-saturated questions, where skill-guided answers often expanded into
chain research, deployment decisions, and release runbooks beyond the requested
architecture or plan. This is a negative delta even though no pass rate fell.

## Records and interpretation

The prior `gpt-5.6-terra` mistake frequencies remain untouched. New mistake
records carry a `-gpt-5.6-sol` suffix so model stacks are not blended. All
historical records now point to headings that exist in the current skill. The
old leaked August 24 cohort and its report were removed rather than reused.

The address-safety guard is restored, the contract-count rule now says that
zero to two is typical and three is the upper bound, skill URLs are discoverable,
and `l2s` no longer points at a deleted chain-selection framework. The remaining
content gap is scope control: deployment and release detail should be
conditional on the requested deliverable. That recommendation is recorded as
`ship-scope-token-overhead-gpt-5.6-sol`; changing the tested skill now would
invalidate this cohort, so it belongs in a follow-up revision and benchmark.

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | Yes: goal `3/3 vs 0/3`; quiz 003 `3/3 vs 2/3`; the other quizzes were `3/3 vs 3/3`. |
| Did it reduce time/tokens? | No. Mean tokens increased on all five tasks, from +1% to +47%. |
| Did it create negative deltas? | Yes: higher mean token use on every task; no pass-rate regression. |
| What mistakes repeated without the skill? | `ship-goal-offchain-data-gpt-5.6-sol`; single-run recurrences of `ship-goal-readme-transition-audit-gpt-5.6-sol`, `ship-goal-deployment-decision-gpt-5.6-sol`, and `ship-state-transition-incentive-gpt-5.6-sol`. |
| What mistakes remained with the skill? | `ship-scope-token-overhead-gpt-5.6-sol`; no graded correctness mistake remained. |
| What should change in the skill? | Make chain research, deployment commands, and the release runbook conditional on a build/deploy/launch-ready request; architecture-only answers should stop at the requested decisions. |
| What should change in the eval? | Replace or retire saturated quizzes 001, 002, and 004 if discriminative power is required; retain them only as clearly labeled regression checks. Add first-class token extraction to the harness instead of mining transcripts — since landed on `main` as the `usage:` block in `result.yaml` (#93); it postdates these runs, so this cohort's numbers still come from the committed transcripts. |
