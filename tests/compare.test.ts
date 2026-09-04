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
  runs: 3,
  template: null,
  notes: null,
});

const tasks = [task("addresses-quiz-001", "quiz"), task("addresses-quiz-002", "quiz")];

const run = (task: string, content: string | null, rubric: string, pass: boolean): Run => ({
  task,
  skill: "addresses",
  run: `${task}-${content ?? "none"}-${rubric}-${pass}-${Math.random()}`,
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
  superseded_by: null,
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

test("a row says so when the two skilled columns were graded on different expect lines", () => {
  const comparison = compareSkill(skill, tasks, runs);
  const [rewritten, kept] = comparison.rows;

  assert.equal(rewritten.task, "addresses-quiz-001");
  assert.equal(rewritten.rubricMoved, true, "rewritten expects must not read as a comparison");
  assert.deepEqual(rewritten.before, { passed: 1, total: 2, rubrics: ["rubric-old"] });
  assert.deepEqual(rewritten.after, { passed: 2, total: 2, rubrics: ["rubric-new"] });

  assert.equal(kept.rubricMoved, false);
  assert.deepEqual(kept.before, { passed: 1, total: 1, rubrics: ["rubric-kept"] });
  assert.deepEqual(kept.after, { passed: 0, total: 1, rubrics: ["rubric-kept"] });
});

test("the unaided column follows the rubric the newest skilled column was graded on", () => {
  const [rewritten] = compareSkill(skill, tasks, runs).rows;

  assert.deepEqual(rewritten.noSkill, { passed: 1, total: 1, rubrics: ["rubric-new"] });
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
  assert.deepEqual(tally([dead, run("addresses-quiz-002", "small", "rubric-kept", true)]), {
    passed: 1,
    total: 1,
    rubrics: ["rubric-kept"],
  });
});

test("shareRubric needs an overlap, not merely two populated cells", () => {
  assert.equal(shareRubric({ passed: 1, total: 1, rubrics: ["a"] }, { passed: 1, total: 1, rubrics: ["b"] }), false);
  assert.equal(shareRubric({ passed: 1, total: 1, rubrics: ["a", "b"] }, { passed: 1, total: 1, rubrics: ["b"] }), true);
  assert.equal(shareRubric(null, { passed: 1, total: 1, rubrics: ["b"] }), false);
});

test("a regrade replaces the run it re-read instead of being counted beside it", () => {
  const source = { ...run("addresses-quiz-002", "small", "rubric-old", false), run: "r1", superseded_by: "r1-regrade-1" };
  const regrade = { ...run("addresses-quiz-002", "small", "rubric-new", true), run: "r1-regrade-1", regrade_of: "r1" };

  assert.deepEqual(tally([source, regrade]), { passed: 1, total: 1, rubrics: ["rubric-new"] });
});

test("a superseded run still counts where its regrade is not in the set", () => {
  const source = { ...run("addresses-quiz-002", "small", "rubric-old", false), run: "r1", superseded_by: "r1-regrade-1" };

  assert.deepEqual(tally([source]), { passed: 0, total: 1, rubrics: ["rubric-old"] });
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

test("totals cover the tasks both versions ran, so the two share a denominator", () => {
  const comparison = compareSkill(skill, tasks, runs);

  assert.deepEqual(comparison.coverage, { counted: 2, total: 2 });
  assert.deepEqual(comparison.totals.before, { passed: 2, total: 3, rubrics: ["rubric-kept", "rubric-old"] });
  assert.deepEqual(comparison.totals.after, { passed: 2, total: 3, rubrics: ["rubric-kept", "rubric-new"] });
});

test("a task only one version ran is left out of the totals, not added to one side", () => {
  const partial = runs.filter(run => !(run.task === "addresses-quiz-002" && run.skill_content === "small"));
  const comparison = compareSkill(skill, tasks, partial);

  // quiz-002 keeps its `before` cell in the table but drops out of the totals: counting it
  // would put a run in the old column with nothing facing it in the new one.
  assert.deepEqual(comparison.coverage, { counted: 1, total: 2 });
  assert.deepEqual(comparison.totals.before, { passed: 1, total: 2, rubrics: ["rubric-old"] });
  assert.deepEqual(comparison.totals.after, { passed: 2, total: 2, rubrics: ["rubric-new"] });
  assert.equal(comparison.rows[1].before?.total, 1, "the row itself still shows what ran");
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
  // to contribute a record whose id matches its superseded_by.
  const here = { ...run("addresses-quiz-001", "small", "rubric-new", true), run: "r1", superseded_by: "r1-regrade-1" };
  const elsewhere = { ...run("addresses-quiz-002", "small", "rubric-kept", true), run: "r1-regrade-1" };

  assert.equal(tally([here, elsewhere])?.total, 2, "a namesake in another task must not supersede this run");
  assert.equal(countRuns([here, elsewhere]), 2);
});

test("counting runs drops superseded readings but keeps ungraded runs", () => {
  const source = { ...run("addresses-quiz-001", "small", "rubric-new", false), run: "r1", superseded_by: "r1-regrade-1" };
  const regrade = { ...run("addresses-quiz-001", "small", "rubric-new", true), run: "r1-regrade-1", regrade_of: "r1" };
  const dead = { ...run("addresses-quiz-002", "small", "rubric-kept", false), run: "r2", pass: null };

  assert.equal(countRuns([source, regrade, dead]), 2, "one run read twice is one run; an ungraded run still ran");
  assert.equal(tally([source, regrade, dead])?.total, 1, "but only the graded reading is tallied");
});
