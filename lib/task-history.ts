import { execFileSync } from "node:child_process";
import yaml from "js-yaml";
import { inputSha, isRecord } from "./task.js";

// The input a run was given, for a record that predates `input_sha`: every run before
// 2026-08-28 lacks it, and a regrade of one used to be checked against nothing (#131). The
// answer is read from git the way build-index pins such a run — the task file as of the
// commit that first added the run's record — so verify refuses exactly the regrades the site
// would refuse to table. Only a restamp (skill_version, retracted, benchmark) touches the
// source record; a regrade never does. Do not use the run's `created` against commit dates,
// because a run made on a branch and merged later has dates in the wrong order.

const git = (root: string, args: string[]) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();

const gitOrNull = (root: string, args: string[]) => {
  try {
    return git(root, args);
  } catch {
    return null;
  }
};

// The commit that first added a file, walking merges against their first parent: a record
// that arrived in a merge and nowhere earlier in the graph still resolves. null when the file
// is not committed, or on a shallow clone, where the oldest sighting is wherever the history
// was cut and would pin the run to the wrong revision.
export const addingCommit = (root: string, filePath: string) => {
  if (gitOrNull(root, ["rev-parse", "--is-shallow-repository"]) !== "false") {
    return null;
  }

  const log = gitOrNull(root, ["log", "--no-patch", "--diff-merges=first-parent", "--diff-filter=A", "--format=%H", "--", filePath]);
  const commits = (log ?? "").split("\n").filter(Boolean);

  return commits.length === 0 ? null : commits[commits.length - 1];
};

// sha of a task's `input:` as of a commit; null when the task file is not there or holds no
// input. Lenient on purpose, like build-index's rubricOf: this reads historical revisions,
// which may predate a field loadTaskSpec now demands.
export const inputShaAt = (root: string, commit: string, taskId: string) => {
  const raw = gitOrNull(root, ["show", `${commit}:tasks/${taskId}.yaml`]);

  if (raw === null) {
    return null;
  }

  let loaded: unknown;

  try {
    loaded = yaml.load(raw);
  } catch {
    return null;
  }

  return isRecord(loaded) && typeof loaded.input === "string" ? inputSha(loaded.input) : null;
};

// What a run without `input_sha` was given, with the commit the answer came from so a refusal
// can say where to look. null when git cannot say.
export const pinnedInput = (root: string, recordPath: string, taskId: string) => {
  const commit = addingCommit(root, recordPath);

  if (commit === null) {
    return null;
  }

  const sha = inputShaAt(root, commit, taskId);

  return sha === null ? null : { commit, sha };
};
