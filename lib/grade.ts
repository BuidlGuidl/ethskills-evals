import type { ExecutorRecord, ExpectStatus, JudgeSpec, ResultRecord } from "./types.js";

export type Verdict = {
  expects: Record<string, ExpectStatus>;
  expectSha: string;
  judge: JudgeSpec;
  // What --grade-failed-run overrode, if anything; see verify.
  harnessFailure: string | undefined;
};

// A regrade writes its record beside the source: `run` is the new dir's name.
export type Regrade = { run: string; reason: string; at: string };

// The record verify writes, built here rather than inline so a test can see what a grade
// keeps from its source: the fields setup wrote, `benchmark` among them, are carried on a
// first grading and on a regrade alike, and a regrade inherits its source's benchmark
// rather than naming one — supersession runs along `regrade_of`, so a re-reading filed
// under another id would take the run out of the benchmark it was made for.
//
// Rebuilt field by field rather than spread: loadResultRecord leaves `expects` and `pass`
// as undefined keys, so spreading would strand `judge` below them in the yaml.
export const gradedRecord = (
  result: ResultRecord,
  verdict: Verdict,
  executorRecord: ExecutorRecord | null,
  regrade: Regrade | null,
): ResultRecord => ({
  task: result.task,
  run: regrade === null ? result.run : regrade.run,
  executor: result.executor,
  variant: result.variant,
  skill_version: result.skill_version,
  ...(result.input_sha === undefined ? {} : { input_sha: result.input_sha }),
  skill_content: result.skill_content,
  ...(result.benchmark === undefined ? {} : { benchmark: result.benchmark }),
  created: result.created,
  ...(regrade === null ? {} : { regrade_of: result.run, regrade_reason: regrade.reason, regraded_at: regrade.at }),
  executor_model: executorRecord === null ? result.executor_model ?? null : executorRecord.model,
  executor_reasoning_effort:
    executorRecord === null ? result.executor_reasoning_effort ?? null : executorRecord.reasoning_effort ?? null,
  executor_exit: executorRecord === null ? result.executor_exit : executorRecord.exit ?? undefined,
  // Carried like `retracted` below: a run that was graded over a dead shell stays a run
  // that was graded over a dead shell, and a regrade has no capture left to re-detect it
  // from — executor.err is gitignored, so re-deriving it would silently drop the flag.
  harness_failure: verdict.harnessFailure ?? result.harness_failure,
  // Copied from executor.yaml rather than re-derived: run-executor measured it, and
  // the raw capture it measured from is gitignored, so result.yaml is where a reader
  // of the eval PR can still see what the run cost.
  usage: executorRecord === null ? result.usage : executorRecord.usage,
  judge: { ...verdict.judge, self_judged: verdict.judge.agent === result.executor },
  expect_sha: verdict.expectSha,
  expects: verdict.expects,
  pass: Object.values(verdict.expects).every(status => status === "pass"),
  // A retraction is a fact about the run — its deliverable never reached the evidence —
  // so it survives a re-reading of that evidence. Dropping it here would launder an
  // excluded run back into a table by way of a rubric edit.
  ...(result.retracted === undefined ? {} : { retracted: result.retracted }),
});
