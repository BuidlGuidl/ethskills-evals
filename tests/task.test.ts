import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { inputSha, loadTaskSpec } from "../lib/task.js";

const SPEC = `skill: skills/fixture
input: |
  do the thing
expect:
  - "it did the thing"
runs: 3
`;

const writeSpec = (body: string) => {
  const dir = mkdtempSync(path.join(tmpdir(), "eval-task-"));
  const specPath = path.join(dir, "fixture-quiz-001.yaml");

  writeFileSync(specPath, body);

  return specPath;
};

test("a spec with no status is live, so every task predating the field stays runnable", () => {
  assert.equal(loadTaskSpec(writeSpec(SPEC)).status, "live");
});

test("status: retired is machine-visible, not prose in notes", () => {
  assert.equal(loadTaskSpec(writeSpec(`${SPEC}status: retired\n`)).status, "retired");
});

test("an unknown status is a typo, not a third state", () => {
  assert.throws(() => loadTaskSpec(writeSpec(`${SPEC}status: archived\n`)), /unknown task status: archived/);
});

test("input_sha tracks the prompt, which is what a regrade has to check", () => {
  const before = loadTaskSpec(writeSpec(SPEC));
  const after = loadTaskSpec(writeSpec(SPEC.replace("do the thing", "diagnose the thing")));

  assert.equal(inputSha(before.input), inputSha(before.input));
  assert.notEqual(inputSha(before.input), inputSha(after.input));
});
