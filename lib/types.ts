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
  // The id of the SKILL.md text this run was given. skill_version is the repo's HEAD at
  // setup, which says nothing about whether the skill itself changed; this does. Absent on
  // runs made before the field existed — those are recovered from git history instead, for
  // as long as the branch that holds the sha survives.
  skill_content?: string | null;
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
  executor_exit?: number;
  usage?: RunUsage;
  judge?: JudgeRecord;
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
