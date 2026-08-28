import { Link } from "react-router-dom";
import { useIndex } from "../lib/data.js";

const Writeups = () => {
  const index = useIndex();
  const prs = [...index.prs].sort((a, b) => b.number - a.number);

  return (
    <>
      <h1>Write-ups</h1>
      <p className="lede">
        Reports committed to <code>reports/</code>, and the pull request that carried each benchmark in. The pull
        request description is often the fuller account — the findings and the skill defects, not only the tables.
      </p>

      <h2>Reports</h2>
      <ul className="docs">
        {[...index.reports].reverse().map(report => (
          <li key={report.file}>
            <Link to={`/report/${report.file}`}>{report.title}</Link>{" "}
            <span className="muted small">{report.date}</span>
          </li>
        ))}
      </ul>

      <h2>Pull requests</h2>
      <ul className="docs">
        {prs.map(pr => (
          <li key={pr.number}>
            <Link to={`/pr/${pr.number}`}>
              #{pr.number} {pr.title}
            </Link>{" "}
            <span className="muted small">
              {pr.state.toLowerCase()}
              {pr.merged_at ? ` · ${pr.merged_at.slice(0, 10)}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
};

export default Writeups;
