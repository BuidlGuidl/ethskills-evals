# major-refine: `frontend-playbook` on GPT 5.5 high

**Benchmark id:** `major-refine-d9952522` (issue [#119](https://github.com/BuidlGuidl/ethskills-evals/issues/119))

| | |
| --- | --- |
| Executor | `codex` · `gpt-5.5` · effort `high` |
| Judge | `claude` · `claude-opus-5` · effort `high` |
| `self_judged` | **false** on all 72 records |
| Runs | 3 per arm per task, 8 tasks × 3 arms = **72 runs**, all `executor_exit: 0` |
| Harness / retractions | 0 `harness_failure`, 0 dead runs, 0 `retracted`; 5 goal-002 grades needed a generated cache removed from the workspace first (see Harness notes) |
| Trigger | not forced, so numbers include triggering. The executor read `skills/frontend-playbook/SKILL.md` in **new 24/24**, **old 20/24** (missed quiz-004 ×1, quiz-005 ×1, goal-002 ×2) |
| Node | driver `PATH` had `v25.9.0` first, but **no codex build ran on Node 25**: see "goal-001 expect_10 is not measured on this stack" |
| Date | 2026-09-22, 16:47–18:35 local |

**Arms**

| Arm | Variant | `skill_version` | Skill text |
| --- | --- | --- | --- |
| none | `no_skill` | `null` | — |
| old | `with_skill` | `2f0adb01` | first vendored `frontend-playbook`, 362 lines |
| new | `with_skill` | `d9952522` | refined skill, 93 lines |

**Tasks:** the same eight live tasks as the Opus row ([#152](https://github.com/BuidlGuidl/ethskills-evals/pull/152)): `frontend-playbook-quiz-001` … `quiz-006`, `goal-001` (template `se-2-foundry`, 10 expects) and `goal-002` (bare workspace, 2 expects).

## Pass counts: new · old · none

| Task | new · old · none | Failing lines |
| --- | --- | --- |
| `quiz-001` | `3/3 · 3/3 · 2/3` | none-2: e2 (`yarn chain --fork-url` instead of `yarn fork --network base`) |
| `quiz-002` | `3/3 · 3/3 · 2/3` | none-3: e2 (`targetNetworks: [chains.hardhat]` in a Foundry project) |
| `quiz-003` | `3/3 · 3/3 · 2/3` | none-2: e2 (config lacks `images.unoptimized`) |
| `quiz-004` | `3/3 · 3/3 · 3/3` | — |
| `quiz-005` | **`0/3 · 1/3 · 0/3`** | none: e3 ×3, e4 ×3. old: e3 ×1, e4 ×2. new: e4 ×3 |
| `quiz-006` | `3/3 · 3/3 · 3/3` | — |
| `goal-001` | `0/3 · 0/3 · 0/3` | none: e6–e10 ×3. old: e7 ×3, e8 ×3, e9 ×1. new: e7 ×3, e10 ×3 |
| `goal-002` | **`2/3 · 0/3 · 0/3`** | none: e1+e2 ×3. old: e1+e2 ×3. new-2: e2 |
| **total** | **`17/24 · 16/24 · 12/24`** | |

The arms separate on goal-002, and per line on goal-001. The quizzes are close to saturated on this stack, as on Opus.

### goal-002: the new text is what gets GPT to `create-eth`

None of the six none/old runs scaffolded SE-2. Every one hand-built a Hardhat + Vite/React project with no RainbowKit and no scaffold hooks (not `forge init` as on Opus). The old description triggered on only one of three bare goal runs (old-1). That run read the whole 362-line text and still scaffolded by hand. All three new runs read the skill and ran `create-eth` (`npx create-eth@2.0.23` is the new text's second paragraph).

new-2 then failed e2 on its own terms: it wrote the tip page against raw wagmi with its own `parseAbi` strings for TipJar and USDC, and never used the scaffold hooks or `deployedContracts`. Filed as `scaffold-hooks-bypassed-handwritten-abi` (1/3, one stack).

### goal-001: every arm fails, on different lines

| Line | new | old | none |
| --- | --- | --- | --- |
| e1–e5 (fork, real USDC, whale funding, `chains.foundry`, `trailingSlash`) | 0/3 | 0/3 | 0/3 |
| e6: clean `.next`/`out` before build | 0/3 | 0/3 | 3/3 |
| e7: changed CID as the proof of a new deploy | **3/3** | **3/3** | 3/3 |
| e8: gateway check of a non-home route | 0/3 | **3/3** | 3/3 |
| e9: OG metadata on the production URL | 0/3 | 1/3 | 3/3 |
| e10: Node 25 handling | 3/3 † | 0/3 † | 3/3 † |

(failure counts; † not measured, see below)

- **e7 fails in all nine runs.** Every `DEPLOY.md` captures the CID (`CID=$(ipfs add -Qr out)`, `yarn bgipfs upload out`) and curls it. None compares it with the previous deploy or treats an unchanged CID as proof of a stale upload. The old text says so outright ("**The CID is proof:** If the IPFS CID didn't change … you deployed the same content"), and GPT still did not carry it into `DEPLOY.md`. On Opus both skill arms passed this line 3/3. Record: `deploy-no-clean-rebuild-no-cid-proof`.
- **e8 is the one clean new→old delta on this stack.** Every new `DEPLOY.md` curls `<gateway>/ipfs/$CID/debug/`. No old one checks anything past the root on the gateway. The new text has this as its numbered post-upload step 2 with the exact curl, while the old text has it in a section further down. On Opus this mistake did not occur in any arm, including unaided. Record: `deploy-verify-home-route-only` now reproduces on GPT.

### goal-001 expect_10 is not measured on this stack

The task notes require Node 25+ for e10. The driver put nvm's `v25.9.0` first on `PATH`, which worked for the claude row. Codex, though, runs every command as `/bin/zsh -lc`. On macOS, `/etc/zprofile` runs `path_helper`, which moves `/usr/local/bin` back to the front, and `/usr/local/bin/node` on this machine is **v18.20.4**:

```
$ env PATH=~/.nvm/versions/node/v25.9.0/bin:/usr/bin:/bin /bin/zsh -lc 'node -v'
v18.20.4
```

Next 16 refuses Node 18. All nine executors found an fnm/nvm Node 20 or 22 on their own and built there, where the crash never fires. The line was still graded on the shipped configuration:

- old passed 3/3, because its `--require ./polyfill-localstorage.cjs` is added whatever the Node version;
- new failed 3/3. new-2 tried both `NODE_OPTIONS` flags the new text gives, and Node 18 rejected both (`--no-experimental-webstorage is not allowed in NODE_OPTIONS`, same for `--localstorage-file`). It dropped them and shipped neither. new-1 and new-3 never tried either flag.

This shows the new remedy is brittle on older Node: the flags exist only on 25+, while the old polyfill runs anywhere. It does not show how either text behaves on Node 25, which is what the line is for. The e10 counts are not counted in the records, and they change no pass count, since e7 fails every goal-001 run. **Any codex row of this benchmark on macOS has the same problem.** Fixing it needs the executor's login shell to resolve Node 25, not the driver's `PATH`.

### quiz-005

- **e3 (one-off demo fix): new 0/3 · old 1/3 · none 3/3.** Unaided GPT says "send a harmless transaction / mine a block" or `cast rpc evm_mine`. old-2 offered `evm_increaseTime` + `evm_mine` next to `--block-time`. Both skill texts give `anvil_setIntervalMining 1`.
- **e4 (generalizing past vesting): new 3/3 · old 2/3 · none 3/3.** All three new answers end on `--block-time 1` and never widen past vesting. old-1 passes ("deadlines, expiries, auctions, and other `block.timestamp` logic"). This is the same direction as Opus (new 2/3 vs old 0/3): on two stacks, the new text's list of displays carries into the answer less often than the old rule about contract logic.

## Cost

All figures come from `yarn run-stats --tasks <ids> --benchmark major-refine-d9952522` with `--variant no_skill`, `--skill-version 2f0adb01` and `--skill-version d9952522`. Each cell is the median per task per arm. **Cost is `cost_source: list_price`**: the run's token split priced at OpenAI's standard list price in `lib/prices.ts`, not what was billed. Tokens are `total_tokens`. Codex reports no turn count.

| Task | none: duration / cost (range) / tokens | old: duration / cost (range) / tokens | new: duration / cost (range) / tokens |
| --- | --- | --- | --- |
| `quiz-001` | 146s / $0.54 ($0.51–$0.82) / 157,552 | 176s / $0.67 ($0.54–$0.77) / 314,598 | 122s / $0.44 ($0.19–$0.67) / 180,274 |
| `quiz-002` | 73s / $0.20 ($0.12–$0.41) / 98,311 | 43s / $0.13 ($0.08–$0.14) / 79,337 | 53s / $0.15 ($0.14–$0.16) / 90,635 |
| `quiz-003` | 70s / $0.20 ($0.16–$0.20) / 84,277 | 97s / $0.49 ($0.14–$0.51) / 162,075 | 58s / $0.14 ($0.12–$0.15) / 76,214 |
| `quiz-004` | 151s / $0.78 ($0.69–$1.44) / 332,051 | 93s / $0.39 ($0.30–$0.91) / 137,705 | 91s / $0.59 ($0.33–$0.68) / 255,506 |
| `quiz-005` | 49s / $0.13 ($0.12–$0.13) / 69,229 | 68s / $0.21 ($0.17–$0.29) / 95,429 | 53s / $0.14 ($0.12–$0.15) / 75,413 |
| `quiz-006` | 87s / $0.29 ($0.15–$0.42) / 140,142 | 62s / $0.19 ($0.16–$0.20) / 84,581 | 53s / $0.11 ($0.10–$0.15) / 58,602 |
| `goal-001` | 1835s / $5.96 ($4.93–$9.22) / 7,806,511 | 1296s / $5.92 ($5.83–$7.12) / 7,254,889 | 1120s / $6.23 ($4.72–$12.05) / 8,299,690 |
| `goal-002` | 894s / $1.91 ($1.77–$1.96) / 1,734,607 | 1334s / $2.92 ($1.57–$2.96) / 2,749,943 | 1452s / $6.49 ($5.65–$8.39) / 9,223,979 |

Arm totals (sum of `usage.cost_usd`, list price): none $33.07 · old $32.61 · new $48.05.

- **Quizzes:** differences are cents, and no arm is cheapest across the board.
- **goal-001:** the ranges overlap. new has both the fastest median and the dearest single run ($12.05).
- **goal-002:** new costs 2–3× the other arms ($6.49 / 9.2M tokens against $2.92 and $1.91). That is the cost of what it does: `create-eth` plus `yarn install` for a full SE-2 monorepo, against a small hand-built Hardhat app that fails both lines. It is most of the $15 gap between the new arm's total and the others.

**Load.** The 9 drivers of this row (3 quiz chains, 6 goal-round drivers) shared the machine with another GPT row's executors (up to ~14 concurrent codex processes). The arms were interleaved, so each round carried the same load.

## Blindness

Three goal-002 new runs were refused by `verify`'s blindness check and graded with `--allow-skill-mention`. Every hit is `output/AGENTS.md:238` (`output/usdc-tip-jar/AGENTS.md:238` for new-3), the `**Skills** (read .agents/skills/<name>/SKILL.md …)` line that `create-eth` writes into every scaffold. It is a consequence of passing expect_1, as on the Opus row. No goal-001 run and no none/old run was refused.

## Harness notes

- **`.npm-cache` / `.home` in the evidence (5 grades).** Codex's `workspace-write` sandbox does not allow writing `~/.npm`. Five goal-002 executors (none-3, old-1/2/3, new-3) therefore pointed npm's cache into the workspace (`.npm-cache/`, 79–424 MB on disk). new-3 also pointed `HOME` at `usdc-tip-jar/.home/`, which filled with corepack and node-gyp caches. Neither name is in `GENERATED_DIRS`, so the snapshots came to 34–74 MB and the claude judge died with `judge failed: spawnSync env EPIPE`. With the human's approval, and following the precedent in `reports/tools-2026-08-13.md`, only those cache directories were deleted from the workspaces (`.npm-cache`, `.home/Library/Caches`, `.home/.cache`). `verify` then re-snapshotted and graded them with the same judge. No file the executor authored was touched, and no run was re-executed. This is the gap the building-blocks GPT row already asked to close. **Add `.npm-cache` to `GENERATED_DIRS`**; `.home` is a one-off.
- **Evidence:** all 54 quiz `output/answer.md` and all 9 goal-002 `output/` snapshots (290–600 KB each, ~4.4 MB) are force-added, so every grade here can be regraded from a clone. new-3's `.home/` is left out of the commit: it is a scratch home (a `.svm` version file, SE-2's default Anvil keystore, a Next telemetry config), not deliverable. The `packages/foundry/.env` files in new-2/new-3 are create-eth's defaults, and the same keys are in `templates/se-2-foundry/packages/foundry/.env.example`. goal-001 evidence is `run.diff`.
- **Record keys:** `codex/gpt-5.5/high`, next to #152's `claude/claude-opus-5/medium`. The mistake files here start from #152's versions (its new `frozen-timestamp-not-generalized` included), so whichever of the two PRs merges second will hit a small conflict in `mistakes/frontend-playbook/`. The `frozen-timestamp-wrong-oneoff-fix-codex` record (2026-08-12, model unrecorded) stays as it was; this row's reading is under `frozen-timestamp-wrong-oneoff-fix` so it is counted once.

## Records

- **New:** `scaffold-hooks-bypassed-handwritten-abi` (goal-002 e2, new 1/3). Three single none-arm sightings on the quizzes: `fork-started-via-yarn-chain-flag` (quiz-001, borderline), `fork-targets-hardhat-not-foundry` (quiz-002), `ipfs-export-images-not-unoptimized` (quiz-003).
- **Updated with a `codex/gpt-5.5/high` reading (new · old · none):**
  - `deploy-no-clean-rebuild-no-cid-proof`: 3/3 · 3/3 · 3/3, all from e7
  - `deploy-verify-home-route-only`: 0/3 · 3/3 · 3/3
  - `og-metadata-not-prod-url`: 0/3 · 1/3 · 3/3
  - `scaffold-manual-not-create-eth`: 0/3 · 3/3 · 3/3
  - `frozen-timestamp-wrong-oneoff-fix`: 0/3 · 1/3 · 3/3
  - `frozen-timestamp-not-generalized`: 3/3 · 2/3 · 3/3
  - `node25-localstorage-fix-wrong-layer`: quiz-004 0/3 in every arm; goal-001 half not measured (the record has the explanation)
- `site/derived.json` rebuilt.

## Verdict

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | new vs none `17/24 vs 12/24`; old vs none `16/24 vs 12/24`; new vs old `17/24 vs 16/24`. The one task-level gap between skill arms is goal-002, `2/3 vs 0/3`: the new description triggers and its first instruction gets GPT to `create-eth`, the old one does neither. |
| Did it reduce time/tokens? | No. Quizzes are within cents. goal-001: new `1120s / 8.30M / $6.23` vs old `1296s / 7.25M / $5.92` vs none `1835s / 7.81M / $5.96`, ranges overlapping. goal-002: new `1452s / 9.22M / $6.49` vs old `1334s / 2.75M / $2.92` vs none `894s / 1.73M / $1.91`, where new is dearer because it builds the SE-2 monorepo the others skip. Totals: new $48.05 · old $32.61 · none $33.07 (list price). |
| Did it create negative deltas? | new vs old: quiz-005 e4 `3/3 vs 2/3` failures (same direction as Opus); goal-001 e10 3/3 vs 0/3, but not measured on Node 25 (see above); goal-002 cost ~2×. new vs none: none on correctness. |
| What mistakes repeated without the skill? | `scaffold-manual-not-create-eth` 3/3, `deploy-no-clean-rebuild-no-cid-proof` 3/3, `deploy-verify-home-route-only` 3/3, `og-metadata-not-prod-url` 3/3, `frozen-timestamp-wrong-oneoff-fix` 3/3, `frozen-timestamp-not-generalized` 3/3; singles `fork-started-via-yarn-chain-flag`, `fork-targets-hardhat-not-foundry`, `ipfs-export-images-not-unoptimized`. |
| What mistakes remained with the skill? | new: `deploy-no-clean-rebuild-no-cid-proof` 3/3 (e7), `frozen-timestamp-not-generalized` 3/3, `scaffold-hooks-bypassed-handwritten-abi` 1/3. old: `deploy-no-clean-rebuild-no-cid-proof` 3/3 (e7), `scaffold-manual-not-create-eth` 3/3, `deploy-verify-home-route-only` 3/3, `frozen-timestamp-not-generalized` 2/3, `og-metadata-not-prod-url` 1/3, `frozen-timestamp-wrong-oneoff-fix` 1/3. |
| What should change in the skill? | (1) Post-upload step 1: make the CID a check, not a note. For example: "compare it with the previous deploy's CID; an unchanged CID means the upload is stale, so stop". Neither text got GPT to write that into `DEPLOY.md`. (2) The freeze sentence as a rule ("any `block.timestamp`-dependent logic stays frozen between transactions"), which now has the same direction on two stacks. (3) Node 25: keep a remedy that is harmless on older Node, for example the `--require` polyfill beside the two flags, since a build told to use a flag its Node rejects drops the fix. |
| What should change in the eval? | (1) Harness: `.npm-cache` into `GENERATED_DIRS` (second row asking). (2) Harness: codex's `zsh -lc` defeats a driver-side Node pin on macOS, so goal-001 e10 needs the executor's login shell to resolve Node 25, or the line should say it applies only when the build ran on Node 25. (3) goal-002's pass puts SE-2's `AGENTS.md` into the evidence, so the blindness check refuses every passing skill-arm run, as on Opus. (4) Four of six quizzes are near-saturated here too. |
