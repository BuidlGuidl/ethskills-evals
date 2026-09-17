import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { expectSha } from "../lib/task.js";

const ROOT = path.resolve(import.meta.dirname, "..");

// --regrade writes a sibling <run-id>-regrade-<n>/ and never touches the source, so what the
// guards protect is not the source record but the meaning of the new one: a regrade with no
// stated reason, or over evidence no other clone has, is a grade nobody can check. Driven
// through the CLI because that is where the flag parsing lives.
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

  assert.match(verify(["--run", runDir, "--judge-agent", "claude", "--judge-model", "claude-opus-5", "--judge-effort", "medium", "--regrade", "why"]), /nothing to regrade/);
});

test("a graded run is refused without --regrade, and the message names the flag", () => {
  const runDir = fixtureRun({ ...UNGRADED, pass: false }, true);
  const output = verify(["--run", runDir, "--judge-agent", "claude", "--judge-model", "claude-opus-5", "--judge-effort", "medium"]);

  assert.match(output, /run already graded/);
  assert.match(output, /--regrade --reason/);
});

test("--regrade demands a stated reason before it spends a judge call", () => {
  const runDir = fixtureRun({ ...UNGRADED, pass: false }, true);

  assert.match(verify(["--run", runDir, "--judge-agent", "claude", "--judge-model", "claude-opus-5", "--judge-effort", "medium", "--regrade"]), /--reason/);
});

test("--regrade refuses evidence git does not track, since no other clone could reproduce it", () => {
  const runDir = fixtureRun({ ...UNGRADED, pass: false }, true);

  assert.match(verify(["--run", runDir, "--judge-agent", "claude", "--judge-model", "claude-opus-5", "--judge-effort", "medium", "--regrade", "why"]), /not tracked by git/);
});

// "Hold the judge fixed" is the rule a regrade rests on: re-reading one run under a rewritten
// rubric says something only while the grader is the same. The record now names the whole
// stack, so the command can hold it rather than the operator remembering to.
const GRADED_BY = { agent: "codex", model: "gpt-5.6-sol", reasoning_effort: "low", self_judged: true };

test("a regrade reuses the judge that graded the run when the flags are left off", () => {
  const runDir = fixtureRun({ ...UNGRADED, pass: false, judge: GRADED_BY }, true);
  const output = verify(["--run", runDir, "--regrade", "why"]);

  // Past the judge resolution and into the evidence guard: no --judge-* flag was needed.
  assert.match(output, /not tracked by git/);
});

test("a regrade on a different judge is refused, not silently graded on the new one", () => {
  const runDir = fixtureRun({ ...UNGRADED, pass: false, judge: GRADED_BY }, true);
  const output = verify(["--run", runDir, "--judge-agent", "codex", "--judge-model", "gpt-5.4", "--regrade", "why"]);

  assert.match(output, /--judge-model gpt-5\.4 disagrees with the judge that graded this run \(gpt-5\.6-sol\)/);
});

test("a judge with no stated effort is refused before the judge is called", () => {
  const runDir = fixtureRun({ ...UNGRADED, pass: false }, true);
  const output = verify(["--run", runDir, "--judge-agent", "claude", "--judge-model", "claude-opus-5", "--regrade", "why"]);

  assert.match(output, /missing --judge-effort/);
});

test("--regrade refuses a run whose evidence was never captured at all", () => {
  const runDir = fixtureRun({ ...UNGRADED, pass: false }, false);

  assert.match(verify(["--run", runDir, "--judge-agent", "claude", "--judge-model", "claude-opus-5", "--judge-effort", "medium", "--regrade", "why"]), /nothing to regrade|no output in/);
});

// The source record is the one thing a regrade must not touch — it is the reading the
// report's "was" column cites. A refusal is the case where that is easiest to get wrong,
// since the guards fire at different points and two of them are past the record load.
test("a refused regrade leaves the source result.yaml byte-identical", () => {
  const runDir = fixtureRun({ ...UNGRADED, pass: false }, true);
  const resultPath = path.join(runDir, "result.yaml");
  const before = readFileSync(resultPath);

  verify(["--run", runDir, "--judge-agent", "claude", "--judge-model", "claude-opus-5", "--judge-effort", "medium", "--regrade", "why"]);

  assert.deepEqual(readFileSync(resultPath), before);
  assert.equal(existsSync(`${runDir}-regrade-1`), false);
});

// Order matters as much as content: expects are addressed positionally as expect_<n>, so
// two lists holding the same lines in a different order are not the same rubric.
test("expectSha changes when an expect line is edited, added, or reordered", () => {
  const base = ["a line", "another line"];
  const shas = new Set([base, ["a line", "another line!"], [...base, "a third"], [...base].reverse()].map(expectSha));

  assert.equal(shas.size, 4);
  assert.equal(expectSha(base), expectSha(["a line", "another line"]));
});
