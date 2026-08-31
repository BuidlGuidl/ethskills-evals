import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import yaml from "js-yaml";
import { buildEvidence, snapshotOutput, writeDiff } from "../lib/evidence.js";
import { judgeExpectations } from "../lib/judge.js";
import { expectSha, isRecord, loadTaskSpec, loadYamlFile, parseArgs, requireString } from "../lib/task.js";
import type { Executor, ExecutorRecord, ExpectStatus, JudgeSpec, Regrade, ResultRecord, Variant } from "../lib/types.js";
import { pruneEmptyParent, readWorkspacePath } from "../lib/workspace.js";

const ROOT = process.cwd();
const EXECUTORS = new Set<Executor>(["claude", "codex"]);
const VARIANTS = new Set<Variant>(["no_skill", "with_skill"]);
const VERIFY_ARGS = new Set(["run", "judge-agent", "judge-model", "grade-failed-run", "keep-workspace", "regrade", "reason"]);

// The judge is a fresh, blind process, never the orchestrator's own contaminated
// context. --judge-agent is required rather than defaulting to the run's executor:
// the default was silent, and a batch graded by a forgotten flag looks exactly like a
// batch graded on purpose. Say who grades, every time.
const resolveJudge = (args: Record<string, string | boolean>): JudgeSpec => {
  if (args["judge-agent"] === undefined) {
    throw new Error("missing --judge-agent: name the agent doing the grading (claude or codex)");
  }

  const agent = parseAgent(requireString(args["judge-agent"], "--judge-agent"));
  const model = args["judge-model"] === undefined ? null : requireString(args["judge-model"], "--judge-model");

  return { agent, model };
};

const parseExecutor = (value: string): Executor => {
  if (!EXECUTORS.has(value as Executor)) {
    throw new Error(`unknown executor in result.yaml: ${value}`);
  }

  return value as Executor;
};

const parseAgent = (value: string): Executor => {
  if (!EXECUTORS.has(value as Executor)) {
    throw new Error(`unknown --judge-agent: ${value} (expected claude or codex)`);
  }

  return value as Executor;
};

const parseVariant = (value: string): Variant => {
  if (!VARIANTS.has(value as Variant)) {
    throw new Error(`unknown variant in result.yaml: ${value}`);
  }

  return value as Variant;
};

const readExpects = (value: unknown) => {
  if (!isRecord(value)) {
    throw new Error("expects must be a mapping");
  }

  const expects: Record<string, ExpectStatus> = {};

  for (const [name, status] of Object.entries(value)) {
    if (status !== "pass" && status !== "fail") {
      throw new Error(`expect ${name} must be pass or fail`);
    }

    expects[name] = status;
  }

  return expects;
};

// Prior regrades are replayed verbatim rather than re-parsed field by field: this script
// only ever appends to the list, and a stricter reader here would reject a record written
// by a later version of the harness that a re-grade should still be able to extend.
const readRegrades = (value: unknown) => {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error("regrades must be a list");
  }

  return value as Regrade[];
};

const loadResultRecord = (resultPath: string): ResultRecord => {
  const loaded = loadYamlFile(resultPath);

  return {
    task: requireString(loaded.task, "task"),
    run: requireString(loaded.run, "run"),
    executor: parseExecutor(requireString(loaded.executor, "executor")),
    variant: parseVariant(requireString(loaded.variant, "variant")),
    skill_version: loaded.skill_version === null ? null : requireString(loaded.skill_version, "skill_version"),
    created: requireString(loaded.created, "created"),
    executor_model: loaded.executor_model === undefined || loaded.executor_model === null
      ? null
      : requireString(loaded.executor_model, "executor_model"),
    executor_exit: typeof loaded.executor_exit === "number" ? loaded.executor_exit : undefined,
    expect_sha: loaded.expect_sha === undefined ? undefined : requireString(loaded.expect_sha, "expect_sha"),
    expects: loaded.expects === undefined ? undefined : readExpects(loaded.expects),
    pass: loaded.pass === undefined ? undefined : Boolean(loaded.pass),
    regrades: readRegrades(loaded.regrades),
  };
};

