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

// Written by run-executor, read by verify: the harness spawned the executor, so it knows
// which model ran and whether the process actually finished. A missing or unfinished
// record is what stops verify from grading a workspace an executor is still writing to.
export type ExecutorRecord = {
  executor: Executor;
  model: string | null;
  started: string;
  finished: string | null;
  exit: number | null;
};

// A regrade replaces a run's grade in place, which is the one thing in this repo that is
// not append-only — so every replacement leaves the grade it superseded behind, with the
// expect_sha it was made against. Without that trail a rubric edit silently rewrites
// history and the old numbers become unrecoverable rather than merely superseded.
export type Regrade = {
  at: string;
  reason: string;
  judge: JudgeRecord;
  superseded: {
    expect_sha: string | null;
    expects: Record<string, ExpectStatus>;
    pass: boolean;
  };
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
  judge?: JudgeRecord;
  // Fingerprint of the expect list this grade was made against. Two runs of one task are
  // comparable only when it matches; an edit to any expect line changes it, which is what
  // makes a stale grade detectable instead of merely wrong.
  expect_sha?: string;
  expects?: Record<string, ExpectStatus>;
  pass?: boolean;
  regrades?: Regrade[];
};
