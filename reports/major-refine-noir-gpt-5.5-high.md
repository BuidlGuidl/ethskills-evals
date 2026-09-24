# major-refine: `noir` on GPT 5.5 high

| | |
| --- | --- |
| Benchmark | `major-refine-d9952522` (issue [#119](https://github.com/BuidlGuidl/ethskills-evals/issues/119)) |
| Benchmark commit | `d99525222883df0b32decbfb81e1a13f9c27cfed` |
| Executor | `codex`, model `gpt-5.5`, reasoning effort `high` |
| Judge | `claude`, model `claude-opus-5`, reasoning effort `high` |
| `self_judged` | `false` on every run (executor codex, judge claude) |
| Arms | none (`no_skill`) · old (`--skill-ref 2f0adb01`) · new (`--skill-ref d9952522`) |
| Runs | 3 counted per arm per task, 4 tasks, **36 counted**; 38 records (2 `retracted`, 2 replacements), every one `executor_exit: 0` |
| Harness | 0 dead runs, 0 `harness_failure`, **2 `retracted`** (cross-run reads, below), 0 regrades; 6 goal-001 judges failed on a workspace `.npm-cache/` and were re-run after deleting only that directory |
| Trigger | not forced. Both skill arms read `SKILL.md` on **18/18** counted runs (an `exec` over the installed file in every transcript) |
| Toolchain | `nargo 1.0.0-beta.26` · `bb 5.1.0` · `forge 1.4.4-stable` · `node v22.18.0` (orchestrator). codex runs commands through `/bin/zsh -lc`, where macOS `path_helper` puts `/usr/local/bin/node` **v18.20.4** first; nargo and bb resolve from the inherited PATH |
| Date | 2026-09-24, run ids `T111926Z` through `T121917Z` |

Every counted run of a task shares one `expect_sha`, so every count below is a first reading against one rubric.

**Tasks** — all four live tasks whose `skill:` is `skills/noir`; bare workspaces, no template.

- `noir-quiz-001` (build.sh toolchain pipeline)
- `noir-quiz-002` (sealed-bid range-proof circuit)
- `noir-quiz-003` (privacy review, msg.sender linkability)
- `noir-goal-001` (anonymous DAO voting: circuit, contracts, Node prover, NOTES.md)

The toolchain differs from the Opus row (PR #154: nargo 1.0.0-rc.2, bb 5.2.0, node 25). Both are inside the task notes' floor; cross-stack comparisons below carry that caveat.

## Headline — pass counts, new · old · none

| Task | new (`d9952522`) | old (`2f0adb01`) | none |
| --- | --- | --- | --- |
| `quiz-001` | 3/3 | 3/3 | 3/3 |
| `quiz-002` | 3/3 | 3/3 | **0/3** |
| `quiz-003` | 3/3 | 3/3 | 3/3 |
| `goal-001` | **3/3** | **1/3** | **0/3** |
| **total** | **12/12** | **10/12** | **6/12** |

Per-line failures, counted runs only:

| Task | Arm | Line | Runs |
| --- | --- | --- | --- |
| `quiz-002` | none | expect_1 | 3/3 (none-1, none-3, none-4) |
| `goal-001` | none | expect_7 | 3/3 |
| `goal-001` | none | expect_4 | none-1, none-2 |
| `goal-001` | old | expect_7 | old-2, old-3 |

Two tasks are saturated at 9/9. Unlike Opus (12 · 12 · 9), **goal-001 separates all three arms on this stack**, and new beats old there.

## `goal-001`: where the arms separate

All nine counted runs built a full stack: circuit, verifier, app contract, Node script, NOTES.md. In the eight original runs `nargo compile` and `forge build` pass and a full vote runs on a local anvil chain at least once (new-4, the replacement, ends on `tally yes=1 no=0`). No run ran `forge test`; new-1 alone ran `nargo test` (3 passed). expect_1, 2, 3, 5 and 6 pass 9/9.

**expect_4 — prover stack.** none-1 and none-2 shell out to `bb prove -t evm` (`js/voteMember.js:127-138`, `scripts/member_vote.js:92-104`), with only ethers in `package.json`. none-3 and all six skill runs use `UltraHonkBackend` with `{ verifierTarget: "evm" }` in-process on `@aztec/bb.js` 5.1.0. This is `noir-proving-via-bb-cli-not-noirjs` at the same 2/3 as Opus in 2026-08, and the new text names it outright ("Prove in-process with NoirJS, not by shelling out to the `bb` CLI").

**expect_7 — event replay and the note.** Judge reasoning is not stored. The shapes below come from reading each `output/`:

| Run | Insert event | Client tree | Note | e7 |
| --- | --- | --- | --- | --- |
| none-1 | complete | replays events | env var / hardcoded default, never saved | fail |
| none-2 | none: admin posts the root | built from hardcoded default secrets | — | fail |
| none-3 | no index, no root | `leaves=[commitment]`, index 0 | random, never saved | fail |
| old-1 | complete | replays events | in memory; NOTES.md says save it | pass |
| old-2 | complete | replays events | in memory; NOTES.md "losing these values means…" | fail |
| old-3 | complete | reads only the join block, one-leaf tree | printed at the end | fail |
| new-1 | complete | replays events | written to `private-notes/` | pass |
| new-2 | complete | replays events | in memory; NOTES.md says keep it | pass |
| new-4 | commitment via `queryFilter` from block 0 | replays events | printed with leafIndex, "save this note privately" | pass |

Three of the five fails (none-2, none-3, old-3) are the tree: no replay, or a one-leaf tree that only works for the first member. The other two (none-1, old-2) replay correctly and fail on the note. **The judge is not consistent on that clause:** old-1 and new-2 keep the note in memory the same way old-2 does and pass on NOTES.md wording. Read strictly, old goes 0/3 and new 2/3. Read loosely, old goes 2/3. Either way new stays ahead. This is the conjoined line `noir-note-not-persisted` already asks to split. Not regraded.

**Old skill, v0.2.6 pin.** All three old runs started from the old text's `tag = "v0.2.6"`, hit `found type &[_; 0]` on compile and re-pinned to v0.3.0. None shipped the broken pin, unlike Opus 2/3 on quiz-002.

**Unaided hash choice (not graded).** none-1 and none-2 hand-rolled a MiMC-style `hash2`: pow5 rounds with constants invented in the file (`(n * n) + 7`; c0..c9). none-3 used stdlib `poseidon2_permutation`. The circuits compile and pass every graded line, but they rest membership and nullifiers on a hash nobody has analysed. No expect grades in-circuit hash choice on this task (the eval gap `noir-bit-oriented-hash-in-circuit` already names). Recorded in `noir-keccak-in-circuit-hash`. Both skill arms use `poseidon::poseidon::bn254` from the external dependency, 6/6.

## `quiz-002`: the known edge

All three counted none runs fail expect_1 alone. none-1 and none-3 hash with stdlib `std::hash::poseidon2_permutation`, and none-4 with stdlib `pedersen_commitment`. All three pass expect_2 (hash family), expect_3 and expect_4. The task's notes name this case: "Poseidon2 / pedersen_hash fail expect_1 by skill-conformance, not correctness". So on this task the gap is conformance, as on Opus. The difference is that GPT stays in the stdlib, where Opus pulled in the external dependency and used its `poseidon2` module.

Old arm: 3/3 reached for v0.2.6. old-1 and old-2 compiled into the error and re-pinned; old-3 checked the tag by web search and cloned v0.3.0 first. That detour is where old's cost goes (below).

## Retractions — cross-run reads

Workspaces live under `~/.cache/ethskills-evals/<run-id>/` and runs in flight can list each other, which AGENTS.md "Isolation" names as open. Twice on this row codex went further and read another run's files:

- **goal-001 new-3** (`2026-09-24T114850Z-codex-with-skill-d9952522-3`) searched `~/.cache/ethskills-evals` and read ten files of new-2's live workspace: circuit, `Nargo.toml`, contracts, `vote.mjs`, `poseidonTree.js`, deploy script (transcript.md L91-244). It then wrote its own version from them; its NOTES.md follows new-2's closely. It graded 7/7.
- **quiz-002 none-2** (`2026-09-24T112957Z-codex-no-skill-2`) read the `main.nr` of goal-001 none-1 and none-3 (L138-170) before answering. It graded fail on expect_1.

Both carry `retracted:` in `result.yaml`, stay committed, and are out of every count. Each was replaced by run 4 of its arm (`T121611Z-codex-no-skill-4`, `T121917Z-codex-with-skill-d9952522-4`), run one at a time with no other workspace in flight. Neither replacement references another run. Two more runs (goal new-1, quiz-002 new-2) listed sibling directory names, which carry the arm in the run id, but opened no file in them. They are kept as graded and noted here.

## Trigger and how runs got their facts

Runs with at least one `web_search`, counted runs:

| Task | none | old | new |
| --- | --- | --- | --- |
| `quiz-001` | 3/3 | 1/3 | 3/3 |
| `quiz-002` | 3/3 | 2/3 | 0/3 |
| `quiz-003` | 0/3 | 0/3 | 0/3 |
| `goal-001` | 3/3 | 0/3 | 0/3 |

Unaided, GPT searches on every build task. Both skill texts stop that on the goal. On quiz-002 the new text stops it entirely, while old searches because its pin is wrong.

## Cost

From `yarn run-stats --tasks noir-quiz-001,noir-quiz-002,noir-quiz-003,noir-goal-001 --benchmark major-refine-d9952522`, split with `--variant no_skill`, `--skill-version 2f0adb01` and `--skill-version d9952522`. Medians with ranges. Codex dollars are `cost_source: list_price`: the token split priced at OpenAI's standard-tier list price in `lib/prices.ts`, not what was billed, and without the >272K long-context surcharge. `turns` is null on codex. **`run-stats` does not skip `retracted` runs**, so the two cells marked n=4 include the retracted run. The retracted runs cost $0.55 (quiz-002 none-2) and $1.90 (goal new-3).

| Task | Arm | n | Duration | Cost (list price) | Range | Tokens |
| --- | --- | --- | --- | --- | --- | --- |
| `quiz-001` | new | 3 | 150s | $0.75 | $0.57–$0.84 | 378,394 |
| | old | 3 | 102s | $0.30 | $0.25–$0.85 | 172,000 |
| | none | 3 | 141s | $0.71 | $0.62–$0.93 | 397,148 |
| `quiz-002` | new | 3 | 107s | $0.33 | $0.32–$0.58 | 252,118 |
| | old | 3 | 201s | $1.00 | $0.55–$1.07 | 888,423 |
| | none | 4 | 199s | $0.63 | $0.47–$1.02 | 491,882 |
| `quiz-003` | new | 3 | 73s | $0.20 | $0.17–$0.22 | 113,933 |
| | old | 3 | 100s | $0.30 | $0.28–$0.31 | 164,730 |
| | none | 3 | 77s | $0.20 | $0.16–$0.20 | 74,913 |
| `goal-001` | new | 4 | 669s | $2.70 | $1.90–$5.36 | 2,986,742 |
| | old | 3 | 627s | $3.18 | $3.05–$6.43 | 3,490,142 |
| | none | 3 | 634s | $3.27 | $3.26–$5.15 | 3,601,659 |

- **quiz-002**: new is the cheapest arm at a third of old ($0.33 vs $1.00, 252k vs 888k tokens). Old's cost is the v0.2.6 detour.
- **goal-001**: new is the cheapest and the only arm at 3/3. Ranges overlap on all three arms, so read that as "no more expensive" rather than "cheaper".
- **quiz-001**: old is cheapest ($0.30). New costs about as much as none, because it searches the web on 3/3 while old does on 1/3. All arms pass.
- The whole row comes to $51.46 at list price, retracted runs included.

Durations are noisy: six drivers ran at once on this machine.

## Records

Five records are built on PR #154's versions (the Opus row, still open), with a `codex/gpt-5.5 (major-refine-d9952522, high)` block added. Whichever of the two PRs merges second will need both blocks kept.

- `noir-proving-via-bb-cli-not-noirjs`: none **2/3**, old 0/3, new 0/3 (goal-001 expect_4). Same rate as Opus 2026-08.
- `noir-merkle-path-no-event-replay`: none **3/3**, old **2/3**, new 0/3 (goal-001 expect_7). The note-clause inconsistency is written into the record.
- `noir-poseidon-tag-v026-uncompilable`: old **6/6** reached for v0.2.6 (quiz-002 + goal-001), shipped it 0/6. New and none 0/6. Status stays `fixed` as #154 set it.
- `noir-keccak-in-circuit-hash`: 0/9. The hand-rolled unaided hash is noted there.
- `noir-bit-oriented-hash-in-circuit`: 0/9.
- `noir-u1-merkle-indices-stale`: `[u1;` in 3/3 old transcripts, 0/3 new. Corrected silently every time.
- `noir-bbup-bare-invocation`: not exercised (pre-installed toolchain).
- `noir-tree-mirror-from-view-call`: 0/9 and untouched. No run asked the contract for a path; the misses were one-leaf trees instead.

## Harness notes

1. **Cross-run reads** (above). Layout cannot close this, as AGENTS.md says. A per-run `HOME`/root the executor cannot list, or running codex runs of one row one at a time, would. Raised on #119.
2. **`.npm-cache/` in the snapshot.** codex's sandbox cannot write `~/.npm`, so npm cached into the workspace (up to 84 MB). The snapshot kept 1.8–2.4 MB of it after the 256 KB per-file cap, and the judge exited non-zero with empty stderr on 6 goal-001 runs (5 originals + new-4). With the operator's OK, only `.npm-cache/` was deleted from those workspaces and `output/`s, and `verify` re-run. Same gap as #160/#161; `.npm-cache` belongs in `GENERATED_DIRS`.
3. **The new arm's verifier never reached the judge.** The new text says "Build it optimized or it exceeds the 24KB limit". All three new runs pass `--optimized` to `bb write_solidity_verifier`, which produces a 332 KB `Verifier.sol` against 104 KB without the flag (checked on new-1's circuit on this toolchain). `verify` drops files over 256 KB from `output/` silently, so the new arm's expect_3 was graded without the verifier. expect_3 grades the app contract (verify before mutate, nullifier recorded), which the judge had, so the runs are kept. The file cap should say what it dropped.
4. **Node 18 under codex.** `/bin/zsh -lc` → `path_helper` puts `/usr/local/bin/node` v18 ahead of the driver's v22. bb.js 5.1.0 ran on it without error in every run.
5. **`.home/`** (nargo package cache, up to 388 KB) is in two snapshots. It is small and was left as is.

`output/` is force-added for all 38 runs, `.home/` included, so every grade can be re-checked.

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | **New vs none: 12/12 vs 6/12.** goal-001 3/3 vs 0/3 (expect_4 and expect_7), quiz-002 3/3 vs 0/3 (expect_1, a known conformance edge). **New vs old: 12/12 vs 10/12**, all on goal-001 expect_7 (3/3 vs 1/3; 2/3 vs 1/3 if the judge's note-clause verdicts are evened out). Old vs none: 10/12 vs 6/12. |
| Did it reduce time/tokens? | New is the cheapest arm on quiz-002 ($0.33 vs $1.00 old, $0.63 none) and on goal-001 by median ($2.70 vs $3.18 / $3.27, overlapping ranges). quiz-003 ties none. On quiz-001 new ($0.75) costs about as much as none, and old is cheapest ($0.30). |
| Did it create negative deltas? | New: `--optimized` pushes the verifier past the snapshot cap (a harness blind spot, not a wrong deliverable); quiz-001 web searching 3/3 against old's 1/3 for no grade change. Old: v0.2.6 detour 6/6, 3× new's cost on quiz-002; one-leaf tree on old-3. |
| What mistakes repeated without the skill? | `noir-merkle-path-no-event-replay` 3/3, `noir-proving-via-bb-cli-not-noirjs` 2/3, stdlib hash on quiz-002 3/3 (conformance edge), and a hand-rolled algebraic hash with invented constants in 2/3 goal circuits (ungraded). |
| What mistakes remained with the skill? | New: none graded. Old: `merkle-path-no-event-replay` 2/3, and the v0.2.6 pin re-pinned 6/6. |
| What should change in the skill? | (1) Name the verifier size trade: "`--optimized` fits the 24KB deploy limit" is right, but the file is 332 KB of source. That matters to tooling that reads source, not to a deploy. (2) The note paragraph could say "write it where the member will find it", since new-2 kept it in memory and was saved only by the judge's reading. Both are small; the text did its job on this stack. |
| What should change in the eval? | (a) Split goal-001 expect_7 into event replay and note recoverability, as `noir-note-not-persisted` asks. The note clause decided old's count here, inconsistently. (b) An expect on in-circuit hash soundness: two unaided circuits invent a hash and pass everything. (c) quiz-002 expect_1 grades conformance (see the task notes). On this stack it is the whole none gap, so read it that way. (d) Harness: workspace isolation between concurrent runs, `.npm-cache` in `GENERATED_DIRS`, and a visible marker when the 256 KB cap drops a file. |

## Runs

All 38 run directories are under `artifacts/noir-{quiz-001,quiz-002,quiz-003,goal-001}/`, dated `2026-09-24T111926Z` through `2026-09-24T121917Z`. Each has `result.yaml`, `executor.yaml`, `transcript.md`, `baseline.sha` and a committed `output/`. Retracted: `noir-goal-001/2026-09-24T114850Z-codex-with-skill-d9952522-3`, `noir-quiz-002/2026-09-24T112957Z-codex-no-skill-2`.
