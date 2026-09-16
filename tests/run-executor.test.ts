import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(import.meta.dirname, "..");
// Resolved because the temp dir is a symlink on macOS, and the workspace guard compares
// resolved paths.
const TMP = realpathSync(tmpdir());
const TASK_ID = "gas-quiz-001";
const RUN_ID = "2026-09-16T101010Z-claude-no-skill-1";

// Driven through the CLI because the guarantee is about the command, not the resolver: a run
// that cannot name its model and effort must leave no executor.yaml behind, or the run dir is
// spent and the "already executed" guard bricks it.
const runExecutor = (runDir: string, workspaceRoot: string, args: string[]) => {
  try {
    execFileSync("yarn", ["run-executor", "--run", runDir, ...args], {
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

// A run dir as `setup` leaves it: the record, and a pointer to a workspace laid out the way
// the workspace guard demands — <root>/<run-id>/<task-id>, run id above task id.
const fixtureRun = () => {
  const home = mkdtempSync(path.join(TMP, "eval-run-executor-"));
  const workspaceRoot = path.join(home, "workspaces");
  const runDir = path.join(home, "artifacts", TASK_ID, RUN_ID);
  const workspace = path.join(workspaceRoot, RUN_ID, TASK_ID);

  mkdirSync(runDir, { recursive: true });
  mkdirSync(workspace, { recursive: true });
  writeFileSync(path.join(workspace, "TASK.md"), "answer into answer.md\n");
  writeFileSync(path.join(runDir, "workspace.path"), `${workspace}\n`);
  writeFileSync(
    path.join(runDir, "result.yaml"),
    [
      `task: ${TASK_ID}`,
      `run: ${RUN_ID}`,
      "executor: claude",
      "variant: no_skill",
      "skill_version: null",
      "created: '2026-09-16T10:10:10.000Z'",
      "",
    ].join("\n"),
  );

  return { runDir, workspaceRoot };
};

test("a claude run with no --effort is refused, and spends no run dir", () => {
  const { runDir, workspaceRoot } = fixtureRun();
  const output = runExecutor(runDir, workspaceRoot, ["--model", "claude-opus-5"]);

  assert.match(output, /missing --effort/);
  assert.equal(existsSync(path.join(runDir, "executor.yaml")), false);
});

test("a claude run with no --model is refused the same way", () => {
  const { runDir, workspaceRoot } = fixtureRun();
  const output = runExecutor(runDir, workspaceRoot, ["--effort", "medium"]);

  assert.match(output, /missing --model/);
  assert.equal(existsSync(path.join(runDir, "executor.yaml")), false);
});

test("an effort the CLI would not take is refused before the executor is spawned", () => {
  const { runDir, workspaceRoot } = fixtureRun();
  const output = runExecutor(runDir, workspaceRoot, ["--model", "claude-opus-5", "--effort", "minimal"]);

  assert.match(output, /unknown --effort for claude: minimal/);
  assert.equal(existsSync(path.join(runDir, "executor.yaml")), false);
});
