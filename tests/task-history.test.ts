import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { addingCommit, inputShaAt, pinnedInput } from "../lib/task-history.js";
import { inputSha } from "../lib/task.js";

// A repo with the history #131 describes: a task, runs of it committed, then the task's
// input reworded. The runs predate input_sha, so what they were given is only in git.
const TASK = "gas-quiz-003";
const RUN = "2026-08-28T002825Z-codex-with-skill-1";
const OLD_INPUT = "Estimate the fee.\n";
const NEW_INPUT = "We're committed to the Ethereum ecosystem. Estimate the fee.\n";

const spec = (input: string) => `skill: skills/gas\ninput: |\n  ${input.trim()}\nexpect:\n  - a fee\nruns: 3\n`;

const roots: string[] = [];

after(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
});

// Without the user's git config: commit.gpgsign or a hooks path there would break the commits.
const gitIn = (root: string) => (...args: string[]) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "t",
      GIT_AUTHOR_EMAIL: "t@t",
      GIT_COMMITTER_NAME: "t",
      GIT_COMMITTER_EMAIL: "t@t",
    },
  }).trim();

const repo = () => {
  const root = mkdtempSync(path.join(tmpdir(), "eval-history-"));

  roots.push(root);

  const git = gitIn(root);
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

  return { root, git, commit, taskCommit, runCommit, rewordCommit, touchCommit };
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

  assert.deepEqual(pinnedInput(root, RECORD, TASK), { record: RECORD, commit: runCommit, sha: inputSha(OLD_INPUT) });
});

test("a regrade without input_sha is pinned by the run it re-reads, not by its own adding commit", () => {
  const { root, commit, runCommit } = repo();
  const first = `${RUN}-regrade-1`;
  const second = `${RUN}-regrade-1-regrade-1`;

  // Both regrades are committed after the rewording, so their own adding commits hold the
  // new prompt; grade.ts copies input_sha only when the source has one, so neither carries it.
  for (const [id, of] of [[first, RUN], [second, first]] as const) {
    mkdirSync(path.join(root, "artifacts", TASK, id), { recursive: true });
    writeFileSync(path.join(root, "artifacts", TASK, id, "result.yaml"), `task: ${TASK}\nrun: ${id}\npass: true\nregrade_of: ${of}\n`);
    commit(`regrade ${id}`);
  }

  assert.deepEqual(pinnedInput(root, `artifacts/${TASK}/${second}/result.yaml`, TASK), { record: RECORD, commit: runCommit, sha: inputSha(OLD_INPUT) });
});

test("a record whose task file cannot be read at the adding commit names the commit and no sha", () => {
  const { root, commit, runCommit } = repo();
  const other = `${RUN.slice(0, -1)}2`;

  // A run of a task that has no committed spec: the commit is known, the input is not.
  mkdirSync(path.join(root, "artifacts", "orphan-task", other), { recursive: true });
  writeFileSync(path.join(root, "artifacts", "orphan-task", other, "result.yaml"), `task: orphan-task\nrun: ${other}\npass: true\n`);
  const orphanCommit = commit("orphan run");

  assert.deepEqual(pinnedInput(root, `artifacts/orphan-task/${other}/result.yaml`, "orphan-task"), {
    record: `artifacts/orphan-task/${other}/result.yaml`,
    commit: orphanCommit,
    sha: null,
  });
  assert.equal(runCommit === orphanCommit, false);
});

test("verify refuses a legacy run on a reworded prompt without writing a regrade", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const runDir = `artifacts/${TASK}/${RUN}`;

  assert.throws(() => execFileSync("yarn", [
    "verify", "--run", runDir, "--regrade", "--reason", "refusal test", "--judge-effort", "medium",
  ], { cwd: root, encoding: "utf8", stdio: "pipe" }), (error: unknown) => {
    const { status, stderr } = error as { status: number; stderr: string };

    assert.equal(typeof status, "number");
    assert.notEqual(status, 0);
    assert.match(stderr, /5d91d1221c11 -> 98f2b05df610/);
    assert.match(stderr, /at 3b10b174/);

    return true;
  });
  assert.equal(existsSync(path.join(root, `${runDir}-regrade-1`)), false);
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
  assert.deepEqual(pinnedInput(root, `artifacts/${TASK}/${other}/result.yaml`, TASK), {
    record: `artifacts/${TASK}/${other}/result.yaml`,
    commit: sideCommit,
    sha: inputSha(OLD_INPUT),
  });
});
