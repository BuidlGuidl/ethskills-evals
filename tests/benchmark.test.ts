import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import yaml from "js-yaml";
import { parseBenchmark } from "../lib/task.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const TASK_ID = "zz-benchmark-test-001";

// Driven through the CLI because that is where the flag lives. The task spec is written into
// a temp dir; the run dir setup makes lands under artifacts/<task> in the repo, as it does
// for a real run, and is removed afterwards.
const setup = (args: string[], workspaceRoot: string) => {
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

const withTask = (run: (taskPath: string, workspaceRoot: string) => void) => {
  const dir = mkdtempSync(path.join(tmpdir(), "eval-benchmark-"));
  const taskPath = path.join(dir, `${TASK_ID}.yaml`);
  const artifacts = path.join(ROOT, "artifacts", TASK_ID);

  writeFileSync(taskPath, "skill: skills/addresses\ninput: |\n  Say hello.\nexpect:\n  - says hello\nruns: 1\n");

  try {
    run(taskPath, path.join(dir, "workspaces"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(artifacts, { recursive: true, force: true });
  }
};

const BASE = ["--variant", "no_skill", "--run", "1", "--executor", "claude"];

test("setup refuses to run without --benchmark, and writes nothing", () => {
  withTask((taskPath, workspaceRoot) => {
    assert.match(setup(["--task", taskPath, ...BASE], workspaceRoot), /--benchmark/);
    assert.equal(existsSync(path.join(ROOT, "artifacts", TASK_ID)), false);
  });
});

test("a benchmark id is one token of letters, digits, '.', '_' and '-'", () => {
  for (const id of ["2026-09-clean", "v2", "a.b_c-d"]) {
    assert.equal(parseBenchmark(id), id);
  }

  for (const id of ["2026 09", "-lead", ".lead", "", "a/b", "a:b"]) {
    assert.throws(() => parseBenchmark(id), /benchmark id must be/);
  }
});

test("setup refuses a benchmark id that is not one token", () => {
  withTask((taskPath, workspaceRoot) => {
    assert.match(setup(["--task", taskPath, ...BASE, "--benchmark", "2026 09"], workspaceRoot), /benchmark id must be/);
    assert.equal(existsSync(path.join(ROOT, "artifacts", TASK_ID)), false);
  });
});

test("setup records the benchmark id in result.yaml", () => {
  withTask((taskPath, workspaceRoot) => {
    const output = setup(["--task", taskPath, ...BASE, "--benchmark", "2026-09-clean"], workspaceRoot);

    assert.equal(output, "", output);

    const [runDir] = execFileSync("ls", [path.join(ROOT, "artifacts", TASK_ID)], { encoding: "utf8" }).trim().split("\n");
    const record = yaml.load(readFileSync(path.join(ROOT, "artifacts", TASK_ID, runDir, "result.yaml"), "utf8")) as Record<string, unknown>;

    assert.equal(record.benchmark, "2026-09-clean");
  });
});
