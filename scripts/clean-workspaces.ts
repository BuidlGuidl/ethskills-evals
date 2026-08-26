import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { loadYamlFile, parseArgs, requireString } from "../lib/task.js";
import { WORKSPACE_POINTER, workspaceRoot } from "../lib/workspace.js";

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

// Everything setup builds has a TASK.md and a git repo of its own. Requiring both before a
// dir can be deleted keeps a stale or mistyped --root — `.`, a home dir, last month's path —
// from turning this into `rm -rf` over whatever happens to sit two levels under it. A workspace
// that lost either one is left alone on purpose: the sweep is not the only way to reclaim disk.
const isWorkspace = (dir: string) => existsSync(path.join(dir, "TASK.md")) && existsSync(path.join(dir, ".git"));

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
  let workspaces = 0;

  for (const runId of await listDirs(root)) {
    for (const taskId of await listDirs(path.join(root, runId))) {
      const runDir = path.join(ROOT, "artifacts", taskId, runId);
      const workspacePath = path.join(root, runId, taskId);

      if (!isWorkspace(workspacePath)) {
        continue;
      }

      workspaces++;

      if (!existsSync(runDir)) {
        reclaimable.push({ workspacePath, reason: "orphan" });
      } else if (isGraded(runDir)) {
        reclaimable.push({ workspacePath, reason: "graded" });
      }
    }
  }

  return { reclaimable, workspaces };
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

// An empty root is usually the wrong root: a benchmark run under EVAL_WORKSPACE_ROOT leaves
// its workspaces there, and a later shell without the variable sweeps the default one and
// finds nothing. Run dirs that still exist carry a pointer, so they can say where to look —
// the orphans this script is mostly for cannot, which is why the sweep scans a root rather
// than following pointers in the first place.
const pointedAtRoots = async (sweptRoot: string) => {
  const artifacts = path.join(ROOT, "artifacts");

  if (!existsSync(artifacts)) {
    return [];
  }

  const roots = new Set<string>();

  for (const taskId of await listDirs(artifacts)) {
    for (const runId of await listDirs(path.join(artifacts, taskId))) {
      const pointerPath = path.join(artifacts, taskId, runId, WORKSPACE_POINTER);

      if (!existsSync(pointerPath)) {
        continue;
      }

      // The pointer is <root>/<run-id>/<task-id>; the root is what is left above those two.
      const root = path.dirname(path.dirname(readFileSync(pointerPath, "utf8").trim()));

      if (root !== sweptRoot && path.isAbsolute(root) && existsSync(root)) {
        roots.add(root);
      }
    }
  }

  return [...roots].sort();
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

    const { reclaimable, workspaces } = await findReclaimable(root);

    for (const { workspacePath, reason } of reclaimable) {
      console.log(`${remove ? "removing" : reason}  ${workspacePath}  (${diskUsage(workspacePath)})`);

      if (remove) {
        await rm(workspacePath, { recursive: true, force: true });
      }
    }

    if (remove) {
      await pruneEmptyRunDirs(root);
    }

    if (workspaces === 0) {
      // Says what was actually looked at: an empty result here usually means the wrong root,
      // not a tidy one.
      console.log(`nothing to clean: no workspaces under ${root} — nothing there has both a TASK.md and a git repo`);

      for (const pointed of await pointedAtRoots(root)) {
        console.log(`runs under artifacts/ point at ${pointed} — sweep it with --root ${pointed}`);
      }
    } else if (reclaimable.length === 0) {
      console.log(`nothing to clean: all ${workspaces} workspace(s) under ${root} have a run dir, and none of those runs is graded`);
    } else if (!remove) {
      console.log(`\n${reclaimable.length} reclaimable workspace(s) under ${root}; re-run with --delete to remove them`);
    }
  } catch (error) {
    console.error(`clean-workspaces: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
};

await main();