// Grading a run whose executor is still working reads a half-written workspace, scores it,
// and then the workspace gets deleted out from under a live process. run-executor writes
// this record; no record or no finished timestamp means there is nothing to grade yet.
// optional on a regrade only: the executor ran long ago and its record is what a first
// grade already copied into result.yaml, so demanding it back would lock every run made
// before run-executor started writing one out of ever being re-judged.
const loadExecutorRecord = (runDir: string, optional = false): ExecutorRecord | null => {
  const recordPath = path.join(runDir, "executor.yaml");

  if (!existsSync(recordPath)) {
    if (optional) {
      return null;
    }

    throw new Error(`no executor record at ${recordPath}; run yarn run-executor --run ${runDir} first`);
  }

  const loaded = loadYamlFile(recordPath);

  if (loaded.finished === null || loaded.finished === undefined) {
    throw new Error(
      `executor has not finished (${recordPath}). Wait for it; if it was killed, the run is dead — delete ${runDir} and set up a new one.`,
    );
  }

  return {
    executor: parseExecutor(requireString(loaded.executor, "executor")),
    model: loaded.model === null || loaded.model === undefined ? null : requireString(loaded.model, "model"),
    started: requireString(loaded.started, "started"),
    finished: requireString(loaded.finished, "finished"),
    exit: typeof loaded.exit === "number" ? loaded.exit : null,
  };
};

const readBaselineSha = (runDir: string) => {
  const baselinePath = path.join(runDir, "baseline.sha");

  if (!existsSync(baselinePath)) {
    throw new Error(`no baseline.sha in ${runDir}; the workspace was not seeded by yarn setup`);
  }

  return readFileSync(baselinePath, "utf8").trim();
};

