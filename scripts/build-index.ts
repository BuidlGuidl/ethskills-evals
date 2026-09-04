import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import yaml from "js-yaml";
import { normalizeSkillText, skillContentId } from "../lib/skill.js";
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
const INDEX_ARGS = new Set(["out", "cache", "no-prs", "no-git", "strict"]);
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
  run_transcripts: Record<string, string>;
  skill_commits: Record<string, string>;
  prs: Record<string, PullRequest>;
};

const git = (...args: string[]) =>
  execFileSync("git", ["-C", ROOT, ...args], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    // captured, not inherited: a lookup that misses is an answer here, not something to print
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

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
  run_transcripts: {},
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
    run_transcripts: isRecord(loaded.run_transcripts) ? (loaded.run_transcripts as Record<string, string>) : {},
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
        status: spec.status,
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
  const addingCommit = (filePath: string) => {
    if (addedCache === null) {
      addedCache = new Map();
      // --diff-merges=first-parent because a merge shows no diff by default, and some runs
      // arrive with one: gas-goal-001's regrades exist first in `Merge origin/main into
      // fix/minimal-gas-skill` and nowhere earlier in the reachable graph. Without it those
      // runs have no commit, so their rubric falls back to the task file as it stands and
      // --strict refuses the build. A file added on a branch still resolves to the branch
      // commit, since the walk keeps the oldest sighting.
      const log = gitOrNull(
        "log",
        "--diff-filter=A",
        "--diff-merges=first-parent",
        "--format=%x01%H",
        "--name-only",
        "--",
        "artifacts",
      );
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

    return addedCache.get(filePath) ?? null;
  };

  // Pinned to the commit that recorded the run, because a task's expect lines get rewritten
  // afterwards and the run was not graded on the rewrite. Falling back to the file as it
  // stands is right for a run that is not committed yet and wrong for every other reason
  // the commit could be missing — so the fallback says so, and --strict refuses it. Reading
  // today's expect lines onto an old run is what would make two incomparable columns look
  // like a comparison, which is the one thing this file exists to prevent.
  const rubricFor = (taskId: string, runId: string) => {
    const key = `${taskId}/${runId}`;
    const cached = derived.run_rubrics[key];

    if (cached) {
      return { rubric: cached, pinned: true };
    }

    const commit = addingCommit(`artifacts/${taskId}/${runId}/result.yaml`);
    const taskPath = path.join(ROOT, "tasks", `${taskId}.yaml`);
    const raw = commit
      ? gitOrNull("show", `${commit}:tasks/${taskId}.yaml`)
      : existsSync(taskPath)
        ? readFileSync(taskPath, "utf8")
        : null;
    const rubric = raw === null ? null : rubricOf(raw);

    if (rubric !== null && commit !== null) {
      derived.run_rubrics[key] = rubric;
    }

    return { rubric, pinned: commit !== null };
  };

  // Three ways to learn which text a run saw, cheapest first. Runs made since setup started
  // recording it say so themselves and need nothing else; older ones are recovered from git
  // and cached, which is the whole reason derived.json is committed.
  // One sha can carry two different SKILL.md texts: the documented workflow reduces the file
  // and benchmarks it before committing, so `skill_version` stays at the pre-edit HEAD for
  // both runs. A mapping that quietly took the last writer would attribute every older run at
  // that sha to the wrong text on any later --no-git build, so a disagreement drops the entry
  // instead: ambiguous is recoverable, wrong is not.
  const poisoned = new Set<string>();

  const rememberVersion = (key: string, id: string, where: string) => {
    if (poisoned.has(key)) {
      return;
    }

    const known = derived.skill_versions[key];

    if (known !== undefined && known !== id) {
      poisoned.add(key);
      delete derived.skill_versions[key];
      warnings.push(
        `${where}: ${key} maps to two different SKILL.md texts (${known} and ${id}); dropping the mapping, ` +
          `runs at that sha without a recorded skill_content cannot be resolved from the cache`,
      );

      return;
    }

    derived.skill_versions[key] = id;
  };

  const contentIdFor = (skill: string, sha: string, recorded: string | null, where: string) => {
    const key = `${skill}@${sha}`;

    if (recorded !== null) {
      rememberVersion(key, recorded, where);

      return recorded;
    }

    const cached = derived.skill_versions[key];

    if (cached) {
      return cached;
    }

    const raw = gitOrNull("show", `${sha}:skills/${skill}/SKILL.md`);

    if (raw === null) {
      return null;
    }

    const id = skillContentId(raw);

    rememberVersion(key, id, where);
    derived.skill_texts[id] = normalizeSkillText(raw);

    return id;
  };

  // The id alone is not enough — the site puts the two texts side by side. A run made on the
  // file as it stands needs no history at all; only an older version has to come from git.
  //
  // Whatever the source, the text is stored only under the id it actually hashes to. `sha` is
  // the repo's HEAD at setup and the id is the file that was installed, so the two disagree
  // exactly when a skill was reduced, benchmarked, and edited again before the index was
  // built — and the version would have gone on to show the original's text under the reduced
  // version's name, permanently, since nothing here is ever rewritten.
  const textFor = (skill: string, id: string, sha: string) => {
    if (derived.skill_texts[id]) {
      return derived.skill_texts[id];
    }

    const currentPath = path.join(ROOT, "skills", skill, "SKILL.md");
    const candidates = [
      existsSync(currentPath) ? readFileSync(currentPath, "utf8") : null,
      gitOrNull("show", `${sha}:skills/${skill}/SKILL.md`),
    ];

    for (const candidate of candidates) {
      if (candidate === null) {
        continue;
      }

      const text = normalizeSkillText(candidate);

      if (skillContentId(text) === id) {
        derived.skill_texts[id] = text;

        return text;
      }
    }

    return null;
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
      const { rubric, pinned } = rubricFor(taskId, runId);

      if (rubric === null) {
        warnings.push(`${runDir}: no readable task rubric; comparisons disabled for this run`);
      } else if (!pinned) {
        warnings.push(
          `${runDir}: rubric read from tasks/${taskId}.yaml as it stands now, not from the revision this run was graded on`,
        );
      }

      let skillContent: string | null = null;

      if (skill && skillVersion) {
        const recorded = typeof loaded.skill_content === "string" ? loaded.skill_content : null;

        skillContent = contentIdFor(skill, skillVersion, recorded, runDir);

        if (skillContent === null) {
          warnings.push(`${runDir}: skills/${skill}/SKILL.md unreachable at ${skillVersion} and not cached`);
        } else if (textFor(skill, skillContent, skillVersion) === null) {
          warnings.push(`${runDir}: run records skill version ${skillContent}, but its SKILL.md text is neither cached nor reachable`);
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

      // Only where the transcript was actually committed: the link used to be built from the
      // run record's commit for every run, and the ones whose transcript was never pushed —
      // every concepts-goal-001 run, for instance — offered a blob link that 404s.
      const commitKey = `${taskId}/${runId}`;
      let commit: string | null = derived.run_transcripts[commitKey] ?? null;

      if (commit === null) {
        // The transcript's own commit, not the run record's: they are often different, and a
        // link pinned to the record's commit 404s on every run whose transcript followed.
        const added = addingCommit(`${runDir}/transcript.md`);

        if (added !== null) {
          commit = added;
          derived.run_transcripts[commitKey] = added;
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
        regrade_of: typeof loaded.regrade_of === "string" ? loaded.regrade_of : null,
        superseded_by: null as string | null,
        rubric: rubric?.id ?? null,
        rubric_expects: rubric?.expects ?? null,
        transcript_url: commit ? `https://github.com/${REPO}/blob/${commit}/${runDir}/transcript.md` : null,
      });
    }
  }

  // A regrade re-judges one run's stored evidence against rewritten expect lines: a second
  // reading, never a second run — and a run can be read more than twice (wallets-quiz-006
  // regrades every run of the task twice). So each record points at the reading that
  // replaced it, source -> regrade-1 -> regrade-2, and a tally drops any record whose
  // successor is in the set. Every reading stays in the index: an older one is still the
  // right answer for the rubric it was graded on.
  // Follow regrade_of all the way down rather than reading a number off the end of the run
  // id: verify allows --regrade on a dir that is itself a regrade, and the resulting
  // `<id>-regrade-1-regrade-1` parses as reading 1, colliding with the run it replaced and
  // keying a lineage of its own — so both readings would land in the same tally.
  const byId = new Map(runs.map(run => [`${String(run.task)}/${String(run.run)}`, run]));

  const chain = (run: Record<string, unknown>) => {
    const seen: Record<string, unknown>[] = [run];
    let cursor = run;

    while (typeof cursor.regrade_of === "string") {
      const parent = byId.get(`${String(cursor.task)}/${cursor.regrade_of}`);

      if (parent === undefined) {
        warnings.push(
          `artifacts/${String(run.task)}/${String(run.run)}: regrade_of names ${String(cursor.regrade_of)}, which is not in the repo`,
        );

        return null;
      }

      if (seen.includes(parent)) {
        warnings.push(`artifacts/${String(run.task)}/${String(run.run)}: regrade_of forms a cycle`);

        return null;
      }

      seen.push(parent);
      cursor = parent;
    }

    return seen;
  };

  const lineages = new Map<string, Record<string, unknown>[]>();
  const depth = new Map<Record<string, unknown>, number>();

  for (const run of runs) {
    const links = chain(run);

    if (links === null) {
      continue;
    }

    const root = links[links.length - 1];
    const key = `${String(root.task)}/${String(root.run)}`;

    depth.set(run, links.length - 1);
    lineages.set(key, [...(lineages.get(key) ?? []), run]);
  }

  const reading = (run: Record<string, unknown>) => depth.get(run) ?? 0;

  for (const lineage of lineages.values()) {
    const ordered = [...lineage].sort((a, b) => reading(a) - reading(b));

    for (let position = 0; position < ordered.length - 1; position++) {
      ordered[position].superseded_by = String(ordered[position + 1].run);
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
    const currentText = existsSync(currentPath) ? normalizeSkillText(readFileSync(currentPath, "utf8")) : null;
    const currentId = currentText === null ? null : hash(currentText);

    if (currentText !== null && currentId !== null && !versions.some(entry => entry.id === currentId)) {
      let sha = derived.skill_commits[currentId] ?? null;

      if (sha === null) {
        const lastTouched = gitOrNull("log", "-1", "--format=%h", "--", `skills/${name}/SKILL.md`);
        const committed = lastTouched ? gitOrNull("show", `${lastTouched}:skills/${name}/SKILL.md`) : null;

        if (lastTouched && committed !== null && normalizeSkillText(committed) === currentText) {
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
      // Not a warning when the cache already holds them: the deploy host has no gh and no
      // token, and --strict there must fail on missing facts, not on an offline build doing
      // exactly what the cache exists for.
      const held = Object.keys(derived.prs).length;

      if (held === 0) {
        warnings.push("no pull request write-ups: github is unreachable and the cache holds none");
      } else {
        process.stderr.write(`note: github unreachable; using the ${held} cached pull request write-ups\n`);
      }
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
    run_transcripts: sortKeys(derived.run_transcripts),
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

  // The deploy build runs --strict. A warning there means a run lost the skill version or the
  // task revision it was measured against, and the site would quietly drop it from a column
  // instead of showing a wrong number — a green deploy hiding a hole. Fail where someone
  // is looking.
  if (args.strict !== undefined && warnings.length > 0) {
    process.stderr.write(
      `\n${warnings.length} unresolved fact(s). Run \`yarn build-index\` on a full clone and commit ` +
        `${path.relative(ROOT, cachePath)}; history that is not cached is not available to the deploy build.\n`,
    );
    process.exit(1);
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
