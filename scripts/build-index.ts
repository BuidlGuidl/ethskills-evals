import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import yaml from "js-yaml";
import { loadShowcase, runModel, runUsage, selectShowcase } from "../lib/showcase.js";
import { orderReadings } from "../lib/readings.js";
import { normalizeSkillText, skillContentId } from "../lib/skill.js";
import { expectSha, isRecord, loadTaskSpec, loadYamlFile, parseArgs, requireString } from "../lib/task.js";

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
// Cache entries are not dropped — a sha that stops resolving keeps the answer that was
// recorded while it still did — but two kinds are corrected on a full clone: a rubric the
// record itself contradicts (it carries the expect_sha it was graded against), and a
// transcript link, which follows the newest commit to touch the file rather than the first.

const ROOT = process.cwd();
const REPO = "BuidlGuidl/ethskills-evals";
const INDEX_ARGS = new Set(["out", "cache", "no-prs", "no-git", "strict", "showcase", "versions"]);
const DEFAULT_OUT = path.join("site", "public", "index.json");
const DEFAULT_CACHE = path.join("site", "derived.json");

// expect_sha is the fingerprint verify writes into a record; it is kept beside the rubric so
// the cache can be checked against the record instead of trusted. Absent on entries resolved
// for runs that predate the field.
type Rubric = { id: string; expects: number; expect_sha?: string };

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
    prs: isRecord(loaded.prs) ? (loaded.prs as Record<string, PullRequest>) : {},
  };
};

const rubricFrom = (input: string, expect: string[]): Rubric => ({
  id: hash([input, ...expect].join("\n\x00\n")),
  expects: expect.length,
  expect_sha: expectSha(expect),
});

