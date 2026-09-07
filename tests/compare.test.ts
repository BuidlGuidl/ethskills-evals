import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { compareEntry, sameRubric, summarize, tally } from "../site/src/lib/compare.js";
import { selectShowcase } from "../lib/showcase.js";
import type { Entry, Index, Run, Skill, Task } from "../site/src/lib/types.js";

const version = (id: string, lines: number, runs: number) => ({
  id,
  sha: id,
  lines,
  words: lines * 5,
  runs,
  in_repo: false,
  text: `# ${id}\n`,
});

const skill: Skill = {
  name: "addresses",
  original: "big",
  latest_measured: "small",
  current: "small",
  versions: [version("big", 547, 6), version("small", 39, 6)],
};

const task = (id: string, kind: "quiz" | "goal"): Task => ({
  id,
  skill: "addresses",
  kind,
  status: "live",
  input: "do it",
  expect: ["a"],
  rubric: null,
  runs: 3,
  template: null,
  notes: null,
});

const tasks = [task("addresses-quiz-001", "quiz"), task("addresses-quiz-002", "quiz")];

let nextRun = 0;
const run = (task: string, content: string | null, rubric: string, pass: boolean): Run => ({
  task,
  skill: "addresses",
  run: `${task}-${content ?? "none"}-${rubric}-${pass}-${nextRun++}`,
  variant: content === null ? "no_skill" : "with_skill",
  executor: "claude",
  executor_model: "claude-opus-5",
  model: "claude-opus-5",
  usage: { tokens: null, duration_s: null, cost_usd: null, turns: null },
  created: "2026-08-19T00:00:00.000Z",
  pass,
  expects: null,
  judge: null,
  skill_version: content,
  skill_content: content,
  regrade_of: null,
  regraded_at: null,
  superseded_by: null,
  retracted: null,
  rubric,
  rubric_expects: 1,
  transcript_url: null,
});

const runs: Run[] = [
  // quiz-001: expects were rewritten with the reduction, so the two skilled columns are
  // not a comparison however they read
  run("addresses-quiz-001", "big", "rubric-old", false),
  run("addresses-quiz-001", "big", "rubric-old", true),
  run("addresses-quiz-001", "small", "rubric-new", true),
  run("addresses-quiz-001", "small", "rubric-new", true),
  run("addresses-quiz-001", null, "rubric-new", true),
  // quiz-002: same expects on both sides
  run("addresses-quiz-002", "big", "rubric-kept", true),
  run("addresses-quiz-002", "small", "rubric-kept", false),
  run("addresses-quiz-002", null, "rubric-kept", true),
];

const entry: Entry = { skill: skill.name, model: "claude-opus-5", before: "big", after: "small" };
const index: Index = {
  generated: { at: "", commit: null, dirty: false, repo: "" }, showcase: [entry],
  skills: [skill], tasks, runs, reports: [], prs: [], warnings: [],
};

test("ungraded runs are left out of a tally instead of counting as failures", () => {
  const dead = { ...run("addresses-quiz-002", "small", "rubric-kept", false), pass: null };

  assert.deepEqual(tally([dead]), null);
  assert.deepEqual(tally([dead, run("addresses-quiz-002", "small", "rubric-kept", true)]), {
    passed: 1,
    total: 1,
    rubrics: ["rubric-kept"],
  });
});

test("a regrade replaces the run it re-read instead of being counted beside it", () => {
  const source = { ...run("addresses-quiz-002", "small", "rubric-old", false), run: "r1", superseded_by: "r1-regrade-1" };
  const regrade = { ...run("addresses-quiz-002", "small", "rubric-new", true), run: "r1-regrade-1", regrade_of: "r1" };

  assert.deepEqual(tally([source, regrade]), { passed: 1, total: 1, rubrics: ["rubric-new"] });
});

test("a superseded run still counts where its regrade is not in the set", () => {
  const source = { ...run("addresses-quiz-002", "small", "rubric-old", false), run: "r1", superseded_by: "r1-regrade-1" };

  assert.deepEqual(tally([source]), { passed: 0, total: 1, rubrics: ["rubric-old"] });
  const comparison = compareEntry(entry, { ...index, runs: [source] });
  assert.deepEqual(comparison.totals.after, tally([source]));
  assert.equal(comparison.usage.after.runs, 1);
});

