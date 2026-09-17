// routing: the task's skill plus every skill it cedes to or from, installed together (#134).
// A with_skill workspace holds one skill, so it can show that an agent loads the one relevant
// skill it has; it cannot fail for a wrong "Not for … (`x`)" cede, because a cede only decides
// anything when both skills are there to choose between.
export type Variant = "no_skill" | "with_skill" | "routing";
export const VARIANTS = ["no_skill", "with_skill", "routing"] as const;
// The agent CLIs the harness can spawn to perform a run. opencode is the route to open
// models: it takes any provider/model pair, and the harness drives it through OpenRouter
// (lib/opencode-home.ts).
export const EXECUTORS = ["claude", "codex", "opencode"] as const;
export type Executor = (typeof EXECUTORS)[number];
// Who can grade. opencode is not here yet: a judge needs a read-only permission set and a
// final-message capture, neither of which has been exercised on it.
export const JUDGE_AGENTS = ["claude", "codex"] as const;
export type JudgeAgent = (typeof JUDGE_AGENTS)[number];
// A retired task keeps its spec and its artifacts — the record of what it once graded stays
// readable — but `setup` refuses to build a workspace for it, so a stale prior cannot quietly
// re-enter a benchmark table. Anything that lists tasks should filter on this rather than on
// prose in `notes`.
export type TaskStatus = "live" | "retired";

export type TaskSpec = {
  id: string;
  skill: string;
  input: string;
  template?: string;
  expect: string[];
  runs: number;
  status: TaskStatus;
  notes?: string;
};

export type ExpectStatus = "pass" | "fail";

export type JudgeSpec = {
  agent: JudgeAgent;
  model: string;
  reasoning_effort: string;
};

// self_judged: the same agent CLI performed and graded the run. The judge process is
// still fresh and blind, and a single-stack benchmark is self-judged by design — but a
// model is a weak judge of its own mistakes, so the report says so.
export type JudgeRecord = JudgeSpec & {
  self_judged: boolean;
};

// A judge as an existing record carries it. Grades written before the model and effort were
// required name one or neither, so reading one back cannot demand what a new grade promises;
// a fresh JudgeRecord satisfies this type, never the other way round.
export type RecordedJudge = {
  agent: JudgeAgent;
  model: string | null;
  reasoning_effort: string | null;
  self_judged: boolean;
};

// What a run cost, so a benchmark can report more than pass counts. duration_s is the
// harness's own wall clock and means the same thing on both stacks; everything else is
// what the executor reported, hence the nulls. Both stacks give the same four-way token split
// (codex through `exec --json`): input_tokens is the uncached remainder, the two cache fields
// carry almost the whole run, and total_tokens is the sum of all four. claude also gives turns
// and its own dollar cost; codex gives neither, so its cost_usd is derived from the split and a
// list price (lib/prices.ts) and cost_source says which of the two a figure is. opencode
// reports a cost of its own on every step, priced by opencode from models.dev's list, so it
// records as `executor` like claude does — and, like claude's, it is a list-price figure, not
// a bill: OpenRouter charges the routed provider's rate.
//
// Codex runs made before `--json` (before 2026-09-15) carry only total_tokens, taken from the
// `tokens used` line — uncached input plus output, several times smaller than the same run's
// total here. Those totals are a different unit from every other total in this type.
export type CostSource = "executor" | "list_price";

export type RunUsage = {
  duration_s: number | null;
  turns: number | null;
  cost_usd: number | null;
  // absent on records made before the field existed; every one of those is claude-reported
  cost_source: CostSource | null;
  input_tokens: number | null;
  cache_creation_input_tokens: number | null;
  cache_read_input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
};

