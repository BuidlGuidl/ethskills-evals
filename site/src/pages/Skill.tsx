import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { compareSkill, formatCell } from "../lib/compare.js";
import { useIndex } from "../lib/data.js";
import { alignedDiff } from "../lib/diff.js";

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

  const rows = useMemo(() => {
    if (comparison?.before == null) {
      return [];
    }

    const target = comparison.after ?? comparison.current;

    return target === null || target.id === comparison.before.id ? [] : alignedDiff(comparison.before.text, target.text);
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
                {row.rubricMoved && <span className="moved">{" ‡"}</span>}
              </td>
              <td className="num">
                {formatCell(row.after)}
                {row.rubricMoved && <span className="moved">{" ‡"}</span>}
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
        <p className="note">
          The two versions were never run on the same task — the newer one was benchmarked on work the older one never
          saw. Each total is that version's own, and the two are not a before and after.
        </p>
      )}

      {comparison.comparable && comparison.coverage.counted < comparison.coverage.total && (
        <p className="muted small">
          The total covers only the tasks every column was graded on, under the same{" "}
          <code>expect:</code> lines. Rows left out of it are still shown above — added up they would be three
          different measurements, not a comparison.
        </p>
      )}

      {moved && (
        <p className="muted small">
          ‡ the task's <code>expect:</code> lines were rewritten between the two runs, so those two cells were graded
          by different rules and are not a comparison — read them per column. On those rows the unaided cell is the one
          graded on the <em>newer</em> version's expect lines, so it faces the new skill and not the old one.
        </p>
      )}

      {between.length > 0 && (
        <p className="muted small">
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
          {showDiff && (
            <>
              <div className="cols">
                <div className="colhead">before — {before ? size(before.lines, before.words) : "—"}</div>
                <div className="colhead">
                  {after === null ? "in the repo now" : "after"} — {size(right.lines, right.words)}
                </div>
              </div>
              <div className="diff">
                {rows.map((row, position) => (
                  <div className={`drow ${row.state}`} key={position}>
                    <pre className={row.left === null ? "gap" : ""}>{row.left ?? ""}</pre>
                    <pre className={row.right === null ? "gap" : ""}>{row.right ?? ""}</pre>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

    </>
  );
};

export default Skill;
