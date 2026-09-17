import { execFileSync, spawnSync } from "node:child_process";
import { constants, existsSync, readFileSync } from "node:fs";
import { access, cp, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import yaml from "js-yaml";
import { readSkillContentId } from "../lib/skill.js";
import { inputSha, loadTaskSpec, parseArgs, parseBenchmark, requireString } from "../lib/task.js";
import { EXECUTORS, type Executor, type ResultRecord, type Variant } from "../lib/types.js";
import { WORKSPACE_MANIFEST, WORKSPACE_POINTER, copyTree, pruneEmptyParent, removeTree, seedWorkspaceRepo, workspaceRoot, SKILL_BRIDGE_DIRS } from "../lib/workspace.js";

const ROOT = process.cwd();
const VARIANTS = new Set<Variant>(["no_skill", "with_skill"]);
const SETUP_ARGS = new Set(["task", "executor", "variant", "run", "benchmark", "skill-ref"]);

const fail = async (message: string, ...dirs: (string | undefined)[]): Promise<never> => {
  for (const dir of dirs) {
    // removeTree, not rm: one of these holds a copy of the template, and a plain unlink through
    // a read-only dir it reproduced throws past this line — replacing `message` with an EACCES
    // and leaving the dir behind for the next run of the same id to trip over.
    if (dir && existsSync(dir)) {
      await removeTree(dir);
      pruneEmptyParent(dir);
    }
  }

  console.error(`setup-workspace: ${message}`);
  process.exit(1);
};

const parseExecutor = (value: string): Executor => {
  if (!EXECUTORS.includes(value as Executor)) {
    throw new Error(`unknown executor: ${value} (expected ${EXECUTORS.join(", ")})`);
  }

  return value as Executor;
};

const parseVariant = (value: string): Variant => {
  if (!VARIANTS.has(value as Variant)) {
    throw new Error(`unknown variant: ${value}`);
  }

  return value as Variant;
};

const utcRunTimestamp = (date: Date) =>
  date.toISOString().replace(/\.\d{3}Z$/, "Z").replaceAll(":", "");

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

  return execFileSync("git", ["-C", sourceDir, "rev-parse", "--short", "HEAD"], {
    encoding: "utf8",
  }).trim();
};

// --skill-ref installs the skill as it stood at a commit rather than as the checkout has it,
// which is how a benchmark measures an old text beside the new one on the same task set and
// harness. Only what git holds for the skill dir is installed, so an uncommitted edit to it
// cannot ride into an arm that claims to be a commit. skill_version is that commit, which is
// what build-index already reads the text back from. The length is fixed, not git's `--short`:
// that grows with the clone's object count, so one commit would record as two versions across
// operators and a `run-stats --skill-version` filter would silently drop the longer one.
const SKILL_REF_LENGTH = 8;

const resolveSkillRef = (ref: string, skillPath: string) => {
  const resolved = spawnSync("git", ["-C", ROOT, "rev-parse", "--verify", "--quiet", `--short=${SKILL_REF_LENGTH}`, `${ref}^{commit}`], {
    encoding: "utf8",
    stdio: "pipe",
  });

  if (resolved.status !== 0) {
    throw new Error(`--skill-ref ${ref} is not a commit in this repo`);
  }

  const sha = resolved.stdout.trim();
  const present = spawnSync("git", ["-C", ROOT, "cat-file", "-e", `${sha}:${skillPath}/SKILL.md`], { stdio: "pipe" });

  if (present.status !== 0) {
    throw new Error(`--skill-ref ${ref}: ${skillPath}/SKILL.md does not exist at ${sha}`);
  }

  return sha;
};

const extractSkillAt = async (sha: string, skillPath: string) => {
  const dir = await mkdtemp(path.join(tmpdir(), "skill-eval-ref-"));

  try {
    const archive = execFileSync("git", ["-C", ROOT, "archive", "--format=tar", sha, skillPath], { maxBuffer: 64 * 1024 * 1024 });

    execFileSync("tar", ["-x", "-C", dir], { input: archive });
  } catch (error) {
    // The caller only learns the dir once this returns, so a failed extraction cleans up here.
    await rm(dir, { recursive: true, force: true });
    throw error;
  }

  return { dir, skillDir: path.join(dir, skillPath) };
};

const copySkill = async (sourceDir: string, destination: string) => {
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(sourceDir, destination, { recursive: true, force: true });
};