test("a run read three times counts once, as its newest reading", () => {
  const source = { ...run("addresses-quiz-002", "small", "rubric-old", false), run: "r1", superseded_by: "r1-regrade-1" };
  const first = {
    ...run("addresses-quiz-002", "small", "rubric-mid", false),
    run: "r1-regrade-1",
    regrade_of: "r1",
    superseded_by: "r1-regrade-2",
  };
  const second = { ...run("addresses-quiz-002", "small", "rubric-new", true), run: "r1-regrade-2", regrade_of: "r1" };

  assert.deepEqual(tally([source, first, second]), { passed: 1, total: 1, rubrics: ["rubric-new"] });
  assert.deepEqual(tally([source, first]), { passed: 0, total: 1, rubrics: ["rubric-mid"] });
});

test("a retracted grade is kept out of every count", () => {
  const retracted = { ...run("addresses-quiz-002", "small", "rubric-kept", false), retracted: "the CLI was killed" };
  const real = run("addresses-quiz-002", "small", "rubric-kept", true);

  assert.deepEqual(tally([retracted, real]), { passed: 1, total: 1, rubrics: ["rubric-kept"] });
  assert.equal(tally([retracted]), null);
});

test("a lineage is keyed by task as well as run, because run ids repeat across tasks", () => {
  // The same timestamp-and-variant run id exists under indexing-quiz-001, -002 and -003. Keyed
  // on the id alone, a run is dropped from a skill-wide tally because a different task happens
  // to contribute a record whose id matches its superseded_by.
  const here = { ...run("addresses-quiz-001", "small", "rubric-new", true), run: "r1", superseded_by: "r1-regrade-1" };
  const elsewhere = { ...run("addresses-quiz-002", "small", "rubric-kept", true), run: "r1-regrade-1" };

  assert.equal(tally([here, elsewhere])?.total, 2, "a namesake in another task must not supersede this run");
});

test("selection removes changed checks before comparison totals and usage", () => {
  const selection = selectShowcase(index, [entry]);
  const selected = { ...index, tasks: index.tasks.filter(task => selection.tasks.includes(task)), runs: index.runs.filter(run => selection.runs.includes(run)) };
  const result = compareEntry(entry, selected);
  assert.deepEqual(result.rows.map(row => row.task), [tasks[1].id]);
  assert.deepEqual(result.totals, { noSkill: result.rows[0].noSkill, before: result.rows[0].before, after: result.rows[0].after });
  assert.equal(result.usage.before.runs, 1);
  assert.equal(result.usage.after.runs, 1);
  assert.equal(result.usage.noSkill.runs, 1);
  const none = selectShowcase({ ...index, tasks: [tasks[0]] }, [entry]);
  assert.deepEqual(none.tasks, []);
  assert.deepEqual(none.runs, []);
});

test("all columns need runs on one known rubric, including every baseline", () => {
  const columns = [[{ rubric: "kept" }], [{ rubric: "kept" }], [{ rubric: "kept" }]];
  assert.equal(sameRubric(columns), true);
  for (let column = 0; column < 3; column++) {
    for (const replacement of [[], [{ rubric: null }], [{ rubric: "other" }], [{ rubric: "kept" }, { rubric: "other" }], [{ rubric: "kept" }, { rubric: null }]]) {
      assert.equal(sameRubric(columns.map((runs, i) => i === column ? replacement : runs)), false);
    }
  }
  assert.equal(sameRubric([]), false);
});

test("entry selection uses the named model and versions, ignoring version order and repo state", () => {
  const excluded = [
    run(tasks[1].id, "other", "rubric-kept", true),
    { ...runs[0], model: "other" }, { ...runs[0], skill: "other" },
    { ...runs[0], variant: null }, { ...runs[0], pass: null },
    { ...runs[0], retracted: "failed harness" }, { ...runs[0], task: "unknown" },
  ];
  assert.deepEqual(compareEntry(entry, { ...index, runs: [...runs, ...excluded] }), compareEntry(entry, index));
  const shuffled = { ...skill, current: "other", versions: [...skill.versions].reverse() };
  const result = compareEntry(entry, { ...index, skills: [shuffled] });
  assert.equal(result.before?.id, "big");
  assert.equal(result.after?.id, "small");
});

test("comparison counts only the newest reading, even when an older reading belongs to another column", () => {
  const source = { ...run(tasks[1].id, "big", "old", false), run: "source", superseded_by: "middle" };
  const middle = { ...source, run: "middle", superseded_by: "last", regrade_of: "source" };
  const last = { ...run(tasks[1].id, "small", "rubric-kept", true), run: "last", regrade_of: "middle" };
  const result = compareEntry(entry, { ...index, runs: [...runs, source, middle, last] });
  assert.equal(result.usage.before.runs, 3);
  assert.equal(result.usage.after.runs, 4);
  assert.equal(result.rows[1].before?.total, 1);
  assert.equal(result.rows[1].after?.total, 2);
});

