import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { addingCommit, inputShaAt, pinnedInput } from "../lib/task-history.js";
import { inputSha } from "../lib/task.js";

// A repo with the history #131 describes: a task, runs of it committed, then the task's
// input reworded. The runs predate input_sha, so what they were given is only in git.
const TASK = "gas-quiz-003";
const RUN = "2026-08-28T002825Z-codex-with-skill-1";
const OLD_INPUT = "Estimate the fee.\n";
const NEW_INPUT = "We're committed to the Ethereum ecosystem. Estimate the fee.\n";

const spec = (input: string) => `skill: skills/gas\ninput: |\n  ${input.trim()}\nexpect:\n  - a fee\nruns: 3\n`;

const repo = () => {
  const root = mkdtempSync(path.join(tmpdir(), "eval-history-"));
  const git = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" },
    }).trim();
  const commit = (message: string) => {
    git("add", "-A");
    git("commit", "-q", "-m", message);

    return git("rev-parse", "HEAD");
  };

  git("init", "-q", "-b", "main");
  mkdirSync(path.join(root, "tasks"));
  writeFileSync(path.join(root, "tasks", `${TASK}.yaml`), spec(OLD_INPUT));
  const taskCommit = commit("task");

  mkdirSync(path.join(root, "artifacts", TASK, RUN), { recursive: true });
  writeFileSync(path.join(root, "artifacts", TASK, RUN, "result.yaml"), `task: ${TASK}\nrun: ${RUN}\npass: true\n`);
  const runCommit = commit("runs");

  writeFileSync(path.join(root, "tasks", `${TASK}.yaml`), spec(NEW_INPUT));
  const rewordCommit = commit("reword");

  // A later touch of the record — a restamp — must not move the pin.
  writeFileSync(path.join(root, "artifacts", TASK, RUN, "result.yaml"), `task: ${TASK}\nrun: ${RUN}\npass: true\nretracted: no\n`);
  const touchCommit = commit("restamp");

  return { root, git, taskCommit, runCommit, rewordCommit, touchCommit };
};

const RECORD = `artifacts/${TASK}/${RUN}/result.yaml`;

test("the adding commit is the first one to hold the record, not the last to touch it", () => {
  const { root, runCommit } = repo();

  assert.equal(addingCommit(root, RECORD), runCommit);
  assert.equal(addingCommit(root, "artifacts/never/committed/result.yaml"), null);
});

test("the input as of a commit is the one that revision held", () => {
  const { root, taskCommit, runCommit, rewordCommit } = repo();

  assert.equal(inputShaAt(root, taskCommit, TASK), inputSha(OLD_INPUT));
  assert.equal(inputShaAt(root, runCommit, TASK), inputSha(OLD_INPUT));
  assert.equal(inputShaAt(root, rewordCommit, TASK), inputSha(NEW_INPUT));
  assert.equal(inputShaAt(root, rewordCommit, "no-such-task"), null);
});

test("a run recorded before the rewording is pinned to the old prompt", () => {
  const { root, runCommit } = repo();

  assert.deepEqual(pinnedInput(root, RECORD, TASK), { commit: runCommit, sha: inputSha(OLD_INPUT) });
  assert.notEqual(pinnedInput(root, RECORD, TASK)?.sha, inputSha(NEW_INPUT));
});

test("a record from a merged branch is pinned to the branch commit that added it, which held the old prompt", () => {
  const { root, git } = repo();
  const other = `${RUN.slice(0, -1)}2`;

  git("checkout", "-q", "-b", "side", "HEAD~2");
  mkdirSync(path.join(root, "artifacts", TASK, other), { recursive: true });
  writeFileSync(path.join(root, "artifacts", TASK, other, "result.yaml"), `task: ${TASK}\nrun: ${other}\npass: false\n`);
  git("add", "-A");
  git("commit", "-q", "-m", "side run");
  const sideCommit = git("rev-parse", "HEAD");

  git("checkout", "-q", "main");
  git("merge", "-q", "--no-ff", "-m", "merge side", "side");

  // The oldest sighting, as build-index walks it: the branch commit, where the task still
  // held the old prompt — not the merge, whose tree holds the rewording.
  assert.deepEqual(pinnedInput(root, `artifacts/${TASK}/${other}/result.yaml`, TASK), { commit: sideCommit, sha: inputSha(OLD_INPUT) });
});
