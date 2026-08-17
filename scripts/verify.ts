import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { cp, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import yaml from "js-yaml";
import { judgeExpectations } from "../lib/judge.js";
import { isRecord, loadTaskSpec, loadYamlFile, parseArgs, requireString } from "../lib/task.js";
import type { Executor, ExecutorRecord, ExpectStatus, JudgeSpec, ResultRecord, Variant } from "../lib/types.js";
import { GENERATED_DIRS, SKILL_INSTALL_DIRS, WORKSPACE_MANIFEST } from "../lib/workspace.js";

const ROOT = process.cwd();
const SKIP_DIRS = new Set([...SKILL_INSTALL_DIRS, ...GENERATED_DIRS]);
const MAX_SNAPSHOT_FILE_BYTES = 256 * 1024;
const EXECUTORS = new Set<Executor>(["claude", "codex"]);
const VARIANTS = new Set<Variant>(["no_skill", "with_skill"]);
const VERIFY_ARGS = new Set(["run", "judge-agent", "judge-model"]);

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
  };
};

const readBaselineSha = (runDir: string) => {
  const baselinePath = path.join(runDir, "baseline.sha");

  if (!existsSync(baselinePath)) {
    throw new Error(`no baseline.sha in ${runDir}; the workspace was not seeded by yarn setup`);
  }

  return readFileSync(baselinePath, "utf8").trim();
};

const walkFiles = async (dir: string) => {
  const entries: string[] = [];
  const pending = [dir];

  while (pending.length > 0) {
    const current = pending.pop() as string;
    const childNames = await readdir(current, { withFileTypes: true });

    for (const child of childNames) {
      const fullPath = path.join(current, child.name);

      if (child.isDirectory()) {
        if (!SKIP_DIRS.has(child.name)) {
          pending.push(fullPath);
        }
      } else if (child.isFile()) {
        entries.push(fullPath);
      }
    }
  }

  return entries;
};

// A bare :(exclude)<dir> only matches at the workspace root, while walkFiles skips by
// directory name at any depth, so each dir needs the glob form too or a nested
// packages/app/node_modules reaches the judge.
const excludePathspec = (dir: string) => [`:(exclude)${dir}`, `:(exclude,glob)**/${dir}/**`];

const writeDiff = async (workspacePath: string, diffPath: string, baselineSha: string) => {
  const pathspec = [".", ...[...SKILL_INSTALL_DIRS, ...GENERATED_DIRS].flatMap(excludePathspec)];

  // Intent-to-add so new (untracked) files show their content in the diff, not just a
  // filename in status — the judge needs to see files the run created. Untracked files are
  // not gitignored by default, and a repo the run created itself carries whatever .gitignore
  // its scaffolder wrote (foundry's omits node_modules), so the pathspec is what actually
  // keeps the installed skill and generated trees out of the judge's evidence.
  //
  // The add takes a bare "." rather than that pathspec: exclusion magic makes git enumerate
  // ignored entries and exit 1 ("paths are ignored by one of your .gitignore files") the
  // moment an installed node_modules sits at the workspace root, while a bare "." skips
  // ignored trees silently. Evidence is the diff and status output below, and both keep the
  // exclusions, so the extra intent-to-add entries never reach the judge.
  execFileSync("git", ["-C", workspacePath, "add", "-N", "--", "."], { encoding: "utf8" });
  // Against the baseline commit, not the index: an executor that commits its own work
  // leaves a clean worktree, and a plain `git diff` would call that an empty run.
  const diff = execFileSync("git", ["-C", workspacePath, "diff", baselineSha, "--", ...pathspec], { encoding: "utf8" });
  const status = execFileSync("git", ["-C", workspacePath, "status", "--porcelain", "--", ...pathspec], { encoding: "utf8" });
  const content = `${diff}${diff.endsWith("\n") || diff.length === 0 ? "" : "\n"}\n# Untracked files and status\n${status}`;

  await writeFile(diffPath, content);
};

const snapshotOutput = async (workspacePath: string, outputPath: string) => {
  await rm(outputPath, { recursive: true, force: true });

  for (const file of await walkFiles(workspacePath)) {
    const relativePath = path.relative(workspacePath, file);
    const segments = relativePath.split(path.sep);

    if (relativePath === "TASK.md" || segments.some(segment => SKIP_DIRS.has(segment))) {
      continue;
    }

    // The manifest setup drops in to anchor the tooling walk is not something the run
    // produced. Matched by content so a package.json the run wrote still reaches the judge.
    if (relativePath === "package.json" && readFileSync(file, "utf8") === WORKSPACE_MANIFEST) {
      continue;
    }

    // Backstop: a scaffold leaves big generated source too (lockfiles, bundled releases).
    // Grading reads answer/source files; anything this large is not that.
    if ((await stat(file)).size > MAX_SNAPSHOT_FILE_BYTES) {
      continue;
    }

    // Skip binary assets (favicons, fonts, images). The judge reads evidence as text, and a
    // NUL byte breaks the prompt arg; nothing gradeable lives in a binary anyway.
    if (readFileSync(file).includes(0)) {
      continue;
    }

    const target = path.join(outputPath, relativePath);

    await mkdir(path.dirname(target), { recursive: true });
    await cp(file, target);
  }
};

const buildEvidence = async (runDir: string) => {
  const sections: string[] = [];
  const diffPath = path.join(runDir, "run.diff");
  const outputPath = path.join(runDir, "output");

  if (existsSync(diffPath)) {
    sections.push(["# run.diff", readFileSync(diffPath, "utf8")].join("\n"));
  }

  if (existsSync(outputPath)) {
    for (const file of await walkFiles(outputPath)) {
      const relativePath = path.relative(outputPath, file);

      sections.push([`# output/${relativePath}`, readFileSync(file, "utf8")].join("\n"));
    }
  }

  return sections.join("\n\n");
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

    if (executorRecord.exit !== 0) {
      console.warn(`verify: executor exited ${executorRecord.exit ?? "unknown"} — grading what it left behind`);
    }

    const taskSpec = loadTaskSpec(path.join(ROOT, "tasks", `${result.task}.yaml`));
    const workspacePath = path.join(runDir, "workspace");

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
      executor_exit: executorRecord.exit ?? undefined,
      judge: { ...judgeSpec, self_judged: judgeSpec.agent === result.executor },
      expects: verdict.expects,
      pass,
    };

    await writeFile(resultPath, yaml.dump(gradedResult, { lineWidth: -1 }));

    summarize(verdict.expects);
    process.exit(pass ? 0 : 2);
  } catch (error) {
    console.error(`verify: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
};

await main();
