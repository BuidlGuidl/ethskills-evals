import { useId } from "react";
import type { Cell } from "../lib/compare.js";
import { count, thousands } from "../lib/format.js";
import { passRate, RateChange } from "./PassCount.js";

export const ComparisonBlock = ({ title, subline, noSkill, before, after, beforeLines, afterLines, beforeTokens = null, afterTokens = null }: {
  title: string;
  subline: string;
  noSkill: Cell | null;
  before: Cell | null;
  after: Cell | null;
  beforeLines: number | null;
  afterLines: number | null;
  beforeTokens?: number | null;
  afterTokens?: number | null;
}) => {
  const titleId = useId();
  const columns = [
    { label: "Without skill", cell: noSkill, lines: null, tokens: null },
    { label: "With skill, before", cell: before, lines: beforeLines, tokens: beforeTokens },
    { label: "With skill, after", cell: after, lines: afterLines, tokens: afterTokens },
  ];
  return <section className="comparison-block" aria-labelledby={titleId}>
    <h2 id={titleId}>{title}</h2>
    <p className="comparison-subline muted small">{subline}</p>
    <dl className="comparison-columns">
      {columns.map((column, position) => <div className="comparison-column" key={column.label}>
        <dt>{column.label}</dt>
        <dd>
          <span className="comparison-rate">{column.cell ? passRate(column.cell) : "No runs"}
            {position === columns.length - 1 && <RateChange before={before} after={after} />}
          </span>
          {column.cell && <span className="cell-detail">{column.cell.passed} of {count(column.cell.total, "run")}</span>}
          {column.lines !== null && <span className="comparison-lines muted small">{count(column.lines, "line")}</span>}
          {column.tokens !== null && <span className="comparison-lines muted small">{thousands(column.tokens)} tokens</span>}
        </dd>
      </div>)}
    </dl>
  </section>;
};
