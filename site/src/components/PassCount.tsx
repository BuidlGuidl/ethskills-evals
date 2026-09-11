import type { Cell } from "../lib/compare.js";

export const passRate = (cell: Cell) => `${Math.round(cell.passed / cell.total * 100)}%`;

export const ResultsLegend = () => <p className="table-legend">
  Pass rate is the share of runs where the model passed every check. Without skill has more runs because we count its runs from both rounds together.
</p>;

export const RateChange = ({ before, after }: { before: Cell | null; after: Cell | null }) => {
  if (!before || !after) return null;
  const change = after.passed * before.total - before.passed * after.total;
  return change === 0 ? null : <span className={`rate-change ${change > 0 ? "good" : "bad"}`}>{change > 0 ? "higher" : "lower"}</span>;
};

export const PassCount = ({ cell, before = null }: {
  cell: Cell | null;
  before?: Cell | null;
}) => cell === null ? <span className="cell-detail">No runs</span> : <span className="pass-count">
  <span>{passRate(cell)}<RateChange before={before} after={cell} /></span>
  <span className="pass-fraction">{cell.passed} of {cell.total} runs</span>
  <span className="pass-track" aria-hidden="true">
    <span style={{ width: `${cell.passed / cell.total * 100}%` }} />
  </span>
</span>;
