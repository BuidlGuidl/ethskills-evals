import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { cp, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import yaml from "js-yaml";
import { judgeExpectations } from "../lib/judge.js";
import { isRecord, loadTaskSpec, loadYamlFile, parseArgs, requireString } from "../lib/task.js";
import type { Executor, ExpectStatus, JudgeSpec, ResultRecord, Variant } from "../lib/types.js";

const ROOT = process.cwd();
// Where setup installs the skill. Evidence that reaches the judge must exclude these, or the
// judge reads the skill itself and learns which variant produced the run. Both evidence paths
// (snapshot and diff) derive their exclusions from this list, so adding an executor's bridge
// dir here covers both; a dir listed in one path and missed in the other silently corrupts a
// benchmark, which is how the skill first leaked into run.diff.
const SKILL_INSTALL_DIRS = [".agents", ".claude"];
// Generated/vendored dirs a scaffolded repo (e.g. create-eth) leaves behind. Evidence
// captures source the run produced, not gigabytes of node_modules or build output. Missing
// one of these does not mislead the judge the way a missed SKILL_INSTALL_DIRS entry does,
// but it is not free either: the diff path has no size cap of its own, so a run that
// installs dependencies can push the evidence past the judge's input limit and lose the run.
const GENERATED_DIRS = [
  "node_modules", "lib", ".git", ".next", ".yarn", "dist", "build",
  "out", "cache", "broadcast", "coverage", ".turbo", ".husky", ".vscode",
  "target",
];
const SKIP_DIRS = new Set([...SKILL_INSTALL_DIRS, ...GENERATED_DIRS]);
const MAX_SNAPSHOT_FILE_BYTES = 256 * 1024;
const EXECUTORS = new Set<Executor>(["claude", "codex"]);
const VARIANTS = new Set<Variant>(["no_skill", "with_skill"]);
const VERIFY_ARGS = new Set(["run", "judge-agent", "judge-model", "allow-skill-mention"]);
// Excluding SKILL_INSTALL_DIRS from the evidence paths keeps the skill FILES out, but it
// cannot keep the skill out of files the executor WROTE. A with_skill run that cites its
// source in answer.md — "per .claude/skills/standards/SKILL.md" — hands the judge the
// variant just as surely as a leaked directory would, and that is not hypothetical: 4 of 9
// with_skill runs across the standards quizzes did it in #35, one printing the install path
// verbatim. Task preambles were reworded per-task afterwards, which fixes the tasks edited
// and nothing else. This list is the harness-level check, so the invariant this file's
// header claims to own is actually enforced for every task, present and future.
const SKILL_MENTION_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: "skill install path", pattern: /\.(?:claude|agents)[\/\\]skills\b/i },
  { label: "SKILL.md reference", pattern: /\bSKILL\.md\b/i },
  { label: "skill self-reference", pattern: /\b(?:the|my|this|provided|installed|attached)\s+skill\b/i },
];

// The judge is a fresh, blind process, never the orchestrator's own contaminated
// context. Point it at the model you want doing the grading: pass --judge-agent
// and --judge-model to grade with the orchestrator's model. With neither, it falls
// back to the agent that performed the run, and the record marks that self_judged.
const resolveJudge = (args: Record<string, string | boolean>, executor: Executor): JudgeSpec => {
  const agent = args["judge-agent"] === undefined ? executor : parseAgent(requireString(args["judge-agent"], "--judge-agent"));
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

const writeDiff = async (workspacePath: string, diffPath: string) => {
  const pathspec = [".", ...[...SKILL_INSTALL_DIRS, ...GENERATED_DIRS].flatMap(excludePathspec)];

  // Intent-to-add so new (untracked) files show their content in the diff, not just a
  // filename in status — the judge needs to see files the run created. Untracked files are
  // not gitignored by default, and a repo the run created itself carries whatever .gitignore
  // its scaffolder wrote (foundry's omits node_modules), so the pathspec is what actually
  // keeps the installed skill and generated trees out of the judge's evidence.
  execFileSync("git", ["-C", workspacePath, "add", "-N", "--", ...pathspec], { encoding: "utf8" });
  const diff = execFileSync("git", ["-C", workspacePath, "diff", "--", ...pathspec], { encoding: "utf8" });
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

// Reported as file:line so the operator can read the hit and judge it, rather than being told
// only that something matched. Scans the assembled evidence because that is exactly the string
// the judge receives — checking the source files instead would miss whatever the diff header
// carries.
const findSkillMentions = (evidence: string) => {
  const hits: string[] = [];
  let section = "evidence";

  evidence.split("\n").forEach((line, index) => {
    if (line.startsWith("# run.diff") || line.startsWith("# output/")) {
      section = line.slice(2);
    }

    for (const { label, pattern } of SKILL_MENTION_PATTERNS) {
      if (pattern.test(line)) {
        hits.push(`  ${section}:${index + 1}  [${label}]  ${line.trim().slice(0, 160)}`);
        return;
      }
    }
  });

  return hits;
};

// Aborts BEFORE the judge call rather than after: the executor run is already paid for and is
// not lost, only its grading is deferred, so stopping here costs one cheap re-invocation while
// grading on leaked evidence costs the comparison the whole repo exists to make. A mention is
// not always a leak — a no_skill run can say "the skill" about something else, and a task may
// legitimately be about skills — so this is a stop-and-look, cleared with --allow-skill-mention
// once the operator has read the hits and recorded the call in the run's report.
const guardJudgeBlindness = (evidence: string, allowSkillMention: boolean) => {
  const hits = findSkillMentions(evidence);

  if (hits.length === 0) {
    return;
  }

  if (allowSkillMention) {
    console.warn(`verify: ${hits.length} skill mention(s) in evidence, graded anyway per --allow-skill-mention:`);
    console.warn(hits.join("\n"));
    return;
  }

  throw new Error(
    [
      `judge blindness: evidence contains ${hits.length} skill mention(s), so the judge would learn the variant.`,
      ...hits,
      "",
      "Read the hits. If a run genuinely leaked its variant, that run's grading is not comparable —",
      "record it as a run incident rather than grading it. If the matches are incidental, re-run with",
      "--allow-skill-mention to grade anyway; note the decision in the report either way.",
    ].join("\n"),
  );
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
    const taskSpec = loadTaskSpec(path.join(ROOT, "tasks", `${result.task}.yaml`));
    const workspacePath = path.join(runDir, "workspace");

    if (existsSync(path.join(workspacePath, ".git"))) {
      await writeDiff(workspacePath, path.join(runDir, "run.diff"));
    } else {
      await snapshotOutput(workspacePath, path.join(runDir, "output"));
    }

    const judgeSpec = resolveJudge(args, result.executor);
    const evidence = await buildEvidence(runDir);

    guardJudgeBlindness(evidence, args["allow-skill-mention"] === true);

    const verdict = judgeExpectations(taskSpec.input, taskSpec.expect, evidence, judgeSpec);

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
