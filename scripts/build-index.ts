import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import yaml from "js-yaml";
import { isRecord, loadTaskSpec, loadYamlFile, parseArgs, requireString } from "../lib/task.js";

// Builds the json the results site reads: site/public/index.json, one file, regenerated
// from the repo in a single pass and gitignored.
//
// Two of the three tables it feeds need facts that are in no record:
//
//   - which SKILL.md a run actually saw. result.yaml carries skill_version, but that is
//     `git rev-parse --short HEAD` at setup time — repo state, not a version of the
//     skill. Many shas map to one unchanged file, and a reduction shares its sha with
//     whatever else landed that day. The file itself is `git show <sha>:skills/<n>/SKILL.md`,
//     so versions here are keyed by the hash of that text.
//   - whether two runs may be compared. Task `expect:` lines get rewritten between
//     benchmarks, and a pass count graded against a different rubric is not a
//     measurement — reports/addresses-minimal-2026-08-19.md marks those cells '‡' by
//     hand. Each run carries the rubric hash of its task as of the commit that recorded
//     the run, so the site can refuse the comparison instead of remembering to footnote it.
//
// Both come out of git history, and git history is not a durable place to keep them.
// Some skill_version shas live only on a PR branch; once it is squash-merged and deleted
// the text is gone, and a build host clones one branch shallowly and never had it at all.
// So each fact, once resolved, is written to site/derived.json and committed. Resolution
// happens here, on a full clone; the deploy build reads the cache and needs no git.
//
// Cache entries are never dropped, only added — a sha that stops resolving keeps the
// answer that was recorded while it still did.

const ROOT = process.cwd();
const REPO = "BuidlGuidl/ethskills-evals";
const INDEX_ARGS = new Set(["out", "cache", "no-prs", "no-git"]);
const DEFAULT_OUT = path.join("site", "public", "index.json");
const DEFAULT_CACHE = path.join("site", "derived.json");

type Rubric = { id: string; expects: number };

type PullRequest = {
  number: number;
  title: string;
  body: string;
  url: string;
  merged_at: string | null;
  state: string;
};

type Derived = {
  skill_texts: Record<string, string>;
  skill_versions: Record<string, string>;
  run_rubrics: Record<string, Rubric>;
  run_commits: Record<string, string>;
  skill_commits: Record<string, string>;
  prs: Record<string, PullRequest>;
};

const git = (...args: string[]) =>
  execFileSync("git", ["-C", ROOT, ...args], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }).trim();

// --no-git makes every lookup miss, which is what a deploy host's shallow single-branch
// clone looks like. Run it before shipping: if the output still matches, the cache is
// complete and the build does not depend on history it will not have.
let gitAvailable = true;

const gitOrNull = (...args: string[]) => {
  if (!gitAvailable) {
    return null;
  }

  try {
    return git(...args);
  } catch {
    return null;
  }
};

// An eval PR's description carries the write-up — the same tables plus the reasoning and
// the skill defects found — and for some benchmarks it is the only one; reports/ was not
// always written. It lives on github, not in the repo, so it is cached like everything
// else here and the deploy build never calls out to anything.
const fetchPullRequests = (): PullRequest[] | null => {
  try {
    const raw = execFileSync(
      "gh",
      ["pr", "list", "--repo", REPO, "--state", "all", "--limit", "300", "--json", "number,title,body,url,mergedAt,state"],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed.filter(isRecord).map(pr => ({
      number: Number(pr.number),
      title: String(pr.title ?? ""),
      body: String(pr.body ?? ""),
      url: String(pr.url ?? ""),
      merged_at: typeof pr.mergedAt === "string" ? pr.mergedAt : null,
      state: String(pr.state ?? ""),
    }));
  } catch {
    return null;
  }
};

const hash = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 12);

// git output arrives trimmed and a file on disk does not, so the same SKILL.md hashed
// from both sides came out as two versions differing by one newline.
const normalizeSkill = (text: string) => `${text.replace(/\s+$/, "")}\n`;

const countLines = (text: string) => text.replace(/\n$/, "").split("\n").length;
const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length;

const sortKeys = <T,>(record: Record<string, T>) =>
  Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));

const listDirs = (dir: string) =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .sort()
    : [];

const emptyDerived = (): Derived => ({
  skill_texts: {},
  skill_versions: {},
  run_rubrics: {},
  run_commits: {},
  skill_commits: {},
  prs: {},
});

