import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parseArgs } from "../lib/task.js";
import { workspaceRoot } from "../lib/workspace.js";

const ROOT = process.cwd();
const CLEAN_ARGS = new Set(["delete"]);

const listDirs = async (dir: string) => {
  const entries = await readdir(dir, { withFileTypes: true });

  return entries.filter(entry => entry.isDirectory()).map(entry => entry.name);
};

const diskUsage = (dir: string) => {
  const result = spawnSync("du", ["-sh", dir], { encoding: "utf8", stdio: "pipe" });

  return result.status === 0 ? result.stdout.split("\t")[0].trim() : "size unknown";
};

// verify deletes the workspace it grades, and that is the only cleanup in the system. Every
// other ending orphans one: a killed executor leaves `finished: null`, which makes the run
// permanently ungradable, and the documented recovery — AGENTS.md rules 1 and 3, the regrade
// guard's own error text — is to delete the run dir. That deletes workspace.path, the only
// record of where the workspace is. A repo-shaped one is gigabytes. This finds them by the
// inverse lookup: a workspace whose run dir is gone has nothing left that can reach it.
const findOrphans = async (root: string) => {
  const orphans: string[] = [];

  for (const runId of await listDirs(root)) {
    for (const taskId of await listDirs(path.join(root, runId))) {
      if (!existsSync(path.join(ROOT, "artifacts", taskId, runId))) {
        orphans.push(path.join(root, runId, taskId));
      }
    }
  }

  return orphans;
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
    const root = workspaceRoot();

    if (!existsSync(root)) {
      console.log(`nothing to clean: no workspace root at ${root}`);
      return;
    }

    const orphans = await findOrphans(root);

    for (const workspacePath of orphans) {
      console.log(`${remove ? "removing" : "orphan"}  ${workspacePath}  (${diskUsage(workspacePath)})`);

      if (remove) {
        await rm(workspacePath, { recursive: true, force: true });
      }
    }

    if (remove) {
      await pruneEmptyRunDirs(root);
    }

    if (orphans.length === 0) {
      console.log(`nothing to clean: every workspace under ${root} still has a run dir`);
    } else if (!remove) {
      console.log(`\n${orphans.length} orphaned workspace(s) under ${root}; re-run with --delete to remove them`);
    }
  } catch (error) {
    console.error(`clean-workspaces: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
};

await main();
