import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { compareSkill, formatCell, versionById } from "../lib/compare.js";
import { useIndex } from "../lib/data.js";
import { alignedDiff } from "../lib/diff.js";

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
    if (skill === null || comparison?.original === undefined || comparison?.original === null) {
      return [];
    }

    const right = versionById(skill, skill.current) ?? comparison.original;

    return alignedDiff(comparison.original.text, right.text);
  }, [skill, comparison]);

  if (skill === null || comparison === null) {
    return <h1>No such skill</h1>;
  }

  const current = versionById(skill, skill.current);
  const reports = index.reports.filter(report => report.skill.startsWith(skill.name));
  const prs = index.prs.filter(pr => pr.skill === skill.name);

  return (
    <>
      <h1>
        skills/{skill.name}
        <a className="small src" href={`https://ethskills.com/${skill.name}/SKILL.md`}>
          upstream
        </a>
      </h1>

      <h2>Versions</h2>
      <table className="grid narrow">
        <thead>
          <tr>
            <th>version</th>
            <th className="num">lines</th>
            <th className="num">words</th>
            <th className="num">runs</th>
            <th>role</th>
          </tr>
        </thead>
        <tbody>
          {skill.versions.map(version => (
            <tr key={version.id}>
              <th scope="row">
                <code>{version.sha}</code>
              </th>
              <td className="num">{version.lines}</td>
              <td className="num">{version.words}</td>
              <td className="num">{version.runs}</td>
              <td>
                {version.id === comparison.original?.id && <span className="tag idle">original</span>}
                {version.id === comparison.reduced?.id && <span className="tag good">reduced</span>}
                {version.in_repo && <span className="tag">in repo now</span>}
                {version.runs === 0 && <span className="tag warnTag">never benchmarked</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {comparison.unmeasuredInRepo !== null && (
        <p className="note">
          The file in the repo today ({comparison.unmeasuredInRepo.lines} lines) is not the text any run was graded on.
          The numbers below belong to the versions above; the diff shows what the repo holds now.
        </p>
      )}

      <h2>Results</h2>
      {comparison.measured ? (
        <p className="muted">
          {comparison.original?.lines} lines → {comparison.reduced?.lines} lines ({comparison.original?.words} →{" "}
          {comparison.reduced?.words} words). A row is only a comparison when both skilled columns were graded against
          the same <code>expect:</code> lines — where they were not, the site says so instead of putting the numbers
          next to each other.
        </p>
      ) : (
        <p className="note">
          Only one version of this skill has been benchmarked, so there is nothing to compare it against yet.
        </p>
      )}

      <table className="grid">
        <thead>
          <tr>
            <th>task</th>
            <th className="num">no_skill</th>
            <th className="num">original</th>
            <th className="num">reduced</th>
            <th>comparable</th>
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
              <td className="num">{formatCell(row.original)}</td>
              <td className="num">{comparison.measured ? formatCell(row.reduced) : <span className="muted">not measured</span>}</td>
              <td>
                {row.original === null || row.reduced === null ? (
                  <span className="muted small">—</span>
                ) : row.comparable ? (
                  <span className="tag good">same expects</span>
                ) : (
                  <span className="tag warnTag">expects rewritten — not a comparison</span>
                )}
              </td>
            </tr>
          ))}
          <tr className="total">
            <th scope="row">total</th>
            <td className="num">{formatCell(comparison.totals.noSkill)}</td>
            <td className="num">{formatCell(comparison.totals.original)}</td>
            <td className="num">{comparison.measured ? formatCell(comparison.totals.reduced) : "—"}</td>
            <td className="muted small">
              {comparison.rows.some(row => row.original !== null && row.reduced !== null && !row.comparable)
                ? "contains rows graded by different rules — read per row"
                : ""}
            </td>
          </tr>
        </tbody>
      </table>

      <h2>
        The skill, then and now
        <button className="toggle" onClick={() => setShowDiff(!showDiff)}>
          {showDiff ? "hide" : "show"}
        </button>
      </h2>
      {showDiff && (
        <>
          <div className="cols">
            <div className="colhead">
              original — <code>{comparison.original?.sha}</code>, {comparison.original?.lines} lines
            </div>
            <div className="colhead">
              in the repo now — <code>{current?.sha}</code>, {current?.lines} lines
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

      {(reports.length > 0 || prs.length > 0) && (
        <>
          <h2>Write-ups</h2>
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
    </>
  );
};

export default Skill;
