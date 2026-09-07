import { PatchDiff } from "@pierre/diffs/react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { compareEntry, formatCell } from "../lib/compare.js";
import { useIndex } from "../lib/data.js";
import { patchBetween } from "../lib/diff.js";

const size = (lines: number, words: number) => `${lines} lines / ${words} words`;

const Skill = () => {
  const index = useIndex();
  const { name } = useParams();
  const skill = index.skills.find(entry => entry.name === name) ?? null;
  const [showDiff, setShowDiff] = useState(true);

  const entry = index.showcase?.find(entry => entry.skill === name);
  const comparison = useMemo(
    () => (entry === undefined ? null : compareEntry(entry, index)),
    [entry, index],
  );

  const patch = useMemo(() => {
    const target = comparison?.after ?? null;

    if (comparison?.before == null || target === null || target.id === comparison.before.id) {
      return null;
    }

    return patchBetween(comparison.before, target);
  }, [comparison]);

  if (skill === null || comparison === null) {
    return <h1>No such skill</h1>;
  }

  const { before, after, rows, coverage } = comparison;
  const right = after;
  const reports = index.reports.filter(report => report.skill === skill.name);
  const prs = index.prs.filter(pr => pr.skill === skill.name);
  const fullCoverage = coverage.counted === coverage.total;

  return (
    <>
      <h1>
        skills/{skill.name}
        <a className="small src" href={`https://ethskills.com/${skill.name}/SKILL.md`}>
          upstream
        </a>
      </h1>

      <p className="lede">
        {entry?.model} · {before && after ? `Rewritten from ${before.lines} lines to ${after.lines} lines.` : "Version text unavailable."}
      </p>

      <h2>Results</h2>
      <table className="grid">
        <thead>
          <tr className="group">
            <th colSpan={2} />
            <th colSpan={2} className="span">
              with skill
            </th>
          </tr>
          <tr>
            <th>task</th>
            <th className="num">without skill</th>
            <th className="num">before</th>
            <th className="num">after</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.task} className={after !== null && !row.counted ? "uncounted" : undefined}>
              <th scope="row">
                <Link to={`/task/${row.task}`}>{row.task.replace(`${skill.name}-`, "")}</Link>{" "}
                <span className="muted small">{row.kind}</span>
              </th>
              <td className="num">
                {formatCell(row.noSkill)}
              </td>
              <td className="num">
                {formatCell(row.before)}
              </td>
              <td className="num">
                {formatCell(row.after)}
              </td>
            </tr>
          ))}
          <tr className="total">
            <th scope="row">
              total{" "}
              <span className="muted small">
                {fullCoverage ? `all ${coverage.total} tasks` : `${coverage.counted} of ${coverage.total} tasks`}
              </span>
            </th>
            <td className="num">{formatCell(comparison.totals.noSkill)}</td>
            <td className="num">{formatCell(comparison.totals.before)}</td>
            <td className="num">{formatCell(comparison.totals.after)}</td>
          </tr>
        </tbody>
      </table>

      {comparison.explanations.map(text => <p className="footnote" key={text}>{text}</p>)}

      {(reports.length > 0 || prs.length > 0) && (
        <>
          <h2>{right === null ? "Reports and write-ups" : "Why it changed"}</h2>
          <ul className="docs">
            {reports.map(report => (
              <li key={report.file}>
                <Link to={`/report/${report.file}`}>{report.title}</Link>{" "}
                <span className="muted small">report · {report.date}</span>
              </li>
            ))}
            {prs.map(pr => (
              <li key={pr.number}>
                <Link to={`/pr/${pr.number}`}>{pr.title}</Link>{" "}
                <span className="muted small">
                  pull request #{pr.number} · {pr.state.toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {right !== null && (
        <>
          <h2>
            The skill, then and now
            <button className="toggle" onClick={() => setShowDiff(!showDiff)}>
              {showDiff ? "hide" : "show"}
            </button>
          </h2>
          {showDiff && patch !== null && (
            <>
              <p className="footnote">
                Left: {before ? size(before.lines, before.words) : "—"}. Right:{" "}
                {after === null ? "the file in the repo now" : "the version measured after the rewrite"},{" "}
                {right !== null ? size(right.lines, right.words) : "—"}. Unchanged stretches are collapsed.
              </p>
                <PatchDiff
                patch={patch}
                className="patch"
                options={{
                  diffStyle: "split",
                  lineDiffType: "word",
                  overflow: "scroll",
                  disableFileHeader: true,
                  expandUnchanged: false,
                  theme: { light: "github-light", dark: "github-dark" },
                }}
              />
            </>
          )}
        </>
      )}

    </>
  );
};

export default Skill;
