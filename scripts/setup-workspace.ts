import { execFileSync, spawnSync } from "node:child_process";
import { constants, existsSync, readFileSync, rmSync } from "node:fs";
import { access, cp, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import yaml from "js-yaml";
import { SKILL_VERSION_LENGTH, readSkillContentId } from "../lib/skill.js";
import { inputSha, loadTaskSpec, optionalArg, parseArgs, parseBenchmark, requireString } from "../lib/task.js";
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

  return execFileSync("git", ["-C", sourceDir, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim().slice(0, SKILL_VERSION_LENGTH);
};

// --skill-ref installs the skill as it stood at a commit rather than as the checkout has it,
// which is how a benchmark measures an old text beside the new one on the same task set and
// harness. Only what git holds for the skill dir is installed, so an uncommitted edit to it
// cannot ride into an arm that claims to be a commit. skill_version is that commit, which is
// what build-index already reads the text back from.
//
// The ref is looked up in the repo the skill dir sits in, which is the repo getSkillVersion
// reads HEAD from — not assumed to be the harness's, so a skill in a nested or sibling repo gets
// one meaning of skill_version on both paths. The walk up is for a skill the checkout no longer
// has but an old commit does.
const locateSkill = (skillSource: string) => {
  let existing = skillSource;

  while (!existsSync(existing)) {
    existing = path.dirname(existing);
  }

  // Both values from one call, so the path inside the repo is git's own answer rather than a
  // relative() over two realpaths: --show-prefix is where `existing` sits in the repo, already
  // resolved for symlinks the way --show-toplevel is.
  const located = spawnSync("git", ["-C", existing, "rev-parse", "--show-toplevel", "--show-prefix"], {
    encoding: "utf8",
    stdio: "pipe",
  });

  // Before the status: a git that never spawned (ENOENT, EACCES) reports status null, and
  // "is in no git repo" would be the wrong reason.
  if (located.error) {
    throw located.error;
  }

  if (located.status !== 0) {
    throw new Error(`--skill-ref needs the skill in a git repo, and ${skillSource} is in none`);
  }

  const [gitRoot, prefix] = located.stdout.split("\n");
  const missing = path.relative(existing, skillSource).split(path.sep).join("/");

  return { gitRoot, skillPath: `${prefix}${missing}`.replace(/\/$/, "") };
};

const resolveSkillRef = (ref: string, skillSource: string) => {
  const { gitRoot, skillPath } = locateSkill(skillSource);
  // No --quiet: a short ref that matches two commits fails here too, and git's candidates list is
  // the only thing that tells it from a ref that matches none.
  const resolved = spawnSync("git", ["-C", gitRoot, "rev-parse", "--verify", `${ref}^{commit}`], {
    encoding: "utf8",
    stdio: "pipe",
  });

  // Before stderr is read: a git that never spawned (ENOENT, EACCES) has none, and the null
  // deref would replace the real reason with a TypeError.
  if (resolved.error) {
    throw resolved.error;
  }

  if (resolved.status !== 0) {
    // stderr is git's candidate list on an ambiguous ref, and the only thing that tells it from
    // a ref that matches nothing.
    throw new Error(`--skill-ref ${ref} does not name one commit in ${gitRoot}\n${resolved.stderr.trim()}`);
  }

  // From here on git is handed the full sha, which a short one could be ambiguous against.
  const full = resolved.stdout.trim();
  const short = full.slice(0, SKILL_VERSION_LENGTH);
  const present = spawnSync("git", ["-C", gitRoot, "cat-file", "-e", `${full}:${skillPath}/SKILL.md`], { stdio: "pipe" });

  if (present.status !== 0) {
    throw new Error(`--skill-ref ${ref}: ${skillPath}/SKILL.md does not exist at ${short} in ${gitRoot}`);
  }

  return { full, short, gitRoot, skillPath };
};

type SkillRef = ReturnType<typeof resolveSkillRef>;

// `git show <sha>:<file>` per file, not `git archive`: archive applies the `export-ignore` and
// `export-subst` attributes of the ref, while build-index recovers a run's text with `git show`
// and the restamp rule in AGENTS.md compares blobs. Either attribute on a skill file would
// install text whose hash no reader of the record can reproduce, and the site would key two
// versions for one commit. These are the bytes the record means.
const extractSkillAt = async ({ full, gitRoot, skillPath }: SkillRef) => {
  const listed = execFileSync("git", ["-C", gitRoot, "ls-tree", "-r", "-z", full, "--", skillPath], { encoding: "utf8" });
  const dir = await mkdtemp(path.join(tmpdir(), "skill-eval-ref-"));

  try {
    for (const entry of listed.split("\0").filter(line => line !== "")) {
      // `<mode> <type> <sha>\t<path>`, the path NUL-terminated by -z so a space in it is safe.
      const [meta, file] = entry.split("\t");
      const [mode] = meta.split(" ");

      // A symlink (120000) or a submodule (160000) in a skill dir is not something the install
      // can reproduce as a file, and silently dropping it would install a different skill.
      if (mode !== "100644" && mode !== "100755") {
        throw new Error(`--skill-ref: ${file} at ${full} is mode ${mode}, which a skill install cannot carry`);
      }

      const target = path.join(dir, file);

      await mkdir(path.dirname(target), { recursive: true });
      // Buffer, never a string: an encoding would rewrite the bytes the content id is taken over.
      await writeFile(target, execFileSync("git", ["-C", gitRoot, "show", `${full}:${file}`, "--"], { maxBuffer: 64 * 1024 * 1024 }), { mode: mode === "100755" ? 0o755 : 0o644 });
    }
  } catch (error) {
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
    const skillRef = optionalArg(args, "skill-ref");
    const taskPath = resolveRootPath(taskArg);
    const spec = loadTaskSpec(taskPath);

    // A no_skill run installs nothing, so a ref on one would be recorded nowhere and mean nothing;
    // refusing it catches the arm that was pasted onto the wrong variant.
    if (skillRef !== null && variant !== "with_skill") {
      await fail("--skill-ref only applies to --variant with_skill");
    }

    // Both before anything is written, so a mistyped ref or an unreadable tree costs no run dir.
    const skillSha = skillRef === null ? null : resolveSkillRef(skillRef, resolveRootPath(spec.skill));
    const extracted = skillSha === null ? null : await extractSkillAt(skillSha);

    // fail() and a thrown error both end in process.exit, which no finally survives, and the copy
    // is wanted until the install two dozen lines below. One hook covers every way out.
    if (extracted !== null) {
      process.on("exit", () => rmSync(extracted.dir, { recursive: true, force: true }));
    }

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
    const slug = variant.replaceAll("_", "-");
    const arm = skillSha === null ? slug : `${slug}-${skillSha.short}`;
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

    try {
      if (spec.template !== undefined) {
        await copyTree(resolveRootPath(spec.template), workspacePath);
      } else {
        await mkdir(workspacePath, { recursive: true });
      }

      await writeFile(path.join(workspacePath, "TASK.md"), spec.input);

      let skillSource: string | null = null;
      let skillVersion: string | null = null;

      // A ref implies with_skill: it was refused on any other variant above.
      if (skillSha !== null && extracted !== null) {
        skillSource = extracted.skillDir;
        skillVersion = skillSha.short;
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
      await fail(error instanceof Error ? error.message : String(error), runDir, workspacePath);
    }
  } catch (error) {
    console.error(`setup-workspace: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
};

await main();
