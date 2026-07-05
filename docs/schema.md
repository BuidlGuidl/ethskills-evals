# Record schemas

Reference for the three yaml records plus the verifier contract. Types live in `lib/types.ts`; this file is the human-readable version.

## Task spec — `tasks/<id>.yaml`

The running example below uses the [ethskills](https://ethskills.com) `gas` skill, which exists to counter a stale training prior (models confidently quote 10-30 gwei; post-Fusaka base fee is usually under 1 gwei). Example values are illustrative.

```yaml
id: gas-cost-estimate-001
skill: gas                     # skill name; also the install dir name in the workspace
domain: ethereum
input: "Estimate what an ERC-20 transfer costs on Ethereum mainnet right now, in USD. Show how you got each number."
workspace:                     # exactly one of repo+commit or template
  template: templates/gas-cost-estimate
  # repo: scaffold-eth/scaffold-eth-2   # alternative: github clone at a pinned commit
  # commit: abc123
skill_source:
  path: ../ethskills/gas       # default install source for with_skill; override per run with --skill-path
verifier: verifiers/gas-cost-estimate.ts
expect:                        # optional: LLM-judged conditions, only for what an assert can't check
  - "The explanation walks through how each number was obtained, not just the final figure."
runs_per_variant: 5
notes: "Executor must not see assertions. The skill's whole job is beating the stale-gas prior."
```

Everything that varies at run time — variant, `--skill-path`, `--force-skill` — is a CLI flag, not spec content.

Rules that make results comparable:

- `input` is identical for every variant. If you need a different prompt, that's a different task.
- `runs_per_variant` below 3 tells you almost nothing; single runs are noise.
- The verifier file never enters a workspace. `setup-workspace` enforces this.
- Assert-first: an `expect:` line is for what a script can't check. Add an assert for anything a judge might bluff.

## Result record — `artifacts/<task-id>/<run-id>/result.yaml`

Written by `yarn verify`. The orchestrator fills the nulls afterwards from what it observed while spawning the executor.

```yaml
task_id: gas-cost-estimate-001
run_id: 2026-07-03T090000Z-with-skill-3
variant: with_skill
forced: false                  # true when the run was set up with --force-skill
model: claude-opus-4-6         # null until the orchestrator fills it
skill_version: git:191dcc1     # from setup; null when no skill installed
outcome: task_fail             # pass | task_fail | cheat | infra_error | timeout | judge_error
score: 2
max_score: 4                   # asserts + expects together
assertions:                    # deterministic checks from the verifier
  live_base_fee_checked: pass  # fetched cast base-fee / JSON-RPC instead of quoting a prior
  gwei_magnitude_current: pass # sub-1 gwei estimate, not the stale 10-30 gwei
  usd_from_live_eth_price: fail
expects:                       # LLM-judged conditions; never blended into assertions
  expect_1: fail               # numbered in task-spec order
metrics:
  seconds: 84                  # nulls until the orchestrator fills them
  input_tokens: 9000
  output_tokens: 1200
failure_tags:
  - stale-eth-price
artifacts:
  diff: run.diff
  transcript: transcript.md    # gitignored, machine-local
```

`verify` assigns `pass` (everything passed), `task_fail` (any assert or expect failed), or `judge_error` (the judge call failed or returned garbage). `cheat`, `infra_error`, and `timeout` are orchestrator calls made after reading the transcript — a script can't see that the run hung or gamed the eval.

Runs are append-only. A re-run after a skill patch is a new run id; never overwrite history. (Records from before the 2026-07-05 lean-down use the old variant names and a boolean `pass` — they stay valid as history.)

## Mistake record — `mistakes/<skill>/<mistake-id>.yaml`

The part that makes the framework useful. Scores say whether the skill helped; mistakes say what to write next.

```yaml
mistake_id: gas-stale-eth-price
skill: gas
first_seen: 2026-07-03
frequency:                     # per variant; key forced runs separately as with_skill_forced
  no_skill: 5/5
  with_skill: 3/5
category: stale-knowledge
symptom: "Model computes USD cost from a remembered ETH price instead of checking one."
expected_pattern: "Fetch ETH/USD from a live source (Chainlink feed, CoinGecko) before quoting dollars."
skill_section: "What You Probably Got Wrong"   # the section that should prevent this, or "none" for a gap
status: open                   # open | fixed | wontfix
```

File a record the first time a mistake appears; `frequency: 1/1` marks the evidence as weak, which beats losing the observation.

## Verifier contract — `verifiers/*.ts`

A verifier default-exports a function from workspace path to report:

```ts
import type { Verifier } from "../lib/types";

const verify: Verifier = async workspacePath => ({
  assertions: {
    live_base_fee_checked: /* deterministic check, e.g. transcript shows an RPC call */ ? "pass" : "fail",
  },
});

export default verify;
```

Deterministic checks only: file assertions, builds, tests, AST checks, final state. Anything that needs judgment goes in the task spec's `expect:` list, graded by the blind judge — never inside a verifier.

## Report ending — `reports/<task-id>-<date>.md`

Every report ends with the same table:

| Question | Answer |
| --- | --- |
| Did the skill improve pass rate? | raw counts + pass@k, e.g. `3/3 vs 1/3 (pass@3: 100% vs 100%)` |
| Did it reduce time/tokens? | yes/no |
| Did it create negative deltas? | list them |
| What mistakes repeated without the skill? | mistake ids |
| What mistakes remained with the skill? | mistake ids |
| What should change in the skill? | concrete edits |
| What should change in the eval? | missing or weak assertions |

Pass rate with raw counts is the headline; pass@k saturates on exactly the runs you care about (1/3 vs 3/3 is a huge effect that pass@3 reports as a tie). The last row is there on purpose. Sometimes the eval is the wrong artifact, not the skill.
