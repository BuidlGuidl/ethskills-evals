export type Variant = "no_skill" | "with_skill";
export type Executor = "claude" | "codex";
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
  // sha256 of the task input the executor was given, so a regrade can tell whether the spec
  // still asks the question this run answered. Absent on runs made before the field existed.
  input_sha?: string;
  created: string;
  // Set only on a regrade: the run whose stored evidence was re-judged. The executor never
  // ran again, so this record is a second reading of one run, not a second run — never
  // count it alongside its source in a pass tally.
  regrade_of?: string;
  executor_model?: string | null;
  executor_exit?: number;
  usage?: RunUsage;
  judge?: JudgeRecord;
  expects?: Record<string, ExpectStatus>;
  pass?: boolean;
};
