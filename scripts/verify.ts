import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import process from "node:process";
import yaml from "js-yaml";
import { judgeExpectations } from "../lib/judge.js";
import type { AssertionStatus, ResultRecord, RunMetadata, TaskSpec, Variant, Verifier, VerifierReport } from "../lib/types.js";

const ROOT = process.cwd();
const VARIANTS = new Set<Variant>(["no_skill", "with_skill"]);

const parseArgs = () => {
  const args = process.argv.slice(2);
  const parsed: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (!arg.startsWith("--")) {
      throw new Error(`unexpected positional argument: ${arg}`);
    }

    const key = arg.slice(2);
    const next = args[i + 1];

    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = next;
    i++;
  }

  return parsed;
};

const requireString = (value: unknown, name: string) => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`missing required field: ${name}`);
  }

  return value;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const loadYamlFile = (filePath: string) => {
  const loaded = yaml.load(readFileSync(filePath, "utf8"));

  if (!isRecord(loaded)) {
    throw new Error(`${filePath} must be a yaml mapping`);
  }

  return loaded;
};

const optionalStringArray = (value: unknown, name: string) => {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || value.some(item => typeof item !== "string")) {
    throw new Error(`${name} must be a string array when present`);
  }

  return value;
};

const loadTaskSpec = (taskPath: string): TaskSpec => {
  const loaded = loadYamlFile(taskPath);
  const workspace = loaded.workspace;
  const skillSource = loaded.skill_source;

  if (!isRecord(workspace)) {
    throw new Error("missing required field: workspace");
  }

  if (!isRecord(skillSource)) {
    throw new Error("missing required field: skill_source");
  }

  const hasTemplate = typeof workspace.template === "string";
  const hasRepoCommit = typeof workspace.repo === "string" && typeof workspace.commit === "string";

  return {
    id: requireString(loaded.id, "id"),
    skill: requireString(loaded.skill, "skill"),
    domain: requireString(loaded.domain, "domain"),
    input: requireString(loaded.input, "input"),
    workspace: hasTemplate
      ? { template: workspace.template as string }
      : {
          repo: hasRepoCommit ? (workspace.repo as string) : requireString(workspace.repo, "workspace.repo"),
          commit: hasRepoCommit ? (workspace.commit as string) : requireString(workspace.commit, "workspace.commit"),
        },
    skill_source: { path: requireString(skillSource.path, "skill_source.path") },
    verifier: requireString(loaded.verifier, "verifier"),
    expect: optionalStringArray(loaded.expect, "expect"),
    runs_per_variant: typeof loaded.runs_per_variant === "number" ? loaded.runs_per_variant : 0,
    notes: loaded.notes === undefined ? undefined : requireString(loaded.notes, "notes"),
  };
};

const parseVariant = (value: string): Variant => {
  if (!VARIANTS.has(value as Variant)) {
    throw new Error(`unknown variant in run.yaml: ${value}`);
  }

  return value as Variant;
};

const loadRunMetadata = (runPath: string): RunMetadata => {
  const loaded = loadYamlFile(runPath);

  return {
    task_id: requireString(loaded.task_id, "task_id"),
    run_id: requireString(loaded.run_id, "run_id"),
    variant: parseVariant(requireString(loaded.variant, "variant")),
    forced: Boolean(loaded.forced),
    created: requireString(loaded.created, "created"),
    workspace: requireString(loaded.workspace, "workspace"),
    skill_version: loaded.skill_version === null ? null : requireString(loaded.skill_version, "skill_version"),
    skill_installed: Boolean(loaded.skill_installed),
  };
};

const writeDiff = async (workspacePath: string, diffPath: string) => {
  if (!existsSync(path.join(workspacePath, ".git"))) {
    await writeFile(diffPath, "");
    return "";
  }

  const diff = execFileSync("git", ["-C", workspacePath, "diff"], { encoding: "utf8" });
  const status = execFileSync("git", ["-C", workspacePath, "status", "--porcelain"], { encoding: "utf8" });
  const content = `${diff}${diff.endsWith("\n") || diff.length === 0 ? "" : "\n"}\n# Untracked files and status\n${status}`;

  await writeFile(diffPath, content);
  return content;
};