// Deliberately lenient, unlike loadTaskSpec: this parses historical revisions of a task,
// and older ones carry fields the spec has since dropped. Only the graded surface is
// read, so a reworded `notes:` does not make two runs incomparable.
const rubricOf = (raw: string): Rubric | null => {
  const loaded = yaml.load(raw);

  if (!isRecord(loaded) || typeof loaded.input !== "string" || !Array.isArray(loaded.expect)) {
    return null;
  }

  return rubricFrom(loaded.input, loaded.expect.filter(line => typeof line === "string") as string[]);
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

  // A shallow clone does not answer `git log` with nothing, it answers with plausible wrong
  // things: every file looks added at the boundary commit, so a run would be pinned to the
  // task file as it stands today and cached that way, permanently. History walks are refused
  // there and the cache answers instead; `git show <sha>` still works for a sha the clone has.
  const shallow = gitOrNull("rev-parse", "--is-shallow-repository") === "true";
  const historyAvailable = gitAvailable && !shallow;
  const gitLog = (...logArgs: string[]) => (historyAvailable ? gitOrNull("log", ...logArgs) : null);

  if (shallow) {
    process.stderr.write("note: shallow clone; history lookups are disabled and the cache answers instead\n");
  }

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
        // The rubric as it stands today, so a page can tell which runs were graded on it and
        // which on an earlier revision.
        rubric: rubricFrom(spec.input, spec.expect).id,
      };
    });

  const taskSkill = new Map(tasks.map(task => [task.id, task.skill]));

  // One walk over the artifacts' history answers two questions per file: which commit added
  // it, and which commit last changed it. git log walks newest to oldest, so the last sighting
  // of an addition is the adding commit and the first sighting of a change is the newest.
  // Built once and only if some run has no cached answer.
  let walked: { added: Map<string, string>; touched: Map<string, string> } | null = null;
  const history = () => {
    if (walked === null) {
      walked = { added: new Map(), touched: new Map() };
      // --diff-merges=first-parent because a merge shows no diff by default, and some runs
      // arrive with one: gas-goal-001's regrades exist first in `Merge origin/main into
      // fix/minimal-gas-skill` and nowhere earlier in the reachable graph. Without it those
      // runs have no commit, so their rubric falls back to the task file as it stands and
      // --strict refuses the build. A file added on a branch still resolves to the branch
      // commit, since the walk keeps the oldest sighting.
      // The newest change, though, is taken from ordinary commits only: against its first
      // parent a merge of main shows every file that came across as changed, so a link pinned
      // there would move with each merge and the cache would churn on every branch.
      const log = gitLog("--diff-merges=first-parent", "--format=%x01%H %P", "--name-status", "--", "artifacts");
      let current: string | null = null;
      let merge = false;

      for (const line of (log ?? "").split("\n")) {
        if (line.startsWith("\x01")) {
          const [commit, ...parents] = line.slice(1).trim().split(" ");

          current = commit;
          merge = parents.length > 1;
          continue;
        }

        const fields = line.split("\t");
        const status = fields[0]?.[0];
        const filePath = fields[fields.length - 1];

        if (!current || fields.length < 2 || status === "D") {
          continue;
        }

        if (status === "A") {
          walked.added.set(filePath, current);
        }

        if (!merge && !walked.touched.has(filePath)) {
          walked.touched.set(filePath, current);
        }
      }
    }

    return walked;
  };

  const addingCommit = (filePath: string) => history().added.get(filePath) ?? null;
  // The newest ordinary commit to change the file; a file that only ever arrived in a merge
  // is pinned where it was added.
  const lastCommit = (filePath: string) => history().touched.get(filePath) ?? addingCommit(filePath);

  // Every revision of a task file, newest first, with its rubric. Read only when a record's
  // expect_sha has to be matched against history, which is a handful of regrades.
  const revisionCache = new Map<string, { commit: string; rubric: Rubric | null }[]>();
  const rubricAt = (commit: string, taskId: string) => {
    const raw = gitOrNull("show", `${commit}:tasks/${taskId}.yaml`);

    return raw === null ? null : rubricOf(raw);
  };
  const taskRevisions = (taskId: string) => {
    let revisions = revisionCache.get(taskId);

    if (revisions === undefined) {
      revisions = (gitLog("--format=%H", "--", `tasks/${taskId}.yaml`) ?? "")
        .split("\n")
        .filter(Boolean)
        .map(commit => ({ commit, rubric: rubricAt(commit, taskId) }));
      revisionCache.set(taskId, revisions);
    }

    return revisions;
  };

  // Pinned to the revision the run was graded on, because a task's expect lines get rewritten
  // afterwards and the run was not graded on the rewrite. A record that carries expect_sha
  // names that revision itself and the cache is trusted only when it agrees: pinning by the
  // commit that added the record gave regrade-1 and regrade-2 of every gas-goal-001 run one
  // rubric, since both landed in a merge where the task already held the second rewrite. A
  // record without expect_sha is pinned to the commit that added it. Falling back to the file
  // as it stands is right for a run that is not committed yet and wrong for every other
  // reason the commit could be missing — so the fallback says so, and --strict refuses it.
  // Reading today's expect lines onto an old run is what would make two incomparable columns
  // look like a comparison, which is the one thing this file exists to prevent.
  const rubricFor = (taskId: string, runId: string, recordedSha: string | null) => {
    const key = `${taskId}/${runId}`;
    const cached = derived.run_rubrics[key];

    if (cached && (recordedSha === null || cached.expect_sha === recordedSha)) {
      return { rubric: cached, pinned: true };
    }

    const commit = addingCommit(`artifacts/${taskId}/${runId}/result.yaml`);

    if (recordedSha !== null) {
      // The adding commit first — it is right for every record graded just before it was
      // committed — then anything older the file went through.
      const revisions = taskRevisions(taskId);
      const atAdding = commit === null ? null : rubricAt(commit, taskId);
      const matched =
        atAdding?.expect_sha === recordedSha
          ? atAdding
          : (revisions.find(revision => revision.rubric?.expect_sha === recordedSha)?.rubric ?? null);

      if (matched !== null) {
        derived.run_rubrics[key] = matched;

        return { rubric: matched, pinned: true };
      }

      if (historyAvailable) {
        warnings.push(
          `artifacts/${key}: graded against expect_sha ${recordedSha}, which matches no revision of tasks/${taskId}.yaml`,
        );
      } else if (cached) {
        warnings.push(`artifacts/${key}: cached rubric was not resolved against the record's expect_sha ${recordedSha}`);

        return { rubric: cached, pinned: true };
      }
    }

    const taskPath = path.join(ROOT, "tasks", `${taskId}.yaml`);
    const rubric = commit
      ? rubricAt(commit, taskId)
      : existsSync(taskPath)
        ? rubricOf(readFileSync(taskPath, "utf8"))
        : null;

    if (rubric !== null && commit !== null && recordedSha === null) {
      derived.run_rubrics[key] = rubric;
    }

    return { rubric, pinned: commit !== null };
  };

  // Which text a run saw, cheapest first. A run made since setup started recording it says
  // so itself and needs nothing else; an older one is recovered from `git show <sha>` and the
  // answer cached under the sha, which is the whole reason derived.json is committed.
  // Only recovered answers go in that map. One sha carries two texts whenever a skill is
  // reduced and benchmarked before the commit lands — `skill_version` is the pre-edit HEAD for
  // both runs — so a recorded id written there would contradict the git answer on every build
  // after, and the map exists for the runs that recorded nothing.
  const contentIdFor = (skill: string, sha: string, recorded: string | null) => {
    if (recorded !== null) {
      return recorded;
    }

    const key = `${skill}@${sha}`;
    const cached = derived.skill_versions[key];

    if (cached) {
      return cached;
    }

    const raw = gitOrNull("show", `${sha}:skills/${skill}/SKILL.md`);

    if (raw === null) {
      return null;
    }

    const id = skillContentId(raw);

    derived.skill_versions[key] = id;
    derived.skill_texts[id] = normalizeSkillText(raw);

    return id;
  };

  const skillHistory = new Map<string, string[]>();
  const skillCommits = (skill: string) => {
    let commits = skillHistory.get(skill);

    if (commits === undefined) {
      commits = (gitLog("--format=%H", "--", `skills/${skill}/SKILL.md`) ?? "").split("\n").filter(Boolean);
      skillHistory.set(skill, commits);
    }

    return commits;
  };

  // The id alone is not enough — the site puts the two texts side by side. A run made on the
  // file as it stands needs no history at all; only an older version has to come from git.
  //
  // Whatever the source, the text is stored only under the id it actually hashes to. `sha` is
  // the repo's HEAD at setup and the id is the file that was installed, so the two disagree
  // exactly when a skill was reduced, benchmarked, and edited again before the index was
  // built — and the version would have gone on to show the original's text under the reduced
  // version's name, permanently, since nothing here is ever rewritten. In that case the text
  // is in neither place but in a commit that touched the file, so those are walked last.
  const textFor = (skill: string, id: string, sha: string) => {
    if (derived.skill_texts[id]) {
      return derived.skill_texts[id];
    }

    const keep = (candidate: string | null) => {
      if (candidate === null) {
        return null;
      }

      const text = normalizeSkillText(candidate);

      if (skillContentId(text) !== id) {
        return null;
      }

      derived.skill_texts[id] = text;

      return text;
    };

    const currentPath = path.join(ROOT, "skills", skill, "SKILL.md");
    const nearby =
      keep(existsSync(currentPath) ? readFileSync(currentPath, "utf8") : null) ??
      keep(gitOrNull("show", `${sha}:skills/${skill}/SKILL.md`));

    if (nearby !== null) {
      return nearby;
    }

    for (const commit of skillCommits(skill)) {
      const text = keep(gitOrNull("show", `${commit}:skills/${skill}/SKILL.md`));

      if (text !== null) {
        return text;
      }
    }

    return null;
  };

  type IndexRun = {
    task: string;
    skill: string | null;
    run: string;
    variant: unknown;
    executor: unknown;
    executor_model: unknown;
    model: string;
    usage: ReturnType<typeof runUsage>;
    created: string | null;
    pass: boolean | null;
    expects: unknown;
    judge: unknown;
    skill_version: string | null;
    skill_content: string | null;
    regrade_of: string | null;
    regraded_at: string | null;
    superseded_by: string | null;
    retracted: string | null;
    rubric: string | null;
    rubric_expects: number | null;
    transcript_url: string | null;
  };

  const runs: IndexRun[] = [];
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
      const { rubric, pinned } = rubricFor(taskId, runId, typeof loaded.expect_sha === "string" ? loaded.expect_sha : null);

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

        skillContent = contentIdFor(skill, skillVersion, recorded);

        if (skillContent === null) {
          warnings.push(`${runDir}: skills/${skill}/SKILL.md unreachable at ${skillVersion} and not cached`);
        } else if (textFor(skill, skillContent, skillVersion) === null) {
          warnings.push(`${runDir}: run records skill version ${skillContent}, but its SKILL.md text is neither cached nor reachable`);
        } else {
          const key = `${skill}:${skillContent}`;
          const entry = seen.get(key);
          const created = typeof loaded.created === "string" ? loaded.created : "";

          if (entry) {
            entry.first = created < entry.first ? created : entry.first;
          } else {
            seen.set(key, { skill, id: skillContent, sha: skillVersion, first: created, runs: 0 });
          }
        }
      }

      // Only where the transcript was actually committed, and at the newest commit to touch
      // it: the link used to be built from the run record's commit for every run, so the ones
      // whose transcript was never pushed — every concepts-goal-001 run, for instance — 404'd,
      // and pinning to the adding commit instead left every orchestration run pointing at the
      // six-line stub that was committed before the transcripts were rebuilt. On a full clone
      // the answer is refreshed; without history the cache stands.
      const commitKey = `${taskId}/${runId}`;
      const touched = lastCommit(`${runDir}/transcript.md`);
      const commit = touched ?? derived.run_transcripts[commitKey] ?? null;

      if (touched !== null) {
        derived.run_transcripts[commitKey] = touched;
      }

      const transcriptPath = path.join(ROOT, runDir, "transcript.md");
      const transcript = existsSync(transcriptPath) ? readFileSync(transcriptPath, "utf8") : "";

      runs.push({
        task: taskId,
        skill,
        run: runId,
        variant: loaded.variant ?? null,
        executor: loaded.executor ?? null,
        executor_model: loaded.executor_model ?? null,
        model: runModel(loaded),
        usage: runUsage(transcript, loaded.usage),
        created: typeof loaded.created === "string" ? loaded.created : null,
        pass: typeof loaded.pass === "boolean" ? loaded.pass : null,
        expects: loaded.expects ?? null,
        judge: loaded.judge ?? null,
        skill_version: skillVersion,
        skill_content: skillContent,
        regrade_of: typeof loaded.regrade_of === "string" ? loaded.regrade_of : null,
        regraded_at: typeof loaded.regraded_at === "string" ? loaded.regraded_at : null,
        superseded_by: null,
        // A grade that measured the harness rather than the model — a killed CLI, a
        // deliverable that never reached the judge. The record stays, the tallies leave it out.
        retracted: typeof loaded.retracted === "string" ? loaded.retracted : null,
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
  const readings = orderReadings(runs);

  warnings.push(...readings.warnings);

  for (const lineage of readings.lineages) {
    // Regrades have no executor transcript: wallets-quiz-006's newest readings would lose
    // the cost of their original runs. Usage belongs to that run, not to its later judge.
    for (const reading of lineage.slice(1)) {
      reading.usage = lineage[0].usage;
    }

    for (let position = 0; position < lineage.length - 1; position++) {
      lineage[position].superseded_by = lineage[position + 1].run;
    }
  }

  // Runs, not records: a version's count is read beside tables that count a regraded run
  // once, and it breaks the tie when two versions could be the after column.
  for (const run of runs) {
    if (run.skill !== null && run.skill_content !== null && run.superseded_by === null) {
      const entry = seen.get(`${run.skill}:${run.skill_content}`);

      if (entry) {
        entry.runs += 1;
      }
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
    const currentId = currentText === null ? null : skillContentId(currentText);

    if (currentText !== null && currentId !== null && !versions.some(entry => entry.id === currentId)) {
      // A clean tree holds what HEAD holds, on the deploy host as much as here, so this needs
      // no cache — and caching it made every skill edit that no run had seen fail the
      // "cache is up to date" check with a message about runs.
      versions.push({
        skill: name,
        id: currentId,
        sha: !dirty && head !== null ? head.slice(0, 7) : "worktree",
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

  // Titles name their skill in every shape people write: `eval: gas (claude)`, `skill:
  // minimize tools from eval findings`, `fix: reduce gas skill to ...`, `Skill/standards
  // minimal`, `building-blocks-quiz-001: grade ...`. Any token that is a skill name, or a
  // task id of one, counts. Matching only `<verb>: <skill>` left the rewrite PRs — the ones a
  // skill page exists to link under "why it changed" — attributed to nothing. The body is not
  // read: a harness PR cites eval reports without being about their skill.
  const skillOf = (pr: PullRequest) => {
    for (const token of pr.title.toLowerCase().split(/[^a-z0-9-]+/)) {
      if (skillNames.has(token)) {
        return token;
      }

      const task = /^([a-z0-9-]+)-(goal|quiz)-\d+$/.exec(token);

      if (task && skillNames.has(task[1])) {
        return task[1];
      }
    }

    return null;
  };

  const prs = Object.values(derived.prs)
    .sort((a, b) => a.number - b.number)
    .map(pr => ({
      ...pr,
      skill: skillOf(pr),
      reports: [...new Set([...pr.body.matchAll(/reports\/([a-z0-9.-]+\.md)/g)].map(match => match[1]))],
    }));

  const index = {
    generated: { at: new Date().toISOString(), commit: head, dirty, repo: REPO },
    skills,
    tasks,
    runs,
    reports,
    prs,
    warnings,
  };

  const merged: Derived = {
    skill_texts: sortKeys(derived.skill_texts),
    skill_versions: sortKeys(derived.skill_versions),
    run_rubrics: sortKeys(derived.run_rubrics),
    run_transcripts: sortKeys(derived.run_transcripts),
    prs: sortKeys(derived.prs),
  };
  const changed = JSON.stringify(merged) !== before;

  if (changed) {
    await mkdir(path.dirname(cachePath), { recursive: true });
    await writeFile(cachePath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  }

  if (args.versions !== undefined) {
    process.stderr.write("Known skill versions (before showcase selection; runs include all models and task statuses):\n");
    process.stderr.write("Skill\tVersion id\tLines\tRuns\n");
    for (const skill of skills) {
      for (const version of skill.versions) {
        process.stderr.write(`${skill.name}\t${version.id}\t${version.lines}\t${version.runs}\n`);
      }
    }
  }

  // Filter only after all facts have been resolved and cached, including excluded runs.
  const showcasePath = path.resolve(ROOT, args.showcase === undefined ? "site/showcase.json" : requireString(args.showcase, "--showcase"));
  const entries = loadShowcase(showcasePath);
  const selected = entries === null ? null : selectShowcase(index, entries);

  if (selected !== null) {
    warnings.push(...selected.warnings);
  }

  const { notes, warnings: _, ...selection } = selected ?? { notes: [] };
  for (const note of notes) {
    process.stderr.write(`${note}\n`);
  }
  const output = { ...index, ...selection, warnings };

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

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

  const ungraded = output.runs.filter(run => run.pass === null).length;

  process.stdout.write(
    `wrote ${path.relative(ROOT, outPath)} — ${output.skills.length} skills, ${output.tasks.length} tasks, ${output.runs.length} runs` +
      `${ungraded > 0 ? ` (${ungraded} ungraded)` : ""}, ${output.reports.length} reports, ${output.prs.length} pull requests\n` +
      `${changed ? `updated ${path.relative(ROOT, cachePath)} — commit it: the site builds from this cache, not from git\n` : ""}`,
  );
};

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
