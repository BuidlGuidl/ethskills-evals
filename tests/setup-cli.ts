import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Shared by the tests that drive `yarn setup`. Not a *.test.ts, so the runner's glob skips it.

export const ROOT = path.resolve(import.meta.dirname, "..");

// Driven through the CLI because that is where the flags live. Returns what setup printed when it
// failed, and "" when it did not.
export const setup = (args: string[], workspaceRoot: string) => {
  try {
    execFileSync("yarn", ["setup", ...args], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: "pipe",
      env: { ...process.env, EVAL_WORKSPACE_ROOT: workspaceRoot },
    });

    return "";
  } catch (error) {
    const { stdout = "", stderr = "" } = error as { stdout?: string; stderr?: string };

    return `${stdout}${stderr}`;
  }
};

// The task spec is written into a temp dir; the run dir setup makes lands under artifacts/<task>
// in the repo, as it does for a real run, and is removed afterwards. `skill` is the spec's
// `skill:` line, so a relative one resolves against the repo and an absolute one may leave it.
export const withTask = (taskId: string, skill: string, run: (taskPath: string, workspaceRoot: string) => void) => {
  const dir = mkdtempSync(path.join(tmpdir(), `eval-${taskId}-`));
  const taskPath = path.join(dir, `${taskId}.yaml`);
  const artifacts = path.join(ROOT, "artifacts", taskId);

  // A killed test never reaches the finally below, and the run dir it left would be the one the
  // next test reads back as its own.
  rmSync(artifacts, { recursive: true, force: true });
  writeFileSync(taskPath, `skill: ${skill}\ninput: |\n  Say hello.\nexpect:\n  - says hello\nruns: 1\n`);

  try {
    run(taskPath, path.join(dir, "workspaces"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(artifacts, { recursive: true, force: true });
  }
};
