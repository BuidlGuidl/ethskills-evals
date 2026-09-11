import { PatchDiff } from "@pierre/diffs/react";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Link, useParams } from "react-router-dom";
import { PassCount, ResultsLegend } from "../components/PassCount.js";
import { ComparisonBlock } from "../components/ComparisonBlock.js";
import { compareEntry, type UsageMedians } from "../lib/compare.js";
import { useDocs, useIndex } from "../lib/data.js";
import { patchBetween } from "../lib/diff.js";
import { cost, count, duration, tokens } from "../lib/format.js";
import type { Entry } from "../lib/types.js";
const phoneQuery = "(max-width: 699px)";
const subscribeViewport = (notify: () => void) => {
  const query = window.matchMedia(phoneQuery);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};
const phoneViewport = () => window.matchMedia(phoneQuery).matches;
const UsageValue = ({ usage, metric, format }: {
  usage: UsageMedians;
  metric: "tokens" | "duration_s" | "cost_usd";
  format: (value: number | null) => string;
}) => (<td className="num">
  <span>{format(usage[metric])}</span>
  <span className="cell-detail">{usage[metric] === null ? `${usage.recorded[metric]} of ${usage.runs} runs recorded` : `Based on ${usage.recorded[metric]} of ${usage.runs} runs`}</span>
</td>);
const EntryResults = ({ entry }: {
  entry: Entry;
}) => {
  const index = useIndex();
  const { docs, error: docsError } = useDocs();
  const comparison = useMemo(() => compareEntry(entry, index), [entry, index]);
  const phone = useSyncExternalStore(subscribeViewport, phoneViewport);
  const [showDiff, setShowDiff] = useState(true);
  const { before, after, rows, totals, usage } = comparison;
  // The skill texts live in docs.json, fetched once when the first skill page opens.
  const patch = useMemo(() => {
    const beforeText = before && docs ? docs.skills[before.id] : undefined;
    const afterText = after && docs ? docs.skills[after.id] : undefined;

    return before && after && beforeText !== undefined && afterText !== undefined
      ? patchBetween({ sha: before.sha, text: beforeText }, { sha: after.sha, text: afterText })
      : null;
  }, [before, after, docs]);
  const columns = [{ label: "Without skill", value: usage.noSkill }, { label: "With skill, before rewrite", value: usage.before }, { label: "With skill, after rewrite", value: usage.after }];
  const hasUsage = (value: UsageMedians) => Object.values(value.recorded).some(count => count > 0);
  const diffId = `diff-${entry.skill}-${entry.model}`;
  return (<article className="entry">
    <ComparisonBlock title={entry.model}
      subline={`${count(rows.length, "task")}, ${count(usage.noSkill.runs + usage.before.runs + usage.after.runs, "run")}`}
      noSkill={totals.noSkill} before={totals.before} after={totals.after}
      beforeLines={before?.lines ?? null} afterLines={after?.lines ?? null}
      beforeTokens={before?.tokens ?? null} afterTokens={after?.tokens ?? null}
    />
    <section aria-label={`Results on ${entry.model}`}>
      <div className="section-heading">
        <h2>Results</h2>
      </div>
      <ResultsLegend />
      <div className="scroll" role="region" aria-label={`${entry.model} task results`} tabIndex={0}>
        <table className="grid">
          <thead>
            <tr>
              <th scope="col">Task</th>
              <th scope="col">Kind</th>
              <th scope="col" className="num">Without skill</th>
              <th scope="col" className="num secondary">With skill, before rewrite</th>
              <th scope="col" className="num after">With skill, after rewrite</th>
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
            <td className="num secondary"><PassCount cell={row.before} /></td>
            <td className="num after">
              <PassCount cell={row.after} />
            </td>
          </tr>)}</tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={2}>Total
              </th>
              <td className="num"><PassCount cell={totals.noSkill} /></td>
              <td className="num secondary"><PassCount cell={totals.before} /></td>
              <td className="num after"><PassCount cell={totals.after} /></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
    <section aria-label="Tokens, time and cost">
      <h2>Tokens, time and cost</h2>
      {columns.some(column => hasUsage(column.value)) ? <>
        <p className="muted small">Each value is the median per run for the tasks above. Token counts include recorded cache use. We show cost only when every run in that row has a cost record.</p>
        <div className="scroll" role="region" aria-label="Usage medians" tabIndex={0}>
          <table className="grid usage-table">
            <thead>
              <tr>
                <th scope="col">Skill used</th>
                <th scope="col" className="num">Median tokens per run</th>
                <th scope="col" className="num">Median time per run</th>
                <th scope="col" className="num">Median cost per run, USD</th>
              </tr>
            </thead>
            <tbody>{columns.map(({ label, value }) => <tr key={label}>
              <th scope="row">{label}</th>{hasUsage(value) ? <>
                <UsageValue usage={value} metric="tokens" format={tokens} />
                <UsageValue usage={value} metric="duration_s" format={duration} />
                <UsageValue usage={value} metric="cost_usd" format={cost} />
              </> : <td colSpan={3} className="muted">Not recorded</td>}</tr>)}</tbody>
          </table>
        </div>
      </> : <p className="muted">These runs have no token, time or cost records.</p>}
    </section>
    <section aria-label="Skill diff">
      <div className="section-heading">
        <h2>The rewrite</h2>
        <button aria-expanded={showDiff} aria-controls={diffId} onClick={() => setShowDiff(!showDiff)}>{showDiff ? "Hide diff" : "Show diff"}</button>
      </div>
      {showDiff && <div id={diffId}>
        <div className="diff-labels">
          <span>Before rewrite <strong>{before ? `${before.lines} lines` : "Length not recorded"}</strong>
          </span>
          <span>After rewrite <strong>{after ? `${after.lines} lines` : "Length not recorded"}</strong>
          </span>
        </div>
        <p className="small muted">{phone ? "Removed text comes before added text." : "The original is on the left. The rewrite is on the right."} Changed words are marked. Unchanged text is folded away.</p>
        {patch ? <div className="diff-scroll" role="region" aria-label="Before and after skill text" tabIndex={0}>
          <PatchDiff patch={patch} options={{
            diffStyle: phone ? "unified" : "split",
            lineDiffType: "word",
            overflow: "wrap",
            disableFileHeader: true,
            expandUnchanged: false,
            theme: { light: "github-light", dark: "github-dark" },
            onPostRender: node => {
              // Name each pane for keyboard and screen-reader navigation.
              for (const pane of node.shadowRoot?.querySelectorAll<HTMLElement>("code[data-deletions], code[data-additions]") ?? []) {
                pane.tabIndex = 0;
                pane.setAttribute("role", "region");
                pane.setAttribute("aria-label", pane.hasAttribute("data-deletions") ? "Before skill text" : "After skill text");
              }
            },
          }} />
        </div> : <p className="muted">{docsError ?? (docs === null && before && after ? "Loading the skill text." : "Skill text unavailable.")}</p>}
      </div>}
    </section>
  </article>);
};
const Skill = () => {
  const index = useIndex();
  const { name } = useParams();
  const reports = index.reports.filter(report => report.skill === name);
  const prs = index.prs.filter(pr => pr.skill === name);
  const entries = index.showcase?.filter(entry => entry.skill === name) ?? [];
  if (entries.length === 0)
    return <h1>Skill not found</h1>;
  return <>
    <header className="skill-title">
      <Link className="back" to="/">All skills</Link>
      <div className="section-heading">
        <h1>{name}</h1>
        <a className="small" href={`https://ethskills.com/${name}/SKILL.md`}>upstream ↗</a>
      </div>
    </header>
    {entries.map(entry => <EntryResults key={`${entry.skill}/${entry.model}`} entry={entry} />)}
    <section aria-label="Why we rewrote it">
      <h2>Why we rewrote it</h2>
      <ul className="docs">{reports.map(report => <li key={report.file}>
        <Link to={`/report/${report.file}`}>{report.title}</Link>
        <span className="small muted">Report · {report.date ?? "date not recorded"}</span>
      </li>)}{prs.map(pr => <li key={pr.number}>
        <Link to={`/pr/${pr.number}`}>{pr.title}</Link>
        <span className="small muted">Pull request #{pr.number}</span>
      </li>)}</ul>
      {reports.length === 0 && prs.length === 0 && <p className="muted">No reports or pull requests linked for this skill.</p>}
    </section>
  </>;
};
export default Skill;
