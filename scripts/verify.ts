import { existsSync, readFileSync } from "node:fs";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import yaml from "js-yaml";
import { resolveCodexModel } from "../lib/codex-home.js";
import { buildEvidence, snapshotOutput, writeDiff } from "../lib/evidence.js";
import { detectBrokenShell } from "../lib/executor-health.js";
import { judgeExpectations } from "../lib/judge.js";
import { isRecord, loadTaskSpec, loadYamlFile, parseArgs, requireString } from "../lib/task.js";
import type { Executor, ExecutorRecord, ExpectStatus, JudgeSpec, ResultRecord, Variant } from "../lib/types.js";
import { pruneEmptyParent, readWorkspacePath } from "../lib/workspace.js";

const ROOT = process.cwd();
const EXECUTORS = new Set<Executor>(["claude", "codex"]);
const VARIANTS = new Set<Variant>(["no_skill", "with_skill"]);
const VERIFY_ARGS = new Set(["run", "judge-agent", "judge-model", "grade-failed-run", "keep-workspace"]);

// The judge is a fresh, blind process, never the orchestrator's own contaminated
// context. --judge-agent is required rather than defaulting to the run's executor:
// the default was silent, and a batch graded by a forgotten flag looks exactly like a
// batch graded on purpose. Say who grades, every time.
const resolveJudge = (args: Record<string, string | boolean>): JudgeSpec => {
  if (args["judge-agent"] === undefined) {
    throw new Error("missing --judge-agent: name the agent doing the grading (claude or codex)");
  }

  const agent = parseAgent(requireString(args["judge-agent"], "--judge-agent"));
  const requested = args["judge-model"] === undefined ? null : requireString(args["judge-model"], "--judge-model");
  // codex judges under a redirected CODEX_HOME, so nothing supplies the operator's configured
  // model unless the harness passes it. Resolved here rather than inside the runner so that
  // result.yaml records the model that actually graded, not a null the CLI silently filled in.
  const model = agent === "codex" ? resolveCodexModel(requested, "--judge-model") : requested;

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
    reasoning_effort:
      loaded.reasoning_effort === null || loaded.reasoning_effort === undefined
        ? null
        : requireString(loaded.reasoning_effort, "reasoning_effort"),
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

    if (Object.prototype.hasOwnProperty.call(rawResult, "pass")) {
      throw new Error(`run already graded; delete ${runDir} and re-run setup-workspace if you need a redo`);
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

    // The same guard one level deeper, because the exit code does not cover the case that
    // matters most: a run whose shell was dead exits 0, and its transcript reads as a model
    // that chose not to look at anything. Graded, it records as a skill that did not help on
    // a machine where the skill was never read. Refusing takes the same stated override as a
    // bad exit — this is a harness failure either way, and the operator says so out loud.
    const brokenShell = detectBrokenShell(runDir, executorRecord.executor);

    if (brokenShell !== null && args["grade-failed-run"] === undefined) {
      throw new Error(
        `${brokenShell.cause}; it still exited 0, so nothing but the capture shows it. `
          + `${brokenShell.capturePath}: "${brokenShell.evidence}". ${brokenShell.remedy}. `
          + `Delete ${runDir} and set up a new run, or pass --grade-failed-run to grade what it left behind anyway.`,
      );
    }

    // One flag turns off both refusals above, so a run that crashed *and* lost its shell
    // grades on the strength of a single --grade-failed-run. A bad exit is at least visible
    // in executor_exit afterwards; a dead shell exits 0 and leaves nothing, so the override
    // has to write down what it overrode.
    const harnessFailure = brokenShell === null ? undefined : brokenShell.cause;

    if (harnessFailure !== undefined) {
      console.warn(`verify: --grade-failed-run; grading anyway and recording harness_failure: ${harnessFailure}`);
    }

    const taskSpec = loadTaskSpec(path.join(ROOT, "tasks", `${result.task}.yaml`));
    const workspacePath = readWorkspacePath(runDir);

    // Evidence shape follows the task shape, not whatever the workspace happens to
    // contain: repo-shaped runs are graded on what changed since the baseline, question-
    // shaped runs on the files themselves. Every workspace is a git repo now, so keying
    // this off `.git` would quietly move every quiz run onto the diff path.
    if (taskSpec.template === undefined) {
      await snapshotOutput(workspacePath, path.join(runDir, "output"));
    } else {
      await writeDiff(workspacePath, path.join(runDir, "run.diff"), readBaselineSha(runDir));
    }

    const verdict = judgeExpectations(taskSpec.input, taskSpec.expect, await buildEvidence(runDir), judgeSpec);

    if (!verdict.ok) {
      throw new Error(`judge failed: ${verdict.error}`);
    }

    const pass = Object.values(verdict.expects).every(status => status === "pass");
    // Rebuilt field by field rather than spread: loadResultRecord leaves `expects` and
    // `pass` as undefined keys, so spreading would strand `judge` below them in the yaml.
    const gradedResult: ResultRecord = {
      task: result.task,
      run: result.run,
      executor: result.executor,
      variant: result.variant,
      skill_version: result.skill_version,
      created: result.created,
      executor_model: executorRecord.model,
      executor_reasoning_effort: executorRecord.reasoning_effort ?? undefined,
      executor_exit: executorRecord.exit ?? undefined,
      harness_failure: harnessFailure,
      judge: { ...judgeSpec, self_judged: judgeSpec.agent === result.executor },
      expects: verdict.expects,
      pass,
    };

    await writeFile(resultPath, yaml.dump(gradedResult, { lineWidth: -1 }));

    summarize(verdict.expects);

    // After the summary, and never fatal. Workspaces sit outside the repo now, so nothing
    // cleans them up with the run dir and a benchmark leaves tens of gigabytes behind — but
    // the grade is already written, and result.yaml carrying `pass` means the regrade guard
    // will refuse to run this run again. A failed rm (EBUSY, a read-only mount, an open handle)
    // must not be the reason a graded run never reports.
    // `!== undefined` rather than `=== true`: parseArgs takes the next token as the value, so
    // `--keep-workspace true` yields the string "true", and reading that as "delete it" would
    // irreversibly discard the workspace the user asked to keep.
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

    process.exit(pass ? 0 : 2);
  } catch (error) {
    console.error(`verify: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
};

await main();
