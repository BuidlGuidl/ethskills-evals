import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
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
  // installs node_modules cannot bury the evidence.
  const excludePath = path.join(git(workspacePath, ["rev-parse", "--absolute-git-dir"]), "info", "exclude");

  mkdirSync(path.dirname(excludePath), { recursive: true });
  appendFileSync(excludePath, `\n${GENERATED_DIRS.map(dir => `/${dir}/\n**/${dir}/`).join("\n")}\n`);

  git(workspacePath, ["add", "-A"]);
  git(workspacePath, ["commit", "-q", "--allow-empty", "-m", "eval baseline"]);

  return git(workspacePath, ["rev-parse", "HEAD"]);
};
