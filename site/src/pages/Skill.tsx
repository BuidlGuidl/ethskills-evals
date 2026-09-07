import { PatchDiff } from "@pierre/diffs/react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PassCount } from "../components/PassCount.js";
import { compareEntry, formatCell, type UsageMedians } from "../lib/compare.js";
import { useIndex } from "../lib/data.js";
import { patchBetween } from "../lib/diff.js";
import { cost, duration, tokens } from "../lib/format.js";
import type { Entry } from "../lib/types.js";
const UsageValue = ({ usage, metric, format }: {
  usage: UsageMedians;
  metric: "tokens" | "duration_s" | "cost_usd";
  format: (value: number | null) => string;
}) => (<td className="num">
  <span>{format(usage[metric])}</span>
  <span className="cell-detail">{usage[metric] === null ? `${usage.recorded[metric]} of ${usage.runs} runs recorded` : `over ${usage.recorded[metric]} of ${usage.runs} runs`}</span>
</td>);
const EntryResults = ({ entry }: {
  entry: Entry;
}) => {
  const index = useIndex();
  const comparison = useMemo(() => compareEntry(entry, index), [entry, index]);
  const [showDiff, setShowDiff] = useState(true);
  const { before, after, rows, totals, coverage, usage } = comparison;
  const patch = useMemo(() => before && after ? patchBetween(before, after) : null, [before, after]);
  const reports = index.reports.filter(report => report.skill === entry.skill);
  const prs = index.prs.filter(pr => pr.skill === entry.skill);
  const columns = [{ label: "Without skill", value: usage.noSkill }, { label: "Before", value: usage.before }, { label: "After", value: usage.after }];
  const hasUsage = (value: UsageMedians) => Object.values(value.recorded).some(count => count > 0);
  const diffId = `diff-${entry.skill}-${entry.model}`;
  return (<article className="entry">
    <header className="entry-header">
      <p className="model">{entry.model}</p>
      <p className="rewrite">Rewritten from {before?.lines ?? "—"} lines to {after?.lines ?? "—"} lines.</p>
      <p className="headline">
        <strong className="accent">{formatCell(totals.after)} passed after</strong> <span>vs</span> <strong>{formatCell(totals.noSkill)} without skill.</strong>
      </p>
      <p className="muted">With skill, before → after: <span className="numbers">{formatCell(totals.before)} → {formatCell(totals.after)}</span> passed.</p>
    </header>
    <section aria-label={`Results on ${entry.model}`}>
      <div className="section-heading">
        <h2>Results</h2>
        <p className="small muted">Passed / total runs</p>
      </div>
      <div className="scroll" role="region" aria-label={`${entry.model} task results`} tabIndex={0}>
        <table className="grid">
          <thead>
            <tr>
              <th scope="col">Task</th>
              <th scope="col">Kind</th>
              <th scope="col" className="num">Without skill</th>
              <th scope="col" className="num secondary">Before</th>
              <th scope="col" className="num after">After</th>
            </tr>
          </thead>
          <tbody>{rows.map(row => <tr key={row.task}>
            <th scope="row">
              <Link to={`/task/${row.task}`}>{row.task}</Link>
            </th>
            <td className="muted">{row.kind}</td>
            <td className="num">
              <PassCount cell={row.noSkill} />
            </td>
            <td className="num secondary">{formatCell(row.before)}</td>
            <td className="num after">
              <PassCount cell={row.after} />
            </td>
          </tr>)}</tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={2}>Total <span className="total-detail">{coverage.counted} of {coverage.total} tasks with matching checks</span>
              </th>
              <td className="num">{formatCell(totals.noSkill)}</td>
              <td className="num secondary">{formatCell(totals.before)}</td>
              <td className="num after">{formatCell(totals.after)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {comparison.explanations.map(text => <p className="footnote" key={text}>{text}</p>)}
    </section>
    <section aria-label="Tokens, time and cost">
      <h2>Tokens, time & cost</h2>
      {columns.some(column => hasUsage(column.value)) ? <>
        <p className="muted small">Medians per run, across all tasks shown above. Cost requires a record for every run in its column.</p>
        <div className="scroll" role="region" aria-label="Usage medians" tabIndex={0}>
          <table className="grid usage-table">
            <thead>
              <tr>
                <th scope="col">Variant</th>
                <th scope="col" className="num">Tokens</th>
                <th scope="col" className="num">Time</th>
                <th scope="col" className="num">Cost</th>
              </tr>
            </thead>
            <tbody>{columns.map(({ label, value }) => <tr key={label}>
              <th scope="row">{label}</th>{hasUsage(value) ? <>
                <UsageValue usage={value} metric="tokens" format={tokens} />
                <UsageValue usage={value} metric="duration_s" format={duration} />
                <UsageValue usage={value} metric="cost_usd" format={cost} />
              </> : <td colSpan={3} className="muted">not recorded</td>}</tr>)}</tbody>
          </table>
        </div>
      </> : <p className="muted">Tokens, time and cost were not recorded for these runs.</p>}
    </section>
    <section aria-label="Why it changed">
      <h2>Why it changed</h2>
      <ul className="docs">{reports.map(report => <li key={report.file}>
        <Link to={`/report/${report.file}`}>{report.title}</Link>
        <span className="small muted">Report · {report.date ?? "date not recorded"}</span>
      </li>)}{prs.map(pr => <li key={pr.number}>
        <Link to={`/pr/${pr.number}`}>{pr.title}</Link>
        <span className="small muted">Pull request #{pr.number}</span>
      </li>)}</ul>
      {reports.length === 0 && prs.length === 0 && <p className="muted">No reports or pull requests are linked yet.</p>}
    </section>
    <section aria-label="Skill diff">
      <div className="section-heading">
        <h2>The rewrite</h2>
        <button aria-expanded={showDiff} aria-controls={diffId} onClick={() => setShowDiff(!showDiff)}>{showDiff ? "Hide diff" : "Show diff"}</button>
      </div>
      {showDiff && <div id={diffId}>
        <div className="diff-labels">
          <span>Before <strong>{before?.lines ?? "—"} lines</strong>
          </span>
          <span>After <strong>{after?.lines ?? "—"} lines</strong>
          </span>
        </div>
        <p className="small muted">Word-level changes. Unchanged stretches are collapsed.</p>
        {patch ? <div className="diff-scroll" role="region" aria-label="Before and after skill text" tabIndex={0}>
          <PatchDiff patch={patch} options={{
            diffStyle: "split",
            lineDiffType: "word",
            overflow: "scroll",
            disableFileHeader: true,
            expandUnchanged: false,
            theme: { light: "github-light", dark: "github-dark" },
            onPostRender: node => {
              // The library's split panes scroll independently inside its shadow root.
              for (const pane of node.shadowRoot?.querySelectorAll<HTMLElement>("code[data-deletions], code[data-additions]") ?? []) {
                pane.tabIndex = 0;
                pane.setAttribute("role", "region");
                pane.setAttribute("aria-label", pane.hasAttribute("data-deletions") ? "Before skill text" : "After skill text");
              }
            },
          }} />
        </div> : <p className="muted">Version text unavailable.</p>}
      </div>}
    </section>
  </article>);
};
const Skill = () => {
  const index = useIndex();
  const { name } = useParams();
  const entries = index.showcase?.filter(entry => entry.skill === name) ?? [];
  if (entries.length === 0)
    return <h1>No such skill</h1>;
  return <>
    <header className="skill-title">
      <Link className="back" to="/">All skills</Link>
      <div className="section-heading">
        <h1>{name}</h1>
        <a className="small" href={`https://ethskills.com/${name}/SKILL.md`}>upstream ↗</a>
      </div>
    </header>{entries.map(entry => <EntryResults key={`${entry.skill}/${entry.model}`} entry={entry} />)}</>;
};
export default Skill;
