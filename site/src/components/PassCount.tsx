import type { Cell } from "../lib/compare.js";

export const passRate = (cell: Cell) => `${Math.round(cell.passed / cell.total * 100)}%`;

export const ResultsLegend = () => <p className="table-legend">
  Each cell: share of runs that passed every check. Without skill pools the unaided runs of both rounds, so it has more runs.
  {" "}Some tasks have extra runs after the rewrite.
</p>;

export const PassCount = ({ cell }: {
  cell: Cell | null;
}) => cell === null ? <span className="cell-detail">No runs</span> : <span className="pass-count">
  <span>{passRate(cell)}</span>
  <span className="pass-fraction">{cell.passed} of {cell.total} runs</span>
  <span className="pass-track" aria-hidden="true">
    <span style={{ width: `${cell.passed / cell.total * 100}%` }} />
  </span>
</span>;