const loadDerived = (cachePath: string): Derived => {
  if (!existsSync(cachePath)) {
    return emptyDerived();
  }

  const loaded: unknown = JSON.parse(readFileSync(cachePath, "utf8"));

  if (!isRecord(loaded)) {
    throw new Error(`${cachePath} must be a json object`);
  }

  return {
    skill_texts: isRecord(loaded.skill_texts) ? (loaded.skill_texts as Record<string, string>) : {},
    skill_versions: isRecord(loaded.skill_versions) ? (loaded.skill_versions as Record<string, string>) : {},
    run_rubrics: isRecord(loaded.run_rubrics) ? (loaded.run_rubrics as Record<string, Rubric>) : {},
    run_commits: isRecord(loaded.run_commits) ? (loaded.run_commits as Record<string, string>) : {},
    skill_commits: isRecord(loaded.skill_commits) ? (loaded.skill_commits as Record<string, string>) : {},
    prs: isRecord(loaded.prs) ? (loaded.prs as Record<string, PullRequest>) : {},
  };
};

// Deliberately lenient, unlike loadTaskSpec: this parses historical revisions of a task,
// and older ones carry fields the spec has since dropped. Only the graded surface is
// read, so a reworded `notes:` does not make two runs incomparable.
const rubricOf = (raw: string): Rubric | null => {
  const loaded = yaml.load(raw);

  if (!isRecord(loaded) || typeof loaded.input !== "string" || !Array.isArray(loaded.expect)) {
    return null;
  }

  const expect = loaded.expect.filter(line => typeof line === "string") as string[];

  return { id: hash([loaded.input, ...expect].join("\n\x00\n")), expects: expect.length };
};

