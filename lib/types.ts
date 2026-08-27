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
// an input/output split, codex gives a token total and nothing else.
export type RunUsage = {
  duration_s: number;
  turns: number | null;
  cost_usd: number | null;
  input_tokens: number | null;
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
  created: string;
  executor_model?: string | null;
  executor_exit?: number;
  usage?: RunUsage;
  judge?: JudgeRecord;
  expects?: Record<string, ExpectStatus>;
  pass?: boolean;
};
