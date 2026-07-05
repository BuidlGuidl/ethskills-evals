import { execFileSync, spawnSync } from "node:child_process";
import { constants, existsSync, readFileSync } from "node:fs";
import { access, cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import yaml from "js-yaml";
import type { RunMetadata, TaskSpec, Variant } from "../lib/types.js";

const ROOT = process.cwd();
const VARIANTS = new Set<Variant>(["no_skill", "with_skill"]);

const fail = async (message: string, runDir?: string): Promise<never> => {
  if (runDir) {
    await rm(runDir, { recursive: true, force: true });
  }

  console.error(`setup-workspace: ${message}`);
  process.exit(1);
};

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

const requireNumber = (value: unknown, name: string) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`missing required numeric field: ${name}`);
  }

  return value;
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const loadTaskSpec = (taskPath: string): TaskSpec => {
  const loaded = yaml.load(readFileSync(taskPath, "utf8"));

  if (!isRecord(loaded)) {
    throw new Error("task spec must be a yaml mapping");
  }

  const workspace = loaded.workspace;
  const skillSource = loaded.skill_source;
  const hasRepo = isRecord(workspace) && typeof workspace.repo === "string";
  const hasCommit = isRecord(workspace) && typeof workspace.commit === "string";
  const hasTemplate = isRecord(workspace) && typeof workspace.template === "string";

  if (!isRecord(workspace)) {
    throw new Error("missing required field: workspace");
  }

  if (!((hasRepo && hasCommit && !hasTemplate) || (hasTemplate && !hasRepo && !hasCommit))) {
    throw new Error("workspace must contain exactly one of repo+commit or template");
  }

  if (!isRecord(skillSource)) {
    throw new Error("missing required field: skill_source");
  }

  const spec: TaskSpec = {
    id: requireString(loaded.id, "id"),
    skill: requireString(loaded.skill, "skill"),
    domain: requireString(loaded.domain, "domain"),
    input: requireString(loaded.input, "input"),
    workspace: hasTemplate
      ? { template: workspace.template as string }
      : { repo: workspace.repo as string, commit: workspace.commit as string },
    skill_source: { path: requireString(skillSource.path, "skill_source.path") },
    verifier: requireString(loaded.verifier, "verifier"),
    expect: optionalStringArray(loaded.expect, "expect"),
    runs_per_variant: requireNumber(loaded.runs_per_variant, "runs_per_variant"),
  };

  if (loaded.notes !== undefined) {
    spec.notes = requireString(loaded.notes, "notes");
  }

  return spec;
};

const parseVariant = (value: string): Variant => {
  if (!VARIANTS.has(value as Variant)) {
    throw new Error(`unknown variant: ${value}`);
  }

  return value as Variant;
};

const utcRunTimestamp = (date: Date) =>
  date.toISOString().replace(/\.\d{3}Z$/, "Z").replaceAll(":", "");

const copyDirContents = async (sourceDir: string, targetDir: string) => {
  await access(sourceDir, constants.R_OK);
  await mkdir(targetDir, { recursive: true });
  await cp(sourceDir, targetDir, { recursive: true, force: true });
};

const cloneRepo = async (repo: string, commit: string, workspacePath: string) => {
  const cloneUrl = `https://github.com/${repo}.git`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = spawnSync("git", ["clone", cloneUrl, workspacePath], {
      encoding: "utf8",
      stdio: "pipe",
    });

    if (result.status === 0) {
      const checkout = spawnSync("git", ["-C", workspacePath, "checkout", commit], {
        encoding: "utf8",
        stdio: "pipe",
      });

      if (checkout.status !== 0) {
        throw new Error(`git checkout failed: ${checkout.stderr.trim() || checkout.stdout.trim()}`);
      }

      return;
    }

    await rm(workspacePath, { recursive: true, force: true });

    if (attempt === 2) {
      throw new Error(`git clone failed twice: ${result.stderr.trim() || result.stdout.trim()}`);
    }
  }
};

const resolveRootPath = (value: string) => path.resolve(ROOT, value);

