import type { Index, Run, Skill, SkillVersion, Task } from "./types.js";

// Where the site decides what may be set next to what. Two pass counts are a comparison
// only when both were graded against the same expect lines, and those get rewritten between
// benchmarks — the hand-written reports mark such cells '‡' and tell the reader not to read
// them. Every cell carries the rubrics it was tallied from so a row can say when they moved.

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

export type Row = {
  task: string;
  kind: "quiz" | "goal";
  noSkill: Cell | null;
  before: Cell | null;
  after: Cell | null;
  /** the two skilled cells were graded against different expect lines, so they are not a comparison */
  rubricMoved: boolean;
};

export type SkillComparison = {
  /** the first version anyone measured — the vendored file, for every skill so far */
  before: SkillVersion | null;
  /** the newest measured version; null when only one was ever benchmarked */
  after: SkillVersion | null;
  /** what the repo holds today, which is not always what was measured */
  current: SkillVersion | null;
  /** the repo was edited after the benchmark, so `current` carries no numbers of its own */
  editedAfterBenchmark: boolean;
  /** measured versions between before and after — real runs that no column shows */
  between: SkillVersion[];
  rows: Row[];
  totals: { noSkill: Cell | null; before: Cell | null; after: Cell | null };
};

export const compareSkill = (skill: Skill, tasks: Task[], runs: Run[]): SkillComparison => {
  const measured = skill.versions.filter(version => version.runs > 0);
  const before = measured[0] ?? null;
  const after = measured.length > 1 ? measured[measured.length - 1] : null;
  const current = versionById(skill, skill.current);

  const mine = runs.filter(run => run.skill === skill.name);
  const rows: Row[] = tasks
    .filter(task => task.skill === skill.name)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(task => {
      const forTask = mine.filter(run => run.task === task.id);
      const cellFor = (version: SkillVersion | null) =>
        version === null ? null : tally(forTask.filter(run => run.skill_content === version.id));

      const beforeCell = cellFor(before);
      const afterCell = cellFor(after);

      // The unaided variant was graded on a rubric too. Align it with the newest skilled
      // column on the row so the three cells are read against each other, and fall back to
      // every unaided run when nothing overlaps rather than showing an empty cell.
      const target = afterCell ?? beforeCell;
      const unaided = forTask.filter(run => run.variant === "no_skill");
      const aligned = target === null ? unaided : unaided.filter(run => run.rubric !== null && target.rubrics.includes(run.rubric));

      return {
        task: task.id,
        kind: task.kind,
        noSkill: tally(aligned.length > 0 ? aligned : unaided),
        before: beforeCell,
        after: afterCell,
        rubricMoved: beforeCell !== null && afterCell !== null && !shareRubric(beforeCell, afterCell),
      };
    });

  const sum = (pick: (row: Row) => Cell | null): Cell | null => {
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
    before,
    after,
    current,
    editedAfterBenchmark: current !== null && current.runs === 0,
    between: measured.slice(1, -1),
    rows,
    totals: { noSkill: sum(row => row.noSkill), before: sum(row => row.before), after: sum(row => row.after) },
  };
};

export type SkillSummary = {
  name: string;
  tasks: number;
  runs: number;
  noSkill: Cell | null;
  before: Cell | null;
  after: Cell | null;
  beforeVersion: SkillVersion | null;
  afterVersion: SkillVersion | null;
};

export const summarize = (index: Index): SkillSummary[] =>
  index.skills.map(skill => {
    const comparison = compareSkill(skill, index.tasks, index.runs);
    const mine = index.runs.filter(run => run.skill === skill.name);

    return {
      name: skill.name,
      tasks: index.tasks.filter(task => task.skill === skill.name).length,
      runs: tally(mine)?.total ?? 0,
      noSkill: comparison.totals.noSkill,
      before: comparison.totals.before,
      after: comparison.totals.after,
      beforeVersion: comparison.before,
      afterVersion: comparison.after,
    };
  });

export const formatCell = (cell: Cell | null) => (cell === null ? "—" : `${cell.passed}/${cell.total}`);
