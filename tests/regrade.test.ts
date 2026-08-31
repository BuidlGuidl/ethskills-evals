import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { expectSha } from "../lib/task.js";

const ROOT = path.resolve(import.meta.dirname, "..");

// The guards are the point of --regrade: it is the one path that overwrites a grade, so
// each refusal below is a way the overwrite could have destroyed evidence instead of
// re-reading it. Driven through the CLI because that is where the flag parsing lives.
const verify = (args: string[]) => {
  try {
    execFileSync("yarn", ["verify", ...args], { cwd: ROOT, encoding: "utf8", stdio: "pipe" });

    return "";
  } catch (error) {
    const { stdout = "", stderr = "" } = error as { stdout?: string; stderr?: string };

    return `${stdout}${stderr}`;
  }
};

const fixtureRun = (fields: Record<string, unknown>, withOutput: boolean) => {
  const runDir = mkdtempSync(path.join(tmpdir(), "eval-regrade-"));
  const lines = Object.entries(fields).map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`);

  writeFileSync(path.join(runDir, "result.yaml"), `${lines.join("\n")}\n`);

  if (withOutput) {
    mkdirSync(path.join(runDir, "output"));
    writeFileSync(path.join(runDir, "output", "answer.md"), "an answer\n");
  }

  return runDir;
};

const UNGRADED = {
  task: "gas-quiz-001",
  run: "2026-08-28T015955Z-codex-with-skill-1",
  executor: "codex",
  variant: "with_skill",
  skill_version: "017d9dc",
  created: "'2026-08-28T01:59:55.000Z'",
};

test("--regrade is refused on a run that has never been graded", () => {
  const runDir = fixtureRun(UNGRADED, true);

  assert.match(verify(["--run", runDir, "--judge-agent", "claude", "--regrade", "why"]), /nothing to regrade/);
});

test("a graded run is refused without --regrade, and the message names the flag", () => {
  const runDir = fixtureRun({ ...UNGRADED, pass: false }, true);
  const output = verify(["--run", runDir, "--judge-agent", "claude"]);

  assert.match(output, /run already graded/);
  assert.match(output, /--regrade --reason/);
});

test("--regrade demands a stated reason before it spends a judge call", () => {
  const runDir = fixtureRun({ ...UNGRADED, pass: false }, true);

  assert.match(verify(["--run", runDir, "--judge-agent", "claude", "--regrade"]), /--reason/);
});

test("--regrade refuses evidence git does not track, since no other clone could reproduce it", () => {
  const runDir = fixtureRun({ ...UNGRADED, pass: false }, true);

  assert.match(verify(["--run", runDir, "--judge-agent", "claude", "--regrade", "why"]), /not tracked by git/);
});

test("--regrade refuses a run whose evidence was never captured at all", () => {
  const runDir = fixtureRun({ ...UNGRADED, pass: false }, false);

  assert.match(verify(["--run", runDir, "--judge-agent", "claude", "--regrade", "why"]), /nothing to regrade|no output in/);
});

// Order matters as much as content: expects are addressed positionally as expect_<n>, so
// two lists holding the same lines in a different order are not the same rubric.
test("expectSha changes when an expect line is edited, added, or reordered", () => {
  const base = ["a line", "another line"];
  const shas = new Set([base, ["a line", "another line!"], [...base, "a third"], [...base].reverse()].map(expectSha));

  assert.equal(shas.size, 4);
  assert.equal(expectSha(base), expectSha(["a line", "another line"]));
});