const main = async () => {
  const args = parseArgs(INDEX_ARGS);
  const outPath = path.resolve(ROOT, args.out === undefined ? DEFAULT_OUT : requireString(args.out, "--out"));
  const cachePath = path.resolve(ROOT, args.cache === undefined ? DEFAULT_CACHE : requireString(args.cache, "--cache"));

  gitAvailable = args["no-git"] === undefined;

  const derived = loadDerived(cachePath);
  const before = JSON.stringify(derived);
  const warnings: string[] = [];

  const head = gitOrNull("rev-parse", "HEAD") ?? process.env.VERCEL_GIT_COMMIT_SHA ?? null;
  const dirty = (gitOrNull("status", "--porcelain") ?? "").length > 0;

  const tasks = readdirSync(path.join(ROOT, "tasks"))
    .filter(name => name.endsWith(".yaml"))
    .sort()
    .map(name => {
      const spec = loadTaskSpec(path.join(ROOT, "tasks", name));

      return {
        id: spec.id,
        skill: spec.skill.replace(/^skills\//, ""),
        kind: spec.id.includes("-goal-") ? "goal" : "quiz",
        input: spec.input,
        expect: spec.expect,
        runs: spec.runs,
        template: spec.template ?? null,
        notes: spec.notes ?? null,
      };
    });

  const taskSkill = new Map(tasks.map(task => [task.id, task.skill]));

  // git log walks newest to oldest, so the last commit seen to add a path is the one that
  // added it. Built once and only if some run has no cached rubric — on a shallow clone
  // this returns nothing useful, which is exactly when the cache has to answer instead.
  let addedCache: Map<string, string> | null = null;
  const addingCommit = (runDir: string) => {
    if (addedCache === null) {
      addedCache = new Map();
      const log = gitOrNull("log", "--diff-filter=A", "--format=%x01%H", "--name-only", "--", "artifacts");
      let current: string | null = null;

      for (const line of (log ?? "").split("\n")) {
        if (line.startsWith("\x01")) {
          current = line.slice(1).trim();
          continue;
        }

        if (line.length > 0 && current) {
          addedCache.set(line, current);
        }
      }
    }

    return addedCache.get(`${runDir}/result.yaml`) ?? null;
  };

  const rubricFor = (taskId: string, runId: string) => {
    const key = `${taskId}/${runId}`;
    const cached = derived.run_rubrics[key];

    if (cached) {
      return cached;
    }

    const commit = addingCommit(`artifacts/${taskId}/${runId}`);
    const taskPath = path.join(ROOT, "tasks", `${taskId}.yaml`);
    const raw = commit
      ? gitOrNull("show", `${commit}:tasks/${taskId}.yaml`)
      : existsSync(taskPath)
        ? readFileSync(taskPath, "utf8")
        : null;
    const rubric = raw === null ? null : rubricOf(raw);

    if (rubric) {
      derived.run_rubrics[key] = rubric;
    }

    return rubric;
  };

  const skillContentFor = (skill: string, sha: string) => {
    const key = `${skill}@${sha}`;
    const cached = derived.skill_versions[key];

    if (cached && derived.skill_texts[cached]) {
      return cached;
    }

    const raw = gitOrNull("show", `${sha}:skills/${skill}/SKILL.md`);

    if (raw === null) {
      return null;
    }

    const text = normalizeSkill(raw);
    const id = hash(text);

    derived.skill_versions[key] = id;
    derived.skill_texts[id] = text;

    return id;
  };

  const runs: Record<string, unknown>[] = [];
  const seen = new Map<string, { skill: string; id: string; sha: string; first: string; runs: number }>();

  for (const taskId of listDirs(path.join(ROOT, "artifacts"))) {
    for (const runId of listDirs(path.join(ROOT, "artifacts", taskId))) {
      const runDir = path.join("artifacts", taskId, runId);
      const resultPath = path.join(ROOT, runDir, "result.yaml");

      if (!existsSync(resultPath)) {
        continue;
      }

      const loaded = loadYamlFile(resultPath);
      const skill = taskSkill.get(taskId) ?? null;
      const skillVersion = typeof loaded.skill_version === "string" ? loaded.skill_version : null;
      const rubric = rubricFor(taskId, runId);

      if (rubric === null) {
        warnings.push(`${runDir}: no readable task rubric; comparisons disabled for this run`);
      }

      let skillContent: string | null = null;

      if (skill && skillVersion) {
        skillContent = skillContentFor(skill, skillVersion);

        if (skillContent === null) {
          warnings.push(`${runDir}: skills/${skill}/SKILL.md unreachable at ${skillVersion} and not cached`);
        } else {
          const key = `${skill}:${skillContent}`;
          const entry = seen.get(key);
          const created = typeof loaded.created === "string" ? loaded.created : "";

          if (entry) {
            entry.runs += 1;
            entry.first = created < entry.first ? created : entry.first;
          } else {
            seen.set(key, { skill, id: skillContent, sha: skillVersion, first: created, runs: 1 });
          }
        }
      }

      const commitKey = `${taskId}/${runId}`;
      let commit = derived.run_commits[commitKey] ?? null;

      if (commit === null) {
        commit = addingCommit(runDir);

        if (commit) {
          derived.run_commits[commitKey] = commit;
        }
      }

      runs.push({
        task: taskId,
        skill,
        run: runId,
        variant: loaded.variant ?? null,
        executor: loaded.executor ?? null,
        executor_model: loaded.executor_model ?? null,
        created: loaded.created ?? null,
        pass: loaded.pass === undefined ? null : Boolean(loaded.pass),
        expects: loaded.expects ?? null,
        judge: loaded.judge ?? null,
        skill_version: skillVersion,
        skill_content: skillContent,
        rubric: rubric?.id ?? null,
        rubric_expects: rubric?.expects ?? null,
        transcript_url: commit ? `https://github.com/${REPO}/blob/${commit}/${runDir}/transcript.md` : null,
      });
    }
  }

  // Ordered oldest first by the runs that used them, with the file as it stands now
  // appended if no run saw it. Three pointers rather than two, because they come apart:
  // skills/addresses was edited on review after its benchmark, so the text a reader
  // should diff (`current`) is not the text the numbers were measured on
  // (`latest_measured`). A table that compares `current` compares a column of zero runs.
  const skills = listDirs(path.join(ROOT, "skills")).map(name => {
    const versions = [...seen.values()]
      .filter(entry => entry.skill === name)
      .sort((a, b) => a.first.localeCompare(b.first))
      .map(entry => ({ ...entry, text: derived.skill_texts[entry.id] ?? "" }));

    const currentPath = path.join(ROOT, "skills", name, "SKILL.md");
    const currentText = existsSync(currentPath) ? normalizeSkill(readFileSync(currentPath, "utf8")) : null;
    const currentId = currentText === null ? null : hash(currentText);

    if (currentText !== null && currentId !== null && !versions.some(entry => entry.id === currentId)) {
      let sha = derived.skill_commits[currentId] ?? null;

      if (sha === null) {
        const lastTouched = gitOrNull("log", "-1", "--format=%h", "--", `skills/${name}/SKILL.md`);
        const committed = lastTouched ? gitOrNull("show", `${lastTouched}:skills/${name}/SKILL.md`) : null;

        if (lastTouched && committed !== null && normalizeSkill(committed) === currentText) {
          sha = lastTouched;
          derived.skill_commits[currentId] = sha;
        }
      }

      versions.push({
        skill: name,
        id: currentId,
        sha: sha ?? "worktree",
        first: "",
        runs: 0,
        text: currentText,
      });
    }

    const measured = versions.filter(entry => entry.runs > 0);

    return {
      name,
      original: measured.length > 0 ? measured[0].id : (versions[0]?.id ?? null),
      latest_measured: measured.length > 0 ? measured[measured.length - 1].id : null,
      current: currentId,
      versions: versions.map(entry => ({
        id: entry.id,
        sha: entry.sha,
        lines: countLines(entry.text),
        words: countWords(entry.text),
        runs: entry.runs,
        in_repo: entry.id === currentId,
        text: entry.text,
      })),
    };
  });

  const reports = readdirSync(path.join(ROOT, "reports"))
    .filter(name => name.endsWith(".md"))
    .sort()
    .map(name => {
      const markdown = readFileSync(path.join(ROOT, "reports", name), "utf8");
      const title = markdown.split("\n").find(line => line.startsWith("# "));
      const date = /(\d{4}-\d{2}-\d{2})\.md$/.exec(name);

      return {
        file: name,
        title: title ? title.slice(2).trim() : name,
        date: date ? date[1] : null,
        skill: date ? name.slice(0, date.index).replace(/-$/, "") : name.replace(/\.md$/, ""),
        url: `https://github.com/${REPO}/blob/main/reports/${name}`,
        markdown,
      };
    });

  if (args["no-prs"] === undefined) {
    const fetched = fetchPullRequests();

    if (fetched === null) {
      warnings.push("could not reach github for pull request write-ups; using whatever the cache already holds");
    } else {
      for (const pr of fetched) {
        derived.prs[String(pr.number)] = pr;
      }
    }
  }

  const skillNames = new Set(skills.map(skill => skill.name));

  const prs = Object.values(derived.prs)
    .sort((a, b) => a.number - b.number)
    .map(pr => {
      const named = /^[a-z]+:\s*([a-z0-9-]+)/.exec(pr.title);
      const mentioned = [...pr.body.matchAll(/reports\/([a-z0-9.-]+\.md)/g)].map(match => match[1]);

      return {
        ...pr,
        skill: named && skillNames.has(named[1]) ? named[1] : null,
        reports: [...new Set(mentioned)],
      };
    });

  const index = {
    generated: { at: new Date().toISOString(), commit: head, dirty, repo: REPO },
    skills,
    tasks,
    runs,
    reports,
    prs,
    warnings,
  };

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");

  const merged: Derived = {
    skill_texts: sortKeys(derived.skill_texts),
    skill_versions: sortKeys(derived.skill_versions),
    run_rubrics: sortKeys(derived.run_rubrics),
    run_commits: sortKeys(derived.run_commits),
    skill_commits: sortKeys(derived.skill_commits),
    prs: sortKeys(derived.prs),
  };
  const changed = JSON.stringify(merged) !== before;

  if (changed) {
    await mkdir(path.dirname(cachePath), { recursive: true });
    await writeFile(cachePath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  }

  for (const warning of warnings) {
    process.stderr.write(`warning: ${warning}\n`);
  }

  const ungraded = runs.filter(run => run.pass === null).length;

  process.stdout.write(
    `wrote ${path.relative(ROOT, outPath)} — ${skills.length} skills, ${tasks.length} tasks, ${runs.length} runs` +
      `${ungraded > 0 ? ` (${ungraded} ungraded)` : ""}, ${reports.length} reports, ${prs.length} pull requests\n` +
      `${changed ? `updated ${path.relative(ROOT, cachePath)} — commit it: the site builds from this cache, not from git\n` : ""}`,
  );
};

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
