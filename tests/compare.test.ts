import assert from "node:assert/strict";
import test from "node:test";
import { compareSkill, countRuns, shareRubric, tally } from "../site/src/lib/compare.js";
import type { Run, Skill, Task } from "../site/src/lib/types.js";

// The site's only load-bearing computation: whether an original-vs-reduced cell is a
// measurement or two numbers that were graded by different rules. Fixtures mirror
// skills/addresses, where quiz-002's expects were untouched across the reduction and
// quiz-001's were rewritten — reports/addresses-minimal-2026-08-19.md marks the second
// '‡' by hand and this is what replaces that hand.

const version = (id: string, lines: number, runs: number) => ({
  id,
  sha: id,
  lines,
  words: lines * 5,
  runs,
  in_repo: false,
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
  prompt: null,
  runs: 3,
  template: null,
  notes: null,
});

const tasks = [task("addresses-quiz-001", "quiz"), task("addresses-quiz-002", "quiz")];

const run = (task: string, content: string | null, rubric: string, pass: boolean): Run => {
  const id = `${task}-${content ?? "none"}-${rubric}-${pass}-${Math.random()}`;

  return {
    task,
    skill: "addresses",
    run: id,
    variant: content === null ? "no_skill" : "with_skill",
    executor: "claude",
    executor_model: "claude-opus-5",
    created: "2026-08-19T00:00:00.000Z",
    pass,
    expects: null,
    judge: null,
    skill_version: content,
    skill_content: content,
    regrade_of: null,
    regraded_at: null,
    superseded_by: null,
    lineage: id,
    reading: 0,
    retracted: null,
    rubric,
    prompt: "prompt-1",
    rubric_expects: 1,
    transcript_url: null,
  };
};

