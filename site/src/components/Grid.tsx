import type { ReactNode } from "react";
import type { Cell } from "../lib/compare.js";
import { RateCell } from "./RateCell.js";

export const Grid = <Column extends string,>({ rows, columns, onCellClick, total = false, totalRow, note, label = "Results", rowLabel = "Skill" }: {
  rows: { key: string; label: ReactNode; sub?: ReactNode; cells: Record<string, Cell | null>; total?: Cell | null }[];
  columns: { key: Column; label: ReactNode }[];
  onCellClick: (rowKey: string | "total", colKey: Column | "total") => void;
  total?: boolean;
  totalRow?: { cells: Record<string, Cell | null>; total?: Cell | null };
  note?: ReactNode;
  label?: string;
  rowLabel?: string;
}) => <>
  <div className="table-card scroll" role="region" aria-label={label} tabIndex={0}>
    <table className="table rate-grid">
      <caption className="sr-only">{label}. Cells show the share of runs that passed every check.</caption>
      <thead><tr><th scope="col">{rowLabel}</th>
        {columns.map(column => <th scope="col" key={column.key}>{column.label}</th>)}
        {total && <th scope="col">Total</th>}
      </tr></thead>
      <tbody>{rows.map(row => {
        const cells = columns.map(column => ({ key: column.key, value: row.cells[column.key] }));
        return <tr key={row.key} className="clickable-row" onClick={() => onCellClick(row.key, "total")}>
          <th scope="row"><button className="row-label" type="button" aria-haspopup="dialog"
            onClick={event => { event.stopPropagation(); onCellClick(row.key, "total"); }}>
            {row.label}{row.sub && <span className="grid-row-sub">{row.sub}</span>}
          </button></th>
          {cells.map(({ key, value }) => <td key={key}><RateCell passed={value?.passed ?? 0}
            total={value?.total ?? 0} onClick={() => onCellClick(row.key, key)} /></td>)}
          {total && <td className="grid-total"><RateCell passed={row.total?.passed ?? 0} total={row.total?.total ?? 0}
            onClick={() => onCellClick(row.key, "total")} /></td>}
        </tr>;
      })}</tbody>
      {totalRow && <tfoot><tr className="clickable-row grid-total-row" onClick={() => onCellClick("total", "total")}>
        <th scope="row"><button className="row-label" type="button" aria-haspopup="dialog"
          onClick={event => { event.stopPropagation(); onCellClick("total", "total"); }}>Total</button></th>
        {columns.map(column => <td key={column.key} className="grid-total"><RateCell passed={totalRow.cells[column.key]?.passed ?? 0}
          total={totalRow.cells[column.key]?.total ?? 0} onClick={() => onCellClick("total", column.key)} /></td>)}
        {total && <td className="grid-total"><RateCell passed={totalRow.total?.passed ?? 0} total={totalRow.total?.total ?? 0}
          onClick={() => onCellClick("total", "total")} /></td>}
      </tr></tfoot>}
    </table>
  </div>
  <p className="grid-legend">Pass rate: the share of runs that passed every check. Green is 100%, amber under 100%, red under 50%.{note && <> {note}</>}</p>
</>;
