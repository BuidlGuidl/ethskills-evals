import type { Index, Run, Skill, SkillVersion, Task } from "./types.js";

// Where the site decides what may be set next to what. Two pass counts are a comparison
// only when both were graded against the same expect lines, and those get rewritten between
// benchmarks — the hand-written reports mark such cells '‡' and tell the reader not to read
// them. Every cell carries the rubrics it was tallied from so a row can say when they moved.

export type Cell = { passed: number; total: number; rubrics: string[] };

// A retracted grade measured the harness, not the model — a killed CLI, a deliverable that
// never reached the judge. The record stays on the task page and says why; no count has it.
const measured = (run: Run) => run.retracted === null;

// A regrade and the run it re-read are one run read twice. Whenever both are in the set
// being counted, the newer reading wins; a set holding only the source still counts it,
// which is what makes a per-rubric column come out right.
const newest = (runs: Run[]) => {
  const present = new Set(runs.map(run => `${run.task}/${run.run}`));

  return runs.filter(run => !(run.superseded_by !== null && present.has(`${run.task}/${run.superseded_by}`)));
};

export const tally = (runs: Run[]): Cell | null => {
  const graded = newest(runs).filter(run => run.pass !== null && measured(run));

  if (graded.length === 0) {
    return null;
  }

  return {
    passed: graded.filter(run => run.pass).length,
    total: graded.length,
    rubrics: [...new Set(graded.map(run => run.rubric).filter((id): id is string => id !== null))].sort(),
  };
};

// Records, not runs: a regrade and the run it re-read are one run read twice, and a headline
// that counts records says 896 where the tables say 805. Ungraded runs are counted here and
// not in a tally — they happened, they just have no verdict.
export const countRuns = (runs: Run[]) => newest(runs).filter(measured).length;

export const shareRubric = (left: Cell | null, right: Cell | null) =>
  left !== null && right !== null && left.rubrics.some(id => right.rubrics.includes(id));

/** more than one rubric in one cell: a raw count, not a measurement under one set of expect lines */
export const mixed = (cell: Cell | null) => cell !== null && cell.rubrics.length > 1;

export const versionById = (skill: Skill, id: string | null) =>
  id === null ? null : (skill.versions.find(version => version.id === id) ?? null);

export type Row = {
  task: string;
  kind: "quiz" | "goal";
  /** not run again, so a version measured after it was retired has no cell here */
  retired: boolean;
  noSkill: Cell | null;
  before: Cell | null;
  after: Cell | null;
  /** the two skilled cells were graded against different expect lines, so they are not a comparison */
  rubricMoved: boolean;
  /** no unaided run shares the skilled column's rubric, so noSkill pools every unaided run there is */
  unaidedOffRubric: boolean;
  /** in the totals: every cell on the row reads against the others */
  counted: boolean;
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
  /**
   * Totalled over the rows where every cell reads against the others: both versions ran the
   * task, under the same expect lines, and the unaided runs were graded on those lines too.
   * A version re-run on one task of six would otherwise show 3/3 beside the older 15/15 and
   * read as the weaker result; a row whose rubric moved would add two different measurements
   * into one number. `coverage` says how many rows that leaves.
   */
  totals: { noSkill: Cell | null; before: Cell | null; after: Cell | null };
  coverage: { counted: number; total: number };
  /** rows with a cell in both skilled columns, whatever their rubrics */
  sharedRows: number;
  /** false when no row is a comparison, so the totals are each version's own */
  comparable: boolean;
};