// A regrade is only worth anything if someone else can run it, so the bar is that the
// evidence is tracked — not merely that it sits in this working copy. output/ is
// gitignored by default (AGENTS.md: force-add it where the snapshot is the deliverable),
// so an untracked snapshot is the normal failure here and the message says how to fix it.
const assertEvidenceCommitted = (runDir: string, bareTask: boolean) => {
  const evidence = bareTask ? "output" : "run.diff";
  const evidencePath = path.join(runDir, evidence);

  if (!existsSync(evidencePath)) {
    throw new Error(
      `no ${evidence} in ${runDir}; there is nothing to regrade. The workspace is long gone, so this run's grade cannot be reproduced.`,
    );
  }

  // ls-files exits non-zero rather than empty when the path is outside the repo — a run dir
  // passed from somewhere other than artifacts/. Untracked and unreachable are the same
  // answer here (no other clone has it), so both land on one message.
  const tracked = (() => {
    try {
      return execFileSync("git", ["ls-files", "--", evidencePath], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch {
      return "";
    }
  })();

  if (tracked.length === 0) {
    throw new Error(
      `${evidencePath} exists but is not tracked by git, so a regrade here would grade material no other clone has. `
        + `Commit it first: git add -f ${path.relative(ROOT, evidencePath)}`,
    );
  }
};

const summarize = (expects: Record<string, ExpectStatus>) => {
  const rows = Object.entries(expects);
  const nameWidth = Math.max("check".length, ...rows.map(([name]) => name.length));

  console.log(`${"check".padEnd(nameWidth)}  status`);
  console.log(`${"-".repeat(nameWidth)}  ------`);

  for (const [name, status] of rows) {
    console.log(`${name.padEnd(nameWidth)}  ${status}`);
  }
};

const main = async () => {
  try {
    const args = parseArgs(VERIFY_ARGS);
    const runArg = requireString(args.run, "--run");
    const runDir = path.resolve(ROOT, runArg);
    const resultPath = path.join(runDir, "result.yaml");

    if (!existsSync(resultPath)) {
      throw new Error(`missing result.yaml at ${resultPath}`);
    }

    const rawResult = loadYamlFile(resultPath);
    const graded = Object.prototype.hasOwnProperty.call(rawResult, "pass");
    // parseArgs takes the next token as a value, so `--regrade` alone is `true` and
    // `--regrade "expect_5 added"` is that string; either means regrade, same as
    // --keep-workspace and --grade-failed-run above.
    const regrading = args.regrade !== undefined;

    if (graded && !regrading) {
      throw new Error(
        `run already graded (${runDir}). A fresh executor pass is a new run id, never an overwrite — run setup again for that. `
          + `To re-judge THIS run's committed evidence against edited expect lines, pass --regrade --reason "<why>".`,
      );
    }

    if (regrading && !graded) {
      throw new Error(`nothing to regrade: ${resultPath} carries no grade yet. Grade it first without --regrade.`);
    }

    // Resolved before the judge runs, not after: a missing reason is an argument error, and
    // discovering it once the judge has already been paid for wastes the call.
    const regradeReason = regrading
      ? (typeof args.reason === "string" ? args.reason : requireString(args.regrade, "--reason (or --regrade \"<why>\")"))
      : null;

    const result = loadResultRecord(resultPath);
    const judgeSpec = resolveJudge(args);
    const executorRecord = loadExecutorRecord(runDir, regrading);

    if (executorRecord !== null && executorRecord.executor !== result.executor) {
      throw new Error(`executor.yaml ran ${executorRecord.executor}, result.yaml says ${result.executor}`);
    }

    // A CLI that was missing, crashed or was killed leaves evidence a judge reads as a bad
    // answer, and the run then records as a model failure. That is the same
    // harness-failure-stored-as-a-zero that --judge-agent exists to rule out, so grading a
    // bad exit has to be a stated choice.
    if (executorRecord !== null && executorRecord.exit !== 0 && args["grade-failed-run"] === undefined) {
      throw new Error(
        `executor exited ${executorRecord.exit ?? "unknown"}; that is a harness failure, not a score. `
          + `Delete ${runDir} and set up a new run, or pass --grade-failed-run to grade what it left behind anyway.`,
      );
    }

    const taskSpec = loadTaskSpec(path.join(ROOT, "tasks", `${result.task}.yaml`));
    // A regrade runs long after verify deleted the workspace, so the committed evidence is
    // all there is — which is exactly why it has to be committed. Re-snapshotting is not
    // just impossible here, it would be wrong: the point is to re-judge the same material.
    const workspacePath = regrading ? null : readWorkspacePath(runDir);

    if (workspacePath === null) {
      assertEvidenceCommitted(runDir, taskSpec.template === undefined);
    } else if (taskSpec.template === undefined) {
      // Evidence shape follows the task shape, not whatever the workspace happens to
      // contain: repo-shaped runs are graded on what changed since the baseline, question-
      // shaped runs on the files themselves. Every workspace is a git repo now, so keying
      // this off `.git` would quietly move every quiz run onto the diff path.
      await snapshotOutput(workspacePath, path.join(runDir, "output"));
    } else {
      await writeDiff(workspacePath, path.join(runDir, "run.diff"), readBaselineSha(runDir));
    }

    const verdict = judgeExpectations(taskSpec.input, taskSpec.expect, await buildEvidence(runDir), judgeSpec);

    if (!verdict.ok) {
      throw new Error(`judge failed: ${verdict.error}`);
    }

    const pass = Object.values(verdict.expects).every(status => status === "pass");
    const judgeRecord = { ...judgeSpec, self_judged: judgeSpec.agent === result.executor };
    const sha = expectSha(taskSpec.expect);
    // Rebuilt field by field rather than spread: loadResultRecord leaves `expects` and
    // `pass` as undefined keys, so spreading would strand `judge` below them in the yaml.
    const gradedResult: ResultRecord = {
      task: result.task,
      run: result.run,
      executor: result.executor,
      variant: result.variant,
      skill_version: result.skill_version,
      created: result.created,
      executor_model: executorRecord === null ? result.executor_model ?? null : executorRecord.model,
      executor_exit: executorRecord === null ? result.executor_exit : executorRecord.exit ?? undefined,
      judge: judgeRecord,
      expect_sha: sha,
      expects: verdict.expects,
      pass,
    };

    if (regrading) {
      // The superseded grade is kept whole. A record that said only "this was regraded"
      // would leave the old table in a merged report unreconstructable, which is the
      // failure mode an in-place edit to a grade otherwise causes.
      gradedResult.regrades = [
        ...(result.regrades ?? []),
        {
          at: new Date().toISOString(),
          reason: regradeReason as string,
          judge: judgeRecord,
          superseded: {
            expect_sha: result.expect_sha ?? null,
            expects: result.expects ?? {},
            pass: result.pass ?? false,
          },
        },
      ];
    }

    await writeFile(resultPath, yaml.dump(gradedResult, { lineWidth: -1 }));

    summarize(verdict.expects);

    if (regrading) {
      const before = result.pass === true ? "pass" : "fail";

      console.log(`regraded against expect_sha ${sha} (was ${result.expect_sha ?? "unrecorded"}): ${before} -> ${pass ? "pass" : "fail"}`);
    }

    // After the summary, and never fatal. Workspaces sit outside the repo now, so nothing
    // cleans them up with the run dir and a benchmark leaves tens of gigabytes behind — but
    // the grade is already written, and result.yaml carrying `pass` means the regrade guard
    // will refuse to run this run again. A failed rm (EBUSY, a read-only mount, an open handle)
    // must not be the reason a graded run never reports.
    // `!== undefined` rather than `=== true`: parseArgs takes the next token as the value, so
    // `--keep-workspace true` yields the string "true", and reading that as "delete it" would
    // irreversibly discard the workspace the user asked to keep.
    if (workspacePath === null) {
      // regrade: there was never a workspace in this invocation to clean up.
    } else if (args["keep-workspace"] !== undefined) {
      console.log(`workspace kept at ${workspacePath}`);
    } else {
      try {
        await rm(workspacePath, { recursive: true, force: true });
        pruneEmptyParent(workspacePath);
      } catch (error) {
        console.warn(`verify: graded, but could not remove ${workspacePath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    process.exit(pass ? 0 : 2);
  } catch (error) {
    console.error(`verify: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
};

await main();
