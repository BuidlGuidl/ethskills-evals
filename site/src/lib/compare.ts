import type { Index, Run, Skill, SkillVersion, Task } from "./types.js";

// The one place this site can lie. Two pass counts are only a comparison when both were
// graded against the same expect lines, and those get rewritten between benchmarks — the
// hand-written reports mark such cells '‡' and tell the reader not to read them. Every
// cell here carries the rubrics it was tallied from, and a row says outright whether the
// two columns share one.

export type Cell = { passed: number; total: number; rubrics: string[] };

export const tally = (runs: Run[]): Cell | null => {
  // A regrade and the run it re-read are one run read twice. Whenever both are in the set
  // being counted, the newer reading wins; a set holding only the source still counts it,
  // which is what makes a per-rubric column come out right.
  const present = new Set(runs.map(run => run.run));
  const graded = runs.filter(run => run.pass !== null && !(run.superseded_by !== null && present.has(run.superseded_by)));

  if (graded.length === 0) {
    return null;
  }

  return {
    passed: graded.filter(run => run.pass).length,
    total: graded.length,
    rubrics: [...new Set(graded.map(run => run.rubric).filter((id): id is string => id !== null))].sort(),
  };
};

export const shareRubric = (left: Cell | null, right: Cell | null) =>
  left !== null && right !== null && left.rubrics.some(id => right.rubrics.includes(id));

export const versionById = (skill: Skill, id: string | null) =>
  id === null ? null : (skill.versions.find(version => version.id === id) ?? null);

export type ComparisonRow = {
  task: string;
  kind: "quiz" | "goal";
  noSkill: Cell | null;
  original: Cell | null;
  reduced: Cell | null;
  comparable: boolean;
};

export type Comparison = {
  original: SkillVersion | null;
  reduced: SkillVersion | null;
  /** a second version exists and was benchmarked — otherwise the reduced column is "not measured" */
  measured: boolean;
  /** the repo holds a version no run ever saw, so its text is shown but its numbers do not exist */
  unmeasuredInRepo: SkillVersion | null;
  rows: ComparisonRow[];
  totals: { noSkill: Cell | null; original: Cell | null; reduced: Cell | null };
};

export const compareSkill = (skill: Skill, tasks: Task[], runs: Run[]): Comparison => {
  const original = versionById(skill, skill.original);
  const reduced = skill.latest_measured === skill.original ? null : versionById(skill, skill.latest_measured);
  const current = versionById(skill, skill.current);

  const mine = runs.filter(run => run.skill === skill.name);
  const rows: ComparisonRow[] = tasks
    .filter(task => task.skill === skill.name)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(task => {
      const forTask = mine.filter(run => run.task === task.id);
      const originalCell = original === null ? null : tally(forTask.filter(run => run.skill_content === original.id));
      const reducedCell = reduced === null ? null : tally(forTask.filter(run => run.skill_content === reduced.id));

      // the unaided variant was graded on a rubric too; show the runs that share one with
      // the newest skilled column, so the three cells on a row are read against each other
      const target = reducedCell ?? originalCell;
      const unaided = forTask.filter(run => run.variant === "no_skill");
      const matching = target === null ? unaided : unaided.filter(run => run.rubric !== null && target.rubrics.includes(run.rubric));

      return {
        task: task.id,
        kind: task.kind,
        noSkill: tally(matching.length > 0 ? matching : unaided),
        original: originalCell,
        reduced: reducedCell,
        comparable: shareRubric(originalCell, reducedCell),
      };
    });

  const sum = (pick: (row: ComparisonRow) => Cell | null): Cell | null => {
    const cells = rows.map(pick).filter((cell): cell is Cell => cell !== null);

    if (cells.length === 0) {
      return null;
    }

    return {
      passed: cells.reduce((total, cell) => total + cell.passed, 0),
      total: cells.reduce((total, cell) => total + cell.total, 0),
      rubrics: [...new Set(cells.flatMap(cell => cell.rubrics))].sort(),
    };
  };

  return {
    original,
    reduced,
    measured: reduced !== null,
    unmeasuredInRepo: current !== null && current.runs === 0 ? current : null,
    rows,
    totals: { noSkill: sum(row => row.noSkill), original: sum(row => row.original), reduced: sum(row => row.reduced) },
  };
};

export type SkillSummary = {
  name: string;
  tasks: number;
  runs: number;
  noSkill: Cell | null;
  withSkill: Cell | null;
  original: SkillVersion | null;
  reduced: SkillVersion | null;
  measured: boolean;
  unmeasuredInRepo: SkillVersion | null;
};

export const summarize = (index: Index): SkillSummary[] =>
  index.skills.map(skill => {
    const comparison = compareSkill(skill, index.tasks, index.runs);
    const mine = index.runs.filter(run => run.skill === skill.name);

    return {
      name: skill.name,
      tasks: index.tasks.filter(task => task.skill === skill.name).length,
      runs: mine.length,
      noSkill: tally(mine.filter(run => run.variant === "no_skill")),
      withSkill: tally(mine.filter(run => run.variant === "with_skill")),
      original: comparison.original,
      reduced: comparison.reduced,
      measured: comparison.measured,
      unmeasuredInRepo: comparison.unmeasuredInRepo,
    };
  });

export const formatCell = (cell: Cell | null) => (cell === null ? "—" : `${cell.passed}/${cell.total}`);
