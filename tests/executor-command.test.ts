import assert from "node:assert/strict";
import test from "node:test";
import { buildCommand } from "../lib/executor-command.js";
import { codexJudgeArgs } from "../lib/judge.js";

// The flags these tests pin are the ones a run cannot recover from silently: without them a
// run fails for a reason that has nothing to do with the skill, and grades as one that does.
test("claude runs with project settings only", () => {
  const { file, args } = buildCommand("claude", "opus-5");

  assert.equal(file, "env");
  assert.ok(args.includes("--setting-sources"));
  assert.equal(args[args.indexOf("--setting-sources") + 1], "project");
  assert.deepEqual(args.slice(args.indexOf("--model"), args.indexOf("--model") + 2), ["--model", "opus-5"]);
});

test("claude omits --model when none is given", () => {
  const { args } = buildCommand("claude", null);

  assert.ok(!args.includes("--model"));
});

test("codex runs with network access and without the operator's shell snapshot", () => {
  const { file, args } = buildCommand("codex", "gpt-5.6-terra");

  assert.equal(file, "codex");
  assert.deepEqual(args.slice(args.indexOf("--disable"), args.indexOf("--disable") + 2), ["--disable", "shell_snapshot"]);
  assert.ok(args.includes("sandbox_workspace_write.network_access=true"));
  assert.deepEqual(args.slice(args.indexOf("-m"), args.indexOf("-m") + 2), ["-m", "gpt-5.6-terra"]);
  assert.equal(args.at(-1), "-", "the prompt goes on stdin, so the last arg is the dash");
});

test("codex omits -m when none is given", () => {
  const { args } = buildCommand("codex", null);

  assert.ok(!args.includes("-m"));
  assert.equal(args.at(-1), "-");
});

// The judge is a second codex invocation and needs the shell-snapshot flag on its own
// account: it was added to the executor on 2026-08-27 and missed here until 2026-09-03,
// where a regrade printed the same snapshot syntax error the executor fix was written for.
test("the codex judge also runs without the operator's shell snapshot", () => {
  const args = codexJudgeArgs("gpt-5.6-terra", "/tmp/last-message.txt");

  assert.deepEqual(args.slice(args.indexOf("--disable"), args.indexOf("--disable") + 2), ["--disable", "shell_snapshot"]);
  assert.ok(args.includes("read-only"), "the judge reads evidence and never edits a workspace");
  assert.equal(args.at(-1), "-");
});
