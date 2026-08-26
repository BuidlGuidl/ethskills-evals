import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { cp, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { GENERATED_DIRS, SKILL_INSTALL_DIRS, WORKSPACE_MANIFEST } from "./workspace.js";

const SKIP_DIRS = new Set([...SKILL_INSTALL_DIRS, ...GENERATED_DIRS]);
const MAX_SNAPSHOT_FILE_BYTES = 256 * 1024;

const git = (workspacePath: string, args: string[], context: string) => {
  try {
    return execFileSync("git", ["-C", workspacePath, ...args], { encoding: "utf8" });
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr ?? "";

    throw new Error(`${context}: git ${args.join(" ")} failed\n${stderr.trim()}`);
  }
};

export const walkFiles = async (dir: string) => {
  const entries: string[] = [];
  const pending = [dir];

  while (pending.length > 0) {
    const current = pending.pop() as string;
    const childNames = await readdir(current, { withFileTypes: true });

    for (const child of childNames) {
      const fullPath = path.join(current, child.name);

      if (child.isDirectory()) {
        if (!SKIP_DIRS.has(child.name)) {
          pending.push(fullPath);
        }
      } else if (child.isFile()) {
        entries.push(fullPath);
      }
    }
  }

  return entries;
};

// A bare :(exclude)<dir> only matches at the workspace root, while walkFiles skips by
// directory name at any depth, so each dir needs the glob form too or a nested
// packages/app/node_modules reaches the judge.
const excludePathspec = (dir: string) => [`:(exclude)${dir}`, `:(exclude,glob)**/${dir}/**`];

// git will not diff through a repo the run created inside the workspace, and create-eth
// git-inits unconditionally. With a commit in it the whole scaffold collapses to one
// gitlink line; without one `git add -N` aborts ("does not have a commit checked out").
// Both reach the judge as an empty run, so stop here instead of grading nothing.
const assertNoNestedRepo = (workspacePath: string, nested: string[]) => {
  if (nested.length === 0) {
    return;
  }

  throw new Error(
    `nested git repo in the workspace: ${nested.join(", ")}. git cannot diff through it, so the evidence would be empty. `
      + `Diff that repo from its own first commit, or re-run the task without a scaffolder that git-inits.`,
  );
};

const nestedRepoDirs = (workspacePath: string, status: string) =>
  status
    .split("\n")
    .filter(line => line.startsWith("?? "))
    .map(line => line.slice(3).trim().replace(/\/$/, ""))
    .filter(entry => entry.length > 0 && existsSync(path.join(workspacePath, entry, ".git")));

export const writeDiff = async (workspacePath: string, diffPath: string, baselineSha: string) => {
  const pathspec = [".", ...[...SKILL_INSTALL_DIRS, ...GENERATED_DIRS].flatMap(excludePathspec)];

  // Untracked dirs are still collapsed to one entry here, so this is where a scaffolded
  // repo is cheapest to spot — and `git add -N` below would abort on it anyway.
  assertNoNestedRepo(
    workspacePath,
    nestedRepoDirs(workspacePath, git(workspacePath, ["status", "--porcelain", "--", ...pathspec], "evidence")),
  );

  // Intent-to-add so new (untracked) files show their content in the diff, not just a
  // filename in status — the judge needs to see files the run created. Untracked files are
  // not gitignored by default, and a repo the run created itself carries whatever .gitignore
  // its scaffolder wrote (foundry's omits node_modules), so the pathspec is what actually
  // keeps the installed skill and generated trees out of the judge's evidence.
  //
  // The add takes a bare "." rather than that pathspec: exclusion magic makes git enumerate
  // ignored entries and exit 1 ("paths are ignored by one of your .gitignore files") the
  // moment an installed node_modules sits at the workspace root, while a bare "." skips
  // ignored trees silently. Evidence is the diff and status output below, and both keep the
  // exclusions, so the extra intent-to-add entries never reach the judge.
  git(workspacePath, ["add", "-N", "--", "."], "evidence");
  // Against the baseline commit, not the index: an executor that commits its own work
  // leaves a clean worktree, and a plain `git diff` would call that an empty run.
  const diff = git(workspacePath, ["diff", baselineSha, "--", ...pathspec], "evidence");
  const status = git(workspacePath, ["status", "--porcelain", "--", ...pathspec], "evidence");

  // The pre-check misses a nested repo the executor already committed: the worktree is
  // clean and the tree carries a gitlink instead.
  assertNoNestedRepo(
    workspacePath,
    diff.split("\n").filter(line => line.endsWith("mode 160000")).map(line => line.trim()),
  );

  const content = `${diff}${diff.endsWith("\n") || diff.length === 0 ? "" : "\n"}\n# Untracked files and status\n${status}`;

  await writeFile(diffPath, content);
};

export const snapshotOutput = async (workspacePath: string, outputPath: string) => {
  await rm(outputPath, { recursive: true, force: true });

  for (const file of await walkFiles(workspacePath)) {
    const relativePath = path.relative(workspacePath, file);
    const segments = relativePath.split(path.sep);

    if (relativePath === "TASK.md" || segments.some(segment => SKIP_DIRS.has(segment))) {
      continue;
    }

    // The manifest setup drops in to anchor the tooling walk is not something the run
    // produced. Matched by content so a package.json the run wrote still reaches the judge.
    if (relativePath === "package.json" && readFileSync(file, "utf8") === WORKSPACE_MANIFEST) {
      continue;
    }

    // Backstop: a scaffold leaves big generated source too (lockfiles, bundled releases).
    // Grading reads answer/source files; anything this large is not that.
    if ((await stat(file)).size > MAX_SNAPSHOT_FILE_BYTES) {
      continue;
    }

    // Skip binary assets (favicons, fonts, images). The judge reads evidence as text, and a
    // NUL byte breaks the prompt arg; nothing gradeable lives in a binary anyway.
    if (readFileSync(file).includes(0)) {
      continue;
    }

    const target = path.join(outputPath, relativePath);

    await mkdir(path.dirname(target), { recursive: true });
    await cp(file, target);
  }
};

export const buildEvidence = async (runDir: string) => {
  const sections: string[] = [];
  const diffPath = path.join(runDir, "run.diff");
  const outputPath = path.join(runDir, "output");

  if (existsSync(diffPath)) {
    sections.push(["# run.diff", readFileSync(diffPath, "utf8")].join("\n"));
  }

  if (existsSync(outputPath)) {
    for (const file of await walkFiles(outputPath)) {
      const relativePath = path.relative(outputPath, file);

      sections.push([`# output/${relativePath}`, readFileSync(file, "utf8")].join("\n"));
    }
  }

  return sections.join("\n\n");
};
