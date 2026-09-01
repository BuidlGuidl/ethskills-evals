import { existsSync, readFileSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import yaml from "js-yaml";
import { guardJudgeBlindness } from "../lib/blindness.js";
import { buildEvidence, snapshotOutput, writeDiff } from "../lib/evidence.js";
import { judgeExpectations } from "../lib/judge.js";
import { isRecord, loadTaskSpec, loadYamlFile, parseArgs, requireString } from "../lib/task.js";
import { parseUsageRecord } from "../lib/usage.js";
import type { Executor, ExecutorRecord, ExpectStatus, JudgeSpec, ResultRecord, Variant } from "../lib/types.js";
import { pruneEmptyParent, readWorkspacePath } from "../lib/workspace.js";

const ROOT = process.cwd();
const EXECUTORS = new Set<Executor>(["claude", "codex"]);
const VARIANTS = new Set<Variant>(["no_skill", "with_skill"]);
const VERIFY_ARGS = new Set([
  "run", "judge-agent", "judge-model", "grade-failed-run", "keep-workspace", "regrade", "allow-skill-mention",
]);
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

const loadResultRecord = (resultPath: string): ResultRecord => {
  const loaded = loadYamlFile(resultPath);

  return {
    task: requireString(loaded.task, "task"),
    run: requireString(loaded.run, "run"),
    executor: parseExecutor(requireString(loaded.executor, "executor")),
    variant: parseVariant(requireString(loaded.variant, "variant")),
    skill_version: loaded.skill_version === null ? null : requireString(loaded.skill_version, "skill_version"),
    created: requireString(loaded.created, "created"),
    expects: loaded.expects === undefined ? undefined : readExpects(loaded.expects),
    pass: loaded.pass === undefined ? undefined : Boolean(loaded.pass),
  };
};

// Grading a run whose executor is still working reads a half-written workspace, scores it,
// and then the workspace gets deleted out from under a live process. run-executor writes
// this record; no record or no finished timestamp means there is nothing to grade yet.
const loadExecutorRecord = (runDir: string): ExecutorRecord => {
  const recordPath = path.join(runDir, "executor.yaml");

  if (!existsSync(recordPath)) {
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
    usage: parseUsageRecord(loaded.usage),
  };
};

const readBaselineSha = (runDir: string) => {
  const baselinePath = path.join(runDir, "baseline.sha");

  if (!existsSync(baselinePath)) {
    throw new Error(`no baseline.sha in ${runDir}; the workspace was not seeded by yarn setup`);
  }

  return readFileSync(baselinePath, "utf8").trim();
};

// Regrades are numbered so a grading surface can be revised more than once without an
// overwrite: <run-id>-regrade-1, -2, ...
const nextRegradeDir = (runDir: string) => {
  for (let n = 1; ; n++) {
    const candidate = `${runDir}-regrade-${n}`;

    if (!existsSync(candidate)) {
      return candidate;
    }
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
    // `!== undefined` rather than `=== true`, for the reason spelled out at the workspace
    // cleanup below: parseArgs takes the next token as a value, so `--regrade true` parses
    // as the string "true".
    const regrade = args.regrade !== undefined;
    const alreadyGraded = Object.prototype.hasOwnProperty.call(rawResult, "pass");

    if (alreadyGraded && !regrade) {
      throw new Error(`run already graded; delete ${runDir} and re-run setup-workspace if you need a redo`);
    }

    // A regrade re-reads what the first grading captured. With no first grading there is
    // no stored evidence to re-read, so this is a mistyped command, not a second reading.
    if (regrade && !alreadyGraded) {
      throw new Error("--regrade re-reads a graded run's stored evidence; grade it first without the flag");
    }

    const result = loadResultRecord(resultPath);
    const judgeSpec = resolveJudge(args);
    const executorRecord = loadExecutorRecord(runDir);

    if (executorRecord.executor !== result.executor) {
      throw new Error(`executor.yaml ran ${executorRecord.executor}, result.yaml says ${result.executor}`);
    }

    // A CLI that was missing, crashed or was killed leaves evidence a judge reads as a bad
    // answer, and the run then records as a model failure. That is the same
    // harness-failure-stored-as-a-zero that --judge-agent exists to rule out, so grading a
    // bad exit has to be a stated choice.
    if (executorRecord.exit !== 0 && args["grade-failed-run"] === undefined) {
      throw new Error(
        `executor exited ${executorRecord.exit ?? "unknown"}; that is a harness failure, not a score. `
          + `Delete ${runDir} and set up a new run, or pass --grade-failed-run to grade what it left behind anyway.`,
      );
    }

    const taskSpec = loadTaskSpec(path.join(ROOT, "tasks", `${result.task}.yaml`));
    // A regrade asks whether the current expect lines would have graded this run
    // differently, so it must not re-execute or re-capture anything: the workspace is gone
    // by then anyway, deleted when the run was first graded. Re-running to test a wording
    // change confounds the grading surface with fresh executor variance, which is the one
    // thing a regrade exists to avoid.
    const workspacePath = regrade ? null : readWorkspacePath(runDir);

    // Evidence shape follows the task shape, not whatever the workspace happens to
    // contain: repo-shaped runs are graded on what changed since the baseline, question-
    // shaped runs on the files themselves. Every workspace is a git repo now, so keying
    // this off `.git` would quietly move every quiz run onto the diff path.
    if (workspacePath !== null) {
      if (taskSpec.template === undefined) {
        await snapshotOutput(workspacePath, path.join(runDir, "output"));
      } else {
        await writeDiff(workspacePath, path.join(runDir, "run.diff"), readBaselineSha(runDir));
      }
    }

    const evidence = await buildEvidence(runDir);

    // `output/` is gitignored unless a run force-added it, so a clone that did not make the
    // run can be missing the very thing a regrade re-reads. Judging an empty string would
    // score the run as if it had produced nothing.
    if (regrade && evidence.trim().length === 0) {
      throw new Error(`no stored evidence in ${runDir}; a regrade re-reads run.diff or output/, and neither is there`);
    }

    // `!== undefined` rather than `=== true`, per the parseArgs note below: the flag's
    // value is whatever token follows it, so `--allow-skill-mention true` is the string
    // "true" and reading that as "not passed" would fail a grade the operator cleared.
    guardJudgeBlindness(evidence, args["allow-skill-mention"] !== undefined);

    const verdict = judgeExpectations(taskSpec.input, taskSpec.expect, evidence, judgeSpec);

    if (!verdict.ok) {
      throw new Error(`judge failed: ${verdict.error}`);
    }

    const pass = Object.values(verdict.expects).every(status => status === "pass");
    // A regrade is append-only like every other record: it lands in its own dir beside the
    // source, so the original grading stays readable as what the task said at the time.
    const targetDir = regrade ? nextRegradeDir(runDir) : runDir;
    // Rebuilt field by field rather than spread: loadResultRecord leaves `expects` and
    // `pass` as undefined keys, so spreading would strand `judge` below them in the yaml.
    const gradedResult: ResultRecord = {
      task: result.task,
      run: regrade ? path.basename(targetDir) : result.run,
      executor: result.executor,
      variant: result.variant,
      skill_version: result.skill_version,
      created: result.created,
      ...(regrade ? { regrade_of: result.run } : {}),
      executor_model: executorRecord.model,
      executor_exit: executorRecord.exit ?? undefined,
      // Copied from executor.yaml rather than re-derived: run-executor measured it, and
      // the raw capture it measured from is gitignored, so result.yaml is where a reader
      // of the eval PR can still see what the run cost.
      usage: executorRecord.usage,
      judge: { ...judgeSpec, self_judged: judgeSpec.agent === result.executor },
      expects: verdict.expects,
      pass,
    };

    if (regrade) {
      await mkdir(targetDir, { recursive: true });
    }

    await writeFile(path.join(targetDir, "result.yaml"), yaml.dump(gradedResult, { lineWidth: -1 }));

    summarize(verdict.expects);

    // After the summary, and never fatal. Workspaces sit outside the repo now, so nothing
    // cleans them up with the run dir and a benchmark leaves tens of gigabytes behind — but
    // the grade is already written, and result.yaml carrying `pass` means the regrade guard
    // will refuse to run this run again. A failed rm (EBUSY, a read-only mount, an open handle)
    // must not be the reason a graded run never reports.
    // `!== undefined` rather than `=== true`: parseArgs takes the next token as the value, so
    // `--keep-workspace true` yields the string "true", and reading that as "delete it" would
    // irreversibly discard the workspace the user asked to keep.
    if (workspacePath !== null) {
      if (args["keep-workspace"] !== undefined) {
        console.log(`workspace kept at ${workspacePath}`);
      } else {
        try {
          await rm(workspacePath, { recursive: true, force: true });
          pruneEmptyParent(workspacePath);
        } catch (error) {
          console.warn(`verify: graded, but could not remove ${workspacePath}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    process.exit(pass ? 0 : 2);
  } catch (error) {
    console.error(`verify: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
};

await main();
