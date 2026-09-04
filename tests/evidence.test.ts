import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { writeDiff } from "../lib/evidence.js";
import { seedWorkspaceRepo } from "../lib/workspace.js";

const git = (workspacePath: string, args: string[]) =>
  execFileSync("git", ["-C", workspacePath, ...args], { encoding: "utf8" }).trim();

const write = (workspacePath: string, relativePath: string, content: string) => {
  const target = path.join(workspacePath, relativePath);

  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
};

// The template workspace as setup leaves it: task file, scaffold source, the installed
// skill, then the baseline commit. Everything a run does happens after this returns.
const seedTemplateWorkspace = () => {
  const workspacePath = mkdtempSync(path.join(tmpdir(), "eval-workspace-"));

  write(workspacePath, "TASK.md", "do the thing\n");
  write(workspacePath, "package.json", `${JSON.stringify({ name: "fixture", private: true }, null, 2)}\n`);
  write(workspacePath, "src/existing.ts", "export const answer = 41;\n");
  write(workspacePath, ".claude/skills/fixture/SKILL.md", "# fixture skill\n");
  write(workspacePath, ".agents/skills/fixture/SKILL.md", "# fixture skill\n");

  return { workspacePath, baselineSha: seedWorkspaceRepo(workspacePath) };
};

const readDiff = (workspacePath: string, baselineSha: string) => {
  const diffPath = path.join(workspacePath, "..", `${path.basename(workspacePath)}.diff`);

  return { diffPath, run: async () => (await writeDiff(workspacePath, diffPath, baselineSha), readFileSync(diffPath, "utf8")) };
};

// The #58 regression: with an installed node_modules at the workspace root, `git add -N`
// under an exclusion pathspec exits 1 ("paths are ignored by one of your .gitignore
// files") and the run reaches the judge as empty evidence.
test("diff evidence survives an installed node_modules and keeps the skill out", async () => {
  const { workspacePath, baselineSha } = seedTemplateWorkspace();

  write(workspacePath, "node_modules/left-pad/index.js", "module.exports = () => {};\n");
  write(workspacePath, "node_modules/.package-lock.json", "{}\n");
  write(workspacePath, "src/existing.ts", "export const answer = 42;\n");
  write(workspacePath, "src/added.ts", "export const tipJar = true;\n");
  write(workspacePath, ".claude/settings.local.json", '{"permissions":{}}\n');

  const diff = await readDiff(workspacePath, baselineSha).run();

  assert.match(diff, /export const answer = 42;/);
  assert.match(diff, /export const tipJar = true;/);
  assert.doesNotMatch(diff, /node_modules/);
  assert.doesNotMatch(diff, /\.claude/);
  assert.doesNotMatch(diff, /\.agents/);
});

// The other silent-empty path, and the one this harness introduced: an executor that
// finishes a feature commits it, leaving a clean worktree that a plain `git diff` reads
// as an empty run. Evidence is taken against the baseline commit for exactly this.
test("diff evidence survives an executor that commits its own work", async () => {
  const { workspacePath, baselineSha } = seedTemplateWorkspace();

  write(workspacePath, "src/added.ts", "export const tipJar = true;\n");
  write(workspacePath, "src/existing.ts", "export const answer = 42;\n");
  git(workspacePath, ["add", "-A"]);
  git(workspacePath, ["commit", "-q", "-m", "feat: tip jar"]);

  assert.equal(git(workspacePath, ["status", "--porcelain"]), "");

  const diff = await readDiff(workspacePath, baselineSha).run();

  assert.match(diff, /export const tipJar = true;/);
  assert.match(diff, /export const answer = 42;/);
});

// create-eth git-inits whatever it scaffolds, without checking whether it is already
// inside a repo. git will not diff through the result, so this has to fail loudly rather
// than hand the judge an empty run.
test("a scaffolded nested repo fails instead of grading as an empty run", async () => {
  for (const commitScaffold of [true, false]) {
    const { workspacePath, baselineSha } = seedTemplateWorkspace();
    const scaffoldPath = path.join(workspacePath, "my-dapp");

    mkdirSync(scaffoldPath);
    git(scaffoldPath, ["init", "-q", "-b", "main"]);
    git(scaffoldPath, ["config", "user.name", "eval executor"]);
    git(scaffoldPath, ["config", "user.email", "executor@localhost"]);
    write(workspacePath, "my-dapp/packages/nextjs/app/page.tsx", "export default () => null;\n");

    if (commitScaffold) {
      git(scaffoldPath, ["add", "-A"]);
      git(scaffoldPath, ["commit", "-q", "-m", "scaffold"]);
    }

    await assert.rejects(readDiff(workspacePath, baselineSha).run(), /nested git repo in the workspace: my-dapp\b/);
  }
});

// The pre-check sees nothing here: the executor committed the gitlink, so the worktree is
// clean and `git status --porcelain` is empty. Only the diff shows that a whole scaffold
// collapsed into one line.
test("a committed nested repo is caught in the diff, not just in status", async () => {
  const { workspacePath, baselineSha } = seedTemplateWorkspace();
  const scaffoldPath = path.join(workspacePath, "my-dapp");

  mkdirSync(scaffoldPath);
  git(scaffoldPath, ["init", "-q", "-b", "main"]);
  git(scaffoldPath, ["config", "user.name", "eval executor"]);
  git(scaffoldPath, ["config", "user.email", "executor@localhost"]);
  write(workspacePath, "my-dapp/packages/nextjs/app/page.tsx", "export default () => null;\n");
  git(scaffoldPath, ["add", "-A"]);
  git(scaffoldPath, ["commit", "-q", "-m", "scaffold"]);
  git(workspacePath, ["add", "my-dapp"]);
  git(workspacePath, ["commit", "-q", "-m", "feat: scaffold the app"]);

  assert.equal(git(workspacePath, ["status", "--porcelain"]), "");

  await assert.rejects(readDiff(workspacePath, baselineSha).run(), /nested git repo in the workspace: my-dapp\b/);
});
