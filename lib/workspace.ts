import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, constants, existsSync, mkdirSync, readFileSync } from "node:fs";
import { access, chmod, cp, mkdir, readdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

// Where setup installs the skill. Evidence that reaches the judge must exclude these, or the
// judge reads the skill itself and learns which variant produced the run. Both evidence paths
// (snapshot and diff) derive their exclusions from this list, so adding an executor's bridge
// dir here covers both; a dir listed in one path and missed in the other silently corrupts a
// benchmark, which is how the skill first leaked into run.diff.
export const SKILL_INSTALL_DIRS = [".agents", ".claude"];

// Generated/vendored dirs a scaffolded repo (e.g. create-eth) leaves behind. Evidence
// captures source the run produced, not gigabytes of node_modules or build output. Missing
// one of these does not mislead the judge the way a missed SKILL_INSTALL_DIRS entry does,
// but it is not free either: the diff path has no size cap of its own, so a run that
// installs dependencies can push the evidence past the judge's input limit and lose the run.
export const GENERATED_DIRS = [
  "node_modules", "lib", ".git", ".next", ".yarn", "dist", "build",
  "out", "cache", "broadcast", "coverage", ".turbo", ".husky", ".vscode",
  "target",
];

// Workspaces live outside this repo. The markers below stop the tools that own them, but
// nothing stops an executor from reading its way up the filesystem: under artifacts/ the
// run dir's siblings are other runs of the same task, holding their answer.md, run.diff and
// result.yaml, and tasks/ with every expect line is two directories further up. Somewhere
// with nothing above it worth finding closes that; ~/.cache is the default, override for a
// different disk.
export const workspaceRoot = () =>
  process.env.EVAL_WORKSPACE_ROOT ?? path.join(homedir(), ".cache", "ethskills-evals");

// The run dir stays in the repo and points at the workspace, so verify and run-executor find
// it without recomputing the layout, and a machine-local path is still recorded.
export const WORKSPACE_POINTER = "workspace.path";

export const readWorkspacePath = (runDir: string) => {
  const pointerPath = path.join(runDir, WORKSPACE_POINTER);

  if (!existsSync(pointerPath)) {
    throw new Error(`no ${WORKSPACE_POINTER} in ${runDir}; the run was not set up by yarn setup`);
  }

  const workspacePath = readFileSync(pointerPath, "utf8").trim();

  if (!existsSync(workspacePath)) {
    throw new Error(`workspace ${workspacePath} is gone (deleted after grading?)`);
  }

  return workspacePath;
};

// npm and friends resolve their project root by walking up for a package.json, and a git
// boundary does not stop that walk: in a bare workspace under artifacts/ the nearest manifest
// is this repo's own, so `npm install` inside a run rewrites the framework's package.json
// (seen in the standards eval). A manifest of its own stops the walk at the workspace. It
// lands in the baseline commit, so it never shows up in a run's diff.
export const WORKSPACE_MANIFEST = `${JSON.stringify({ name: "eval-workspace", private: true }, null, 2)}\n`;

// A template with its dependencies installed runs to gigabytes, and every run gets a copy.
// The system cp can clone instead: copy-on-write shares the data blocks, so a workspace only
// pays for what the executor changes. Measured on se-2-foundry with node_modules installed,
// 1.9 GB across 237k files: 48s and 830 MB per workspace, against 91s and the full 1.9 GB
// for fs.cp. The clone is not free — every file still needs its own inode and directory
// entry, and at this file count that metadata is most of the 830 MB. Node's own
// COPYFILE_FICLONE is no help at all (3.5 GB copied, 3.5 GB of disk gone), hence shelling out.
//
// The two flags disagree about a filesystem that cannot clone: macOS -c fails, and lands on
// the portable path below. --reflink=auto never fails — it silently degrades to a plain copy,
// so an ext4 host (most CI runners) gets the speed but pays the full 1.9 GB. Making that
// visible would mean --reflink=always, which instead drops those hosts onto fs.cp, the
// slowest of the three, so the degraded copy is the deliberate trade.
const cloneArgs = (sourceDir: string, targetDir: string) =>
  process.platform === "darwin"
    ? ["-Rc", `${sourceDir}/.`, targetDir]
    : ["-a", "--reflink=auto", `${sourceDir}/.`, targetDir];

// How a copied tree gets deleted, by either path. fs.rm unlinks a file through its parent
// directory, so it needs write permission there, and a copy carries the template's read-only
// dirs verbatim (.git/objects/xx, unplugged Yarn packages) — a plain rm EACCESes on exactly
// the dirs the copy reproduced, whether it is the fallback clearing a partial tree or a
// caller tearing down a workspace it can no longer use.
export const removeTree = async (dir: string) => {
  await chmod(dir, 0o700);

  for (const entry of await readdir(dir, { recursive: true, withFileTypes: true })) {
    if (entry.isDirectory()) {
      await chmod(path.join(entry.parentPath, entry.name), 0o700);
    }
  }

  await rm(dir, { recursive: true, force: true });
};

// Owns targetDir: the fallback empties it first, so pass a destination this copy may define.
export const copyTree = async (sourceDir: string, targetDir: string) => {
  await access(sourceDir, constants.R_OK);
  await mkdir(targetDir, { recursive: true });

  const clone = spawnSync("cp", cloneArgs(sourceDir, targetDir), {
    encoding: "utf8",
    stdio: ["ignore", "ignore", "pipe"],
  });

  if (clone.status === 0) {
    return;
  }

  // A signal is not a failure to retry. Ctrl-C reaches the whole foreground process group, so
  // cp dies while node stays up to handle it: falling back here answers the interrupt by
  // starting the slower copy from scratch, and the run takes longer than if nothing was hit.
  if (clone.signal !== null) {
    throw new Error(`cp was killed by ${clone.signal}`);
  }

  // Say which copy failed and why. A host without cp, or a BSD cp that rejects --reflink=auto
  // (every non-darwin non-Linux platform takes that branch), would otherwise sit on the slow
  // path forever with nothing in the output to explain it — and if fs.cp then fails too, its
  // error is the only one that reaches the caller.
  const reason = clone.error?.message || clone.stderr?.trim() || `exit ${clone.status}`;

  console.warn(`workspace: cp could not clone ${sourceDir} (${reason}) — falling back to a full copy`);

  // cp leaves a partial tree behind when it fails, and fs.cp does not merge into one safely:
  // force unlinks before overwriting, and cp -a finalizes directory modes from the source, so
  // a read-only dir already laid down hard-fails the merge. Start from an empty destination.
  await removeTree(targetDir);
  await mkdir(targetDir, { recursive: true });

  // verbatimSymlinks, or fs.cp resolves each relative link target against the source and
  // writes it back absolute: every node_modules/.bin entry would then point into the shared
  // template, which is the isolation this copy exists to give the run.
  await cp(sourceDir, targetDir, { recursive: true, force: true, verbatimSymlinks: true });
};

const git = (workspacePath: string, args: string[]) =>
  execFileSync("git", ["-C", workspacePath, ...args], { encoding: "utf8" }).trim();

// An executor runs git — it is finishing a feature, so it commits. Without a repo of its
// own the workspace is just a directory inside this one, gitignored, and git walks up out
// of it to find our .git: `git add -A` from the workspace stages the orchestrator's tracked
// files, `git commit -am` lands them on whatever branch is checked out here, `git add .`
// exits 1 and hands the executor the `-f` hint that forces the workspace into our index,
// and two runs in flight fight over one index.lock. A repo per workspace stops the walk at
// the workspace root. The baseline commit it returns is what verify diffs the run against,
// so evidence survives an executor that commits its own work.
export const seedWorkspaceRepo = (workspacePath: string) => {
  if (!existsSync(path.join(workspacePath, ".git"))) {
    git(workspacePath, ["init", "-q", "-b", "main"]);
  }

  // Identity is set on the workspace repo itself: an executor that commits must not fail
  // for want of a global git config, and its commits must not read as the human's.
  git(workspacePath, ["config", "user.name", "eval executor"]);
  git(workspacePath, ["config", "user.email", "executor@localhost"]);

  // .git/info/exclude, not .gitignore: dependencies installed into the template stay out
  // of the baseline without editing a file the executor reads and the judge sees in the
  // diff. Excluded here means excluded from the executor's commits too, so a run that
  // installs node_modules cannot bury the evidence — and equally, these dirs disappear from
  // the executor's own `git status`, so a task whose deliverable lands in lib/, out/,
  // build/, cache/ or target/ needs that entry dropped from GENERATED_DIRS first.
  const excludePath = path.join(git(workspacePath, ["rev-parse", "--absolute-git-dir"]), "info", "exclude");

  mkdirSync(path.dirname(excludePath), { recursive: true });
  appendFileSync(excludePath, `\n${GENERATED_DIRS.map(dir => `/${dir}/\n**/${dir}/`).join("\n")}\n`);

  git(workspacePath, ["add", "-A"]);
  git(workspacePath, ["commit", "-q", "--allow-empty", "-m", "eval baseline"]);

  return git(workspacePath, ["rev-parse", "HEAD"]);
};
