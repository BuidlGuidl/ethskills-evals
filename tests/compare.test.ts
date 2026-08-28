import assert from "node:assert/strict";
import test from "node:test";
import { compareSkill, shareRubric, tally } from "../site/src/lib/compare.js";
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

test("a row is comparable only when both skilled columns share a rubric", () => {
  const comparison = compareSkill(skill, tasks, runs);
  const [rewritten, kept] = comparison.rows;

  assert.equal(rewritten.task, "addresses-quiz-001");
  assert.equal(rewritten.comparable, false, "rewritten expects must not read as a comparison");
  assert.deepEqual(rewritten.original, { passed: 1, total: 2, rubrics: ["rubric-old"] });
  assert.deepEqual(rewritten.reduced, { passed: 2, total: 2, rubrics: ["rubric-new"] });

  assert.equal(kept.comparable, true);
  assert.deepEqual(kept.original, { passed: 1, total: 1, rubrics: ["rubric-kept"] });
  assert.deepEqual(kept.reduced, { passed: 0, total: 1, rubrics: ["rubric-kept"] });
});

test("the unaided column follows the rubric the newest skilled column was graded on", () => {
  const [rewritten] = compareSkill(skill, tasks, runs).rows;

  assert.deepEqual(rewritten.noSkill, { passed: 1, total: 1, rubrics: ["rubric-new"] });
});

test("a skill with one version reports nothing measured rather than an empty column", () => {
  const single: Skill = { ...skill, latest_measured: "big", current: "big", versions: [version("big", 547, 6)] };
  const comparison = compareSkill(single, tasks, runs);

  assert.equal(comparison.measured, false);
  assert.equal(comparison.reduced, null);
  assert.ok(comparison.rows.every(row => row.reduced === null));
});

test("a version the repo holds but no run saw is surfaced, not silently shown as zero", () => {
  const edited: Skill = {
    ...skill,
    current: "edited",
    versions: [...skill.versions, version("edited", 39, 0)],
  };

  assert.deepEqual(compareSkill(edited, tasks, runs).unmeasuredInRepo?.id, "edited");
  assert.equal(compareSkill(skill, tasks, runs).unmeasuredInRepo, null);
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
