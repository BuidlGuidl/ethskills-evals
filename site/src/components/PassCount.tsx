import { formatCell, type Cell } from "../lib/compare.js";
export const PassCount = ({ cell }: {
  cell: Cell | null;
}) => (<span className="pass-count">
  <span>{formatCell(cell)}</span>
  {cell !== null && <span className="pass-track" aria-hidden="true">
    <span style={{ width: `${cell.passed / cell.total * 100}%` }} />
  </span>}
</span>);
