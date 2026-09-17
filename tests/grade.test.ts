import assert from "node:assert/strict";
import test from "node:test";
import yaml from "js-yaml";
import { gradedRecord } from "../lib/grade.js";
import { readBenchmark } from "../lib/task.js";
import type { ResultRecord } from "../lib/types.js";

// What setup wrote, before any grade.
const SOURCE: ResultRecord = {
  task: "gas-quiz-001",
  run: "2026-09-17T100000Z-claude-no-skill-1",
  executor: "claude",
  variant: "no_skill",
  skill_version: "017d9dc",
  input_sha: "0123456789ab",
  skill_content: null,
  benchmark: "2026-09-clean",
  created: "2026-09-17T10:00:00.000Z",
};

const VERDICT = {
  expects: { expect_1: "pass" as const, expect_2: "fail" as const },
  expectSha: "abcdef012345",
  judge: { agent: "claude" as const, model: "claude-opus-5", reasoning_effort: "high" },
  harnessFailure: undefined,
};

// The site selects a benchmark's runs by this field, so a grade that dropped it would leave
// the run on disk and out of every tally — the failure the field exists to prevent.
test("a first grading keeps the benchmark setup named", () => {
  const graded = gradedRecord(SOURCE, VERDICT, null, null);

  assert.equal(graded.benchmark, "2026-09-clean");
  assert.equal(graded.run, SOURCE.run);
  assert.equal(graded.pass, false);
  assert.equal(graded.regrade_of, undefined);
});

// Supersession runs along regrade_of, so a re-reading under another id would take the run
// out of its benchmark: a regrade inherits, and verify has no flag to say otherwise.
test("a regrade inherits its source's benchmark", () => {
  const graded = gradedRecord(
    { ...SOURCE, pass: false, expects: { expect_1: "fail", expect_2: "fail" } },
    VERDICT,
    null,
    { run: `${SOURCE.run}-regrade-1`, reason: "expect_2 reworded", at: "2026-09-18T00:00:00.000Z" },
  );

  assert.equal(graded.benchmark, "2026-09-clean");
  assert.equal(graded.run, `${SOURCE.run}-regrade-1`);
  assert.equal(graded.regrade_of, SOURCE.run);
  assert.equal(graded.regrade_reason, "expect_2 reworded");
});

test("a run that predates the field is graded without one, not with null", () => {
  const { benchmark: _dropped, ...older } = SOURCE;
  const graded = gradedRecord(older, VERDICT, null, null);

  assert.equal("benchmark" in graded, false);
});

// build-index reads records leniently; this is the one shape of the field that must not
// pass quietly, because js-yaml turns an unquoted date into a Date and a Date is not an id.
test("readBenchmark warns on an unquoted date instead of nulling it", () => {
  const loaded = yaml.load("benchmark: 2026-09-17\n") as Record<string, unknown>;
  const read = readBenchmark(loaded.benchmark);

  assert.equal(read.benchmark, null);
  assert.match(read.warning ?? "", /not a string/);
  assert.match(read.warning ?? "", /quote it/);
});

test("readBenchmark reads a string, and absent or null as no benchmark without a warning", () => {
  assert.deepEqual(readBenchmark("2026-09-clean"), { benchmark: "2026-09-clean", warning: null });
  assert.deepEqual(readBenchmark(undefined), { benchmark: null, warning: null });
  assert.deepEqual(readBenchmark(null), { benchmark: null, warning: null });
});

// Routing (#134): which skills the workspace held is setup's fact and which the run loaded is
// run-executor's, and a grade has to carry both or the routing answer is only in a gitignored
// file's neighbour. A regrade re-reads no transcript, so it keeps the first grade's copy.
const ROUTED: ResultRecord = {
  ...SOURCE,
  run: "2026-09-17T100000Z-claude-routing-1",
  variant: "routing",
  skill_content: "0123456789ab",
  installed_skills: ["gas", "l2s"],
};

const EXECUTOR = {
  executor: "claude" as const,
  model: "claude-opus-5",
  reasoning_effort: "medium",
  started: "2026-09-17T10:01:00.000Z",
  finished: "2026-09-17T10:09:00.000Z",
  exit: 0,
  skills_loaded: ["l2s", "gas"],
};

test("a first grading copies installed_skills from setup and skills_loaded from run-executor", () => {
  const graded = gradedRecord(ROUTED, VERDICT, EXECUTOR, null);

  assert.deepEqual(graded.installed_skills, ["gas", "l2s"]);
  assert.deepEqual(graded.skills_loaded, ["l2s", "gas"]);
});

test("a regrade keeps both lists as first graded", () => {
  const graded = gradedRecord(
    { ...ROUTED, skills_loaded: ["l2s", "gas"], pass: false, expects: { expect_1: "fail", expect_2: "fail" } },
    VERDICT,
    null,
    { run: `${ROUTED.run}-regrade-1`, reason: "expect_2 reworded", at: "2026-09-18T00:00:00.000Z" },
  );

  assert.deepEqual(graded.installed_skills, ["gas", "l2s"]);
  assert.deepEqual(graded.skills_loaded, ["l2s", "gas"]);
});

test("a run that installed nothing gets neither key, not empty lists", () => {
  const graded = gradedRecord(SOURCE, VERDICT, { ...EXECUTOR, skills_loaded: undefined }, null);

  assert.equal("installed_skills" in graded, false);
  assert.equal("skills_loaded" in graded, false);
});