const validateVerifierReport = (report: VerifierReport) => {
  if (!isRecord(report) || !isRecord(report.assertions)) {
    throw new Error("verifier must return an assertions mapping");
  }

  for (const [name, status] of Object.entries(report.assertions)) {
    if (status !== "pass" && status !== "fail") {
      throw new Error(`verifier assertion ${name} must be pass or fail`);
    }
  }
};

const summarize = (assertions: Record<string, AssertionStatus>, expects: Record<string, AssertionStatus>) => {
  const rows = [...Object.entries(assertions), ...Object.entries(expects)];
  const nameWidth = Math.max("check".length, ...rows.map(([name]) => name.length));

  console.log(`${"check".padEnd(nameWidth)}  status`);
  console.log(`${"-".repeat(nameWidth)}  ------`);

  for (const [name, status] of rows) {
    console.log(`${name.padEnd(nameWidth)}  ${status}`);
  }
};

const main = async () => {
  try {
    const args = parseArgs();
    const runArg = requireString(args.run, "--run");
    const runDir = path.resolve(ROOT, runArg);
    const resultPath = path.join(runDir, "result.yaml");

    if (existsSync(resultPath) && args.force !== true) {
      throw new Error(`result.yaml already exists at ${resultPath}; pass --force to overwrite`);
    }

    const runMetadata = loadRunMetadata(path.join(runDir, "run.yaml"));
    const taskSpec = loadTaskSpec(path.join(ROOT, "tasks", `${runMetadata.task_id}.yaml`));
    const workspacePath = path.resolve(ROOT, runMetadata.workspace);
    const diffPath = path.join(runDir, "run.diff");
    const diff = await writeDiff(workspacePath, diffPath);

    const verifierPath = path.resolve(ROOT, taskSpec.verifier);
    const imported = (await import(pathToFileURL(verifierPath).href)) as { default?: Verifier };

    if (typeof imported.default !== "function") {
      throw new Error(`verifier ${taskSpec.verifier} must default-export a function`);
    }

    const report = await imported.default(workspacePath);

    validateVerifierReport(report);

    const assertions = report.assertions;
    const expectations = taskSpec.expect ?? [];
    const judge = expectations.length > 0 ? judgeExpectations(taskSpec.input, expectations, diff) : null;
    const expects = judge?.expects ?? {};
    const assertionValues = Object.values(assertions);
    const expectValues = Object.values(expects);
    const passingAssertions = assertionValues.filter(status => status === "pass").length;
    const passingExpects = expectValues.filter(status => status === "pass").length;
    const score = (report.score ?? passingAssertions) + passingExpects;
    const maxScore = (report.maxScore ?? assertionValues.length) + expectations.length;
    const outcome =
      judge?.ok === false
        ? "judge_error"
        : [...assertionValues, ...expectValues].every(status => status === "pass")
          ? "pass"
          : "task_fail";
    const result: ResultRecord = {
      task_id: runMetadata.task_id,
      run_id: runMetadata.run_id,
      variant: runMetadata.variant,
      forced: runMetadata.forced,
      model: null,
      skill_version: runMetadata.skill_version,
      outcome,
      score,
      max_score: maxScore,
      assertions,
      expects,
      metrics: {
        seconds: null,
        input_tokens: null,
        output_tokens: null,
      },
      failure_tags: judge?.ok === false ? [`judge_error:${judge.error}`] : [],
      artifacts: {
        diff: "run.diff",
        transcript: "transcript.md",
      },
    };

    await writeFile(resultPath, yaml.dump(result, { lineWidth: -1 }));
    summarize(assertions, expects);
    process.exit(outcome === "pass" ? 0 : 2);
  } catch (error) {
    console.error(`verify: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
};

await main();
