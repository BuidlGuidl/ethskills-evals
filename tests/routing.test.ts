import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import yaml from "js-yaml";
import { loadedSkills } from "../lib/routing.js";

const INSTALLED = ["standards", "wallets", "tools"];

// Lines as lib/transcript.ts renders them: a claude Skill call, a claude Read by path, a
// codex exec, an opencode read, and tool output quoted under `  > `.
const transcript = [
  "# Executor transcript — 2026-09-17T143357Z-claude-routing-1",
  "",
  "## assistant",
  "Let me look at what is installed.",
  "",
  "- **Bash** `ls -R .claude/skills`",
  "",
  "  > .claude/skills/standards/SKILL.md",
  "  > .claude/skills/wallets/SKILL.md",
  "  > .claude/skills/tools/SKILL.md",
  "",
  "## assistant",
  '- **Skill** `{"skill":"wallets"}`',
  "",
  "  > See .claude/skills/standards/SKILL.md for the ERC-8004 part.",
  "",
  "## assistant",
  "- **Read** `/tmp/ws/.claude/skills/standards/SKILL.md`",
  "",
  "## assistant",
  "- **exec** `sed -n '1,240p' .agents/skills/wallets/SKILL.md` → exit 0",
  "",
  "## assistant",
  "- **read** `.opencode/skills/gas/SKILL.md`",
  "",
].join("\n");

test("loaded skills are the ones the executor called or read, first reach first", () => {
  assert.deepEqual(loadedSkills(transcript, INSTALLED), ["wallets", "standards"]);
});

test("tool output naming a skill's path is a listing, not a load", () => {
  const listingOnly = transcript.split("\n").filter(line => !line.includes("**Skill**") && !line.includes("**Read**") && !line.includes("**exec**")).join("\n");

  assert.deepEqual(loadedSkills(listingOnly, INSTALLED), []);
});

test("a bare Skill argument and a Skill call with args both count; a name not installed does not", () => {
  assert.deepEqual(loadedSkills("- **Skill** `tools`\n", INSTALLED), ["tools"]);
  assert.deepEqual(loadedSkills('- **Skill** `{"skill":"tools","args":"x402"}`\n', INSTALLED), ["tools"]);
  assert.deepEqual(loadedSkills('- **Skill** `{"skill":"gas"}`\n', INSTALLED), []);
  assert.deepEqual(loadedSkills("- **Skill** `{\"skill\":\"wallets\"} … [12 more chars]`\n", INSTALLED), []);
});

// Setup end to end, through the CLI, on a temp skills dir: a routing run installs the task's
// skill and its cede neighbours and records them; a skill with no neighbours is refused
// before anything is written.
const ROOT = path.resolve(import.meta.dirname, "..");
const TASK_ID = "zz-routing-test-001";

const setup = (args: string[], workspaceRoot: string) => {
  try {
    return execFileSync("yarn", ["setup", ...args], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: "pipe",
      env: { ...process.env, EVAL_WORKSPACE_ROOT: workspaceRoot },
    });
  } catch (error) {
    const { stdout = "", stderr = "" } = error as { stdout?: string; stderr?: string };

    return `${stdout}${stderr}`;
  }
};

const withSkills = (run: (dir: string, workspaceRoot: string) => void) => {
  const dir = mkdtempSync(path.join(tmpdir(), "eval-routing-"));
  const artifacts = path.join(ROOT, "artifacts", TASK_ID);
  const skills = {
    gas: 'Use for fee maths. Not for chain choice (`l2s`).',
    l2s: "Use for chain choice.",
    wallets: 'Use for signing. Not for the fee itself (`gas`).',
    noir: "Use for circuits.",
  };

  for (const [name, description] of Object.entries(skills)) {
    mkdirSync(path.join(dir, "skills", name), { recursive: true });
    writeFileSync(path.join(dir, "skills", name, "SKILL.md"), `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`);
  }

  try {
    run(dir, path.join(dir, "workspaces"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(artifacts, { recursive: true, force: true });
  }
};

const taskFor = (dir: string, skill: string) => {
  const taskPath = path.join(dir, `${TASK_ID}.yaml`);

  writeFileSync(taskPath, `skill: ${path.join(dir, "skills", skill)}\ninput: |\n  Say hello.\nexpect:\n  - says hello\nruns: 1\n`);

  return taskPath;
};

const BASE = ["--run", "1", "--executor", "claude", "--benchmark", "routing-test"];

test("a routing run installs the task's skill and its cede neighbours, and records them", () => {
  withSkills((dir, workspaceRoot) => {
    const output = setup(["--task", taskFor(dir, "gas"), "--variant", "routing", ...BASE], workspaceRoot);

    assert.match(output, /installed gas, l2s, wallets/, output);

    const [runId] = execFileSync("ls", [path.join(ROOT, "artifacts", TASK_ID)], { encoding: "utf8" }).trim().split("\n");
    const runDir = path.join(ROOT, "artifacts", TASK_ID, runId);
    const record = yaml.load(readFileSync(path.join(runDir, "result.yaml"), "utf8")) as Record<string, unknown>;
    const workspace = readFileSync(path.join(runDir, "workspace.path"), "utf8").trim();

    assert.match(runId, /-claude-routing-1$/);
    assert.equal(record.variant, "routing");
    assert.deepEqual(record.installed_skills, ["gas", "l2s", "wallets"]);

    for (const name of ["gas", "l2s", "wallets"]) {
      assert.ok(existsSync(path.join(workspace, ".agents", "skills", name, "SKILL.md")), `${name} not in .agents/skills`);
      assert.ok(existsSync(path.join(workspace, ".claude", "skills", name, "SKILL.md")), `${name} not in .claude/skills`);
    }

    assert.equal(existsSync(path.join(workspace, ".agents", "skills", "noir")), false);
  });
});

test("a with_skill run records its one installed skill", () => {
  withSkills((dir, workspaceRoot) => {
    const output = setup(["--task", taskFor(dir, "gas"), "--variant", "with_skill", ...BASE], workspaceRoot);

    assert.match(output, /run-executor/, output);

    const [runId] = execFileSync("ls", [path.join(ROOT, "artifacts", TASK_ID)], { encoding: "utf8" }).trim().split("\n");
    const record = yaml.load(readFileSync(path.join(ROOT, "artifacts", TASK_ID, runId, "result.yaml"), "utf8")) as Record<string, unknown>;

    assert.deepEqual(record.installed_skills, ["gas"]);
  });
});

test("a skill with no cede neighbours is refused as a routing run, and nothing is written", () => {
  withSkills((dir, workspaceRoot) => {
    const output = setup(["--task", taskFor(dir, "noir"), "--variant", "routing", ...BASE], workspaceRoot);

    assert.match(output, /cedes to no skill and no skill cedes to it/, output);
    assert.equal(existsSync(path.join(ROOT, "artifacts", TASK_ID)), false);
    // The root itself is left (it is the operator's), but nothing of this run under it.
    assert.deepEqual(existsSync(workspaceRoot) ? readdirSync(workspaceRoot) : [], []);
  });
});
