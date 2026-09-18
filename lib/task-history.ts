import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { inputSha, isRecord } from "./task.js";

// The input a run was given, for a record without `input_sha`: setup has stamped it since
// 2026-08-28, but runs made on older checkouts lack it into September, and a regrade of one
// used to be checked against nothing (#131). The
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

// The record whose evidence a regrade re-reads: `regrade_of` followed to the run that was
// actually executed. A regrade of a pre-field run is written without `input_sha` (grade.ts
// copies the field only when the source has one), so pinning it by its own adding commit
// would read the prompt as of the regrade, not the run. Stops at a missing record or a
// cycle and pins whatever it reached.
const sourceRecord = (root: string, recordPath: string) => {
  const visited = new Set<string>();
  let current = recordPath;

  while (!visited.has(current)) {
    visited.add(current);

    let loaded: unknown;

    try {
      loaded = yaml.load(readFileSync(path.join(root, current), "utf8"));
    } catch {
      break;
    }

    if (!isRecord(loaded) || typeof loaded.regrade_of !== "string") {
      break;
    }

    const next = path.join(path.dirname(path.dirname(current)), loaded.regrade_of, "result.yaml");

    if (!existsSync(path.join(root, next))) {
      break;
    }

    current = next;
  }

  return current;
};

export type PinnedInput = {
  // The record the answer was read for: the run itself, or the source a regrade re-reads.
  record: string;
  // null when git cannot say which commit added the record.
  commit: string | null;
  // null when the commit is unknown, or the task file at that commit holds no readable input.
  sha: string | null;
};

// What a run without `input_sha` was given, with the commit the answer came from so a refusal
// can say where to look, and the record it was read for.
export const pinnedInput = (root: string, recordPath: string, taskId: string): PinnedInput => {
  const record = sourceRecord(root, recordPath);
  const commit = addingCommit(root, record);

  return { record, commit, sha: commit === null ? null : inputShaAt(root, commit, taskId) };
};
