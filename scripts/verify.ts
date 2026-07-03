import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import process from "node:process";
import yaml from "js-yaml";
import type { ResultRecord, RunMetadata, TaskSpec, Verifier, VerifierReport } from "../lib/types.js";

const ROOT = process.cwd();

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

const loadTaskSpec = (taskPath: string): TaskSpec => {
  const loaded = loadYamlFile(taskPath);
  const workspace = loaded.workspace;
  const verifier = loaded.verifier;

  if (!isRecord(workspace)) {
    throw new Error("missing required field: workspace");
  }

  if (!isRecord(verifier)) {
    throw new Error("missing required field: verifier");
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
    variants: Array.isArray(loaded.variants) ? (loaded.variants as string[]) : [],
    verifier: {
      type: requireString(verifier.type, "verifier.type"),
      file: requireString(verifier.file, "verifier.file"),
    },
    success_metric: requireString(loaded.success_metric, "success_metric"),
    runs_per_variant: typeof loaded.runs_per_variant === "number" ? loaded.runs_per_variant : 0,
  };
};

const loadRunMetadata = (runPath: string): RunMetadata => {
  const loaded = loadYamlFile(runPath);

  return {
    task_id: requireString(loaded.task_id, "task_id"),
    run_id: requireString(loaded.run_id, "run_id"),
    variant: requireString(loaded.variant, "variant"),
    created: requireString(loaded.created, "created"),
    workspace: requireString(loaded.workspace, "workspace"),
    skill_version: loaded.skill_version === null ? null : requireString(loaded.skill_version, "skill_version"),
    skill_installed: Boolean(loaded.skill_installed),
    overlay_applied: Boolean(loaded.overlay_applied),
  };
};

const writeDiff = async (workspacePath: string, diffPath: string) => {
  if (!existsSync(path.join(workspacePath, ".git"))) {
    await writeFile(diffPath, "");
    return;
  }

  const diff = execFileSync("git", ["-C", workspacePath, "diff"], { encoding: "utf8" });
  const status = execFileSync("git", ["-C", workspacePath, "status", "--porcelain"], { encoding: "utf8" });
  const content = `${diff}${diff.endsWith("\n") || diff.length === 0 ? "" : "\n"}\n# Untracked files and status\n${status}`;

  await writeFile(diffPath, content);
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

const summarize = (assertions: Record<string, "pass" | "fail">) => {
  const rows = Object.entries(assertions);
  const nameWidth = Math.max("assertion".length, ...rows.map(([name]) => name.length));

  console.log(`${"assertion".padEnd(nameWidth)}  status`);
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

    await writeDiff(workspacePath, diffPath);

    const verifierPath = path.resolve(ROOT, taskSpec.verifier.file);
    const imported = (await import(pathToFileURL(verifierPath).href)) as { default?: Verifier };

    if (typeof imported.default !== "function") {
      throw new Error(`verifier ${taskSpec.verifier.file} must default-export a function`);
    }

    const report = await imported.default(workspacePath);

    validateVerifierReport(report);

    const assertions = report.assertions;
    const assertionValues = Object.values(assertions);
    const pass = assertionValues.every(status => status === "pass");
    const passingCount = assertionValues.filter(status => status === "pass").length;
    const score = report.score ?? passingCount;
    const maxScore = report.maxScore ?? assertionValues.length;
    const result: ResultRecord = {
      task_id: runMetadata.task_id,
      run_id: runMetadata.run_id,
      variant: runMetadata.variant,
      model: null,
      skill_version: runMetadata.skill_version,
      pass,
      score,
      max_score: maxScore,
      assertions,
      metrics: {
        seconds: null,
        input_tokens: null,
        output_tokens: null,
      },
      failure_tags: [],
      artifacts: {
        diff: "run.diff",
        transcript: "transcript.md",
      },
    };

    await writeFile(resultPath, yaml.dump(result, { lineWidth: -1 }));
    summarize(assertions);
    process.exit(pass ? 0 : 2);
  } catch (error) {
    console.error(`verify: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
};

await main();
