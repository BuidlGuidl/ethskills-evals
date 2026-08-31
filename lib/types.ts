export type Variant = "no_skill" | "with_skill";
export type Executor = "claude" | "codex";

export type TaskSpec = {
  id: string;
  skill: string;
  input: string;
  template?: string;
  expect: string[];
  runs: number;
  notes?: string;
};

export type ExpectStatus = "pass" | "fail";

export type JudgeSpec = {
  agent: Executor;
  model: string | null;
};

// self_judged: the same agent CLI performed and graded the run. The judge process is
// still fresh and blind, and a single-stack benchmark is self-judged by design — but a
// model is a weak judge of its own mistakes, so the report says so.
export type JudgeRecord = JudgeSpec & {
  self_judged: boolean;
};

// What a run cost, so a benchmark can report more than pass counts. duration_s is the
// harness's own wall clock and means the same thing on both stacks; everything else is
// what the executor chose to report, hence the nulls — claude gives turns, dollars and
// a four-way token split, codex gives a token total and nothing else. On claude the two
// cache fields carry almost the whole run: input_tokens alone is the uncached remainder,
// a double-digit number, and total_tokens is the sum of all four. The totals mean
// different things on the two stacks and are only comparable variant-to-variant within one.
export type RunUsage = {
  duration_s: number | null;
  turns: number | null;
  cost_usd: number | null;
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
  // codex only, and only the operator's top-level `model_reasoning_effort =`: the redirected
  // CODEX_HOME means codex never reads it, so the harness passes it on argv and names it
  // here. null is "none configured, codex's default ran", which is a real answer.
  reasoning_effort?: string | null;
  started: string;
  finished: string | null;
  exit: number | null;
  usage?: RunUsage;
};

export type ResultRecord = {
  task: string;
  run: string;
  executor: Executor;
  variant: Variant;
  skill_version: string | null;
  created: string;
  // Set only on a regrade: the run whose stored evidence was re-judged. The executor never
  // ran again, so this record is a second reading of one run, not a second run — never
  // count it alongside its source in a pass tally.
  regrade_of?: string;
  executor_model?: string | null;
  executor_reasoning_effort?: string | null;
  executor_exit?: number;
  // Only ever set by --grade-failed-run: the run was graded over a refusal, and this says
  // which one. Without it a shell-broken run graded by hand writes executor_exit: 0 and
  // reads as a clean result, which is the exact condition the refusal exists to expose.
  harness_failure?: string;
  usage?: RunUsage;
  judge?: JudgeRecord;
  expects?: Record<string, ExpectStatus>;
  pass?: boolean;
};
