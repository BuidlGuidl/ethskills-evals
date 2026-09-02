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
  /**
   * Totalled over the tasks every column was graded on, under the same expect lines — so the
   * three cells are a comparison rather than three different measurements added up. A version
   * re-run on one task of six would otherwise show 3/3 beside the older 15/15 and read as the
   * weaker result. `coverage` says how many rows that leaves.
   */
  totals: { noSkill: Cell | null; before: Cell | null; after: Cell | null };
  coverage: { counted: number; total: number };
  /** false when the two versions share no task, so the totals are each version's own */
  comparable: boolean;
};

export const compareSkill = (skill: Skill, tasks: Task[], runs: Run[]): SkillComparison => {
  const mine = runs.filter(run => run.skill === skill.name);
  const measured = skill.versions.filter(version => version.runs > 0);
  const before = measured[0] ?? null;
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
  const candidates = before === null ? [] : measured.filter(version => version.id !== before.id);
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

  // Only the tasks both skilled columns actually ran, so the two totals share a denominator:
  // a version re-run on one task of six would otherwise show 3/3 beside the older 15/15 and
  // read as the weaker result. Rows where the expect lines moved stay in — they are a real
  // measurement of each version, and `rubricMoved` marks them rather than deleting them.
  const overlap = rows.filter(row => row.before !== null && (after === null || row.after !== null));
  // skills/building-blocks was reduced and then benchmarked on a task the long version never
  // ran, so the two share nothing. Rather than empty every cell, total each column over its
  // own rows and say plainly that this is not a comparison.
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
    between: measured.filter(version => version.id !== before?.id && version.id !== after?.id),
    rows,
    totals: { noSkill: sum(row => row.noSkill), before: sum(row => row.before), after: sum(row => row.after) },
    coverage: { counted: overlap.length, total: rows.length },
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
      tasks: index.tasks.filter(task => task.skill === skill.name).length,
      runs: tally(mine)?.total ?? 0,
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
