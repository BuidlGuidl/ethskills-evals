import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, constants, existsSync, mkdirSync } from "node:fs";
import { access, cp, mkdir } from "node:fs/promises";
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
// COPYFILE_FICLONE is no help at all (3.5 GB copied, 3.5 GB of disk gone), hence shelling
// out; a filesystem that cannot clone fails the cp and lands on the portable path below.
const cloneArgs = (sourceDir: string, targetDir: string) =>
  process.platform === "darwin"
    ? ["-Rc", `${sourceDir}/.`, targetDir]
    : ["-a", "--reflink=auto", `${sourceDir}/.`, targetDir];

export const copyTree = async (sourceDir: string, targetDir: string) => {
  await access(sourceDir, constants.R_OK);
  await mkdir(targetDir, { recursive: true });

  if (spawnSync("cp", cloneArgs(sourceDir, targetDir), { stdio: "ignore" }).status === 0) {
    return;
  }

  await cp(sourceDir, targetDir, { recursive: true, force: true });
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