export const compareSkill = (skill: Skill, tasks: Task[], runs: Run[]): SkillComparison => {
  const mine = runs.filter(run => run.skill === skill.name);
  const measuredVersions = skill.versions.filter(version => version.runs > 0);
  const before = measuredVersions[0] ?? null;
  const current = versionById(skill, skill.current);

  const tasksOf = (version: SkillVersion) =>
    new Set(mine.filter(run => run.skill_content === version.id).map(run => run.task));

  // Which version is the "after" is not simply the newest measured one. skills/standards was
  // benchmarked on all three of its tasks and then re-run on one, and taking the last would
  // face the original with a single row; skills/tools has an intermediate version that covers
  // every task, and taking the widest would put an intermediate in the column while a later
  // version is what actually shipped. So: the version the repo holds, if a run ever saw it;
  // otherwise the newest one benchmarked on at least half the older version's work; otherwise
  // whatever shares the most.
  const beforeTasks = before === null ? new Set<string>() : tasksOf(before);
  const candidates = before === null ? [] : measuredVersions.filter(version => version.id !== before.id);
  const shared = (version: SkillVersion) => [...tasksOf(version)].filter(task => beforeTasks.has(task)).length;

  const after =
    candidates.find(version => version.id === skill.current) ??
    [...candidates].reverse().find(version => shared(version) * 2 >= beforeTasks.size) ??
    [...candidates]
      .map((version, order) => ({ version, order }))
      .sort((a, b) => shared(b.version) - shared(a.version) || b.version.runs - a.version.runs || b.order - a.order)[0]
      ?.version ??
    null;

  const rows: Row[] = tasks
    .filter(task => task.skill === skill.name)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(task => {
      const forTask = mine.filter(run => run.task === task.id);
      const cellFor = (version: SkillVersion | null) =>
        version === null ? null : tally(forTask.filter(run => run.skill_content === version.id));

      const beforeCell = cellFor(before);
      const afterCell = cellFor(after);
      const rubricMoved = beforeCell !== null && afterCell !== null && !shareRubric(beforeCell, afterCell);

      // The unaided variant was graded on a rubric too. Align it with the newest skilled
      // column on the row so the three cells are read against each other. When nothing
      // overlaps, every unaided run is shown rather than an empty cell — and the row says
      // so, because that number faces neither skilled column.
      const target = afterCell ?? beforeCell;
      const unaided = forTask.filter(run => run.variant === "no_skill");
      const aligned = target === null ? unaided : unaided.filter(run => run.rubric !== null && target.rubrics.includes(run.rubric));
      const unaidedOffRubric = target !== null && unaided.length > 0 && aligned.length === 0;
      const retired = task.status === "retired";

      return {
        task: task.id,
        kind: task.kind,
        retired,
        noSkill: tally(aligned.length > 0 ? aligned : unaided),
        before: beforeCell,
        after: afterCell,
        rubricMoved,
        unaidedOffRubric,
        // A retired task keeps its cell for what the older version scored, but the newer
        // version was never run on it, so it cannot be in a before-and-after total.
        counted:
          beforeCell !== null &&
          !unaidedOffRubric &&
          (after === null || (!retired && afterCell !== null && !rubricMoved)),
      };
    });

  // Only the rows that are a comparison, so the totals share a denominator and a rubric.
  // skills/building-blocks was reduced and then benchmarked on a task the long version never
  // ran, so the two share nothing. Rather than empty every cell, total each column over its
  // own rows and say plainly that this is not a comparison.
  const overlap = rows.filter(row => row.counted);
  const counted = overlap.length > 0 ? overlap : rows;

  const sum = (pick: (row: Row) => Cell | null): Cell | null => {
    const cells = counted.map(pick).filter((cell): cell is Cell => cell !== null);

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
    between: measuredVersions.filter(version => version.id !== before?.id && version.id !== after?.id),
    rows,
    totals: { noSkill: sum(row => row.noSkill), before: sum(row => row.before), after: sum(row => row.after) },
    coverage: {
      counted: overlap.length,
      total: after === null ? rows.length : rows.filter(row => !row.retired).length,
    },
    sharedRows: rows.filter(row => row.before !== null && row.after !== null).length,
    comparable: after === null || overlap.length > 0,
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
  coverage: { counted: number; total: number };
  comparable: boolean;
};

export const summarize = (index: Index): SkillSummary[] =>
  index.skills.map(skill => {
    const comparison = compareSkill(skill, index.tasks, index.runs);
    const mine = index.runs.filter(run => run.skill === skill.name);

    return {
      name: skill.name,
      // Live tasks: a retired one is kept for its runs, and is not work the skill still faces.
      tasks: index.tasks.filter(task => task.skill === skill.name && task.status === "live").length,
      runs: countRuns(mine),
      noSkill: comparison.totals.noSkill,
      before: comparison.totals.before,
      after: comparison.totals.after,
      beforeVersion: comparison.before,
      afterVersion: comparison.after,
      coverage: comparison.coverage,
      comparable: comparison.comparable,
    };
  });

export const formatCell = (cell: Cell | null) => (cell === null ? "—" : `${cell.passed}/${cell.total}`);
