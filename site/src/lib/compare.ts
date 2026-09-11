import type { Entry, Index, Run, Skill } from "./types.js";

// Cells retain their check revisions so incompatible grades never enter comparison totals.
export type Cell = { passed: number; total: number; rubrics: string[] };

// A retracted grade measured the harness, not the model — a killed CLI, a deliverable that
// never reached the judge. The record stays on the task page and says why; no count has it.
const measured = (run: Run) => run.retracted === null;

// A regrade and the run it re-read are one run read twice. Of the readings present in the
// set being counted, only the newest wins, however many hops apart they are; a set holding
// only the source still counts it, which is what makes a per-rubric column come out right.
const newest = (runs: Run[]) => {
  const latest = new Map<string, number>();

  for (const run of runs) {
    const key = `${run.task}/${run.lineage}`;

    latest.set(key, Math.max(latest.get(key) ?? 0, run.reading));
  }

  return runs.filter(run => run.reading === latest.get(`${run.task}/${run.lineage}`));
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

// Every run must name the same checks and the same prompt; a reworded prompt is another
// task, and overlap cannot make a mixed column comparable.
export const sameRubric = (columns: { rubric: string | null; prompt: string | null }[][]) => {
  const first = columns[0]?.[0];

  return first !== undefined && typeof first.rubric === "string" && typeof first.prompt === "string" &&
    columns.every(runs => runs.length > 0 && runs.every(run => run.rubric === first.rubric && run.prompt === first.prompt));
};

export const versionById = (skill: Skill, id: string | null) =>
  id === null ? null : (skill.versions.find(version => version.id === id) ?? null);

type Columns<Value> = { noSkill: Value; before: Value; after: Value };
type Column = keyof Columns<unknown>;

export type Row = Columns<Cell | null> & {
  task: string;
  kind: "quiz" | "goal";
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
  const tasks = index.tasks.filter(task => task.skill === entry.skill && task.status === "live" &&
    index.runs.some(run => run.task === task.id && run.model === entry.model))
    .sort((a, b) => a.id.localeCompare(b.id));
  const live = new Set(tasks.map(task => task.id));
  // Resolve readings before partitioning: an older grade must not survive in another column.
  const mine = newest(index.runs).filter(run => measured(run) && run.pass !== null &&
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
    return { task: task.id, kind: task.kind, ...cells };
  });
  const sum = (column: Column): Cell | null => {
    const cells = rows.map(row => row[column]).filter((cell): cell is Cell => cell !== null);

    return cells.length === 0 ? null : {
      passed: cells.reduce((total, cell) => total + cell.passed, 0),
      total: cells.reduce((total, cell) => total + cell.total, 0),
      rubrics: [...new Set(cells.flatMap(cell => cell.rubrics))].sort(),
    };
  };
  const skill = index.skills.find(skill => skill.name === entry.skill);

  return {
    before: skill ? versionById(skill, entry.before) : null,
    after: skill ? versionById(skill, entry.after) : null,
    rows,
    totals: { noSkill: sum("noSkill"), before: sum("before"), after: sum("after") },
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
    usage: comparison.usage,
  };
});