test("usage takes per-run medians across all rows, preserves zeros and requires complete costs", () => {
  const measured: Run[] = runs.map((run, i) => ({ ...run, usage: { tokens: i * 10, duration_s: i, cost_usd: i, turns: null } }));
  const result = compareEntry(entry, { ...index, runs: measured });
  assert.deepEqual(result.usage, {
    before: { tokens: 10, duration_s: 1, cost_usd: 1, runs: 3, recorded: { tokens: 3, duration_s: 3, cost_usd: 3 } },
    after: { tokens: 30, duration_s: 3, cost_usd: 3, runs: 3, recorded: { tokens: 3, duration_s: 3, cost_usd: 3 } },
    noSkill: { tokens: 55, duration_s: 5.5, cost_usd: 5.5, runs: 2, recorded: { tokens: 2, duration_s: 2, cost_usd: 2 } },
  });
  measured[0].usage = { tokens: null, duration_s: null, cost_usd: null, turns: null };
  const partial = compareEntry(entry, { ...index, runs: measured });
  assert.deepEqual(partial.usage.before, { tokens: 30, duration_s: 3, cost_usd: null, runs: 3, recorded: { tokens: 2, duration_s: 2, cost_usd: 2 } });
  const zero = compareEntry(entry, { ...index, runs: [{ ...runs[0], usage: { tokens: 0, duration_s: 0, cost_usd: 0, turns: 0 } }] });
  assert.deepEqual(zero.usage.before, { tokens: 0, duration_s: 0, cost_usd: 0, runs: 1, recorded: { tokens: 1, duration_s: 1, cost_usd: 1 } });
});

test("summaries follow manifest order, separate models and return versions, totals and usage", () => {
  const other = { ...entry, model: "another-model" };
  const summaries = summarize({ ...index, showcase: [other, entry], runs: [...runs, { ...runs[0], model: other.model }] });
  assert.deepEqual(summaries.map(row => [row.skill, row.model, row.runs]), [[skill.name, other.model, 1], [skill.name, entry.model, 8]]);
  const summary = summaries[1];
  const comparison = compareEntry(entry, index);
  assert.equal(summary.tasks, 2);
  assert.equal(summary.beforeVersion?.lines, 547);
  assert.equal(summary.afterVersion?.lines, 39);
  assert.deepEqual(summary.usage, comparison.usage);
  assert.deepEqual([summary.noSkill, summary.before, summary.after], Object.values(comparison.totals));
  assert.deepEqual(summarize({ ...index, showcase: undefined }), []);
});

test("real showcase entries contain only comparable tasks and their runs", () => {
  // Built here rather than read from site/public/index.json: that file is generated and
  // gitignored, and CI runs the tests before it builds the index.
  const dir = mkdtempSync(path.join(tmpdir(), "showcase-compare-"));
  const out = path.join(dir, "index.json");
  const cache = path.join(dir, "derived.json");
  writeFileSync(cache, readFileSync("site/derived.json", "utf8"));
  execFileSync(process.execPath, ["--import", "tsx", "scripts/build-index.ts", "--no-git", "--no-prs", "--strict", "--out", out, "--cache", cache], { encoding: "utf8" });
  const real: Index = JSON.parse(readFileSync(out, "utf8"));
  assert.equal(real.showcase?.length, 6);
  const results = real.showcase!.map(entry => compareEntry(entry, real));
  assert.deepEqual(results.map((result, i) => [real.showcase![i].skill, result.usage.before.runs, result.usage.after.runs, result.usage.noSkill.runs]), [
    ["addresses", 12, 12, 12], ["l2s", 12, 12, 12], ["protocol", 6, 6, 12],
    ["wallets", 9, 9, 18], ["security", 18, 18, 36], ["orchestration", 9, 9, 12],
  ]);
  assert.deepEqual(results.map(result => result.rows.length), [4, 4, 2, 3, 6, 3]);
  for (const entry of real.showcase!) {
    for (const row of compareEntry(entry, real).rows) {
      const runs = real.runs.filter(run => run.task === row.task && run.model === entry.model);
      assert.ok(sameRubric([runs.filter(run => run.variant === "no_skill"), runs.filter(run => run.skill_content === entry.before), runs.filter(run => run.skill_content === entry.after)]));
    }
  }
  for (const result of results) {
    for (const column of ["noSkill", "before", "after"] as const) {
      assert.equal(result.rows.reduce((sum, row) => sum + (row[column]?.total ?? 0), 0), result.usage[column].runs);
      assert.equal(result.rows.reduce((sum, row) => sum + (row[column]?.total ?? 0), 0), result.totals[column]?.total ?? 0);
    }
  }
  assert.equal(summarize(real).reduce((sum, row) => sum + row.runs, 0), 234);
});
