import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import yaml from "js-yaml";
import { normalizeSkillText, skillContentId } from "../lib/skill.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const TASK_ID = "zz-skill-ref-test-001";
// The commit that vendored every skill, so addresses' text there is not its text today.
const FIRST_VERSION = "2f0adb01";

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
  const dir = mkdtempSync(path.join(tmpdir(), "eval-skill-ref-"));
  const taskPath = path.join(dir, `${TASK_ID}.yaml`);

  writeFileSync(taskPath, "skill: skills/addresses\ninput: |\n  Say hello.\nexpect:\n  - says hello\nruns: 1\n");

  try {
    run(taskPath, path.join(dir, "workspaces"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(path.join(ROOT, "artifacts", TASK_ID), { recursive: true, force: true });
  }
};

const args = (taskPath: string, variant: string, ...extra: string[]) =>
  ["--task", taskPath, "--variant", variant, "--run", "1", "--executor", "claude", "--benchmark", "skill-ref-test", ...extra];

const gitShow = (spec: string) => execFileSync("git", ["-C", ROOT, "show", spec], { encoding: "utf8" });

test("with_skill --skill-ref installs the skill as it stood at that commit, and records the commit", () => {
  withTask((taskPath, workspaceRoot) => {
    const output = setup(args(taskPath, "with_skill", "--skill-ref", FIRST_VERSION), workspaceRoot);

    assert.equal(output, "", output);

    const [runId] = readdirSync(path.join(ROOT, "artifacts", TASK_ID));
    const runDir = path.join(ROOT, "artifacts", TASK_ID, runId);
    const record = yaml.load(readFileSync(path.join(runDir, "result.yaml"), "utf8")) as Record<string, unknown>;
    const workspace = readFileSync(path.join(runDir, "workspace.path"), "utf8").trim();
    const old = gitShow(`${FIRST_VERSION}:skills/addresses/SKILL.md`);

    assert.notEqual(normalizeSkillText(old), normalizeSkillText(readFileSync(path.join(ROOT, "skills/addresses/SKILL.md"), "utf8")));
    assert.equal(record.skill_version, FIRST_VERSION);
    assert.match(runId, new RegExp(`-claude-with-skill-${FIRST_VERSION}-1$`));
    assert.equal(record.skill_content, skillContentId(old));

    for (const dir of [".agents", ".claude"]) {
      assert.equal(readFileSync(path.join(workspace, dir, "skills/addresses/SKILL.md"), "utf8"), old);
    }
  });
});

test("--skill-ref records the same fixed-length sha however it is spelled", () => {
  withTask((taskPath, workspaceRoot) => {
    const full = execFileSync("git", ["-C", ROOT, "rev-parse", `${FIRST_VERSION}^{commit}`], { encoding: "utf8" }).trim();
    const output = setup(args(taskPath, "with_skill", "--skill-ref", full), workspaceRoot);

    assert.equal(output, "", output);

    const [runId] = readdirSync(path.join(ROOT, "artifacts", TASK_ID));
    const record = yaml.load(readFileSync(path.join(ROOT, "artifacts", TASK_ID, runId, "result.yaml"), "utf8")) as Record<string, unknown>;

    assert.equal(record.skill_version, FIRST_VERSION);
  });
});

// The timestamp is the only other thing in a run id, so ids that still differ without it cannot
// collide however close together the two setups land.
test("an old and a new arm of the same run number differ in their run id beyond the timestamp", () => {
  withTask((taskPath, workspaceRoot) => {
    const outputs = [
      setup(args(taskPath, "with_skill", "--skill-ref", FIRST_VERSION), workspaceRoot),
      setup(args(taskPath, "with_skill", "--skill-ref", "HEAD"), workspaceRoot),
    ];

    assert.deepEqual(outputs, ["", ""]);

    const arms = readdirSync(path.join(ROOT, "artifacts", TASK_ID)).map(id => id.replace(/^\d{4}-\d{2}-\d{2}T\d{6}Z-/, ""));
    // Sliced, not --short=8: that is only a minimum, and setup records exactly 8.
    const head = execFileSync("git", ["-C", ROOT, "rev-parse", "HEAD"], { encoding: "utf8" }).trim().slice(0, 8);

    assert.equal(new Set(arms).size, 2, arms.join(", "));
    assert.deepEqual([FIRST_VERSION, head].map(sha => arms.filter(arm => arm.includes(`-${sha}-`)).length), [1, 1], arms.join(", "));
  });
});

test("--skill-ref is refused on no_skill, and writes nothing", () => {
  withTask((taskPath, workspaceRoot) => {
    assert.match(setup(args(taskPath, "no_skill", "--skill-ref", FIRST_VERSION), workspaceRoot), /only applies to --variant with_skill/);
    assert.equal(existsSync(path.join(ROOT, "artifacts", TASK_ID)), false);
  });
});

test("an unknown --skill-ref is refused before a run dir is made", () => {
  withTask((taskPath, workspaceRoot) => {
    assert.match(setup(args(taskPath, "with_skill", "--skill-ref", "not-a-ref"), workspaceRoot), /not a commit in this repo/);
    assert.equal(existsSync(path.join(ROOT, "artifacts", TASK_ID)), false);
  });
});

test("a --skill-ref where the skill did not exist yet is refused", () => {
  withTask((taskPath, workspaceRoot) => {
    const root = execFileSync("git", ["-C", ROOT, "rev-list", "--max-parents=0", "HEAD"], { encoding: "utf8" }).trim().split("\n")[0];

    assert.match(setup(args(taskPath, "with_skill", "--skill-ref", root), workspaceRoot), /does not exist at/);
    assert.equal(existsSync(path.join(ROOT, "artifacts", TASK_ID)), false);
  });
});
