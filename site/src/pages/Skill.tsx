import { PatchDiff } from "@pierre/diffs/react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { compareSkill, formatCell } from "../lib/compare.js";
import { useIndex } from "../lib/data.js";
import { patchBetween } from "../lib/diff.js";
import { NO_SHARED_TASKS, PARTIAL_COVERAGE, RUBRIC_MOVED } from "../lib/notes.js";

const size = (lines: number, words: number) => `${lines} lines / ${words} words`;

const Skill = () => {
  const index = useIndex();
  const { name } = useParams();
  const skill = index.skills.find(entry => entry.name === name) ?? null;
  const [showDiff, setShowDiff] = useState(true);

  const comparison = useMemo(
    () => (skill === null ? null : compareSkill(skill, index.tasks, index.runs)),
    [skill, index],
  );

  const patch = useMemo(() => {
    const target = comparison?.after ?? comparison?.current ?? null;

    if (comparison?.before == null || target === null || target.id === comparison.before.id) {
      return null;
    }

    return patchBetween(comparison.before, target);
  }, [comparison]);

  if (skill === null || comparison === null) {
    return <h1>No such skill</h1>;
  }

  const { before, after, current, between } = comparison;
  // Nothing to put side by side when the repo still holds the one version that was measured.
  const right = after ?? (current !== null && current.id !== before?.id ? current : null);
  const reports = index.reports.filter(report => report.skill.startsWith(skill.name));
  const prs = index.prs.filter(pr => pr.skill === skill.name);
  const moved = comparison.rows.some(row => row.rubricMoved);

  return (
    <>
      <h1>
        skills/{skill.name}
        <a className="small src" href={`https://ethskills.com/${skill.name}/SKILL.md`}>
          upstream
        </a>
      </h1>

      {after === null ? (
        <p className="lede">
          Measured once, at {before ? size(before.lines, before.words) : "an unknown size"}. It has not been rewritten
          and re-run, so there is no before and after to compare.
        </p>
      ) : (
        <p className="lede">
          Rewritten from <strong>{size(before!.lines, before!.words)}</strong> to{" "}
          <strong>{size(after.lines, after.words)}</strong>
          {comparison.comparable ? ", and both versions were put through the same tasks." : "."}
        </p>
      )}

      {comparison.editedAfterBenchmark && current !== null && (
        <p className="note">
          The file in the repo today is {size(current.lines, current.words)} — it was edited after the benchmark, so no
          run was graded on exactly this text. The numbers below belong to the versions that were measured.
        </p>
      )}

      <h2>Results</h2>
      <table className="grid">
        <thead>
          <tr>
            <th>task</th>
            <th className="num">no skill</th>
            <th className="num">old skill</th>
            <th className="num">new skill</th>
          </tr>
        </thead>
        <tbody>
          {comparison.rows.map(row => (
            <tr key={row.task}>
              <th scope="row">
                <Link to={`/task/${row.task}`}>{row.task.replace(`${skill.name}-`, "")}</Link>{" "}
                <span className="muted small">{row.kind}</span>
              </th>
              <td className="num">{formatCell(row.noSkill)}</td>
              <td className="num">
                {formatCell(row.before)}
                {row.rubricMoved && (
                  <span className="moved" title={RUBRIC_MOVED}>
                    {" ‡"}
                  </span>
                )}
              </td>
              <td className="num">
                {formatCell(row.after)}
                {row.rubricMoved && (
                  <span className="moved" title={RUBRIC_MOVED}>
                    {" ‡"}
                  </span>
                )}
              </td>
            </tr>
          ))}
          <tr className="total">
            <th scope="row">
              total{" "}
              <span className="muted small">
                {comparison.coverage.counted === comparison.coverage.total
                  ? `all ${comparison.coverage.total} tasks`
                  : `${comparison.coverage.counted} of ${comparison.coverage.total} tasks`}
              </span>
            </th>
            <td className="num">{formatCell(comparison.totals.noSkill)}</td>
            <td className="num">{formatCell(comparison.totals.before)}</td>
            <td className="num">{formatCell(comparison.totals.after)}</td>
          </tr>
        </tbody>
      </table>

      {!comparison.comparable && (
        <p className="note">{NO_SHARED_TASKS}</p>
      )}

      {comparison.comparable && comparison.coverage.counted < comparison.coverage.total && (
        <p className="footnote">
          <strong className="moved">*</strong> {PARTIAL_COVERAGE}
        </p>
      )}

      {moved && (
        <p className="footnote">
          <strong className="moved">‡</strong> {RUBRIC_MOVED}
        </p>
      )}

      {between.length > 0 && (
        <p className="footnote">
          {between.length} more measured {between.length === 1 ? "version was" : "versions were"} benchmarked and
          {between.length === 1 ? " is" : " are"} not shown above:{" "}
          {between.map(version => `${version.lines} lines (${version.runs} runs)`).join(", ")}.
        </p>
      )}

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
