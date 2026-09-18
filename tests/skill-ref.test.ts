import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import yaml from "js-yaml";
import { SKILL_VERSION_LENGTH, skillContentId } from "../lib/skill.js";
import { ROOT, setup, withTask as withTaskFor } from "./setup-cli.js";

const TASK_ID = "zz-skill-ref-test-001";
const OLD_TEXT = "---\nname: demo\ndescription: a demo skill\n---\n\nThe old text.\n";
const NEW_TEXT = "---\nname: demo\ndescription: a demo skill\n---\n\nThe new text.\n";

// A repo of the test's own rather than this one's history: a shallow clone (CI, the deploy host)
// has no old commits to point at, and a skill here reverted to an old text would make "old" and
// "new" the same file. It also sits outside the harness repo, which is the case --skill-ref has
// to look the ref up in the skill's repo for.
const FIXTURE = mkdtempSync(path.join(tmpdir(), "eval-skill-ref-repo-"));
const SKILL_DIR = path.join(FIXTURE, "skills", "demo");

after(() => rmSync(FIXTURE, { recursive: true, force: true }));

const git = (args: string[], input?: string) =>
  execFileSync("git", ["-C", FIXTURE, "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], { encoding: "utf8", input }).trim();

const commit = (files: Record<string, string>, message: string) => {
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(FIXTURE, file)), { recursive: true });
    writeFileSync(path.join(FIXTURE, file), text);
  }

  git(["add", "-A"]);
  git(["commit", "--quiet", "-m", message]);

  return git(["rev-parse", "HEAD"]);
};

git(["init", "--quiet"]);

const BEFORE_SKILL = commit({ "README.md": "no skill yet\n" }, "root");
const OLD = commit({ "skills/demo/SKILL.md": OLD_TEXT, "skills/demo/references/a.md": "a reference\n" }, "old text");
const NEW = commit({ "skills/demo/SKILL.md": NEW_TEXT }, "new text");
const short = (sha: string) => sha.slice(0, SKILL_VERSION_LENGTH);

const withTask = (run: (taskPath: string, workspaceRoot: string) => void) => withTaskFor(TASK_ID, SKILL_DIR, run);

const args = (taskPath: string, variant: string, ...extra: string[]) =>
  ["--task", taskPath, "--variant", variant, "--run", "1", "--executor", "claude", "--benchmark", "skill-ref-test", ...extra];

const readRuns = () =>
  readdirSync(path.join(ROOT, "artifacts", TASK_ID)).map(runId => {
    const runDir = path.join(ROOT, "artifacts", TASK_ID, runId);

    return {
      runId,
      record: yaml.load(readFileSync(path.join(runDir, "result.yaml"), "utf8")) as Record<string, unknown>,
      workspace: readFileSync(path.join(runDir, "workspace.path"), "utf8").trim(),
    };
  });

test("with_skill --skill-ref installs the skill as it stood at that commit, and records the commit", () => {
  withTask((taskPath, workspaceRoot) => {
    const output = setup(args(taskPath, "with_skill", "--skill-ref", short(OLD)), workspaceRoot);

    assert.equal(output, "", output);

    const [{ runId, record, workspace }] = readRuns();

    assert.equal(record.skill_version, short(OLD));
    assert.match(runId, new RegExp(`-claude-with-skill-${short(OLD)}-1$`));
    assert.equal(record.skill_content, skillContentId(OLD_TEXT));

    for (const dir of [".agents", ".claude"]) {
      assert.equal(readFileSync(path.join(workspace, dir, "skills/demo/SKILL.md"), "utf8"), OLD_TEXT);
      assert.equal(readFileSync(path.join(workspace, dir, "skills/demo/references/a.md"), "utf8"), "a reference\n");
    }
  });
});

test("--skill-ref installs what git holds, not an uncommitted edit to the skill dir", () => {
  withTask((taskPath, workspaceRoot) => {
    writeFileSync(path.join(SKILL_DIR, "SKILL.md"), "an edit nobody committed\n");

    try {
      const output = setup(args(taskPath, "with_skill", "--skill-ref", "HEAD"), workspaceRoot);

      assert.equal(output, "", output);

      const [{ record, workspace }] = readRuns();

      assert.equal(record.skill_version, short(NEW));
      assert.equal(readFileSync(path.join(workspace, ".agents/skills/demo/SKILL.md"), "utf8"), NEW_TEXT);
    } finally {
      writeFileSync(path.join(SKILL_DIR, "SKILL.md"), NEW_TEXT);
    }
  });
});

