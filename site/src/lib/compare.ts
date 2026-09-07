import type { Entry, Index, Run, Skill } from "./types.js";

// Cells retain their check revisions so incompatible grades never enter comparison totals.
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

type Columns<Value> = { noSkill: Value; before: Value; after: Value };
type Column = keyof Columns<unknown>;
const COLUMNS: Column[] = ["noSkill", "before", "after"];

export type Row = Columns<Cell | null> & {
  task: string;
  kind: "quiz" | "goal";
  counted: boolean;
  reason: "checks-rewritten" | "missing-side" | "checks-unknown" | null;
  missing: Column[];
};

export type UsageMedians = {
  tokens: number | null;
  duration_s: number | null;
  cost_usd: number | null;
  runs: number;
  recorded: { tokens: number; duration_s: number; cost_usd: number };
};

const median = (values: (number | null)[]) => {
  const sorted = values.filter((value): value is number => value !== null).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length === 0 ? null : sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

// Usage describes every displayed run, including rows excluded from pass totals.
// Missing tokens and duration do not become zeros; cost requires a complete column.
const usageMedians = (runs: Run[]): UsageMedians => ({
  tokens: median(runs.map(run => run.usage.tokens)),
  duration_s: median(runs.map(run => run.usage.duration_s)),
  cost_usd: runs.every(run => run.usage.cost_usd !== null) ? median(runs.map(run => run.usage.cost_usd)) : null,
  runs: runs.length,
  recorded: {
    tokens: runs.filter(run => run.usage.tokens !== null).length,
    duration_s: runs.filter(run => run.usage.duration_s !== null).length,
    cost_usd: runs.filter(run => run.usage.cost_usd !== null).length,
  },
});

export const compareEntry = (entry: Entry, index: Index) => {
  const tasks = index.tasks.filter(task => task.skill === entry.skill && task.status === "live")
    .sort((a, b) => a.id.localeCompare(b.id));
  const live = new Set(tasks.map(task => task.id));
  // Resolve readings before partitioning: an older grade must not survive in another column.
  const mine = newest(index.runs).filter(run => run.superseded_by === null && measured(run) && run.pass !== null &&
    run.skill === entry.skill && run.model === entry.model && live.has(run.task));
  const columns = {
    noSkill: mine.filter(run => run.variant === "no_skill"),
    before: mine.filter(run => run.variant === "with_skill" && run.skill_content === entry.before),
    after: mine.filter(run => run.variant === "with_skill" && run.skill_content === entry.after),
  };

  const rows: Row[] = tasks.map(task => {
    const runs = {
      noSkill: columns.noSkill.filter(run => run.task === task.id),
      before: columns.before.filter(run => run.task === task.id),
      after: columns.after.filter(run => run.task === task.id),
    };
    const cells = { noSkill: tally(runs.noSkill), before: tally(runs.before), after: tally(runs.after) };
    const missing = COLUMNS.filter(column => cells[column] === null);
    const unknown = COLUMNS.some(column => runs[column].some(run => run.rubric === null));
    // An overlap alone does not make a pooled cell comparable (orchestration-quiz-003).
    const sameChecks = !COLUMNS.some(column => mixed(cells[column])) &&
      shareRubric(cells.before, cells.after) && shareRubric(cells.noSkill, cells.after);
    const reason = missing.length > 0 ? "missing-side" : unknown ? "checks-unknown" : !sameChecks ? "checks-rewritten" : null;

    return { task: task.id, kind: task.kind, ...cells, counted: reason === null, reason, missing };
  });
  const counted = rows.filter(row => row.counted);
  const sum = (column: Column): Cell | null => {
    const cells = counted.map(row => row[column]).filter((cell): cell is Cell => cell !== null);

    return cells.length === 0 ? null : {
      passed: cells.reduce((total, cell) => total + cell.passed, 0),
      total: cells.reduce((total, cell) => total + cell.total, 0),
      rubrics: [...new Set(cells.flatMap(cell => cell.rubrics))].sort(),
    };
  };
  const explanations: string[] = [];
  const rewritten = rows.filter(row => row.reason === "checks-rewritten").length;
  if (rewritten > 0) {
    explanations.push(`Checks for ${rewritten} ${rewritten === 1 ? "task" : "tasks"} were rewritten between the two benchmarks; ${rewritten === 1 ? "that row is" : "those rows are"} shown but not totalled.`);
  }
  const labels = { noSkill: "without skill", before: "before", after: "after" };
  for (const column of COLUMNS) {
    const missing = rows.filter(row => row.missing.includes(column)).length;
    if (missing > 0) {
      explanations.push(column === "before"
        ? `${missing} ${missing === 1 ? "task was" : "tasks were"} added after the first benchmark, so ${missing === 1 ? "it has" : "they have"} no before column and ${missing === 1 ? "is" : "are"} not totalled.`
        : `${missing} ${missing === 1 ? "task has" : "tasks have"} no ${labels[column]} runs; ${missing === 1 ? "that row is" : "those rows are"} shown but not totalled.`);
    }
  }
  const unknown = rows.filter(row => row.reason === "checks-unknown").length;
  if (unknown > 0) {
    explanations.push(`We could not establish which checks were used for ${unknown} ${unknown === 1 ? "task" : "tasks"}; ${unknown === 1 ? "that row is" : "those rows are"} shown but not totalled.`);
  }
  const skill = index.skills.find(skill => skill.name === entry.skill);

  return {
    before: skill ? versionById(skill, entry.before) : null,
    after: skill ? versionById(skill, entry.after) : null,
    rows,
    totals: { noSkill: sum("noSkill"), before: sum("before"), after: sum("after") },
    coverage: { counted: counted.length, total: rows.length },
    explanations,
    usage: {
      noSkill: usageMedians(columns.noSkill),
      before: usageMedians(columns.before),
      after: usageMedians(columns.after),
    },
  };
};

export const summarize = (index: Index) => (index.showcase ?? []).map(entry => {
  const comparison = compareEntry(entry, index);

  return {
    skill: entry.skill,
    model: entry.model,
    tasks: comparison.rows.length,
    runs: comparison.usage.noSkill.runs + comparison.usage.before.runs + comparison.usage.after.runs,
    ...comparison.totals,
    beforeVersion: comparison.before,
    afterVersion: comparison.after,
    coverage: comparison.coverage,
    usage: comparison.usage,
  };
});

export const formatCell = (cell: Cell | null) => (cell === null ? "—" : `${cell.passed}/${cell.total}`);
