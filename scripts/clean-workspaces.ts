import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { loadYamlFile, parseArgs, requireString } from "../lib/task.js";
import { workspaceRoot } from "../lib/workspace.js";

const ROOT = process.cwd();
const CLEAN_ARGS = new Set(["delete", "root"]);

const listDirs = async (dir: string) => {
  const entries = await readdir(dir, { withFileTypes: true });

  return entries.filter(entry => entry.isDirectory()).map(entry => entry.name);
};

const diskUsage = (dir: string) => {
  const result = spawnSync("du", ["-sh", dir], { encoding: "utf8", stdio: "pipe" });

  return result.status === 0 ? result.stdout.split("\t")[0].trim() : "size unknown";
};

// A run dir that carries `pass:` has been graded, and a graded workspace is spent by this
// harness's own argument — the evidence is captured and committed, and the regrade guard
// refuses to run it again. It is reclaimable whether verify deleted it or not, which is what
// covers the two paths that deliberately leave one behind: `--keep-workspace`, and the
// never-fatal warn when `rm` fails after the grade is already written.
const isGraded = (runDir: string) => {
  const resultPath = path.join(runDir, "result.yaml");

  if (!existsSync(resultPath)) {
    return false;
  }

  try {
    return Object.prototype.hasOwnProperty.call(loadYamlFile(resultPath), "pass");
  } catch {
    // an unreadable result.yaml is not evidence that the run is done with its workspace
    return false;
  }
};

// verify deletes the workspace it grades, and that is the only cleanup in the system. Every
// other ending leaves one behind: a killed executor leaves `finished: null`, which makes the
// run permanently ungradable, and the documented recovery — AGENTS.md rules 1 and 3, the
// regrade guard's own error text — is to delete the run dir. That deletes workspace.path, the
// only record of where the workspace is. A repo-shaped one is gigabytes.
//
// Two lookups, both from this side: a workspace whose run dir is gone has nothing left that
// can reach it, and one whose run dir is graded has nothing left to do.
//
// `artifacts/` is read from the current checkout, so run this where the runs were made. From
// another worktree the live runs are invisible and their workspaces list as orphans.
const findReclaimable = async (root: string) => {
  const reclaimable: { workspacePath: string; reason: string }[] = [];

  for (const runId of await listDirs(root)) {
    for (const taskId of await listDirs(path.join(root, runId))) {
      const runDir = path.join(ROOT, "artifacts", taskId, runId);
      const workspacePath = path.join(root, runId, taskId);

      if (!existsSync(runDir)) {
        reclaimable.push({ workspacePath, reason: "orphan" });
      } else if (isGraded(runDir)) {
        reclaimable.push({ workspacePath, reason: "graded" });
      }
    }
  }

  return reclaimable;
};

// The run dir above a workspace is left behind when the workspace under it goes, whether
// verify removed it or this script did.
const pruneEmptyRunDirs = async (root: string) => {
  for (const runId of await listDirs(root)) {
    const runRoot = path.join(root, runId);

    if ((await readdir(runRoot)).length === 0) {
      await rm(runRoot, { recursive: true, force: true });
    }
  }
};

const main = async () => {
  try {
    const args = parseArgs(CLEAN_ARGS);
    const remove = args.delete !== undefined;
    // A benchmark run with EVAL_WORKSPACE_ROOT set leaves its orphans under that root, and
    // cleaning up later from a shell that no longer has the variable would report the default
    // root as clean while the gigabytes sit elsewhere. --root says which one to sweep.
    const root = args.root === undefined
      ? workspaceRoot()
      : path.resolve(ROOT, requireString(args.root, "--root"));

    if (!existsSync(root)) {
      console.log(`nothing to clean: no workspace root at ${root}`);
      return;
    }

    const reclaimable = await findReclaimable(root);

    for (const { workspacePath, reason } of reclaimable) {
      console.log(`${remove ? "removing" : reason}  ${workspacePath}  (${diskUsage(workspacePath)})`);

      if (remove) {
        await rm(workspacePath, { recursive: true, force: true });
      }
    }

    if (remove) {
      await pruneEmptyRunDirs(root);
    }

    if (reclaimable.length === 0) {
      console.log(`nothing to clean: every workspace under ${root} belongs to a run that is still going`);
    } else if (!remove) {
      console.log(`\n${reclaimable.length} reclaimable workspace(s) under ${root}; re-run with --delete to remove them`);
    }
  } catch (error) {
    console.error(`clean-workspaces: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
};

await main();