test("--skill-ref records the same fixed-length sha however it is spelled", () => {
  withTask((taskPath, workspaceRoot) => {
    const output = setup(args(taskPath, "with_skill", "--skill-ref", OLD), workspaceRoot);

    assert.equal(output, "", output);
    assert.equal(readRuns()[0].record.skill_version, short(OLD));
  });
});

test("with_skill without --skill-ref records the skill repo's HEAD at the same fixed length", () => {
  withTask((taskPath, workspaceRoot) => {
    const output = setup(args(taskPath, "with_skill"), workspaceRoot);

    assert.equal(output, "", output);

    const [{ runId, record }] = readRuns();

    // Sliced, not --short=8: that is only a minimum, and setup records exactly 8.
    assert.equal(record.skill_version, short(NEW));
    assert.match(runId, /-claude-with-skill-1$/);
  });
});

// The timestamp is the only other thing in a run id, so ids that still differ without it cannot
// collide however close together the two setups land.
test("an old and a new arm of the same run number differ in their run id beyond the timestamp", () => {
  withTask((taskPath, workspaceRoot) => {
    const outputs = [
      setup(args(taskPath, "with_skill", "--skill-ref", short(OLD)), workspaceRoot),
      setup(args(taskPath, "with_skill", "--skill-ref", "HEAD"), workspaceRoot),
    ];

    assert.deepEqual(outputs, ["", ""]);

    const arms = readRuns().map(({ runId }) => runId.replace(/^\d{4}-\d{2}-\d{2}T\d{6}Z-/, ""));

    assert.equal(new Set(arms).size, 2, arms.join(", "));
    assert.deepEqual([OLD, NEW].map(sha => arms.filter(arm => arm.includes(`-${short(sha)}-`)).length), [1, 1], arms.join(", "));
  });
});

test("--skill-ref is refused on no_skill, and writes nothing", () => {
  withTask((taskPath, workspaceRoot) => {
    assert.match(setup(args(taskPath, "no_skill", "--skill-ref", short(OLD)), workspaceRoot), /only applies to --variant with_skill/);
    assert.equal(existsSync(path.join(ROOT, "artifacts", TASK_ID)), false);
  });
});

test("an unknown --skill-ref is refused before a run dir is made", () => {
  withTask((taskPath, workspaceRoot) => {
    assert.match(setup(args(taskPath, "with_skill", "--skill-ref", "not-a-ref"), workspaceRoot), /does not name one commit in/);
    assert.equal(existsSync(path.join(ROOT, "artifacts", TASK_ID)), false);
  });
});

// A ref that lives only in the harness repo: looked up there, it would resolve, and the skill
// would then be "missing" at a commit of the wrong repository.
test("--skill-ref is looked up in the skill's repo, not the harness's", () => {
  withTask((taskPath, workspaceRoot) => {
    const harnessHead = execFileSync("git", ["-C", ROOT, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const output = setup(args(taskPath, "with_skill", "--skill-ref", harnessHead), workspaceRoot);

    assert.match(output, /does not name one commit in/);
    assert.ok(output.includes(path.basename(FIXTURE)), output);
  });
});

// Commits made by fast-import carry fixed names and dates, so their shas are the same on every
// machine; enough of them and two share their first four characters, git's shortest abbreviation.
test("an ambiguous short --skill-ref says so, with git's candidates, rather than 'not a commit'", () => {
  const stream = Array.from({ length: 1500 }, (_, index) => {
    const message = `c${index}`;

    return `commit refs/heads/ambiguous\ncommitter t <t@t> 1700000000 +0000\ndata ${message.length}\n${message}\n`;
  }).join("");

  git(["fast-import", "--quiet"], stream);

  const prefixes = git(["rev-list", "refs/heads/ambiguous"]).split("\n").map(sha => sha.slice(0, 4));
  const shared = prefixes.find((prefix, index) => prefixes.indexOf(prefix) !== index);

  assert.ok(shared, "no two fixture commits share a 4-character prefix");

  withTask((taskPath, workspaceRoot) => {
    const output = setup(args(taskPath, "with_skill", "--skill-ref", shared), workspaceRoot);

    assert.match(output, /does not name one commit in/);
    assert.match(output, /ambiguous/);
    assert.equal(existsSync(path.join(ROOT, "artifacts", TASK_ID)), false);
  });
});

test("a --skill-ref where the skill did not exist yet is refused", () => {
  withTask((taskPath, workspaceRoot) => {
    assert.match(setup(args(taskPath, "with_skill", "--skill-ref", BEFORE_SKILL), workspaceRoot), /does not exist at/);
    assert.equal(existsSync(path.join(ROOT, "artifacts", TASK_ID)), false);
  });
});