// The n-th reading of one run: the source at 0, then each regrade in order.
const reading = (base: Run, n: number, rubric: string, pass: boolean, last: boolean): Run => ({
  ...base,
  run: n === 0 ? base.run : `${base.run}-regrade-${n}`,
  regrade_of: n === 0 ? null : base.run,
  superseded_by: last ? null : `${base.run}-regrade-${n + 1}`,
  lineage: base.run,
  reading: n,
  rubric,
  pass,
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

const cell = (passed: number, total: number, rubrics: string[], prompts = ["prompt-1"], models = ["claude-opus-5"]) => ({
  passed,
  total,
  rubrics,
  prompts,
  models,
});

test("a row says so when the two skilled columns were graded on different expect lines", () => {
  const comparison = compareSkill(skill, tasks, runs);
  const [rewritten, kept] = comparison.rows;

  assert.equal(rewritten.task, "addresses-quiz-001");
  assert.equal(rewritten.rubricMoved, true, "rewritten expects must not read as a comparison");
  assert.deepEqual(rewritten.before, cell(1, 2, ["rubric-old"]));
  assert.deepEqual(rewritten.after, cell(2, 2, ["rubric-new"]));

  assert.equal(kept.rubricMoved, false);
  assert.deepEqual(kept.before, cell(1, 1, ["rubric-kept"]));
  assert.deepEqual(kept.after, cell(0, 1, ["rubric-kept"]));
});

test("the unaided column follows the rubric the newest skilled column was graded on", () => {
  const [rewritten] = compareSkill(skill, tasks, runs).rows;

  assert.deepEqual(rewritten.noSkill, cell(1, 1, ["rubric-new"]));
});

test("a skill measured at one version gets no after column rather than an empty one", () => {
  const single: Skill = { ...skill, latest_measured: "big", current: "big", versions: [version("big", 547, 6)] };
  const comparison = compareSkill(single, tasks, runs);

  assert.equal(comparison.after, null);
  assert.equal(comparison.before?.id, "big");
  assert.ok(comparison.rows.every(row => row.after === null));
});

test("a repo edited after its benchmark is flagged, not shown as a column of zeroes", () => {
  const edited: Skill = {
    ...skill,
    current: "edited",
    versions: [...skill.versions, version("edited", 39, 0)],
  };
  const comparison = compareSkill(edited, tasks, runs);

  assert.equal(comparison.editedAfterBenchmark, true);
  assert.equal(comparison.current?.id, "edited");
  assert.equal(comparison.after?.id, "small", "the after column stays on the version that was measured");
  assert.equal(compareSkill(skill, tasks, runs).editedAfterBenchmark, false);
});

test("measured versions between the two columns are surfaced, not dropped in silence", () => {
  const many: Skill = {
    ...skill,
    versions: [version("big", 547, 6), version("mid", 120, 6), version("small", 39, 6)],
  };
  const comparison = compareSkill(many, tasks, runs);

  assert.equal(comparison.before?.id, "big");
  assert.equal(comparison.after?.id, "small");
  assert.deepEqual(comparison.between.map(entry => entry.id), ["mid"]);
});

test("ungraded runs are left out of a tally instead of counting as failures", () => {
  const dead = { ...run("addresses-quiz-002", "small", "rubric-kept", false), pass: null };

  assert.deepEqual(tally([dead]), null);
  assert.deepEqual(tally([dead, run("addresses-quiz-002", "small", "rubric-kept", true)]), cell(1, 1, ["rubric-kept"]));
});

test("shareRubric needs an overlap, not merely two populated cells", () => {
  assert.equal(shareRubric(cell(1, 1, ["a"]), cell(1, 1, ["b"])), false);
  assert.equal(shareRubric(cell(1, 1, ["a", "b"]), cell(1, 1, ["b"])), true);
  assert.equal(shareRubric(null, cell(1, 1, ["b"])), false);
});

test("a regrade replaces the run it re-read instead of being counted beside it", () => {
  const base = run("addresses-quiz-002", "small", "rubric-old", false);
  const source = reading(base, 0, "rubric-old", false, false);
  const regrade = reading(base, 1, "rubric-new", true, true);

  assert.deepEqual(tally([source, regrade]), cell(1, 1, ["rubric-new"]));
});

test("a superseded run still counts where its regrade is not in the set", () => {
  const source = reading(run("addresses-quiz-002", "small", "rubric-old", false), 0, "rubric-old", false, false);

  assert.deepEqual(tally([source]), cell(0, 1, ["rubric-old"]));
});

test("a run read three times counts once, as its newest reading", () => {
  const base = run("addresses-quiz-002", "small", "rubric-old", false);
  const source = reading(base, 0, "rubric-old", false, false);
  const first = reading(base, 1, "rubric-mid", false, false);
  const second = reading(base, 2, "rubric-new", true, true);

  assert.deepEqual(tally([source, first, second]), cell(1, 1, ["rubric-new"]));
  assert.deepEqual(tally([source, first]), cell(0, 1, ["rubric-mid"]));
});

test("a column filtered to one rubric keeps the newest reading it holds, however many hops apart", () => {
  // Source graded on X, re-read on Y, re-read again on X: a column of X holds the first and
  // the third and must count the run once — following superseded_by one hop would count both.
  const base = run("addresses-quiz-002", "small", "rubric-x", false);
  const source = reading(base, 0, "rubric-x", false, false);
  const middle = reading(base, 1, "rubric-y", false, false);
  const latest = reading(base, 2, "rubric-x", true, true);
  const onX = [source, middle, latest].filter(entry => entry.rubric === "rubric-x");

  assert.deepEqual(tally(onX), cell(1, 1, ["rubric-x"]));
  assert.equal(countRuns(onX), 1);
});

test("totals cover the rows that are a comparison, so the columns share a denominator and a rubric", () => {
  const comparison = compareSkill(skill, tasks, runs);
  const [rewritten, kept] = comparison.rows;

  // quiz-001's expects moved between the two versions: its cells stay in the table, marked,
  // and out of the totals — adding them in would sum two different measurements.
  assert.equal(rewritten.counted, false);
  assert.equal(kept.counted, true);
  assert.deepEqual(comparison.coverage, { counted: 1, total: 2 });
  assert.deepEqual(comparison.totals.noSkill, cell(1, 1, ["rubric-kept"]));
  assert.deepEqual(comparison.totals.before, cell(1, 1, ["rubric-kept"]));
  assert.deepEqual(comparison.totals.after, cell(0, 1, ["rubric-kept"]));
  assert.equal(comparison.comparable, true);
});

// quiz-001 graded on one rubric on both sides, so the only thing that can leave a row out is
// what each test below introduces.
const steady = runs.map(run => (run.task === "addresses-quiz-001" ? { ...run, rubric: "rubric-new" } : run));

test("a task only one version ran is left out of the totals, not added to one side", () => {
  const partial = steady.filter(run => !(run.task === "addresses-quiz-002" && run.skill_content === "small"));
  const comparison = compareSkill(skill, tasks, partial);

  // quiz-002 keeps its `before` cell in the table but drops out of the totals: counting it
  // would put a run in the old column with nothing facing it in the new one.
  assert.deepEqual(comparison.coverage, { counted: 1, total: 2 });
  assert.deepEqual(comparison.totals.before, cell(1, 2, ["rubric-new"]));
  assert.deepEqual(comparison.totals.after, cell(2, 2, ["rubric-new"]));
  assert.equal(comparison.rows[1].before?.total, 1, "the row itself still shows what ran");
});

test("when every shared row moved its rubric, the totals are each version's own and say so", () => {
  const onlyMoved = runs.filter(run => run.task === "addresses-quiz-001");
  const comparison = compareSkill(skill, tasks, onlyMoved);

  assert.equal(comparison.comparable, false);
  assert.equal(comparison.sharedRows, 1, "the versions share the task; the rubric is what moved");
  assert.deepEqual(comparison.totals.before, cell(1, 2, ["rubric-old"]));
});

test("a reworded prompt is its own kind of moved, and leaves the row out of the totals", () => {
  const reworded = steady.map(run =>
    run.task === "addresses-quiz-002" && run.skill_content === "small" ? { ...run, prompt: "prompt-2" } : run,
  );
  const [, kept] = compareSkill(skill, tasks, reworded).rows;

  assert.equal(kept.rubricMoved, false, "the expect lines did not move");
  assert.equal(kept.promptMoved, true);
  assert.equal(kept.counted, false);
});

test("a change of model is marked on the row and does not leave it out", () => {
  // skills/gas: before is three claude runs, after is three codex runs. The gap is not the
  // skill's alone, and the reader has to be told — but excluding it would empty the skill.
  const crossStack = steady.map(run =>
    run.skill_content === "small" ? { ...run, executor: "codex", executor_model: "gpt-5.6-terra" } : run,
  );
  const comparison = compareSkill(skill, tasks, crossStack);
  const [, kept] = comparison.rows;

  assert.equal(kept.modelMoved, true);
  assert.equal(kept.counted, true);
  assert.deepEqual(kept.after?.models, ["gpt-5.6-terra"]);
  assert.equal(kept.unaidedModels, true, "the unaided runs are on the older model, not the after column's");
  assert.ok(comparison.rows.every(row => !row.modelMoved || row.before?.models.join() === "claude-opus-5"));
});

test("an unrecorded model is not known to equal a recorded one", () => {
  const unrecorded = steady.map(run => (run.skill_content === "big" ? { ...run, executor_model: null } : run));
  const [, kept] = compareSkill(skill, tasks, unrecorded).rows;

  assert.deepEqual(kept.before?.models, ["claude (model unrecorded)"]);
  assert.equal(kept.modelMoved, true);
});

test("unaided runs graded on no rubric the skilled column saw are shown, flagged, and left out", () => {
  const offRubric = steady.map(run =>
    run.task === "addresses-quiz-002" && run.variant === "no_skill" ? { ...run, rubric: "rubric-other" } : run,
  );
  const [, kept] = compareSkill(skill, tasks, offRubric).rows;

  assert.deepEqual(kept.noSkill, cell(1, 1, ["rubric-other"]), "shown rather than an empty cell");
  assert.equal(kept.unaidedOffRubric, true);
  assert.equal(kept.counted, false);
  assert.equal(kept.rubricMoved, false, "the skilled cells still compare with each other");
});

test("a cell that pools two rubrics is a raw count and stays out of the totals", () => {
  // before on {kept, other}, after on {kept}: any-overlap says they share a rubric, but the
  // before number is two measurements added up and cannot face a single one.
  const pooled = [...steady, run("addresses-quiz-002", "big", "rubric-other", true)];
  const [, kept] = compareSkill(skill, tasks, pooled).rows;

  assert.deepEqual(kept.before?.rubrics, ["rubric-kept", "rubric-other"]);
  assert.equal(kept.rubricMoved, false);
  assert.equal(kept.counted, false);
});

test("a retired task keeps its row, and is neither counted nor in the denominator", () => {
  const retired = [tasks[0], { ...tasks[1], status: "retired" as const }];
  const neverRerun = steady.filter(run => !(run.task === "addresses-quiz-002" && run.skill_content === "small"));
  const comparison = compareSkill(skill, retired, neverRerun);

  assert.equal(comparison.rows[1].retired, true);
  assert.equal(comparison.rows[1].before?.total, 1, "what the older version scored is still shown");
  assert.equal(comparison.rows[1].counted, false);
  assert.deepEqual(comparison.coverage, { counted: 1, total: 1 }, "the newer version was never asked to run it");
});

test("a retracted grade is kept out of every count", () => {
  const retracted = { ...run("addresses-quiz-002", "small", "rubric-kept", false), retracted: "the CLI was killed" };
  const real = run("addresses-quiz-002", "small", "rubric-kept", true);

  assert.deepEqual(tally([retracted, real]), cell(1, 1, ["rubric-kept"]));
  assert.equal(countRuns([retracted, real]), 1);
  assert.equal(tally([retracted]), null);
});

test("the after column is the version that shipped, not the widest-covering intermediate", () => {
  // skills/tools: an intermediate covers every task, but a later version is what the repo
  // holds. The column has to be the one that shipped or the page describes a version nobody has.
  const withIntermediate: Skill = {
    ...skill,
    current: "shipped",
    versions: [version("big", 547, 6), version("wide", 60, 6), version("shipped", 44, 6)],
  };

  assert.equal(compareSkill(withIntermediate, tasks, runs).after?.id, "shipped");
});

test("a partial re-run does not displace the version that was benchmarked in full", () => {
  // skills/standards: the newest measured version ran one task of three. Facing the original
  // with that single row would throw away the full benchmark sitting right behind it.
  const three = [...tasks, task("addresses-quiz-003", "quiz")];
  const full = [
    ...runs,
    run("addresses-quiz-003", "big", "rubric-kept", true),
    run("addresses-quiz-003", "small", "rubric-kept", true),
    run("addresses-quiz-001", "touched", "rubric-new", true),
  ];
  const versions: Skill = {
    ...skill,
    current: "edited",
    versions: [version("big", 547, 6), version("small", 39, 6), version("touched", 39, 1)],
  };

  assert.equal(compareSkill(versions, three, full).after?.id, "small", "one task of three is not the after column");
  assert.equal(
    compareSkill({ ...versions, current: "touched" }, three, full).after?.id,
    "touched",
    "unless that is the version the repo actually holds",
  );
});

test("a lineage is keyed by task as well as run, because run ids repeat across tasks", () => {
  // The same timestamp-and-variant run id exists under indexing-quiz-001, -002 and -003. Keyed
  // on the id alone, a run is dropped from a skill-wide tally because a different task happens
  // to contribute a record with the same lineage and a later reading.
  const here = { ...run("addresses-quiz-001", "small", "rubric-new", true), run: "r1", lineage: "r1", reading: 0 };
  const elsewhere = { ...run("addresses-quiz-002", "small", "rubric-kept", true), run: "r1-regrade-1", lineage: "r1", reading: 1 };

  assert.equal(tally([here, elsewhere])?.total, 2, "a namesake in another task must not supersede this run");
  assert.equal(countRuns([here, elsewhere]), 2);
});

test("counting runs drops superseded readings but keeps ungraded runs", () => {
  const base = run("addresses-quiz-001", "small", "rubric-new", false);
  const source = reading(base, 0, "rubric-new", false, false);
  const regrade = reading(base, 1, "rubric-new", true, true);
  const dead = { ...run("addresses-quiz-002", "small", "rubric-kept", false), pass: null };

  assert.equal(countRuns([source, regrade, dead]), 2, "one run read twice is one run; an ungraded run still ran");
  assert.equal(tally([source, regrade, dead])?.total, 1, "but only the graded reading is tallied");
});