const findGitRoot = (dir: string) => {
  const result = spawnSync("git", ["-C", dir, "rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.status !== 0) {
    return null;
  }

  return result.stdout.trim();
};

const getSkillVersion = (sourceDir: string) => {
  const gitRoot = findGitRoot(sourceDir);

  if (!gitRoot) {
    return "unversioned";
  }

  const sha = execFileSync("git", ["-C", sourceDir, "rev-parse", "--short", "HEAD"], {
    encoding: "utf8",
  }).trim();

  return `git:${sha}`;
};

const installSkill = async (sourceDir: string, skillName: string, workspacePath: string) => {
  const destination = path.join(workspacePath, ".claude", "skills", skillName);

  await mkdir(path.dirname(destination), { recursive: true });
  await cp(sourceDir, destination, { recursive: true, force: true });
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
        pending.push(fullPath);
      } else if (child.isFile()) {
        entries.push(fullPath);
      }
    }
  }

  return entries;
};

const guardAgainstLeaks = async (
  workspacePath: string,
  taskPath: string,
  verifierFile: string,
  runDir: string,
) => {
  const verifierBasename = path.basename(verifierFile);
  const taskSpecBytes = readFileSync(taskPath);
  const workspaceFiles = await walkFiles(workspacePath);

  for (const file of workspaceFiles) {
    const relativePath = path.relative(workspacePath, file);
    const segments = relativePath.split(path.sep);

    if (segments.includes("verifiers")) {
      await fail(`leak detected: workspace contains verifiers/ segment at ${relativePath}`, runDir);
    }

    if (path.basename(file) === verifierBasename) {
      await fail(`leak detected: workspace contains verifier filename ${relativePath}`, runDir);
    }

    const bytes = readFileSync(file);

    if (bytes.length === taskSpecBytes.length && bytes.equals(taskSpecBytes)) {
      await fail(`leak detected: workspace contains a copy of the task spec at ${relativePath}`, runDir);
    }
  }
};

const main = async () => {
  try {
    const args = parseArgs();
    const taskArg = requireString(args.task, "--task");
    const variant = parseVariant(requireString(args.variant, "--variant"));
    const run = requireString(args.run, "--run");
    const skillPathArg = args["skill-path"];
    const forced = args["force-skill"] === true;

    if (variant === "no_skill" && skillPathArg !== undefined) {
      throw new Error("--skill-path is only valid with --variant with_skill");
    }

    if (variant === "no_skill" && forced) {
      throw new Error("--force-skill is only valid with --variant with_skill");
    }

    const taskPath = resolveRootPath(taskArg);
    const spec = loadTaskSpec(taskPath);
    const timestamp = utcRunTimestamp(new Date());
    const runId = `${timestamp}-${variant.replaceAll("_", "-")}-${run}`;
    const runDir = path.join(ROOT, "artifacts", spec.id, runId);
    const workspacePath = path.join(runDir, "workspace");

    if (existsSync(runDir)) {
      await fail(`run dir already exists: ${runDir}`);
    }

    await mkdir(runDir, { recursive: true });

    try {
      if (spec.workspace.template !== undefined) {
        await copyDirContents(resolveRootPath(spec.workspace.template), workspacePath);
      } else {
        await cloneRepo(spec.workspace.repo, spec.workspace.commit, workspacePath);
      }

      await writeFile(path.join(workspacePath, "TASK.md"), spec.input);

      const installedSkillSource =
        variant === "with_skill"
          ? resolveRootPath(typeof skillPathArg === "string" ? skillPathArg : spec.skill_source.path)
          : null;

      if (installedSkillSource) {
        await installSkill(installedSkillSource, spec.skill, workspacePath);
      }

      await guardAgainstLeaks(workspacePath, taskPath, spec.verifier, runDir);

      const skillVersion = installedSkillSource ? getSkillVersion(installedSkillSource) : null;
      const metadata: RunMetadata = {
        task_id: spec.id,
        run_id: runId,
        variant,
        forced,
        created: new Date().toISOString(),
        workspace: path.relative(ROOT, workspacePath),
        skill_version: skillVersion,
        skill_installed: installedSkillSource !== null,
      };

      await writeFile(path.join(runDir, "run.yaml"), yaml.dump(metadata, { lineWidth: -1 }));

      console.log(path.resolve(workspacePath));
      console.log("Spawn a fresh executor in this directory and point it only at TASK.md.");
    } catch (error) {
      await fail(error instanceof Error ? error.message : String(error), runDir);
    }
  } catch (error) {
    console.error(`setup-workspace: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
};

await main();