const installSkill = async (sourceDir: string, skillName: string, executor: Executor, workspacePath: string) => {
  const agentsDestination = path.join(workspacePath, ".agents", "skills", skillName);

  await access(sourceDir, constants.R_OK);
  await copySkill(sourceDir, agentsDestination);

  for (const bridge of SKILL_BRIDGE_DIRS[executor]) {
    await copySkill(sourceDir, path.join(workspacePath, bridge, "skills", skillName));
  }
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

// The task yaml carries the expect lines, i.e. the grading. It must never
// reach the executor's workspace in any form.
const guardAgainstLeaks = async (workspacePath: string, taskPath: string, runDir: string) => {
  const taskSpecBytes = readFileSync(taskPath);

  for (const file of await walkFiles(workspacePath)) {
    const bytes = readFileSync(file);

    if (bytes.length === taskSpecBytes.length && bytes.equals(taskSpecBytes)) {
      const relativePath = path.relative(workspacePath, file);

      // The workspace goes too, not just the run dir: it holds the leaked spec, and it sits
      // where the next run of this task would be created.
      await fail(`leak detected: workspace contains a copy of the task spec at ${relativePath}`, runDir, workspacePath);
    }
  }
};

const main = async () => {
  try {
    const args = parseArgs(SETUP_ARGS);
    const taskArg = requireString(args.task, "--task");
    const executor = parseExecutor(requireString(args.executor, "--executor"));
    const variant = parseVariant(requireString(args.variant, "--variant"));
    const run = requireString(args.run, "--run");
    // Required, not defaulted: a run with no benchmark id is what the site cannot tell from the
    // runs that came before, and the orchestrator that forgot the flag is the one that would
    // have to be asked afterwards which benchmark it meant.
    const benchmark = parseBenchmark(requireString(args.benchmark, "--benchmark"));
    const skillRef = args["skill-ref"] === undefined ? null : requireString(args["skill-ref"], "--skill-ref");
    const taskPath = resolveRootPath(taskArg);
    const spec = loadTaskSpec(taskPath);

    // A no_skill run installs nothing, so a ref on one would be recorded nowhere and mean nothing;
    // refusing it catches the arm that was pasted onto the wrong variant.
    if (skillRef !== null && variant !== "with_skill") {
      await fail("--skill-ref only applies to --variant with_skill");
    }

    // Before anything is written, so a mistyped ref costs no run dir.
    const skillPath = path.relative(ROOT, resolveRootPath(spec.skill)).split(path.sep).join("/");
    const skillSha = skillRef === null ? null : resolveSkillRef(skillRef, skillPath);

    // A retired spec's notes say why it was retired, and its stored grades were produced under
    // wording it no longer carries. Building a workspace for one would draw a fresh sample that
    // cannot be tabled beside those grades, so refuse before anything is written.
    if (spec.status === "retired") {
      await fail(`task is retired: ${spec.id} — see its notes; retired tasks keep their artifacts but are not run again`);
    }

    const timestamp = utcRunTimestamp(new Date());
    // A --skill-ref arm carries its ref: an old and a new arm are the same variant, and without it
    // run 1 of each, set up in the same second, would share a run dir and a workspace — and two
    // tasks' runs sharing a parent (below) could put one skill text next door to the other.
    const arm = skillSha === null ? variant.replaceAll("_", "-") : `${variant.replaceAll("_", "-")}-${skillSha}`;
    const runId = `${timestamp}-${executor}-${arm}-${run}`;
    const runDir = path.join(ROOT, "artifacts", spec.id, runId);
    // Run id above task id, not below: workspaces now outlive setup, and grouping them by task
    // would put a live no_skill run one `ls ../` away from a concurrent with_skill sibling —
    // its .agents/skills/<skill>/SKILL.md is the skill under test. This way that reach costs a
    // second `..`. The run id carries no task, so two different tasks set up in the same second
    // by the same executor, arm and run number do share a parent — same arm, so what is next door
    // is another task's TASK.md, not another text of the skill under test.
    const workspacePath = path.join(workspaceRoot(), runId, spec.id);

    if (existsSync(runDir)) {
      await fail(`run dir already exists: ${runDir}`);
    }

    if (existsSync(workspacePath)) {
      await fail(`workspace already exists: ${workspacePath}`);
    }

    await mkdir(runDir, { recursive: true });

    let extracted: string | null = null;

    try {
      if (spec.template !== undefined) {
        await copyTree(resolveRootPath(spec.template), workspacePath);
      } else {
        await mkdir(workspacePath, { recursive: true });
      }

      await writeFile(path.join(workspacePath, "TASK.md"), spec.input);

      let skillSource: string | null = null;
      let skillVersion: string | null = null;

      if (variant === "with_skill" && skillSha !== null) {
        const at = await extractSkillAt(skillSha, skillPath);

        extracted = at.dir;
        skillSource = at.skillDir;
        skillVersion = skillSha;
      } else if (variant === "with_skill") {
        skillSource = resolveRootPath(spec.skill);
        skillVersion = getSkillVersion(skillSource);
      }

      // Recorded here because it stops being recoverable later: skill_version is a sha that
      // may live only on a branch, and a deleted branch takes the text with it.
      const skillContent = skillSource ? readSkillContentId(skillSource) : null;

      if (skillSource) {
        await installSkill(skillSource, path.basename(skillSource), executor, workspacePath);
      }

      if (extracted !== null) {
        await rm(extracted, { recursive: true, force: true });
        extracted = null;
      }

      if (!existsSync(path.join(workspacePath, "package.json"))) {
        await writeFile(path.join(workspacePath, "package.json"), WORKSPACE_MANIFEST);
      }

      // Before the repo is seeded: the leak walk reads every file it finds, and a .git
      // dir would have it hashing loose objects for nothing.
      await guardAgainstLeaks(workspacePath, taskPath, runDir);

      // Both live in the run dir rather than only in the workspace: the workspace is deleted
      // after grading, the record is not.
      await writeFile(path.join(runDir, WORKSPACE_POINTER), `${workspacePath}\n`);
      await writeFile(path.join(runDir, "baseline.sha"), `${seedWorkspaceRepo(workspacePath)}\n`);

      const result: ResultRecord = {
        task: spec.id,
        run: runId,
        executor,
        variant,
        skill_version: skillVersion,
        input_sha: inputSha(spec.input),
        skill_content: skillContent,
        benchmark,
        created: new Date().toISOString(),
      };

      await writeFile(path.join(runDir, "result.yaml"), yaml.dump(result, { lineWidth: -1 }));

      console.log(workspacePath);
      console.log(`Run the executor with: yarn run-executor --run artifacts/${spec.id}/${runId} --model <model> --effort <effort>`);
    } catch (error) {
      // fail exits, so the extracted copy goes first rather than in a finally that never runs.
      if (extracted !== null) {
        await rm(extracted, { recursive: true, force: true });
      }

      await fail(error instanceof Error ? error.message : String(error), runDir, workspacePath);
    }
  } catch (error) {
    console.error(`setup-workspace: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
};

await main();
