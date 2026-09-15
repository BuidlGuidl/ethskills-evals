import type { ReactNode } from "react";
import type { Cell } from "../lib/compare.js";
import { RateCell } from "./RateCell.js";

export const Grid = <Column extends string,>({ rows, columns, onCellClick, total = false, note, label = "Results", rowLabel = "Skill" }: {
  rows: { key: string; label: ReactNode; sub?: ReactNode; cells: Record<string, Cell | null>; total?: Cell | null }[];
  columns: { key: Column; label: ReactNode }[];
  onCellClick: (rowKey: string, colKey: Column | "total") => void;
  total?: boolean;
  note?: ReactNode;
  label?: string;
  rowLabel?: string;
}) => <>
  <div className="scroll rate-grid-scroll" role="region" aria-label={label} tabIndex={0}>
    <table className="rate-grid">
      <caption className="sr-only">{label}. Cells show the share of runs that passed every check.</caption>
      <thead><tr><th scope="col">{rowLabel}</th>
        {columns.map(column => <th scope="col" key={column.key}>{column.label}</th>)}
        {total && <th scope="col">Total</th>}
      </tr></thead>
      <tbody>{rows.map(row => {
        const cells = columns.map(column => ({ key: column.key, value: row.cells[column.key] }));
        return <tr key={row.key}>
          <th scope="row">{row.label}{row.sub && <span className="grid-row-sub">{row.sub}</span>}</th>
          {cells.map(({ key, value }) => <td key={key}><RateCell passed={value?.passed ?? 0}
            total={value?.total ?? 0} onClick={() => onCellClick(row.key, key)} /></td>)}
          {total && <td className="grid-total"><RateCell passed={row.total?.passed ?? 0} total={row.total?.total ?? 0}
            onClick={() => onCellClick(row.key, "total")} /></td>}
        </tr>;
      })}</tbody>
    </table>
  </div>
  <p className="grid-legend">Pass rate: the share of runs that passed every check. Red under 50%, amber under 80%, green above.{note && <> {note}</>}</p>
</>;