// Written by run-executor, read by verify: the harness spawned the executor, so it knows
// which model ran and whether the process actually finished. A missing or unfinished
// record is what stops verify from grading a workspace an executor is still writing to.
export type ExecutorRecord = {
  executor: Executor;
  model: string | null;
  // Every executor, always passed on argv: --effort for claude and opencode, and for codex
  // --effort or the operator's top-level `model_reasoning_effort =`. null only on records
  // made before #118.
  reasoning_effort?: string | null;
  // opencode only: the pinned models catalog the run's efforts and prices came from
  // (lib/opencode-home.ts), so a re-pin partway through a benchmark shows in the record.
  models_catalog?: string;
  started: string;
  finished: string | null;
  exit: number | null;
  usage?: RunUsage;
  // Which of result.yaml's installed_skills the executor loaded, in the order it first reached
  // for each, read from transcript.md (lib/routing.ts). Absent when nothing was installed.
  skills_loaded?: string[];
};

export type ResultRecord = {
  task: string;
  run: string;
  executor: Executor;
  variant: Variant;
  skill_version: string | null;
  // sha256 of the task input the executor was given, so a regrade can tell whether the spec
  // still asks the question this run answered. Absent on runs made before the field existed.
  input_sha?: string;
  // The id of the SKILL.md text this run was given. skill_version is the repo's HEAD at
  // setup, which says nothing about whether the skill itself changed; this does. Absent on
  // runs made before the field existed — those are recovered from git history instead, for
  // as long as the branch that holds the sha survives.
  skill_content?: string | null;
  // Every skill the workspace held, the task's own first. One name on a with_skill run, the
  // task's skill and its cede neighbours on a routing run; absent on no_skill and on runs made
  // before the field existed.
  installed_skills?: string[];
  // The benchmark this run belongs to: one id shared by every run made for one comparison,
  // named at setup. It is what tells a run made for the site's clean re-run from the runs
  // that came before it, which a date cannot: a benchmark takes weeks, and a stray run made
  // by hand in that window carries no id. Absent on runs made before the field existed.
  benchmark?: string;
  created: string;
  // Set only on a regrade: the run whose stored evidence was re-judged. The executor never
  // ran again, so this record is a second reading of one run, not a second run — never
  // count it alongside its source in a pass tally.
  regrade_of?: string;
  // Why the re-reading happened, stated at the command line. A regrade dir with no reason
  // is indistinguishable from a duplicate grade once the rubric edit has scrolled out of
  // sight in git log, and the reason is what a report cites when the numbers move.
  regrade_reason?: string;
  // When it happened. `created` is the run's, copied from the source, so without this a
  // regrade record carries no date of its own and the ordering of two of them is only
  // recoverable from git.
  regraded_at?: string;
  executor_model?: string | null;
  executor_reasoning_effort?: string | null;
  executor_exit?: number;
  // Copied from executor.yaml by verify: which of installed_skills the run loaded, first one
  // first. On a routing run the first name is the answer the run exists to give.
  skills_loaded?: string[];
  // Only ever set by --grade-failed-run: the run was graded over a refusal, and this says
  // which one. Without it a shell-broken run graded by hand writes executor_exit: 0 and
  // reads as a clean result, which is the exact condition the refusal exists to expose.
  harness_failure?: string;
  usage?: RunUsage;
  // RecordedJudge, not JudgeRecord: a grade written before the model and effort were required
  // names one or neither, and those records still have to be readable.
  judge?: RecordedJudge;
  // Fingerprint of the expect list this grade was made against. Two runs of one task are
  // comparable only when it matches; an edit to any expect line changes it, which is what
  // makes a stale grade detectable instead of merely wrong.
  expect_sha?: string;
  expects?: Record<string, ExpectStatus>;
  pass?: boolean;
  // Set when the grade is an artifact of the harness rather than a measurement of the
  // model — the case verify's non-zero-exit guard exists to catch, reached anyway by a
  // run whose deliverable never made it into the evidence. The grade stays as written,
  // because deleting it would hide that the run happened; reports exclude it and say so.
  retracted?: string;
};
